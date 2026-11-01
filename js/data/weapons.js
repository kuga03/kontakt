export const classDefinitions = [
  { id: 'Assault', label: 'Штурмовик', color: 0x44ccff, defaultPrimary: 'bad_ak47', defaultSecondary: 'Makarov' },
  { id: 'Tank', label: 'Танк', color: 0xffaa44, defaultPrimary: 'M249', defaultSecondary: 'Glock' },
  { id: 'Medic', label: 'Медик', color: 0x55ff55, defaultPrimary: 'UZI', defaultSecondary: 'Makarov' },
  // Снайпер штатно держит Winchester (открывается вместе с классом на ур.4),
  // а не SSG (ур.6) — иначе новичок-снайпер воюет стволом из будущего.
  { id: 'Sniper', label: 'Снайпер', color: 0xff55ff, defaultPrimary: 'Winchester', defaultSecondary: 'M1911' }
];

// Открытие классов по уровню игрока: 1 — штурмовик, 2 — танк,
// 3 — медик, 4 — снайпер. Лесенки оружия подогнаны под это:
// i-й ствол класса открывается ровно на (уровеньОткрытия + i - 1).
const CLASS_OPEN_LEVEL = { Assault: 1, Tank: 2, Medic: 3, Sniper: 4 };

export function classOpenLevel(cls) {
  return CLASS_OPEN_LEVEL[cls] || 1;
}

export function isClassUnlocked(cls, level) {
  const lv = Number.isFinite(+level) ? Math.floor(+level) : 0;
  return lv >= classOpenLevel(cls);
}

// Класс ствола по колонке (для запрета покупки под закрытый класс).
// Вторички общие — 'Common'.
export function classOfWeapon(name) {
  try {
    for (const cid of Object.keys(weaponByClass)) {
      if ((weaponByClass[cid] || []).includes(name)) {
        return cid === 'Common' ? 'Common' : cid;
      }
    }
    if ((secondaryWeapons || []).includes(name)) return 'Common';
  } catch (e) {}
  return null;
}

