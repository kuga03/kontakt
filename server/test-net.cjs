// Тест упрощённого сервера: одна комната (hello, setup, ready, start,
// snap relay, бой, зоны, киты, гранаты по ботам, френдлифаер, объективы).
// Запуск: сервер поднят, `node FILE [port]`.
'use strict';

const WebSocket = require('ws');

const PORT = Number(process.argv[2]) || 8081;
const URL = `ws://127.0.0.1:${PORT}/net`;

function track(ws) {
  ws._buf = [];
  ws.on('message', (raw) => {
    try { ws._buf.push(JSON.parse(String(raw))); } catch (e) {}
  });
}

function once(ws, type, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!ws._buf) ws._buf = [];
    const take = () => {
      const i = ws._buf.findIndex(m => m && m.t === type);
      if (i < 0) return null;
      return ws._buf.splice(i, 1)[0];
    };
    const got = take();
    if (got) {
      resolve(got);
      return;
    }
    const t = setTimeout(() => {
      ws.removeListener('message', onMsg);
      reject(new Error('timeout waiting ' + type));
    }, timeoutMs);
    function onMsg() {
      const m2 = take();
      if (m2) {
        clearTimeout(t);
        ws.removeListener('message', onMsg);
        resolve(m2);
      }
    }
    ws.on('message', onMsg);
  });
}

async function connect(name, cls) {
  // Один хендлер на welcome/error (без Promise.race из двух once):
  // проигравший once воровал бы чужие error из буфера своим take().
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    track(ws);
    const to = setTimeout(() => {
      cleanup();
      reject(new Error('hello timeout ' + name));
    }, 8000);
    function onMsg(raw) {
      let m;
      try { m = JSON.parse(String(raw)); } catch (e) { return; }
      if (m && m.t === 'welcome') {
        cleanup();
        clearTimeout(to);
        resolve({ ws, welcome: m });
      } else if (m && m.t === 'error') {
        cleanup();
        clearTimeout(to);
        const err = new Error('hello rejected');
        err.denied = m;
        reject(err);
      }
    }
    function onErr(e) {
      cleanup();
      clearTimeout(to);
      reject(e);
    }
    function cleanup() {
      try { ws.removeListener('message', onMsg); } catch (e) {}
      try { ws.removeListener('error', onErr); } catch (e) {}
    }
    ws.on('message', onMsg);
    ws.on('error', onErr);
    ws.on('open', () => {
      try { ws.send(JSON.stringify({ t: 'hello', name, cls: cls || 'Assault' })); } catch (e) {}
    });
  });
}

function send(ws, obj) {
  ws.send(JSON.stringify(obj));
}

async function waitPlayers(ws, want, what) {
  for (let i = 0; i < 40; i++) {
    const m = await once(ws, 'players', 3000);
    if (m.players && m.players.length === want) return m.players;
  }
  throw new Error('timeout waiting players=' + want + ' (' + what + ')');
}

function drain(ws, type) {
  if (!ws._buf) return [];
  const out = [];
  ws._buf = ws._buf.filter(m => {
    if (m && m.t === type) {
      out.push(m);
      return false;
    }
    return true;
  });
  return out;
}

function lastOf(ws, type) {
  const all = (ws._buf || []).filter(m => m && m.t === type);
  return all.length ? all[all.length - 1] : null;
}

// Ждать сообщение типа С УСЛОВИЕМ (бьющиеся боты сыплют чужие
// damage/dead/spawn в общий буфер — слепой once съедает их).
function onceFor(buf, type, pred, ms) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      for (let i = 0; i < buf.length; i++) {
        const m = buf[i];
        if (m && m.t === type && (!pred || pred(m))) return resolve(buf.splice(i, 1)[0]);
      }
      if (Date.now() - t0 > (ms || 5000)) return reject(new Error('timeout ' + type));
      setTimeout(poll, 100);
    })();
  });
}

// Свежайший снап бойца (боты ходят ~8Гц) — целиться гранатой по живому.
function lastSnap(buf, id) {
  const all = (buf || []).filter(m => m && m.t === 'snap' && m.id === id);
  return all.length ? all[all.length - 1] : null;
}

async function hold(ws, x, y, cond, timeoutMs, label) {
  const iv = setInterval(() => {
    send(ws, { t: 'snap', x, y, hp: 100, aimX: x + 50, aimY: y });
  }, 100);
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < timeoutMs) {
      const r = await cond();
      if (r) return r;
      await new Promise(r2 => setTimeout(r2, 250));
    }
    throw new Error('timeout: ' + label);
  } finally {
    clearInterval(iv);
  }
}

