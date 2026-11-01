'use strict';
const WebSocket = require('ws');
const State = require('./state.cjs');
const Rooms = require('./rooms.cjs');
const Objectives = require('./objectives.cjs');
const { NET_ARENA } = require('./netArena.cjs');
const { lookupWeapon, maxHitDist, maxHitsPerSec } = require('./weapons.cjs');

const MEDKIT_HEAL = 40;

// Бронекит как в одиночке (js/entities/Pickup.js PICKUP_CONFIG armor:30):
// +30 с капом по классу, а не полный бакет.
const ARMOR_KIT = 30;

const RESPAWN_MS = 5000;

const BOOM_RADIUS = 195;

const BOOM_MAX_DMG = 120;

// Точка возрождения: не та, где боец умер. Раньше спавн брали по кругу
// из фиксированного списка — убитый у своего спавна вставал ровно там же
// (и сразу получал тот же огонь). Теперь выбираем точку команды подальше
// от места смерти, а из подходящих — ближе к базе и дальше от врагов.
function pickRespawn(room, targetId, team) {
  const list = team === 'red' ? NET_ARENA.spawnsRed : NET_ARENA.spawnsBlue;
  const pos = room._pos || {};
  const death = pos[targetId] || null;
  const alive = (room.match && room.match.alive) || {};
  const enemies = [];
  try {
    for (const key of Object.keys(pos)) {
      if (String(key) === String(targetId)) continue;
      if (!alive[key]) continue;
      const p = pos[key];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const fi = Rooms.fighterInfo(room, key);
      if (!fi) continue;
      if (room.mode !== 'FFA' && (fi.team || 'blue') === (team || 'blue')) continue;
      enemies.push(p);
    }
  } catch (e) {}
  const distToDeath = (sp) => (death && Number.isFinite(death.x) && Number.isFinite(death.y))
    ? Math.hypot(sp.x - death.x, sp.y - death.y) : 0;
  const minD = room.mode === 'FFA' ? 300 : 160;
  let pool = list.filter(sp => distToDeath(sp) >= minD);
  if (!pool.length) pool = list;
  const baseCX = team === 'red' ? NET_ARENA.bases.red.x : NET_ARENA.bases.blue.x;
  let best = pool[0], bestScore = -Infinity;
  for (const sp of pool) {
    const d = distToDeath(sp);
    let clear = 1000;
    for (const e of enemies) {
      const ed = Math.hypot(sp.x - e.x, sp.y - e.y);
      if (ed < clear) clear = ed;
    }
    const score = (room.mode === 'FFA')
      ? d + Math.min(clear, 600) * 0.25
      : -Math.abs(sp.x - baseCX) + Math.min(clear, 400) * 0.05;
    if (score > bestScore) { bestScore = score; best = sp; }
  }
  return best;
}

