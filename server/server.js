// Фаза 2: комнаты (создать/список/войти/выйти/готов/старт).
// - HTTP: раздаёт игру (корень project/) гостям по локалке.
// - WebSocket /net: лобби + комнаты. Протокол — см. PROTOCOL.md.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || process.env.KONTAKT_PORT) || 8081;
const GAME_ROOT = path.resolve(__dirname, '..');
// Б0: единая арена сервера — данные из netArena.cjs (источник истины —
// js/net/arena.js, сверка: node server/check-arena.cjs).
const { NET_BUILD, NET_ARENA, NET_SOLIDS, netSpawn: netSpawnShared } = require('./netArena.cjs');
// Б1: справочник оружия — проверки существования/дистанции/темпа
// (источник истины — js/data/weapons.js, сверка: node server/check-weapons.cjs).
const { lookupWeapon, maxHitDist, maxHitsPerSec, magazineSizeOf, reloadTimeOf } = require('./weapons.cjs');
const State = require('./state.cjs');

const MODES = ['TDM', 'FFA', 'CTF', 'BOMB', 'KOTH', 'DUEL'];
const MAX_ROOMS = 20;


// Длительность матча, мин (0 = без лимита). Хост меняет в лобби.
const DEFAULT_TIME_MIN = 5;


// Боты баланса: имена и классы.
const BOT_NAMES = ['Шустрик', 'Гром', 'Тихоня', 'Вихрь', 'Рокот', 'Смерч', 'Буран', 'Тайфун'];
const BOT_CLASSES = ['Assault', 'Tank', 'Medic', 'Sniper'];
// Зеркало внешности из js/entities/Player.js: бот одинаков для всех зрителей.
const GEAR_CAPS = ['__geo_cap_Assault', '__geo_cap_Tank', '__geo_cap_Medic', '__geo_cap_Sniper',
  'военный_шлем', 'камуфляжный_шлем', 'бескозырка',
  'маска_ночная', 'фуражка_парадная', 'шляпа_закона'];
const GEAR_SHOES = ['__geo_shoe', 'полуберцы', 'ботинки_усиленные', 'берцы_камуфляж',
  'берцы_ночные', 'туфли_офицера', 'сапоги_шерифа'];
const GEAR_TORSOS = ['__geo_torso', 'торс_тельняшка', 'торс_разгрузка', 'торс_камуфляж',
  'торс_ночной', 'китель_офицера', 'куртка_шерифа'];
const GEAR_PANTS = [null, 'штаны_камуфляж', 'штаны_чёрные', 'штаны_белые',
  'штаны_ночные', 'галифе_офицера', 'джинсы_шерифа'];
function randomBotGear() {
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  return { cap: pick(GEAR_CAPS), shoe: pick(GEAR_SHOES), torso: pick(GEAR_TORSOS), pants: pick(GEAR_PANTS), body: 0xffe0c8 };
}
const MAX_BOTS = 4;


const REJOIN_WINDOW_MS = 60000;

// Зеркало js/net/arena.js: точки и базы — ЕДИНЫЙ источник netArena.cjs.
const NET_POINTS = NET_ARENA.points;
const NET_BASES = NET_ARENA.bases;


// Б4: центральный тик рассылок — снапы батчатся, score/obj идут dirty-флагом.
// Движение/урон/киты — как раньше, событиями без задержки.
const TICK_MS = 100;

// Зеркало js/net/arena.js (серверу нужны только спавны/размер) — ЕДИНЫЙ источник.
// При смене арены править js/net/arena.js + server/netArena.cjs и гнать check-arena.

// Зеркало платформ js/net/arena.js для проверки стен (пули/взрывы/боты) —
// ЕДИНЫЙ источник NET_SOLIDS из netArena.cjs (земля — верх грунта 850 во всю ширину).

const { MIME, serveStatic } = require('./static.cjs');
// OTA-обновления для Android-приложения (Capacitor-Updater): /ota/updates + /ota/bundle.zip.
const OTA = require('./ota.cjs');

