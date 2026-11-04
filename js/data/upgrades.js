// upgrades.js — улучшение оружия +1…+5 (ТЗ п.14.4).
// Ключевое правило: качается только УДОБСТВО (перезарядка, магазин,
// разброс, дальность). Урон и темп НЕ трогаем вообще — лестница ТТК (п.3)
// и зеркала с сервером целы. Неудач нет (100% успех).
// Импортирует только gameState/weapons (циклов нет); guns.js зовёт отсюда.
import { gameState, saveGameState, addCoins } from './gameState.js?v=175';
import { weaponsList } from './weapons.js?v=170';

export const UPGRADE_MAX = 5;

// Цена следующего уровня (N-1 → N) = процент от цены оружия с минимумом.
// Вариант А: пропорционально цене оружия.
export function upgradeCostFor(name, level) {
  try {
    const w = weaponsList.find(v => v && v.name === name);
    const base = (w && Number.isFinite(w.price)) ? w.price : 1000;
    const pct = [0.25, 0.35, 0.5, 0.7, 1.0][level] || 1.0;
    const min = [500, 800, 1200, 2000, 3500][level] || 3500;
    return Math.max(min, Math.round(base * pct));
  } catch (e) { return [500, 800, 1200, 2000, 3500][level] || 3500; }
}

// Что даёт каждый уровень (текст для окна подтверждения).
export const UPGRADE_BONUS = [
  'перезарядка −6%',
  'магазин +20%',
  'разброс −15%',
  'дальность +10%',
  'перезарядка −6%',
];

function levels() {
  try {
    if (!gameState.weaponLevels || typeof gameState.weaponLevels !== 'object') {
      gameState.weaponLevels = {};
    }
    return gameState.weaponLevels;
  } catch (e) { return {}; }
}

// Точить можно только стволы (не холодное): у ножа нет ни магазина,
// ни перезарядки, ни разброса — улучшать нечего.
export function isUpgradeable(name) {
  try {
    const w = weaponsList.find(v => v && v.name === name);
    return !!w && w.category !== 'melee';
  } catch (e) { return false; }
}

export function getWeaponLevel(name) {
  try {
    const lv = Math.floor(Number(levels()[name]) || 0);
    return Math.max(0, Math.min(UPGRADE_MAX, lv));
  } catch (e) { return 0; }
}

// Цена следующего уровня (null — максимум).
export function nextUpgradeCost(name) {
  try {
    const lv = getWeaponLevel(name);
    if (lv >= UPGRADE_MAX) return null;
    // Теперь считается через upgradeCostFor(name, lv).
    // old: return UPGRADE_COSTS[lv];
    return upgradeCostFor(name, lv);
  } catch (e) { return null; }
}

export function upgradeWeapon(name) {
  try {
    if (!isUpgradeable(name)) return { ok: false, reason: 'melee' };
    const lv = getWeaponLevel(name);
    if (lv >= UPGRADE_MAX) return { ok: false, reason: 'max' };
    const price = upgradeCostFor(name, lv);
    if ((Number(gameState.coins) || 0) < price) return { ok: false, reason: 'coins' };
    addCoins(-price);
    levels()[name] = lv + 1;
    saveGameState();
    return { ok: true, level: lv + 1 };
  } catch (e) { return { ok: false }; }
}

// Эффекты на инстанс при выдаче (только игрок: боты воюют стоком —
// иначе враги росли бы вместе с кошельком, баг «как в Обливионе»).
// Вызывать ПОСЛЕ ammoMult в addWeapon. Урон/темп не задеты — ТТК тот же.
export function applyWeaponUpgrade(player, w) {
  try {
    if (!player || player.isAI || !w || w.isMelee) return;
    const lv = getWeaponLevel(w.name);
    if (lv <= 0) return;
    // +1/+5: перезарядка (итого −12%). Живой reloadTime — читается
    // в момент старта перезарядки, текущий тик не ломаем.
    if (lv >= 1) w.reloadTime = (Number(w.reloadTime) || 1000) * (lv >= 5 ? 0.88 : 0.94);
    // +2: магазин +20% вверх. Синхрон _init — revive/resetAmmo вернут
    // прокачанное (паттерн прокачки патронов из addWeapon).
    // Одностволки (RPG: заряжен всегда 1) — пропускаем, иначе
    // с прокачки стреляет несколько раз подряд.
    if (lv >= 2 && Number.isFinite(+w.magazineSize) && +w.magazineSize > 1) {
      const ns = Math.max(1, Math.ceil(w.magazineSize * 1.2));
      w.magazineSize = ns;
      w._initMagazine = ns;
      w.magazine = ns;
      w.reserveAmmo = ns * 2;
      w._initReserve = ns * 2;
    }
    // +3: разброс (поле инстанса — общий spreadMult игрока не трогаем,
    // иначе баффал бы все стволы сразу).
    if (lv >= 3 && Number.isFinite(+w.spreadDeg)) w.spreadDeg = w.spreadDeg * 0.85;
    // +4: дальность (инстанс; полёт пуль и так идёт через range).
    if (lv >= 4 && Number.isFinite(+w.range)) w.range = w.range * 1.1;
  } catch (e) {}
}