// Единое нанесение урона (пули и взрывы): урон, смерть, дроп,
// счёт, победа, респаун. Вызывать только после своих проверок.
function dealDamage(room, roomName, targetId, dmg, fromId, info) {
  const mt = room.match;
  if (!mt || !mt.alive[targetId] || !(mt.hp[targetId] > 0)) return;
  // Щит спавна 1с как в одиночке (Player revive/_applySpawnProt):
  // свежак неуязвим, camp на точке возрождения не работает.
  try {
    const sat = (room._spawnAt || {})[targetId] || 0;
    if (Date.now() - sat < 1000) return;
  } catch (e) {}
  dmg = Math.max(1, Math.min(150, Math.floor(+dmg || 0)));
  if (!Number.isFinite(dmg)) return;
  // Зоны как в одиночке (js/entities/Player.js receiveDamage):
  // голова x2, ноги x0.7, тело x1. Взрывы/боты/нож шлют тело.
  const zone = (info && (info.zone === 'head' || info.zone === 'legs')) ? info.zone : 'body';
  if (zone === 'head') {
    dmg = dmg * 2;
    // Хедшот-множитель владельца (гены/скиллы) — только в голову,
    // как useHs в одиночке. Коридор 1..2.
    let hm = (info && Number.isFinite(+info.mult)) ? +info.mult : 1;
    if (!Number.isFinite(hm)) hm = 1;
    dmg = Math.max(1, Math.floor(dmg * Math.max(1, Math.min(2, hm))));
  } else if (zone === 'legs') {
    dmg = Math.max(1, Math.floor(dmg * 0.7));
  }
  dmg = Math.max(1, Math.min(300, Math.floor(dmg)));
  if (!Number.isFinite(dmg)) return;
  const weapon = (info && info.weapon) ? String(info.weapon).slice(0, 24) : '';
  // Френдлифаер (командные режимы): по своим урон вдвое меньше.
  // В FFA своих нет — все враги. Суицид — отдельно ниже.
  const suicide = fromId === targetId;
  let friendly = false;
  let kteam = 'blue';
  if (!suicide && room.mode !== 'FFA') {
    try {
      const kfi = Rooms.fighterInfo(room, fromId);
      const tfi = Rooms.fighterInfo(room, targetId);
      if (kfi) kteam = kfi.team || 'blue';
      friendly = !!(kfi && tfi && (kfi.team || 'blue') === (tfi.team || 'blue'));
    } catch (e) { friendly = false; }
  } else if (!suicide) {
    try {
      const kfi = Rooms.fighterInfo(room, fromId);
      if (kfi) kteam = kfi.team || 'blue';
    } catch (e) {}
  }
  if (friendly) dmg = Math.max(1, Math.floor(dmg / 2));
  // Урон в зачёт (как damageDealt в одиночке: до брони; суицид и добивающий
  // по своим не пишем — за тимкилл ниже отдельный штраф).
  mt.dealt = mt.dealt || {};
  if (!suicide && !friendly) mt.dealt[fromId] = (mt.dealt[fromId] | 0) + dmg;
  // Броня как в одиночке: гасит 60% урона, пока цела.
  mt.armor = mt.armor || {};
  const curArmor = Math.max(0, mt.armor[targetId] | 0);
  const absorbed = Math.min(curArmor, Math.round(dmg * 0.6));
  mt.armor[targetId] = curArmor - absorbed;
  // Стойкость жертвы (её ульта/гены — damageTakenMult): жертва заявляет
  // сама в снапах (коридор 0.2..1), чужой подделать не может.
  let taken = 1;
  try {
    const tm = (room._taken || {})[targetId];
    taken = (tm == null) ? 1 : Math.max(0.2, Math.min(1, +tm || 1));
    if (!Number.isFinite(taken)) taken = 1;
  } catch (e) { taken = 1; }
  mt.hp[targetId] = Math.max(0, (mt.hp[targetId] | 0) - Math.max(0, Math.round((dmg - absorbed) * taken)));
  const out = JSON.stringify({ t: 'damage', room: roomName, target: targetId, hp: mt.hp[targetId], armor: mt.armor[targetId], from: fromId, zone, w: weapon });
  for (const c of room.members) {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(out); } catch (e) {}
    }
  }
  if (mt.hp[targetId] <= 0 && mt.alive[targetId]) {
    mt.alive[targetId] = false;
    // Убитый роняет флаг/бомбу на месте смерти.
    try {
      const bp = (room._pos || {})[targetId];
      const dropAt = (it) => {
        it.state = 'dropped';
        it.carrier = null;
        it.droppedAt = Date.now();
        if (bp && Number.isFinite(bp.x)) {
          it.x = Math.round(bp.x);
          it.y = Math.round(bp.y);
        }
        if (it.plant != null) it.plant = 0;
    if (it.defuse != null) it.defuse = 0;
      };
      if (room.match.obj && room.match.obj.flags) {
        for (const t of ['blue', 'red']) {
          const fl = room.match.obj.flags[t];
          if (fl && fl.state === 'carried' && fl.carrier === targetId) {
            dropAt(fl);
            // Потеря видна всем (как в одиночке).
            try {
              const fi = Rooms.fighterInfo(room, targetId);
              const nm = (fi && fi.name) || 'Боец';
              Rooms.broadcastBanner(roomName, `${nm} ПОТЕРЯЛ ${t === 'blue' ? 'СИНИЙ' : 'КРАСНЫЙ'} ФЛАГ!`, '#dddddd');
            } catch (e) {}
          }
        }
      }
      if (room.match.obj && room.match.obj.bombs) {
        for (const t of ['blue', 'red']) {
          const bb = room.match.obj.bombs[t];
          if (bb && bb.state === 'carried' && bb.carrier === targetId) dropAt(bb);
        }
      }
      Objectives.broadcastObj(roomName);
    } catch (e) {}
    mt.kills[fromId] = mt.kills[fromId] || 0;
    mt.dealt[fromId] = mt.dealt[fromId] || 0;
    // Смерть жертвы — в счётчик (любая: фраг/суицид/тимкилл/взрыв),
    // как deaths в одиночке для TAB.
    try { mt.deaths[targetId] = (mt.deaths[targetId] | 0) + 1; } catch (e) {}
    // Командный счёт — только там, где фраги = очки (TDM/KOTH/DUEL).
    // В CTF/BOMB очки дают только доставка/установка (как в одиночке:
    // там киллы в счёт этих режимов — 0). FFA — личный счёт киллами.
    const fragScores = room.mode === 'TDM' || room.mode === 'KOTH' || room.mode === 'DUEL';
    if (suicide) {
      // Суицид нейтрален: без очков, зачёта и штрафов.
    } else if (friendly) {
      // Тимкилл: минус кил и минус урон добивания; минус очко команде —
      // только где фраги в счёт (иначе счёт уехал бы в минус ни за что).
      mt.kills[fromId] = (mt.kills[fromId] | 0) - 1;
      if (fragScores) mt.scores[kteam] = (mt.scores[kteam] | 0) - 1;
      mt.dealt[fromId] = Math.max(0, (mt.dealt[fromId] | 0) - dmg);
    } else {
      mt.kills[fromId] = (mt.kills[fromId] | 0) + 1;
      if (fragScores) {
        mt.scores[kteam] = (mt.scores[kteam] | 0) + 1;
      }
    }
    const dead = JSON.stringify({ t: 'dead', room: roomName, id: targetId, by: fromId, zone, w: weapon });
    for (const c of room.members) {
      if (c.readyState === WebSocket.OPEN) {
        try { c.send(dead); } catch (e) {}
      }
    }
    Rooms.broadcastScore(roomName);
    // Победа?
    const limit = Rooms.SCORE_LIMIT[room.mode] || 30;
    if (room.mode === 'FFA') {
      // В овертайме первый фраг решает (суицид — нет).
      if ((mt.kills[fromId] | 0) >= limit || (mt.ot && !suicide)) {
        Rooms.endMatch(roomName, fromId);
        return;
      }
    } else if (mt.scores.blue >= limit || mt.scores.red >= limit) {
      Rooms.endMatch(roomName, mt.scores.blue >= limit ? 'blue' : 'red');
      return;
    } else if (mt.ot && mt.scores.blue !== mt.scores.red) {
      // Овертайм: первое очко решает.
      Rooms.endMatch(roomName, mt.scores.blue > mt.scores.red ? 'blue' : 'red');
      return;
    }
    // Возрождение через 5с (если матч и игрок ещё тут; боты — всегда тут).
    setTimeout(() => {
      try {
        const r2 = State.rooms.get(roomName);
        if (!r2 || !r2.started || !r2.match) return;
        if (r2.match.alive[targetId]) return;
        let member = null;
        for (const c of r2.members) {
          if (c._id === targetId) member = c;
        }
        let cls = 'Assault', team = 'blue';
        if (member) {
          cls = member._cls || 'Assault';
          team = member._team || 'blue';
        } else if (Array.isArray(r2.bots)) {
          const b = r2.bots.find(x => x.id === targetId);
          if (!b) return;
          cls = b.cls;
          team = b.team;
        } else {
          return;
        }
        r2.match.alive[targetId] = true;
        r2.match.hp[targetId] = Rooms.maxHpOf(r2, targetId, cls);
        r2.match.armor = r2.match.armor || {};
        r2.match.armor[targetId] = Rooms.maxArmorOf(r2, targetId, cls);
        Rooms.markSpawned(r2, targetId);
        // Спавн — подальше от точки смерти (см. pickRespawn), не по кругу.
        const sp = pickRespawn(r2, targetId, team);
        // Позицию сервера обновляем сразу и людям, и ботам: иначе до первого
        // снапа в room._pos живёт место смерти (объективы/боты/переподключение
        // целились туда).
        r2._pos = r2._pos || {};
        r2._pos[targetId] = { x: sp.x, y: sp.y };
        // Льгота телепорта: клиент body.reset на спавн — не считать читом.
        try {
          for (const c of r2.members) {
            if (c._id === targetId) {
              c._teleFree = Date.now() + 1500;
              c._lastPosOk = { x: sp.x, y: sp.y, t: Date.now() };
              break;
            }
          }
        } catch (e) {}
        const msg = JSON.stringify({ t: 'spawn', room: roomName, id: targetId, x: sp.x, y: sp.y, hp: r2.match.hp[targetId], armor: r2.match.armor[targetId] });
        for (const c of r2.members) {
          if (c.readyState === WebSocket.OPEN) {
            try { c.send(msg); } catch (e) {}
          }
        }
      } catch (e) {}
    }, RESPAWN_MS);
  }
}

module.exports = { MEDKIT_HEAL, ARMOR_KIT, BOOM_RADIUS, BOOM_MAX_DMG, RESPAWN_MS, dealDamage, pickRespawn };