export const weaponsList = [
  {
    name: 'bad_ak47',
    category: 'primary',
    damage: 17,
    fireRate: 280,
    range: 650,
    ammoType: '7.62мм',
    magazineSize: 30,
    reserveAmmo: 210,
    reloadTime: 2600,
    price: 0,
    unlockLevel: 1,
    desc: 'Reliable old AK'
  },
  {
    name: 'AK-47',
    category: 'primary',
    damage: 23,
    fireRate: 200,
    range: 750,
    ammoType: '7.62мм',
    magazineSize: 30,
    reserveAmmo: 210,
    reloadTime: 2300,
    price: 6000,
    unlockLevel: 6,
    desc: 'Legendary assault rifle'
  },
  {
    name: 'SIG_SG_550',
    category: 'primary',
    damage: 38,
    fireRate: 900,
    range: 1100,
    ammoType: '5.56мм',
    magazineSize: 10,
    reserveAmmo: 80,
    reloadTime: 2600,
    price: 9500,
    unlockLevel: 8,
    desc: 'German marksman rifle'
  },
  {
    name: 'Sturmgewehr_44',
    category: 'primary',
    damage: 21,
    fireRate: 230,
    range: 720,
    ammoType: '7.62мм',
    magazineSize: 25,
    reserveAmmo: 175,
    reloadTime: 2500,
    price: 3200,
    unlockLevel: 4,
    desc: 'German battle rifle'
  },
  {
    name: 'UZI',
    category: 'primary',
    damage: 8,
    fireRate: 100,
    range: 500,
    ammoType: '9мм',
    magazineSize: 32,
    reserveAmmo: 192,
    reloadTime: 1800,
    price: 800,
    unlockLevel: 3,
    desc: 'Israeli submachine gun'
  },
  {
    name: 'P90',
    category: 'primary',
    damage: 9,
    fireRate: 100,
    range: 520,
    ammoType: '5.7мм',
    magazineSize: 50,
    reserveAmmo: 200,
    reloadTime: 2200,
    price: 1800,
    unlockLevel: 4,
    desc: 'Belgian PDW'
  },
  {
    name: 'Benelli_M4',
    category: 'primary',
    noMag: true,
    damage: 64,
    fireRate: 600,
    range: 380,
    ammoType: '12К',
    magazineSize: 6,
    reserveAmmo: 30,
    reloadTime: 2600,
    price: 4800,
    unlockLevel: 7,
    pellets: 8,
    pelletDamage: 8,
    pelletSpreadDeg: 9,
    desc: 'Semi-auto shotgun'
  },
  {
    name: 'M249',
    category: 'primary',
    damage: 20,
    fireRate: 280,
    range: 720,
    ammoType: '5.56мм',
    magazineSize: 100,
    reserveAmmo: 300,
    reloadTime: 5000,
    price: 4500,
    unlockLevel: 2,
    desc: 'Heavy machine gun'
  },
  {
    name: 'M1918',
    category: 'primary',
    noMag: true,
    damage: 34,
    fireRate: 380,
    range: 850,
    ammoType: '7.62мм',
    magazineSize: 20,
    reserveAmmo: 120,
    reloadTime: 2800,
    price: 3000,
    unlockLevel: 5,
    desc: 'Long heavy barrel — marksman role'
  },
  {
    name: 'SSG',
    category: 'primary',
    damage: 70,
    fireRate: 1800,
    range: 1200,
    ammoType: '7.62мм',
    magazineSize: 10,
    reserveAmmo: 80,
    reloadTime: 2500,
    price: 3800,
    unlockLevel: 6,
    desc: 'Bolt-action sniper rifle'
  },
  {
    name: 'LAR',
    category: 'secondary',
    damage: 20,
    fireRate: 280,
    range: 520,
    ammoType: '7.62мм',
    magazineSize: 10,
    reserveAmmo: 20,
    reloadTime: 2200,
    price: 0,
    unlockLevel: 1,
    desc: 'Free starter pistol'
  },
  {
    name: 'Barrett_M82',
    category: 'primary',
    damage: 95,
    fireRate: 2400,
    range: 1300,
    ammoType: '.338',
    magazineSize: 5,
    reserveAmmo: 40,
    reloadTime: 3600,
    price: 30000,
    unlockLevel: 10,
    desc: 'Anti-materiel rifle'
  },
  {
    name: 'Remington_700',
    category: 'primary',
    damage: 80,
    fireRate: 2200,
    range: 1250,
    ammoType: '7.62мм',
    magazineSize: 5,
    reserveAmmo: 50,
    reloadTime: 3100,
    price: 8000,
    unlockLevel: 7,
    desc: 'Precision bolt-action rifle'
  },
  {
    name: 'Winchester',
    category: 'primary',
    noMag: true,
    damage: 55,
    fireRate: 1500,
    range: 950,
    ammoType: 'болты',
    magazineSize: 4,
    reserveAmmo: 25,
    reloadTime: 2200,
    price: 2200,
    unlockLevel: 4,
    desc: 'Suppressed carbine'
  },
  {
    name: 'Makarov',
    category: 'secondary',
    damage: 20,
    fireRate: 250,
    range: 450,
    ammoType: '9мм',
    magazineSize: 15,
    reserveAmmo: 90,
    reloadTime: 1800,
    price: 350,
    unlockLevel: 2,
    desc: 'Compact pistol'
  },
  {
    name: 'Glock',
    category: 'secondary',
    damage: 20,
    fireRate: 220,
    range: 440,
    ammoType: '9мм',
    magazineSize: 17,
    reserveAmmo: 102,
    reloadTime: 1700,
    price: 300,
    unlockLevel: 3,
    desc: 'High-capacity pistol'
  },
  {
    name: 'M1911',
    category: 'secondary',
    damage: 30,
    fireRate: 280,
    range: 480,
    ammoType: '.45',
    magazineSize: 8,
    reserveAmmo: 48,
    reloadTime: 1900,
    price: 1500,
    unlockLevel: 4,
    desc: 'Classic .45'
  },
  {
    name: 'Deagle',
    category: 'secondary',
    damage: 46,
    fireRate: 340,
    range: 580,
    ammoType: '.50',
    magazineSize: 7,
    reserveAmmo: 42,
    reloadTime: 2400,
    price: 9000,
    unlockLevel: 6,
    desc: 'Desert Eagle'
  },
  {
    name: 'revolver',
    category: 'secondary',
    noMag: true,
    damage: 40,
    fireRate: 380,
    range: 540,
    ammoType: '.44',
    magazineSize: 6,
    reserveAmmo: 36,
    reloadTime: 3000,
    price: 3800,
    unlockLevel: 5,
    desc: '6-shot magnum'
  },
  {
    name: 'Knife',
    category: 'melee',
    damage: 45,
    fireRate: 400,
    range: 55,
    ammoType: null,
    magazineSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    spreadDeg: 0,
    price: 0,
    unlockLevel: 1,
    desc: 'Knife — fast silent melee weapon',
    skinVariants: ['gold', 'neon', 'camo']
  },
  {
    name: 'Сайга',
    category: 'primary',
    damage: 36,
    fireRate: 280,
    range: 500,
    ammoType: '12 калибр',
    magazineSize: 8,
    reserveAmmo: 48,
    reloadTime: 2300,
    price: 5800,
    unlockLevel: 8,
    pellets: 9,
    pelletDamage: 4,
    pelletSpreadDeg: 8,
    desc: 'Saiga-12 — полуавтоматический дробовик'
  },
  {
    name: 'катана',
    category: 'melee',
    damage: 70,
    fireRate: 450,
    range: 62,
    ammoType: null,
    magazineSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    spreadDeg: 0,
    price: 40000,
    unlockLevel: 4,
    desc: 'Катана — только из кейсов',
    caseOnly: true,
    skinVariants: ['gold', 'neon', 'camo']
  },
  {
    name: 'мачете',
    category: 'melee',
    damage: 60,
    fireRate: 480,
    range: 58,
    ammoType: null,
    magazineSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    spreadDeg: 0,
    price: 30000,
    unlockLevel: 4,
    desc: 'Мачете — только из кейсов',
    caseOnly: true,
    skinVariants: ['gold', 'neon', 'camo']
  },
  {
    name: 'топор',
    category: 'melee',
    damage: 80,
    fireRate: 550,
    range: 60,
    ammoType: null,
    magazineSize: 1,
    reserveAmmo: 0,
    reloadTime: 0,
    spreadDeg: 0,
    price: 35000,
    unlockLevel: 4,
    desc: 'Топор — только из кейсов',
    caseOnly: true,
    skinVariants: ['gold', 'neon', 'camo']
  },
  {
    name: 'обрез',
    category: 'primary',
    noMag: true,
    damage: 42,
    fireRate: 450,
    range: 380,
    ammoType: '12 калибр',
    magazineSize: 3,
    reserveAmmo: 24,
    reloadTime: 2500,
    pellets: 6,
    pelletDamage: 7,
    pelletSpreadDeg: 10,
    price: 2200,
    unlockLevel: 5,
    desc: 'Обрез — короткий дробовик'
  }
];

