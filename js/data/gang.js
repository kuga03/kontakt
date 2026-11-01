// gang.js — Война банд (ТЗ п.14.6): своя банда + карта города 3×3 + контракты.
// Отдельный модуль в js/data (общая логика — сюда, а не в modes/*, см. ТЗ п.4).
// Циклов нет: импортирует только gameState/names. match.js/GameScene зовут отсюда.
import { gameState, saveGameState, addCoins, addExperience, hasWeapon } from './gameState.js?v=171';
import { randomBotNames } from './names.js?v=169';

export const GANG_ID = 'player';
export const ENEMY_GANGS = [
  { id: 'syndicate', name: 'Синдром', color: 0xff5555, css: '#ff6666', desc: 'Давят мясом', modes: ['TDM'] },
  { id: 'swarm', name: 'Рой', color: 0xb44dff, css: '#c07bff', desc: 'Тащат знамёна', modes: ['CTF', 'BOMB'] },
  { id: 'chimera', name: 'Химера', color: 0x7db8ff, css: '#7db8ff', desc: 'Держат высоты', modes: ['KOTH'] },
];
// Имена — из сюжета кампании (организация «Синдром», армия Химеры «Рой»).
// Старые id (wolves/rats/owls) мигрируют в ensureTurf (GANG_MIGRATE).
// Индивидуальный бейдж банды (рисуется кодом в BootScene.generateGangBadge):
// своя — корона, Синдром — когти, Рой — рой точек, Химера — глаза.
export function gangBadgeKey(gid) {
  try {
    if (gid === 'player' || gid === 'syndicate' || gid === 'swarm' || gid === 'chimera') return 'gang_' + gid;
  } catch (e) {}
  return null;
}
// Переименование Волки/Крысы/Сычи → сюжетные имена (старые сейвы).
const GANG_MIGRATE = { wolves: 'syndicate', rats: 'swarm', owls: 'chimera' };
export const DISTRICT_NAMES = ['Центр', 'Завод', 'Порт', 'Рынок', 'Вокзал', 'Парк', 'Старый город', 'Промзона', 'Холмы'];
export const GANG_COSTS = { hire: 5000, slot5: 20000, slot6: 50000, healEach: 1200, contractBonus: 200, districtIncome: 300 };
export const GANG_RULES = { maxMembers: 6, startSlots: 4, maxLevel: 10, fragsPerLevel: 15, holderNeed: 60, winInfl: 12, loseInfl: 6, contractDays: 3 };
const CLASSES = ['Assault', 'Tank', 'Medic', 'Sniper'];

function uid() {
  try { return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); } catch (e) { return 'g' + Math.floor(Math.random() * 1e9); }
}

// --- Инициализация (ленивая: gameState.js не трогаем, старых сейвов много) ---
export function ensureGang() {
  try {
    if (!gameState.gang || typeof gameState.gang !== 'object') {
      gameState.gang = { members: [], slots: GANG_RULES.startSlots, incomePool: 0, name: 'Своя банда' };
    }
    const g = gameState.gang;
    if (!Array.isArray(g.members)) g.members = [];
    // Стены памяти больше нет (убрана): чистим поле у старых сейвов.
    try { delete g.memorial; } catch (e) {}
    if (!Number.isFinite(+g.slots)) g.slots = GANG_RULES.startSlots;
    g.slots = Math.max(GANG_RULES.startSlots, Math.min(GANG_RULES.maxMembers, Math.floor(+g.slots)));
    if (!Number.isFinite(+g.incomePool)) g.incomePool = 0;
    if (typeof g.name !== 'string' || !g.name) g.name = 'Своя банда';
    return g;
  } catch (e) { return { members: [], slots: 4, incomePool: 0, name: 'Своя банда' }; }
}

