import { hasHead, unlockHead, equipHead, hasShoes, unlockShoes, equipShoes, hasTorso, unlockTorso, equipTorso, hasPants, unlockPants, equipPants } from './gameState.js?v=175';
// Редкости — те же 5 тиров, что у скинов (skins.js), чтобы рамки/подписи
// буты и одежды читались одинаково. rarity проставлен у каждой вещи,
// rarityName/rarityColor вычисляются ниже из общего каталога RARITY.
import { RARITY } from './skins.js?v=169';

// Единый каталог одежды: магазин и кейс «Гардероб» берут отсюда.
// slot: 'head' | 'shoes' | 'torso' | 'pants' — куда надевается.
// cat: столбец вкладки ВНЕШНОСТЬ.
export const GEAR_ITEMS = [
  // Вне-сетевые уборы удалены из игры: остаются только вещи из 6 сетов.
  { tex: 'военный_шлем', rarity: 1, label: 'Военный шлем', price: 400, unlockLevel: 3, slot: 'head', cat: 'hat' },
  { tex: 'камуфляжный_шлем', rarity: 1, label: 'Камуфляжный', price: 450, unlockLevel: 3, slot: 'head', cat: 'hat' },
  { tex: 'бескозырка', rarity: 0, label: 'Бескозырка', price: 350, unlockLevel: 3, slot: 'head', cat: 'hat' },
  { tex: 'полуберцы', rarity: 0, label: 'Полуберцы', price: 300, unlockLevel: 2, slot: 'shoes', cat: 'shoes' },
  { tex: 'ботинки_усиленные', rarity: 1, label: 'Усиленные берцы', price: 350, unlockLevel: 3, slot: 'shoes', cat: 'shoes' },
  { tex: 'берцы_камуфляж', rarity: 1, label: 'Берцы камуфляж', price: 450, unlockLevel: 3, slot: 'shoes', cat: 'shoes' },
  { tex: 'торс_тельняшка', rarity: 0, label: 'Тельняшка', price: 400, unlockLevel: 2, slot: 'torso', cat: 'torso' },
  { tex: 'торс_разгрузка', rarity: 2, label: 'Разгрузка', price: 550, unlockLevel: 4, slot: 'torso', cat: 'torso' },
  { tex: 'торс_камуфляж', rarity: 1, label: 'Камуфляж', price: 500, unlockLevel: 3, slot: 'torso', cat: 'torso' },
  { tex: 'штаны_камуфляж', rarity: 1, label: 'Штаны камуфляж', price: 450, unlockLevel: 3, slot: 'pants', cat: 'pants' },
  { tex: 'штаны_чёрные', rarity: 0, label: 'Чёрные штаны', price: 400, unlockLevel: 2, slot: 'pants', cat: 'pants' },
  { tex: 'штаны_белые', rarity: 0, label: 'Белые штаны', price: 400, unlockLevel: 3, slot: 'pants', cat: 'pants' },
  // --- Сет «Ночной охотник»: только свои вещи, ни с кем не делится.
  { tex: 'маска_ночная', rarity: 2, label: 'Шлем с ПНВ', price: 500, unlockLevel: 4, slot: 'head', cat: 'hat' },
  { tex: 'торс_ночной', rarity: 2, label: 'Ночной камуфляж', price: 550, unlockLevel: 4, slot: 'torso', cat: 'torso' },
  { tex: 'штаны_ночные', rarity: 2, label: 'Ночные штаны', price: 450, unlockLevel: 4, slot: 'pants', cat: 'pants' },
  { tex: 'берцы_ночные', rarity: 2, label: 'Ночные берцы', price: 450, unlockLevel: 4, slot: 'shoes', cat: 'shoes' },
  // --- Сет «Офицер»: только свои вещи.
  { tex: 'фуражка_парадная', rarity: 3, label: 'Парадная фуражка', price: 500, unlockLevel: 4, slot: 'head', cat: 'hat' },
  { tex: 'китель_офицера', rarity: 3, label: 'Китель', price: 600, unlockLevel: 5, slot: 'torso', cat: 'torso' },
  { tex: 'галифе_офицера', rarity: 3, label: 'Галифе', price: 500, unlockLevel: 4, slot: 'pants', cat: 'pants' },
  { tex: 'туфли_офицера', rarity: 3, label: 'Офицерские туфли', price: 450, unlockLevel: 4, slot: 'shoes', cat: 'shoes' },
  // --- Сет «Шериф»: только свои вещи.
  { tex: 'шляпа_закона', rarity: 2, label: 'Шляпа закона', price: 500, unlockLevel: 4, slot: 'head', cat: 'hat' },
  { tex: 'куртка_шерифа', rarity: 2, label: 'Куртка шерифа', price: 550, unlockLevel: 4, slot: 'torso', cat: 'torso' },
  { tex: 'джинсы_шерифа', rarity: 2, label: 'Джинсы шерифа', price: 450, unlockLevel: 4, slot: 'pants', cat: 'pants' },
  { tex: 'сапоги_шерифа', rarity: 2, label: 'Сапоги шерифа', price: 450, unlockLevel: 4, slot: 'shoes', cat: 'shoes' },
  // --- Сет «Десант»: только свои вещи.
  { tex: 'берет_десанта', rarity: 1, label: 'Синий берет', price: 500, unlockLevel: 4, slot: 'head', cat: 'hat' },
  { tex: 'торс_десанта', rarity: 1, label: 'Десантный камуфляж', price: 550, unlockLevel: 4, slot: 'torso', cat: 'torso' },
  { tex: 'штаны_десанта', rarity: 1, label: 'Штаны десантника', price: 450, unlockLevel: 4, slot: 'pants', cat: 'pants' },
  { tex: 'берцы_десанта', rarity: 1, label: 'Десантные берцы', price: 450, unlockLevel: 4, slot: 'shoes', cat: 'shoes' },
  // --- Сет «Стрелок»: только свои вещи.
  { tex: 'берет_стрелка', rarity: 1, label: 'Оливковый берет', price: 500, unlockLevel: 4, slot: 'head', cat: 'hat' },
  { tex: 'торс_стрелка', rarity: 1, label: 'Полевой торс', price: 550, unlockLevel: 4, slot: 'torso', cat: 'torso' },
  { tex: 'штаны_стрелка', rarity: 1, label: 'Штаны стрелка', price: 450, unlockLevel: 4, slot: 'pants', cat: 'pants' },
  { tex: 'боты_стрелка', rarity: 1, label: 'Ботинки стрелка', price: 450, unlockLevel: 4, slot: 'shoes', cat: 'shoes' },
  // --- Сет «Сапёр»: только свои вещи.
  { tex: 'маска_сапёра', rarity: 4, label: 'Шлем сапёра', price: 600, unlockLevel: 5, slot: 'head', cat: 'hat' },
  { tex: 'торс_сапёра', rarity: 4, label: 'Жилет сапёра', price: 600, unlockLevel: 5, slot: 'torso', cat: 'torso' },
  { tex: 'штаны_сапёра', rarity: 4, label: 'Карго сапёра', price: 500, unlockLevel: 5, slot: 'pants', cat: 'pants' },
  { tex: 'сапоги_сапёра', rarity: 4, label: 'Сапоги сапёра', price: 500, unlockLevel: 5, slot: 'shoes', cat: 'shoes' },
  // --- Сет «Пожарный»: только свои вещи.
  { tex: 'каска_пожарная', rarity: 1, label: 'Пожарная каска', price: 500, unlockLevel: 4, slot: 'head', cat: 'hat' },
  { tex: 'торс_пожарного', rarity: 1, label: 'Светящийся жилет', price: 550, unlockLevel: 4, slot: 'torso', cat: 'torso' },
  { tex: 'штаны_пожарные', rarity: 1, label: 'Штаны спасателя', price: 450, unlockLevel: 4, slot: 'pants', cat: 'pants' },
  { tex: 'боты_пожарные', rarity: 1, label: 'Ботинки пожарного', price: 450, unlockLevel: 4, slot: 'shoes', cat: 'shoes' },
  // --- Сет «Атлет»: только свои вещи.
  { tex: 'бандана_атлета', rarity: 0, label: 'Спортивная бандана', price: 400, unlockLevel: 3, slot: 'head', cat: 'hat' },
  { tex: 'торс_олимпийка', rarity: 1, label: 'Олимпийка', price: 450, unlockLevel: 3, slot: 'torso', cat: 'torso' },
  { tex: 'штаны_атлета', rarity: 1, label: 'Спортивные штаны', price: 400, unlockLevel: 3, slot: 'pants', cat: 'pants' },
  { tex: 'кроссы_олимпийка', rarity: 1, label: 'Кроссовки олимпийца', price: 400, unlockLevel: 3, slot: 'shoes', cat: 'shoes' }
];

