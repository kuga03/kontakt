// Баттл-пасс «Контракты»: 40 ярусов, два ряда наград (обычный + premium),
// задания идут строго по порядку. Сезон — 30 дней, затем всё сбрасывается.
// Прогресс — счётчики gameState.pass (растут в боях, см. getPass).
// Награды — монеты; константы экономики (легко крутить):
// PASS_PREMIUM_PRICE — цена premium на сезон.

export const PASS_TIERS = 40;
const PASS_DAYS = 30;
export const PASS_PREMIUM_PRICE = 150000;

const DAY_MS = 86400000;

// Пороги по типам (8 квестов каждого на 40 ярусов, темп ~ старого
// недельного: ~8000 фрагов / ~90 боёв за сезон активной игры).
const NEEDS = {
  kills:   [100, 250, 450, 700, 1000, 1350, 1750, 2200],
  damage:  [3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000],
  matches: [2, 4, 6, 9, 12, 15, 19, 23],
  wins:    [1, 2, 3, 4, 6, 8, 10, 13],
  cases:   [1, 1, 1, 2, 2, 2, 3, 3]
};

const ORDER = ['kills', 'damage', 'matches', 'wins', 'cases'];

const NAMES = {
  kills: need => `Фраги: ${need}`,
  damage: need => `Урон: ${need}`,
  matches: need => `Бои: ${need}`,
  wins: need => `Победы: ${need}`,
  cases: need => `Кейсы: ${need}`
};

// Обычная награда яруса i (1..40): 300 → 7900, всего ~164к за сезон
// (старые недельки давали ~134к/мес — темп сохранён).
function passRewardNormal(i) {
  return Math.round((100 + 195 * i) / 50) * 50;
}

// Premium-награда: ~1.5x обычной, всего ~246к за сезон.
// Выше нельзя — иначе premium печатает деньги (было 2.5x).
function passRewardPremium(i) {
  return Math.round((150 + 293 * i) / 50) * 50;
}

// Полный список квестов сезона (детерминирован — одинаков у всех).
export const PASS_QUESTS = (() => {
  const seen = { kills: 0, damage: 0, matches: 0, wins: 0, cases: 0 };
  const out = [];
  for (let i = 1; i <= PASS_TIERS; i++) {
    const type = ORDER[(i - 1) % ORDER.length];
    const k = seen[type]++;
    out.push({
      tier: i,
      type,
      need: NEEDS[type][k],
      name: NAMES[type](NEEDS[type][k]),
      reward: passRewardNormal(i),
      rewardP: passRewardPremium(i)
    });
  }
  return out;
})();

// id сезона: эпохи по 30 дней. daysLeft — остаток дней (1..30).
export function currentSeasonId(nowMs) {
  const t = Number.isFinite(nowMs) ? nowMs : Date.now();
  return Math.floor(t / (PASS_DAYS * DAY_MS));
}

export function passDaysLeft(nowMs) {
  const t = Number.isFinite(nowMs) ? nowMs : Date.now();
  const start = currentSeasonId(t) * PASS_DAYS * DAY_MS;
  return Math.max(1, PASS_DAYS - Math.floor((t - start) / DAY_MS));
}

export function passEndDate(nowMs) {
  try {
    const end = (currentSeasonId(nowMs) + 1) * PASS_DAYS * DAY_MS;
    return new Date(end).toLocaleDateString('ru-RU');
  } catch (e) {
    return '';
  }
}

// Прогресс квеста по счётчикам пасса.
export function passQuestProgress(ps, q) {
  if (!q) return 0;
  return Math.min(q.need, ((ps && ps[q.type]) | 0));
}

// Ярус открыт, если все предыдущие ЗАБРАНЫ (строгая поочерёдность).
// track: 'n' (обычный) | 'p' (premium).
export function passTierUnlocked(ps, track, i) {
  if (i <= 1) return true;
  const cl = (ps && ps.claimed && ps.claimed[track]) || {};
  for (let k = 1; k < i; k++) {
    if (!cl[k]) return false;
  }
  return true;
}

function passTierDone(ps, i) {
  const q = PASS_QUESTS[i - 1];
  return !!q && passQuestProgress(ps, q) >= q.need;
}

// Сколько обычных наград забрано (счётчик для меню: n/40).
export function passClaimedCount(ps) {
  const cl = (ps && ps.claimed && ps.claimed.n) || {};
  let n = 0;
  for (let i = 1; i <= PASS_TIERS; i++) if (cl[i]) n++;
  return n;
}

// Есть ли готовое к выдаче (с учётом premium-флага) — подсветка кнопки.
export function passHasUnclaimed(ps) {
  const premium = !!(ps && ps.premium);
  for (let i = 1; i <= PASS_TIERS; i++) {
    if (!passTierDone(ps, i)) continue;
    const cl = (ps && ps.claimed) || {};
    if (passTierUnlocked(ps, 'n', i) && !(cl.n || {})[i]) return true;
    if (premium && passTierUnlocked(ps, 'p', i) && !(cl.p || {})[i]) return true;
  }
  return false;
}

// Первый ярус, требующий внимания (для автоскролла при открытии).
export function passActiveTier(ps) {
  for (let i = 1; i <= PASS_TIERS; i++) {
    const cl = (ps && ps.claimed) || {};
    if (!(cl.n || {})[i]) return i;
  }
  return PASS_TIERS;
}
