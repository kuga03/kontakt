import { gameState, addCoins, addExperience, saveGameState, recordPassProgress } from '../../data/gameState.js?v=175';

import * as Gang from '../../data/gang.js?v=7';
import { reapplyGlassOnRevive } from '../../data/mutators.js?v=2';

import { contribScore } from '../score.js';
export function flushPlayTime(scene) {
  try {
    if (scene._playT0 == null || !scene.time) return;
    const dt = Math.max(0, (scene.time.now - scene._playT0) / 1000);
    scene._playT0 = scene.time.now;
    if (dt <= 0) return;
    const st = gameState.stats || (gameState.stats = { kills: 0, wins: 0, losses: 0, cases: 0, campaignWins: 0, coinsEarned: 0, killsByClass: {}, timeByClass: {} });
    const cls = scene.selectedClass || 'Assault';
    st.timeByClass[cls] = (st.timeByClass[cls] | 0) + Math.round(dt);
    saveGameState();
  } catch (e) {}
}

// Фраг игрока: общая + по классу + недельная (меню v2).
export function recordPlayerKill(scene, killer) {
  try {
    const st = gameState.stats;
    if (!st) return;
    st.kills = (st.kills | 0) + 1;
    const cls = (killer && killer.constructor && killer.constructor.name) || scene.selectedClass || 'Assault';
    st.killsByClass[cls] = (st.killsByClass[cls] | 0) + 1;
    recordPassProgress('kills');
    // Фраги по стволам за матч (калибровка медалей/баланса пушек).
    try {
      scene._wstats = scene._wstats || {};
      const tag = weaponXpTag(killer && killer.weapon);
      scene._wstats[tag] = (scene._wstats[tag] | 0) + 1;
    } catch (e) {}
    scene._statSaveTick = (scene._statSaveTick | 0) + 1;
    if (scene._statSaveTick % 25 === 0) saveGameState();
  } catch (e) {}
}

// Категория ствола для опыта и статистики (один источник — killXP и лог ниже).
function weaponXpTag(w) {
  const n = ((w && w.name) || '').toLowerCase();
  if (!n) return 'other';
  if (n === 'knife') return 'knife';
  if (n.includes('benelli')) return 'benelli';
  if (n.includes('lmg') || n.includes('m249') || n.includes('m1918') || n.includes('minigun')) return 'lmg';
  if (n.includes('ssg') || n.includes('lar') || n.includes('barrett') || n.includes('remington_700') || n.includes('winchester')) return 'sniper';
  if (n.includes('pistol') || n.includes('makarov') || n.includes('glock') || n.includes('deagle') || n.includes('m1911') || n.includes('revolver')) return 'pistol';
  return 'rifle';
}

export function killXP(scene, killer) {
  switch (weaponXpTag(killer && killer.weapon)) {
    case 'knife': return 20;
    case 'benelli': return 15;
    case 'lmg': return 8;
    case 'sniper': return 5;
    default: return 10;
  }
}

