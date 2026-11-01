// mutators.js — мутаторы выходных (ТЗ п.14.2): параметры поверх обычных режимов.
// Ровно 4 (v1, не больше): ножи / туман / луна / стекло. Комбо — макс 2.
// Реализация хуками (урон/дальность/гравитация/выдача/подбор), без копипасты режимов.
// Циклов нет: только gameState. Бой/лобби/HUD зовут отсюда.
import { gameState, saveGameState, addCoins } from './gameState.js?v=171';

const MUTATORS = [
  { id: 'knives', name: 'Ножи', short: 'НОЖИ', color: '#ffdd55', desc: 'Все только с ножом, подбор стволов запрещён' },
  { id: 'fog', name: 'Туман', short: 'ТУМАН', color: '#9fb8cc', desc: 'Плотный туман, видимость и дальность ×0.4' },
  { id: 'moon', name: 'Луна', short: 'ЛУНА', color: '#7db8ff', desc: 'Гравитация ×0.5' },
  { id: 'glass', name: 'Стекло', short: 'СТЕКЛО', color: '#ff8888', desc: 'Весь урон ×2' },
];
const MUT_MAX = 2;
const MUT_WEEKEND_BONUS = 500;

export function isMutId(id) { return MUTATORS.some(m => m.id === id); }

// Выбранные в лобби (макс 2). Хранится в gameState.mutators (лениво, без миграций gameState.js).

export function hasMut(muts, id) {
  try { return Array.isArray(muts) && muts.includes(id); } catch (e) { return false; }
}

function mutShortLabels(muts) {
  try {
    return (muts || []).map(id => {
      const m = MUTATORS.find(x => x.id === id);
      return m ? m.short : id;
    }).join(' + ');
  } catch (e) { return ''; }
}

// Выходные: пт 18:00 — вс 23:59 по локальному времени (серверного нет — офлайн).
export function isWeekend(now) {
  try {
    const d = now instanceof Date ? now : new Date(typeof now === 'number' ? now : Date.now());
    const day = d.getDay(), h = d.getHours();
    if (day === 5) return h >= 18;
    if (day === 6) return true;
    if (day === 0) return true;
    return false;
  } catch (e) { return false; }
}

// Ключ выходных (пятница этих выходных) — для отметки выплаченных 500.
function weekendId(now) {
  try {
    const d = now instanceof Date ? now : new Date(typeof now === 'number' ? now : Date.now());
    const back = (d.getDay() + 7 - 5) % 7;
    const f = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  } catch (e) { return ''; }
}

function ensureStats() {
  try {
    if (!gameState.stats || typeof gameState.stats !== 'object') gameState.stats = {};
    const st = gameState.stats;
    if (!st.mutWins || typeof st.mutWins !== 'object') st.mutWins = {};
    if (!st.mutPaid || typeof st.mutPaid !== 'object') st.mutPaid = {};
    return st;
  } catch (e) { return { mutWins: {}, mutPaid: {} }; }
}

// Учёт победы с мутаторами. Возвращает строку для итогов (или '').
// Выходные +500 за первую победу с каждым мутатором — сразу (упрощение:
// «в конце выходных» без отложенных очередей — мелочь для возвращения).
// АФК/Демо — мимо (фарм столбом запрещён). Кампания/триал — мимо (там мутаторов нет).
export function recordMutWin(scene, playerWon) {
  try {
    const muts = (scene && scene.mutators) || [];
    if (!muts.length || !playerWon) return { line: '' };
    if (scene.player && scene.player._demoPuppet) return { line: '' };
    if (scene._playerAfk) return { line: '' };
    if (!['FFA', 'TDM', 'CTF', 'BOMB', 'KOTH'].includes(scene.mode)) return { line: '' };
    const st = ensureStats();
    muts.forEach(id => {
      if (!isMutId(id)) return;
      st.mutWins[id] = ((st.mutWins[id] | 0)) + 1;
    });
    let bonus = 0;
    const paidIds = [];
    if (isWeekend()) {
      const wid = weekendId();
      if (!st.mutPaid[wid] || typeof st.mutPaid[wid] !== 'object') st.mutPaid[wid] = {};
      muts.forEach(id => {
        if (!isMutId(id) || st.mutPaid[wid][id]) return;
        st.mutPaid[wid][id] = true;
        paidIds.push(id);
        bonus += MUT_WEEKEND_BONUS;
      });
      if (bonus > 0) {
        scene.matchCoins = (scene.matchCoins || 0) + bonus;
        addCoins(bonus);
      }
    }
    saveGameState();
    const labels = mutShortLabels(muts);
    let line = `Мутаторы (${labels}): побед ${muts.map(id => (st.mutWins[id] | 0)).join('/')}`;
    if (bonus > 0) line += ` · выходные +${bonus}`;
    else if (paidIds.length === 0 && isWeekend()) line += ' · выходные уже получены';
    return { line, bonus };
  } catch (e) { return { line: '' }; }
}

