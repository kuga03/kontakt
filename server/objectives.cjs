'use strict';
const WebSocket = require('ws');
const State = require('./state.cjs');
const Rooms = require('./rooms.cjs');
const Geo = require('./geo.cjs');
const { NET_ARENA } = require('./netArena.cjs');

const KOTH_NEED = 4000;

const OBJ_TICK_MS = 250;

// Очко за объектив + проверка победы + рассылка счёта.
function objectiveScore(roomName, team) {
  const room = State.rooms.get(roomName);
  if (!room || !room.match) return;
  room.match.scores[team] = (room.match.scores[team] | 0) + 1;
  Rooms.broadcastScore(roomName);
  const limit = SCORE_LIMIT[room.mode] || 30;
  if (room.match.scores.blue >= limit || room.match.scores.red >= limit) {
    Rooms.endMatch(roomName, room.match.scores.blue >= limit ? 'blue' : 'red');
  } else if (room.match.ot && room.match.scores.blue !== room.match.scores.red) {
    // Овертайм: первое очко решает.
    Rooms.endMatch(roomName, room.match.scores.blue > room.match.scores.red ? 'blue' : 'red');
  }
}

function tickObjectives() {
  try {
    for (const [roomName, room] of State.rooms) {
      if (room.lobby || !room.started || !room.match || !room.match.obj) continue;
      const dt = OBJ_TICK_MS / 1000;
      if (room.mode === 'KOTH') tickKoth(roomName, room, dt);
      else if (room.mode === 'CTF') tickCtf(roomName, room);
      else if (room.mode === 'BOMB') tickBomb(roomName, room, dt);
    }
  } catch (e) {}
}

function tickKoth(roomName, room, dt) {
  const fighters = Rooms.livePositions(room);
  for (const pt of room.match.obj.points) {
    let blue = 0, red = 0;
    for (const id of Object.keys(fighters)) {
      const f = fighters[id];
      // Присутствие — ступнями (см. Geo.feetY): иначе высокие тела не достают.
      if (Math.abs(f.x - pt.x) > 130 || Math.abs(Geo.feetY(f) - pt.y) > 90) continue;
      if (f.team === 'blue') blue++;
      else red++;
    }
    const contested = blue > 0 && red > 0;
    const only = !contested ? (blue > 0 ? 'blue' : red > 0 ? 'red' : null) : null;
    if (contested && blue !== red) {
      const side = blue > red ? 1 : -1;
      const n = blue > red ? blue : red;
      pt.prog += side * dt * 1000 * 0.5 * Math.min(2, 1 + 0.5 * (n - 1));
    } else if (!contested && only) {
      const n = only === 'blue' ? blue : red;
      pt.prog += (only === 'blue' ? 1 : -1) * dt * 1000 * Math.min(2, 1 + 0.5 * (n - 1));
    } else if (!contested && !only) {
      if (pt.prog > 0) pt.prog = Math.max(0, pt.prog - dt * 500);
      else if (pt.prog < 0) pt.prog = Math.min(0, pt.prog + dt * 500);
    }
    if (pt.holder === 'blue') pt.prog = Math.min(pt.prog, 0);
    else if (pt.holder === 'red') pt.prog = Math.max(pt.prog, 0);
    if (pt.prog >= KOTH_NEED && pt.holder !== 'blue') {
      pt.holder = 'blue';
      pt.prog = 0;
      pt.tick = 0;
      Rooms.broadcastBanner(roomName, `СОЮЗНИКИ ЗАХВАТИЛИ ТОЧКУ ${pt.name}!`, '#7db8ff', { sfx: 'point', team: 'blue' });
      broadcastObj(roomName);
    } else if (pt.prog <= -KOTH_NEED && pt.holder !== 'red') {
      pt.holder = 'red';
      pt.prog = 0;
      pt.tick = 0;
      Rooms.broadcastBanner(roomName, `ВРАГИ ЗАХВАТИЛИ ТОЧКУ ${pt.name}!`, '#ff6666', { sfx: 'point', team: 'red' });
      broadcastObj(roomName);
    }
    // Очки удержания: +1/с за точку, центр — двойные.
    if (pt.holder) {
      pt.tick += dt;
      if (pt.tick >= 1) {
        pt.tick = 0;
        const add = pt.name === 'Б' ? 2 : 1;
        room.match.scores[pt.holder] = (room.match.scores[pt.holder] | 0) + add;
        Rooms.broadcastScore(roomName);
        const limit = SCORE_LIMIT[room.mode] || 150;
        if (room.match.scores.blue >= limit || room.match.scores.red >= limit) {
          Rooms.endMatch(roomName, room.match.scores.blue >= limit ? 'blue' : 'red');
          return;
        } else if (room.match.ot && room.match.scores.blue !== room.match.scores.red) {
          // Овертайм: первое очко решает.
          Rooms.endMatch(roomName, room.match.scores.blue > room.match.scores.red ? 'blue' : 'red');
          return;
        }
      }
    }
  }
  // Прогресс точек — всем каждый тик (4Гц): иначе клиенты видят только
  // факт захвата, а полоса стоит на нуле весь захват.
  broadcastObj(roomName);
}

