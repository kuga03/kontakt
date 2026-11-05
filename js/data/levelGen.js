// js/data/levelGen.js
// Тактический процедурный генератор масштабных карт для «МОИ УРОВНИ» (v9).
// Полная переработка проходимости, маршрутов и визуальной глубины:
//   1. Честная физика прыжка и комфортная высота потолков:
//      - Высота прыжка бойца = 115-120px. Шаг ступеней строго 65-75px!
//      - Высота всех комнат и галерей = 140-150px (огромный запас для прыжков и стрельбы).
//      - Внутренние укрытия имеют высоту 40-48px (свободный прыжок поверх укрытия).
//   2. 3 непрерывных сквозных маршрута от базы до базы на всех картах:
//      - Верхний маршрут (Y = 560): непрерывный хайграунд (крыши, подвесные мосты, эстакады).
//      - Средний маршрут (Y = 700): непрерывная галерея 2-го этажа со скайбриджами между зданиями.
//      - Нижний маршрут (GT = 850): открытый уличный проспект со сквозными арками через здания.
//   3. Никаких невидимых преград! Архитектурные элементы (колонны, фермы, фонари)
//      рендерятся как визуальный декор (type: 'decor'), не имея физических коллизий.
//   4. Настоящие сплошные контрастные фоновые стены комнат (depth: -2.8):
//      - Внутренний объем зданий полностью залит тематическим интерьером (map_int_office,
//        map_int_factory, map_int_canyon, map_int_bunker).
//      - Видны оконные проемы с силуэтами города/скал, освещение и панели.
//   5. Свободные просторные фланги: спавны команд имеют открытый доступ во все 3 коридора.

export const CURRENT_GEN_VERSION = 10;

function addGround(objs, x, y, w, h, texKey) {
  objs.push({ type: 'ground', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), texKey });
}

function addPlat(objs, cx, top, w, h = 18, texKey = null) {
  const p = { cx, top, w, h, left: cx - w / 2, right: cx + w / 2 };
  const obj = { type: 'platform', x: Math.round(cx), y: Math.round(top + h / 2), w: Math.round(w), h: Math.round(h) };
  if (texKey) obj.texKey = texKey;
  objs.push(obj);
  return p;
}

function addCover(objs, cx, top, w, h, texKey) {
  objs.push({ type: 'cover', x: Math.round(cx), y: Math.round(top + h / 2), w: Math.round(w), h: Math.round(h), texKey });
  return { cx, top, w, h, left: cx - w / 2, right: cx + w / 2 };
}

// Визуальный декор (не имеет физических коллизий, не мешает ходьбе и прыжкам!)
function addDecor(objs, cx, cy, w, h, texKey, depth = -2) {
  objs.push({ type: 'decor', x: Math.round(cx), y: Math.round(cy), w: Math.round(w), h: Math.round(h), texKey, depth });
}

// Вертикальная несущая опора/пилон (визуальный декор, depth: -1.7)
function addPillar(objs, cx, topY, botY) {
  const h = botY - topY;
  if (h <= 6) return;
  addDecor(objs, cx, topY + h / 2, 32, h, 'map_support_pillar', -1.7);
}

// Посадка укрытия на платформу с безопасным зазором
function putOnPlat(objs, plat, relX, w, h, texKey) {
  const margin = 16;
  const availW = Math.max(30, plat.w - margin * 2);
  const safeW = Math.min(w, availW);
  const minX = plat.left + margin + safeW / 2;
  const maxX = plat.right - margin - safeW / 2;
  const cx = maxX > minX ? minX + (maxX - minX) * relX : plat.cx;
  return addCover(objs, cx, plat.top - h, safeW, h, texKey);
}