export const weaponByClass = {
  // Порядок в колонках — строго от слабого к сильному (сверху вниз).
  Assault: ['bad_ak47', 'М16', 'AUG', 'Sturmgewehr_44', 'SIG_SG_543', 'AK-47'],
  Medic: ['UZI', 'P90', 'обрез', 'Remington', 'Benelli_M4', 'Сайга'],
  Tank: ['M249', 'М1913', 'Neuhausen KE-7', 'М60', 'Vickers K', 'minigun'],
  Sniper: ['Winchester', 'M1918', 'SSG', 'Remington_700', 'SIG_SG_550', 'VKS', 'Barrett_M82'],
  Common: ['RPG']
};

export const secondaryWeapons = [
  'Makarov', 'Glock', 'M1911', 'Deagle', 'revolver', 'LAR'
];

// У оружия есть отъёмные магазины? Нет — у трубки (помпы, обрез,
// винчестер, M1918, револьвер, RPG) и у ближнего боя: там патроны
// считаются поштучно, магазины не рисуются.
export function weaponHasMag(name) {
  const w = weaponsList.find(x => x && x.name === name);
  if (!w) return false;
  if (w.isMelee || w.category === 'melee') return false;
  return !w.noMag;
}

const generatedWeapons = [
  {     name: 'SIG_SG_543', damage: 22, fireRate: 660, range: 720, magazineSize: 30, reserveAmmo: 210, reloadTime: 2300, price: 4200, unlockLevel: 5, desc: 'Swiss assault rifle · очередь ×3',
    // Очередь по 3 за спуск: темп 660 = тот же урон/сек, что был одиночными
    // по 220. Пауза 90мс замерена по сэмплу (бахи в звуке на 0/78/183мс).
    burst: 3, burstGapMs: 90 },
  { name: 'AUG', damage: 19, fireRate: 240, range: 700, magazineSize: 30, reserveAmmo: 210, reloadTime: 2400, price: 2000, unlockLevel: 3, desc: 'Austrian bullpup' },
  { name: 'minigun', damage: 10, fireRate: 80, range: 550, magazineSize: 200, reserveAmmo: 400, reloadTime: 4500, price: 20000, unlockLevel: 7, desc: 'Rotary minigun' },
  { name: 'RPG', damage: 120, fireRate: 900, range: 800, magazineSize: 1, reserveAmmo: 8, reloadTime: 3500, price: 11000, unlockLevel: 4, noMag: true, desc: 'Rocket launcher' },
  { name: 'VKS', damage: 60, fireRate: 800, range: 1000, magazineSize: 20, reserveAmmo: 120, reloadTime: 2400, price: 22000, unlockLevel: 9, desc: 'Suppressed marksman rifle' },
  { name: 'М16', damage: 18, fireRate: 260, range: 700, magazineSize: 30, reserveAmmo: 210, reloadTime: 2400, price: 1400, unlockLevel: 2, desc: 'Classic assault rifle' },
  { name: 'Remington', damage: 42, fireRate: 340, range: 420, magazineSize: 6, reserveAmmo: 36, reloadTime: 2400, price: 3500, unlockLevel: 6, noMag: true, desc: 'Remington 870 — помповый дробовик', pellets: 7, pelletDamage: 6, pelletSpreadDeg: 9, ammoType: '12 калибр' },
  // Новое пополнение танка (все — ручные пулемёты, магазин/лента):
  // урон ниже штурмовых, but темп и боезапас выше. ДПС-коридор 85-95.
  { name: 'М1913', damage: 26, fireRate: 340, range: 750, magazineSize: 25, reserveAmmo: 150, reloadTime: 3000, price: 7000, unlockLevel: 3, desc: 'Ручной пулемёт М1913' },
  { name: 'Neuhausen KE-7', damage: 21, fireRate: 230, range: 800, magazineSize: 25, reserveAmmo: 175, reloadTime: 2600, price: 8000, unlockLevel: 4, desc: 'Swiss light machine gun' },
  { name: 'М60', damage: 22, fireRate: 215, range: 780, magazineSize: 100, reserveAmmo: 300, reloadTime: 5200, price: 12000, unlockLevel: 5, desc: 'Единый пулемёт М60' },
  { name: 'Vickers K', damage: 17, fireRate: 160, range: 650, magazineSize: 60, reserveAmmo: 240, reloadTime: 4200, price: 16000, unlockLevel: 6, desc: 'Скорострельный Vickers K' }
];