// «Ножи»: оставить бойцу только нож и выбрать его. Вызывается на спавне
// (игрок + каждый бот) — выдача принудительно, без разбора классов.
export function stripToKnife(f) {
  try {
    if (!f || !Array.isArray(f.inventory)) return;
    const isKnife = (w) => w && (w.name === 'Knife' || w.isMelee);
    f.inventory = f.inventory.filter(isKnife);
    if (!f.inventory.length) {
      try { f.addWeapon('Knife'); } catch (e) {}
      if (!Array.isArray(f.inventory)) f.inventory = [];
    }
    const idx = f.inventory.findIndex(isKnife);
    if (idx >= 0) {
      try { f.selectWeapon(idx); }
      catch (e) { try { f.activeWeaponIndex = idx; } catch (e2) {} }
    }
  } catch (e) {}
}

// Стартовые статы от мутаторов (после applyBotDifficulty/пассивов, НЕ в них):
// стекло — урон ×2 (поверх всего), туман — дальность ×0.4 (полёт пуль).
export function applySpawnStats(f, muts) {
  try {
    if (!f) return;
    if (hasMut(muts, 'glass')) f.damageMult = (Number(f.damageMult) || 1) * 2;
    if (hasMut(muts, 'fog')) f.rangeMult = (Number(f.rangeMult) || 1) * 0.4;
  } catch (e) {}
}

// Возврат ×2 после revive (он сбрасывает damageMult в базу; rangeMult живёт).
export function reapplyGlassOnRevive(p, muts) {
  try {
    if (!p || !hasMut(muts, 'glass')) return;
    p.damageMult = (Number(p.damageMult) || 1) * 2;
  } catch (e) {}
}

// --- Ивент выходных: один мутатор на выходные, ротация по неделям ---
// Кнопка ивента живёт в главном меню (не в лобби): в выходные — «В БОЙ»,
// иначе — обратный отсчёт до пт 18:00.
function eventMutator(now) {
  try {
    const t = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : Date.now());
    const weekNo = Math.floor(t / (7 * 24 * 3600 * 1000));
    return MUTATORS[((weekNo % MUTATORS.length) + MUTATORS.length) % MUTATORS.length].id;
  } catch (e) { return 'knives'; }
}

export function eventMutatorDef(now) {
  const id = eventMutator(now);
  return MUTATORS.find(m => m.id === id) || MUTATORS[0];
}

// Начало ближайших выходных (пт 18:00). В выходные — null (уже идут).
export function nextWeekendStart(now) {
  try {
    const d = now instanceof Date ? new Date(now) : new Date(typeof now === 'number' ? now : Date.now());
    if (isWeekend(d)) return null;
    const day = d.getDay();
    let ahead = (5 - day + 7) % 7;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + ahead, 18, 0, 0);
    if (t.getTime() <= d.getTime()) t.setDate(t.getDate() + 7);
    return t;
  } catch (e) { return null; }
}

// Короткий обратный отсчёт для кнопки: «2д 4:12» / «4:12:33» / «12:34».
export function fmtCountdown(ms) {
  try {
    ms = Math.max(0, Math.floor(ms));
    const s = Math.floor(ms / 1000);
    const dd = Math.floor(s / 86400);
    const hh = Math.floor((s % 86400) / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const p2 = (n) => String(n).padStart(2, '0');
    if (dd > 0) return `${dd}д ${hh}:${p2(mm)}`;
    if (hh > 0) return `${hh}:${p2(mm)}:${p2(ss)}`;
    return `${p2(mm)}:${p2(ss)}`;
  } catch (e) { return ''; }
}
