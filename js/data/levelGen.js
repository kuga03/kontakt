// js/data/levelGen.js
// Тактический процедурный генератор карт для «МОИ УРОВНИ».
// Учитывает физику ботов и движка:
//   - Прыжки: одинарный <= 120px, двойной <= 210px (ступени строятся с шагом 60–100px).
//   - Горизонтальные разрывы <= 200px (лимит разбега 260–280px).
//   - Высота потолков для полного роста >= 100px (для Танка >= 95px).
//   - Вентиляционные лазы для приседа = 48–54px (хитбокс приседа H_CROUCH = 44).
//   - Ширина платформ >= 60px (уверенная посадка и создание nav-узлов).
//   - Все объекты регистрируются как platform/cover/ground с физикой.

const R = (a, b) => a + Math.random() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
const Clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function addGround(objs, x, y, w, h, texKey) {
  objs.push({ type: 'ground', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), texKey });
}

function addPlat(objs, cx, top, w, h = 18) {
  objs.push({ type: 'platform', x: Math.round(cx), y: Math.round(top + h / 2), w: Math.round(w), h: Math.round(h) });
  return { cx, top, w, h, left: cx - w / 2, right: cx + w / 2 };
}

function addCover(objs, cx, top, w, h, texKey) {
  objs.push({ type: 'cover', x: Math.round(cx), y: Math.round(top + h / 2), w: Math.round(w), h: Math.round(h), texKey });
  return { cx, top, w, h, left: cx - w / 2, right: cx + w / 2 };
}

// Потолочная плита над полом (создает лаз или проход)
function addCeiling(objs, cx, floorTop, w, clearance = 52, slabH = 20) {
  const slabTop = floorTop - clearance - slabH;
  addPlat(objs, cx, slabTop, w, slabH);
  return slabTop;
}

// -------------------------------------------------------------
// 1. АРХЕТИП «АВАНПОСТ»: Заводской рубеж, центральная эстакада и лаз
// -------------------------------------------------------------
function buildOutpost(W, H, GT) {
  const objs = [];
  const theme = 'zavod';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_beton');

  // Фланговые опорные пункты (левый и правый)
  // Левый аванпост: ступень у земли -> 1-й ярус -> 2-й ярус
  addCover(objs, W * 0.22, GT - 70, 80, 70, 'map_bags');
  addPlat(objs, W * 0.27, 740, 240, 20);
  addCover(objs, W * 0.27, 740 - 60, 60, 60, 'map_crate');
  addPlat(objs, W * 0.25, 630, 180, 20);
  // Лаз на левом аванпосте (просвет 52px для приседа)
  addCeiling(objs, W * 0.25, 630, 140, 52, 20);

  // Правый аванпост (зеркально)
  addCover(objs, W * 0.78, GT - 70, 80, 70, 'map_bags');
  addPlat(objs, W * 0.73, 740, 240, 20);
  addCover(objs, W * 0.73, 740 - 60, 60, 60, 'map_crate');
  addPlat(objs, W * 0.75, 630, 180, 20);
  addCeiling(objs, W * 0.75, 630, 140, 52, 20);

  // Переходные площадки к центру
  addPlat(objs, W * 0.37, 720, 160, 20);
  addPlat(objs, W * 0.63, 720, 160, 20);

  // Центральный мост/эстакада (высота 670, под ним свободный проход 850 - 670 = 180px)
  addPlat(objs, W * 0.44, 670, 200, 20);
  addPlat(objs, W * 0.56, 670, 200, 20);
  addPlat(objs, W * 0.50, 710, 150, 20); // центральная соединительная ступень

  // Верхняя смотровая площадка на эстакаде
  addPlat(objs, W * 0.50, 560, 200, 20);
  addCover(objs, W * 0.46, 670 - 60, 60, 60, 'map_crate');
  addCover(objs, W * 0.54, 670 - 60, 60, 60, 'map_crate');

  // Укрытия на земле в центре
  addCover(objs, W * 0.42, GT - 60, 80, 60, 'map_bags');
  addCover(objs, W * 0.58, GT - 60, 80, 60, 'map_bags');

  return { objs, theme, name: 'Аванпост «Рубеж»' };
}

