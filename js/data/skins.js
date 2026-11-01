import { weaponsList, getWeaponLabel } from './weapons.js?v=170';

// Эпитеты вместо плоских «Неон»/«Золотой»: имя скина = оружие + эпитет,
// как «АК-47 Кровавый дракон». Распределение детерминированное (по индексу),
// id не меняются — старые сейвы целы.
const VARIANTS = [
  {
    id: 'gold',
    color: '#ffd700',
    epithets: ['Золотой дракон', 'Царская позолота', 'Золотая лихорадка', 'Наследие Мидаса']
  },
  {
    id: 'neon',
    color: '#00ffff',
    epithets: ['Неоновый шторм', 'Киберпанк', 'Электрический угорь', 'Лазерный дождь']
  },
  {
    id: 'camo',
    color: '#8a9a3c',
    epithets: ['Лесной призрак', 'Пустынный скорпион', 'Таёжный волк', 'Болотный дух']
  },
  {
    id: 'stealth',
    color: '#5f7a8a',
    epithets: ['Ночной охотник', 'Живая тень', 'Чёрная вдова', 'Полуночник']
  }
];

export const RARITY = [
  { id: 0, name: 'Ширпотреб', color: '#9aa0a8' },
  { id: 1, name: 'Обычный', color: '#3b9dff' },
  { id: 2, name: 'Редкий', color: '#35d07f' },
  { id: 3, name: 'Эпический', color: '#b44dff' },
  { id: 4, name: 'Легендарный', color: '#ffd24a' }
];

// Редкость скина: база по варианту (stealth 0 … gold 3) +1 если пушка
// дорогая (price ≥ 7000). Скины ножа — всегда легендарные (п.4),
// из ящика рядового не падают (фильтр в LootBoxScene).
const VARIANT_RARITY = { stealth: 0, camo: 1, neon: 2, gold: 3 };

export const weaponSkins = [];

// У оружия может быть skinVariants: ['gold','neon',...] — только эти варианты
// (нож/катана/мачете — по 3 скина). Без поля — все 4 варианта как раньше.
weaponsList.forEach((weapon, wi) => {
  VARIANTS.forEach((variant, vi) => {
    if (weapon.skinVariants && !weapon.skinVariants.includes(variant.id)) return;
    const epithet = variant.epithets[(wi + vi) % variant.epithets.length];
    let rarity = Math.min(4, (VARIANT_RARITY[variant.id] ?? 1) + (weapon.price >= 7000 ? 1 : 0));
    // Ближний бой только из кейсов (катана/мачете: caseOnly + melee) — всегда
    // легендарный, как нож (у ножа caseOnly нет — он стартовый, check по имени).
    if (weapon.name === 'Knife' || (weapon.category === 'melee' && weapon.caseOnly)) rarity = 4;
    weaponSkins.push({
      id: `${weapon.name}::${variant.id}`,
      weapon: weapon.name,
      name: `${getWeaponLabel(weapon.name)} «${epithet}»`,
      color: variant.color,
      rarity,
      rarityName: RARITY[rarity].name,
      rarityColor: RARITY[rarity].color
    });
  });
});