export function ensureTurf() {
  try {
    if (!gameState.turf || typeof gameState.turf !== 'object') gameState.turf = null;
    const t = gameState.turf;
    const needNew = !t || !Array.isArray(t.districts) || t.districts.length !== 9 || !Array.isArray(t.contracts);
    if (needNew) {
      const districts = DISTRICT_NAMES.map((nm, i) => {
        // Старт: районы поделены между ИИ-бандами, у игрока — 0 везде.
        const owner = ['syndicate', 'swarm', 'chimera'][i % 3];
        const influence = { player: 0, syndicate: 10, swarm: 10, chimera: 10 };
        influence[owner] = 70;
        return { id: i, name: nm, holder: owner, influence, lieutenant: null };
      });
      gameState.turf = { districts, contracts: [], lastTick: 0, seq: 1 };
      saveGameState();
    }
    const tt = gameState.turf;
    // Миграция имён (сейвы до переименования): старые id → новые,
    // значения влияния переезжают. Идемпотентно.
    try {
      let mig = false;
      tt.districts.forEach(d => {
        if (!d || typeof d !== 'object') return;
        if (d.holder && GANG_MIGRATE[d.holder]) { d.holder = GANG_MIGRATE[d.holder]; mig = true; }
        if (d.influence && typeof d.influence === 'object') {
          Object.keys(GANG_MIGRATE).forEach(old => {
            if (old in d.influence) {
              const nu = GANG_MIGRATE[old];
              if (!(nu in d.influence)) d.influence[nu] = d.influence[old];
              delete d.influence[old];
              mig = true;
            }
          });
        }
      });
      (tt.contracts || []).forEach(c => {
        if (c && c.enemy && GANG_MIGRATE[c.enemy]) { c.enemy = GANG_MIGRATE[c.enemy]; mig = true; }
      });
      if (mig) saveGameState();
    } catch (e) {}
    tt.districts.forEach(d => {
      if (!d.influence || typeof d.influence !== 'object') d.influence = { player: 0, syndicate: 10, swarm: 10, chimera: 10 };
      ['player', 'syndicate', 'swarm', 'chimera'].forEach(k => {
        if (!Number.isFinite(+d.influence[k])) d.influence[k] = 0;
        d.influence[k] = Math.max(0, Math.min(100, Math.round(+d.influence[k])));
      });
      if (typeof d.holder !== 'string') d.holder = 'syndicate';
      if (!('lieutenant' in d)) d.lieutenant = null;
    });
    if (!Array.isArray(tt.contracts)) tt.contracts = [];
    if (!Number.isFinite(+tt.seq)) tt.seq = 1;
    // Ремонт старых контрактов (сейвы до фикса): враг обязан держать район,
    // иначе карточка врёт; награда обязана быть ролльнутой, иначе все цифры
    // базовые (12/200/6) без разброса. Идемпотентно: чиненое не меняется.
    try {
      let dirty = false;
      (tt.contracts || []).forEach(c => {
        if (!c || typeof c !== 'object') return;
        let d = tt.districts.find(x => x && x.id === c.districtId);
        if (!d && tt.districts.length) { c.districtId = tt.districts[0].id; d = tt.districts[0]; dirty = true; }
        if (!d) return;
        const enemy = enemyForDistrict(d);
        if (c.enemy !== enemy) { c.enemy = enemy; dirty = true; }
        const r = c.reward;
        if (!r || !Number.isFinite(+r.winInfl) || !Number.isFinite(+r.bonus) || !Number.isFinite(+r.loseInfl)) {
          c.reward = rollReward();
          dirty = true;
        }
        const want = contractText(c.enemy, c.mode, d.name);
        if (c.text !== want) { c.text = want; dirty = true; }
      });
      if (dirty) saveGameState();
    } catch (e) {}
    return tt;
  } catch (e) { return { districts: [], contracts: [], lastTick: 0, seq: 1 }; }
}

export function gangById(id) {
  try {
    const g = ensureGang();
    return (g.members || []).find(m => m && m.id === id) || null;
  } catch (e) { return null; }
}

function holderFor(d) {
  let best = null, bestV = -1;
  ['player', 'syndicate', 'swarm', 'chimera'].forEach(k => {
    const v = +((d.influence || {})[k]) || 0;
    if (v > bestV) { bestV = v; best = k; }
  });
  return bestV >= GANG_RULES.holderNeed ? best : d.holder;
}

