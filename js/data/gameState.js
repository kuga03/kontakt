import { currentSeasonId } from './pass.js?v=170';

// Версия формата сейва: сейвы без версии считаются v1.
const SAVE_VER = 2;

const defaultState = {
  saveVer: SAVE_VER,
  coins: 1000,
  level: 1,
  experience: 0,
  campaignLevel: 1,
  // Дефолты — ПУСТОЕ снаряжение: новичок начинает голым,
  // в бою держится штатными стволами класса (см. Player),
  // а своё собирает через магазин (уровень за уровнем).
  // Классы открываются: штурмовик с 1, танк со 2, медик с 3, снайпер с 4.
  playerName: 'Игрок',
  unlockedWeapons: [],
  equipment: {
    Assault: { primary: null, secondary: null, melee: null },
    Tank: { primary: null, secondary: null, melee: null },
    Medic: { primary: null, secondary: null, melee: null },
    Sniper: { primary: null, secondary: null, melee: null }
  },
  skins: [],
  selectedSkin: null,
  weaponSkins: [],
  playerHeadColor: '#d49a6a',
  playerBodyColor: '#888888',
  campaignDifficulty: 'experienced',
  freeDifficulty: 'veteran',
  // Громкость: музыка и звуки отдельно (0..1, 0 = Выкл).
  musicVol: 1,
  sfxVol: 1,
  scoreLimit: 30,
  ctfLimit: 3,
  // k300: старт CTF сразу с овертайма (золото в центре, обычных флагов
  // нет). Кнопка в лобби, только свободная игра.
  ctfSuddenStart: false,
  bombLimit: 3,
  // Лимит очков захвата точек (100/200/300, по ТЗ — 200).
  kothLimit: 200,
  botCount: 5,
  // Боты по командам (лобби свободной игры, командные режимы): синие/красные
  // отдельно, 0–8. Игрок всегда за синих (сверх blueBots). Старые сейвы
  // подхватят оба из botCount ниже. FFA — по-прежнему общий botCount.
  blueBots: 5,
  redBots: 5,
  // Соло против всех (лобби свободной игры, командные режимы): союзных
  // ботов нет, вся твоя команда — ты один. Старые сейвы подхватят merge.
  noAllies: false,
  // Прицел: цвет/фигура/размер/толщина/лапки/точка/динамика (см. data/crosshair.js).
  // Дефолт = старый вид (кольцо + лапки 8 + точка 2).
  crosshair: { color: '#ccffcc', shape: 'circle', size: 8, thick: 2.5, arms: 8, dot: 2, dynamic: true },
  // Карта свободной игры (лобби, «Карта: …»): 'auto' — по режиму,
  // иначе id файла maps/*.json ('ctf'/'bomb'/'koth') — работает в любом режиме.
  freeMapId: 'auto',
  grenadeStock: { frag: 0, smoke: 0 },
  trialBestKills: 0,
  trialBestTime: 0,
  skillPoints: 0,
  skills: {},
  skillsVersion: 1,
  // Сколько раз сбрасывали навыки (тариф: бесплатно, 5000, 100000, стоп).
  skillResets: 0,
  weaponVersion: 2,
  ownedHeads: [],
  equippedHead: null,
  // Гардероб ПО КЛАССАМ: у каждого класса свой наряд
  // { Assault: {head,shoes,torso,pants}, Tank: {...}, ... }.
  // Купленные вещи общие (owned*), а надето у каждого своё.
  // equippedHead/* — legacy-зеркало (старые сейвы/другой код), источник правды — wardrobe.
  wardrobe: null,
  // Статистика для showcase/ачивок/пасса.
  stats: null,
  medals: {},
  gang: null,
  turf: null,
  weaponLevels: {},
  dailyStreak: 0,
  dailyMonth: '',
  dailyFrags: 0,
  lastDaily: 0,
  timeGuard: 0,
  ownedShoes: [],
  ownedTorsos: [],
  ownedPants: [],
  equippedShoes: null,
  equippedTorso: null,
  equippedPants: null,
  mutators: [],
  // Баттл-пасс «Контракты» (сезон 30 дней, см. data/pass.js).
  pass: null,
  achievements: [],
  friends: [],
  clan: null,
  contractHistory: [],
  // Происхождение скинов: id скина → id кейса ('weapons'/'skins'/legacy)
  // или 'contract' (из обмена). Нужно контракту: очки кейсов на легендарный.
  skinOrigin: {},
  // История боёв для вкладки «Другое» (последние 20, пишет endGame).
  matchHistory: [],
  // Онлайн-рейтинг (для будущей сети). Начинается с 0 и растёт
  // только онлайн-боями — одиночка на него не влияет.
  onlineRating: 0,
  // Победы/поражения для процента (только сложность Бывалый и выше).
  expWins: 0,
  expLosses: 0,
  // Демо-бой: игроком управляет ИИ (включается чит-кодом demo).
  demoMode: false,
  lastClass: 'Assault',
  // Геном и даты скинов — сразу в дефолте, чтобы не плодить заплатки.
  // genes — ОБЪЕКТ {id: уровень} (см. genes.js:getGeneLevel), НЕ массив;
  // geneUnlocked — boolean (falsy = геном закрыт, см. MenuScene2).
  genePoints: 0,
  genes: {},
  geneUnlocked: false,
  weaponSkinDates: {}
};

