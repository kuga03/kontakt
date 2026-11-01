'use strict';
const WebSocket = require('ws');
const State = require('./state.cjs');
const Rooms = require('./rooms.cjs');
const Geo = require('./geo.cjs');
const Combat = require('./combat.cjs');
const { NET_ARENA } = require('./netArena.cjs');

// Сложность ботов — зеркало js/data/difficulty.js (выбирает хост в лобби,
// едет в setup, видно в roominfo). Влияет на меткость/урон/темп.
// hpBonus ветерана (+15% HP) в сети нет: ХП ботов — база класса.
const BOT_DIFF = {
  novice: { hit: 0.32, dmg: 0.85, move: 36, lead: 0.1, cad: 2.2 },
  experienced: { hit: 0.68, dmg: 1.05, move: 18, lead: 0.75, cad: 1.5 },
  veteran: { hit: 0.9, aim: 0.7, dmg: 1.2, move: 8, lead: 1, cad: 1.0 }
};

function botDiffOf(room) {
  try {
    const d = (room && BOT_DIFF[room.difficulty]) || null;
    if (d) return d;
  } catch (e) {}
  return BOT_DIFF.experienced;
}

// Разброс стволов ботов — зеркало weaponSpreadDeg из js/data/weapons.js
// (штатные стволы классов: bad_ak47 2.9, M249 3.4, UZI 3.2, Winchester 0.8).
// На ходу ×1.5, как Player.shoot (в полёте ×3 в сети нет — боты не прыгают).
const BOT_SPREAD = { Assault: 2.9, Tank: 3.4, Medic: 3.2, Sniper: 0.8 };

const BOT_TICK_MS = 120;

// Стволы ботов — точные статы штатных стволов классов из js/data/weapons.js:
// Assault bad_ak47 (17/650), Tank M249 (20/720), Medic UZI (12/500),
// Sniper Winchester (45/950). Урон и дальность — один в один; темп —
// замедленная очередь (иначе боты косят всех полным авто: 280/280/150мс).
// Темп — тиками BOT_TICK_MS (120мс): Assault ~1.4с, Tank ~1.6с,
// Medic ~1.2с, Sniper ~2.6с (у своей медленной винтовки 1500мс + пауза).
const BOT_GUN = {
  Assault: { dmg: 17, rate: 1.4, range: 650, name: 'BOT-Assault' },
  Tank: { dmg: 20, rate: 1.6, range: 720, name: 'BOT-Tank' },
  Medic: { dmg: 12, rate: 1.2, range: 500, name: 'BOT-Medic' },
  Sniper: { dmg: 45, rate: 2.6, range: 950, name: 'BOT-Sniper' }
};

