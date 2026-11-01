'use strict';
const State = require('./state.cjs');
const WebSocket = require('ws');

// Фаза 3б: бой считается фрагами в любом режиме (объективы — фаза 3в).
// Лимиты как в одиночке (дефолты LobbyScene): TDM 30, FFA 30, CTF 3,
// BOMB 3, KOTH 200. DUEL — только сеть, 10.
const SCORE_LIMIT = { TDM: 30, FFA: 30, CTF: 3, BOMB: 3, KOTH: 200, DUEL: 10 };

const CLASS_HP = { Assault: 100, Tank: 150, Medic: 90, Sniper: 80 };

// Зеркало js/entities: броня гасит 60% урона, пока цела (см. receiveDamage).
const CLASS_ARMOR = { Assault: 40, Tank: 100, Medic: 30, Sniper: 20 };

// Внешность из hello: только короткие строки из гардероба + цвет кожи.
function sanitizeGear(g) {
  try {
    if (!g || typeof g !== 'object') return null;
    const str = (v) => (typeof v === 'string' && v.length <= 40) ? v : null;
    const body = (Number.isFinite(+g.body) && +g.body >= 0 && +g.body <= 0xffffff) ? Math.floor(+g.body) : null;
    const out = { cap: str(g.cap), shoe: str(g.shoe), torso: str(g.torso), pants: str(g.pants), body };
    if (!out.cap && !out.shoe && !out.torso && !out.pants && out.body == null) return null;
    return out;
  } catch (e) {
    return null;
  }
}

// Капы maxHp/maxArmor из hello/cls (свой билд): коридоры против читов.
function noteMaxes(ws, m) {
  try {
    if (!ws || !m || typeof m !== 'object') return;
    if (m.maxHp != null && m.maxHp !== '') {
      const v = Math.round(+m.maxHp);
      if (Number.isFinite(v) && v > 0) ws._helloMaxHp = Math.max(50, Math.min(250, v));
    }
    if (m.maxArmor != null && m.maxArmor !== '') {
      const v = Math.round(+m.maxArmor);
      if (Number.isFinite(v) && v >= 0) ws._helloMaxArmor = Math.max(0, Math.min(150, v));
    }
  } catch (e) {}
}

// Капы maxHp/maxArmor бойца: из его же снапов (свой билд), иначе база класса.
// Боты снапов не шлют — всегда база.
function maxHpOf(room, id, cls) {
  try {
    const m = (room._maxHp || {})[id];
    if (m != null && m !== '' && Number.isFinite(+m) && +m > 0) {
      return Math.max(50, Math.min(250, +m));
    }
  } catch (e) {}
  return CLASS_HP[cls] || 100;
}

function maxArmorOf(room, id, cls) {
  try {
    const m = (room._maxArmor || {})[id];
    if (m != null && m !== '' && Number.isFinite(+m) && +m >= 0) {
      return Math.max(0, Math.min(150, +m));
    }
  } catch (e) {}
  return CLASS_ARMOR[cls] != null ? CLASS_ARMOR[cls] : 50;
}

// Метка спавна (щит 1с) + льгота телепорта 1.5с после возрождения.
function markSpawned(room, id) {
  try {
    room._spawnAt = room._spawnAt || {};
    room._spawnAt[id] = Date.now();
  } catch (e) {}
}

const MAX_ROOMS = 20;

// Имя комнаты из сети: 1-24 символа, буквы/цифры/пробел/_/- (рус. тоже).
function sanitizeRoomName(v) {
  try {
    let s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!s) return '';
    s = s.replace(/[^A-Za-zА-Яа-яЁё0-9 _\-]/g, '').trim().slice(0, 24);
    return s || '';
  } catch (e) { return ''; }
}

function makeRoom(name) {
  return { name, mode: 'TDM', maxPlayers: 8, timeLimit: 5, difficulty: 'experienced', botsOn: true, started: false, members: new Set(), hostId: null, bots: [], _byName: {}, _emptyTimer: null };
}

function mainRoom() {
  if (!State.rooms.has('main')) {
    State.rooms.set('main', makeRoom('main'));
  }
  return State.rooms.get('main');
}

function getRoom(name) {
  try {
    const n = sanitizeRoomName(name) || 'main';
    return State.rooms.get(n) || null;
  } catch (e) { return null; }
}

// Создать комнату (или вернуть существующую). Лимит — против спама.
function ensureRoom(name, opts) {
  const n = sanitizeRoomName(name) || 'main';
  let r = State.rooms.get(n);
  if (r) return r;
  if (State.rooms.size >= MAX_ROOMS) return null;
  r = makeRoom(n);
  try {
    if (opts && typeof opts === 'object') {
      const MODES = ['TDM', 'FFA', 'CTF', 'BOMB', 'KOTH', 'DUEL'];
      const md = String(opts.mode || '').toUpperCase();
      if (md && MODES.includes(md)) r.mode = md;
      const mp = Math.max(2, Math.min(8, parseInt(opts.maxPlayers, 10) || 8));
      if (Number.isFinite(mp)) r.maxPlayers = r.mode === 'DUEL' ? 2 : mp;
    }
  } catch (e) {}
  State.rooms.set(n, r);
  return r;
}