// -------------------------------------------------------------
// Здание со сквозным интерьером, фоновыми стенами и просторными этажами
// -------------------------------------------------------------
function buildHouse(objs, cx, roofTop, w, GT, opts = {}) {
  const leftX = cx - w / 2;
  const rightX = cx + w / 2;
  const totalH = GT - roofTop;

  const floor2Y = opts.floor2Y || 700;
  const roofY = opts.roofTop || 560;
  const floorTex = opts.floorTex || 'plat_office_floor';
  const roofTex = opts.roofTex || 'platform_city';
  const sections = opts.intSections || [opts.intTex || 'map_int_office'];

  // 1. РАЗНООБРАЗНЫЕ ФОНОВЫЕ СТЕНЫ ЗДАНИЯ (depth: -2.8)
  // Каждая комната/секция получает свой собственный арт из intSections!
  const cols = Math.max(1, Math.round(w / 240));
  const colW = w / cols;
  const h1 = GT - floor2Y;
  const h2 = floor2Y - roofY;
  for (let c = 0; c < cols; c++) {
    const wx = leftX + colW * (c + 0.5);
    const tex = sections[c % sections.length];
    // 1-й этаж
    addDecor(objs, wx, floor2Y + h1 / 2, colW, h1, tex, -2.8);
    // 2-й этаж
    addDecor(objs, wx, roofY + h2 / 2, colW, h2, tex, -2.8);
  }

  // 2. Вертикальные несущие пилоны по фасадам (чистый декор depth: -1.7, без коллизий)
  addPillar(objs, leftX + 16, roofY, GT);
  addPillar(objs, rightX - 16, roofY, GT);
  if (w > 500) {
    addPillar(objs, cx, roofY, GT);
  }

  // 3. Этаж 2 (Мезонины или сплошной этаж):
  let floor2;
  if (opts.mezzanines) {
    // ДВА БОКОВЫХ МЕЗОНИНА с открытым центральным залом/атриумом до самой крыши!
    // Никакого низкого потолка над центром — 100% свобода прыжков и стрельбы!
    const mezW = opts.mezW || 200;
    const mezLeft = addPlat(objs, leftX + mezW / 2 + 10, floor2Y, mezW, 18, floorTex);
    const mezRight = addPlat(objs, rightX - mezW / 2 - 10, floor2Y, mezW, 18, floorTex);
    floor2 = mezRight;

    // Лестничный подъем с земли на мезонин: ступень на границе открытого атриума
    const stairX = opts.stairsLeft ? leftX + mezW + 30 : rightX - mezW - 30;
    addDecor(objs, stairX, (GT + floor2Y) / 2, 32, GT - floor2Y, 'map_ladder_truss', -1.5);
    addPlat(objs, stairX, 775, 80, 16, floorTex);
  } else {
    const floor2W = w - (opts.openStairWidth ? 120 : 0);
    const floor2Cx = opts.openStairWidth ? (opts.stairsLeft ? cx + 60 : cx - 60) : cx;
    floor2 = addPlat(objs, floor2Cx, floor2Y, floor2W, 18, floorTex);

    const stair1X = opts.stairsLeft ? leftX + 60 : rightX - 60;
    addDecor(objs, stair1X, (GT + floor2Y) / 2, 32, GT - floor2Y, 'map_ladder_truss', -1.5);
    addPlat(objs, stair1X, 775, 110, 16, floorTex);
  }

  // 4. Крыша здания (Y = roofY = 560)
  const roof = addPlat(objs, cx, roofY, w, 20, roofTex);

  // 5. Выход на крышу: наружный шаг на Y = 630
  const stair2X = opts.stairsLeft ? leftX - 40 : rightX + 40;
  addDecor(objs, stair2X, (floor2Y + roofY) / 2, 32, floor2Y - roofY + 30, 'map_ladder_truss', -1.5);
  const outStep = addPlat(objs, stair2X, 630, 90, 16, floorTex);
  addPillar(objs, stair2X, outStep.top + 16, GT);

  // 6. Мебель и укрытия в комнатах
  if (opts.interior === 'office') {
    addCover(objs, leftX + 160, GT - 45, 100, 45, 'map_office_desk');
    addCover(objs, rightX - 160, GT - 45, 100, 45, 'map_office_desk');
    addCover(objs, cx, floor2Y - 45, 100, 45, 'map_office_desk');
  } else if (opts.interior === 'bunker') {
    addCover(objs, leftX + 160, GT - 48, 90, 48, 'map_shield');
    addCover(objs, rightX - 160, GT - 48, 90, 48, 'map_shield');
    addCover(objs, cx, floor2Y - 48, 90, 48, 'map_shield');
  } else if (opts.interior === 'industrial') {
    // В цехе укрытия стоят по бокам у колонн и в открытом центре, не мешая бегу
    addCover(objs, leftX + 180, GT - 50, 80, 50, 'map_generator');
    addCover(objs, rightX - 180, GT - 48, 80, 48, 'map_pipes');
    if (!opts.mezzanines) {
      addCover(objs, cx, floor2Y - 48, 50, 48, 'map_crate');
    }
  }

  return { cx, roofY, w, leftX, rightX, floor2, roof };
}