// Цель бота по режиму ({x, y}): точки/флаги/бомбы/враги, а не конец карты.
// Носильщик бежит домой, остальные кроют или догоняют чужого носильщика.
function botTarget(room, b, cur, fighters) {
  const mode = room.mode;
  const obj = room.match.obj;
  const foe = b.team === 'blue' ? 'red' : 'blue';
  const unlikely = () => ({ x: cur.x, y: cur.y });
  try {
    if (mode === 'KOTH' && obj && obj.points) {
      let best = null, bd = 1e9;
      for (const pt of obj.points) {
        if (pt.holder === b.team) continue;
        const d = Math.abs(pt.x - cur.x);
        if (d < bd) { bd = d; best = pt; }
      }
      if (!best) {
        // Всё наше — держать ближайшую, а не уходить на край.
        for (const pt of obj.points) {
          const d = Math.abs(pt.x - cur.x);
          if (d < bd) { bd = d; best = pt; }
        }
      }
      if (best) return { x: best.x + (b.id % 60), y: best.y };
      return unlikely();
    }
    if (mode === 'CTF' && obj && obj.flags) {
      const mine = obj.flags[b.team], foeF = obj.flags[foe];
      const pos = (room._pos || {});
      // Несу чужой — домой на свою базу.
      for (const t of ['blue', 'red']) {
        const fl = obj.flags[t];
        if (fl && fl.state === 'carried' && fl.carrier === b.id) {
          const home = b.team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red;
          return { x: home.x, y: 818 };
        }
      }
      // Враг несёт наш — догонять носильщика.
      if (mine && mine.state === 'carried' && mine.carrier != null) {
        const cp = pos[mine.carrier];
        if (cp && Number.isFinite(cp.x)) return { x: cp.x, y: 818 };
      }
      // Наш упал — коснуться (возврат).
      if (mine && mine.state === 'dropped') return { x: mine.x, y: 818 };
      // Иначе — за чужим флагом.
      if (foeF) return { x: foeF.x, y: 818 };
      return unlikely();
    }
    if (mode === 'BOMB' && obj && obj.bombs) {
      const mine = obj.bombs[b.team], foeB = obj.bombs[foe];
      const pos = (room._pos || {});
      // Несу свою — на точку установки (база врага).
      if (mine && mine.state === 'carried' && mine.carrier === b.id) {
        const zone = b.team === 'blue' ? NET_ARENA.bases.red : NET_ARENA.bases.blue;
        return { x: zone.x, y: 818 };
      }
      // Враг несёт свою — догонять и мешать.
      if (foeB && foeB.state === 'carried' && foeB.carrier != null) {
        const cp = pos[foeB.carrier];
        if (cp && Number.isFinite(cp.x)) return { x: cp.x, y: 818 };
      }
      // Своя лежит/дома — подобрать.
      if (mine && mine.state !== 'carried') return { x: mine.x, y: 818 };
      // Свою несут — кроем носильщика.
      if (mine && mine.state === 'carried' && mine.carrier != null) {
        const cp = pos[mine.carrier];
        if (cp && Number.isFinite(cp.x)) return { x: cp.x, y: 818 };
      }
      return unlikely();
    }
    // TDM/FFA/DUEL: охота — к ближайшему врагу, вблизи встать и драться.
    let bx = null, bd = 1e9;
    for (const fid of Object.keys(fighters)) {
      if (Number(fid) === b.id) continue;
      const f = fighters[fid];
      if (mode !== 'FFA' && f.team === b.team) continue;
      if (Math.abs(f.y - cur.y) > 200) continue;
      const d = Math.hypot(f.x - cur.x, f.y - cur.y);
      if (d < bd) { bd = d; bx = f.x; }
    }
    if (bx == null) {
      const foeBase = b.team === 'blue' ? NET_ARENA.bases.red : NET_ARENA.bases.blue;
      return { x: foeBase.x + (b.id % 80), y: 818 };
    }
    // Ближе 400 — стоим и дерёмся (тычка ниже), дальше — подходим.
    if (bd < 400) return { x: cur.x, y: cur.y };
    return { x: bx, y: 818 };
  } catch (e) {
    return unlikely();
  }
}

