import { gameState } from './gameState.js?v=171';

export const classAbilities = {
  Assault: {
    id: 'Assault',
    name: 'Берсерк',
    unlockLevel: 4,
    cooldown: 50000,
    duration: 10000,
    key: 'X',
    desc: '×2 темп стрельбы, −50% входящего урона, бесконечные патроны (10 с)'
  },
  Tank: {
    id: 'Tank',
    name: 'Неприступный',
    unlockLevel: 5,
    cooldown: 55000,
    duration: 8000,
    key: 'X',
    desc: '−70% входящего урона, +25% урона, +40% скорости (8 с)'
  },
  Medic: {
    id: 'Medic',
    name: 'Полевой госпиталь',
    unlockLevel: 3,
    cooldown: 45000,
    duration: 8000,
    key: 'X',
    desc: 'Восстанавливает здоровье себе и союзникам в радиусе 200 (8 с)'
  },
  Sniper: {
    id: 'Sniper',
    name: 'Меткий глаз',
    unlockLevel: 5,
    cooldown: 50000,
    duration: 10000,
    key: 'X',
    desc: '×2 урон и в 5 раз точнее (10 с)'
  }
};

export function getClassAbility(className) {
  return classAbilities[className] || null;
}

export function ultUnlocked(className) {
  const ab = classAbilities[className];
  return ab ? gameState.level >= ab.unlockLevel : false;
}