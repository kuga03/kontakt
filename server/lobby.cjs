'use strict';
// lobby.cjs вЂ” РІС…РѕРґ Рё СѓРїСЂР°РІР»РµРЅРёРµ РєРѕРјРЅР°С‚РѕР№ (Р±С‹Р»Рѕ РІ server.js).
// Р§РёСЃС‚С‹Р№ РґРёСЃРїРµС‚С‡РµСЂ: СЂРµС€Р°РµС‚ РїРѕ m.t, СЃРѕСЃС‚РѕСЏРЅРёРµ вЂ” С‡РµСЂРµР· State/rooms.cjs.
const { NET_BUILD, NET_ARENA, NET_SOLIDS, netSpawn: netSpawnShared } = require('./netArena.cjs');
const { lookupWeapon } = require('./weapons.cjs');
const State = require('./state.cjs');
const { rooms } = State;
const { netSpawn, wallLos } = require('./geo.cjs');
const { SCORE_LIMIT, broadcastBanner, broadcastPlayers, broadcastRoom, broadcastScore, endMatch, fighterInfo, mainRoom, getRoom, ensureRoom, listRooms, sanitizeRoomName, markSpawned, maxArmorOf, maxHpOf, noteMaxes, playersIn, roomOf, sanitizeGear, send, sendScoreNow } = require('./rooms.cjs');
const { BOT_DIFF, BOT_TICK_MS, tickBots } = require('./bots.cjs');
const { srvInitMagFromMsg } = require('./mag.cjs');
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

const LOBBY_TYPES = new Set(['list','hello','ping','setup','team','cls','kick','ready','start']);