// Активность игрока: дешёвый сэмплинг в update() сцены (несколько сравнений
// чисел за кадр + одно сложение в секунду — на FPS не влияет).
// Секунда засчитывается, если: был клик/выстрел, вырос нанесённый урон
// или боец реально сдвинулся (>30px — бег в стену от резиновой ленты
// не считается). Шевеление прицелом БЕЗ выстрелов/дввижения — не
// активность (раньше любое движение мыши катило — накрутка кручением
// прицела). Кемпер, который стреляет и попадает, — активен.
// Мёртвые секунды — нейтральны (в минус не идут, в плюс тоже).
export function trackActivity(scene, time) {
  try {
    if (!scene || scene.gameOver) return;
    const p = scene.player;
    const ptr = scene.input ? scene.input.activePointer : null;
    if (ptr) {
      const mx = ptr.x || 0, my = ptr.y || 0;
      if (Math.abs(mx - (scene._lastMX ?? mx)) + Math.abs(my - (scene._lastMY ?? my)) > 2) scene._secMouse = true;
      scene._lastMX = mx; scene._lastMY = my;
      if (ptr.isDown) scene._secFire = true;
    }
    if (p) {
      const dd = p.damageDealt || 0;
      if (dd > (scene._dmgMark || 0)) { scene._secDmg = true; scene._dmgMark = dd; }
    }
    const now = typeof time === 'number' ? time : (scene.time ? scene.time.now : 0);
    if (now - (scene._secT || 0) >= 1000) {
      scene._secT = now;
      // Труп не играет: секунду пропускаем мимо обоих счётчиков.
      if (p && p.dead) { scene._secMouse = scene._secFire = scene._secDmg = false; return; }
      let moved = false;
      try {
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          const dx = p.x - (scene._lastPX ?? p.x), dy = p.y - (scene._lastPY ?? p.y);
          if (dx * dx + dy * dy > 900) moved = true;
          scene._lastPX = p.x; scene._lastPY = p.y;
        }
      } catch (e) {}
      if (scene._secFire || scene._secDmg || moved) {
        scene._activeSecs = (scene._activeSecs || 0) + 1;
        scene._idleSecs = 0;
      } else {
        scene._idleSecs = (scene._idleSecs || 0) + 1;
      }
      scene._secMouse = scene._secFire = scene._secDmg = false;
    }
  } catch (e) { /* трекинг не роняет игру */ }
}

// Вклад-гейт: реальный урон/фраги/задачи перекрывают вялый ввод.
// Ниже — столб, что бы прицел ни выписывал.
const AFK_IMPACT = 60;

// АФК ли игрок к концу боя: столбом последние 3 минуты — всегда да;
// дальше активных секунд меньше ~20% длительности (минимум 30с)
// И вклад ниже гейта. Демо — не АФК.
export function playerAfk(scene) {
  try {
    if (scene.player && scene.player._demoPuppet) return false;
    if ((scene._idleSecs || 0) >= 180) return true;
    const now = scene.time ? scene.time.now : 0;
    const t0 = scene._modeT0loop || now;
    const dur = Math.max(30, (now - t0) / 1000);
    const need = Math.max(30, dur * 0.2);
    if ((scene._activeSecs || 0) >= need) return false;
    if (contribScore(scene.player) >= AFK_IMPACT) return false;
    return true;
  } catch (e) { return false; }
}

// Вклад бойца в монетном эквиваленте (те же тарифы, что выплаты игроку):
// фраги, урон, доставки/установки, воры, возвраты, дефузы, точки, лечение.
// Для звезды лучшего — без потолков выплат (чистый вклад).
// Единая выплата за задачные эвенты (вор/возврат/дефуз/точка):
// монеты всегда, опыт — как за киллы (новичок 25%, мин. 1).
// Песочница: ни монет, ни опыта.
export function rewardObjectiveEvent(scene, coins, xpFull) {
  try {
    if (!scene || !coins) return;
    if (scene.botDifficulty && scene.botDifficulty.id === 'sandbox') return;
    scene.matchCoins = (scene.matchCoins || 0) + coins;
    addCoins(coins);
    const diffId = scene.botDifficulty?.id;
    if (diffId === 'experienced' || diffId === 'veteran' || diffId === 'novice') {
      const xp = diffId === 'novice' ? Math.max(1, Math.round((xpFull || 0) * 0.25)) : (xpFull || 0);
      if (xp > 0) {
        scene.matchXP = (scene.matchXP || 0) + xp;
        addExperience(xp);
      }
    }
  } catch (e) { /* награда не роняет игру */ }
}

