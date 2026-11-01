// weapons.cjs — серверный справочник оружия (CJS).
// Источник истины — js/data/weapons.js. При смене статов править ОБА файла
// и гнать сверку: node server/check-weapons.cjs
// Поля: dmg — базовый урон пули/выпада, range — дальность, rate — мс между
// выстрелами (темп), kind — primary/secondary/melee/shotgun/explosive.
// B1: справочник используется для проверок существования/дистанции/темпа.
// Урон пока берётся клиентский (1..150) — серверный урон будет в Б2.
'use strict';

const WEAPONS = {
  'bad_ak47': { dmg: 17, range: 650, rate: 280, kind: 'primary' },
  'AK-47': { dmg: 23, range: 750, rate: 200, kind: 'primary' },
  'SIG_SG_550': { dmg: 38, range: 1100, rate: 900, kind: 'primary' },
  'Sturmgewehr_44': { dmg: 21, range: 720, rate: 230, kind: 'primary' },
  'UZI': { dmg: 8, range: 500, rate: 100, kind: 'primary' },
  'P90': { dmg: 9, range: 520, rate: 100, kind: 'primary' },
  'Benelli_M4': { dmg: 64, range: 380, rate: 600, kind: 'shotgun' },
  'M249': { dmg: 20, range: 720, rate: 280, kind: 'primary' },
  'M1918': { dmg: 34, range: 850, rate: 380, kind: 'primary' },
  'SSG': { dmg: 70, range: 1200, rate: 1800, kind: 'primary' },
  'LAR': { dmg: 20, range: 520, rate: 280, kind: 'primary' },
  'Barrett_M82': { dmg: 95, range: 1300, rate: 2400, kind: 'primary' },
  'Remington_700': { dmg: 80, range: 1250, rate: 2200, kind: 'primary' },
  'Winchester': { dmg: 55, range: 950, rate: 1500, kind: 'primary' },
  'Makarov': { dmg: 20, range: 450, rate: 250, kind: 'secondary' },
  'Glock': { dmg: 20, range: 440, rate: 220, kind: 'secondary' },
  'M1911': { dmg: 30, range: 480, rate: 280, kind: 'secondary' },
  'Deagle': { dmg: 46, range: 580, rate: 340, kind: 'secondary' },
  'revolver': { dmg: 40, range: 540, rate: 380, kind: 'secondary' },
  'Knife': { dmg: 45, range: 55, rate: 400, kind: 'melee' },
  'Сайга': { dmg: 36, range: 500, rate: 280, kind: 'shotgun' },
  'катана': { dmg: 70, range: 62, rate: 450, kind: 'melee' },
  'мачете': { dmg: 60, range: 58, rate: 480, kind: 'melee' },
  'топор': { dmg: 80, range: 60, rate: 550, kind: 'melee' },
  'обрез': { dmg: 42, range: 380, rate: 450, kind: 'shotgun' },
  'SIG_SG_543': { dmg: 22, range: 720, rate: 660, kind: 'primary' },
  'AUG': { dmg: 19, range: 700, rate: 240, kind: 'primary' },
  'minigun': { dmg: 10, range: 550, rate: 80, kind: 'primary' },
  'RPG': { dmg: 120, range: 800, rate: 900, kind: 'explosive' },
  'VKS': { dmg: 60, range: 1000, rate: 800, kind: 'primary' },
  'М16': { dmg: 18, range: 700, rate: 260, kind: 'primary' },
  'Remington': { dmg: 42, range: 420, rate: 340, kind: 'shotgun' },
  'М1913': { dmg: 26, range: 750, rate: 340, kind: 'primary' },
  'Neuhausen KE-7': { dmg: 21, range: 800, rate: 230, kind: 'primary' },
  'М60': { dmg: 22, range: 780, rate: 215, kind: 'primary' },
  'Vickers K': { dmg: 17, range: 650, rate: 160, kind: 'primary' },
};