const server = http.createServer((req, res) => {
  // /health читает и сама игра (экран «Создать сервер»): CORS открыт,
  // чтобы file:// и локальные копии могли найти сервер на этом ПК.
  if (req.url === '/health' || req.url === '/health/') {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ ok: true, players: playersIn('main').length }));
    return;
  }
  // Список комнат для экрана «ВЫБРАТЬ МАТЧ» (ВК/Яндекс/ОК опрашивают его
  // fetch-ем без сокета). CORS открыт — игра может лежать на другой площадке.
  if (req.url === '/rooms' || req.url.split('?')[0] === '/rooms') {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    try {
      res.end(JSON.stringify({ ok: true, rooms: listRooms() }));
    } catch (e) {
      res.end(JSON.stringify({ ok: false, rooms: [] }));
    }
    return;
  }
  // Манифест/бандл OTA — до статики (иначе уйдёт в 404 как файла нет).
  if (OTA.handleOta(req, res)) return;
  serveStatic(req, res);
});

const wss = new WebSocket.Server({ server, path: '/net' });
State.wss = wss;

// Одна комната на сервер (упрощение): все подключившиеся — в ней.
// { name:'main', mode, maxPlayers, started, members, hostId, match, ... }.
const { rooms } = State;
const { netSpawn, wallLos } = require('./geo.cjs');
const { SCORE_LIMIT, broadcastBanner, broadcastPlayers, broadcastRoom, broadcastScore, endMatch, fighterInfo, mainRoom, getRoom, ensureRoom, listRooms, sanitizeRoomName, markSpawned, maxArmorOf, maxHpOf, noteMaxes, playersIn, roomOf, sanitizeGear, send, sendScoreNow } = require('./rooms.cjs');
const { OBJ_TICK_MS, sendObjNow, tickObjectives } = require('./objectives.cjs');
const { BOT_DIFF, BOT_TICK_MS, tickBots } = require('./bots.cjs');
const { ARMOR_KIT, BOOM_MAX_DMG, BOOM_RADIUS, MEDKIT_HEAL, dealDamage } = require('./combat.cjs');
let nextId = 1;

// Серверный магазин: остатки ПО СТВОЛАМ + окно перезарядки.
// Легитимный клиент в перезарядке не стреляет — дропы его не задевают.
// Инит — из hello/snap weapon (+magazine не выше штатного, иначе фул).
const { srvMagSize, srvReloadMs, srvMags, srvEnsureMag, srvRefillDone, srvInitMagFromMsg } = require('./mag.cjs');
const Lobby = require('./lobby.cjs');
const CombatRelay = require('./combatRelay.cjs');