const OLD_STARTERS = ['bad_ak47', 'Makarov', 'Glock', 'M1911'];

let storedState = null;
try {
  storedState = localStorage.getItem('sideShooterState');
} catch (e) {
  storedState = null;
}

let parsedState = null;
try {
  parsedState = storedState ? JSON.parse(storedState) : null;
} catch (e) {
  // Битый сейв — стартуем с дефолта, а не белый экран.
  parsedState = null;
}
if (!parsedState || typeof parsedState !== 'object' || Array.isArray(parsedState)) {
  parsedState = null;
}

// Deep clone дефолта + merge поверх: вложенные объекты (equipment,
// grenadeStock) не делят ссылки ни с defaultState, ни между сейвами.
// Копируются только известные defaultState ключи: лишнее из старых сейвов
// (например weekly) молча игнорится, отсутствующее добирается дефолтом.
function _mergeState() {
  const base = JSON.parse(JSON.stringify(defaultState));
  if (parsedState) {
    Object.keys(base).forEach(k => {
      if (parsedState[k] !== undefined) base[k] = parsedState[k];
    });
  }
  return base;
}
export const gameState = _mergeState();
// Разрываем возможные общие ссылки с defaultState после merge.
gameState.equipment = JSON.parse(JSON.stringify(gameState.equipment || {}));
gameState.grenadeStock = JSON.parse(JSON.stringify(gameState.grenadeStock || { frag: 0, smoke: 0 }));
// Ключи, переехавшие в defaultState: чиним тип (битый сейв) — значения
// из сейва уже подхвачены allowlist-merge выше.
if (!gameState.medals || typeof gameState.medals !== 'object' || Array.isArray(gameState.medals)) gameState.medals = {};
if (!gameState.weaponLevels || typeof gameState.weaponLevels !== 'object' || Array.isArray(gameState.weaponLevels)) gameState.weaponLevels = {};
if (!Array.isArray(gameState.mutators)) gameState.mutators = [];
for (const k of ['ownedShoes', 'ownedTorsos', 'ownedPants']) {
  if (!Array.isArray(gameState[k])) gameState[k] = [];
}
// v1 → v2: штампуем версию (сейвы без версии считаются v1).
if ((gameState.saveVer | 0) < SAVE_VER) {
  gameState.saveVer = SAVE_VER;
  saveGameState();
}

// Защита от битого сейва: массивы, числа, уровни (иначе краши/NaN/вечный цикл опыта).
if (!Array.isArray(gameState.unlockedWeapons)) gameState.unlockedWeapons = [];
if (!Array.isArray(gameState.weaponSkins)) gameState.weaponSkins = [];
if (!Array.isArray(gameState.ownedHeads)) gameState.ownedHeads = [];
gameState.coins = Number.isFinite(+gameState.coins) ? Math.max(0, Math.floor(+gameState.coins)) : 1000;
gameState.level = Number.isFinite(+gameState.level) ? Math.max(1, Math.floor(+gameState.level)) : 1;
gameState.experience = Number.isFinite(+gameState.experience) ? Math.max(0, Math.floor(+gameState.experience)) : 0;
gameState.campaignLevel = Number.isFinite(+gameState.campaignLevel) ? Math.max(1, Math.floor(+gameState.campaignLevel)) : 1;

