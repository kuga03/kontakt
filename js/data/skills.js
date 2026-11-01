import { gameState, saveGameState } from './gameState.js?v=171';

// Дерево прокачки: 12 навыков на 95 очков (полное закрытие — 96 уровень).
// Ядро — по 9 уровней, гранаты как были: осколочные 3, дымовые 2
// (финалы не менялись — гранат больше не стало).
// Шаг слабее, чем был при 5 уровнях, а ФИНАЛЫ ТЕ ЖЕ: суммарный бонус
// максимума не изменился (сила 9 × слабый шаг = сила 5 × старый шаг).
// mods: { add: N } — прибавка за уровень, { mult: N } — множитель за уровень.
// Гранаты (frag/smoke) — без mods: лимит ношения = уровень навыка,
// сток на бой/возрождение выдаётся по нему (см. fragMax/smokeMax).
export const skillDefinitions = {
  vitality: {
    tier: 1, name: 'Живучесть', maxLevel: 9, prereq: null,
    desc: '+5.6 макс. здоровья за уровень (макс. +50)',
    mods: { maxHp: { add: 50 / 9 } }
  },
  reload: {
    tier: 1, name: 'Разгрузка', maxLevel: 9, prereq: null,
    desc: 'перезарядка на 4.5% быстрее за уровень',
    mods: { reloadMult: { mult: 0.954733 } }
  },
  ammo: {
    tier: 1, name: 'Боекомплект', maxLevel: 9, prereq: null,
    // Ёмкость, а не «магазин»: у трубок (дробовики, обрез, револьвер…)
    // растёт сама трубка + запас (запас = 2 ёмкости, см. addWeapon).
    desc: '+8% боезапаса за уровень (ёмкость + запас)',
    mods: { ammoMult: { mult: 1.08 } }
  },
  sprint: {
    tier: 1, name: 'Марш-бросок', maxLevel: 9, prereq: null,
    desc: '+2.8% к скорости бега за уровень (макс. +25%)',
    mods: { moveSpeedPct: { add: 25 / 9 } }
  },

  armor: {
    tier: 2, name: 'Бронежилет', maxLevel: 9, prereq: 'vitality',
    desc: '+4.4 макс. брони за уровень (макс. +40)',
    mods: { maxArmor: { add: 40 / 9 } }
  },
  medic: {
    tier: 2, name: 'Медик', maxLevel: 9, prereq: 'vitality',
    desc: 'аптечки лечат на 8.1% больше за уровень',
    mods: { healMult: { mult: 1.080739 } }
  },
  assault: {
    tier: 2, name: 'Штурмовик', maxLevel: 9, prereq: 'reload',
    desc: '+3.3% урона за уровень',
    mods: { damageMult: { mult: 1.032901 } }
  },
  accuracy: {
    tier: 2, name: 'Меткость', maxLevel: 9, prereq: 'sprint',
    desc: 'разброс на 5.7% меньше за уровень',
    mods: { spreadMult: { mult: 0.943147 } }
  },

  regen: {
    tier: 3, name: 'Регенерация', maxLevel: 9, prereq: 'medic',
    desc: '+0.56 HP/сек за уровень (макс. +5)',
    mods: { regen: { add: 5 / 9 } }
  },
  headshot: {
    tier: 3, name: 'Снайперский глаз', maxLevel: 9, prereq: 'assault',
    desc: '+5.4% урона по голове за уровень',
    mods: { headshotMult: { mult: 1.054377 } }
  },

  frag: {
    tier: 1, name: 'Осколочные гранаты', maxLevel: 3, prereq: null,
    desc: '+1 осколочная с собой',
    mods: {}
  },
  smoke: {
    tier: 1, name: 'Дымовая завеса', maxLevel: 2, prereq: null,
    desc: '+1 дымовая с собой',
    mods: {}
  }
};

export const SKILL_ORDER = Object.keys(skillDefinitions);