// -------------------------------------------------------------
// 2. АРХЕТИП «КАНЬОН»: Пустынные плато и подвесные мосты
// -------------------------------------------------------------
function buildCanyon(W, H, GT) {
  const objs = [];
  const theme = 'pustinya';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_sand');

  // Западное плато: ступеньки с базы 770 -> 690 -> 610
  addCover(objs, W * 0.16, GT - 70, 90, 70, 'map_bags');
  addPlat(objs, W * 0.22, 760, 180, 20);
  addPlat(objs, W * 0.28, 670, 200, 20);
  addPlat(objs, W * 0.32, 580, 220, 20);
  addCover(objs, W * 0.32, 580 - 60, 70, 60, 'map_wreck');

  // Восточное плато (зеркально)
  addCover(objs, W * 0.84, GT - 70, 90, 70, 'map_bags');
  addPlat(objs, W * 0.78, 760, 180, 20);
  addPlat(objs, W * 0.72, 670, 200, 20);
  addPlat(objs, W * 0.68, 580, 220, 20);
  addCover(objs, W * 0.68, 580 - 60, 70, 60, 'map_wreck');

  // Висячий мост через каньон в центре (Y = 660, разрыв до плато 140px)
  addPlat(objs, W * 0.42, 660, 170, 20);
  addPlat(objs, W * 0.58, 660, 170, 20);
  // Центральный остров-башня в каньоне
  addPlat(objs, W * 0.50, 720, 140, 20);
  addPlat(objs, W * 0.50, 550, 160, 20);
  addCover(objs, W * 0.50, 550 - 60, 60, 60, 'map_crate');

  // Дно каньона: тяжелые баррикады и укрытия
  addCover(objs, W * 0.40, GT - 70, 100, 70, 'map_bags');
  addCover(objs, W * 0.60, GT - 70, 100, 70, 'map_bags');
  addCover(objs, W * 0.50, GT - 60, 70, 60, 'map_barrel');

  return { objs, theme, name: 'Каньон «Сухой брод»' };
}

// -------------------------------------------------------------
// 3. АРХЕТИП «КВАРТАЛ»: Городские крыши и переходы
// -------------------------------------------------------------
function buildRoofs(W, H, GT) {
  const objs = [];
  const theme = 'krisha';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_scorch');

  // Левый комплекс зданий
  addCover(objs, W * 0.18, GT - 70, 80, 70, 'map_bags');
  addPlat(objs, W * 0.24, 730, 200, 20);
  addCover(objs, W * 0.24, 730 - 60, 60, 60, 'map_crate');
  addPlat(objs, W * 0.30, 620, 200, 20);
  addPlat(objs, W * 0.26, 510, 180, 20); // высокая крыша
  addCover(objs, W * 0.26, 510 - 60, 60, 60, 'map_crate');

  // Правый комплекс зданий
  addCover(objs, W * 0.82, GT - 70, 80, 70, 'map_bags');
  addPlat(objs, W * 0.76, 730, 200, 20);
  addCover(objs, W * 0.76, 730 - 60, 60, 60, 'map_crate');
  addPlat(objs, W * 0.70, 620, 200, 20);
  addPlat(objs, W * 0.74, 510, 180, 20); // высокая крыша
  addCover(objs, W * 0.74, 510 - 60, 60, 60, 'map_crate');

  // Центр: средние переходы и воздушный мостик
  addPlat(objs, W * 0.40, 690, 180, 20);
  addPlat(objs, W * 0.60, 690, 180, 20);
  addPlat(objs, W * 0.50, 640, 180, 20);
  addCeiling(objs, W * 0.50, 640, 140, 52, 20); // крытый лаз в центре

  // Верхний пролет
  addPlat(objs, W * 0.50, 470, 160, 20);
  addCover(objs, W * 0.50, 470 - 60, 60, 60, 'map_crate');

  // Уличные баррикады
  addCover(objs, W * 0.35, GT - 60, 70, 60, 'map_bags');
  addCover(objs, W * 0.65, GT - 60, 70, 60, 'map_bags');

  return { objs, theme, name: 'Квартал «Высотки»' };
}