if (gameState.weaponVersion !== 2) {
  gameState.unlockedWeapons = (Array.isArray(gameState.unlockedWeapons)
    ? gameState.unlockedWeapons
    : []
  ).filter(w => !OLD_STARTERS.includes(w));
  gameState.equipment = {
    Assault: { primary: null, secondary: null, melee: null },
    Tank: { primary: null, secondary: null, melee: null },
    Medic: { primary: null, secondary: null, melee: null },
    Sniper: { primary: null, secondary: null, melee: null }
  };
  gameState.weaponVersion = 2;
  saveGameState();
}

if (!gameState.equipment) {
  gameState.equipment = {
    Assault: { primary: null, secondary: null, melee: null },
    Tank: { primary: null, secondary: null, melee: null },
    Medic: { primary: null, secondary: null, melee: null },
    Sniper: { primary: null, secondary: null, melee: null }
  };
}
// Миграция: М4 удалена из игры (п.1) — чистим старые сейвы; всем классам
// добавляем ячейку melee (п.17).
if (Array.isArray(gameState.unlockedWeapons) && gameState.unlockedWeapons.includes('M4')) {
  gameState.unlockedWeapons = gameState.unlockedWeapons.filter(w => w !== 'M4');
  gameState.weaponSkins = (gameState.weaponSkins || []).filter(id => !String(id).startsWith('M4::'));
  saveGameState();
}
// Миграция: обувь раньше продавалась как головной убор (слот головы) —
// переносим купленные полуберцы/берцы из ownedHeads в ownedShoes,
// иначе после фикса слота покупка «потеряется», а убор висит на голове.
try {
  const shoeKeys = ['полуберцы', 'ботинки_усиленные'];
  if (!Array.isArray(gameState.ownedShoes)) gameState.ownedShoes = [];
  shoeKeys.forEach(k => {
    if (Array.isArray(gameState.ownedHeads) && gameState.ownedHeads.includes(k)) {
      gameState.ownedHeads = gameState.ownedHeads.filter(x => x !== k);
      if (!gameState.ownedShoes.includes(k)) gameState.ownedShoes.push(k);
    }
  });
  if (shoeKeys.includes(gameState.equippedHead)) {
    gameState.equippedShoes = gameState.equippedHead;
    gameState.equippedHead = null;
  }
} catch (e) {}
// Миграция: вне-сетевые уборы удалены из игры — вычищаем их из владения
// и из надетого (все классы), иначе слоты ссылаются на несуществующие
// текстуры. Остаются только вещи из 6 сетов.
try {
  const KEEP_GEAR = new Set([
    'камуфляжный_шлем', 'бескозырка', 'военный_шлем',
    'маска_ночная', 'фуражка_парадная', 'шляпа_закона',
    'полуберцы', 'ботинки_усиленные', 'берцы_камуфляж',
    'берцы_ночные', 'туфли_офицера', 'сапоги_шерифа',
    'торс_тельняшка', 'торс_разгрузка', 'торс_камуфляж',
    'торс_ночной', 'китель_офицера', 'куртка_шерифа',
    'штаны_камуфляж', 'штаны_чёрные', 'штаны_белые',
    'штаны_ночные', 'галифе_офицера', 'джинсы_шерифа'
  ]);
  ['ownedHeads', 'ownedShoes', 'ownedTorsos', 'ownedPants'].forEach(k => {
    if (Array.isArray(gameState[k])) gameState[k] = gameState[k].filter(x => KEEP_GEAR.has(x));
  });
  const eqFix = (v) => (v && KEEP_GEAR.has(v)) ? v : null;
  gameState.equippedHead = eqFix(gameState.equippedHead);
  gameState.equippedShoes = eqFix(gameState.equippedShoes);
  gameState.equippedTorso = eqFix(gameState.equippedTorso);
  gameState.equippedPants = eqFix(gameState.equippedPants);
  Object.values(gameState.wardrobe || {}).forEach(w => {
    if (!w || typeof w !== 'object') return;
    w.head = eqFix(w.head);
    w.shoes = eqFix(w.shoes);
    w.torso = eqFix(w.torso);
    w.pants = eqFix(w.pants);
  });
  saveGameState();
} catch (e) {}
// Чистка «надето без владения» (наследие старых версий: надетое не
// проверялось на покупку — в гардеробе горела зелёная ячейка «?»).
// Надетое обязано лежать в купленном, иначе снимаем. Легаси-зеркала
// чистим ДО сида гардероба, сам гардероб — после (он уже может хранить
// такое). Дальше такое состояние невозможно: клики только по купленному.
try {
  const ownedFor = (slot) => slot === 'head' ? (gameState.ownedHeads || [])
    : slot === 'shoes' ? (gameState.ownedShoes || [])
    : slot === 'torso' ? (gameState.ownedTorsos || [])
    : (gameState.ownedPants || []);
  const ownFix = (slot, v) => (v && ownedFor(slot).includes(v)) ? v : null;
  gameState.equippedHead = ownFix('head', gameState.equippedHead);
  gameState.equippedShoes = ownFix('shoes', gameState.equippedShoes);
  gameState.equippedTorso = ownFix('torso', gameState.equippedTorso);
  gameState.equippedPants = ownFix('pants', gameState.equippedPants);
  saveGameState();
} catch (e) {}
// Миграция гардероба по классам: старый общий наряд раздаём всем классам
// как стартовый (дальше каждый одевается отдельно), чтобы ничего не пропало.
try {
  if (!gameState.wardrobe || typeof gameState.wardrobe !== 'object') {
    const seed = {
      head: gameState.equippedHead || null,
      shoes: gameState.equippedShoes || null,
      torso: gameState.equippedTorso || null,
      pants: gameState.equippedPants || null
    };
    gameState.wardrobe = {
      Assault: Object.assign({}, seed),
      Tank: Object.assign({}, seed),
      Medic: Object.assign({}, seed),
      Sniper: Object.assign({}, seed)
    };
    saveGameState();
  }
} catch (e) {}
// Тот же ownFix для уже существующего гардероба по классам.
try {
  const ownedFor2 = (slot) => slot === 'head' ? (gameState.ownedHeads || [])
    : slot === 'shoes' ? (gameState.ownedShoes || [])
    : slot === 'torso' ? (gameState.ownedTorsos || [])
    : (gameState.ownedPants || []);
  Object.values(gameState.wardrobe || {}).forEach(w => {
    if (!w || typeof w !== 'object') return;
    if (w.head && !ownedFor2('head').includes(w.head)) w.head = null;
    if (w.shoes && !ownedFor2('shoes').includes(w.shoes)) w.shoes = null;
    if (w.torso && !ownedFor2('torso').includes(w.torso)) w.torso = null;
    if (w.pants && !ownedFor2('pants').includes(w.pants)) w.pants = null;
  });
  saveGameState();
} catch (e) {}
Object.keys(gameState.equipment || {}).forEach(cls => {
  const eq = gameState.equipment[cls];
  if (eq.primary === 'M4') eq.primary = null;
  if (eq.secondary === 'M4') eq.secondary = null;
  if (!('melee' in eq)) eq.melee = null;
});