export function updateTdmHud(scene, time) {
  try {
    if (scene.tdmTimerHud) {
      if (scene._tdmOvertime) {
        scene.tdmTimerHud.setText('ОТ').setColor('#ffd24a');
      } else {
        const left = (typeof scene._matchLeft === 'function')
          ? scene._matchLeft(scene._tdmDur, time) : null;
        if (left == null) return;
        const mm = Math.floor(left / 60000);
        const ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
        scene.tdmTimerHud.setText(`${mm}:${ss}`);
      }
    }
  } catch (e) {}
}

export function respawnDeadEnemies(scene, time) {
  // BOMB: задержки индивидуальные (адаптивные) — проверяем часто (1с),
  // иначе шаг проверки добавлял бы сверху.
  const gate = scene.mode === 'BOMB' ? 1000 : scene.respawnDelay;
  if (time < scene.lastSpawnCheck + gate) return;
  scene.lastSpawnCheck = time;

  scene.players.forEach(p => {
    if (p === scene.player || !p.dead) return;
    // KOTH: волна каждые 10с; отстающие без точек встают за 6с (анти-сноубол).
    let dl = scene.respawnDelay;
    if (scene.mode === 'BOMB' && p.team) {
      dl = scene._bombRespawnDelay(p.team);
    } else if (scene.mode === 'KOTH' && p.team) {
      const my = scene.scores[p.team] | 0;
      const foe = scene.scores[p.team === 'blue' ? 'red' : 'blue'] | 0;
      const held = (scene.kothPoints || []).some(pt => pt.holder === p.team);
      if (!held && foe - my >= 50) dl = 6000;
    }
    // Небольшая задержка после смерти — не встаём в том же тике.
    if (p.diedAt && time - p.diedAt < dl) return;
    let sx, sy;
    const P = (typeof Phaser !== 'undefined') ? Phaser : null;
    if (scene.mode === 'FFA' && scene.ffaSpawns && scene.ffaSpawns.length) {
      const sp = P ? P.Utils.Array.GetRandom(scene.ffaSpawns) : scene.ffaSpawns[0];
      sx = sp.x + (P ? P.Math.Between(-40, 40) : 0);
      sy = scene._groundSpawnY(sx);
    } else {
      const sp = p.spawn;
      if (!sp) return;
      // BOMB/KOTH: строго на базе команды (захват не двигает респаун).
      if (scene.mode === 'BOMB' || scene.mode === 'KOTH') {
        const bx = p.team === 'red' ? scene.mapWidth - 220 : 220;
        sx = P ? P.Math.Clamp(bx + P.Math.Between(-60, 60), 60, Math.max(61, scene.mapWidth - 60)) : bx;
        sy = scene._groundSpawnY(sx);
      } else {
        sx = sp.x;
        sy = sp.y;
      }
    }
    // Проверка на карман перед ревайвом (кастомные карты, маркеры
    // под крышей, сдвиг точки): без выхода бот кладёт себя в ловушку
    // и сидит в ней весь матч. Чистую точку не двигаем (тот же x).
    try {
      const _osx = sx, _osy = sy;
      const sv = scene._validateSpawn(sx, sy);
      sx = sv.x; sy = sv.y;
      // k383: сдвиг валидатора в журнал (карман на спавне).
      try { if (p) p._spawnShift = Math.round(Math.hypot(sx - _osx, sy - _osy)); } catch (eS) {}
    } catch (e) {}
    p.revive(sx, sy);
    // Банда: раненый после revive теряет дебафф (revive сбрасывает) — вернуть.
    // Стекло: revive сбрасывает damageMult — вернуть ×2.
    try { Gang.reapplyGangOnRevive(p); } catch (e) {}
    try { reapplyGlassOnRevive(p, scene.mutators); } catch (e) {}
    // Якорь патруля/лиша ИИ — на новый спавн (иначе бот патрулирует
    // вокруг старой точки и лиш тянет назад). revive() уже сделал
    // канонический сброс, тут только якорь.
    try {
      if (p.ai) {
        p.ai.spawnX = sx;
        p.ai.spawnY = sy;
      }
    } catch (e) {}
  });
}