// -------------------------------------------------------------
// 4. АРХЕТИП «БУНКЕР»: Подземный укрепкомплекс с лазами
// -------------------------------------------------------------
function buildBunker(W, H, GT) {
  const objs = [];
  const theme = 'pechera';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_stones');

  // Левый капонир: защищенный дот (проход 110px для Танка)
  addPlat(objs, W * 0.22, 730, 220, 20);
  addCeiling(objs, W * 0.22, 730, 160, 110, 22); // потолок капонира
  addCover(objs, W * 0.14, GT - 70, 80, 70, 'map_bags');
  addCover(objs, W * 0.26, 730 - 60, 60, 60, 'map_crate');

  // Правый капонир
  addPlat(objs, W * 0.78, 730, 220, 20);
  addCeiling(objs, W * 0.78, 730, 160, 110, 22);
  addCover(objs, W * 0.86, GT - 70, 80, 70, 'map_bags');
  addCover(objs, W * 0.74, 730 - 60, 60, 60, 'map_crate');

  // Центральный бункер: двухэтажный укрепленный блок
  // Нижний зал (высота потолка 115px)
  addPlat(objs, W * 0.50, 720, 360, 22);
  // Верхняя крыша бункера
  addPlat(objs, W * 0.50, 580, 320, 22);
  // Вентшахта / лаз на крышу бункера (лаз 50px)
  addCeiling(objs, W * 0.50, 580, 140, 50, 20);

  // Ступени подъема на крышу бункера с земли
  addPlat(objs, W * 0.36, 650, 150, 20);
  addPlat(objs, W * 0.64, 650, 150, 20);
  addCover(objs, W * 0.36, 650 - 60, 60, 60, 'map_crate');
  addCover(objs, W * 0.64, 650 - 60, 60, 60, 'map_crate');

  // Укрытия под бункером
  addCover(objs, W * 0.44, GT - 60, 70, 60, 'map_barrel');
  addCover(objs, W * 0.56, GT - 60, 70, 60, 'map_barrel');

  return { objs, theme, name: 'Бункер «Омега»' };
}

// -------------------------------------------------------------
// Расстановка спавнов и подборов
// -------------------------------------------------------------
function populateSpawnsAndPickups(objs, W, GT, enemyCount) {
  // 1. Спавн игрока и союзников слева
  const playerX = 260;
  objs.push({ type: 'spawn', spawnType: 'player', x: playerX, y: GT - 50, w: 26, h: 26 });
  objs.push({ type: 'spawn', spawnType: 'team', x: playerX - 80, y: GT - 50, w: 26, h: 26 });
  objs.push({ type: 'spawn', spawnType: 'team', x: playerX + 80, y: GT - 50, w: 26, h: 26 });
  objs.push({ type: 'spawn', spawnType: 'team', x: playerX + 160, y: GT - 50, w: 26, h: 26 });

  // 2. Спавн врагов справа (группа рассредоточена)
  const nE = Clamp(enemyCount || 4, 3, 6);
  for (let i = 0; i < nE; i++) {
    const ex = W - 260 - i * 80;
    objs.push({ type: 'spawn', spawnType: 'enemy', x: ex, y: GT - 50, w: 26, h: 26 });
  }

  // 3. Предметы
  // Аптечка строго по центру
  objs.push({ type: 'spawn', spawnType: 'medkit', x: Math.round(W / 2), y: GT - 50, w: 26, h: 26 });
  // Патроны у баз
  objs.push({ type: 'spawn', spawnType: 'ammo', x: 480, y: GT - 50, w: 26, h: 26 });
  objs.push({ type: 'spawn', spawnType: 'ammo', x: W - 480, y: GT - 50, w: 26, h: 26 });
  // Гранаты в тактических точках
  objs.push({ type: 'spawn', spawnType: 'frag', x: Math.round(W * 0.38), y: GT - 50, w: 26, h: 26 });
  objs.push({ type: 'spawn', spawnType: 'frag', x: Math.round(W * 0.62), y: GT - 50, w: 26, h: 26 });
  // Дымы
  objs.push({ type: 'spawn', spawnType: 'smoke', x: Math.round(W * 0.46), y: GT - 50, w: 26, h: 26 });
  objs.push({ type: 'spawn', spawnType: 'smoke', x: Math.round(W * 0.54), y: GT - 50, w: 26, h: 26 });
}

const BUILDERS = [buildOutpost, buildCanyon, buildRoofs, buildBunker];

export function generateLevel(existingCount = 0) {
  const width = [2800, 3000, 3200, 3400][(existingCount || 0) % 4];
  const height = 900;
  const GT = height - 50;

  const builder = BUILDERS[(existingCount || 0) % BUILDERS.length];
  const { objs, theme, name } = builder(width, height, GT);

  const nEn = RI(4, 5);
  populateSpawnsAndPickups(objs, width, GT, nEn);

  return {
    name: `${name} ${existingCount + 1}`,
    width,
    height,
    theme,
    enemies: nEn,
    objective: 'Уничтожить всех врагов',
    reward: { coins: 250, experience: 100 },
    objects: objs
  };
}