// --- Суточный тик (по дате входа, как ежедневка п.8; время — только Number, не | 0) ---
export function turfTick(force) {
  try {
    ensureGang(); ensureTurf();
    const t = gameState.turf;
    const nowMs = Date.now();
    const guard = Number(gameState.timeGuard) || 0;
    // Откат часов — тик блокируем (тот же античит, что ежедневка).
    if (guard && nowMs < guard - 3600 * 1000) return { ticked: false, rollback: true };
    const lastTs = Number(t.lastTick) || 0;
    const sameDay = lastTs && new Date(lastTs).toDateString() === new Date(nowMs).toDateString();
    if (sameDay && !force) return { ticked: false };
    // Перемотка вперёд без 20ч — тоже не тикаем (как ежедневка).
    if (lastTs && nowMs - lastTs < 20 * 3600 * 1000 && !force) return { ticked: false, tooSoon: true };
    const myDistricts = t.districts.filter(d => d.holder === 'player').length;
    // Эскалация: чем больше держишь, тем злее тик по тебе.
    const heat = 1 + myDistricts * 0.15;
    t.districts.forEach(d => {
      const inf = d.influence;
      // Банды отжимают друг у друга и у игрока (сила от числа районов).
      const order = ['syndicate', 'swarm', 'chimera'].sort(() => Math.random() - 0.5);
      order.forEach(gid => {
        const foes = ['player', 'syndicate', 'swarm', 'chimera'].filter(k => k !== gid);
        const foe = foes[Math.floor(Math.random() * foes.length)];
        let take = 2 + Math.floor(Math.random() * 4);
        if (foe === 'player') take = Math.round(take * heat);
        // Лейтенант держит район: порог отбития +10 → режем тик по игроку вдвое.
        if (foe === 'player' && d.lieutenant) take = Math.max(1, Math.round(take / 2));
        inf[foe] = Math.max(0, (inf[foe] | 0) - take);
        inf[gid] = Math.min(100, (inf[gid] | 0) + take);
      });
      // Простой сливает: ничейное влияние потихоньку тает к статус-кво.
      d.holder = holderFor(d);
    });
    // Доход: 300/район/день (+50% с лейтенантом) — в казну, забирается кнопкой.
    const g = ensureGang();
    let income = 0;
    t.districts.forEach(d => {
      if (d.holder === 'player') income += GANG_COSTS.districtIncome * (d.lieutenant ? 1.5 : 1);
    });
    g.incomePool = Math.max(0, (Number(g.incomePool) || 0) + Math.round(income));
    // Контракты: чистим протухшие, держим 3 активных.
    const now = nowMs;
    t.contracts = (t.contracts || []).filter(c => c && Number(c.expiresAt) > now);
    while (t.contracts.length < 3) t.contracts.push(genContract(t));
    t.lastTick = nowMs;
    saveGameState();
    return { ticked: true, income: Math.round(income) };
  } catch (e) { return { ticked: false }; }
}

