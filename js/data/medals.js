// medals.js — боевые награды в духе World of Tanks (вариант А).
// Условия откалиброваны по [CALIB]-логам: боевые планки стоят выше потолка
// ботов (~12 фрагов / ~2200 урона), событийные редки по природе.
// Пороги — константы ниже, правятся одной строкой по новой статистике.
import { gameState, saveGameState } from './gameState.js?v=175';

export const MEDALS = [
  { id: 'firstblood', icon: '🩸', name: 'Первая кровь', desc: 'Первый фраг матча — твой' },
  { id: 'warrior', icon: '⚔️', name: 'Воин', desc: '15+ фрагов и K/D 3+ за бой' },
  { id: 'crusher', icon: '💥', name: 'Костолом', desc: '35%+ урона команды (мин. 3000)' },
  { id: 'bearer', icon: '🚩', name: 'Знаменосец', desc: '50%+ доставок команды (мин. 2) · только CTF' },
  { id: 'hunter', icon: '🏹', name: 'Охотник', desc: '2+ убийства носильщиков за бой · только CTF' },
  { id: 'unbroken', icon: '🛡️', name: 'Несгибаемый', desc: 'Победа без смертей' },
  { id: 'hero', icon: '⭐', name: 'Герой матча', desc: 'Топ-1 по вкладу среди всех + победа' },
  { id: 'smasher', icon: '🔥', name: 'Сокрушитель', desc: 'Топ-1 по урону среди всех + победа' },
  { id: 'sapper', icon: '💣', name: 'Сапёр', desc: '2+ разминирования за бой · только BOMB' },
  { id: 'invader', icon: '📍', name: 'Захватчик', desc: '3+ перехвата точек за бой · только KOTH' },
];

const MEDAL_RULE = {
  warriorKills: 15,
  warriorKd: 3,
  crusherDmg: 3000,
  crusherShare: 0.35,
  bearerDeliver: 2,
  bearerShare: 0.5,
  hunterThief: 2,
  sapperDefuse: 2,
  invaderCap: 3,
};

export function medalById(id) {
  try {
    return MEDALS.find(m => m.id === id) || null;
  } catch (e) {
    return null;
  }
}

export function getMedalCounts() {
  try {
    return (gameState.medals && typeof gameState.medals === 'object') ? gameState.medals : {};
  } catch (e) {
    return {};
  }
}

function topDamage(scene) {
  try {
    const p = scene.player;
    const my = (p && p.damageDealt) || 0;
    for (const q of (scene.players || [])) {
      if (q && q !== p && ((q.damageDealt || 0) > my)) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Вклад — те же веса, что contribScore (combat/match.js). Дублируем формулу
// здесь, а не импортом: match.js импортирует medals.js (цикл иначе).
function contribOf(p) {
  try {
    if (!p) return 0;
    return ((p.kills | 0) * 30)
      + Math.floor(((p.damageDealt || 0)) / 25)
      + ((p.flagsDelivered || 0) * 100)
      + ((p.plants || 0) * 100)
      + ((p.defuses || 0) * 50)
      + ((p.caps || 0) * 20)
      + ((p.returnsCount || 0) * 25)
      + ((p.carrierKills || 0) * 50)
      + (((p.healedGiven || 0)) * 0.5);
  } catch (e) {
    return 0;
  }
}

function topContrib(scene) {
  try {
    const p = scene.player;
    const my = contribOf(p);
    for (const q of (scene.players || [])) {
      if (q && q !== p && contribOf(q) > my) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Проверка по итогам боя. АФК — без медалей, кампания — мимо,
// песочница — мимо (иначе фарм на беззащитных ботах).
// Ворота кампании — по campaignMission, а не по mode: GameScene
// перезаписывает mode миссии её боевым режимом (TDM/FFA/...) при старте,
// так что проверка только mode пропускала все сюжетные бои.
export function checkBattleMedals(scene, playerWon) {
  const out = [];
  try {
    if (!scene || scene._playerAfk) return out;
    if (scene.mode === 'CAMPAIGN') return out;
    if (scene.campaignMission) return out;
    if (scene.botDifficulty && scene.botDifficulty.id === 'sandbox') return out;
    const p = scene.player;
    if (!p || p._demoPuppet) return out;
    const o = scene._objStats || {};
    const kills = p.kills | 0;
    const deaths = p.deaths | 0;
    const dmg = p.damageDealt | 0;
    // Принцип эффективности, а не объёма: время боя фармить не должно.
    // K/D и доли не растут от длительности (смерти и чужой вклад копятся тоже).
    const mates = (scene.players || []).filter(q => q && (scene.mode === 'FFA' ? true : q.team === p.team));
    let teamDmg = 0, teamDel = 0;
    mates.forEach(q => {
      try {
        teamDmg += (q.damageDealt || 0);
        teamDel += (q.flagsDelivered || 0);
      } catch (e) {}
    });
    const kd = kills / Math.max(1, deaths);
    const deliver = o.deliver | 0;
    if (scene._fbMine) out.push('firstblood');
    if (kills >= MEDAL_RULE.warriorKills && kd >= MEDAL_RULE.warriorKd) out.push('warrior');
    if (dmg >= MEDAL_RULE.crusherDmg && dmg / Math.max(1, teamDmg) >= MEDAL_RULE.crusherShare) out.push('crusher');
    if (deliver >= MEDAL_RULE.bearerDeliver && deliver / Math.max(1, teamDel) >= MEDAL_RULE.bearerShare) out.push('bearer');
    if ((o.thief | 0) >= MEDAL_RULE.hunterThief) out.push('hunter');
    if (playerWon && deaths <= 0) out.push('unbroken');
    if (playerWon && topContrib(scene)) out.push('hero');
    if (playerWon && topDamage(scene)) out.push('smasher');
    if ((o.defuse | 0) >= MEDAL_RULE.sapperDefuse) out.push('sapper');
    if ((o.cap | 0) >= MEDAL_RULE.invaderCap) out.push('invader');
  } catch (e) {}
  return out;
}

// Выдача (счётчики в профиле). Возвращает выданные id для строки в табло.
export function awardMedals(ids) {
  const given = [];
  try {
    if (!ids || !ids.length) return given;
    gameState.medals = gameState.medals || {};
    ids.forEach(id => {
      if (!medalById(id)) return;
      gameState.medals[id] = (gameState.medals[id] | 0) + 1;
      given.push(id);
    });
    saveGameState();
  } catch (e) {}
  return given;
}
