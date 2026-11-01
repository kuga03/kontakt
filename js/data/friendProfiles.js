// Профили для экрана «Друзья»: свой (из реального сейва) + чужие.
// Чужие пока мок: своего сервера нет, поэтому стата друга генерируется
// детерминированно по нику — один и тот же ник всегда даёт один профиль.
// Когда появится бэкенд/SDK — заменить mockFriendProfile() на запрос,
// интерфейс профиля уже зафиксирован и сцена не поменяется.

export const CLASS_IDS = ['Assault', 'Tank', 'Medic', 'Sniper'];
export const CLASS_LABELS = { Assault: 'Штурмовик', Tank: 'Танк', Medic: 'Медик', Sniper: 'Снайпер' };
const FAV_WEAPONS = ['AK-47', 'M249', 'UZI', 'SSG', 'Deagle', 'Remington', 'VKS', 'Сайга', 'SIG_SG_550', 'Benelli_M4'];
const HEAD_COLORS = ['#d49a6a', '#e8b88a', '#c88a5a', '#a06a3a', '#f0d0a8'];
const BODY_COLORS = ['#888888', '#44ccff', '#55aa55', '#cc5544', '#aa66cc', '#ddaa33'];

function hashStr(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }

// Мок-профиль друга по нику. Всегда одинаковый для одного ника.
export function mockFriendProfile(name, added) {
  const clean = String(name || 'Друг').slice(0, 16);
  const rnd = rng32(hashStr(clean.toLowerCase()));
  const level = 1 + Math.floor(rnd() * 55);
  const matches = 5 + Math.floor(rnd() * 600);
  const wins = Math.min(matches, Math.floor(matches * (0.3 + rnd() * 0.45)));
  const kills = Math.floor(matches * (3 + rnd() * 9));
  const deaths = Math.max(1, Math.floor(kills / (0.6 + rnd() * 1.6)));
  const rating = Math.floor(rnd() * 4500);
  const achievements = Math.floor(rnd() * 30);
  const cases = Math.floor(rnd() * 60);
  const campaignWins = Math.floor(rnd() * 12);
  // Раскладка по классам: веса суммой в матчи, винрейт у каждого свой.
  const w = CLASS_IDS.map(() => 0.1 + rnd());
  const wSum = w.reduce((a, b) => a + b, 0);
  const perClass = {};
  let fav = CLASS_IDS[0]; let favM = -1;
  CLASS_IDS.forEach((c, i) => {
    const m = Math.max(0, Math.round(matches * w[i] / wSum));
    const wr = 0.25 + rnd() * 0.5;
    const wn = Math.min(m, Math.round(m * wr));
    perClass[c] = { matches: m, wins: wn, kills: Math.floor(kills * w[i] / wSum) };
    if (m > favM) { favM = m; fav = c; }
  });
  const minsAgo = Math.floor(rnd() * 60 * 30); // до ~30ч
  const online = minsAgo < 15;
  return {
    name: clean,
    isSelf: false,
    isMock: true, // пометка «демо-данные до сети» — сцена показывает бейдж
    level,
    rating,
    matches, wins, losses: Math.max(0, matches - wins),
    kills, deaths,
    kd: deaths > 0 ? kills / deaths : kills,
    winrate: matches > 0 ? wins / matches : 0,
    favClass: fav,
    perClass,
    headColor: pick(rnd, HEAD_COLORS),
    bodyColor: pick(rnd, BODY_COLORS),
    favWeapon: pick(rnd, FAV_WEAPONS),
    winStreak: Math.floor(rnd() * 9),
    achievements, cases, campaignWins,
    clanTag: rnd() < 0.3 ? String(clean).slice(0, 3).toUpperCase() : null,
    online,
    lastSeenMin: minsAgo,
    addedAt: added || Date.now(),
    registeredDays: 30 + Math.floor(rnd() * 600)
  };
}

// Свой профиль — только реальные цифры из сейва, без выдумок.
export function buildSelfProfile(gameState, mostPlayedClassFn) {
  const st = (gameState && gameState.stats) || {};
  const matches = (st.wins | 0) + (st.losses | 0);
  const wins = st.wins | 0;
  let fav = 'Assault';
  try { fav = (typeof mostPlayedClassFn === 'function' ? mostPlayedClassFn() : gameState.lastClass) || 'Assault'; } catch (e) {}
  if (!CLASS_IDS.includes(fav)) fav = 'Assault';
  const mb = st.matchesByClass || {};
  const wb = st.winsByClass || {};
  const kb = st.killsByClass || {};
  const perClass = {};
  CLASS_IDS.forEach(c => {
    const m = mb[c] | 0; const wn = Math.min(m, wb[c] | 0);
    perClass[c] = { matches: m, wins: wn, kills: kb[c] | 0 };
  });
  return {
    name: String((gameState && gameState.playerName) || 'Игрок').slice(0, 16),
    isSelf: true,
    isMock: false,
    level: Math.max(1, gameState.level | 0 || 1),
    rating: Math.max(0, gameState.onlineRating | 0),
    matches, wins, losses: Math.max(0, matches - wins),
    kills: st.kills | 0, deaths: st.deaths | 0,
    kd: (st.deaths | 0) > 0 ? (st.kills | 0) / (st.deaths | 0) : (st.kills | 0),
    winrate: matches > 0 ? wins / matches : 0,
    favClass: fav,
    perClass,
    headColor: gameState.playerHeadColor || '#d49a6a',
    bodyColor: gameState.playerBodyColor || '#888888',
    favWeapon: guessFavWeapon(gameState),
    winStreak: 0, // серию пока не пишем в сейв — честно показываем «—»
    achievements: Array.isArray(gameState.achievements) ? gameState.achievements.length : 0,
    achievementsTotal: null, // сцена подставит ACHIEVEMENTS.length
    cases: st.cases | 0,
    campaignWins: st.campaignWins | 0,
    flags: st.flagsDelivered | 0,
    coinsEarned: st.coinsEarned | 0,
    clanTag: gameState.clan && gameState.clan.tag ? gameState.clan.tag : null,
    clanName: gameState.clan && gameState.clan.name ? gameState.clan.name : null,
    online: true,
    lastSeenMin: 0,
    addedAt: null,
    registeredDays: null
  };
}

function guessFavWeapon(gameState) {
  try {
    const eq = gameState.equipment && gameState.equipment[gameState.lastClass];
    if (eq && eq.primary) return eq.primary;
  } catch (e) {}
  return null; // ничего не надето — профиль честно покажет пустые руки
}

export function fmtPct(v) {
  if (!isFinite(v)) return '—';
  return Math.round(v * 100) + '%';
}

export function fmtLastSeen(p) {
  if (p.online) return 'в сети';
  const m = p.lastSeenMin | 0;
  if (m < 60) return `был(а) ${Math.max(1, m)} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `был(а) ${h} ч назад`;
  return `был(а) ${Math.floor(h / 24)} дн назад`;
}