wss.on('connection', (ws) => {
  ws._id = nextId++;
  ws._alive = true;
  ws.on('pong', () => { ws._alive = true; });

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch (e) {
      send(ws, { t: 'error', msg: 'bad json' });
      return;
    }
    if (!m || typeof m.t !== 'string') {
      send(ws, { t: 'error', msg: 'bad message' });
      return;
    }
    // Любое сообщение — признак живого сокета (клиент шлёт ping каждые 15с).
    // Нужно дублю ников ниже: молчуна >60с считаем протухшим.
    try { ws._alive = true; ws._lastMsg = Date.now(); } catch (e) {}

    // Список комнат без входа (экран «ВЫБРАТЬ МАТЧ» опрашивает до hello).
    // Dispatch (extracted): lobby.cjs + combatRelay.cjs
    if (Lobby.handleLobby(ws, m)) return;
    CombatRelay.handleCombat(ws, m);
  });

  ws.on('close', () => {
    const rkey = (ws._room && rooms.has(ws._room)) ? ws._room : 'main';
    const room = rooms.get(rkey);
    if (room) {
      const wasHost = room.hostId === ws._id;
      room.members.delete(ws);
      if (room.started && room.match) {
        // Матч идёт — состояние храним для переподключения по имени.
        // Ушедший тихо выбывает (без очков убийце): труп не висит мишенью,
        // вернувшийся мгновенно возрождается (см. hello-rejoin).
        try {
          if (room.match.alive[ws._id]) {
            room.match.alive[ws._id] = false;
            const gone = JSON.stringify({ t: 'dead', room: room.name || rkey, id: ws._id, by: -1 });
            for (const c of room.members) {
              if (c.readyState === WebSocket.OPEN) {
                try { c.send(gone); } catch (e) {}
              }
            }
          }
        } catch (e) {}
        // Хост в матче: корона живому оставшемуся, иначе некому стартовать дальше.
        if (wasHost) {
          const next = room.members.values().next().value;
          room.hostId = next ? next._id : room.hostId;
        }
        if (room.members.size === 0) {
          // Все люди ушли — окно 60с на возврат, потом сброс.
          if (!room._emptyTimer) {
            room._emptyTimer = setTimeout(() => {
              try {
                const r2 = rooms.get(rkey);
                if (!r2 || r2.members.size !== 0) return;
                // Пустую кастомную комнату удаляем, main — сбрасываем.
                if (rkey !== 'main') {
                  try { rooms.delete(rkey); } catch (e) {}
                  return;
                }
                r2.mode = 'TDM';
                r2.maxPlayers = 8; r2.timeLimit = 5; r2.difficulty = 'experienced';
                r2.botsOn = true;
                r2.started = false;
                r2.match = null;
                r2.bots = [];
                r2._byName = {};
                r2._kits = {};
                r2._pos = {};
                r2.hostId = null;
                r2._emptyTimer = null;
                broadcastRoom(rkey);
              } catch (e) {}
            }, REJOIN_WINDOW_MS);
            if (room._emptyTimer.unref) room._emptyTimer.unref();
          }
        } else {
          broadcastPlayers(rkey);
        }
      } else {
        if (wasHost) {
          const next = room.members.values().next().value;
          room.hostId = next ? next._id : null;
          if (next) next._ready = false;
        }
        if (room.members.size === 0) {
          // Все ушли — кастомную удаляем, main сбрасываем для следующих.
          if (rkey !== 'main') {
            try {
              if (room._emptyTimer) clearTimeout(room._emptyTimer);
            } catch (e) {}
            try { rooms.delete(rkey); } catch (e) {}
          } else {
            room.mode = 'TDM';
        room.maxPlayers = 8; room.timeLimit = 5; room.difficulty = 'experienced';
        room.botsOn = true;
            room.started = false;
            room.match = null;
            room.bots = [];
            room._byName = {};
            room._kits = {};
            room._pos = {};
            room.hostId = null;
          }
        } else {
          broadcastPlayers(rkey);
        }
      }
      try { broadcastRoom(rkey); } catch (e) {}
    }
    if (ws._name) console.log(`[-] #${ws._id} "${ws._name}"`);
  });
});