// Плоский список комнат для лобби-выбора (HTTP /rooms + WS list).
function listRooms() {
  const out = [];
  try {
    for (const [name, r] of State.rooms) {
      if (!r || r.lobby) continue;
      let host = null;
      try {
        for (const c of r.members) {
          if (c._id === r.hostId && c._name) { host = c._name; break; }
        }
      } catch (e) {}
      out.push({
        name, mode: r.mode || 'TDM',
        count: playersIn(name).length,
        max: r.maxPlayers | 0 || 8,
        started: !!r.started,
        host
      });
    }
  } catch (e) {}
  out.sort((a, b) => {
    if (a.name === 'main') return -1;
    if (b.name === 'main') return 1;
    return String(a.name).localeCompare(String(b.name), 'ru');
  });
  return out;
}

function roomOf(ws) {
  try {
    const n = ws && ws._room ? String(ws._room) : 'main';
    if (State.rooms.has(n)) return n;
  } catch (e) {}
  return 'main';
}

function playersIn(roomName) {
  const out = [];
  const room = State.rooms.get(roomName || 'main');
  if (!room) return out;
  for (const c of room.members) {
    if (c.readyState === WebSocket.OPEN && c._name) {
      out.push({ id: c._id, name: c._name, host: c._id === room.hostId, ready: !!c._ready, cls: c._cls || null, team: c._team || null, wantTeam: c._wantTeam || null, gear: c._gear || null });
    }
  }
  // Боты — часть состава активного матча (видны в ростере и счёте).
  if (room.match && Array.isArray(room.bots)) {
    for (const b of room.bots) {
      out.push({ id: b.id, name: b.name, host: false, ready: true, cls: b.cls, team: b.team, bot: true, gear: b.gear || null });
    }
  }
  return out;
}

// Боец по id: живой участник или бот (имя/команда/класс для счёта и урона).
function fighterInfo(room, id) {
  const nid = Number(id);
  for (const c of room.members) {
    if (c._id === nid) return { name: c._name || '?', team: c._team || 'blue', cls: c._cls || 'Assault', bot: false };
  }
  if (Array.isArray(room.bots)) {
    const b = room.bots.find(x => x.id === nid);
    if (b) return { name: b.name, team: b.team, cls: b.cls, bot: true };
  }
  const saved = room._byName || {};
  for (const nm of Object.keys(saved)) {
    if (saved[nm] && saved[nm].id === nid) return { name: nm, team: saved[nm].team || 'blue', cls: saved[nm].cls || 'Assault', bot: false };
  }
  return null;
}

// Состояние комнаты всем: режим, места, идёт ли игра.
function broadcastRoom(roomName) {
  const key = roomName || 'main';
  const r = State.rooms.get(key) || mainRoom();
  const rn = (r && r.name) || key;
  const msg = JSON.stringify({
    t: 'roominfo', room: rn, mode: r.mode, maxPlayers: r.maxPlayers,
    timeLimit: r.timeLimit | 0, difficulty: r.difficulty || 'experienced',
    botsOn: r.botsOn !== false,
    count: playersIn(rn).length, started: !!r.started,
    host: (() => {
      for (const c of r.members) {
        if (c._id === r.hostId && c._name) return c._name;
      }
      return null;
    })()
  });
  for (const c of r.members) {
    if (c.readyState === WebSocket.OPEN && c._name) {
      try { c.send(msg); } catch (e) {}
    }
  }
}

function broadcastPlayers(roomName) {
  const key = roomName || 'main';
  const room = State.rooms.get(key);
  if (!room) return;
  const msg = JSON.stringify({ t: 'players', room: room.name || key, players: playersIn(room.name || key) });
  for (const c of room.members) {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(msg); } catch (e) {}
    }
  }
}

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
  }
}

// Баннер события всем в комнате (захваты, установки).
function broadcastBanner(roomName, text, color, opts) {
  const room = State.rooms.get(roomName);
  if (!room) return;
  const msg = { t: 'banner', room: roomName, text: String(text).slice(0, 80), color: color || '#ffffff' };
  // Звук события (sfx) + чья команда (team): клиент маппит на свой/чужой
  // сэмпл (флаги) или играет прямо. Старые клиенты поля игнорят.
  try {
    if (opts && typeof opts === 'object') {
      if (opts.sfx) msg.sfx = String(opts.sfx).slice(0, 24);
      if (opts.team === 'blue' || opts.team === 'red') msg.team = opts.team;
    }
  } catch (e) {}
  const s = JSON.stringify(msg);
  for (const c of room.members) {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(s); } catch (e) {}
    }
  }
}

function broadcastScore(roomName) {
  // Б4: только помечаем — реальная отправка во flushTick (≤100мс).
  // Давила спамом при сериях киллов/тиках удержания KOTH.
  try {
    const room = State.rooms.get(roomName);
    if (!room || !room.match) return;
    room._scoreDirty = true;
  } catch (e) {}
}