(async () => {
  const checks = [];
  const check = (label, cond) => {
    console.log((cond ? 'ok   ' : 'FAIL ') + label);
    checks.push(!!cond);
  };

  const a = await connect('ТестерА');
  const b = await connect('ТестерБ');
  check('все сразу в комнате', a.welcome.room === 'main' && b.welcome.room === 'main');
  check('первый — хост', a.welcome.host === true && b.welcome.host === false);
  await waitPlayers(a.ws, 2, 'duo');
  check('двое в списке', true);

  // Хост настраивает режим и места.
  send(a.ws, { t: 'setup', mode: 'KOTH', maxPlayers: 4 });
  let ri = null;
  for (let i = 0; i < 20; i++) {
    const m = await once(a.ws, 'roominfo', 3000);
    if (m.mode === 'KOTH' && m.maxPlayers === 4) {
      ri = m;
      break;
    }
  }
  check('setup применился', !!ri);

  // Третьего сверх лимита 2 не пускаем (отказ прямо в hello).
  send(a.ws, { t: 'setup', mode: 'KOTH', maxPlayers: 2 });
  await once(a.ws, 'roominfo', 5000);
  let fullErr = null, cws = null;
  try {
    const c = await connect('ТестерВ');
    cws = c.ws;
  } catch (e) {
    fullErr = (e && e.denied) || null;
  }
  check('переполнение отклонено', !!fullErr);
  try { if (cws) cws.close(); } catch (e) {}
  send(a.ws, { t: 'setup', mode: 'KOTH', maxPlayers: 4 });

  // Класс в лобби и кик: третий берёт Снайпера (видно всем в ростере),
  // сам кикать не может (не хост), хост его выгоняет.
  const c = await connect('ТестерВ');
  await waitPlayers(a.ws, 3, 'trio');
  send(c.ws, { t: 'cls', cls: 'Sniper' });
  let clsOk = false;
  for (let i = 0; i < 10; i++) {
    const m = await once(a.ws, 'players', 3000);
    const pc = (m.players || []).find(p => p.name === 'ТестерВ');
    if (pc && pc.cls === 'Sniper') { clsOk = true; break; }
  }
  check('смена класса в лобби', clsOk);
  drain(c.ws, 'error');
  send(c.ws, { t: 'kick', id: a.welcome.id });
  const kickDenied = await once(c.ws, 'error', 5000).catch(() => null);
  check('кикать может хост', !!kickDenied);
  drain(c.ws, 'kicked');
  send(a.ws, { t: 'kick', id: c.welcome.id });
  const kicked = await once(c.ws, 'kicked', 5000).catch(() => null);
  check('кикнутый предупреждён', !!kicked);
  await waitPlayers(a.ws, 2, 'duo-again');
  check('кик убрал из ростера', true);
  try { c.ws.close(); } catch (e) {}

  // Готовность и старт (с ботами: добивают до 4: свой и чужой).
  // Старт без готовности всех — отказ с именами ждущих.
  send(a.ws, { t: 'ready', ready: true });
  await new Promise(r => setTimeout(r, 300));
  drain(a.ws, 'error');
  send(a.ws, { t: 'start', bots: 2 });
  const gateErr = await once(a.ws, 'error', 5000).catch(() => null);
  check('старт ждёт готовых', !!gateErr);
  send(b.ws, { t: 'ready', ready: true });
  await new Promise(r => setTimeout(r, 300));
  send(a.ws, { t: 'start', bots: 2 });
  const st = await once(a.ws, 'started', 8000);
  check('started', !!st && st.mode === 'KOTH');
  check('команды разные', st.players[0].team !== st.players[1].team);
  const bots = (st.players || []).filter(p => p.bot);
  check('боты в составе', bots.length === 2);
  const idA = st.players.find(p => p.name === 'ТестерА').id;
  const idB = st.players.find(p => p.name === 'ТестерБ').id;
  const teamA = st.players.find(p => p.name === 'ТестерА').team;
  const botMate = bots.find(p => p.team === teamA);
  const botFoe = bots.find(p => p.team !== teamA);
  check('боты разных команд', !!botMate && !!botFoe);

  // Снапы ходят.
  send(a.ws, { t: 'snap', x: 100, y: 800, hp: 100 });
  const relay = await once(b.ws, 'snap', 5000);
  check('relay снапа', relay && relay.x === 100);

  // Очередь числом: СИГ шлёт n=3 — сосед получает все три.
  send(a.ws, { t: 'fire', weapon: 'SIG_SG_543', x: 100, y: 780, angle: 0, n: 3 });
  const fr = await once(b.ws, 'fire', 5000);
  check('очередь числом', fr && fr.n === 3 && fr.weapon === 'SIG_SG_543');

  // Нож по своему боту (френдлифаер x0.5): А подходит к нему вплотную.
  // B молчит до парковки (иначе синий бот поклюёт у спавна).
  // Ждём 1.2с от старта: щит спавна (1с) иначе съест проверку.
  // 40 x0.5=20: броня 40 гасит 12 — ХП 92, броня 28.
  await new Promise(r => setTimeout(r, 1200));
  const mate0 = lastSnap(a.ws._buf, botMate.id) || { x: 300 };
  send(a.ws, { t: 'snap', x: Math.round(mate0.x) - 80, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 150));
  drain(a.ws, 'damage'); drain(b.ws, 'damage');
  send(a.ws, { t: 'melee', target: botMate.id, dmg: 40, weapon: 'Knife' });
  const md = await once(a.ws, 'damage', 5000);
  check('нож дошёл', md && md.target === botMate.id && md.hp === 92 && md.armor === 28 && md.w === 'Knife');

  // Френдлифаер x0.5 — кидаем со 250 (вне радиуса 195 своих не задевает,
  // в лимите 550 от кидавшего — иначе суицид убьёт самого А до хитов).
  // Свой после ножа 92/28: ~110 x0.5=55, броня гасит 28 — ХП ~60-65, броня 0.
  // Б3: взрыв продолжает бросок — naded, сон запала, свежий прицел, boom.
  drain(a.ws, 'damage'); drain(b.ws, 'damage');
  const mateSnap = lastSnap(a.ws._buf, botMate.id) || lastSnap(b.ws._buf, botMate.id);
  const mfx = mateSnap ? mateSnap.x : 300;
  send(a.ws, { t: 'snap', x: Math.round(mfx) - 250, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 300));
  send(a.ws, { t: 'naded', type: 'frag', x: Math.round(mfx) - 250, y: 800, angle: 0 });
  await new Promise(r => setTimeout(r, 500));
  const mateNow = lastSnap(a.ws._buf, botMate.id) || mateSnap;
  send(a.ws, { t: 'snap', x: Math.round(mateNow.x) - 250, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 250));
  const mateBoom = lastSnap(a.ws._buf, botMate.id) || mateNow;
  // Взрыв в живую точку бота (y из снапа: мог уйти на мост Б — взрыв
  // снизу туда режется плитой как в одиночке, это честно).
  send(a.ws, { t: 'boom', type: 'frag', x: Math.round(mateBoom.x), y: Math.round(mateBoom.y) });
  await new Promise(r => setTimeout(r, 900));
  const mateDmg = a.ws._buf.filter(m => m && m.t === 'damage' && m.target === botMate.id);
  check('френдлифаер x0.5',
    mateDmg.length > 0 && mateDmg[0].hp >= 55 && mateDmg[0].hp <= 70 && mateDmg[0].armor === 0);
  send(a.ws, { t: 'snap', x: 100, y: 800, hp: 100 });

  // Б паркуется высоко в воздухе (800,-200) первым снапом (принят сразу):
  // туда боты не достают, дистанция хитов A->B ~1220 < 1300.
  send(b.ws, { t: 'snap', x: 1100, y: 50, hp: 100 });
  await new Promise(r => setTimeout(r, 300));

  // Чужой бот: А подходит на 250 (вне радиуса — без суицида, в лимите).
  // Телепорт + 1.2с на льготу guard, иначе позиция старая.
  // Танк (150/100, свежий): ~100 в лицо — ХП ~100-115 (halves: 127+).
  // Б3: бросок до запала — naded, сон запала, свежий прицел, boom.
  const foe0 = lastSnap(a.ws._buf, botFoe.id) || lastSnap(b.ws._buf, botFoe.id) || { x: 1800 };
  send(a.ws, { t: 'snap', x: Math.round(foe0.x) - 250, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 1200));
  send(a.ws, { t: 'snap', x: Math.round(foe0.x) - 250, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 300));
  const foeSnap = lastSnap(a.ws._buf, botFoe.id) || lastSnap(b.ws._buf, botFoe.id) || { x: 1800 };
  // Догоняем дрейф бота: снап в свежие координаты (сдвиг <600 — гард пропускает),
  // бросок из новой точки, иначе origin-check отклонит.
  send(a.ws, { t: 'snap', x: Math.round(foeSnap.x) - 250, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 300));
  send(a.ws, { t: 'naded', type: 'frag', x: Math.round(foeSnap.x) - 250, y: 800, angle: 0 });
  await new Promise(r => setTimeout(r, 600));
  drain(a.ws, 'damage'); drain(b.ws, 'damage');
  const foeNow = lastSnap(a.ws._buf, botFoe.id) || foeSnap;
  send(a.ws, { t: 'snap', x: Math.round(foeNow.x) - 250, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 250));
  const foeBoom = lastSnap(a.ws._buf, botFoe.id) || foeNow;
  // HP до взрыва — из снапа: боты дерутся между собой весь матч,
  // абсолютное окно хрупкое, проверяем относительное снижение от frag.
  const foePreHp = (foeBoom && Number.isFinite(foeBoom.hp)) ? foeBoom.hp : 151;
  // Взрыв в живую точку бота (см. выше про мост Б).
  send(a.ws, { t: 'boom', type: 'frag', x: foeBoom ? foeBoom.x : 1800, y: foeBoom ? Math.round(foeBoom.y) : 800 });
  await new Promise(r => setTimeout(r, 900));
  const foeDmg = a.ws._buf.filter(m => m && m.t === 'damage' && m.target === botFoe.id && m.w === 'frag');
  check('граната ранит чужого бота',
    foeDmg.length > 0 && foeDmg[0].hp < foePreHp);
  // Чужие damage из взрывов больше никому не нужны — чистим оба буфера,
  // иначе позднейшие once('damage') съедят протухшее.
  drain(a.ws, 'damage'); drain(b.ws, 'damage');
  // А домой (телепорт + льгота), иначе хиты дальше со старой позиции.
  send(a.ws, { t: 'snap', x: 100, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 1200));
  send(a.ws, { t: 'snap', x: 100, y: 800, hp: 100 });
  await new Promise(r => setTimeout(r, 300));
  drain(a.ws, 'damage'); drain(b.ws, 'damage');

  // Бой: читерский мимо.
  send(a.ws, { t: 'hit', target: 999999, dmg: 500, weapon: 'AK-47' });
  await new Promise(r => setTimeout(r, 600));
  // B могли поклевать боты на парковке (точные статы: снайпер 45/2.6с) —
  // сначала читаем ТЕКУЩИЕ хп/броню пробником 10, потом считаем ожидание
  // для базы АК-47 (23): броня гасит min(armor, 14). Детерминировано при любом состоянии.
  // Б2: сервер клампит урон потолком ствола (база x2.5), сотня уже не пролезет —
  // шлём реалистичные 23 как живой клиент.
  send(a.ws, { t: 'hit', target: idB, dmg: 10, weapon: 'AK-47' });
  const probe = await onceFor(b.ws._buf, 'damage', m => m.target === idB, 5000);
  const probeA = probe ? (probe.armor | 0) : 0;
  const expA = Math.max(0, probeA - Math.min(probeA, 14));
  const expH = (probe ? (probe.hp | 0) : 100) - (23 - Math.min(probeA, 14));
  send(a.ws, { t: 'hit', target: idB, dmg: 23, weapon: 'AK-47' });
  const dmg = await onceFor(b.ws._buf, 'damage', m => m.target === idB && (!probe || m.hp !== probe.hp || m.armor !== probe.armor), 5000);
  // Штурмовик свежий: броня 40 гасит 60% базы АК (14) — ХП 91, броня 26.
  check('урон дошёл (броня сработала)', dmg && dmg.target === idB && dmg.hp === expH && dmg.armor === expA);
  // Добивание легитимным крупняком (Barrett 95, в потолке 150): два хита — смерть.
  send(a.ws, { t: 'hit', target: idB, dmg: 95, weapon: 'Barrett_M82' });
  await new Promise(r => setTimeout(r, 400));
  send(a.ws, { t: 'hit', target: idB, dmg: 95, weapon: 'Barrett_M82' });
  const dead = await onceFor(b.ws._buf, 'dead', m => m.id === idB, 5000);
  check('смерть объявлена', dead && dead.id === idB);
  const spawn = await onceFor(b.ws._buf, 'spawn', m => m.id === idB, 9000);
  check('респаун', !!spawn && spawn.hp === 100 && spawn.armor === 40);
  // Возрождение кидает на базу команды (рядом вражеский бот!) —
  // снова паркуем B в воздух, иначе боты поклюют и цифры поплывут.
  // Плюс 1.2с: щит спавна (1с) иначе съест следующий хит.
  send(b.ws, { t: 'snap', x: 1100, y: 50, hp: 100 });
  await new Promise(r => setTimeout(r, 1200));
  drain(a.ws, 'damage'); drain(b.ws, 'damage');

  // Хитзоны: голова x2, ноги x0.7 (B свежий: 100/40).
  // 10 в голову = 20: броня гасит 12 — ХП 92, броня 28.
  send(a.ws, { t: 'hit', target: idB, dmg: 10, weapon: 'M16', zone: 'head' });
  const dz1 = await onceFor(b.ws._buf, 'damage', m => m.target === idB, 5000);
  check('голова x2', dz1 && dz1.hp === 92 && dz1.armor === 28 && dz1.zone === 'head' && dz1.w === 'M16');
  // 10 в ноги = 7: броня гасит 4 — ХП 89, броня 24.
  send(a.ws, { t: 'hit', target: idB, dmg: 10, weapon: 'M16', zone: 'legs' });
  const dz2 = await onceFor(b.ws._buf, 'damage', m => m.target === idB, 5000);
  check('ноги x0.7', dz2 && dz2.hp === 89 && dz2.armor === 24);

  // Бронекит +30 с капом (не полный бакет): сначала сбить броню базой М16.
  // 18 в тело: броня 24 гасит 11 — ХП 89-7=82, броня 13.
  send(a.ws, { t: 'hit', target: idB, dmg: 18, weapon: 'M16', zone: 'body' });
  await onceFor(b.ws._buf, 'damage', m => m.target === idB, 5000);
  drain(a.ws, 'kit'); drain(b.ws, 'kit');
  // Б3: вакуум (~585px: B в воздухе 1100,50, кит внизу) — отклоняем, kitok нет.
  const farId = idA + ':776';
  send(a.ws, { t: 'kit', id: farId, type: 'armor', x: 900, y: 600 });
  await once(b.ws, 'kit', 5000);
  send(b.ws, { t: 'kitwant', id: farId });
  const farOk = await once(b.ws, 'kitok', 1500).catch(() => null);
  check('вакуум кита отклонён', !farOk || farOk.id !== farId);
  drain(a.ws, 'kit'); drain(b.ws, 'kit'); drain(b.ws, 'kitok');
  const kitId = idA + ':777';
  // Кит рядом с парковкой B (1100,100 vs 1100,50 = 50px): можно.
  send(a.ws, { t: 'kit', id: kitId, type: 'armor', x: 1100, y: 100 });
  const kitRelay = await once(b.ws, 'kit', 5000);
  check('кит дошёл', kitRelay && kitRelay.id === kitId);
  send(b.ws, { t: 'kitwant', id: kitId });
  const kitok = await once(b.ws, 'kitok', 5000);
  check('кит выдан', kitok && kitok.id === kitId && kitok.by === idB);
  // 13+30=43 -> кап класса 40: хит 10 гасит 6 — ХП 82-4=78, броня 34.
  send(a.ws, { t: 'hit', target: idB, dmg: 10, weapon: 'M16', zone: 'body' });
  const dz3 = await onceFor(b.ws._buf, 'damage', m => m.target === idB, 5000);
  check('бронекит +30', dz3 && dz3.hp === 78 && dz3.armor === 34);
  // Дубликат id — сервер переписывает и шлёт автору kitfix.
  drain(a.ws, 'kitfix');
  send(a.ws, { t: 'kit', id: kitId, type: 'ammo', x: 700, y: 800 });
  const kfix = await once(a.ws, 'kitfix', 5000);
  check('kitfix', kfix && kfix.from === kitId && kfix.id !== kitId);

  // KOTH: встать на А.
  send(a.ws, { t: 'snap', x: 600, y: 830, hp: 100, aimX: 650, aimY: 830 });
  await hold(a.ws, 600, 830, async () => {
    const o = lastOf(a.ws, 'obj');
    return o && o.obj.points[0].holder === 'blue' ? o : null;
  }, 15000, 'koth capture');
  check('точка А за синими', true);
  await new Promise(r => setTimeout(r, 2500));
  const sc = lastOf(a.ws, 'score');
  check('очки капают', sc && sc.blue > 0);

  a.ws.close();
  b.ws.close();
  if (checks.every(Boolean)) {
    console.log('NET TEST OK');
    process.exit(0);
  } else {
    console.log('NET TEST FAILED');
    process.exit(1);
  }
})().catch((e) => {
  console.error('NET TEST FAILED:', e.message);
  process.exit(1);
});