// Редкость вещи добирается полем rarityName/rarityColor из общего списка RARITY.
GEAR_ITEMS.forEach((g) => {
  const r = RARITY[Math.min(4, Math.max(0, g.rarity ?? 1))];
  g.rarityName = r.name;
  g.rarityColor = r.color;
});

// Веса дропа из кейса по редкости (индекс = rarity): чем выше — тем реже.
export const GEAR_RARITY_WEIGHT = [100, 70, 32, 10, 3];

// Карта tex → rarity: сетам (gearSets.js) нужна без цикла по GEAR_ITEMS.
export const GEAR_ITEM_RARITY = {};
GEAR_ITEMS.forEach((g) => { GEAR_ITEM_RARITY[g.tex] = g.rarity; });

export function gearOwned(g) {
  if (!g) return false;
  if (g.slot === 'shoes') return hasShoes(g.tex);
  if (g.slot === 'torso') return hasTorso(g.tex);
  if (g.slot === 'pants') return hasPants(g.tex);
  return hasHead(g.tex);
}

export function gearUnlockBuy(g) {
  if (!g) return;
  if (g.slot === 'shoes') { unlockShoes(g.tex); equipShoes(g.tex); }
  else if (g.slot === 'torso') { unlockTorso(g.tex); equipTorso(g.tex); }
  else if (g.slot === 'pants') { unlockPants(g.tex); equipPants(g.tex); }
  else { unlockHead(g.tex); equipHead(g.tex); }
}

// Текстура для превью в ячейках: у штанов — иконка-штаны, а не бедро.
export function gearPreviewTex(g) {
  if (!g) return null;
  return g.slot === 'pants' ? g.tex + '_icon' : g.tex;
}