function tickCtf(roomName, room) {
  const fighters = Rooms.livePositions(room);
  const byId = {};
  for (const id of Object.keys(fighters)) byId[id] = fighters[id];
  const flags = room.match.obj.flags;
  let changed = false;
  const homePos = (team) => (team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red);
  // Автовозврат как в одиночке (22с): лежащий флаг сам едет домой.
  try {
    const nowAuto = Date.now();
    for (const team of ['blue', 'red']) {
      const fl = flags[team];
      if (fl && fl.state === 'dropped' && fl.droppedAt && nowAuto - fl.droppedAt > 22000) {
        fl.state = 'home';
        fl.carrier = null;
        fl.droppedAt = null;
        fl.x = homePos(team).x;
        fl.y = homePos(team).y;
        changed = true;
        Rooms.broadcastBanner(roomName, team === 'blue' ? 'СИНИЙ ФЛАГ ВЕРНУЛСЯ НА БАЗУ!' : 'КРАСНЫЙ ФЛАГ ВЕРНУЛСЯ НА БАЗУ!', '#dddddd');
      }
    }
  } catch (e) {}
  for (const team of ['blue', 'red']) {
    const fl = flags[team];
    // Позиция флага = носильщик или точка дропа/дома.
    if (fl.state === 'carried') {
      const c = byId[fl.carrier];
      if (!c) {
        fl.state = 'dropped';
        fl.droppedAt = Date.now();
        changed = true;
      } else {
        fl.x = c.x;
        fl.y = c.y;
        changed = true;
        // Доставка: носильщик (враг флага) дошёл до СВОЕЙ базы = очко.
        const carrierBase = c.team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red;
        if (Geo.near(c.x, Geo.feetY(c), carrierBase.x, carrierBase.y, 80, 90)) {
          fl.state = 'home';
          fl.carrier = null;
          fl.x = homePos(team).x;
          fl.y = homePos(team).y;
          Rooms.broadcastBanner(roomName, c.team === 'blue' ? 'СИНИЕ ДОСТАВИЛИ ФЛАГ!' : 'КРАСНЫЕ ДОСТАВИЛИ ФЛАГ!', c.team === 'blue' ? '#7db8ff' : '#ff6666', { sfx: 'flag', team: c.team });
          // Доставка поименно — для колонки ФЛ в TAB как в одиночке.
          try { room.match.flags[fl.carrier] = (room.match.flags[fl.carrier] | 0) + 1; } catch (e) {}
          objectiveScore(roomName, c.team);
          if (!State.rooms.get(roomName) || !State.rooms.get(roomName).match) return;
        }
      }
    }
    if (fl.state !== 'carried') {
      // Флаг берёт боец НЕ его команды (враг флага). Дистанция — ступнями.
      for (const id of Object.keys(fighters)) {
        const f = fighters[id];
        if (f.team === team) continue;
        if (Geo.near(f.x, Geo.feetY(f), fl.x, fl.y, 45, 70)) {
          fl.state = 'carried';
          fl.carrier = Number(id);
          fl.droppedAt = null;
          changed = true;
          // Подбор виден всем (как в одиночке: баннер + звук флага).
          try {
            const fi = Rooms.fighterInfo(room, Number(id));
            const nm = (fi && fi.name) || 'Боец';
            const ct = (fi && fi.team) || 'blue';
            Rooms.broadcastBanner(roomName, `${nm} ВЗЯЛ ${team === 'blue' ? 'СИНИЙ' : 'КРАСНЫЙ'} ФЛАГ!`,
              ct === 'blue' ? '#7db8ff' : '#ff6666', { sfx: 'flag', team: ct });
          } catch (e) {}
          break;
        }
      }
      // Возврат своего упавшего флага касанием.
      if (fl.state === 'dropped') {
        for (const id of Object.keys(fighters)) {
          const f = fighters[id];
          if (f.team !== team) continue;
          if (Geo.near(f.x, Geo.feetY(f), fl.x, fl.y, 45, 70)) {
            fl.state = 'home';
            fl.carrier = null;
            fl.x = homePos(team).x;
            fl.y = homePos(team).y;
            changed = true;
            Rooms.broadcastBanner(roomName, team === 'blue' ? 'СИНИЙ ФЛАГ ВОЗВРАЩЁН!' : 'КРАСНЫЙ ФЛАГ ВОЗВРАЩЁН!', '#dddddd');
            break;
          }
        }
      }
    }
  }
  if (changed) broadcastObj(roomName);
}