generatedWeapons.forEach(w => {
  weaponsList.push({
    category: 'primary',
    ammoType: 'спец',
    ...w
  });
});

const ICON_BY_WEAPON = {
  'bad_ak47': 'icon_rifle', 'AK-47': 'icon_rifle',
  'SIG_SG_550': 'icon_sniper', 'Sturmgewehr_44': 'icon_rifle', 'SIG_SG_543': 'icon_rifle',
  'AUG': 'icon_rifle', 'М16': 'icon_rifle', 'RPG': 'icon_rifle',
  'UZI': 'icon_smg', 'P90': 'icon_smg', 'Remington': 'icon_shotgun',
  'Benelli_M4': 'icon_shotgun',
  'M249': 'icon_lmg', 'M1918': 'icon_sniper',
  'М1913': 'icon_lmg', 'Neuhausen KE-7': 'icon_lmg', 'М60': 'icon_lmg', 'Vickers K': 'icon_lmg',
  'minigun': 'icon_lmg', 'VKS': 'icon_sniper',
  'SSG': 'icon_sniper', 'Barrett_M82': 'icon_sniper', 'LAR': 'icon_pistol', 'Remington_700': 'icon_sniper',
  'Winchester': 'icon_crossbow',
  'Makarov': 'icon_pistol', 'Glock': 'icon_pistol',
  'M1911': 'icon_pistol', 'Deagle': 'icon_pistol', 'revolver': 'icon_revolver',
  'Knife': 'icon_knife', 'катана': 'icon_knife', 'мачете': 'icon_knife', 'топор': 'icon_knife',
  'Сайга': 'icon_shotgun', 'обрез': 'icon_shotgun'
};

