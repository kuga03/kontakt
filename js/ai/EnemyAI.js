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

    // Если бот не на ребре пути с флагом low (присед) и не в воздухе в фазе прыжка —
    // встаем из приседа, чтобы не залипать на укрытиях в сидячем положении.
    if (p.crouching && !midAir) {
      const curEdge = this._nav && this._nav.path && this._nav.path[this._nav.i];
      if (!curEdge || !curEdge.low) {
        try { if (typeof p.setCrouch === 'function') p.setCrouch(false); } catch (e) {}
      }
    }

    // Цель стрельбы: ТОЛЬКО реальный живой враг (не флаг, не союзник, не точка).
    let shootTarget = this._nearestEnemy();
    if (shootTarget && (shootTarget.team === p.team || shootTarget.dead || !shootTarget.active)) {
      shootTarget = null;
    }

    if (!shootTarget) {
      // Нет врагов в пределах досягаемости — прекращаем стрельбу
      return;
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

      // 1. Сам несу флаг (вражеский или золотой) — бежим сдавать на базу
      if ((enemyFlag && enemyFlag.carrier === p) || (goldFlag && goldFlag.carrier === p)) {
        if (ownFlag && Number.isFinite(ownFlag.baseX) && Number.isFinite(ownFlag.baseY)) {
          return { x: ownFlag.baseX, y: ownFlag.baseY };
        }
        const bx = p.team === 'blue' ? 220 : (scene.mapWidth - 220);
        return { x: bx, y: scene.mapHeight - 80 };
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
          const homeBaseX = p.team === 'blue' ? 220 : scene.mapWidth - 220;
          const toHomeDir = homeBaseX > carrier.x ? 1 : -1;
          let botHash = 0;
          for (const ch of String(p.playerName || '')) botHash += ch.charCodeAt(0);
          const slot = (botHash % 3);
          let escortX = carrier.x;
          if (slot === 0) escortX += toHomeDir * 140;
          else if (slot === 1) escortX -= toHomeDir * 120;
          else escortX += (botHash % 2 === 0 ? 80 : -80);
          return { x: escortX, y: carrier.y };
        }
        if (!goldFlag.carrier) return goldFlag;
      }

      // 5. Вражеский флаг: если у врага (застрял/украден) или свободен — идём за ним
      if (enemyFlag) {
        if (enemyFlag.carrier && enemyFlag.carrier !== p) {
          if (enemyFlag.carrier.team !== p.team) {
            return enemyFlag.carrier;
          } else {
            // Союзник (или игрок) несёт флаг — не толпимся в одной точке!
            // Часть команды идёт наперехват врагов между носителем и базой,
            // а эскорт держит тактическую дистанцию (спереди/сзади/сбоку).
            const carrier = enemyFlag.carrier;
            const myEnemies = this._nearestEnemy();
            if (myEnemies && Math.hypot(myEnemies.x - carrier.x, myEnemies.y - carrier.y) < 550) {
              return myEnemies; // Перехватываем угрозу рядом с носителем
            }
            // Вычисляем направление движения к своей базе
            const homeBaseX = ownFlag ? ownFlag.baseX : (p.team === 'blue' ? 220 : scene.mapWidth - 220);
            const toHomeDir = homeBaseX > carrier.x ? 1 : -1;
            // У каждого бота индивидуальный оффсет строя по хэшу имени
            let botHash = 0;
            for (const ch of String(p.playerName || '')) botHash += ch.charCodeAt(0);
            const slot = (botHash % 3); // 0: авангард (впереди), 1: арьергард (позади), 2: фланг
            let escortX = carrier.x;
            if (slot === 0) escortX += toHomeDir * 140; // бежит впереди, расчищая путь
            else if (slot === 1) escortX -= toHomeDir * 120; // прикрывает тыл
            else escortX += (botHash % 2 === 0 ? 80 : -80);
            return { x: escortX, y: carrier.y };
          }
        }
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