function tickBomb(roomName, room, dt) {
  const fighters = Rooms.livePositions(room);
  const bombs = room.match.obj.bombs;
  let changed = false;
  // Автовозврат как в одиночке (15с): лежащая бомба едет домой.
  try {
    const nowAuto = Date.now();
    for (const team of ['blue', 'red']) {
      const b = bombs[team];
      const home = team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red;
      if (b && b.state === 'dropped' && b.droppedAt && nowAuto - b.droppedAt > 15000) {
        b.state = 'home';
        b.carrier = null;
        b.droppedAt = null;
        b.plant = 0;
        b.x = home.x;
        b.y = home.y;
        changed = true;
        Rooms.broadcastBanner(roomName, team === 'blue' ? 'СИНИЙ ЗАРЯД ВЕРНУЛСЯ НА БАЗУ!' : 'КРАСНЫЙ ЗАРЯД ВЕРНУЛСЯ НА БАЗУ!', '#dddddd');
      }
    }
  } catch (e) {}
  for (const team of ['blue', 'red']) {
    const foe = team === 'blue' ? 'red' : 'blue';
    const b = bombs[team];
    if (b.state === 'carried') {
      const c = fighters[b.carrier];
      if (!c) {
        b.state = 'dropped';
        b.droppedAt = Date.now();
        changed = true;
      } else {
        b.x = c.x;
        b.y = c.y;
        // Зона установки — база врага. Держим 5с без врага рядом.
        // Дистанции — ступнями (см. Geo.feetY).
        const zone = team === 'blue' ? NET_ARENA.bases.red : NET_ARENA.bases.blue;
        const planted = Geo.near(c.x, Geo.feetY(c), zone.x, zone.y, 90, 100);
        let foeNear = false;
        for (const id of Object.keys(fighters)) {
          const f = fighters[id];
          if (f.team !== foe) continue;
          if (Geo.near(f.x, Geo.feetY(f), zone.x, zone.y, 110, 120)) {
            foeNear = true;
            break;
          }
        }
        if (planted && !foeNear) {
          b.plant += dt;
          changed = true;
          if (b.plant >= 5) {
            b.state = 'home';
            b.carrier = null;
            b.plant = 0;
            b.defuse = 0;
            b.x = (team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red).x;
            b.y = (team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red).y;
            Rooms.broadcastBanner(roomName, c.team === 'blue' ? 'СИНИЕ УСТАНОВИЛИ ЗАРЯД!' : 'КРАСНЫЕ УСТАНОВИЛИ ЗАРЯД!', c.team === 'blue' ? '#7db8ff' : '#ff6666', { sfx: 'flag', team: c.team });
            objectiveScore(roomName, c.team);
            if (!State.rooms.get(roomName) || !State.rooms.get(roomName).match) return;
          }
        } else if (!planted) {
          if (b.plant !== 0) {
            b.plant = 0;
            changed = true;
          }
        }
        // Несёмую не разминировать (как в одиночке: defuse только лежащей).
      }
    }
    if (b.state !== 'carried') {
      // Свою бомбу несёт только своя команда (враг мешает убийством
      // и блокирует установку присутствием в зоне). Дистанция — ступнями.
      for (const id of Object.keys(fighters)) {
        const f = fighters[id];
        if (f.team !== team) continue;
        if (!Geo.near(f.x, Geo.feetY(f), b.x, b.y, 45, 70)) continue;
        b.state = 'carried';
        b.carrier = Number(id);
        b.droppedAt = null;
        b.plant = 0;
        b.defuse = 0;
        changed = true;
        break;
      }
      // Разминирование как в одиночке: ТОЛЬКО лежащая чужая бомба —
      // рядом стоит живой враг 5с (отошёл — сброс в ноль, не тает).
      // Несёмую не трогаем, домашнюю — нечего.
      if (b.state === 'dropped') {
        let foeNearB = false;
        for (const id of Object.keys(fighters)) {
          const f = fighters[id];
          if (f.team === team) continue;
          if (Math.abs(f.x - b.x) > 70 || Math.abs(Geo.feetY(f) - b.y) > 90) continue;
          foeNearB = true;
          break;
        }
        if (foeNearB) {
          b.defuse = (b.defuse || 0) + dt;
          changed = true;
          if (b.defuse >= 5) {
            b.state = 'home';
            b.carrier = null;
            b.plant = 0;
            b.defuse = 0;
            b.x = (team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red).x;
            b.y = (team === 'blue' ? NET_ARENA.bases.blue : NET_ARENA.bases.red).y;
            Rooms.broadcastBanner(roomName, team === 'blue' ? 'СИНЯЯ БОМБА ОБЕЗВРЕЖЕНА' : 'КРАСНАЯ БОМБА ОБЕЗВРЕЖЕНА', '#dddddd');
            changed = true;
          }
        } else if (b.defuse) {
          b.defuse = 0;
          changed = true;
        }
      } else if (b.defuse) {
        b.defuse = 0;
        changed = true;
      }
    }
  }
  if (changed) broadcastObj(roomName);
}