// Вход по уровню игрока (гейт снаружи, поверх дерева): тир 1 — с 1,
// тир 2 — с 5, тир 3 (реген/снайперский глаз) — с 15. За 1 очко в предскилл
// глубину больше не открыть — нужен ещё и уровень.
const TIER_LEVEL = { 1: 1, 2: 5, 3: 15 };

export function reqLevel(id) {
  const def = skillDefinitions[id];
  if (!def) return 1;
  if (Number.isFinite(def.reqLevel)) return def.reqLevel;
  return TIER_LEVEL[def.tier] || 1;
}

export function levelMet(id) {
  return (gameState.level || 1) >= reqLevel(id);
}

export function getSkillLevel(id) {
  return (gameState.skills && gameState.skills[id]) || 0;
}

// Лимит ношения гранат = уровень навыка (без навыка — 0, с собой не берём).
export function fragMax() {
  return Math.min(3, getSkillLevel('frag') | 0);
}

export function smokeMax() {
  return Math.min(2, getSkillLevel('smoke') | 0);
}

export function skillPoints() {
  return Math.max(0, (gameState.skillPoints | 0) || 0);
}

export function prereqMet(id) {
  const def = skillDefinitions[id];
  if (!def || !def.prereq) return true;
  return getSkillLevel(def.prereq) >= 1;
}

export function canLearn(id) {
  const def = skillDefinitions[id];
  if (!def) return false;
  if (getSkillLevel(id) >= def.maxLevel) return false;
  if (skillPoints() <= 0) return false;
  if (!levelMet(id)) return false;
  if (!prereqMet(id)) return false;
  return true;
}

export function learnSkill(id) {
  if (!canLearn(id)) return false;
  gameState.skills = gameState.skills || {};
  gameState.skills[id] = (gameState.skills[id] || 0) + 1;
  gameState.skillPoints = Math.max(0, gameState.skillPoints - 1);
  saveGameState();
  return true;
}

// Сброс навыков: очки возвращаются в пул. Тариф по номеру сброса:
// 1-й бесплатно, 2-й — 5000, 3-й — 100000, дальше нельзя.
const SKILL_RESET_COSTS = [0, 5000, 100000];

function skillResetsUsed() {
  return Math.max(0, (gameState.skillResets | 0) || 0);
}

// Цена следующего сброса (первые три по тарифу, дальше — бесконечно по 100 000).
export function skillResetCost() {
  const n = skillResetsUsed();
  if (n >= SKILL_RESET_COSTS.length) return SKILL_RESET_COSTS[SKILL_RESET_COSTS.length - 1];
  return SKILL_RESET_COSTS[n];
}

export function resetSkills() {
  const cost = skillResetCost();
  if (cost == null) return { ok: false, reason: 'limit' };
  let back = 0;
  Object.keys(skillDefinitions).forEach(id => {
    back += getSkillLevel(id) || 0;
  });
  // Вкладывать нечего — счётчик не тратим.
  if (back <= 0) return { ok: false, reason: 'empty' };
  if (cost > 0) {
    if ((gameState.coins | 0) < cost) return { ok: false, reason: 'coins' };
    gameState.coins = (gameState.coins | 0) - cost;
  }
  gameState.skills = {};
  gameState.skillPoints = (gameState.skillPoints | 0) + back;
  gameState.skillResets = skillResetsUsed() + 1;
  saveGameState();
  return { ok: true, cost, back };
}

export function totalSkillMods() {
  const out = {};
  Object.keys(skillDefinitions).forEach(id => {
    const lvl = getSkillLevel(id);
    if (!lvl) return;
    const def = skillDefinitions[id];
    Object.keys(def.mods).forEach(key => {
      const m = def.mods[key];
      if (m.add != null) {
        out[key] = (out[key] || 0) + m.add * lvl;
      } else if (m.mult != null) {
        out[key] = (out[key] == null ? 1 : out[key]) * Math.pow(m.mult, lvl);
      }
    });
  });
  return out;
}