// -------------------------------------------------------------
// 1. АВАНПОСТ (W = 3800, Тема: Завод)
// -------------------------------------------------------------
function buildOutpost(W, H, GT) {
  const objs = [];
  const theme = 'zavod';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_beton');

  // Левый сборочный цех (База синих, cx = 650, W = 700):
  // Зонирование фоновых стен: Склад (ворота) -> Сборочный (окна/кран) -> Диспетчерская (мониторы)
  const bld1 = buildHouse(objs, 650, 560, 700, GT, {
    interior: 'industrial',
    intSections: ['map_int_fact_warehouse', 'map_int_fact_assembly', 'map_int_fact_control'],
    floorTex: 'plat_ind_girder',
    roofTex: 'plat_ind_girder',
    mezzanines: true,
    mezW: 190,
    stairsLeft: false
  });
  putOnPlat(objs, bld1.roof, 0.25, 100, 50, 'map_generator');
  putOnPlat(objs, bld1.roof, 0.75, 90, 48, 'map_pipes');

  // Правый сборочный цех (База красных, cx = W - 650, W = 700):
  // Зеркальное зонирование: Диспетчерская -> Сборочный -> Склад
  const bld2 = buildHouse(objs, W - 650, 560, 700, GT, {
    interior: 'industrial',
    intSections: ['map_int_fact_control', 'map_int_fact_assembly', 'map_int_fact_warehouse'],
    floorTex: 'plat_ind_girder',
    roofTex: 'plat_ind_girder',
    mezzanines: true,
    mezW: 190,
    stairsLeft: true
  });
  putOnPlat(objs, bld2.roof, 0.75, 100, 50, 'map_generator');
  putOnPlat(objs, bld2.roof, 0.25, 90, 48, 'map_pipes');

  // Центральный реакторный цех (cx = W/2 = 1900, W = 860):
  // Фоновые стены: Энергоблок/реактор (бронеплиты, вентили, манометры, знак радиации)
  const bldMid = buildHouse(objs, W * 0.50, 560, 860, GT, {
    interior: 'industrial',
    intSections: ['map_int_fact_reactor', 'map_int_fact_reactor', 'map_int_fact_reactor', 'map_int_fact_reactor'],
    floorTex: 'plat_ind_girder',
    roofTex: 'plat_ind_girder',
    mezzanines: true,
    mezW: 200,
    stairsLeft: false
  });
  putOnPlat(objs, bldMid.roof, 0.18, 90, 48, 'map_pipes');
  putOnPlat(objs, bldMid.roof, 0.82, 90, 48, 'map_pipes');

  // Верхняя диспетчерская вышка по центру (Y = 430, перепад от крыши 560 ровно 130px, ступени по 65px!):
  const tower = addPlat(objs, W * 0.50, 430, 260, 18, 'plat_ind_girder');
  addPillar(objs, W * 0.50 - 90, tower.top + 18, bldMid.roof.top);
  addPillar(objs, W * 0.50 + 90, tower.top + 18, bldMid.roof.top);
  // Ступени на вышку с крыши: 560 -> 495 -> 430
  addPlat(objs, W * 0.50 - 150, 495, 70, 16, 'plat_ind_girder');
  addPlat(objs, W * 0.50 + 150, 495, 70, 16, 'plat_ind_girder');
  putOnPlat(objs, tower, 0.5, 95, 48, 'map_generator');

  // ВЕРХНИЙ ХАЙГРАУНД-МАРШРУТ (Y = 560):
  // Высокие переходные мосты над улицей, соединяющие крыши цехов!
  // Мост 1: между левым цехом (x=1000) и реактором (x=1470), центр 1235, ширина 470
  const bridge1 = addPlat(objs, 1235, 560, 470, 18, 'plat_ind_girder');
  addPillar(objs, 1235, bridge1.top + 18, GT);
  putOnPlat(objs, bridge1, 0.5, 80, 45, 'map_sand_barrier');

  // Мост 2: между реактором (x=2330) и правым цехом (x=2800)
  const bridge2 = addPlat(objs, W - 1235, 560, 470, 18, 'plat_ind_girder');
  addPillar(objs, W - 1235, bridge2.top + 18, GT);
  putOnPlat(objs, bridge2, 0.5, 80, 45, 'map_sand_barrier');

  // ПОДЪЕМЫ С УЛИЦЫ НА ВЕРХНИЕ МОСТЫ (сбоку у стен зданий, полностью свободные!):
  // Лесенка у стены левого цеха (x = 1040): 850 -> 755 -> 655 -> 560 (чистый подъем!)
  addPlat(objs, 1040, 755, 75, 16, 'plat_ind_girder');
  addPlat(objs, 1040, 655, 75, 16, 'plat_ind_girder');
  addDecor(objs, 1040, 680, 32, 180, 'map_ladder_truss', -1.5);

  // Лесенка у стены правого цеха (x = W - 1040)
  addPlat(objs, W - 1040, 755, 75, 16, 'plat_ind_girder');
  addPlat(objs, W - 1040, 655, 75, 16, 'plat_ind_girder');
  addDecor(objs, W - 1040, 680, 32, 180, 'map_ladder_truss', -1.5);

  // НИЖНИЙ МАРШРУТ (УЛИЦА):
  // Машина стоит на земле (GT = 850), ее верх на 765.
  // Мост над ней — на высоте 560! Просвет над машиной — БОЛЕЕ 205 ПИКСЕЛЕЙ!
  // Никаких пересечений, никаких коллизий внутри — абсолютно чистый прыжок через машину!
  addCover(objs, 1235, GT - 84, 200, 84, 'map_wreck');
  addCover(objs, W - 1235, GT - 84, 200, 84, 'map_wreck');

  // Укрытия на нейтральной полосе
  addCover(objs, 1600, GT - 50, 90, 50, 'map_sand_barrier');
  addCover(objs, W * 0.50, GT - 50, 90, 50, 'map_sand_barrier');
  addCover(objs, W - 1600, GT - 50, 90, 50, 'map_sand_barrier');

  // Фонари уличного освещения (чистый визуальный декор)
  addDecor(objs, 1120, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, 1420, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, W - 1420, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, W - 1120, GT - 64, 32, 128, 'map_lamp_post', -1.2);

  const spawns = {
    player: { x: 420, y: GT - 60 },
    team: [
      { x: 330, y: GT - 60 },
      { x: 500, y: GT - 60 },
      { x: 880, y: 700 - 45 }
    ],
    enemies: [
      { x: W - 420, y: GT - 60 },
      { x: W - 330, y: GT - 60 },
      { x: W - 500, y: GT - 60 },
      { x: W * 0.50, y: 430 - 45 },
      { x: W - 1235, y: 560 - 45 },
      { x: W - 880, y: 700 - 45 }
    ],
    medkit: { x: Math.round(W * 0.50), y: 560 - 40 },
    ammo: [
      { x: 650, y: 560 - 40 },
      { x: W - 650, y: 560 - 40 }
    ],
    frag: [
      { x: 1235, y: 560 - 40 },
      { x: W - 1235, y: 560 - 40 }
    ],
    smoke: [
      { x: Math.round(W * 0.40), y: GT - 40 },
      { x: Math.round(W * 0.60), y: GT - 40 }
    ]
  };

  return { objs, theme, name: 'Аванпост «Рубеж»', spawns };
}