export function weaponIcon(name) {
  return ICON_BY_WEAPON[name] || 'icon_rifle';
}

const WEAPON_PNG_MAP = {
  'bad_ak47': 'bad_ak47',
  'AK-47': 'ak47',
  'SIG_SG_550': 'SIG_SG_550',
  'Sturmgewehr_44': 'Sturmgewehr_44',
  'SIG_SG_543': 'SIG_SG_543',
  'AUG': 'AUG',
  'М16': 'М16',
  'RPG': 'RPG',
  'UZI': 'UZI',
  'P90': 'P90',
  'Benelli_M4': 'Benelli_M4',
  'M249': 'M249',
  'M1918': 'M1918',
  'М1913': 'М1913',
  'Neuhausen KE-7': 'Neuhausen KE-7',
  'М60': 'М60',
  'Vickers K': 'Vickers K',
  'minigun': 'minigun',
  'VKS': 'VKS',
  'SSG': 'SSG',
  'LAR': 'LAR',
  'Barrett_M82': 'Barrett_M82',
  'Remington_700': 'Remington_700',
  'Winchester': 'Winchester',
  'Remington': 'Remington',
  'Makarov': 'Makarov2',
  'Glock': 'Glock',
  'M1911': 'M1911',
  'Deagle': 'Deagle',
  'revolver': 'revolver',
  'Knife': 'Knife',
  'Сайга': 'Сайга',
  'обрез': 'обрез',
  'катана': 'катана',
  'мачете': 'мачете',
  'топор': 'топор'
};

export function weaponImage(name) {
  return WEAPON_PNG_MAP[name] || name;
}

// Масштаб иконок в HUD: исходники PNG с разными полями (у револьвера
// впритык, у минигана огромные) — без поправки револьвер выглядит
// больше минигана. 1 = как есть.
const HUD_ICON_SCALE = {
  'revolver': 0.7,
  'minigun': 1.4
};

export function weaponHudScale(name) {
  return HUD_ICON_SCALE[name] || 1;
}

const weaponSpreadDeg = {
  'bad_ak47': 2.9, 'AK-47': 1.8, 'SIG_SG_550': 0.9,
  'Sturmgewehr_44': 2.1, 'UZI': 3.2, 'P90': 2.8, 'Benelli_M4': 3.0,
  'M249': 3.4, 'M1918': 1.2, 'SSG': 0.6, 'LAR': 1.0,
  'Barrett_M82': 0.4, 'Remington_700': 0.5, 'Winchester': 0.8,
  'Makarov': 1.4, 'Glock': 1.5, 'Deagle': 1.3, 'M1911': 1.4, 'revolver': 1.1,
  'SIG_SG_543': 1.9, 'AUG': 2.3, 'minigun': 3.6, 'RPG': 1.5, 'VKS': 1.0,
  'М16': 2.5, 'Remington': 3.0, 'Knife': 0, 'Сайга': 3.0, 'обрез': 3.0,
  'катана': 0, 'мачете': 0, 'топор': 0,
  'М1913': 2.6, 'Neuhausen KE-7': 2.2, 'М60': 3.6, 'Vickers K': 3.8
};

// Характеристики финальные (без глобальных множителей): урон/темп/разброс
// заданы руками по колонкам. Цены и уровни — тоже руками.
weaponsList.forEach(w => {
  w.spreadDeg = weaponSpreadDeg[w.name] != null ? weaponSpreadDeg[w.name] : 2.5;
});