function pickModeFor(enemy) {
  const eg = ENEMY_GANGS.find(g => g.id === enemy);
  const pool = (eg && eg.modes && eg.modes.length) ? eg.modes : ['TDM', 'CTF', 'BOMB', 'KOTH'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Враг для района: его владелец (бой всегда за район того, кто его держит).
// Свой район — отбиваем у сильнейшего пресса (макс. чужого влияния).
function enemyForDistrict(d) {
  try {
    if (d && d.holder && d.holder !== 'player' && ENEMY_GANGS.find(g => g.id === d.holder)) return d.holder;
    let best = null, bestV = -1;
    ['syndicate', 'swarm', 'chimera'].forEach(gid => {
      const v = +((d && d.influence ? d.influence : {})[gid]) || 0;
      if (v > bestV) { bestV = v; best = gid; }
    });
    return best || 'syndicate';
  } catch (e) { return 'syndicate'; }
}

// Награда — с небольшим разбросом от базы. Роллится при генерации
// и хранится в контракте: карточка показывает ровно то, что выплатит бой.
function rollReward() {
  return {
    winInfl: GANG_RULES.winInfl + Math.floor(Math.random() * 5) - 2,
    bonus: GANG_COSTS.contractBonus + (Math.floor(Math.random() * 11) - 5) * 10,
    loseInfl: GANG_RULES.loseInfl + Math.floor(Math.random() * 5) - 2
  };
}

const CONTRACT_TITLES = { TDM: 'зачистить', CTF: 'отбить склад у', BOMB: 'подорвать точку', KOTH: 'выбить с позиций' };

function contractText(enemy, mode, distName) {
  const eg = ENEMY_GANGS.find(g => g.id === enemy) || { name: enemy };
  return `${cap(CONTRACT_TITLES[mode] || 'атаковать')} ${eg.name} — ${distName}`;
}

export function genContract(t) {
  const turf = t || ensureTurf();
  const ds = (turf.districts && turf.districts.length) ? turf.districts : [{ id: 0, name: 'Центр', holder: 'syndicate', influence: {} }];
  // Сначала район, враг — его владелец: карточка «атаковать Волков — Порт»
  // обязана означать, что Порт держат Волки (раньше оба роллились
  // независимо и бой давали за чужой район).
  const d = ds[Math.floor(Math.random() * ds.length)];
  const enemy = enemyForDistrict(d);
  const mode = pickModeFor(enemy);
  const id = 'c' + (turf.seq = (Number(turf.seq) || 1) + 1);
  const reward = rollReward();
  return {
    id, districtId: d.id, enemy, mode, reward,
    text: contractText(enemy, mode, d.name),
    expiresAt: Date.now() + GANG_RULES.contractDays * 24 * 3600 * 1000
  };
}

// Награда контракта с фолбэком на базу (старые сейвы без reward).
export function contractReward(c) {
  try {
    const r = c && c.reward;
    if (r && Number.isFinite(+r.winInfl) && Number.isFinite(+r.bonus) && Number.isFinite(+r.loseInfl)) {
      return { winInfl: Math.round(+r.winInfl), bonus: Math.round(+r.bonus), loseInfl: Math.round(+r.loseInfl) };
    }
  } catch (e) {}
  return { winInfl: GANG_RULES.winInfl, bonus: GANG_COSTS.contractBonus, loseInfl: GANG_RULES.loseInfl };
}
function cap(s) { try { return s.charAt(0).toUpperCase() + s.slice(1); } catch (e) { return s; } }

// --- Банда: найм, слоты, стволы, уровни, лейтенанты, лечение ---
export function hireMember() {
  try {
    const g = ensureGang();
    if ((g.members || []).length >= (g.slots | 0)) return { ok: false, reason: 'slots' };
    if ((Number(gameState.coins) || 0) < GANG_COSTS.hire) return { ok: false, reason: 'coins' };
    addCoins(-GANG_COSTS.hire);
    const m = {
      id: uid(), name: (randomBotNames(1, (g.members || []).map(x => x.name))[0] || 'Новичок'),
      class: CLASSES[Math.floor(Math.random() * CLASSES.length)],
      gun: null, level: 0, frags: 0, wounded: false, inBattle: true, lieutenant: null
    };
    g.members.push(m);
    saveGameState();
    return { ok: true, member: m };
  } catch (e) { return { ok: false }; }
}

export function buySlot() {
  try {
    const g = ensureGang();
    const cur = g.slots | 0;
    if (cur >= GANG_RULES.maxMembers) return { ok: false, reason: 'max' };
    const price = cur === 4 ? GANG_COSTS.slot5 : GANG_COSTS.slot6;
    if ((Number(gameState.coins) || 0) < price) return { ok: false, reason: 'coins' };
    addCoins(-price);
    g.slots = cur + 1;
    saveGameState();
    return { ok: true, slots: g.slots };
  } catch (e) { return { ok: false }; }
}

export function healAll() {
  try {
    const g = ensureGang();
    const w = (g.members || []).filter(m => m && m.wounded);
    if (!w.length) return { ok: false, reason: 'none' };
    const price = w.length * GANG_COSTS.healEach;
    if ((Number(gameState.coins) || 0) < price) return { ok: false, reason: 'coins' };
    addCoins(-price);
    w.forEach(m => { m.wounded = false; });
    saveGameState();
    return { ok: true, healed: w.length };
  } catch (e) { return { ok: false }; }
}

export function claimIncome() {
  try {
    const g = ensureGang();
    const amt = Math.max(0, Math.floor(Number(g.incomePool) || 0));
    if (!amt) return { ok: false, reason: 'none' };
    g.incomePool = 0;
    addCoins(amt);
    saveGameState();
    return { ok: true, amount: amt };
  } catch (e) { return { ok: false }; }
}

export function assignGun(memberId, gunName) {
  try {
    const m = gangById(memberId);
    if (!m) return { ok: false };
    if (gunName && !hasWeapon(gunName)) return { ok: false, reason: 'owned' };
    m.gun = gunName || null;
    saveGameState();
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

export function toggleBattle(memberId) {
  try {
    const m = gangById(memberId);
    if (!m || m.lieutenant) return { ok: false };
    m.inBattle = !m.inBattle;
    saveGameState();
    return { ok: true, inBattle: m.inBattle };
  } catch (e) { return { ok: false }; }
}

export function setLieutenant(memberId, districtId) {
  try {
    const g = ensureGang(); ensureTurf();
    const m = gangById(memberId);
    if (!m) return { ok: false };
    // Снять: districtId null. Назначить: только свой район, один смотрит один район.
    if (districtId == null) {
      gameState.turf.districts.forEach(d => { if (d.lieutenant === memberId) d.lieutenant = null; });
      m.lieutenant = null;
      saveGameState();
      return { ok: true };
    }
    const d = gameState.turf.districts.find(x => x && x.id === districtId);
    if (!d || d.holder !== 'player') return { ok: false, reason: 'holder' };
    gameState.turf.districts.forEach(x => { if (x.lieutenant === memberId) x.lieutenant = null; });
    // С прошлого смотрящего снимаем метку.
    if (d.lieutenant) { const prev = gangById(d.lieutenant); if (prev) prev.lieutenant = null; }
    d.lieutenant = memberId;
    m.lieutenant = districtId;
    m.inBattle = false;
    saveGameState();
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

export function dismissMember(memberId) {
  try {
    const g = ensureGang();
    const i = (g.members || []).findIndex(m => m && m.id === memberId);
    if (i < 0) return { ok: false };
    const [m] = g.members.splice(i, 1);
    // Ствол возвращается в арсенал: разблокировки постоянны, снимать нечего.
    gameState.turf && gameState.turf.districts && gameState.turf.districts.forEach(d => {
      if (d.lieutenant === memberId) d.lieutenant = null;
    });
    saveGameState();
    return { ok: true, member: m };
  } catch (e) { return { ok: false }; }
}

// Кого берём в бой: до 4 выбранных (не лейтенантов). Вызывается GameScene.
export function pickRaidFighters() {
  try {
    const g = ensureGang();
    return (g.members || []).filter(m => m && m.inBattle && !m.lieutenant && m.lieutenant !== 0).slice(0, 4);
  } catch (e) { return []; }
}

// Баффы уровня + дебаффы ранения — отдельным мультипликатором на спавне
// (НЕ в прокачку/диффикалт: те сбрасываются revive).
export function gangHpMult(m) { try { return (1 + 0.05 * Math.min(GANG_RULES.maxLevel, (m && m.level) | 0)) * (m && m.wounded ? 0.7 : 1); } catch (e) { return 1; } }
export function gangAccBonus(m) { try { return 0.03 * Math.min(GANG_RULES.maxLevel, (m && m.level) | 0); } catch (e) { return 0; } }

export function applyGangStatsToBot(bot, member) {
  try {
    if (!bot || !member) return;
    bot._gangId = member.id;
    bot._gangWounded = !!member.wounded;
    bot._gangAccBonus = gangAccBonus(member);
    const mult = gangHpMult(member);
    bot.maxHp = Math.max(1, Math.round((bot.maxHp || 100) * mult));
    bot.hp = bot.maxHp;
    if (member.wounded) {
      // Раненый: скорость −15%, темп −20% (fireRate ×1.25). Отдельные флаги,
      // переживающие revive — только через _gangWounded (см. match.js).
      try { bot.moveSpeed = Math.max(1, Math.round((bot.moveSpeed || 230) * 0.85)); } catch (e) {}
      try { if (bot._baseMoveSpeed) bot._baseMoveSpeed = bot.moveSpeed; } catch (e) {}
      try {
        bot.fireRateMult = 1.25;
        (bot.inventory || []).forEach(w => { if (w && !w.isMelee) w.fireRateMult = 1.25; });
      } catch (e) {}
    }
  } catch (e) {}
}

// После revive (сбрасывает fireRate/скорость танка) — вернуть дебафф раненого.
export function reapplyGangOnRevive(bot) {
  try {
    if (!bot || !bot._gangWounded) return;
    try { bot.moveSpeed = Math.max(1, Math.round((bot.moveSpeed || 230) * 0.85)); } catch (e) {}
    try {
      bot.fireRateMult = 1.25;
      (bot.inventory || []).forEach(w => { if (w && !w.isMelee) w.fireRateMult = 1.25; });
    } catch (e) {}
  } catch (e) {}
}

function localContrib(p) {
  try {
    if (!p) return 0;
    return (((p.kills | 0)) * 30) + Math.floor((p.damageDealt || 0) / 25)
      + ((p.flagsDelivered || 0) * 100) + ((p.plants || 0) * 100)
      + ((p.defuses || 0) * 50) + ((p.caps || 0) * 20)
      + ((p.returnsCount || 0) * 25) + ((p.carrierKills || 0) * 50)
      + ((p.healedGiven || 0) * 0.5);
  } catch (e) { return 0; }
}

// Итоги боя для банды. Возвращает строку для окна итогов (или '').
// ВАЖНО: контракт считается ВСЕГДА (даже без бойцов банды в бою и даже
// в соло) — иначе новая банда (пустой ростер) никогда не капает влияние.
export function settleBattle(scene, playerWon) {
  // Песочница: контрактный бой без последствий — контракт не съедается,
  // влияние/бонус/ранения не тикают (иначе фарм прогресса без сопротивления).
  try {
    if (scene && scene.botDifficulty && scene.botDifficulty.id === 'sandbox') return '';
  } catch (e) {}
  try {
    ensureGang(); ensureTurf();
    const g = gameState.gang;
    const fighters = scene._gangFighters || [];
    const lines = [];
    if (fighters.length) {
    if (playerWon) {
      // Победа состояние не меняет: раненые остаются ранеными.
      fighters.forEach(f => {
        const m = gangById(f.id);
        const bot = f.bot;
        if (!m || !bot) return;
        const k = (bot.kills | 0);
        m.frags = ((m.frags | 0)) + k;
        const nl = Math.min(GANG_RULES.maxLevel, Math.floor((m.frags | 0) / GANG_RULES.fragsPerLevel));
        if (nl > (m.level | 0)) { m.level = nl; lines.push(`${m.name} — ур. ${nl}`); }
      });
    } else {
      // Поражение: участники ранены; раненый повторно — гибель.
      fighters.forEach(f => {
        const m = gangById(f.id);
        const bot = f.bot;
        if (!m) return;
        if (bot) m.frags = ((m.frags | 0)) + ((bot.kills | 0));
        if (m.wounded) {
          // Гибель: боец уходит из ростера, ствол в арсенале остаётся
          // (разблокировки постоянны).
          g.members = (g.members || []).filter(x => x && x.id !== m.id);
          lines.push(`${m.name} — погиб`);
        } else {
          m.wounded = true;
          lines.push(`${m.name} — ранен`);
        }
      });
    }
    } // fighters.length — дальше контракт (считается и без бойцов в бою)
    // Контракт: победа капает влияние + бонус (с разбросом из контракта),
    // поражение сливает. Строка влияния — в итоги всегда.
    // Вербовка — только из контрактного боя (ниже): в бой идут _gangFighters.
    const wasContract = !!(scene && scene._gangContractId);
    // Контракт: победа капает влияние + бонус (с разбросом из контракта),
    // поражение сливает. Строка влияния — в итоги всегда.
    try {
      const cid = scene._gangContractId;
      if (cid) {
        const c = gameState.turf.contracts.find(x => x && x.id === cid);
        if (c) {
          const rw = contractReward(c);
          const d = gameState.turf.districts.find(x => x && x.id === c.districtId);
          if (d) {
            if (playerWon) {
              d.influence.player = Math.min(100, ((d.influence.player | 0)) + rw.winInfl);
              d.influence[c.enemy] = Math.max(0, ((d.influence[c.enemy] | 0)) - rw.winInfl);
              lines.push(`+${rw.winInfl} влияния (${d.name} — мы ${d.influence.player})`);
              scene.matchCoins = (scene.matchCoins || 0) + rw.bonus;
              addCoins(rw.bonus);
              const xpB = 20;
              scene.matchXP = (scene.matchXP || 0) + xpB;
              try { addExperience(xpB); } catch (e) {}
            } else {
              d.influence.player = Math.max(0, ((d.influence.player | 0)) - rw.loseInfl);
              lines.push(`провал: −${rw.loseInfl} влияния (${d.name})`);
            }
            d.holder = holderFor(d);
          }
          gameState.turf.contracts = (gameState.turf.contracts || []).filter(x => x && x.id !== cid);
          // Сразу генерим замену, чтобы лента не пустела.
          try { gameState.turf.contracts.push(genContract(gameState.turf)); } catch (e) {}
        }
        scene._gangContractId = null;
      }
    } catch (e) {}
    // Вербовка — только из контрактного боя: в банду зовут тех, с кем
    // воевали плечом к плечу. Свободные бои/кампания вербовки не дают.
    if (wasContract) maybeRecruit(scene, playerWon);
    saveGameState();
    if (!lines.length) return '';
    const head = (scene._gangFighters || []).length ? 'Банда: ' : 'Контракт: ';
    return head + lines.join(' · ');
  } catch (e) { return ''; }
}

// Вербовка: топ-1 по вкладу среди синих ботов (не банда) предлагает вступить.
// Только контрактные бои (зовёт settleBattle с гейтом wasContract).
function maybeRecruit(scene, playerWon) {
  try {
    if (!playerWon) return;
    const g = ensureGang();
    if ((g.members || []).length >= (g.slots | 0)) return;
    if (g.pendingRecruit) return;
    const gangIds = new Set((scene._gangFighters || []).map(f => f.bot).filter(Boolean));
    let best = null, bestScore = -1;
    (scene.players || []).forEach(p => {
      if (!p || p === scene.player || p.team !== 'blue' || !p.isAI) return;
      if (gangIds.has(p)) return;
      if (p.dead && false) return;
      const s = localContrib(p);
      if (s > bestScore) { bestScore = s; best = p; }
    });
    if (best && bestScore > 0) {
      g.pendingRecruit = { name: best.playerName || best.name || 'Боец', class: best.constructor ? best.constructor.name : 'Assault', at: Date.now() };
      saveGameState();
    }
  } catch (e) {}
}

export function acceptRecruit() {
  try {
    const g = ensureGang();
    const r = g.pendingRecruit;
    if (!r) return { ok: false };
    if ((g.members || []).length >= (g.slots | 0)) return { ok: false, reason: 'slots' };
    const m = { id: uid(), name: r.name, class: CLASSES.includes(r.class) ? r.class : 'Assault', gun: null, level: 0, frags: 0, wounded: false, inBattle: true, lieutenant: null };
    g.members.push(m);
    g.pendingRecruit = null;
    saveGameState();
    return { ok: true, member: m };
  } catch (e) { return { ok: false }; }
}

export function declineRecruit() {
  try {
    ensureGang().pendingRecruit = null;
    saveGameState();
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

export function districtById(id) {
  try { return ensureTurf().districts.find(d => d && d.id === id) || null; } catch (e) { return null; }
}
export function contractById(id) {
  try { return ensureTurf().contracts.find(c => c && c.id === id) || null; } catch (e) { return null; }
}