// -------------------------------------------------------------
// 2. КАНЬОН (W = 4200, Тема: Пустыня)
// -------------------------------------------------------------
function buildCanyon(W, H, GT) {
  const objs = [];
  const theme = 'pustinya';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_canyon_rock');

  // Западное скальное плато (База синих, cx = 700, W = 720):
  const mesaW = buildHouse(objs, 700, 560, 720, GT, {
    interior: 'office',
    intTex: 'map_int_canyon',
    floorTex: 'plat_canyon_wood',
    roofTex: 'platform_desert',
    stairsLeft: true
  });
  putOnPlat(objs, mesaW.roof, 0.25, 95, 50, 'map_dune_rock');
  putOnPlat(objs, mesaW.roof, 0.75, 80, 45, 'map_sand_barrier');

  // Восточное скальное плато (База красных, cx = W - 700, W = 720):
  const mesaE = buildHouse(objs, W - 700, 560, 720, GT, {
    interior: 'office',
    intTex: 'map_int_canyon',
    floorTex: 'plat_canyon_wood',
    roofTex: 'platform_desert',
    stairsLeft: false
  });
  putOnPlat(objs, mesaE.roof, 0.75, 95, 50, 'map_dune_rock');
  putOnPlat(objs, mesaE.roof, 0.25, 80, 45, 'map_sand_barrier');

  // Центральный скальный массив (cx = W/2, W = 820):
  const mesaMid = buildHouse(objs, W * 0.50, 560, 820, GT, {
    interior: 'office',
    intTex: 'map_int_canyon',
    floorTex: 'plat_canyon_wood',
    roofTex: 'platform_desert',
    stairsLeft: false
  });
  putOnPlat(objs, mesaMid.roof, 0.50, 80, 45, 'map_sand_barrier');

  // Дозорная скала каньона (Y = 430, ступени 560 -> 495 -> 430):
  const tower = addPlat(objs, W * 0.50, 430, 240, 18, 'plat_canyon_wood');
  addPillar(objs, W * 0.50, tower.top + 18, mesaMid.roof.top);
  addPlat(objs, W * 0.50 - 150, 495, 70, 16, 'plat_canyon_wood');
  addPlat(objs, W * 0.50 + 150, 495, 70, 16, 'plat_canyon_wood');
  putOnPlat(objs, tower, 0.5, 90, 50, 'map_dune_rock');

  // Средний маршрут (Y = 700): подвесные деревянные мосты через ущелье
  const bridge1 = addPlat(objs, 1310, 700, 520, 18, 'plat_canyon_wood');
  addPillar(objs, 1310, bridge1.top + 18, GT);
  putOnPlat(objs, bridge1, 0.5, 75, 45, 'map_bags');
  // Подъем с дна ущелья на мост: 850 -> 775 -> 700
  addPlat(objs, 1310, 775, 120, 16, 'plat_canyon_wood');

  const bridge2 = addPlat(objs, W - 1310, 700, 520, 18, 'plat_canyon_wood');
  addPillar(objs, W - 1310, bridge2.top + 18, GT);
  putOnPlat(objs, bridge2, 0.5, 75, 45, 'map_bags');
  addPlat(objs, W - 1310, 775, 120, 16, 'plat_canyon_wood');

  // Дно каньона: открытое ущелье с тактическими укрытиями каждые 260px
  addCover(objs, 1020, GT - 50, 80, 50, 'map_sand_barrier');
  addCover(objs, 1310, GT - 60, 100, 60, 'map_dune_rock');
  addCover(objs, 1680, GT - 85, 200, 85, 'map_wreck');
  addCover(objs, W * 0.50, GT - 45, 80, 45, 'map_bags');
  addCover(objs, W - 1680, GT - 85, 200, 85, 'map_wreck');
  addCover(objs, W - 1310, GT - 60, 100, 60, 'map_dune_rock');
  addCover(objs, W - 1020, GT - 50, 80, 50, 'map_sand_barrier');

  const spawns = {
    player: { x: 440, y: GT - 60 },
    team: [
      { x: 340, y: GT - 60 },
      { x: 540, y: GT - 60 },
      { x: 700, y: 700 - 45 }
    ],
    enemies: [
      { x: W - 440, y: GT - 60 },
      { x: W - 340, y: GT - 60 },
      { x: W - 540, y: GT - 60 },
      { x: W * 0.50, y: 430 - 45 },
      { x: W - 1310, y: 700 - 45 },
      { x: W - 700, y: 700 - 45 }
    ],
    medkit: { x: Math.round(W * 0.50), y: 560 - 40 },
    ammo: [
      { x: 700, y: 700 - 40 },
      { x: W - 700, y: 700 - 40 }
    ],
    frag: [
      { x: 1310, y: 700 - 40 },
      { x: W - 1310, y: 700 - 40 }
    ],
    smoke: [
      { x: Math.round(W * 0.40), y: GT - 40 },
      { x: Math.round(W * 0.60), y: GT - 40 }
    ]
  };

  return { objs, theme, name: 'Каньон «Сухой брод»', spawns };
}