// Магазины и длительности перезарядки — источник js/data/weapons.js
// (поля magazineSize/reloadTime из weaponsList + generatedWeapons).
// Править ОБА файла и гнать сверку: node server/check-weapons.cjs
const MAG_SIZE = {
  'bad_ak47': 30, 'AK-47': 30, 'SIG_SG_550': 10, 'Sturmgewehr_44': 25,
  'UZI': 32, 'P90': 50, 'Benelli_M4': 6, 'M249': 100, 'M1918': 20,
  'SSG': 10, 'LAR': 10, 'Barrett_M82': 5, 'Remington_700': 5,
  'Winchester': 4, 'Makarov': 15, 'Glock': 17, 'M1911': 8,
  'Deagle': 7, 'revolver': 6, 'Knife': 1, 'Сайга': 8,
  'катана': 1, 'мачете': 1, 'топор': 1, 'обрез': 3,
  'SIG_SG_543': 30, 'AUG': 30, 'minigun': 200, 'RPG': 1,
  'VKS': 20, 'М16': 30, 'Remington': 6, 'М1913': 25,
  'Neuhausen KE-7': 25, 'М60': 100, 'Vickers K': 60,
};
const RELOAD_MS = {
  'bad_ak47': 2600, 'AK-47': 2300, 'SIG_SG_550': 2600, 'Sturmgewehr_44': 2500,
  'UZI': 1800, 'P90': 2200, 'Benelli_M4': 2600, 'M249': 5000, 'M1918': 2800,
  'SSG': 2500, 'LAR': 2200, 'Barrett_M82': 3600, 'Remington_700': 3100,
  'Winchester': 2200, 'Makarov': 1800, 'Glock': 1700, 'M1911': 1900,
  'Deagle': 2400, 'revolver': 3000, 'Knife': 0, 'Сайга': 2300,
  'катана': 0, 'мачете': 0, 'топор': 0, 'обрез': 2500,
  'SIG_SG_543': 2300, 'AUG': 2400, 'minigun': 4500, 'RPG': 3500,
  'VKS': 2400, 'М16': 2400, 'Remington': 2400, 'М1913': 3000,
  'Neuhausen KE-7': 2600, 'М60': 5200, 'Vickers K': 4200,
};

// Латиничные алиасы кириллических имён (тесты и старые клиенты шлют так).
const ALIASES = {
  'M16': 'М16',
  'M1913': 'М1913',
  'M60': 'М60',
  'Saiga': 'Сайга',
  'SAIGA': 'Сайга',
};

// Стволы ботов (BOT-<cls>) — маппинг на классовый ствол для звука/темпа.
const BOT_GUN = {
  'BOT-Assault': 'bad_ak47',
  'BOT-Tank': 'M249',
  'BOT-Medic': 'UZI',
  'BOT-Sniper': 'Winchester',
  'BOT': 'bad_ak47',
};

function normalizeWeapon(name) {
  if (name == null) return '';
  const s = String(name).slice(0, 24);
  if (ALIASES[s]) return ALIASES[s];
  return s;
}

function lookupWeapon(name) {
  const n = normalizeWeapon(name);
  if (!n) return null;
  if (n.startsWith('BOT')) {
    const base = BOT_GUN[n] || BOT_GUN['BOT'];
    const w = WEAPONS[base];
    return w ? { name: n, base, ...w, bot: true } : null;
  }
  // Взрыв/дым — не ствол, но валидное поле w в damage.
  if (n === 'frag' || n === 'smoke') return { name: n, dmg: 120, range: 195, rate: 1100, kind: 'explosive' };
  const w = WEAPONS[n];
  return w ? { name: n, ...w } : null;
}

// Допустимая дистанция хита: дальность ствола + щедрый запас на лаг/телепорт,
// но не больше исторического капа 1300.
function maxHitDist(w) {
  if (!w || !Number.isFinite(w.range)) return 1300;
  return Math.min(1300, w.range + 600);
}

// Допустимый темп хитов в секунду по скорострельности ствола.
// Батч дроби — один хит, запас x1.5 + 1, коридор 2..40 (40 — исторический кап).
function maxHitsPerSec(w) {
  if (!w || !Number.isFinite(w.rate) || w.rate <= 0) return 40;
  const v = Math.ceil((1000 / w.rate) * 1.5) + 1;
  return Math.max(2, Math.min(40, v));
}

function isMeleeWeapon(name) {
  const w = lookupWeapon(name);
  return !!w && w.kind === 'melee';
}

// Размер магазина ствола (число патронов). Ближний бой — Infinity
// (бесконечный, сервер магазин не ведёт). Неизвестный — 30.
function magazineSizeOf(name) {
  const w = (name && typeof name === 'object' && name.name) ? name : lookupWeapon(name);
  if (!w) return 30;
  if (w.kind === 'melee') return Infinity;
  const key = w.base || w.name;
  if (MAG_SIZE[key] != null) return MAG_SIZE[key];
  return 30;
}

// Длительность перезарядки, мс. Нет в таблице — 2000мс.
function reloadTimeOf(name) {
  const w = (name && typeof name === 'object' && name.name) ? name : lookupWeapon(name);
  if (!w) return 2000;
  if (w.kind === 'melee') return 0;
  const key = w.base || w.name;
  if (RELOAD_MS[key] != null) return RELOAD_MS[key];
  return 2000;
}

module.exports = { WEAPONS, MAG_SIZE, RELOAD_MS, ALIASES, BOT_GUN, normalizeWeapon, lookupWeapon, maxHitDist, maxHitsPerSec, isMeleeWeapon, magazineSizeOf, reloadTimeOf };