function handleLobby(ws, m) {
  if (!m || !LOBBY_TYPES.has(m.t)) return false;
    if (m.t === 'list') {
      send(ws, { t: 'rooms', rooms: listRooms() });
      return;
    }

    if (m.t === 'hello') {
      const name = String(m.name || '').trim().slice(0, 16) || ('Игрок' + ws._id);
      // Класс бойца для марионеток (Assault/Tank/Medic/Sniper).
      const cls = String(m.cls || 'Assault');
      const cleanCls = ['Assault', 'Tank', 'Medic', 'Sniper'].includes(cls) ? cls : 'Assault';
      // Комната из списка: создал — заходишь хостом, нет — создаём.
      // Без поля room — старая LAN-логика (комната main).
      const wantName = sanitizeRoomName(m.room) || 'main';
      let room = getRoom(wantName);
      if (!room) {
        room = ensureRoom(wantName, { mode: m.mode, maxPlayers: m.maxPlayers });
        if (!room) {
          send(ws, { t: 'error', msg: 'Много комнат, зайди позже' });
          return;
        }
      }
      const rn = room.name || wantName;
      // Переподключение в идущий матч: то же имя — вернуть старый id и состояние.
      if (room.started && room.match) {
        const saved = (room._byName || {})[name];
        if (saved && room.match.hp[saved.id] != null) {
          ws._id = saved.id;
          ws._name = name;
          ws._cls = saved.cls || cleanCls;
          ws._team = saved.team || 'blue';
          ws._gear = sanitizeGear(m.gear);
      noteMaxes(ws, m);
      srvInitMagFromMsg(ws, m);
          try {
            room._maxHp = room._maxHp || {};
            room._maxArmor = room._maxArmor || {};
            if (ws._helloMaxHp) room._maxHp[ws._id] = ws._helloMaxHp;
            if (ws._helloMaxArmor != null) room._maxArmor[ws._id] = ws._helloMaxArmor;
          } catch (e) {}
          ws._ready = true;
          ws._room = rn;
          // Сначала гасим старый сокет с тем же id (угон слота закрыт),
          // потом добавляем новый — иначе окно двух тел с одним id.
          try {
            for (const c of [...room.members]) {
              if (c !== ws && c._id === ws._id) {
                try { c.send(JSON.stringify({ t: 'error', msg: 'Вошли с твоего ника' })); } catch (e) {}
                try { c.terminate(); } catch (e) {}
                room.members.delete(c);
              }
            }
          } catch (e) {}
          room.members.add(ws);
          if (room._emptyTimer) {
            try { clearTimeout(room._emptyTimer); } catch (e) {}
            room._emptyTimer = null;
          }
          send(ws, { t: 'welcome', id: ws._id, room: rn, host: room.hostId === ws._id, you: name, rejoined: true });
          // Старый сокет уже погашен выше (до add).
          const pls = playersIn(rn).map(p => {
            const pos = (room._pos || {})[p.id] || {};
            return { id: p.id, name: p.name, host: !!p.host, bot: !!p.bot, cls: p.cls, team: p.team, gear: p.gear || null, spawn: { x: pos.x || 0, y: pos.y || 800 } };
          });
          send(ws, { t: 'started', room: rn, mode: room.mode, maxPlayers: room.maxPlayers, timeLimit: room.timeLimit | 0, endsAt: (room.match && room.match.endsAt) || 0, you: ws._id, youTeam: ws._team || null, players: pls, rejoined: true });
          const sc = room.match;
          const limit = SCORE_LIMIT[room.mode] || 30;
          const plist = playersIn(rn);
          send(ws, {
            t: 'score', room: rn, blue: sc.scores.blue | 0, red: sc.scores.red | 0, limit,
            timeLeft: sc.endsAt ? Math.max(0, Math.ceil((sc.endsAt - Date.now()) / 1000)) : -1,
            board: Object.keys(sc.kills).map(id => {
              const nid = Number(id);
              const pp = plist.find(x => x.id === nid) || fighterInfo(room, nid);
              return { id: nid, name: pp ? pp.name : '?', kills: sc.kills[id] | 0, dm: (sc.dealt || {})[id] | 0, d: (sc.deaths || {})[id] | 0, fl: (sc.flags || {})[id] | 0 };
            })
          });
          if (sc.obj) send(ws, { t: 'obj', room: rn, mode: room.mode, obj: sc.obj });
          // Вернулся мёртвым/ушедшим — сразу в бой полным (ждать нечего:
          // тихий уход гасит бойца, см. on close). Точка — свежий спавн
          // команды, а не точка смерти.
          if (!room.match.alive[ws._id]) {
            try {
              const cls = ws._cls || 'Assault';
              room.match.alive[ws._id] = true;
              room.match.hp[ws._id] = maxHpOf(room, ws._id, cls);
              room.match.armor = room.match.armor || {};
              room.match.armor[ws._id] = maxArmorOf(room, ws._id, cls);
              markSpawned(room, ws._id);
              ws._teleFree = Date.now() + 1500;
              try {
                const sp0 = netSpawn(ws._team || 'blue', (room._spawnN = (room._spawnN | 0) + 1));
                room._pos = room._pos || {};
                room._pos[ws._id] = { x: sp0.x, y: sp0.y };
                ws._lastPosOk = { x: sp0.x, y: sp0.y, t: Date.now() };
              } catch (e) {}
            } catch (e) {}
          }
          if (room.match.alive[ws._id]) {
            // Переподключение живого — на актуальную серверную позицию.
            // Мёртвого — на свежий спавн команды, а не на точку смерти
            // (старый _pos вёл в pos.x||0 — респаун в углу/в стене).
            let sx = 0, sy = 800;
            try {
              const pp = (room._pos || {})[ws._id];
              if (pp && Number.isFinite(pp.x)) { sx = pp.x; sy = pp.y || 800; }
            } catch (e) {}
            send(ws, { t: 'spawn', room: rn, id: ws._id, x: sx, y: sy, hp: room.match.hp[ws._id], armor: (room.match.armor || {})[ws._id] });
          }
          broadcastPlayers(rn);
          broadcastRoom(rn);
          console.log(`[+] #${ws._id} "${name}" переподключился`);
          return;
        }
        // Поздний вход: первые 60с матча (кроме дуэли) и есть место —
        // друг успел к начавшейся катке, а не ждёт её конца.
        if (room.mode !== 'DUEL' && room.match.startedAt && Date.now() - room.match.startedAt < 60000) {
          if (playersIn(rn).length < room.maxPlayers) {
            ws._name = name;
            ws._cls = cleanCls;
            ws._gear = sanitizeGear(m.gear);
      noteMaxes(ws, m);
      srvInitMagFromMsg(ws, m);
            // Капы билда позднего — в матч сразу (maxHpOf читает room._maxHp,
            // а не ws._hello*: без копии поздний на базе класса).
            try {
              room._maxHp = room._maxHp || {};
              room._maxArmor = room._maxArmor || {};
              if (ws._helloMaxHp) room._maxHp[ws._id] = ws._helloMaxHp;
              if (ws._helloMaxArmor != null) room._maxArmor[ws._id] = ws._helloMaxArmor;
            } catch (e) {}
            ws._ready = true;
            ws._room = rn;
            const nBlue = playersIn(rn).filter(p => p.team === 'blue').length;
            const nRed = playersIn(rn).filter(p => p.team === 'red').length;
            const team = nBlue <= nRed ? 'blue' : 'red';
            ws._team = team;
            room.members.add(ws);
            if (room._emptyTimer) {
              try { clearTimeout(room._emptyTimer); } catch (e) {}
              room._emptyTimer = null;
            }
            const sp = netSpawn(team, (room._spawnN = (room._spawnN | 0) + 1));
            room._pos = room._pos || {};
            room._pos[ws._id] = { x: sp.x, y: sp.y };
            room.match.hp[ws._id] = maxHpOf(room, ws._id, cleanCls);
            room.match.armor = room.match.armor || {};
            room.match.armor[ws._id] = maxArmorOf(room, ws._id, cleanCls);
            room.match.alive[ws._id] = true;
            markSpawned(room, ws._id);
            ws._teleFree = Date.now() + 1500;
            room.match.kills[ws._id] = 0;
            room.match.deaths[ws._id] = 0;
            room.match.flags[ws._id] = 0;
            room._byName = room._byName || {};
            room._byName[name] = { id: ws._id, team, cls: cleanCls };
            send(ws, { t: 'welcome', id: ws._id, room: rn, host: room.hostId === ws._id, you: name });
            const pls = playersIn(rn).map(p => {
              const pos = (room._pos || {})[p.id] || {};
              return { id: p.id, name: p.name, host: !!p.host, bot: !!p.bot, cls: p.cls, team: p.team, gear: p.gear || null, spawn: { x: pos.x || 0, y: pos.y || 800 } };
            });
            send(ws, { t: 'started', room: rn, mode: room.mode, maxPlayers: room.maxPlayers, timeLimit: room.timeLimit | 0, endsAt: (room.match && room.match.endsAt) || 0, you: ws._id, youTeam: team, players: pls });
            const sc = room.match;
            const limit = SCORE_LIMIT[room.mode] || 30;
            send(ws, {
              t: 'score', room: rn, blue: sc.scores.blue | 0, red: sc.scores.red | 0, limit,
              timeLeft: sc.endsAt ? Math.max(0, Math.ceil((sc.endsAt - Date.now()) / 1000)) : -1,
              board: Object.keys(sc.kills).map(id => {
                const nid = Number(id);
                const pp = pls.find(x => x.id === nid) || fighterInfo(room, nid);
                return { id: nid, name: pp ? pp.name : '?', kills: sc.kills[id] | 0, dm: (sc.dealt || {})[id] | 0, d: (sc.deaths || {})[id] | 0, fl: (sc.flags || {})[id] | 0 };
              })
            });
          if (sc.obj) send(ws, { t: 'obj', room: rn, mode: room.mode, obj: sc.obj });
            send(ws, { t: 'spawn', room: rn, id: ws._id, x: sp.x, y: sp.y, hp: room.match.hp[ws._id], armor: room.match.armor[ws._id] });
            try { broadcastBanner(rn, `"${name}" в игре!`, '#aaffaa'); } catch (e) {}
            broadcastPlayers(rn);
            broadcastRoom(rn);
            broadcastScore(rn);
            console.log(`[+] #${ws._id} "${name}" вошёл в идущий матч (${team})`);
            return;
          }
        }
        send(ws, { t: 'error', msg: 'Игра уже идёт, подожди конца' });
        return;
      }
      ws._name = null;
      ws._cls = cleanCls;
      ws._gear = null;
      // Одинаковые ники в комнате запрещены: иначе счёт, киллфид и
      // переподключение по имени ломаются (два «Коляна» — один ключ).
      // Но протухший сокет (обновил страницу — старый висит) не должен
      // держать ник: закрытого или молчуна >60с гасим и входим,
      // живой чужой ник — отказ (клиент сам допишет -2).
      let staleDup = null;
      let liveDup = false;
      for (const c of room.members) {
        if (c !== ws && c._name === name) {
          let dead = false;
          try {
            dead = c.readyState !== WebSocket.OPEN ||
              (Date.now() - (c._lastMsg || 0) > 60000);
          } catch (e) { dead = true; }
          if (dead) { staleDup = c; break; }
          liveDup = true;
          break;
        }
      }
      if (staleDup) {
        try { room.members.delete(staleDup); } catch (e) {}
        try { staleDup.terminate(); } catch (e) {}
        try { console.log(`[~] протухший "${name}" вычищен для #${ws._id}`); } catch (e) {}
      }
      if (liveDup) {
        send(ws, { t: 'error', msg: 'Имя занято, выбери другое' });
        return;
      }
      if (playersIn(rn).length >= room.maxPlayers) {
        send(ws, { t: 'error', msg: 'Комната полная' });
        return;
      }
      // Проверки пройдены — только теперь присваиваем состояние.
      ws._name = name;
      ws._gear = sanitizeGear(m.gear);
      noteMaxes(ws, m);
      srvInitMagFromMsg(ws, m);
      ws._ready = false;
      ws._team = null;
      ws._wantTeam = null;
      if (room.members.size === 0 && rn === 'main') {
        // Комната пустая — сброс настроек и прошлого матча.
        room.mode = 'TDM';
        room.maxPlayers = 8; room.timeLimit = 5; room.difficulty = 'experienced';
        room.started = false;
        room.match = null;
        room.bots = [];
        room._byName = {};
        room._kits = {};
        room._pos = {};
        room.hostId = null;
        if (room._emptyTimer) {
          try { clearTimeout(room._emptyTimer); } catch (e) {}
          room._emptyTimer = null;
        }
      }
      room.members.add(ws);
      ws._room = rn;
      if (room.hostId == null) {
        room.hostId = ws._id;
        ws._ready = false;
      }
      send(ws, { t: 'welcome', id: ws._id, room: rn, host: room.hostId === ws._id, you: name });
      broadcastPlayers(rn);
      broadcastRoom(rn);
      console.log(`[+] #${ws._id} "${name}" -> ${rn}${room.hostId === ws._id ? ' (host)' : ''}`);
      return;
    }

    if (!ws._name) {
      send(ws, { t: 'error', msg: 'say hello first' });
      return;
    }

    if (m.t === 'ping') {
      send(ws, { t: 'pong', n: m.n || 0 });
      return;
    }

    // Настройки комнаты от хоста (режим + макс. игроков), пока не стартовали.
    // DUEL — строго 1 на 1: места всегда 2.
    if (m.t === 'setup') {
      const room = rooms.get(roomOf(ws)) || mainRoom();
      if (room.hostId !== ws._id) {
        send(ws, { t: 'error', msg: 'Настройки меняет хост' });
        return;
      }
      if (room.started) return;
      const mode = String(m.mode || '').toUpperCase();
      let maxPlayers = Math.max(2, Math.min(8, parseInt(m.maxPlayers, 10) || 8));
      if (mode && !MODES.includes(mode)) {
        send(ws, { t: 'error', msg: 'Такого режима нет: ' + mode });
        return;
      }
      if (mode) room.mode = mode;
      if (room.mode === 'DUEL') room.maxPlayers = 2;
      else room.maxPlayers = maxPlayers;
      // Длительность матча от хоста: 0 = без лимита, иначе 1..30 мин.
      if (m.timeLimit != null) {
        const tl = Math.floor(+m.timeLimit || 0);
        room.timeLimit = (tl > 0 && tl <= 30) ? tl : 0;
      }
      // Сложность ботов от хоста (лобби): новичок/бывалый/ветеран.
      if (m.difficulty != null) {
        const d = String(m.difficulty || '').toLowerCase();
        if (BOT_DIFF[d]) room.difficulty = d;
      }
      // Галочка ботов от хоста (видно всем в roominfo — гости рисуют превью).
      if (m.botsOn != null) room.botsOn = !!m.botsOn;
      // Лишних за лимитом не выгоняем (сами выйдут), новые не войдут.
      broadcastRoom(roomOf(ws));
      return;
    }

    // Выбор команды перед игрой (lobby only): blue/red/auto.
    if (m.t === 'team') {
      const room = rooms.get(roomOf(ws));
      if (!room || room.started) return;
      const want = String(m.team || 'auto').toLowerCase();
      ws._wantTeam = (want === 'blue' || want === 'red') ? want : null;
      broadcastPlayers(roomOf(ws));
      return;
    }

    // Смена класса в лобби: каждый выбирает, за кого играть.
    // Класс едет в ростер (видно всем) и в марионеток на старте.
    if (m.t === 'cls') {
      const room = rooms.get(roomOf(ws));
      if (!room || room.started) return;
      const clean = ['Assault', 'Tank', 'Medic', 'Sniper'].includes(m.cls) ? m.cls : null;
      if (!clean) {
        send(ws, { t: 'error', msg: 'Нет такого класса' });
        return;
      }
      ws._cls = clean;
      // Скин привязан к классу (гардероб свой) — клиент шлёт gear нового
      // класса вместе с cls, иначе останется внешность старого.
      // Присваиваем всегда (даже null): снял всё — другие видят голого,
      // а не прошлый скин (было if (g) — раздевание не долетало).
      ws._gear = sanitizeGear(m.gear);
      noteMaxes(ws, m);
      srvInitMagFromMsg(ws, m);
      broadcastPlayers(roomOf(ws));
      return;
    }

    // Кик из лобби: только хост, только до старта, себя — нельзя.
    // Жертве шлём kicked (причину видно до разрыва), дальше close —
    // общий on close сам уберёт из состава и разошлёт ростер.
    if (m.t === 'kick') {
      const room = rooms.get(roomOf(ws));
      if (!room || room.started) return;
      if (room.hostId !== ws._id) {
        send(ws, { t: 'error', msg: 'Выгоняет хост' });
        return;
      }
      const targetId = Number(m.id);
      if (!Number.isFinite(targetId) || targetId === ws._id) return;
      let victim = null;
      for (const c of room.members) {
        if (c._id === targetId) victim = c;
      }
      if (!victim) {
        send(ws, { t: 'error', msg: 'Уже ушёл' });
        return;
      }
      send(victim, { t: 'kicked', room: room.name || roomOf(ws) });
      try { victim.close(4000, 'kicked'); } catch (e) {}
      return;
    }

    if (m.t === 'ready') {
      const room = rooms.get(roomOf(ws));
      if (!room || room.lobby) {
        send(ws, { t: 'error', msg: 'Ты не в комнате' });
        return;
      }
      ws._ready = !!m.ready;
      broadcastPlayers(roomOf(ws));
      return;
    }

    if (m.t === 'start') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby) {
        send(ws, { t: 'error', msg: 'Ты не в комнате' });
        return;
      }
      if (room.hostId !== ws._id) {
        send(ws, { t: 'error', msg: 'Стартовать может хост' });
        return;
      }
      if (room.started) return;
      const humans = playersIn(roomName).filter(p => !p.bot);
      // Старт — только когда ВСЕ готовы (включая хоста): кнопка ГОТОВ
      // не для красоты. Кого ждём — называем, чтобы не гадать.
      const notReady = humans.filter(p => !p.ready).map(p => p.name);
      if (notReady.length) {
        send(ws, { t: 'error', msg: 'Ждём готовности: ' + notReady.slice(0, 4).join(', ') + (notReady.length > 4 ? '…' : '') });
        return;
      }
      // Дуэль — строго 1 на 1, без ботов.
      if (room.mode === 'DUEL') {
        if (humans.length !== 2) {
          send(ws, { t: 'error', msg: 'Дуэль — строго двое' });
          return;
        }
      }
      let wantBots = room.mode === 'DUEL' ? 0 : Math.max(0, Math.min(MAX_BOTS, parseInt(m.bots, 10) || 0));
      // Без поля bots старое поведение: минимум двое людей, ботов нет.
      if (!Number.isFinite(wantBots)) wantBots = 0;
      if (room.mode !== 'DUEL' && humans.length + wantBots < 2) {
        send(ws, { t: 'error', msg: 'Нужно хотя бы двое (или добавь ботов)' });
        return;
      }
      if (humans.length + wantBots > room.maxPlayers) {
        wantBots = Math.max(0, room.maxPlayers - humans.length);
      }
      room.started = true;
      room.bots = [];
      room._byName = {};
      // Команды: сначала желания (blue/red), потом авто.
      // DUEL: желания учитываем, конфликт — хост синий, второй красный.
      // Остальные: желание — если есть, авто — через одного для баланса.
      let bi = 0, ri = 0;
      const byId = {};
      for (const c of room.members) byId[c._id] = c;
      const pls = [];
      const takeTeam = (team) => {
        const sp = team === 'red' ? netSpawn('red', ri++) : netSpawn('blue', bi++);
        return { team, spawn: sp };
      };
      if (room.mode === 'DUEL') {
        const [a, b] = humans;
        const wa = (byId[a.id] && byId[a.id]._wantTeam) || null;
        const wb = (byId[b.id] && byId[b.id]._wantTeam) || null;
        let ta = wa, tb = wb;
        if (ta && tb && ta === tb) {
          // Конфликт желаний — классика: хост синий.
          ta = a.host ? 'blue' : 'red';
          tb = ta === 'blue' ? 'red' : 'blue';
          if (!a.host) { ta = 'red'; tb = 'blue'; }
        } else if (ta && !tb) {
          tb = ta === 'blue' ? 'red' : 'blue';
        } else if (!ta && tb) {
          ta = tb === 'blue' ? 'red' : 'blue';
        } else if (!ta && !tb) {
          ta = a.host ? 'blue' : 'red';
          tb = ta === 'blue' ? 'red' : 'blue';
          if (!a.host) { ta = 'red'; tb = 'blue'; }
        }
        for (const [p, t] of [[a, ta], [b, tb]]) {
          const c = byId[p.id];
          if (c) c._team = t;
          const s = takeTeam(t);
          room._byName[p.name] = { id: p.id, team: t, cls: p.cls || 'Assault' };
          pls.push({ id: p.id, name: p.name, host: !!p.host, cls: p.cls || 'Assault', team: t, spawn: s.spawn, gear: (c && c._gear) || null });
        }
      } else {
        for (const p of humans) {
          const c = byId[p.id];
          const want = (c && c._wantTeam) || null;
          let team;
          if (want === 'blue' || want === 'red') {
            team = want;
          } else {
            // Авто — в меньшую команду (баланс по факту, а не через одного:
            // хост через одного всегда уходил в синие).
            try {
              const nb = pls.filter(q => q.team === 'blue').length;
              const nr = pls.filter(q => q.team === 'red').length;
              team = nb <= nr ? 'blue' : 'red';
            } catch (e) {
              team = ((bi + ri) % 2 === 0) ? 'blue' : 'red';
            }
          }
          if (c) c._team = team;
          const s = takeTeam(team);
          room._byName[p.name] = { id: p.id, team, cls: p.cls || 'Assault' };
          pls.push({ id: p.id, name: p.name, host: !!p.host, cls: p.cls || 'Assault', team, spawn: s.spawn, gear: (c && c._gear) || null });
        }
      }
      // Боты добивают состав и балансят команды (отрицательные id).
      const usedNames = new Set(pls.map(p => p.name));
      let botSeq = 0;
      for (let i = 0; i < wantBots; i++) {
        const nm = BOT_NAMES.find(n => !usedNames.has(n)) || ('Бот' + (i + 1));
        usedNames.add(nm);
        const clsB = BOT_CLASSES[(botSeq + i) % BOT_CLASSES.length];
        const nBlue = pls.filter(p => p.team === 'blue').length;
        const nRed = pls.filter(p => p.team === 'red').length;
        const team = nBlue <= nRed ? 'blue' : 'red';
        const sp = team === 'red' ? netSpawn('red', ri++) : netSpawn('blue', bi++);
        const id = -1 - i;
        room.bots.push({ id, name: nm, cls: clsB, team, x: sp.x, y: sp.y, gear: randomBotGear(), _atk: 0 });
        pls.push({ id, name: nm, host: false, bot: true, cls: clsB, team, spawn: sp, gear: room.bots[room.bots.length - 1].gear });
      }
      // Состояние матча: ХП/броня по классу, счёт, фраги, дедлайн.
      const tlMin = room.timeLimit | 0;
      room.match = {
        scores: { blue: 0, red: 0 },
        kills: {},
        dealt: {},
        // Смерти и доставки флага — для TAB как в одиночке (колонки С/ФЛ).
        deaths: {},
        flags: {},
        hp: {},
        armor: {},
        alive: {},
        obj: null,
        startedAt: Date.now(),
        endsAt: tlMin > 0 ? Date.now() + tlMin * 60000 : 0
      };
      // Капы билдов из hello/cls — в матч (снапы потом обновят сами).
      // Первыми: maxHpOf ниже читает именно их.
      try {
        room._maxHp = room._maxHp || {};
        room._maxArmor = room._maxArmor || {};
        for (const c of room.members) {
          if (c._helloMaxHp) room._maxHp[c._id] = c._helloMaxHp;
          if (c._helloMaxArmor != null) room._maxArmor[c._id] = c._helloMaxArmor;
        }
      } catch (e) {}
      for (const p of pls) {
        room.match.hp[p.id] = maxHpOf(room, p.id, p.cls);
        room.match.armor[p.id] = maxArmorOf(room, p.id, p.cls);
        room.match.alive[p.id] = true;
        room.match.kills[p.id] = 0;
        room.match.deaths[p.id] = 0;
        room.match.flags[p.id] = 0;
        markSpawned(room, p.id);
      }
      room._kits = {};
      room._pos = {};
      // Б4: буферы тика — чистые на каждый матч (иначе протухшие снапы/счёт
      // прошлого матча уедут новичкам первым флешем).
      room._snapBuf = new Map();
      room._scoreDirty = false;
      room._objDirty = false;
      room._seq = { score: 0, obj: 0 };
      for (const p of pls) {
        if (p.spawn) room._pos[p.id] = { x: p.spawn.x, y: p.spawn.y };
      }
      // Льгота телепорта на старте: все body.reset на спавны.
      try {
        const freeUntil = Date.now() + 1500;
        for (const c of room.members) c._teleFree = freeUntil;
      } catch (e) {}
      // Объективы по режиму (фаза 3в): всё на присутствии, как в одиночке.
      if (room.mode === 'KOTH') {
        room.match.obj = {
          points: NET_POINTS.map(pt => ({ name: pt.name, x: pt.x, y: pt.y, holder: null, prog: 0, tick: 0 }))
        };
      } else if (room.mode === 'CTF') {
        room.match.obj = {
          flags: {
            blue: { state: 'home', x: NET_BASES.blue.x, y: NET_BASES.blue.y, carrier: null },
            red: { state: 'home', x: NET_BASES.red.x, y: NET_BASES.red.y, carrier: null }
          }
        };
      } else if (room.mode === 'BOMB') {
        room.match.obj = {
          bombs: {
        blue: { state: 'home', x: NET_BASES.blue.x, y: NET_BASES.blue.y, carrier: null, plant: 0, defuse: 0 },
        red: { state: 'home', x: NET_BASES.red.x, y: NET_BASES.red.y, carrier: null, plant: 0, defuse: 0 }
          }
        };
      }
      const baseStarted = {
        t: 'started', room: roomName, mode: room.mode,
        maxPlayers: room.maxPlayers,
        timeLimit: room.timeLimit | 0,
        endsAt: (room.match && room.match.endsAt) || 0,
        players: pls,
        // Объективы сразу (флаги/бомбы/точки): иначе клиенты не видят их,
        // пока тик не дёрнет changed (домашние стоят тихо весь матч).
        obj: (room.match && room.match.obj) || null
      };
      // Персонально каждому: его команда (диагностика рассинхронов TAB/счёта).
      for (const c of room.members) {
        if (c.readyState === WebSocket.OPEN) {
          try { c.send(JSON.stringify(Object.assign({}, baseStarted, { you: c._id, youTeam: c._team || null }))); } catch (e) {}
        }
      }
      broadcastRoom();
      broadcastScore(roomName);
      console.log(`[!] "${roomName}" старт [${room.mode}] (${pls.length} игр.)`);
      return;
    }

    // Попадание (фаза 3б + Б1): проверка-лайт + урон + смерти + счёт.
    // Доверяем LAN, но режем очевидный бред: чужой урон, темп, дистанция.
    // Б1: ствол обязан существовать в справочнике (алиасы латиницы ок),
    // дистанция — по дальности ствола (min 1300), темп — по скорострельности.
    // Урон пока клиентский 1..150 (серверный — в Б2 с обновлением теста).
  return true;
}

module.exports = { LOBBY_TYPES, handleLobby };

