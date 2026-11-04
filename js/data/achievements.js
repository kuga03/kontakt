import { gameState, addCoins, saveGameState } from './gameState.js';

// Достижения тирами (меню v2): gameState.achievements = ЗАБРАННЫЕ награды.
// Выполненное, но незабранное — светится в меню, забирается кнопкой
// «Получить» в сцене достижений. Старые авто-выдачи уже в списке = забраны.
export const ACHIEVEMENTS = [
  { id: 'fighter_1', name: 'Боец I', desc: 'Убей 10 врагов', reward: 200,
    progress: s => [Math.min(10, s.kills | 0), 10] },
  { id: 'fighter_2', name: 'Боец II', desc: 'Убей 50 врагов', reward: 500,
    progress: s => [Math.min(50, s.kills | 0), 50] },
  { id: 'fighter_3', name: 'Боец III', desc: 'Убей 100 врагов', reward: 1000,
    progress: s => [Math.min(100, s.kills | 0), 100] },
  { id: 'fighter_4', name: 'Боец IV', desc: 'Убей 500 врагов', reward: 2500,
    progress: s => [Math.min(500, s.kills | 0), 500] },
  { id: 'fighter_5', name: 'Боец V', desc: 'Убей 1000 врагов', reward: 5000,
    progress: s => [Math.min(1000, s.kills | 0), 1000] },
  { id: 'sniper_1', name: 'Тихая смерть I', desc: '25 фрагов за снайпера', reward: 600,
    progress: s => [Math.min(25, (s.killsByClass || {}).Sniper | 0), 25] },
  { id: 'sniper_2', name: 'Тихая смерть II', desc: '100 фрагов за снайпера', reward: 2000,
    progress: s => [Math.min(100, (s.killsByClass || {}).Sniper | 0), 100] },
  { id: 'sniper_3', name: 'Тихая смерть III', desc: '250 фрагов за снайпера', reward: 5000,
    progress: s => [Math.min(250, (s.killsByClass || {}).Sniper | 0), 250] },
  { id: 'assault_1', name: 'Штурмовик I', desc: '50 фрагов за штурмовика', reward: 700,
    progress: s => [Math.min(50, (s.killsByClass || {}).Assault | 0), 50] },
  { id: 'assault_2', name: 'Штурмовик II', desc: '300 фрагов за штурмовика', reward: 2500,
    progress: s => [Math.min(300, (s.killsByClass || {}).Assault | 0), 300] },
  { id: 'assault_3', name: 'Штурмовик III', desc: '1000 фрагов за штурмовика', reward: 8000,
    progress: s => [Math.min(1000, (s.killsByClass || {}).Assault | 0), 1000] },
  { id: 'tank_1', name: 'Броня I', desc: '50 фрагов за танка', reward: 700,
    progress: s => [Math.min(50, (s.killsByClass || {}).Tank | 0), 50] },
  { id: 'tank_2', name: 'Броня II', desc: '300 фрагов за танка', reward: 2500,
    progress: s => [Math.min(300, (s.killsByClass || {}).Tank | 0), 300] },
  { id: 'medic_1', name: 'Санитар I', desc: '50 фрагов за медика', reward: 700,
    progress: s => [Math.min(50, (s.killsByClass || {}).Medic | 0), 50] },
  { id: 'medic_2', name: 'Санитар II', desc: '300 фрагов за медика', reward: 2500,
    progress: s => [Math.min(300, (s.killsByClass || {}).Medic | 0), 300] },
  { id: 'winner_1', name: 'Победитель I', desc: 'Выиграй первый бой', reward: 300,
    progress: s => [Math.min(1, s.wins | 0), 1] },
  { id: 'winner_2', name: 'Победитель II', desc: 'Выиграй 10 боёв', reward: 1200,
    progress: s => [Math.min(10, s.wins | 0), 10] },
  { id: 'winner_3', name: 'Победитель III', desc: 'Выиграй 50 боёв', reward: 3000,
    progress: s => [Math.min(50, s.wins | 0), 50] },
  { id: 'winner_4', name: 'Победитель IV', desc: 'Выиграй 150 боёв', reward: 6000,
    progress: s => [Math.min(150, s.wins | 0), 150] },
  { id: 'winner_5', name: 'Победитель V', desc: 'Выиграй 300 боёв', reward: 12000,
    progress: s => [Math.min(300, s.wins | 0), 300] },
  { id: 'courier_1', name: 'Доставщик I', desc: 'Доставь 3 флага', reward: 300,
    progress: s => [Math.min(3, s.flagsDelivered | 0), 3] },
  { id: 'courier_2', name: 'Доставщик II', desc: 'Доставь 20 флагов', reward: 800,
    progress: s => [Math.min(20, s.flagsDelivered | 0), 20] },
  { id: 'courier_3', name: 'Доставщик III', desc: 'Доставь 100 флагов', reward: 2500,
    progress: s => [Math.min(100, s.flagsDelivered | 0), 100] },
  { id: 'courier_4', name: 'Доставщик IV', desc: 'Доставь 500 флагов', reward: 6000,
    progress: s => [Math.min(500, s.flagsDelivered | 0), 500] },
  { id: 'courier_5', name: 'Доставщик V', desc: 'Доставь 1000 флагов', reward: 12000,
    progress: s => [Math.min(1000, s.flagsDelivered | 0), 1000] },
  { id: 'campaign_1', name: 'Герой кампании', desc: 'Пройди уровень кампании', reward: 1000,
    progress: s => [Math.min(1, s.campaignWins | 0), 1] },
  { id: 'campaign_2', name: 'Герой кампании II', desc: 'Пройди 5 уровней кампании', reward: 2500,
    progress: s => [Math.min(5, s.campaignWins | 0), 5] },
  { id: 'campaign_3', name: 'Герой кампании III', desc: 'Пройди 10 уровней кампании', reward: 5000,
    progress: s => [Math.min(10, s.campaignWins | 0), 10] },
  { id: 'azart_1', name: 'Азарт I', desc: 'Открой первый кейс', reward: 300,
    progress: s => [Math.min(1, s.cases | 0), 1] },
  { id: 'azart_2', name: 'Азарт II', desc: 'Открой 25 кейсов', reward: 2500,
    progress: s => [Math.min(25, s.cases | 0), 25] },
  { id: 'azart_3', name: 'Азарт III', desc: 'Открой 100 кейсов', reward: 6000,
    progress: s => [Math.min(100, s.cases | 0), 100] },
  { id: 'growth_1', name: 'Рост I', desc: 'Достигни 5 уровня', reward: 800,
    progress: s => [Math.min(5, ((s && s.level != null ? s.level : gameState.level) | 0)), 5] },
  { id: 'growth_2', name: 'Рост II', desc: 'Достигни 10 уровня', reward: 2000,
    progress: s => [Math.min(10, ((s && s.level != null ? s.level : gameState.level) | 0)), 10] },
  { id: 'growth_3', name: 'Рост III', desc: 'Достигни 30 уровня', reward: 5000,
    progress: s => [Math.min(30, ((s && s.level != null ? s.level : gameState.level) | 0)), 30] },
  { id: 'style_1', name: 'Стиляга I', desc: 'Собери 5 скинов', reward: 700,
    progress: s => [Math.min(5, (((s && s.weaponSkins) || gameState.weaponSkins || []).length)), 5] },
  { id: 'style_2', name: 'Стиляга II', desc: 'Собери 20 скинов', reward: 2000,
    progress: s => [Math.min(20, (((s && s.weaponSkins) || gameState.weaponSkins || []).length)), 20] },
  { id: 'style_3', name: 'Стиляга III', desc: 'Собери 50 скинов', reward: 5000,
    progress: s => [Math.min(50, (((s && s.weaponSkins) || gameState.weaponSkins || []).length)), 50] },
  { id: 'rich', name: 'Магнат', desc: 'Заработай 20000 монет', reward: 5000,
    progress: s => [Math.min(20000, ((s && s.coinsEarned) | 0)), 20000] },
  { id: 'rich_2', name: 'Магнат II', desc: 'Заработай 100000 монет', reward: 15000,
    progress: s => [Math.min(100000, ((s && s.coinsEarned) | 0)), 100000] },
  { id: 'genome_1', name: 'Новая эволюция', desc: 'Разблокируй геном', reward: 1000,
    progress: s => [((s && s.geneUnlocked !== undefined ? s.geneUnlocked : gameState.geneUnlocked) ? 1 : 0), 1] },
  { id: 'genome_2', name: 'Совершенство', desc: 'Доведи любой ген до 3 уровня', reward: 2000,
    progress: s => [Math.min(3, maxGeneLevel()), 3] }
];