const weaponLabels = {
  'bad_ak47': 'AKS-74U',
  'AK-47': 'AK-47',
  'SIG_SG_550': 'SIG SG 550',
  'Sturmgewehr_44': 'STG-44',
  'SIG_SG_543': 'SIG SG 543',
  'AUG': 'AUG',
  'М16': 'M16',
  'RPG': 'RPG-7',
  'UZI': 'UZI',
  'P90': 'P90',
  'Benelli_M4': 'BENELLI M4',
  'M249': 'M249',
  'M1918': 'M1918',
  'minigun': 'MINIGUN',
  'VKS': 'VKS',
  'SSG': 'SSG 3000',
  'LAR': 'LAR',
  'Barrett_M82': 'BARRETT M82',
  'Remington_700': 'REMINGTON 700',
  'Winchester': 'WINCHESTER',
  'Remington': 'REMINGTON 870',
  'Makarov': 'MAKAROV',
  'Glock': 'GLOCK',
  'M1911': 'M1911',
  'Deagle': 'DESERT EAGLE',
  'revolver': 'REVOLVER',
  'Knife': 'Нож',
  'frag': 'Граната',
  'Сайга': 'САЙГА',
  'обрез': 'ОБРЕЗ',
  'катана': 'КАТАНА',
  'мачете': 'МАЧЕТЕ',
  'топор': 'ТОПОР'
};

export function getWeaponLabel(w) {
  const name = (typeof w === 'string') ? w : (w && w.name);
  return (name && weaponLabels[name]) || name || '';
}

// Значки классов для таблиц (TAB, итоги, история): штурмовик — патрон,
// танк — бронепластина, медик — плюсик, снайпер — прицел. Векторные 20px,
// пекутся один раз в текстуры 'cls_<Id>' (неизвестный класс — null).
export function classBadgeKey(cls) {
  return (cls === 'Assault' || cls === 'Tank' || cls === 'Medic' || cls === 'Sniper')
    ? 'cls_' + cls : null;
}

export function ensureClassBadgeTextures(scene) {
  try {
    if (!scene || !scene.textures || !scene.make) return;
    const S = 20;
    const drawers = {
      Assault(g) { // патрон: донце + гильза + пуля
        g.fillStyle(0x8a6a1a, 1);
        g.fillRoundedRect(6, 12, 8, 6, 2);
        g.fillStyle(0xd8a920, 1);
        g.fillRoundedRect(6, 5, 8, 9, 2);
        g.fillStyle(0xeeeecc, 1);
        g.fillTriangle(6, 5, 14, 5, 10, 0);
      },
      Tank(g) { // бронепластина
        g.fillStyle(0x5a6f8f, 1);
        g.fillRoundedRect(3, 4, 14, 12, 3);
        g.lineStyle(2, 0xb9c8e0, 1);
        g.strokeRoundedRect(3, 4, 14, 12, 3);
        g.fillStyle(0x33415a, 1);
        g.fillCircle(10, 10, 2);
      },
      Medic(g) { // плюсик
        g.fillStyle(0x1d7a34, 1);
        g.fillCircle(10, 10, 9);
        g.fillStyle(0xffffff, 1);
        g.fillRect(8, 4, 4, 12);
        g.fillRect(4, 8, 12, 4);
      },
      Sniper(g) { // прицел
        g.lineStyle(2, 0xdddddd, 1);
        g.strokeCircle(10, 10, 8);
        g.lineStyle(2, 0xff4444, 1);
        g.lineBetween(10, 0, 10, 6);
        g.lineBetween(10, 14, 10, 20);
        g.lineBetween(0, 10, 6, 10);
        g.lineBetween(14, 10, 20, 10);
        g.fillStyle(0xff4444, 1);
        g.fillCircle(10, 10, 1.6);
      }
    };
    Object.keys(drawers).forEach(k => {
      const key = 'cls_' + k;
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      drawers[k](g);
      g.generateTexture(key, S, S);
      g.destroy();
    });
  } catch (e) { /* без значков таблицы не падают */ }
}