// -------------------------------------------------------------
// 3. ВЫСОТКИ (W = 4600, Тема: Город)
// -------------------------------------------------------------
function buildRoofs(W, H, GT) {
  const objs = [];
  const theme = 'krisha';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_city_pavement');

  // Западный офисный корпус (База синих, cx = 680, W = 720):
  const bld1 = buildHouse(objs, 680, 560, 720, GT, {
    interior: 'office',
    intTex: 'map_int_office',
    floorTex: 'plat_office_floor',
    roofTex: 'platform_city',
    stairsLeft: false
  });
  putOnPlat(objs, bld1.roof, 0.22, 100, 55, 'map_vent_unit');
  putOnPlat(objs, bld1.roof, 0.78, 85, 45, 'map_concrete_block');

  // Западная центральная башня (cx = 1550, W = 620):
  const bld2 = buildHouse(objs, 1550, 560, 620, GT, {
    interior: 'office',
    intTex: 'map_int_office',
    floorTex: 'plat_office_floor',
    roofTex: 'platform_city',
    stairsLeft: true
  });
  putOnPlat(objs, bld2.roof, 0.50, 100, 55, 'map_vent_unit');

  // Главный Центральный Небоскреб (cx = W/2, W = 840, крыша Y = 560):
  const bldMid = buildHouse(objs, W * 0.50, 560, 840, GT, {
    interior: 'office',
    intTex: 'map_int_office',
    floorTex: 'plat_office_floor',
    roofTex: 'platform_city',
    stairsLeft: false
  });
  putOnPlat(objs, bldMid.roof, 0.18, 85, 45, 'map_concrete_block');
  putOnPlat(objs, bldMid.roof, 0.82, 85, 45, 'map_concrete_block');

  // Верхний пентхаус / вертолетная площадка (Y = 430, ступени 560 -> 495 -> 430):
  const topRoof = addPlat(objs, W * 0.50, 430, 280, 18, 'plat_office_floor');
  addPillar(objs, W * 0.50 - 100, topRoof.top + 18, bldMid.roof.top);
  addPillar(objs, W * 0.50 + 100, topRoof.top + 18, bldMid.roof.top);
  addPlat(objs, W * 0.50 - 170, 495, 70, 16, 'plat_office_floor');
  addPlat(objs, W * 0.50 + 170, 495, 70, 16, 'plat_office_floor');
  putOnPlat(objs, topRoof, 0.50, 100, 55, 'map_vent_unit');

  // Восточная центральная башня (cx = W - 1550, W = 620):
  const bld4 = buildHouse(objs, W - 1550, 560, 620, GT, {
    interior: 'office',
    intTex: 'map_int_office',
    floorTex: 'plat_office_floor',
    roofTex: 'platform_city',
    stairsLeft: false
  });
  putOnPlat(objs, bld4.roof, 0.50, 100, 55, 'map_vent_unit');

  // Восточный офисный корпус (База красных, cx = W - 680, W = 720):
  const bld5 = buildHouse(objs, W - 680, 560, 720, GT, {
    interior: 'office',
    intTex: 'map_int_office',
    floorTex: 'plat_office_floor',
    roofTex: 'platform_city',
    stairsLeft: true
  });
  putOnPlat(objs, bld5.roof, 0.78, 100, 55, 'map_vent_unit');
  putOnPlat(objs, bld5.roof, 0.22, 85, 45, 'map_concrete_block');

  // Средний маршрут (Y = 700): остекленные воздушные скайбриджи между высотками
  // Скайбридж 1 (между корпусом 1 и башней 2, центр 1140, ширина 380)
  const bridge1 = addPlat(objs, 1140, 700, 380, 18, 'plat_office_floor');
  addPillar(objs, 1140, bridge1.top + 18, GT);
  putOnPlat(objs, bridge1, 0.5, 85, 45, 'map_concrete_block');
  addPlat(objs, 1140, 775, 120, 16, 'plat_office_floor');

  // Скайбридж 2 (между башней 2 и небоскребом Mid, центр 1920, ширина 300)
  const bridge2 = addPlat(objs, 1920, 700, 300, 18, 'plat_office_floor');
  addPillar(objs, 1920, bridge2.top + 18, GT);

  // Скайбридж 3 (между небоскребом Mid и башней 4)
  const bridge3 = addPlat(objs, W - 1920, 700, 300, 18, 'plat_office_floor');
  addPillar(objs, W - 1920, bridge3.top + 18, GT);

  // Скайбридж 4 (между башней 4 и корпусом 5)
  const bridge4 = addPlat(objs, W - 1140, 700, 380, 18, 'plat_office_floor');
  addPillar(objs, W - 1140, bridge4.top + 18, GT);
  putOnPlat(objs, bridge4, 0.5, 85, 45, 'map_concrete_block');
  addPlat(objs, W - 1140, 775, 120, 16, 'plat_office_floor');

  // Верхний маршрут (Y = 560): переходные эстакады по крышам
  const roofBridge1 = addPlat(objs, 1140, 560, 320, 18, 'platform_city');
  addPillar(objs, 1140, roofBridge1.top + 18, 700);
  const roofBridge2 = addPlat(objs, W - 1140, 560, 320, 18, 'platform_city');
  addPillar(objs, W - 1140, roofBridge2.top + 18, 700);

  // Нижний маршрут: широкий городской проспект с автомобилями и бетонными блоками
  addCover(objs, 240, GT - 45, 85, 45, 'map_concrete_block');
  addCover(objs, 1140, GT - 85, 200, 85, 'map_wreck');
  addCover(objs, 1550, GT - 45, 85, 45, 'map_concrete_block');
  addCover(objs, W * 0.50, GT - 85, 200, 85, 'map_wreck');
  addCover(objs, W - 1550, GT - 45, 85, 45, 'map_concrete_block');
  addCover(objs, W - 1140, GT - 85, 200, 85, 'map_wreck');
  addCover(objs, W - 240, GT - 45, 85, 45, 'map_concrete_block');

  // Городские фонари
  addDecor(objs, 1020, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, 1360, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, 1800, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, W - 1800, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, W - 1360, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, W - 1020, GT - 64, 32, 128, 'map_lamp_post', -1.2);

  const spawns = {
    player: { x: 440, y: GT - 60 },
    team: [
      { x: 340, y: GT - 60 },
      { x: 540, y: GT - 60 },
      { x: 680, y: 700 - 45 }
    ],
    enemies: [
      { x: W - 440, y: GT - 60 },
      { x: W - 340, y: GT - 60 },
      { x: W - 540, y: GT - 60 },
      { x: W * 0.50, y: 430 - 45 },
      { x: W - 1140, y: 700 - 45 },
      { x: W - 680, y: 700 - 45 }
    ],
    medkit: { x: Math.round(W * 0.50), y: 430 - 40 },
    ammo: [
      { x: 1550, y: 700 - 40 },
      { x: W - 1550, y: 700 - 40 }
    ],
    frag: [
      { x: 1140, y: 700 - 40 },
      { x: W - 1140, y: 700 - 40 }
    ],
    smoke: [
      { x: Math.round(W * 0.40), y: GT - 40 },
      { x: Math.round(W * 0.60), y: GT - 40 }
    ]
  };

  return { objs, theme, name: 'Квартал «Высотки»', spawns };
}