// Состояние объективов всем в комнате.
function broadcastObj(roomName) {
  // Б4: только помечаем — реальная отправка во flushTick (≤100мс).
  // Не чаще тика: KOTH-прогресс дёргал всех на каждом тике объективов.
  try {
    const room = State.rooms.get(roomName);
    if (!room || !room.match || !room.match.obj) return;
    room._objDirty = true;
  } catch (e) {}
}

function sendObjNow(roomName) {
  const room = State.rooms.get(roomName);
  if (!room || !room.match || !room.match.obj) return;
  try {
    room._seq = room._seq || { score: 0, obj: 0 };
    room._seq.obj++;
    // seq — для будущего отбрасывания протухшего на клиенте (v8);
    // текущий клиент поле игнорирует, контракт не ломаем.
    const msg = JSON.stringify({ t: 'obj', room: roomName, mode: room.mode, obj: room.match.obj, seq: room._seq.obj });
    for (const c of room.members) {
      if (c.readyState === WebSocket.OPEN) {
        try { c.send(msg); } catch (e) {}
      }
    }
  } catch (e) {}
}

module.exports = { KOTH_NEED, OBJ_TICK_MS, objectiveScore, tickObjectives, tickKoth, tickCtf, tickBomb, broadcastObj, sendObjNow };
