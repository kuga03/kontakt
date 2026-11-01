import { gameState, saveGameState } from './gameState.js?v=171';

// Геном: 2 ветки улучшений за очки генома (только из легендарных контрактов).
// Названия простые, бонусы умеренные — через те же модификаторы, что навыки.
// Формат mods как в skills.js: { add: N } — прибавка, { mult: N } — множитель.
export const geneDefinitions = {
  second_wind: {
    branch: 'adrenaline', name: 'Второе дыхание', maxLevel: 3, prereq: null,
    desc: '+25 макс. здоровья за уровень',
    mods: { maxHp: { add: 25 } }
  },
  hot_blood: {
    branch: 'adrenaline', name: 'Горячая кровь', maxLevel: 3, prereq: 'second_wind',
    desc: '+1 HP/сек регенерации за уровень',
    mods: { regen: { add: 1 } }
  },
  light_legs: {
    branch: 'adrenaline', name: 'Лёгкие ноги', maxLevel: 3, prereq: null,
    desc: '+4% к скорости бега за уровень',
    mods: { moveSpeedPct: { add: 4 } }
  },
  tough_skin: {
    branch: 'adrenaline', name: 'Жесткая кожа', maxLevel: 3, prereq: 'second_wind',
    desc: '+15 макс. брони за уровень',
    mods: { maxArmor: { add: 15 } }
  },
  sharp_eye: {
    branch: 'hunter', name: 'Зоркий глаз', maxLevel: 3, prereq: null,
    desc: '+15% урона по голове за уровень',
    mods: { headshotMult: { mult: 1.15 } }
  },
  steady_hand: {
    branch: 'hunter', name: 'Твёрдая рука', maxLevel: 3, prereq: null,
    desc: 'разброс на 7% меньше за уровень',
    mods: { spreadMult: { mult: 0.93 } }
  },
  far_shot: {
    branch: 'hunter', name: 'Дальний выстрел', maxLevel: 3, prereq: 'sharp_eye',
    desc: '+8% к дальности за уровень',
    mods: { rangeMult: { mult: 1.08 } }
  }
};

export const GENE_ORDER = Object.keys(geneDefinitions);

export const GENE_BRANCHES = [
  { id: 'adrenaline', name: 'Адреналин', color: '#ff6655', desc: 'Живучесть: здоровье, реген, скорость, броня' },
  { id: 'hunter', name: 'Охотник', color: '#66ccff', desc: 'Точность: хедшоты, кучность, дальность' }
];

export function getGeneLevel(id) {
  return (gameState.genes && gameState.genes[id]) || 0;
}

export function genePoints() {
  return Math.max(0, (gameState.genePoints | 0) || 0);
}

export function genePrereqMet(id) {
  const def = geneDefinitions[id];
  if (!def || !def.prereq) return true;
  return getGeneLevel(def.prereq) >= 1;
}

export function canLearnGene(id) {
  const def = geneDefinitions[id];
  if (!def) return false;
  if (getGeneLevel(id) >= def.maxLevel) return false;
  if (genePoints() <= 0) return false;
  if (!genePrereqMet(id)) return false;
  return true;
}

export function learnGene(id) {
  if (!canLearnGene(id)) return false;
  gameState.genes = gameState.genes || {};
  gameState.genes[id] = (gameState.genes[id] || 0) + 1;
  gameState.genePoints = Math.max(0, gameState.genePoints - 1);
  saveGameState();
  return true;
}

// Всё дерево прокачано в максимум: очки генома больше некуда тратить —
// обмен скинов на новые очки запрещаем (см. контракт в InventoryScene).
export function isGenomeMaxed() {
  try {
    return GENE_ORDER.every(id => getGeneLevel(id) >= (geneDefinitions[id].maxLevel || 0));
  } catch (e) { return false; }
}

function totalGeneMods() {
  const out = {};
  Object.keys(geneDefinitions).forEach(id => {
    const lvl = getGeneLevel(id);
    if (!lvl) return;
    const def = geneDefinitions[id];
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

// Слияние модов генов в общие (add — сумма, mult — произведение).
export function mergeGeneMods(m) {
  const g = totalGeneMods();
  Object.keys(g).forEach(key => {
    if (typeof g[key] !== 'number') return;
    if (key === 'ammoMult') return;
    const isMult = key.endsWith('Mult') || key === 'regen';
    if (key === 'regen') {
      m[key] = (m[key] || 0) + g[key];
    } else if (isMult) {
      m[key] = (m[key] == null ? 1 : m[key]) * g[key];
    } else {
      m[key] = (m[key] || 0) + g[key];
    }
  });
  return m;
}
