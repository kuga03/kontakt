// Баттл-пасс «Контракты»: 40 ярусов, два ряда наград (обычный + premium),
// задания идут строго по порядку. Сезон — 30 дней, затем всё сбрасывается.
// Прогресс — счётчики gameState.pass (растут в боях, см. getPass).
// Награды — монеты; константы экономики (легко крутить):
// PASS_PREMIUM_PRICE — цена premium на сезон.

export const PASS_TIERS = 40;
const PASS_DAYS = 30;
export const PASS_PREMIUM_PRICE = 150000;

const DAY_MS = 86400000;

// Облегчённые пороги по типам (8 квестов каждого на 40 ярусов).
// Задания выполняются последовательно: 1-2 катки на квест, плавный рост.
const NEEDS = {
  kills:   [10, 15, 20, 25, 30, 35, 40, 50],
  damage:  [1500, 2500, 3500, 5000, 6500, 8000, 10000, 12000],
  matches: [1, 2, 2, 3, 3, 4, 4, 5],
  wins:    [1, 1, 2, 2, 2, 3, 3, 4],
  cases:   [1, 1, 1, 1, 1, 2, 2, 2]
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
function passRewardNormal(i) {
  return Math.round((100 + 195 * i) / 50) * 50;
}

// Premium-награда: ~1.5x обычной, всего ~246к за сезон.
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

// Инициализация пошагового прогресса ярусов в gameState.pass
export function initTierProgress(ps) {
  if (!ps) return;
  if (!ps.tierProgress || typeof ps.tierProgress !== 'object') {
    ps.tierProgress = {};
  }
  const cl = (ps.claimed && ps.claimed.n) || {};
  for (let i = 1; i <= PASS_TIERS; i++) {
    if (cl[i]) {
      ps.tierProgress[i] = PASS_QUESTS[i - 1].need;
    }
  }
  for (let i = 1; i <= PASS_TIERS; i++) {
    if (!passTierDone(ps, i)) {
      if (ps.tierProgress[i] === undefined) {
        const q = PASS_QUESTS[i - 1];
        if (i === 1 && q) {
          ps.tierProgress[i] = Math.min(q.need, Math.max(0, (ps[q.type] | 0)));
        } else {
          ps.tierProgress[i] = 0;
        }
      }
      break;
    }
  }
}

// Выполнен ли ярус: строго последовательно (предыдущий ОБЯЗАН быть выполнен).
export function passTierDone(ps, i) {
  if (!ps || i < 1 || i > PASS_TIERS) return false;
  const cl = (ps.claimed && ps.claimed.n) || {};
  if (cl[i]) return true;
  if (i > 1 && !passTierDone(ps, i - 1)) return false;
  const q = PASS_QUESTS[i - 1];
  if (!q) return false;
  const cur = (ps.tierProgress && typeof ps.tierProgress[i] === 'number')
    ? ps.tierProgress[i]
    : (i === 1 ? Math.min(q.need, Math.max(0, (ps[q.type] | 0))) : 0);
  return cur >= q.need;
}

// Задание яруса открыто для выполнения (ярус 1 всегда, остальные — после завершения предыдущего).
export function passQuestUnlocked(ps, i) {
  if (i <= 1) return true;
  return passTierDone(ps, i - 1);
}

// Текущий активный ярус задания (первый не выполненный)
export function passActiveQuestTier(ps) {
  if (!ps) return 1;
  initTierProgress(ps);
  for (let i = 1; i <= PASS_TIERS; i++) {
    if (!passTierDone(ps, i)) return i;
  }
  return PASS_TIERS + 1;
}

// Прогресс квеста по счётчикам пасса.
export function passQuestProgress(ps, q) {
  if (!ps || !q) return 0;
  if (!ps.tierProgress || typeof ps.tierProgress !== 'object') {
    initTierProgress(ps);
  }
  const tp = ps.tierProgress && ps.tierProgress[q.tier];
  if (typeof tp === 'number') {
    return Math.min(q.need, Math.max(0, tp));
  }
  return 0;
}

// Запись прогресса в текущее активное задание
export function recordPassProgress(ps, type, amount = 1) {
  if (!ps || !type) return;
  ps[type] = (ps[type] | 0) + amount;
  initTierProgress(ps);
  const act = passActiveQuestTier(ps);
  if (act <= PASS_TIERS) {
    const q = PASS_QUESTS[act - 1];
    if (q && q.type === type) {
      const cur = (ps.tierProgress[act] | 0);
      ps.tierProgress[act] = Math.min(q.need, cur + amount);
    }
  }
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
