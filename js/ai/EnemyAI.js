// SimpleBot — ИИ ботов. Движение идёт по графу перемещений (navMesh.js),
// цель выбирается по режиму; стрельба, гранаты, умения/ульты — здесь же.
import { navGraph, nearestNode, findPath, followPath, edgeKey } from './navMesh.js';
import { ammoLow } from '../entities/player/hud.js';

const CALLSIGNS = [
  'Орион', 'Скала', 'Дикий', 'Буран', 'Волк', 'Рысь', 'Гром', 'Тень',
  'Клык', 'Беркут', 'Смерч', 'Базальт', 'Агат', 'Хан', 'Ворон', 'Шторм',
  'Молот', 'Призрак', 'Кобра', 'Сокол', 'Титан', 'Вихрь', 'Зубр', 'Фантом'
];

const ROUTES = ['low', 'mid', 'high'];

function rndColor() {
  const c = () => 80 + Math.floor(Math.random() * 140);
  return (c() << 16) | (c() << 8) | c();
}

export default class EnemyAI {
  constructor(player, scene) {
    this.p = player;
    this.scene = scene;
    this._lastShot = 0;
    this._lastGrenade = 0;
    this._lastAbility = 0;
    this._coverDucking = false;
    this._nav = null;
    this._navCd = 0;
    this._navFails = 0;
    this._navReason = null;
    this._ban = new Map();

    // Случайный позывной (всегда).
    player.playerName = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)];
    // Случайная внешность.
    try {
      player.playerHeadColor = '#' + rndColor().toString(16).padStart(6, '0');
      player.playerBodyColor = '#' + rndColor().toString(16).padStart(6, '0');
    } catch (e) {}
  }

  update(time, delta) {
    const p = this.p;
    const scene = this.scene;
    if (!p || p.dead || p.active === false) {
      try { p.stop(); } catch (e) {}
      return;
    }
    // Манекен: не двигается и не стреляет.
    if (this.dummy) {
      try { p.stop(); } catch (e) {}
      return;
    }

    // Песочница: боты не стреляют/не кидают (см. difficulty.js).
    let _passive = false;
    try {
      const _d = scene.botDifficulty;
      if (_d && _d.passive) _passive = true;
    } catch (e) {}

    // Цель: сначала объективы матча, затем ближайший враг.
    const target = this._pickTarget(time);
    if (!target) {
      try { p.stop(); } catch (e) {}
      return;
    }

    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const isMeleeW = !!(p.weapon && (p.weapon.isMelee || p.weapon.category === 'melee'));
    const weaponRange = (p.weapon && p.weapon.range) ? p.weapon.range : 700;

    // Цель стрельбы: видимый враг в приоритете (не целимся сквозь стены).
    // При отсутствии прямой видимости — никто: прицел уходит в цель движения,
    // а стрельбу блокирует LOS (быстрее установить видимость, подойдя).
    let shootTarget = this._pickShootTarget(weaponRange);
    if (shootTarget && (shootTarget.team === p.team || shootTarget.dead || !shootTarget.active)) {
      shootTarget = null;
    }
    const distToShoot = shootTarget ? Math.hypot(shootTarget.x - p.x, shootTarget.y - p.y) : Infinity;

    // Темп стрельбы по сложности (ветеран быстрее).
    let shootInterval = 280;
    try {
      const diff = scene.botDifficulty;
      const fr = (p.weapon && p.weapon.fireRate) || 600;
      const mult = (diff && diff.cadMult) || 1.5;
      shootInterval = Phaser.Math.Clamp(Math.round(fr * mult), 130, 1200);
    } catch (e) {}

    // Враг держим на дистанции 0.3..1.0 дальности оружия: ближе — отходим, в поясе — стоим.
    // С ближним оружием — подходим вплотную к врагу (не держим дистанцию).
    const targetIsEnemy = !!(target && (target.maxHp !== undefined || target.dead !== undefined) &&
      target.team && target.team !== p.team);
    const distToT = Math.hypot(dx, dy);
    const minD = isMeleeW ? 0 : weaponRange * 0.3;
    const maxD = isMeleeW ? Math.max(36, weaponRange * 0.55) : weaponRange * 1.0;

    const midAir = !!(this._nav && this._nav.phase === 1 && !this._nav.done);
    const grounded = !!(p.body && (p.body.blocked.down || p.body.touching.down));

    // Проверка нахождения внутри целевой зоны (закладка бомбы, разминирование, захват KOTH)
    const isAtPlant = !!(target && target._isPlantZone && Math.abs(dx) <= 75);
    const isAtDefuse = !!(target && target._isDefuseTarget && Math.abs(dx) <= 45 && Math.abs(dy) <= 60);
    const isAtKoth = !!(target && target._isKothZone && Math.abs(dx) <= 65 && Math.abs(dy) <= 45);
    const inObjectiveZone = isAtPlant || isAtDefuse || isAtKoth;

    // Тактическое укрытие (мешки, капот машины, низкие блоки 22..85px)
    const lowCover = (!midAir && grounded) ? this._findNearbyLowCover() : null;
    const isReloading = !!(p.weapon && p.weapon.reloading);
    const isCriticalHp = p.hp < p.maxHp * 0.40;
    const hasEnemyThreat = !!(shootTarget && distToShoot <= weaponRange + 80);

    // Приседаем (duck), если:
    // 1. Идет перезарядка рядом с укрытием
    // 2. Критическое здоровье под угрозой врага (выглядываем только для выстрела)
    // 3. Перестрелка из-за укрытия: пригибаемся в паузах между выстрелами от ответного огня
    // 4. Стоим в зоне закладки/разминирования бомбы рядом с укрытием
    let wantCoverDuck = false;
    if (lowCover) {
      if (inObjectiveZone) {
        wantCoverDuck = true;
      } else if (!isMeleeW && hasEnemyThreat) {
        if (isReloading) {
          wantCoverDuck = true;
        } else if (isCriticalHp) {
          // Выглядываем (peek) только когда оружие готово произвести выстрел
          const readyToFire = time - this._lastShot >= shootInterval;
          wantCoverDuck = !readyToFire;
        } else if (distToShoot > 140) {
          // Тактическая перестрелка: в паузе между выстрелами пригибаемся за укрытием,
          // приподнимаемся перед выстрелом (peek & fire)
          const readyToFire = time - this._lastShot >= shootInterval * 0.65;
          wantCoverDuck = !readyToFire;
        }
      }
    }

    if (wantCoverDuck) {
      this._coverDucking = true;
      try { if (typeof p.setCrouch === 'function') p.setCrouch(true); } catch (e) {}
    } else if (this._coverDucking) {
      this._coverDucking = false;
      try { if (typeof p.setCrouch === 'function') p.setCrouch(false); } catch (e) {}
    }

    let _holdLos = true;
    try {
      if (typeof scene.hasLineOfSight === 'function') {
        _holdLos = !!scene.hasLineOfSight(p.x, p.y, target.x, target.y);
      }
    } catch (e) { _holdLos = true; }
    const inBand = targetIsEnemy && _holdLos && distToT >= minD - 20 && distToT <= maxD + 20;
    if (inBand) { if (!this._holdT0) this._holdT0 = time; } else this._holdT0 = 0;
    const holdTooLong = !!this._holdT0 && time - this._holdT0 > 4000;

    if (this.stationary) {
      try { p.stop(); } catch (e) {}
    } else if (inObjectiveZone) {
      try { p.stop(); } catch (e) {}
    } else if (wantCoverDuck && !targetIsEnemy) {
      try { p.stop(); } catch (e) {}
    } else if (midAir) {
      this._navigate(target, time, dx);
    } else if (!isMeleeW && inBand && !holdTooLong) {
      try { p.stop(); } catch (e) {}
    } else if (!isMeleeW && targetIsEnemy && distToT < minD - 20) {
      this._fallbackMove(-Math.sign(dx || 1));
    } else if (isMeleeW && targetIsEnemy && distToT <= 42) {
      // Вплотную к цели — стоим и бьём
      try { p.stop(); } catch (e) {}
    } else {
      this._navigate(target, time, dx);
    }

    // Если бот не на ребре пути с флагом low (присед), не в воздухе в фазе прыжка и не сидит в тактическом укрытии —
    // встаем из приседа, чтобы не залипать на укрытиях в сидячем положении.
    if (p.crouching && !midAir && !this._coverDucking) {
      const curEdge = this._nav && this._nav.path && this._nav.path[this._nav.i];
      if (!curEdge || !curEdge.low) {
        try { if (typeof p.setCrouch === 'function') p.setCrouch(false); } catch (e) {}
      }
    }

    // Прицел: видимый враг > цель движения (без наведения сквозь стены/платформы).
    const aimAt = shootTarget || (targetIsEnemy ? target : target);
    if (aimAt) {
      try { p.aimAt(aimAt.x, aimAt.y); } catch (e) {}
    }

    if (shootTarget) {
      // Стрельба: только при прямой видимости (shootTarget уже видим).
      let _shootLos = true;
      try {
        if (typeof scene.hasLineOfSight === 'function') {
          _shootLos = !!scene.hasLineOfSight(p.x, p.y + (p.crouching ? -6 : -24), shootTarget.x, shootTarget.y);
        }
      } catch (e) { _shootLos = true; }

      if (!_passive && _shootLos && distToShoot <= weaponRange + 60 &&
          time - this._lastShot > shootInterval) {
        this._lastShot = time;
        try {
          const ok = p.shoot(time, shootTarget.x, shootTarget.y);
          if (!ok) this._lastShot = time - Math.round(shootInterval * 0.5);
        } catch (e) {}
      }
    }

    // Гранаты (редко): только по видимому реальному врагу.
    const _grenadeTarget = this._pickShootTarget(weaponRange + 200) || this._nearestEnemy(true);
    let _grenadeLos = false;
    if (_grenadeTarget) {
      try {
        if (typeof scene.hasLineOfSight === 'function') {
          _grenadeLos = !!scene.hasLineOfSight(p.x, p.y, _grenadeTarget.x, _grenadeTarget.y);
        } else {
          _grenadeLos = true;
        }
      } catch (e) { _grenadeLos = false; }
    }
    let _nadeChance = 0.02;
    try {
      if (scene.botDifficulty && scene.botDifficulty.passive) _nadeChance = 0;
    } catch (e) {}
    if (!this.noGrenades && !_passive && _grenadeTarget && _grenadeLos &&
        time - this._lastGrenade > 4000 && Math.random() < _nadeChance && this._canLob(_grenadeTarget)) {
      this._lastGrenade = time;
      try { p.throwGrenade('frag', _grenadeTarget.x, _grenadeTarget.y); } catch (e) {}
    }

    // Умение: разумное применение по ситуации вместо случайного спама.
    if (time - this._lastAbility > 2000 && this._shouldUseAbility(time)) {
      this._lastAbility = time;
      try { p.useAbility(time); } catch (e) {}
    }

    // Ультимейт.
    try {
      if (p.ultCharge >= p.ultMaxCharge && p.ultMaxCharge > 0) {
        p.useUltimate(time);
      }
    } catch (e) {}
  }

  // Движение к цели по графу. Если пути нет или нода не найдена — прямой ход к цели.
  _navigate(target, time, dx) {
    const p = this.p;
    const scene = this.scene;
    const body = p.body;
    if (!body) { this._fallbackMove(dx > 0 ? 1 : -1); return; }
    const tall = body.height > 75;
    const graph = navGraph(scene, tall);
    const grounded = !!(body.blocked.down || body.touching.down);
    const cx = body.x + body.width / 2;
    const feet = body.bottom;
    const goal = nearestNode(graph, target.x, target.y + (target.body ? target.body.bottom - target.y : 30));

    let nav = this._nav;
    if (nav && nav.tall !== tall) nav = null;
    if (nav && nav.goal !== (goal && goal.id) && nav.phase === 0 && grounded) nav = null;
    if (nav && nav.done && goal && nav.goal !== goal.id) nav = null;

    if (!nav) {
      if (!goal || !grounded || time < this._navCd) { this._fallbackMove(dx > 0 ? 1 : -1, dx); return; }
      let start = nearestNode(graph, cx, feet, 20, 14);
      if (!start) start = nearestNode(graph, cx, feet, 60, 40);
      if (!start) start = nearestNode(graph, cx, feet, 140, 90);
      const now = time;
      for (const [k, until] of this._ban) if (until < now) this._ban.delete(k);

      let crowdNodes = null;
      try {
        if (scene.players && scene.players.length > 2) {
          crowdNodes = new Set();
          for (let pi = 0; pi < scene.players.length; pi++) {
            const mate = scene.players[pi];
            if (!mate || mate === p || mate.dead || mate.team !== p.team) continue;
            const mNav = mate.ai && mate.ai._nav;
            if (mNav && mNav.path && mNav.path[mNav.i]) {
              crowdNodes.add(mNav.path[mNav.i].to.id);
            }
          }
        }
      } catch (err) {}

      const isBombCarrier = !!(p.isCarrier && !p.isFlagCarrier);
      const path = start ? findPath(graph, start, goal, new Set(this._ban.keys()), { isBombCarrier, crowdNodes }) : null;
      if (!path) {
        this._navCd = time + 500;
        this._fallbackMove(dx > 0 ? 1 : -1, dx);
        return;
      }
      nav = this._nav = { goal: goal.id, tall, path, i: 0, phase: 0, et: time, done: path.length === 0 };
    }

    if (nav.done) { try { p.stop(); if (typeof p.setCrouch === 'function') p.setCrouch(false); } catch (e) {} return; }
    const r = followPath(p, nav, time);
    if (r === 'done') {
      nav.done = true;
      try { p.stop(); if (typeof p.setCrouch === 'function') p.setCrouch(false); } catch (e) {}
    } else if (r === 'fail') {
      this._navFails = (this._navFails || 0) + 1;
      this._navReason = nav.reason;
      const bad = nav.path[nav.i];
      if (bad) this._ban.set(edgeKey(bad), time + 8000);
      this._nav = null;
      this._navCd = time + 400;
      try { if (typeof p.setCrouch === 'function') p.setCrouch(false); } catch (e) {}
      this._fallbackMove(dx > 0 ? 1 : -1, dx);
    }
  }

  // Долетит ли граната, брошенная в сторону цели, до радиуса поражения рядом с ней.
  // Бросок задаёт только направление (см. shoot.js/throwGrenade): скорость и
  // гравитация те же, что у Grenade; фитиль 1.1 с; радиус 90 px.
  _canLob(target) {
    const p = this.p;
    const scene = this.scene;
    if (Math.hypot(target.x - p.x, target.y - p.y) < 160) return false;
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    const g = (scene.mutators && scene.mutators.includes('moon')) ? 460 : 920;
    const speed = 680;
    let x = p.x + Math.cos(ang) * 30;
    let y = p.y + (p.crouching ? -20 : -38);
    let vx = Math.cos(ang) * speed;
    let vy = Math.sin(ang) * speed - 300;
    const dt = 1 / 120;
    for (let t = 0; t < 1.1; t += dt) {
      vy += g * dt;
      x += vx * dt;
      y += vy * dt;
      try { if (scene._inSolid && scene._inSolid(x, y, 4)) break; } catch (e) {}
    }
    return Math.hypot(x - target.x, y - target.y) <= 90;
  }

  // Проверка необходимости применения классового умения.
  _shouldUseAbility(time) {
    const p = this.p;
    if (!p || p.dead || !p.hasAbility) return false;
    if (time < p.lastAbilityAt + p.abilityCooldown) return false;

    const abName = p.abilityName;
    const scene = this.scene;
    const players = (scene && scene.players) || [];

    if (abName === 'Аптечка') {
      // 1. Себе: если HP < 75%
      if (p.hp < p.maxHp * 0.75) return true;
      // 2. Союзнику рядом: если у союзника HP < 75%
      for (let i = 0; i < players.length; i++) {
        const m = players[i];
        if (!m || m === p || m.dead || !m.active || m.team !== p.team) continue;
        if (Math.abs(m.y - p.y) > 100) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d <= 280 && m.hp < m.maxHp * 0.75) return true;
      }
      return false;
    }

    if (abName === 'Броня') {
      // 1. Себе: если броня упала ниже 40%
      if (p.armor < p.maxArmor * 0.4) return true;
      // 2. Союзнику рядом: если у союзника брони < 40%
      for (let i = 0; i < players.length; i++) {
        const m = players[i];
        if (!m || m === p || m.dead || !m.active || m.team !== p.team) continue;
        if (Math.abs(m.y - p.y) > 100) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d <= 280 && m.armor < m.maxArmor * 0.4) return true;
      }
      return false;
    }

    if (abName === 'Сумка с патронами') {
      // 1. Себе: мало патронов
      if (ammoLow(p)) return true;
      // 2. Союзнику рядом: если у союзника мало патронов — кидаем ему
      for (let i = 0; i < players.length; i++) {
        const m = players[i];
        if (!m || m === p || m.dead || !m.active || m.team !== p.team) continue;
        if (Math.abs(m.y - p.y) > 100) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d <= 260 && ammoLow(m)) {
          p._abilityTargetX = m.x;
          return true;
        }
      }
      return false;
    }

    return false;
  }

  // Поиск подходящего кита (аптечка, броня, патроны), лежащего неподалёку.
  _findNeededPickup() {
    const p = this.p;
    const scene = this.scene;
    if (!scene || !scene.pickups) return null;

    const hpLow = p.hp < p.maxHp * 0.55;
    const armorLow = p.armor < p.maxArmor * 0.35;
    const isAmmoLow = ammoLow(p);

    if (!hpLow && !armorLow && !isAmmoLow) return null;

    const kids = scene.pickups.getChildren();
    if (!kids || kids.length === 0) return null;

    let best = null;
    let bestDist = Infinity;
    const MAX_SEARCH_DIST = 500;

    for (let i = 0; i < kids.length; i++) {
      const pk = kids[i];
      if (!pk || !pk.active) continue;
      // Нельзя забрать чужой командный кит
      if (pk.team && pk.team !== p.team) continue;
      // Проверяем, нужен ли этот конкретный предмет
      const type = pk.pickupType;
      let needed = false;
      if (type === 'medkit' && hpLow) needed = true;
      else if (type === 'armor' && armorLow) needed = true;
      else if (type === 'ammo' && isAmmoLow) needed = true;

      if (!needed) continue;
      if (typeof pk.canTake === 'function' && !pk.canTake(p)) continue;

      // Ограничение по высоте: не лезем за китами далеко по вертикали (чужие ярусы)
      if (Math.abs(pk.y - p.y) > 160) continue;

      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d > MAX_SEARCH_DIST) continue;

      // Приоритет аптечке при критическом здоровье
      const score = (type === 'medkit' && p.hp < p.maxHp * 0.35) ? d * 0.5 : d;
      if (score < bestDist) {
        bestDist = score;
        best = pk;
      }
    }
    return best;
  }

  // Поиск ближайшего низкого укрытия (мешки, капот машины, ящик) для приседа
  _findNearbyLowCover() {
    const p = this.p;
    const scene = this.scene;
    if (!scene || !scene.covers || !p.body) return null;
    const pb = p.body;
    const feetY = pb.bottom;
    const px = pb.x + pb.width / 2;
    const covers = scene.covers.getChildren ? scene.covers.getChildren() : [];
    for (let i = 0; i < covers.length; i++) {
      const c = covers[i];
      if (!c || !c.body || !c.body.enable) continue;
      const cb = c.body;
      // Подходящая высота укрытия для стрельбы из приседа (22..95px)
      if (cb.height < 22 || cb.height > 95) continue;
      // Тот же уровень пола (разница подошвы не более 35px)
      if (Math.abs(cb.bottom - feetY) > 35) continue;
      // Горизонтальная близость к укрытию (до 100px)
      const cx = cb.x + cb.width / 2;
      if (Math.abs(cx - px) <= 100) {
        return c;
      }
    }
    return null;
  }

  _fallbackMove(dir, dx) {
    const p = this.p;
    if (dx !== undefined && Math.abs(dx) <= 30) { try { p.stop(); } catch (e) {} return; }
    try { if (dir > 0) p.move(1); else p.move(-1); } catch (e) {}
  }

  // ── Координация и навигация по флангам (3 лейна) ─────────────────────────

  _botId() {
    if (this._botIdCache != null) return this._botIdCache;
    const p = this.p;
    let h = 0;
    const s = String((p && p.playerName) || '');
    for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
    // добавляем координату спавна для уникальности одноимённых
    try { h = (h ^ ((p.spawn && p.spawn.x) | 0)) | 0; } catch (e) {}
    this._botIdCache = Math.abs(h);
    return this._botIdCache;
  }

  _hasLosTo(tx, ty, fromY) {
    try {
      if (typeof this.scene.hasLineOfSight !== 'function') return true;
      const p = this.p;
      const fy = fromY != null ? fromY : (p.y + (p.crouching ? -6 : -24));
      return !!this.scene.hasLineOfSight(p.x, fy, tx, ty);
    } catch (e) { return true; }
  }

  // Цель стрельбы: видимый враг (LOS) в приоритете; без видимости — null,
  // чтобы не целиться сквозь стены/платформы. «Быстрее получить LOS»:
  // двигаемся к ближайшему врагу на своём ярусе (через цель перемещения).
  _pickShootTarget(weaponRange) {
    const p = this.p;
    const scene = this.scene;
    const wr = weaponRange || ((p.weapon && p.weapon.range) ? p.weapon.range : 700);
    const players = scene.players || [];
    let bestVis = null, bestVisD = Infinity;
    let bestVisFar = null, bestVisFarD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const o = players[i];
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d > wr + 120) continue;
      const oy = o.y - 24;
      if (!this._hasLosTo(o.x, oy)) continue;
      const sameTier = Math.abs(o.y - p.y) <= 140;
      if (sameTier) {
        if (d < bestVisD) { bestVisD = d; bestVis = o; }
      } else if (!bestVis && d < bestVisFarD) {
        bestVisFarD = d; bestVisFar = o;
      }
    }
    return bestVis || bestVisFar || null;
  }

  _nearestEnemy(losOnly) {
    const p = this.p;
    const scene = this.scene;
    let best = null, bestD = Infinity;
    const wr = (p.weapon && p.weapon.range) ? p.weapon.range : 700;
    for (const o of (scene.players || [])) {
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      if (Math.abs(o.y - p.y) > 140) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d > wr + 120) continue;
      if (losOnly && !this._hasLosTo(o.x, o.y - 24)) continue;
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) return best;
    bestD = Infinity; best = null;
    for (const o of (scene.players || [])) {
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      if (Math.abs(o.y - p.y) > 140) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (losOnly && !this._hasLosTo(o.x, o.y - 24)) continue;
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) return best;
    if (losOnly) return null;
    // последний фолбэк: любой враг (другой фланг)
    bestD = Infinity; best = null;
    for (const o of (scene.players || [])) {
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  _getLanes(teamSide) {
    try {
      const scene = this.scene;
      const data = scene._lanes || scene._modeLanes || (scene.campaignLevel && scene.campaignLevel._lanes) || (scene.level && scene.level._lanes) || (scene.mapData && scene.mapData._lanes);
      if (!data) return null;
      return data[teamSide || this.p.team] || null;
    } catch (e) { return null; }
  }

  _laneChain(route) {
    const lanes = this._getLanes(this.p.team);
    if (!lanes) return null;
    const r = (route && lanes[route]) ? route : (this._ctfRoute && lanes[this._ctfRoute] ? this._ctfRoute : null);
    return r ? lanes[r] : null;
  }

  // Вейпоинт по назначенному коридору в сторону цели (для 3-фланговых карт).
  // Возвращает промежуточную точку, чтобы развести ботов по low/mid/high;
  // у цели (<directDist) отдаёт саму цель. Гистерезис: не прыгаем назад по цепочке.
  _routeTarget(goal, route, time, directDist) {
    if (!goal || !Number.isFinite(goal.x) || !Number.isFinite(goal.y)) return goal;
    const chain = this._laneChain(route);
    if (!chain || !chain.length) return goal;
    const p = this.p;
    const dd = directDist == null ? 300 : directDist;
    const gdx = goal.x - p.x;
    const toGoal = Math.hypot(gdx, goal.y - p.y);
    if (toGoal <= dd) return goal;

    // Индекс ближайшей к боту точки цепочки (вперёд от последней, гистерезис).
    let from = (this._laneIdx | 0);
    if (from < 0 || from >= chain.length) from = 0;
    if (time - (this._laneIdxAt || 0) > 3500) from = 0;
    let bestI = from, bestD = Infinity;
    const lo = Math.max(0, from - 1), hi = Math.min(chain.length - 1, from + 4);
    for (let i = lo; i <= hi; i++) {
      const n = chain[i];
      const d = Math.hypot(n[0] - p.x, n[1] - p.y);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    // Если далеко от цепочки — переякориться глобально (редко).
    if (bestD > 520) {
      bestI = 0; bestD = Infinity;
      for (let i = 0; i < chain.length; i++) {
        const n = chain[i];
        const d = Math.hypot(n[0] - p.x, n[1] - p.y);
        if (d < bestD) { bestD = d; bestI = i; }
      }
    }

    const dir = gdx >= 0 ? 1 : -1;
    let pick = bestI;
    // Берём точку заметно впереди по направлению к цели, но не дальше самой цели.
    for (let step = 1; step <= 4; step++) {
      const j = bestI + dir * step;
      if (j < 0 || j >= chain.length) break;
      const n = chain[j];
      // не уводим за цель по X
      if ((goal.x - n[0]) * dir < -80) break;
      pick = j;
      const nd = Math.hypot(n[0] - p.x, n[1] - p.y);
      if (nd > 220) break;
    }
    // Если стоим прямо на точке — толкаем дальше по маршруту.
    const cur = chain[pick];
    if (Math.hypot(cur[0] - p.x, cur[1] - p.y) < 70) {
      const j = pick + dir;
      if (j >= 0 && j < chain.length && (goal.x - chain[j][0]) * dir >= -120) pick = j;
    }
    this._laneIdx = pick;
    this._laneIdxAt = time;
    const wp = chain[pick];
    return { x: wp[0], y: wp[1] - 2, _laneWp: true };
  }

  _teamBots(team) {
    const out = [];
    const pl = this.scene.players || [];
    for (let i = 0; i < pl.length; i++) {
      const o = pl[i];
      if (!o || o.dead || o.active === false) continue;
      if (o.team !== team) continue;
      if (o.ai) out.push(o.ai);
    }
    return out;
  }

  _routeLoad(route, goalX) {
    // Сколько своих атакующих уже ближе к середине/цели по этому маршруту.
    let n = 0;
    const bots = this._teamBots(this.p.team);
    for (let i = 0; i < bots.length; i++) {
      const a = bots[i];
      if (a === this || !a || a._ctfRole === 'holdhigh') continue;
      if ((a._ctfRoute || 'mid') === route) n++;
    }
    // Лёгкий штраф, если мы сами далеко — не влияет на абсолют, только на выбор.
    return n;
  }

  _pickLeastLoadedRoute(goalX, prefer) {
    let best = prefer && ROUTES.includes(prefer) ? prefer : ROUTES[this._botId() % 3];
    let bestN = Infinity;
    for (let i = 0; i < ROUTES.length; i++) {
      const r = ROUTES[i];
      const n = this._routeLoad(r, goalX);
      if (n < bestN || (n === bestN && r === (prefer || best))) { bestN = n; best = r; }
    }
    return best;
  }

  // Динамическая координация CTF (троттлинг ~700мс, дёшево).
  _coordCtf(time, ownFlag, enemyFlag) {
    if (time - (this._coordAt || 0) < 700) return;
    this._coordAt = time;
    const p = this.p;
    try {
      const bots = this._teamBots(p.team).filter(a => a && a.p && !a.p.dead);
      if (bots.length <= 1) return;
      // Роли по состоянию флага.
      const ownStolen = !!(ownFlag && ownFlag.carrier && ownFlag.carrier.team !== p.team);
      const ownDropped = !!(ownFlag && !ownFlag.carrier && Math.hypot(ownFlag.x - (ownFlag.baseX || 0), ownFlag.y - (ownFlag.baseY || 0)) > 60);
      const allyCarries = !!(enemyFlag && enemyFlag.carrier && enemyFlag.carrier.team === p.team && enemyFlag.carrier !== p);
      const iCarry = !!((enemyFlag && enemyFlag.carrier === p) || (this.scene.ctfSuddenFlag && this.scene.ctfSuddenFlag.carrier === p));

      // Назначить/подтвердить маршруты атакующим, разводя по наименее занятому флангу.
      // holdhigh держит свой маршрут (обычно high), если он один.
      let hold = bots.find(a => a._ctfRole === 'holdhigh');
      if (!hold && bots.length >= 3) {
        // Сохраняем назначение со спавна, если было; иначе один high.
        hold = bots.find(a => a._ctfRoute === 'high') || bots[0];
        if (hold) hold._ctfRole = 'holdhigh';
      }
      const goalX = enemyFlag ? enemyFlag.x : (p.team === 'blue' ? this.scene.mapWidth - 220 : 220);
      for (let i = 0; i < bots.length; i++) {
        const a = bots[i];
        if (!a || a === hold || a.p === enemyFlag?.carrier || a.p === this.scene.ctfSuddenFlag?.carrier) continue;
        if (!a._ctfRoute) a._ctfRoute = ROUTES[a._botId() % 3];
        // Перебалансировка, только если на маршруте явный затор (>=2 лишних) и не держим цель.
        if (!ownStolen && !ownDropped && !allyCarries) {
          const load = a._routeLoad(a._ctfRoute, goalX);
          if (load >= 3 && time - (a._rebalanceAt || 0) > 4000) {
            a._ctfRoute = a._pickLeastLoadedRoute(goalX, null);
            a._laneIdx = 0;
            a._rebalanceAt = time;
          }
        }
        if (a._ctfRole !== 'holdhigh') a._ctfRole = (ownStolen || ownDropped) ? 'react' : 'attack';
      }

      // При угрозе своему флагу — роль роли не фиксируем жёстко тут, _pickTarget
      // уже шлёт на возврат/перехват; это лишь метка.
      if (iCarry) this._ctfRole = 'carry';
    } catch (e) {}
  }

  _pickTarget(time) {
    const p = this.p;
    const scene = this.scene;
    const mode = scene.mode;

    // CTF: приоритеты:
    // 1. Сам несёт флаг (вражеский или золотой) — бежим на свою базу!
    // 2. Свой флаг украден врагом — бежим перехватывать носителя.
    // 3. Свой флаг уронен в поле (не на базе и без носителя) — бежим вернуть его!
    // 4. Золотой флаг (внезапная смерть) — если свободен или у врага.
    // 5. Вражеский флаг — если свободен или если его несёт враг.
    // 6. Если союзник уже несёт вражеский флаг — бежим эскортировать/прикрывать его.
    if (mode === 'CTF') {
      const enemyFlag = p.team === 'blue' ? scene.redFlag : scene.blueFlag;
      const ownFlag = p.team === 'blue' ? scene.blueFlag : scene.redFlag;
      const goldFlag = scene.ctfSuddenFlag;
      try { this._coordCtf(time, ownFlag, enemyFlag); } catch (e) {}
      const homeBaseX = ownFlag ? ownFlag.baseX : (p.team === 'blue' ? 220 : scene.mapWidth - 220);

      // 1. Сам несу флаг (вражеский или золотой) — бежим сдавать на базу (по своему коридору).
      if ((enemyFlag && enemyFlag.carrier === p) || (goldFlag && goldFlag.carrier === p)) {
        const home = { x: homeBaseX, y: scene.mapHeight - 80 };
        return this._routeTarget(home, this._ctfRoute || 'mid', time, 360);
      }

      // 2. Свой флаг украден врагом — срочно перехватываем вора!
      if (ownFlag && ownFlag.carrier && ownFlag.carrier !== p && ownFlag.carrier.team !== p.team) {
        return ownFlag.carrier;
      }

      // 3. Свой флаг лежит брошенный в поле — поднимаем/возвращаем на базу!
      if (ownFlag && !ownFlag.carrier && Number.isFinite(ownFlag.baseX) && Number.isFinite(ownFlag.baseY)) {
        const distFromBase = Math.hypot(ownFlag.x - ownFlag.baseX, ownFlag.y - ownFlag.baseY);
        if (distFromBase > 60) {
          return ownFlag;
        }
      }

      // 4. Внезапная смерть — золотой флаг
      if (goldFlag) {
        if (goldFlag.carrier && goldFlag.carrier.team !== p.team) return goldFlag.carrier;
        if (goldFlag.carrier && goldFlag.carrier.team === p.team && goldFlag.carrier !== p) {
          const carrier = goldFlag.carrier;
          const myEnemies = this._nearestEnemy();
          if (myEnemies && Math.hypot(myEnemies.x - carrier.x, myEnemies.y - carrier.y) < 550) {
            return myEnemies;
          }
          const toHomeDir = homeBaseX > carrier.x ? 1 : -1;
          const slot = (this._botId() % 3);
          let escortX = carrier.x;
          if (slot === 0) escortX += toHomeDir * 140;
          else if (slot === 1) escortX -= toHomeDir * 120;
          else escortX += (this._botId() % 2 === 0 ? 80 : -80);
          return { x: escortX, y: carrier.y };
        }
        if (!goldFlag.carrier) {
          return (this._ctfRole === 'holdhigh') ? this._routeTarget(goldFlag, 'high', time, 260) : this._routeTarget(goldFlag, this._ctfRoute || 'mid', time, 260);
        }
      }

      // 5. Вражеский флаг
      if (enemyFlag) {
        if (enemyFlag.carrier && enemyFlag.carrier !== p) {
          if (enemyFlag.carrier.team !== p.team) {
            return enemyFlag.carrier;
          } else {
            // Союзник несёт флаг — эскорт/расчистка.
            const carrier = enemyFlag.carrier;
            const myEnemies = this._nearestEnemy();
            if (myEnemies && Math.hypot(myEnemies.x - carrier.x, myEnemies.y - carrier.y) < 550) {
              return myEnemies; // Перехватываем угрозу рядом с носителем
            }
            // holdhigh держит высокий фланг впереди по пути домой, остальные — эскорт строем.
            if (this._ctfRole === 'holdhigh') {
              const toHomeDir = homeBaseX > carrier.x ? 1 : -1;
              return this._routeTarget({ x: carrier.x + toHomeDir * 260, y: carrier.y }, 'high', time, 180);
            }
            const toHomeDir = homeBaseX > carrier.x ? 1 : -1;
            const slot = (this._botId() % 3); // 0: авангард, 1: арьергард, 2: фланг
            let escortX = carrier.x;
            if (slot === 0) escortX += toHomeDir * 140;
            else if (slot === 1) escortX -= toHomeDir * 120;
            else escortX += (this._botId() % 2 === 0 ? 80 : -80);
            return { x: escortX, y: carrier.y };
          }
        }
        // Флаг свободен — атакуем по назначенному флангу (3 коридора).
        const route = (this._ctfRole === 'holdhigh') ? 'high' : (this._ctfRoute || ROUTES[this._botId() % 3]);
        return this._routeTarget(enemyFlag, route, time, 280);
      }
    }

    // BOMB: скоординированная тактика команды
    if (mode === 'BOMB') {
      const ourBomb = p.team === 'blue' ? scene.blueBomb : scene.redBomb;
      const enemyBomb = p.team === 'blue' ? scene.redBomb : scene.blueBomb;
      const plantBase = p.team === 'blue' ? scene.enemyBase : scene.blueBase;
      const homeBase = p.team === 'blue' ? scene.blueBase : scene.enemyBase;
      const defend = this._bombRole === 'defend';
      const bombRoute = this._ctfRoute || ROUTES[this._botId() % 3];

      // 1. Бот САМ несёт бомбу — бежим ставить на вражескую базу!
      if (ourBomb && ourBomb.carrier === p) {
        if (plantBase && Number.isFinite(plantBase.x)) {
          return this._routeTarget({ x: plantBase.x, y: plantBase.y, _isPlantZone: true }, bombRoute, time, 280);
        }
      }

      // 2. Вражеская бомба брошена в поле (не дома и без носителя) — ПРИОРИТЕТ: разминировать!
      if (enemyBomb && !enemyBomb.carrier && !enemyBomb.home) {
        return { x: enemyBomb.x, y: enemyBomb.y, _isDefuseTarget: true };
      }

      // 3. Враг несёт свою бомбу — бежим перехватить носителя!
      if (enemyBomb && enemyBomb.carrier && enemyBomb.carrier.team !== p.team) {
        // Дефендер встречает ближе к своей базе/пути, атакующий — со своей позиции.
        if (defend && homeBase) return enemyBomb.carrier;
        return enemyBomb.carrier;
      }

      // 4. Наша бомба брошена в поле — подбираем (атакующие в приоритете), дефендер может страховать.
      if (ourBomb && !ourBomb.carrier && !ourBomb.home) {
        return defend ? { x: ourBomb.x, y: ourBomb.y } : this._routeTarget(ourBomb, bombRoute, time, 220);
      }

      // 5. Союзник несёт нашу бомбу — эскорт и расчистка точки.
      if (ourBomb && ourBomb.carrier && ourBomb.carrier.team === p.team) {
        const carrier = ourBomb.carrier;
        const myEnemies = this._nearestEnemy();
        if (myEnemies && Math.hypot(myEnemies.x - carrier.x, myEnemies.y - carrier.y) < 500) {
          return myEnemies;
        }
        if (defend) {
          // Дефендер прикрывает тыл/свою половину, а не ломится в авангард.
          const escortDir = (plantBase && plantBase.x > carrier.x) ? 1 : -1;
          return { x: carrier.x - escortDir * 110, y: carrier.y };
        }
        if ((this._botId() % 2 === 0) && plantBase && Number.isFinite(plantBase.x)) {
          return this._routeTarget({ x: plantBase.x, y: plantBase.y, _isPlantZone: true }, bombRoute, time, 220);
        }
        const escortDir = (plantBase && plantBase.x > carrier.x) ? 1 : -1;
        return { x: carrier.x + escortDir * 100, y: carrier.y };
      }

      // 6. Наша бомба дома: атакующий идёт за ней по флангу, дефендер держит позицию у своей.
      if (ourBomb && !ourBomb.carrier && ourBomb.home) {
        if (defend && homeBase && Math.hypot(p.x - homeBase.x, p.y - homeBase.y) < 420) {
          const e = this._nearestEnemy();
          if (e) return e;
          return { x: homeBase.x, y: homeBase.y };
        }
        return this._routeTarget(ourBomb, bombRoute, time, 240);
      }

      // 7. Фолбэк
      if (enemyBomb) return enemyBomb;
    }

    // KOTH: распределённый захват и защита контрольных точек
    if (mode === 'KOTH' && Array.isArray(scene.kothPoints) && scene.kothPoints.length) {
      const slot = this._botId() % 3;

      // 1. Точки свои, но под атакой противника (спорные) — защита
      const contestedOwn = scene.kothPoints.filter(pt => pt.holder === p.team && (pt._st === 'contest' || pt.prog !== 0));
      if (contestedOwn.length > 0 && slot === 0) {
        const pt = contestedOwn[0];
        return { x: pt.x, y: pt.y, _isKothZone: true, _point: pt };
      }

      // 2. Чужие или нейтральные точки — захват, распределяя по занятости.
      const unowned = scene.kothPoints.filter(pt => pt.holder !== p.team).slice().sort((a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      if (unowned.length > 0) {
        // Считаем, сколько союзников ближе всего к каждой точке, берём менее занятую из двух ближайших.
        let pick = unowned[0];
        if (unowned.length > 1) {
          const load = (pt) => {
            let n = 0;
            const pl = scene.players || [];
            for (let i = 0; i < pl.length; i++) {
              const m = pl[i];
              if (!m || m === p || m.dead || m.active === false || m.team !== p.team || !m.ai) continue;
              if (Math.hypot(m.x - pt.x, m.y - pt.y) < Math.hypot(m.x - unowned[0].x, m.y - unowned[0].y) + 120) n++;
            }
            return n;
          };
          const a = unowned[0], b = unowned[1];
          if (load(b) < load(a) || (slot === 1 && Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) * 1.35)) pick = b;
        }
        return { x: pick.x, y: pick.y, _isKothZone: true, _point: pick };
      }

      // 3. Все точки наши — удержание + перехват.
      const myPts = scene.kothPoints.slice().sort((a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      const defPt = myPts[this._botId() % myPts.length];
      if (defPt) {
        const nearEnemy = this._nearestEnemy();
        if (nearEnemy && Math.hypot(nearEnemy.x - defPt.x, nearEnemy.y - defPt.y) < 420) {
          return nearEnemy;
        }
        return { x: defPt.x, y: defPt.y, _isKothZone: true, _point: defPt };
      }
    }

    // Поиск аптечки/брони/патронов поблизости, если бот не занят флагом/бомбой
    const neededPickup = this._findNeededPickup();
    if (neededPickup) return neededPickup;

    // По умолчанию — ближайший враг: видимый на своём ярусе в приоритете
    // (чтобы быстрее установить LOS), иначе ближайший на своём ярусе, иначе любой.
    let best = null, bestD = Infinity;
    const wr = (p.weapon && p.weapon.range) ? p.weapon.range : 700;
    const pickEnemy = (sameTier, losOnly) => {
      let b = null, bd = Infinity;
      for (const o of (scene.players || [])) {
        if (o === p || !o || o.dead || o.active === false) continue;
        if (o.team === p.team) continue;
        if (sameTier && Math.abs(o.y - p.y) > 140) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (sameTier && d > wr + 120) continue;
        if (losOnly && !this._hasLosTo(o.x, o.y - 24)) continue;
        if (d < bd) { bd = d; b = o; }
      }
      return b;
    };
    best = pickEnemy(true, true) || pickEnemy(true, false) || pickEnemy(false, false);
    if (best) return best;
    // последний фолбэк: любой враг (другой фланг)
    bestD = Infinity; best = null;
    for (const o of (scene.players || [])) {
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  onShot(attacker, time) {
    try { this.p.jump(); } catch (e) {}
    if (this.scene && this.scene.enemiesActiveAt) {
      this.scene.enemiesActiveAt = 0;
    }
  }

  forceJump() {
    try { this.p.jump(); } catch (e) {}
  }

  _smartDetour(time, x, y) {}
}
