// SimpleBot — ИИ ботов. Движение идёт по графу перемещений (navMesh.js),
// цель выбирается по режиму; стрельба, гранаты, умения/ульты — здесь же.
import { navGraph, nearestNode, findPath, followPath, edgeKey } from './navMesh.js?v=24';

const CALLSIGNS = [
  'Орион', 'Скала', 'Дикий', 'Буран', 'Волк', 'Рысь', 'Гром', 'Тень',
  'Клык', 'Беркут', 'Смерч', 'Базальт', 'Агат', 'Хан', 'Ворон', 'Шторм',
  'Молот', 'Призрак', 'Кобра', 'Сокол', 'Титан', 'Вихрь', 'Зубр', 'Фантом'
];

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
    const weaponRange = (p.weapon && p.weapon.range) ? p.weapon.range : 700;

    // Враг держим на дистанции 0.3..1.0 дальности оружия: ближе — отходим, в поясе — стоим.
    const targetIsEnemy = !!(target && (target.maxHp !== undefined || target.dead !== undefined) &&
      target.team && target.team !== p.team);
    const distToT = Math.hypot(dx, dy);
    const minD = weaponRange * 0.3;
    const maxD = weaponRange * 1.0;

    const midAir = !!(this._nav && this._nav.phase === 1 && !this._nav.done);
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
    } else if (midAir) {
      this._navigate(target, time, dx);
    } else if (inBand && !holdTooLong) {
      try { p.stop(); } catch (e) {}
    } else if (targetIsEnemy && distToT < minD - 20) {
      this._fallbackMove(-Math.sign(dx || 1));
    } else {
      this._navigate(target, time, dx);
    }

    // Цель стрельбы: ближайший враг (независимо от цели движения).
    let shootTarget = this._nearestEnemy();
    if (!shootTarget) shootTarget = target;
    // Не стреляем в флаг — это не враг
    if (shootTarget && (shootTarget === (this.scene.blueFlag || (this.scene.blueFlag || {})) ||
                        shootTarget === (this.scene.redFlag || (this.scene.redFlag || {})) ||
                        (shootTarget.team === 'gold' || shootTarget === (this.scene.ctfSuddenFlag || null)))) {
      shootTarget = null;
    }

    // Прицел.
    try { p.aimAt(shootTarget.x, shootTarget.y); } catch (e) {}

    const distToShoot = Math.hypot(shootTarget.x - p.x, shootTarget.y - p.y);
    // Темп стрельбы по сложности (ветеран быстрее).
    let shootInterval = 280;
    try {
      const diff = scene.botDifficulty;
      const fr = (p.weapon && p.weapon.fireRate) || 600;
      const mult = (diff && diff.cadMult) || 1.5;
      shootInterval = Phaser.Math.Clamp(Math.round(fr * mult), 130, 1200);
    } catch (e) {}

    // Стрельба: только если есть прямая видимость до цели (стены режут).
    let _shootLos = true;
    try {
      if (typeof scene.hasLineOfSight === 'function') {
        _shootLos = !!scene.hasLineOfSight(p.x, p.y, shootTarget.x, shootTarget.y);
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

    // Гранаты (редко): только по реальному врагу в прямой видимости.
    const _grenadeTarget = this._nearestEnemy();
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

    // Умение.
    if (time - this._lastAbility > 6000 && Math.random() < 0.015) {
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
    const tall = body.height > 75 || !!p.crouching;
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
      const start = nearestNode(graph, cx, feet, 20, 14);
      const now = time;
      for (const [k, until] of this._ban) if (until < now) this._ban.delete(k);
      const path = start ? findPath(graph, start, goal, new Set(this._ban.keys())) : null;
      if (!path) {
        this._navCd = time + 500;
        this._fallbackMove(dx > 0 ? 1 : -1, dx);
        return;
      }
      nav = this._nav = { goal: goal.id, tall, path, i: 0, phase: 0, et: time, done: path.length === 0 };
    }

    if (nav.done) { try { p.stop(); } catch (e) {} return; }
    const r = followPath(p, nav, time);
    if (r === 'done') {
      nav.done = true;
      try { p.stop(); } catch (e) {}
    } else if (r === 'fail') {
      this._navFails = (this._navFails || 0) + 1;
      this._navReason = nav.reason;
      const bad = nav.path[nav.i];
      if (bad) this._ban.set(edgeKey(bad), time + 8000);
      this._nav = null;
      this._navCd = time + 400;
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

  _fallbackMove(dir, dx) {
    const p = this.p;
    if (dx !== undefined && Math.abs(dx) <= 30) { try { p.stop(); } catch (e) {} return; }
    try { if (dir > 0) p.move(1); else p.move(-1); } catch (e) {}
  }

  _nearestEnemy() {
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
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) return best;
    bestD = Infinity; best = null;
    for (const o of (scene.players || [])) {
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  _pickTarget(time) {
    const p = this.p;
    const scene = this.scene;
    const mode = scene.mode;

    // CTF: цель — вражеский флаг (или его носитель-ВРАГ).
    if (mode === 'CTF') {
      const enemyFlag = p.team === 'blue' ? scene.redFlag : scene.blueFlag;
      const ownFlag = p.team === 'blue' ? scene.blueFlag : scene.redFlag;
      if (enemyFlag) {
        // Сам несёт вражеский флаг — бежим на свою базу.
        if (enemyFlag.carrier === p && ownFlag &&
            Number.isFinite(ownFlag.baseX) && Number.isFinite(ownFlag.baseY)) {
          return { x: ownFlag.baseX, y: ownFlag.baseY };
        }
        // Носителя атакуем только если он из вражеской команды.
        if (enemyFlag.carrier && enemyFlag.carrier !== p &&
            enemyFlag.carrier.team !== p.team) return enemyFlag.carrier;
        return enemyFlag;
      }
    }

    // BOMB: цель — бомба (или точка закладки).
    if (mode === 'BOMB') {
      const bomb = p.team === 'blue' ? scene.blueBomb : scene.redBomb;
      if (bomb && !bomb.carrier) return bomb;
      const enemyBomb = p.team === 'blue' ? scene.redBomb : scene.blueBomb;
      if (enemyBomb && enemyBomb.carrier && enemyBomb.carrier !== p &&
          enemyBomb.carrier.team !== p.team) return enemyBomb.carrier;
      if (enemyBomb) return enemyBomb;
    }

    // KOTH: ближайшая точка, которую не держит своя команда (иначе все стоят у
    // своих и не спорят за средние). Половина ботов берёт вторую по близости.
    // Все точки свои — обычная цель (враг).
    if (mode === 'KOTH' && Array.isArray(scene.kothPoints) && scene.kothPoints.length) {
      const pts = scene.kothPoints.filter(pt => pt.holder !== p.team).slice().sort((a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      let h = 0;
      for (const ch of String(p.playerName || '')) h += ch.charCodeAt(0);
      const pick = pts.length > 1 && (h & 1) ? pts[1] : pts[0];
      if (pick) return pick;
    }

    // По умолчанию — ближайший враг в пределах дальности и на том же фланге.
    let best = null, bestD = Infinity;
    const wr = (p.weapon && p.weapon.range) ? p.weapon.range : 700;
    for (const o of (scene.players || [])) {
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      if (Math.abs(o.y - p.y) > 140) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d > wr + 120) continue;
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) return best;
    // fallback: любой враг на том же фланге
    bestD = Infinity; best = null;
    for (const o of (scene.players || [])) {
      if (o === p || !o || o.dead || o.active === false) continue;
      if (o.team === p.team) continue;
      if (Math.abs(o.y - p.y) > 140) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bestD) { bestD = d; best = o; }
    }
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
  }

  forceJump() {
    try { this.p.jump(); } catch (e) {}
  }

  _smartDetour(time, x, y) {}
}
