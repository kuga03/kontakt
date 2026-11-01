import { getEquippedHead, getEquippedTorso, getEquippedPants, getEquippedShoes } from './gameState.js?v=171';
import { RARITY } from './skins.js?v=169';

// Сеты одежды: голова + торс + штаны + ботинки одного стиля дают бонус.
// Бонусы РАЗНЫЕ ПО ПРИНЦИПУ (не шесть процентов к разному): скорость,
// реген, урон, темп перезарядки, броня, боезапас. Хуки — в applyPassives
// (Player.js), пересчёт чистой функцией от надетого.
// ONLINE-ЗАДЕЛ: бонус считается чистой функцией от надетых id
// (equippedGearSet/gearSetBonus) — сервер пересчитает так же, доверять
// клиенту ничего не нужно, состояние только в equipped*.
export const GEAR_SETS = [
  {
    id: 'camo',
    name: 'Камуфляж',
    pieces: { head: 'камуфляжный_шлем', torso: 'торс_камуфляж', pants: 'штаны_камуфляж', shoes: 'берцы_камуфляж' },
    bonus: { moveSpeedPct: 4 },
    bonusText: '+4% к скорости передвижения',
    desc: 'Сливаешься с местностью: лёгкий шаг'
  },
  {
    id: 'sailor',
    name: 'Моряк',
    pieces: { head: 'бескозырка', torso: 'торс_тельняшка', pants: 'штаны_белые', shoes: 'полуберцы' },
    bonus: { regen: 1 },
    bonusText: '+1 HP/сек регенерации',
    desc: 'Морская закалка затягивает раны'
  },
  {
    id: 'assault',
    name: 'Штурмовик',
    pieces: { head: 'военный_шлем', torso: 'торс_разгрузка', pants: 'штаны_чёрные', shoes: 'ботинки_усиленные' },
    bonus: { damagePct: 3 },
    bonusText: '+3% к урону',
    desc: 'Разгрузка под рукой: бьёшь чуть больнее'
  },
  {
    id: 'night',
    name: 'Ночной охотник',
    pieces: { head: 'маска_ночная', torso: 'торс_ночной', pants: 'штаны_ночные', shoes: 'берцы_ночные' },
    bonus: { reloadMult: 0.92 },
    bonusText: 'перезарядка на 8% быстрее',
    desc: 'Ночные руки не медлят с магазином'
  },
  {
    id: 'officer',
    name: 'Офицер',
    pieces: { head: 'фуражка_парадная', torso: 'китель_офицера', pants: 'галифе_офицера', shoes: 'туфли_офицера' },
    bonus: { maxArmor: 15 },
    bonusText: '+15 к броне',
    desc: 'Выправка держит удар'
  },
  {
    id: 'sheriff',
    name: 'Шериф',
    pieces: { head: 'шляпа_закона', torso: 'куртка_шерифа', pants: 'джинсы_шерифа', shoes: 'сапоги_шерифа' },
    bonus: { ammoMult: 1.15 },
    bonusText: '+15% к патронам',
    desc: 'Патруль всегда при запасе'
  },
  {
    id: 'vdv',
    name: 'Десант',
    pieces: { head: 'берет_десанта', torso: 'торс_десанта', pants: 'штаны_десанта', shoes: 'берцы_десанта' },
    bonus: { maxHpPct: 8 },
    bonusText: '+8% к здоровью',
    desc: 'С голубого неба — и живучее всех'
  },
  {
    id: 'marksman',
    name: 'Стрелок',
    pieces: { head: 'берет_стрелка', torso: 'торс_стрелка', pants: 'штаны_стрелка', shoes: 'боты_стрелка' },
    bonus: { headshotMult: 1.12 },
    bonusText: '+12% к урону в голову',
    desc: 'Читает дистанцию и бьёт по макушке'
  },
  {
    id: 'eod',
    name: 'Сапёр',
    pieces: { head: 'маска_сапёра', torso: 'торс_сапёра', pants: 'штаны_сапёра', shoes: 'сапоги_сапёра' },
    bonus: { takenMult: 0.94 },
    bonusText: '−6% получаемого урона',
    desc: 'Тяжёлая броня принимает удар на себя'
  },
  {
    id: 'fire',
    name: 'Пожарный',
    pieces: { head: 'каска_пожарная', torso: 'торс_пожарного', pants: 'штаны_пожарные', shoes: 'боты_пожарные' },
    bonus: { healMult: 1.25 },
    bonusText: '+25% к лечению',
    desc: 'Вытащит из огня — и заштопает'
  },
  {
    id: 'track',
    name: 'Атлет',
    pieces: { head: 'бандана_атлета', torso: 'торс_олимпийка', pants: 'штаны_атлета', shoes: 'кроссы_олимпийка' },
    bonus: { spreadMult: 0.92 },
    bonusText: 'разброс −8%',
    desc: 'Спортивная дисциплина — кучный огонь'
  }
];

// Редкость сета = максимум по редкостям его вещей (GEAR_ITEM_RARITY из wardrobe.js;
// обратного импорта нет — цикла не образуется).
import { GEAR_ITEM_RARITY } from './wardrobe.js?v=172';

GEAR_SETS.forEach((s) => {
  s.rarity = Math.min(4, Math.max(0, Math.max(
    GEAR_ITEM_RARITY[s.pieces.head] ?? 1,
    GEAR_ITEM_RARITY[s.pieces.torso] ?? 1,
    GEAR_ITEM_RARITY[s.pieces.pants] ?? 1,
    GEAR_ITEM_RARITY[s.pieces.shoes] ?? 1
  )));
  const r = RARITY[s.rarity];
  s.rarityName = r.name;
  s.rarityColor = r.color;
});

function equippedGearSet() {
  try {
    const h = (typeof getEquippedHead === 'function') ? getEquippedHead() : null;
    const t = (typeof getEquippedTorso === 'function') ? getEquippedTorso() : null;
    const p = (typeof getEquippedPants === 'function') ? getEquippedPants() : null;
    const sh = (typeof getEquippedShoes === 'function') ? getEquippedShoes() : null;
    if (!h || !t || !p || !sh) return null;
    return GEAR_SETS.find(s => s.pieces.head === h && s.pieces.torso === t && s.pieces.pants === p && s.pieces.shoes === sh) || null;
  } catch (e) { return null; }
}

// Бонус надетого сета плоским объектом { moveSpeedPct, maxHpPct, damagePct }.
export function gearSetBonus() {
  try {
    const s = equippedGearSet();
    if (!s || !s.bonus) return {};
    return Object.assign({}, s.bonus);
  } catch (e) { return {}; }
}

// Сколько частей сета надето (для подсказок «Сет: 3/4»).
export function gearSetProgress(setId) {
  try {
    const s = GEAR_SETS.find(x => x.id === setId);
    if (!s) return { worn: 0, total: 4, set: null };
    const h = (typeof getEquippedHead === 'function') ? getEquippedHead() : null;
    const t = (typeof getEquippedTorso === 'function') ? getEquippedTorso() : null;
    const p = (typeof getEquippedPants === 'function') ? getEquippedPants() : null;
    const sh = (typeof getEquippedShoes === 'function') ? getEquippedShoes() : null;
    let worn = 0;
    if (h === s.pieces.head) worn++;
    if (t === s.pieces.torso) worn++;
    if (p === s.pieces.pants) worn++;
    if (sh === s.pieces.shoes) worn++;
    return { worn, total: 4, set: s };
  } catch (e) { return { worn: 0, total: 4, set: null }; }
}

// Сет, к которому относится вещь (для подсказок в магазине).