// Боты: движение к цели + снапы + тычки по ближайшему врагу.
// Снапы ботов шлём всем как обычные snap (id отрицательный).
function tickBots() {
  try {
    for (const [roomName, room] of State.rooms) {
      if (!room.started || !room.match || !Array.isArray(room.bots) || !room.bots.length) continue;
      room._pos = room._pos || {};
      const fighters = Rooms.livePositions(room);
      for (const b of room.bots) {
        if (!room.match.alive[b.id]) continue;
        const cur = room._pos[b.id] || { x: b.x, y: b.y };
        const tgt = botTarget(room, b, cur, fighters);
        const tx = Math.max(40, Math.min(2360, tgt.x));
        // Цель по опоре (см. Geo.supportRest): на мост — только через мост,
        // иначе бот летит по воздуху, а клиенты видят его под платформой.
        const ty = Geo.supportRest(tx, tgt.y);
        const dx = tx - cur.x;
        const step = Math.max(-28, Math.min(28, dx * 0.12));
        // Джиттер — только на ходу: стоящего (±5px каждый тик) он гонял
        // случайным блужданием, и боты шатались на месте. Стоит — стоит.
        const jit = Math.abs(step) > 0.5 ? (Math.random() * 10 - 5) : 0;
        const nx = Math.max(40, Math.min(2360, cur.x + step + jit));
        // Вертикаль — доводкой к цели (мост Б и т.п.), не телепортом.
        const ny = Math.max(620, Math.min(825, cur.y + Math.max(-40, Math.min(40, (ty - cur.y) * 0.3))));
        room._pos[b.id] = { x: Math.round(nx), y: Math.round(ny) };
        b.x = Math.round(nx);
        b.y = Math.round(ny);
        // Скорость бота — для упреждения собратьев (lead) и разброса на ходу.
        try { room._vx = room._vx || {}; room._vx[b.id] = Math.round(step * 8); } catch (e) {}
        // Прицел — в сторону движения/врага: иначе бот всегда смотрит от базы.
        let aimX = b.x + (b.team === 'blue' ? 120 : -120), aimY = b.y - 20;
        try {
          let ex = null, ed = 700;
          for (const fid of Object.keys(fighters)) {
            if (Number(fid) === b.id) continue;
            const f = fighters[fid];
            if (room.mode !== 'FFA' && f.team === b.team) continue;
            const d = Math.hypot(f.x - b.x, f.y - b.y);
            if (d < ed) { ed = d; ex = f; }
          }
          if (ex) { aimX = ex.x; aimY = Number.isFinite(ex.headY) ? ex.headY : ex.y - 20; }
          else if (Math.abs(step) > 2) { aimX = b.x + (step > 0 ? 140 : -140); aimY = b.y - 20; }
        } catch (e) {}
        const s = {
          t: 'snap', id: b.id, x: b.x, y: b.y, vx: Math.round(step * 8), vy: Math.round((ny - cur.y) * 8),
          hp: room.match.hp[b.id] | 0, armor: (room.match.armor || {})[b.id] | 0, aimX: Math.round(aimX), aimY: Math.round(aimY),
          weapon: 'BOT-' + b.cls, crouch: false, cls: b.cls
        };
        // Б4: снапы ботов — в тот же буфер тика (всем, from null).
        try {
          room._snapBuf = room._snapBuf || new Map();
          room._snapBuf.set(b.id, { msg: s, from: null });
        } catch (e) {}
        // Огонь из классового ствола: ближайший враг в радиусе
        // и на прямой видимости (стены режут, как у людей).
        // Темп и урон — по классу (снайпер редко, но больно и далеко).
        b._atk = (b._atk | 0) + 1;
        const gun = BOT_GUN[b.cls] || BOT_GUN.Assault;
        const diff = botDiffOf(room);
        // Темп — от темпа ствола × cadMult сложности (как cadMult в одиночке).
        const every = Math.max(6, Math.round(gun.rate * (diff.cad || 1) / (BOT_TICK_MS / 1000)));
        if (b._atk % every === 0) {
          let bestId = null, bd2 = gun.range;
          const bp0 = (room._pos || {})[b.id] || { x: b.x, y: b.y };
          for (const fid of Object.keys(fighters)) {
            if (Number(fid) === b.id) continue;
            const f = fighters[fid];
            if (room.mode !== 'FFA' && f.team === b.team) continue;
            const d = Math.hypot(f.x - bp0.x, f.y - bp0.y);
            const fHead0 = Number.isFinite(f.headY) ? f.headY : (f.y - 28);
            if (d < bd2 && Geo.wallLos(bp0.x, bp0.y - 20, f.x, fHead0)) { bd2 = d; bestId = Number(fid); }
          }
          if (bestId != null && room.match.alive[bestId]) {
            const tgt = fighters[bestId] || {};
            const tHead = Number.isFinite(tgt.headY) ? tgt.headY : (tgt.y - 28);
            // Точка прицела — как aimPoint в одиночке: упреждение (lead) +
            // ошибка по сложности (aimChance/hitChance) + разброс на ходу.
            let hx = tgt.x, hy = tHead;
            try {
              const tvx = Number.isFinite(tgt.vx) ? tgt.vx : 0;
              const dd = Math.hypot(tgt.x - bp0.x, tgt.y - bp0.y);
              hx += tvx * (dd / 1700) * (diff.lead || 0);
            } catch (e) {}
            const high = !tgt.crouch && tgt.y < bp0.y - 50;
            const RR = (a, c) => a + Math.random() * (c - a);
            if (diff.aim && Math.random() < diff.aim) {
              hx += RR(-5, 5); hy += RR(-8, 8);
            } else if (Math.random() < (diff.hit != null ? diff.hit : 0.68)) {
              hx += RR(-14, 14); hy += high ? RR(-6, 8) : RR(-16, 10);
            } else {
              // Промах: увод в сторону (трассер честно пролетит мимо).
              const rr = [26, 42, 60][(Math.random() * 3) | 0];
              const aa = Math.random() * Math.PI * 2;
              hx += Math.cos(aa) * rr; hy += Math.sin(aa) * rr * 0.7;
            }
            try {
              const bvxm = ((room._vx || {})[b.id] | 0) || 0;
              if (Math.abs(bvxm) > 20) {
                const sp = diff.move || 18;
                const aa = Math.random() * Math.PI * 2;
                const rr = sp * (0.5 + Math.random() * 0.5);
                hx += Math.cos(aa) * rr; hy += Math.sin(aa) * rr * 0.6;
              }
            } catch (e) {}
            // Выстрел из дула (точка картинки) + разброс ствола 1:1
            // (на ходу ×1.5, как Player.shoot; полёта ×3 в сети нет).
            const mzx = bp0.x, mzy = bp0.y - 20;
            let ang = Math.atan2(hy - mzy, hx - mzx);
            try {
              const bvx2 = ((room._vx || {})[b.id] | 0) || 0;
              const spd = BOT_SPREAD[b.cls] != null ? BOT_SPREAD[b.cls] : 2.5;
              const jm = (Math.abs(bvx2) > 10 ? 1.5 : 1) * spd * Math.PI / 180;
              ang += (Math.random() * 2 - 1) * jm;
            } catch (e) {}
            // Попадание — геометрией как в одиночке: круг головы, потом тело.
            // Промах виден (трассер мимо), урона нет. Зона — по месту контакта.
            let zone = null;
            try {
              const ex = mzx + Math.cos(ang) * gun.range, ey = mzy + Math.sin(ang) * gun.range;
              if (Geo.segCircle(mzx, mzy, ex, ey, tgt.x, tHead, 11)) {
                zone = 'head';
              } else {
                const rTop = tHead, rBot = tgt.y + 40;
                if (rBot - rTop > 4) {
                  const rct = { x: tgt.x, y: (rTop + rBot) / 2, w: 44, h: rBot - rTop };
                  if (Geo.segRect(mzx, mzy, ex, ey, rct)) {
                    let ycross = (tHead + rBot) / 2;
                    try {
                      if (Math.abs(ex - mzx) > 1) ycross = mzy + (ey - mzy) * (tgt.x - mzx) / (ex - mzx);
                    } catch (e) {}
                    zone = (ycross > tHead + 45) ? 'legs' : 'body';
                  }
                }
              }
            } catch (e) { zone = null; }
            // Видимый выстрел бота (вспышка+трассер+звук у всех): урон ниже
            // считает Combat.dealDamage, это только картинка+звук.
            // Шлём и точку прицеливания (конец луча): клиент дорисует
            // трассер из СВОЕГО дула в неё — иначе угол из чужого дула
            // даёт параллельный сдвиг и линия летит мимо головы.
            try {
              const bp = (room._pos || {})[b.id] || { x: b.x, y: b.y };
              const ex = mzx + Math.cos(ang) * gun.range, ey = mzy + Math.sin(ang) * gun.range;
              const fs = JSON.stringify({
                t: 'fire', id: b.id, weapon: gun.name, n: 1,
                x: Math.round(bp.x), y: Math.round(bp.y - 20),
                angle: ang, tx: Math.round(ex), ty: Math.round(ey)
              });
              for (const c of room.members) {
                if (c.readyState === WebSocket.OPEN) {
                  try { c.send(fs); } catch (e) {}
                }
              }
            } catch (e) {}
            // Урон — только при геометрическом контакте, с множителем
            // сложности и зоной контакта (голова ×2 — как у всех).
            if (zone) {
              Combat.dealDamage(room, roomName, bestId, Math.max(1, Math.round(gun.dmg * (diff.dmg != null ? diff.dmg : 1))), b.id, { weapon: gun.name, zone });
            }
            if (!State.rooms.get(roomName) || !State.rooms.get(roomName).match) break;
          }
        }
      }
    }
  } catch (e) {}
}

module.exports = { BOT_DIFF, BOT_GUN, BOT_SPREAD, BOT_TICK_MS, botTarget, tickBots, botDiffOf };