// Чистка мёртвых соединений.
const hb = setInterval(() => {  wss.clients.forEach((ws) => {
    if (!ws._alive) {
      try { ws.terminate(); } catch (e) {}
      return;
    }
    ws._alive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 30000);
hb.unref();

// Тик объективов 4Гц (KOTH/CTF/BOMB в стартовавших комнатах)
// + дедлайн матча во всех режимах.
const objTick = setInterval(() => {
  tickObjectives();
  tickMatchTimeout();
}, OBJ_TICK_MS);
objTick.unref();

// Время матча вышло: победа по счёту, равенство — ничья.
function tickMatchTimeout() {
  try {
    const now = Date.now();
    for (const [roomName, room] of rooms) {
      if (room.lobby || !room.started || !room.match) continue;
      const mt = room.match;
      if (!mt.endsAt || now < mt.endsAt) continue;
      let winner = 'draw';
      if (room.mode === 'FFA') {
        let best = -1, bestId = null, tied = false;
        for (const id of Object.keys(mt.kills)) {
          const k = mt.kills[id] | 0;
          if (k > best) { best = k; bestId = Number(id); tied = false; }
          else if (k === best) { tied = true; }
        }
        winner = tied ? 'draw' : bestId;
      } else {
        const b = mt.scores.blue | 0, r = mt.scores.red | 0;
        winner = b === r ? 'draw' : (b > r ? 'blue' : 'red');
      }
      // Ничья на сирене — не конец, а овертайм (как sudden в одиночке,
      // только проще): первое очко/фраг решает. Флаг — чтобы не спамить.
      if (winner === 'draw' && !mt.ot) {
        mt.ot = true;
        try { broadcastBanner(roomName, 'ОВЕРТАЙМ! ПЕРВОЕ ОЧКО РЕШАЕТ!', '#ffd24a', { sfx: 'sudden' }); } catch (e) {}
        broadcastScore(roomName);
        continue;
      }
      // Овертайм идёт, счёт равный — ждём (конец придёт с первым очком).
      if (winner === 'draw') continue;
      try { broadcastBanner(roomName, 'ВРЕМЯ ВЫШЛО!', '#ffd24a'); } catch (e) {}
      endMatch(roomName, winner);
    }
  } catch (e) {}
}

// Тик ботов ~8Гц: движение + снапы + тычки.
const botTick = setInterval(() => {
  tickBots();
}, BOT_TICK_MS);
botTick.unref();

// Б4: центральный тик рассылок 10Гц — флеш буфера снапов + dirty score/obj.
// Матч кончился (over) — room.match пуст, тик молчит, пауза тиков бесплатная.
const flushTick = setInterval(() => {
  try {
    for (const [roomName, room] of rooms) {
      if (!room || room.lobby || !room.started || !room.match) continue;
      try {
        const buf = room._snapBuf;
        if (buf && buf.size) {
          room._snapBuf = new Map();
          for (const [, rec] of buf) {
            if (!rec || !rec.msg) continue;
            let s = null;
            try { s = JSON.stringify(rec.msg); } catch (e) { continue; }
            for (const c of room.members) {
              if (c === rec.from) continue;
              if (c.readyState === WebSocket.OPEN) {
                try { c.send(s); } catch (e) {}
              }
            }
          }
        }
      } catch (e) {}
      try {
        if (room._scoreDirty) {
          room._scoreDirty = false;
          sendScoreNow(roomName);
        }
      } catch (e) {}
      try {
        if (room._objDirty) {
          room._objDirty = false;
          sendObjNow(roomName);
        }
      } catch (e) {}
    }
  } catch (e) {}
}, TICK_MS);
flushTick.unref();

// Занят порт — частый случай: сервер уже запущен в другом окне.
// Проверяем вежливо: если там наш сервер — просто выходим без страшилки,
// игра и start-host.cmd подхватят уже запущенный.
let _portHandled = false;
function handleListenError(err) {
  if (!err || err.code !== 'EADDRINUSE') throw err;
  // Ошибка всплывает и на http, и на ws — обрабатываем один раз.
  if (_portHandled) return;
  _portHandled = true;
  try {
    const probe = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 1500 }, (r) => {
      let body = '';
      r.on('data', (d) => { body += d; });
      r.on('end', () => {
        if (body.includes('"ok":true')) {
          console.log(`Server already running on :${PORT} (another window?) — using it, this copy exits.`);
          process.exit(0);
        } else {
          console.error(`Port ${PORT} busy by another program. Close it or run with KONTAKT_PORT=8082.`);
          process.exit(2);
        }
      });
    });
    probe.on('timeout', () => {
      try { probe.destroy(); } catch (e) {}
      console.error(`Port ${PORT} busy — old server window still open? Close it, then start again.`);
      process.exit(2);
    });
    probe.on('error', () => {
      console.error(`Port ${PORT} busy — old server window still open? Close it, then start again.`);
      process.exit(2);
    });
  } catch (e) {
    console.error(`Port ${PORT} busy — old server window still open? Close it, then start again.`);
    process.exit(2);
  }
}

server.on('error', handleListenError);
// Ошибка listen всплывает и на WebSocket-сервере — без этого unhandled 'error'.
try { wss.on('error', handleListenError); } catch (e) {}

server.listen(PORT, () => {
  console.log(`KONTAKT LAN server on :${PORT} (game + /net)`);
  try {
    const os = require('os');
    const ips = [];
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const n of nets || []) {
        if (n && n.family === 'IPv4' && !n.internal) ips.push(n.address);
      }
    }
    if (ips.length) console.log('Guests open: ' + ips.map(ip => `http://${ip}:${PORT}`).join('  '));
    else console.log('Guests open: http://<HOST-IP>:' + PORT);
  } catch (e) {
    console.log('Guests open: http://<HOST-IP>:' + PORT);
  }
});