// Максимальный уровень среди всех генов (для «Совершенства»).
function maxGeneLevel() {
  try {
    const g = gameState.genes || {};
    let m = 0;
    Object.keys(g).forEach(k => { m = Math.max(m, g[k] | 0); });
    return m;
  } catch (e) { return 0; }
}

// Выполненные (можно забирать), без выдачи. Чистая проверка.
export function completedAchievements() {
  const out = [];
  try {
    const st = gameState.stats || { kills: 0 };
    ACHIEVEMENTS.forEach(a => {
      let cur = 0;
      let need = 1;
      try {
        [cur, need] = a.progress(st);
      } catch (e) { return; }
      if (cur >= need) out.push(a);
    });
  } catch (e) { /* ачивки не роняют игру */ }
  return out;
}

export function isClaimed(id) {
  return (gameState.achievements || []).includes(id);
}

// Забрать награду по кнопке. Возвращает true если выдано.
export function claimAchievement(id) {
  try {
    const a = ACHIEVEMENTS.find(v => v.id === id);
    if (!a || isClaimed(id)) return false;
    if (!completedAchievements().some(v => v.id === id)) return false;
    if (!Array.isArray(gameState.achievements)) gameState.achievements = [];
    gameState.achievements.push(id);
    if (a.reward > 0) addCoins(a.reward);
    else saveGameState();
    return true;
  } catch (e) {
    return false;
  }
}

export function achievementProgress(id) {
  const a = ACHIEVEMENTS.find(v => v.id === id);
  if (!a) return [0, 1];
  try {
    return a.progress(gameState.stats || { kills: 0 });
  } catch (e) {
    return [0, 1];
  }
}