function sendScoreNow(roomName) {
  const room = State.rooms.get(roomName);
  if (!room || !room.match) return;
  const m = room.match;
  const limit = SCORE_LIMIT[room.mode] || 30;
  const plist = playersIn(roomName);
  const board = Object.keys(m.kills).map(id => {
    const nid = Number(id);
    const p = plist.find(x => x.id === nid) || fighterInfo(room, nid);
    return { id: nid, name: p ? p.name : '?', kills: m.kills[id] | 0, dm: (m.dealt || {})[id] | 0, d: (m.deaths || {})[id] | 0, fl: (m.flags || {})[id] | 0 };
  }).sort((a, b) => b.kills - a.kills);
  room._seq = room._seq || { score: 0, obj: 0 };
  room._seq.score = (room._seq.score | 0) + 1;
  const msg = JSON.stringify({ t: 'score', room: roomName, blue: m.scores.blue | 0, red: m.scores.red | 0, limit, board, timeLeft: m.endsAt ? Math.max(0, Math.ceil((m.endsAt - Date.now()) / 1000)) : -1, seq: room._seq.score });
  for (const c of room.members) {
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(msg); } catch (e) {}
    }
  }
}

// Конец матча: победитель, сброс комнаты в лобби-режим.
function endMatch(roomName, winner) {
  const room = State.rooms.get(roomName);
  if (!room || !room.match) return;
  const m = room.match;
  // Хост мог уйти посреди матча — корона живому, иначе стартовать некому.
  let hostAlive = false;
  for (const c of room.members) {
    if (c._id === room.hostId) hostAlive = true;
  }
  if (!hostAlive) {
    const next = room.members.values().next().value;
    room.hostId = next ? next._id : null;
    if (next) next._ready = false;
  }
  const limit = SCORE_LIMIT[room.mode] || 30;
  const plist = playersIn(roomName);
  const board = Object.keys(m.kills).map(id => {
    const nid = Number(id);
    const p = plist.find(x => x.id === nid) || fighterInfo(room, nid);
    return { id: nid, name: p ? p.name : '?', kills: m.kills[id] | 0, dm: (m.dealt || {})[id] | 0, d: (m.deaths || {})[id] | 0, fl: (m.flags || {})[id] | 0 };
  }).sort((a, b) => b.kills - a.kills);
  const msg = JSON.stringify({
    t: 'over', room: roomName, winner,
    blue: m.scores.blue | 0, red: m.scores.red | 0, limit, board
  });
  room.match = null;
  room.started = false;
  room.bots = [];
  room._byName = {};
  room._kits = {};
  room._taken = {};
  room._spawnAt = {};
  // Б4: тик по пустому матчу и так молчит (flushTick смотрит room.match),
  // буферы чистим чтобы не везти мусор в следующий матч.
  try {
    if (room._snapBuf) room._snapBuf.clear();
    room._scoreDirty = false;
    room._objDirty = false;
  } catch (e) {}
  for (const c of room.members) {
    c._ready = false;
    if (c.readyState === WebSocket.OPEN) {
      try { c.send(msg); } catch (e) {}
    }
  }
  broadcastPlayers(roomName);
  broadcastRoom();
  console.log(`[=] "${roomName}" конец: ${JSON.stringify(winner)}`);
}

mainRoom();

// Позиции живых бойцов комнаты ({id -> {x, y, team}}): люди + боты.
function livePositions(room) {
  const out = {};
  room._pos = room._pos || {};
  for (const c of room.members) {
    if (c.readyState !== WebSocket.OPEN) continue;
    const id = c._id;
    if (!room.match || !room.match.alive[id]) continue;
    const p = room._pos[id];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      const hy = (room._headY || {})[id];
      out[id] = {
        x: p.x, y: p.y, team: c._team || 'blue', crouch: !!((room._crouch || {})[id]),
        headY: (Number.isFinite(hy) ? hy : p.y - 20),
        vx: ((room._vx || {})[id] | 0) || 0
      };
    }
  }
  if (Array.isArray(room.bots)) {
    for (const b of room.bots) {
      if (!room.match || !room.match.alive[b.id]) continue;
      const p = room._pos[b.id];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        out[b.id] = { x: p.x, y: p.y, team: b.team, vx: ((room._vx || {})[b.id] | 0) || 0 };
      }
    }
  }
  return out;
}

// Тик объективов 4Гц: KOTH-точки, CTF-флаги, BOMB-установки.

module.exports = { CLASS_HP, CLASS_ARMOR, SCORE_LIMIT, MAX_ROOMS, mainRoom, getRoom, ensureRoom, listRooms, sanitizeRoomName, roomOf, playersIn, fighterInfo, noteMaxes, markSpawned, maxHpOf, maxArmorOf, broadcastRoom, broadcastPlayers, send, broadcastBanner, broadcastScore, sendScoreNow, endMatch, sanitizeGear, livePositions };;