// -------------------------------------------------------------
// 4. БУНКЕР (W = 5000, Тема: Пещера)
// -------------------------------------------------------------
function buildBunker(W, H, GT) {
  const objs = [];
  const theme = 'pechera';
  addGround(objs, W / 2, GT + 25, W, 50, 'gr_stones');

  // Западный капонир (База синих, cx = 720, W = 760):
  const fortL = buildHouse(objs, 720, 560, 760, GT, {
    interior: 'bunker',
    intTex: 'map_int_bunker',
    floorTex: 'plat_bunker_slab',
    roofTex: 'plat_bunker_slab',
    stairsLeft: false
  });
  putOnPlat(objs, fortL.roof, 0.22, 90, 48, 'map_shield');
  putOnPlat(objs, fortL.roof, 0.78, 90, 55, 'map_stalagmite');

  // Восточный капонир (База красных, cx = W - 720, W = 760):
  const fortR = buildHouse(objs, W - 720, 560, 760, GT, {
    interior: 'bunker',
    intTex: 'map_int_bunker',
    floorTex: 'plat_bunker_slab',
    roofTex: 'plat_bunker_slab',
    stairsLeft: true
  });
  putOnPlat(objs, fortR.roof, 0.78, 90, 48, 'map_shield');
  putOnPlat(objs, fortR.roof, 0.22, 90, 55, 'map_stalagmite');

  // Центральный Командный Бункер (cx = W/2, W = 900, крыша Y = 560):
  const citadel = buildHouse(objs, W * 0.50, 560, 900, GT, {
    interior: 'bunker',
    intTex: 'map_int_bunker',
    floorTex: 'plat_bunker_slab',
    roofTex: 'plat_bunker_slab',
    stairsLeft: false
  });
  putOnPlat(objs, citadel.roof, 0.18, 90, 48, 'map_shield');
  putOnPlat(objs, citadel.roof, 0.82, 90, 48, 'map_shield');

  // Верхний наблюдательный купол (Y = 430, ступени 560 -> 495 -> 430):
  const cupola = addPlat(objs, W * 0.50, 430, 260, 18, 'plat_bunker_slab');
  addPillar(objs, W * 0.50 - 90, cupola.top + 18, citadel.roof.top);
  addPillar(objs, W * 0.50 + 90, cupola.top + 18, citadel.roof.top);
  addPlat(objs, W * 0.50 - 160, 495, 70, 16, 'plat_bunker_slab');
  addPlat(objs, W * 0.50 + 160, 495, 70, 16, 'plat_bunker_slab');
  putOnPlat(objs, cupola, 0.5, 85, 50, 'map_stalagmite');

  // Средний маршрут (Y = 700): бронированные переходные штольни
  const ramp1 = addPlat(objs, 1380, 700, 560, 18, 'plat_bunker_slab');
  addPillar(objs, 1380, ramp1.top + 18, GT);
  putOnPlat(objs, ramp1, 0.5, 90, 48, 'map_shield');
  addPlat(objs, 1380, 775, 120, 16, 'plat_bunker_slab');

  const ramp2 = addPlat(objs, W - 1380, 700, 560, 18, 'plat_bunker_slab');
  addPillar(objs, W - 1380, ramp2.top + 18, GT);
  putOnPlat(objs, ramp2, 0.5, 90, 48, 'map_shield');
  addPlat(objs, W - 1380, 775, 120, 16, 'plat_bunker_slab');

  // Освещение штолен (визуальный декор)
  addDecor(objs, 1120, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, 1720, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, W - 1720, GT - 64, 32, 128, 'map_lamp_post', -1.2);
  addDecor(objs, W - 1120, GT - 64, 32, 128, 'map_lamp_post', -1.2);

  // Нижний маршрут: широкий тоннельный проспект с щитами и бочками (шаг 260px)
  addCover(objs, 1120, GT - 48, 90, 48, 'map_shield');
  addCover(objs, 1380, GT - 55, 90, 55, 'map_stalagmite');
  addCover(objs, 1720, GT - 48, 90, 48, 'map_shield');
  addCover(objs, W * 0.50, GT - 48, 44, 48, 'map_barrel');
  addCover(objs, W - 1720, GT - 48, 90, 48, 'map_shield');
  addCover(objs, W - 1380, GT - 55, 90, 55, 'map_stalagmite');
  addCover(objs, W - 1120, GT - 48, 90, 48, 'map_shield');

  const spawns = {
    player: { x: 440, y: GT - 60 },
    team: [
      { x: 340, y: GT - 60 },
      { x: 540, y: GT - 60 },
      { x: 720, y: 700 - 45 }
    ],
    enemies: [
      { x: W - 440, y: GT - 60 },
      { x: W - 340, y: GT - 60 },
      { x: W - 540, y: GT - 60 },
      { x: W * 0.50, y: 430 - 45 },
      { x: W - 1380, y: 700 - 45 },
      { x: W - 720, y: 700 - 45 }
    ],
    medkit: { x: Math.round(W * 0.50), y: 560 - 40 },
    ammo: [
      { x: 720, y: 700 - 40 },
      { x: W - 720, y: 700 - 40 }
    ],
    frag: [
      { x: 1380, y: 700 - 40 },
      { x: W - 1380, y: 700 - 40 }
    ],
    smoke: [
      { x: Math.round(W * 0.40), y: GT - 40 },
      { x: Math.round(W * 0.60), y: GT - 40 }
    ]
  };

  return { objs, theme, name: 'Бункер «Омега»', spawns };
}