if (!gameState.weaponSkins) {
  gameState.weaponSkins = [];
}
if (!gameState.skinOrigin || typeof gameState.skinOrigin !== 'object') {
  gameState.skinOrigin = {};
}
// genePoints/genes/geneUnlocked/weaponSkinDates уже в defaultState и
// подтягиваются merge при загрузке — заплатки не нужны.

if (gameState.campaignDifficulty !== 'novice' && gameState.campaignDifficulty !== 'veteran') {
  gameState.campaignDifficulty = 'experienced';
}
// Свободная игра знает и «Песочницу» (только она): не сбрасываем её в
// «Бывалый», иначе выбранная сложность не переживает перезагрузку.
if (!['novice', 'experienced', 'veteran', 'sandbox'].includes(gameState.freeDifficulty)) {
  gameState.freeDifficulty = 'experienced';
}
// Громкость: число 0..1, иначе 1 (битый сейв не глушит игру).
for (const k of ['musicVol', 'sfxVol']) {
  const v = +gameState[k];
  gameState[k] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

if (![15, 30, 45, 60].includes(gameState.scoreLimit)) {
  gameState.scoreLimit = 30;
}
if (![1, 3, 5, 7, 10].includes(gameState.ctfLimit)) {
  gameState.ctfLimit = 3;
}
if (typeof gameState.ctfSuddenStart !== 'boolean') gameState.ctfSuddenStart = false;
if (![1, 3, 5].includes(gameState.bombLimit)) {
  gameState.bombLimit = 3;
}
if (![100, 200, 300].includes(gameState.kothLimit)) {
  gameState.kothLimit = 200;
}
if (![2, 3, 4, 5, 6, 8].includes(gameState.botCount)) {
  gameState.botCount = 4;
}
// Боты по командам: целые 0–8; отсутствующие (старые сейвы) — из botCount.
for (const _bk of ['blueBots', 'redBots']) {
  let _bv = gameState[_bk];
  if (!Number.isInteger(_bv)) {
    _bv = [2, 3, 4, 5, 6, 8].includes(gameState.botCount) ? gameState.botCount : 5;
  }
  gameState[_bk] = Math.max(0, Math.min(8, _bv));
}
// Прицел: пересборка с проверками (старые сейвы без него + битые значения).
// Разрываем ссылку с defaultState, иначе правки потекут в дефолт.
try {
  const _ch = (gameState.crosshair && typeof gameState.crosshair === 'object') ? gameState.crosshair : {};
  // dot может быть старым boolean (true→2, false→0).
  let _dot = _ch.dot;
  if (_dot === true) _dot = 2;
  else if (_dot === false) _dot = 0;
  gameState.crosshair = {
    color: /^#[0-9a-fA-F]{6}$/.test(_ch.color || '') ? _ch.color : '#ccffcc',
    shape: ['circle', 'square', 'triangle', 'none'].includes(_ch.shape) ? _ch.shape : 'circle',
    size: [5, 6, 8, 10, 12, 14, 16].includes(_ch.size) ? _ch.size : 8,
    thick: [1, 1.5, 2, 2.5, 3, 4].includes(_ch.thick) ? _ch.thick : 2.5,
    arms: [0, 4, 6, 8, 10, 12, 14].includes(_ch.arms) ? _ch.arms : 8,
    dot: [0, 1, 1.5, 2, 2.5, 3, 4].includes(_dot) ? _dot : 2,
    dynamic: _ch.dynamic !== false
  };
} catch (e) {
  gameState.crosshair = { color: '#ccffcc', shape: 'circle', size: 8, thick: 2.5, arms: 8, dot: 2, dynamic: true };
}
if (typeof gameState.trialBestKills !== 'number') {
  gameState.trialBestKills = 0;
}
if (typeof gameState.trialBestTime !== 'number') {
  gameState.trialBestTime = 0;
}

if (!gameState.grenadeStock || typeof gameState.grenadeStock !== 'object') {
  gameState.grenadeStock = { frag: 0, smoke: 0 };
}
gameState.grenadeStock.frag = Math.max(0, Math.min(3, gameState.grenadeStock.frag | 0));
// Дымовые: макс. 2 (smokeMax в skills.js), не 3.
gameState.grenadeStock.smoke = Math.max(0, Math.min(2, gameState.grenadeStock.smoke | 0));

// Дерево прокачки: для старых сейвов выдаём очко за каждый уровень (начиная с 1-го)
if (!gameState.skills || typeof gameState.skills !== 'object' || gameState.skillsVersion !== 1) {
  gameState.skills = {};
  gameState.skillPoints = Math.max(0, ((gameState.level | 0) || 1) - 1);
  gameState.skillsVersion = 1;
  saveGameState();
}
if (!Number.isFinite(gameState.skillResets) || gameState.skillResets < 0) {
  gameState.skillResets = 0;
} else {
  gameState.skillResets = Math.floor(gameState.skillResets);
}

// Соц/стат-блок: showcase, ачивки, неделя, друзья/клан (меню v2).
if (!gameState.stats || typeof gameState.stats !== 'object') {
  gameState.stats = {
    kills: 0, deaths: 0, wins: 0, losses: 0, cases: 0, campaignWins: 0, coinsEarned: 0, flagsDelivered: 0,
    killsByClass: {}, timeByClass: {}, matchesByClass: {}, winsByClass: {}
  };
  saveGameState();
}
for (const k of ['kills', 'deaths', 'wins', 'losses', 'cases', 'campaignWins', 'coinsEarned', 'flagsDelivered']) {
  if (typeof gameState.stats[k] !== 'number') gameState.stats[k] = 0;
}
for (const k of ['killsByClass', 'timeByClass', 'matchesByClass', 'winsByClass']) {
  if (!gameState.stats[k] || typeof gameState.stats[k] !== 'object') gameState.stats[k] = {};
}
if (!Array.isArray(gameState.achievements)) gameState.achievements = [];
if (!Array.isArray(gameState.friends)) gameState.friends = [];
if (!Array.isArray(gameState.contractHistory)) gameState.contractHistory = [];
if (!Array.isArray(gameState.matchHistory)) gameState.matchHistory = [];
if (typeof gameState.onlineRating !== 'number' || !(gameState.onlineRating >= 0)) {
  gameState.onlineRating = 0;
}
for (const k of ['expWins', 'expLosses']) {
  if (typeof gameState[k] !== 'number' || !(gameState[k] >= 0)) gameState[k] = 0;
}
if (typeof gameState.demoMode !== 'boolean') gameState.demoMode = false;
if (typeof gameState.noAllies !== 'boolean') gameState.noAllies = false;
// weekly удалён (мёртвая система): валидации нет, старые сейвы
// с weekly-полем грузятся — поле игнорится allowlist-merge выше.
if (!gameState.pass || typeof gameState.pass !== 'object') {
  gameState.pass = { seasonId: '', premium: false, kills: 0, wins: 0, damage: 0, matches: 0, cases: 0, claimed: { n: {}, p: {} } };
}
if (!gameState.pass.claimed || typeof gameState.pass.claimed !== 'object') gameState.pass.claimed = { n: {}, p: {} };
if (!gameState.pass.claimed.n || typeof gameState.pass.claimed.n !== 'object') gameState.pass.claimed.n = {};
if (!gameState.pass.claimed.p || typeof gameState.pass.claimed.p !== 'object') gameState.pass.claimed.p = {};
['kills', 'wins', 'damage', 'matches', 'cases'].forEach(k => {
  if (typeof gameState.pass[k] !== 'number') gameState.pass[k] = 0;
});
if (typeof gameState.pass.premium !== 'boolean') gameState.pass.premium = false;

// weekly удалён (мёртвая система): currentWeekId/getWeekly убраны,
// читателей кроме валидации не было (проверено Grep).

// Баттл-пасс сезона (30 дней): прогресс и выдачи живут в gameState.pass.
// Новый сезон — чистые счётчики и награды, premium сгорает.
export function getPass() {
  const sid = 'S' + currentSeasonId();
  if (!gameState.pass || gameState.pass.seasonId !== sid) {
    gameState.pass = { seasonId: sid, premium: false, kills: 0, wins: 0, damage: 0, matches: 0, cases: 0, claimed: { n: {}, p: {} } };
    saveGameState();
  }
  return gameState.pass;
}

export function mostPlayedClass() {
  // Класс с наибольшим числом СЫГРАННЫХ БОЁВ (раньше было время в бою).
  // Старые сейвы без matchesByClass — по времени, как раньше.
  const st = gameState.stats || {};
  const mb = st.matchesByClass || {};
  let best = null;
  let bestV = -1;
  let hasMatches = false;
  Object.keys(mb).forEach(cls => {
    hasMatches = true;
    if ((mb[cls] | 0) > bestV) {
      bestV = mb[cls] | 0;
      best = cls;
    }
  });
  if (hasMatches && best) return best;
  const t = st.timeByClass || {};
  best = null;
  bestV = -1;
  Object.keys(t).forEach(cls => {
    if ((t[cls] | 0) > bestV) {
      bestV = t[cls] | 0;
      best = cls;
    }
  });
  return best || gameState.lastClass || 'Assault';
}

export function saveGameState() {
  try {
    localStorage.setItem('sideShooterState', JSON.stringify(gameState));
  } catch (e) {
    /* ignore */
  }
}

export function getEquipment(className) {
  if (!gameState.equipment[className]) {
    console.warn('[gameState] getEquipment: неизвестный класс', className);
    gameState.equipment[className] = { primary: null, secondary: null, melee: null };
  }
  if (!('melee' in gameState.equipment[className])) gameState.equipment[className].melee = null;
  return gameState.equipment[className];
}

const EQUIP_SLOTS = ['primary', 'secondary', 'melee'];

export function setEquippedWeapon(className, slot, weaponName) {
  if (!EQUIP_SLOTS.includes(slot)) {
    console.warn('[gameState] setEquippedWeapon: неизвестный слот', slot);
    return;
  }
  const eq = getEquipment(className);
  eq[slot] = weaponName;
  saveGameState();
}

export function addExperience(amount) {
  amount = Number.isFinite(+amount) ? Math.max(0, +amount) : 0;
  if (!Number.isFinite(+gameState.level) || gameState.level < 1) gameState.level = 1;
  if (!Number.isFinite(+gameState.experience) || gameState.experience < 0) gameState.experience = 0;
  gameState.experience += amount;

  // Прокачка за ~месяц активной игры: первые уровни как раньше
  // (250/1000/2250 — не за 5 минут), дальше почти плоская линейка
  // +25 за уровень. Всё дерево навыков (55 очков, 56 уровень) = ~155000
  // опыта ≈ 60–80 часов игры (месяц по ~2–2.5 ч в день).
  while (gameState.experience >= expRequired(gameState.level)) {
    gameState.experience -= expRequired(gameState.level);
    gameState.level += 1;
    gameState.skillPoints = (gameState.skillPoints || 0) + 1;
  }

  saveGameState();
}

// Опыта до следующего уровня с текущего (единая формула для всех мест).
// Старт крутой (первые уровни надо заработать), дальше полка +25/уровень.
export function expRequired(level) {
  const l = Math.max(1, Math.floor(+level) || 1);
  if (l <= 3) return 250 * l * l;
  return 2250 + (l - 3) * 25;
}

export function addCoins(amount) {
  amount = Number(amount);
  if (!Number.isFinite(amount)) return;
  amount = Math.floor(amount);
  gameState.coins += amount;
  if (amount > 0 && gameState.stats) {
    gameState.stats.coinsEarned = (gameState.stats.coinsEarned | 0) + amount;
  }
  saveGameState();
}

export function unlockWeapon(name) {
  if (!gameState.unlockedWeapons.includes(name)) {
    gameState.unlockedWeapons.push(name);
    saveGameState();
  }
}

export function hasWeapon(name) {
  return gameState.unlockedWeapons.includes(name);
}

export function unlockSkin(id) {
  if (!gameState.weaponSkins.includes(id)) {
    gameState.weaponSkins.push(id);
    // Дата получения для сортировки «по новизне» в инвентаре.
    gameState.weaponSkinDates = gameState.weaponSkinDates || {};
    gameState.weaponSkinDates[id] = Date.now();
    saveGameState();
  }
}

export function hasSkin(id) {
  return gameState.weaponSkins.includes(id);
}

export function unlockHead(tex) {
  if (!gameState.ownedHeads) gameState.ownedHeads = [];
  if (!gameState.ownedHeads.includes(tex)) {
    gameState.ownedHeads.push(tex);
    saveGameState();
  }
}

export function hasHead(tex) {
  return (gameState.ownedHeads || []).includes(tex);
}

export function equipHead(tex, cls) {
  _wardrobeSet('head', tex, cls);
  gameState.equippedHead = tex;
  saveGameState();
}

export function getEquippedHead(cls) {
  return _wardrobeGet('head', gameState.equippedHead, cls);
}

// --- Гардероб по классам: механика (купленное общее, надето у каждого своё).
// cls: 'Assault'|'Tank'|'Medic'|'Sniper', по умолчанию — последний класс игрока.
const WARDROBE_CLASSES = ['Assault', 'Tank', 'Medic', 'Sniper'];
function _wardrobeCls(cls) {
  if (WARDROBE_CLASSES.includes(cls)) return cls;
  if (WARDROBE_CLASSES.includes(gameState.lastClass)) return gameState.lastClass;
  return 'Assault';
}
function _wardrobeEnsure() {
  if (!gameState.wardrobe || typeof gameState.wardrobe !== 'object') gameState.wardrobe = {};
  WARDROBE_CLASSES.forEach(c => {
    if (!gameState.wardrobe[c] || typeof gameState.wardrobe[c] !== 'object') {
      gameState.wardrobe[c] = { head: null, shoes: null, torso: null, pants: null };
    }
  });
  return gameState.wardrobe;
}
function _wardrobeGet(slot, legacy, cls) {
  try {
    _wardrobeEnsure();
    const v = gameState.wardrobe[_wardrobeCls(cls)];
    if (v && v[slot] != null) return v[slot];
  } catch (e) {}
  return legacy || null;
}
function _wardrobeSet(slot, tex, cls) {
  try {
    _wardrobeEnsure();
    gameState.wardrobe[_wardrobeCls(cls)][slot] = tex;
  } catch (e) {}
}

// Обувь для внешности (вторая полка гардероба): те же правила, что у голов.
export function unlockShoes(tex) {
  if (!gameState.ownedShoes) gameState.ownedShoes = [];
  if (!gameState.ownedShoes.includes(tex)) {
    gameState.ownedShoes.push(tex);
    saveGameState();
  }
}

export function hasShoes(tex) {
  return (gameState.ownedShoes || []).includes(tex);
}

export function equipShoes(tex, cls) {
  _wardrobeSet('shoes', tex, cls);
  gameState.equippedShoes = tex;
  saveGameState();
}

export function getEquippedShoes(cls) {
  return _wardrobeGet('shoes', gameState.equippedShoes, cls);
}

// Торс для внешности (третья полка гардероба): те же правила, что у голов.
export function unlockTorso(tex) {
  if (!gameState.ownedTorsos) gameState.ownedTorsos = [];
  if (!gameState.ownedTorsos.includes(tex)) {
    gameState.ownedTorsos.push(tex);
    saveGameState();
  }
}

export function hasTorso(tex) {
  return (gameState.ownedTorsos || []).includes(tex);
}

export function equipTorso(tex, cls) {
  _wardrobeSet('torso', tex, cls);
  gameState.equippedTorso = tex;
  saveGameState();
}

export function getEquippedTorso(cls) {
  return _wardrobeGet('torso', gameState.equippedTorso, cls);
}

// Штаны для внешности (четвёртая полка гардероба): те же правила.
export function unlockPants(tex) {
  if (!gameState.ownedPants) gameState.ownedPants = [];
  if (!gameState.ownedPants.includes(tex)) {
    gameState.ownedPants.push(tex);
    saveGameState();
  }
}

export function hasPants(tex) {
  return (gameState.ownedPants || []).includes(tex);
}

export function equipPants(tex, cls) {
  _wardrobeSet('pants', tex, cls);
  gameState.equippedPants = tex;
  saveGameState();
}

export function getEquippedPants(cls) {
  return _wardrobeGet('pants', gameState.equippedPants, cls);
}

export function advanceCampaignLevel() {
  gameState.campaignLevel += 1;
  saveGameState();
}

// Сброс кампании для перепроверки миссий: только указатель уровня,
// остальной прогресс (опыт, скины, ачивки) не трогаем.
export function resetCampaign() {
  gameState.campaignLevel = 1;
  saveGameState();
}

export function renamePlayer(name) {
  gameState.playerName = (name || '').trim().slice(0, 16) || 'Игрок';
  saveGameState();
}

export function setTrialRecord(kills, timeSec) {
  let newBest = false;
  if (kills > gameState.trialBestKills) {
    gameState.trialBestKills = kills;
    newBest = true;
  }
  if (timeSec > gameState.trialBestTime) {
    gameState.trialBestTime = timeSec;
    newBest = true;
  }
  if (newBest) saveGameState();
  return newBest;
}

export function getCharacterColors() {
  return {
    head: parseInt(String(gameState.playerHeadColor || '#ffe0c8').replace('#', ''), 16),
    body: parseInt(String(gameState.playerBodyColor || '#44ccff').replace('#', ''), 16)
  };
}

export function setCharacterColor(part, value) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
  if (!hex) return;
  if (part === 'head') {
    gameState.playerHeadColor = hex;
  } else if (part === 'body') {
    gameState.playerBodyColor = hex;
  }
  saveGameState();
}

export function resetProgress() {
  Object.keys(gameState).forEach(key => delete gameState[key]);
  Object.assign(gameState, JSON.parse(JSON.stringify(defaultState)));
  // ПОЛНЫЙ реинит defaultState: stats/pass в дефолте — null, сразу даём
  // живые объекты, иначе до перезагрузки падает доступ к статистике/пассу.
  // Остальное (genes, medals, gang/turf, daily*, wardrobe и т.д.) уже
  // приехало свежей deep-копией defaultState выше.
  gameState.stats = {
    kills: 0, deaths: 0, wins: 0, losses: 0, cases: 0, campaignWins: 0, coinsEarned: 0, flagsDelivered: 0,
    killsByClass: {}, timeByClass: {}, matchesByClass: {}, winsByClass: {}
  };
  gameState.pass = { seasonId: '', premium: false, kills: 0, wins: 0, damage: 0, matches: 0, cases: 0, claimed: { n: {}, p: {} } };
  saveGameState();
}