// -------------------------------------------------------------
// Экспорт генератора уровня
// -------------------------------------------------------------
export function generateLevel(seedOrIndex = 0) {
  const index = Math.abs(typeof seedOrIndex === 'number' ? seedOrIndex : 0) % 4;
  const H = 900;
  const GT = 850;

  let res;
  let width;
  if (index === 0) {
    width = 3800;
    res = buildOutpost(width, H, GT);
  } else if (index === 1) {
    width = 4200;
    res = buildCanyon(width, H, GT);
  } else if (index === 2) {
    width = 4600;
    res = buildRoofs(width, H, GT);
  } else {
    width = 5000;
    res = buildBunker(width, H, GT);
  }

  const levelObjects = [];
  levelObjects.push(...res.objs);

  // Точки спавна
  levelObjects.push({ type: 'spawn', spawnType: 'player', x: res.spawns.player.x, y: res.spawns.player.y });
  res.spawns.team.forEach(t => levelObjects.push({ type: 'spawn', spawnType: 'team', x: t.x, y: t.y }));
  res.spawns.enemies.forEach(e => levelObjects.push({ type: 'spawn', spawnType: 'enemy', x: e.x, y: e.y }));

  // Базы флагов для CTF
  levelObjects.push({ type: 'spawn', spawnType: 'flagBlue', x: 200, y: GT - 38 });
  levelObjects.push({ type: 'spawn', spawnType: 'flagRed', x: width - 200, y: GT - 38 });

  // Припасы
  if (res.spawns.medkit) levelObjects.push({ type: 'item', itemType: 'medkit', x: res.spawns.medkit.x, y: res.spawns.medkit.y });
  (res.spawns.ammo || []).forEach(a => levelObjects.push({ type: 'item', itemType: 'ammo', x: a.x, y: a.y }));
  (res.spawns.frag || []).forEach(f => levelObjects.push({ type: 'item', itemType: 'frag', x: f.x, y: f.y }));
  (res.spawns.smoke || []).forEach(s => levelObjects.push({ type: 'item', itemType: 'smoke', x: s.x, y: s.y }));

  const levelData = {
    name: res.name + ' ' + (Math.floor(Math.random() * 89) + 10),
    theme: res.theme,
    mode: 'TDM',
    width,
    height: H,
    enemies: res.spawns.enemies.length,
    allies: res.spawns.team.length,
    enemyTypes: ['Assault', 'Sniper', 'Tank', 'Medic'],
    objects: levelObjects,
    scoreLimit: 20,
    timeLimit: 300,
    genVersion: CURRENT_GEN_VERSION
  };

  return levelData;
}
