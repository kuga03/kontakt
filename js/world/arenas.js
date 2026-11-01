// arenas.js — процедурные арены режимов и фоновый декор (было в GameScene).
// Функции принимают сцену; платформы/укрытия — через обёртки сцены
// (createPlatform/createCover → world/mapPrimitives.js), внутри модуля
// зовём друг друга напрямую (pickDecor/mapDecor), как в modes/koth.js.

export function pickDecor(scene, keys, exclude) {
  try {
    let avail = (keys || []).filter(k => scene.textures.exists(k));
    if (!avail.length) return null;
    // Запрет клонов (ТЗ п.3.12): один и тот же ключ в пределах одного прохода
    // декора не повторяется — даже с другим размером/зеркалом глаз цепляет
    // копию. Исключаем уже поставленные; если свежих не осталось (пул меньше
    // слотов) — берём из всех, чтобы не оставлять дыру.
    try {
      if (exclude && exclude.size) {
        const fresh = avail.filter(k => !exclude.has(k));
        if (fresh.length) avail = fresh;
      }
    } catch (e) {}
    const k = avail[Phaser.Math.Between(0, avail.length - 1)];
    try { if (exclude && exclude.add) exclude.add(k); } catch (e) {}
    return k;
  } catch (e) { return null; }
}

// Фоновый дом без коллизии (арты for maps): стоит низом на yBottom.
// depth: -5 ближний ряд, -8 дальний (чуть приглушён).
// Над землёй, под игроками. Нет текстуры — пропуск.
// Здания притапливаем глубже + тень-присадка, иначе висят в воздухе.
export function mapDecor(scene, x, yBottom, texKey, dispH, alpha = 1, depth) {
  try {
    if (!texKey || !scene.textures.exists(texKey)) return;
    // Мелкий холст (баррикада 200x140) при апскейле до рядов 300/200 мылится
    // и выглядит раздутой — компактнее отдельные ключи показывает сам mapDecor.
    if (texKey === 'map_scrap') dispH = Math.round((dispH || 0) * 0.75);
    const src = scene.textures.get(texKey).getSourceImage();
    const sw = (src && src.width) || 1, sh = (src && src.height) || 1;
    // Высокие притапливаем на 26: низы холстов неидеальны, а парящий
    // задник хуже притопленного (двери всё равно выше низа стоят).
    const sink = (dispH || 0) >= 150 ? 26 : 8;
    const dw = dispH * sw / sh;
    const dep = depth != null ? depth : -5;
    const sh2 = scene.add.ellipse(x, yBottom + 8, dw * 0.5, 12, 0x000000, 0.32);
    sh2.setDepth(dep - 0.01);
    // Джиттер размера ±10%: РАЗНЫЕ арты выглядят живее.
    // Одинаковый ключ дважды с разным джиттером — запрещён (ТЗ п.3.12):
    // уникальность обеспечивает pickDecor(exclude), сюда клон не доходит.
    // Низ стоит на месте (yBottom + sink) — парения не даёт.
    const js = 0.9 + Math.random() * 0.2;
    const dh = dispH * js;
    const img = scene.add.image(x, yBottom - dh / 2 + sink, texKey);
    img.setDisplaySize(dw * js, dh);
    img.setDepth(dep);
    // Задники без текста можно зеркалить (удваивает разнообразие).
    // С вывесками (кино/почта/магазины) не трогаем — текст поплывёт.
    // Зеркало допустимо только для одиночного экземпляра: тот же ключ
    // вторым (зеркально/в другом размере) — запрещён (ТЗ п.3.12).
    try {
      if (texKey === 'map_ruin' || texKey === 'map_ruin2' || texKey === 'map_scrap' ||
          texKey === 'map_wreck' || texKey === 'map_ruin3' ||
          texKey === 'map_ruin4' || texKey === 'map_ruin5' ||
          texKey === 'map_ruin6' || texKey === 'map_ruin7' ||
          texKey === 'map_tank' || texKey === 'map_tower' || texKey === 'map_bags' ||
          texKey === 'map_sarai' || texKey === 'map_derevdom' || texKey === 'map_garage' ||
          texKey === 'map_domik' || texKey === 'map_domik2' || texKey === 'map_mini_dom' ||
          texKey === 'map_zdanie') {
        img.setFlipX(Math.random() < 0.5);
      }
    } catch (e) {}
    if (alpha < 1) img.setAlpha(alpha);
  } catch (e) {}
}

// Задник для карт режимов из level-objects (maps/*.json): в файлах только
// геометрия, без фона — тянем те же два ряда домов и заграждения, что и
// в процедурных аренах. Только картинки (depth -8/-5), коллизии нет.
// Пустоши — свои постройки (руины/сараи/хлам): кино и почта среди
// мёртвой земли не стоят.
export function addModeDecor(scene) {
  const W = scene.mapWidth, GT = scene.mapHeight - 50, cx = W / 2;
  let theme = null;
  try { theme = (scene && scene.campaignLevel && scene.campaignLevel.theme) || null; } catch (e) {}
  const waste = theme === 'wasteland';
  const factory = theme === 'zavod';
  const desert = theme === 'pustinya' || theme === 'pustoch';
  // Пещеры — не город: магазины с вывесками под землёй не стоят.
  // Только техническое: гаражи, хлам, металл, заграждения.
  const cave = theme === 'pechera' || theme === 'peshera';
  // Пустошь — только тёмное (руины/хлам/остов): сараи и гаражи выведены,
  // у них лампы и светящиеся окна, а земля мёртвая.
  // Пулы без весовых дублей: повтор ключа в одном проходе запрещён
  // (ТЗ п.3.12), вес задаём размером пула, а не дублями.
  const farPool = waste
    ? ['map_ruin', 'map_ruin2', 'map_ruin3', 'map_ruin4', 'map_ruin5', 'map_ruin6', 'map_ruin7', 'map_tower']
    : factory
    ? ['map_zdanie', 'map_garage', 'map_sarai', 'map_derevdom', 'map_tower', 'map_tank']
    : desert
    ? ['map_ruin', 'map_ruin2', 'map_ruin3', 'map_ruin4', 'map_ruin6', 'map_domik', 'map_derevdom']
    : cave
    ? ['map_scrap', 'map_garage', 'map_wall_metal']
    : ['map_bigdom', 'map_zdanie', 'map_kino', 'map_pochta', 'map_stol'];
  const nearPool = waste
    ? ['map_scrap', 'map_wreck', 'map_ruin4', 'map_ruin5', 'map_ruin6', 'map_ruin7', 'map_tank', 'map_bags', 'map_ruin', 'map_ruin2', 'map_ruin3']
    : factory
    ? ['map_scrap', 'map_garage', 'map_sarai', 'map_derevdom', 'map_tank', 'map_bags']
    : desert
    ? ['map_scrap', 'map_ruin5', 'map_ruin7', 'map_domik', 'map_derevdom', 'map_sarai', 'map_mini_dom']
    : cave
    ? ['map_scrap', 'map_rabica', 'map_eji', 'map_wire', 'map_barrel']
    : ['map_domik', 'map_domik2', 'map_derevdom', 'map_mini_dom', 'map_garage', 'map_apteka', 'map_shop'];
  // Сквозная уникальность на весь проход (оба ряда + края): один ключ —
  // один экземпляр на карту. Клонов разного размера/зеркальных нет.
  const used = new Set();
  [0.06, 0.28, 0.5, 0.72, 0.94].forEach((f, i) => {
    const k = pickDecor(scene, farPool, used);
    if (k) mapDecor(scene, W * f + (i % 2 ? 40 : -40), GT, k, 300, 0.9, -8);
  });
  [0.17, 0.4, 0.6, 0.83].forEach((f, i) => {
    const k = pickDecor(scene, nearPool, used);
    if (k) mapDecor(scene, W * f + (i % 2 ? -30 : 30), GT, k, 200, 1, -5);
  });
  // Край карты: по два дома за границами (дальний + ближний; границы
  // игрока не трогаем — только картинки). Иначе за краем пустота.
  const ke = pickDecor(scene, farPool, used);
  if (ke) mapDecor(scene, -260, GT, ke, 300, 0.9, -8);
  const ke2 = pickDecor(scene, farPool, used);
  if (ke2) mapDecor(scene, W + 260, GT, ke2, 300, 0.9, -8);
  const ke3 = pickDecor(scene, nearPool, used);
  if (ke3) mapDecor(scene, -520, GT, ke3, 200, 1, -5);
  const ke4 = pickDecor(scene, nearPool, used);
  if (ke4) mapDecor(scene, W + 520, GT, ke4, 200, 1, -5);
  // Низовой мусор (проволока/ежи/сетка): без коллизии по дизайну,
  // поэтому притоплен и приглушён — читается грунтом, а не заграждением.
  mapDecor(scene, W * 0.06, GT + 14, 'map_wire', 110, 0.8);
  mapDecor(scene, W * 0.94, GT + 14, 'map_wire', 110, 0.8);
  mapDecor(scene, cx - 260, GT + 16, 'map_eji', 70, 0.85);
  mapDecor(scene, cx + 260, GT + 16, 'map_eji', 70, 0.85);
  mapDecor(scene, W * 0.32, GT + 8, 'map_rabica', 90, 0.8);
  mapDecor(scene, W * 0.68, GT + 8, 'map_rabica', 90, 0.8);
}

// Арена бомбы (зеркально от центра): земля + верхний ярус по бокам
// (платформы со ступенями-ящиками, шаг ≤60 — носильщики проходят),
// центр открыт. Два варианта. Базы и проход к ним чистые.
export function buildBombArena(scene) {
  const W = scene.mapWidth, GT = scene.mapHeight - 50;
  const cx = W / 2;
  const V = scene._arenaVariant || 0;
  // Центр-замес: пары бочек (прострел поверх, перепрыг через верх).
  // Проходы между бочками ≥90px (тело k=2.2 — 66px): иначе щели-ловушки.
  (V === 1 ? [-230, -80, 80, 230] : [-225, -80, 80, 225]).forEach(dx => {
    // Центральные меньшие — разнообразие укрытий вместо бочек (шины/
    // канистры): проход и размер тот же, только вид.
    const small = Math.abs(dx) === 80;
    const key = small ? (V === 1 ? 'map_tires' : 'map_jerry') : 'map_barrel';
    scene.createCover(cx + dx, GT - 30, 55, 60, scene.textures.exists(key) ? key : 'map_barrel');
  });
  // Верхний ярус по бокам: платформы (верх на 100) + ящики-ступени
  // снаружи (верх на 60). Второй путь к базам, не только низ.
  // V1 — платформы шире к краям.
  const platF = V === 1 ? [0.28, 0.72] : [0.33, 0.67];
  platF.forEach(f => {
    const px = W * f;
    scene.createPlatform(px, GT - 100 + 8, 200, 16);
    const out = f < 0.5 ? -1 : 1;
    scene.createCover(px + out * 155, GT - 30, 55, 60, 'map_barrel');
    scene.createCover(px, GT - 100 - 25, 50, 50, 'map_barrel');
  });
  // Боковые укрытия: длинные ящики на земле (низ прибит к грунту),
  // а не частокол бочек. V1 — дальше от центра.
  (V === 1 ? [-260, 260] : [-250, 250]).forEach(dx => {
    const key = scene.textures.exists('map_crate') ? 'map_crate' : 'map_barrel';
    scene.createCover(cx + dx, GT - 35, 140, 70, key, { anchorBottom: true });
  });
  // Бочки-укрытия у баз (пара). Низкие (60): lanes идут и носильщики
  // (прыжок носильщика-игрока 78px — выше 60 ему не взять).
  [420, W - 420].forEach(px => {
    scene.createCover(px, GT - 30, 55, 60, 'map_barrel');
  });
  // Задник в два ряда + заграждения (без коллизии). Каждый матч разные.
  // Заводская тема: цеха и сараи, без кино и магазинов.
  // Уникальность как в addModeDecor (ТЗ п.3.12): без клонов.
  const _usedBomb = new Set();
  const h1 = pickDecor(scene, ['map_garage', 'map_sarai', 'map_derevdom'], _usedBomb);
  const h2 = pickDecor(scene, ['map_zdanie', 'map_garage', 'map_sarai'], _usedBomb);
  const h3 = pickDecor(scene, ['map_stol', 'map_sarai', 'map_garage'], _usedBomb);
  if (h1) mapDecor(scene, 70, GT, h1, 200);
  if (h1) mapDecor(scene, W - 70, GT, h1 === 'map_garage' ? 'map_sarai' : 'map_garage', 170);
  if (h2) mapDecor(scene, -160, GT, h2, 260);
  if (h3) mapDecor(scene, W + 160, GT, h3, 260);
  const hbFar = ['map_zdanie', 'map_garage', 'map_sarai', 'map_derevdom'];
  [0.3, 0.5, 0.7].forEach((f, i) => {
    const k = pickDecor(scene, hbFar, _usedBomb);
    if (k) mapDecor(scene, W * f + (i % 2 ? 60 : -60), GT, k, 300, 0.9, -8);
  });
  mapDecor(scene, W * 0.1, GT + 8, 'map_wire', 110);
  mapDecor(scene, W * 0.9, GT + 8, 'map_wire', 110);
  mapDecor(scene, cx - 330, GT, 'map_eji', 70);
  mapDecor(scene, cx + 330, GT, 'map_eji', 70);
  mapDecor(scene, W * 0.32, GT, 'map_rabica', 90);
  mapDecor(scene, W * 0.68, GT, 'map_rabica', 90);
}

// Симметричная арена точек (зеркально от центра): земля + платформа B
// (верх на 90 выше земли — допрыгиваемо), низкие укрытия у зон, боковые
// ступени. Всё парное, условия равные. Без «ям»: укрытия низкие (70)
// и широко (края ±145 от центра) — бот заходит свободно и даже стоя
// на укрытии засчитывается (|6-70|=64 < 70). Верх B чистый (негде застрять
// в прыжке), прикрытие подхода — бочки на земле по бокам.
// Внешность — бочки/металл (for maps).
export function buildKothArena(scene) {
  const W = scene.mapWidth, GT = scene.mapHeight - 50;
  const V = scene._arenaVariant || 0;
  // Центр B: платформа 280x24, верх чистый.
  scene.createPlatform(W / 2, GT - 90 + 12, 280, 24);
  // Прикрытие подхода к B с земли (пара, вне footprint платформы ±140):
  // канистры — разнообразие укрытий (вместо одних и тех же бочек).
  const jerryK = scene.textures.exists('map_jerry') ? 'map_jerry' : 'map_barrel';
  scene.createCover(W / 2 - 185, GT - 30, 60, 60, jerryK);
  scene.createCover(W / 2 + 185, GT - 30, 60, 60, jerryK);
  // V1 — пара низких укрытий ближе к центру: патронные ларцы (прыгаемо).
  if (V === 1) {
    const ammoK = scene.textures.exists('map_ammo') ? 'map_ammo' : 'map_barrel';
    scene.createCover(W / 2 - 260, GT - 25, 50, 50, ammoK);
    scene.createCover(W / 2 + 260, GT - 25, 50, 50, ammoK);
  }
  // Боковые ступени (пара). V1 — шире к краям.
  const stF = V === 1 ? [0.33, 0.67] : [0.375, 0.625];
  stF.forEach(f => {
    scene.createPlatform(W * f, GT - 100 + 8, 200, 16);
  });
  // Укрытия у зон A и C: по одному низкому ящику с каждой стороны.
  // V0 — широко (±145, заход 150px открыт); V1 — ближе (±120, проход уже,
  // мясорубка плотнее). Хитбокс 140×70, низ на земле. Высота 70 — все
  // перепрыгивают.
  [0.25, 0.75].forEach(f => {
    const px = W * f;
    const off = V === 1 ? 120 : 145;
    const key = scene.textures.exists('map_crate') ? 'map_crate' : (f < 0.5 ? 'map_wall_iron2' : 'map_wall_metal');
    scene.createCover(px - off, GT - 35, 140, 70, key, { anchorBottom: true });
    scene.createCover(px + off, GT - 35, 140, 70, key, { anchorBottom: true });
  });
  // Задник в два ряда: дальний (меньше, прозрачнее) + ближний.
  // Каждый матч разные. Холмы — пустыня/руины: халупы, сараи и руины,
  // без городских вывесок.
  // Уникальность как в addModeDecor (ТЗ п.3.12): без клонов.
  const _usedKoth = new Set();
  const kd1 = pickDecor(scene, ['map_domik', 'map_domik2', 'map_derevdom'], _usedKoth);
  const kd2 = pickDecor(scene, ['map_scrap', 'map_sarai', 'map_garage'], _usedKoth);
  const kd3 = pickDecor(scene, ['map_ruin', 'map_ruin2', 'map_ruin4', 'map_ruin6'], _usedKoth);
  const kd4 = pickDecor(scene, ['map_mini_dom', 'map_garage', 'map_sarai'], _usedKoth);
  if (kd1) mapDecor(scene, 90, GT, kd1, 210);
  if (kd2) mapDecor(scene, W - 90, GT, kd2, 210);
  if (kd3) mapDecor(scene, -180, GT, kd3, 240);
  if (kd4) mapDecor(scene, W + 180, GT, kd4, 240);
  const kdFar = ['map_ruin', 'map_ruin2', 'map_ruin5', 'map_ruin7', 'map_garage', 'map_derevdom'];
  [0.15, 0.4, 0.6, 0.85].forEach((f, i) => {
    const k = pickDecor(scene, kdFar, _usedKoth);
    if (k) mapDecor(scene, W * f + (i % 2 ? 50 : -50), GT, k, 300, 0.9, -8);
  });
  // Заграждения: колючка у краёв, ежи у центра (декор).
  mapDecor(scene, W * 0.06, GT + 8, 'map_wire', 110);
  mapDecor(scene, W * 0.94, GT + 8, 'map_wire', 110);
  mapDecor(scene, W * 0.42, GT, 'map_eji', 70);
  mapDecor(scene, W * 0.58, GT, 'map_eji', 70);
}

// Арена перестрелок (командный бой / каждый за себя / захват флага):
// два яруса (земля + платформы), ступени-ящики к платформам (шаг ≤60 —
// заходят и носильщики), спавны/флаги (x<350, x>W-350) чистые.
// Два варианта + богатый задник в два ряда.
export function buildSkirmishArena(scene) {
  const W = scene.mapWidth, GT = scene.mapHeight - 50;
  const cx = W / 2;
  const V = scene._arenaVariant || 0;
  // Центр: пары бочек. Проходы ≥90px (тело k=2.2 — 66px).
  (V === 1 ? [-230, -80, 80, 230] : [-225, -80, 80, 225]).forEach(dx => {
    scene.createCover(cx + dx, GT - 30, 55, 60, 'map_barrel');
  });
  // Средние платформы с бочкой наверху (верх на 100 выше земли) +
  // ящики-ступени по бокам (верх на 60): земля → 60 → 100.
  // V0 — платформы на 0.35/0.65; V1 — шире (0.3/0.7) + насест в центре.
  const midF = V === 1 ? [0.3, 0.7] : [0.35, 0.65];
  midF.forEach(f => {
    const px = W * f;
    scene.createPlatform(px, GT - 100 + 8, 200, 16);
    scene.createCover(px, GT - 100 - 25, 50, 50, 'map_barrel');
    scene.createCover(px - 155, GT - 30, 55, 60, 'map_barrel');
    scene.createCover(px + 155, GT - 30, 55, 60, 'map_barrel');
  });
  if (V === 1) {
    // Насест в центре (верх на 150): со средних платформ шаг 50.
    scene.createPlatform(cx, GT - 150 + 8, 160, 16);
  }
  // Четвертные укрытия (V1 — одиночные на 0.2/0.8 + рабица рядом).
  // V0: был парой со щелью 15px — ловушка; заменено широким низким
  // ящиком 140x70 (проход вокруг свободный, верх берётся прыжком).
  (V === 1 ? [0.2, 0.8] : [0.25, 0.75]).forEach(f => {
    if (V === 1) {
      scene.createCover(W * f, GT - 30, 60, 60, 'map_barrel');
      mapDecor(scene, W * f + (f < 0.5 ? 70 : -70), GT, 'map_rabica', 90);
    } else {
      const key = scene.textures.exists('map_crate') ? 'map_crate' : 'map_barrel';
      scene.createCover(W * f, GT - 35, 140, 70, key, { anchorBottom: true });
    }
  });
  // Боковые укрытия у краёв (пары, прыгаемо).
  [0.12, 0.88].forEach(f => {
    scene.createCover(W * f - 30, GT - 25, 50, 50, 'map_barrel');
    scene.createCover(W * f + 30, GT - 25, 50, 50, 'map_barrel');
  });
  // Задник в два ряда: дальний (меньше, прозрачнее) + ближний.
  // Каждый матч другие дома. Уникальность как в addModeDecor (ТЗ п.3.12).
  const _usedSk = new Set();
  const farPool = ['map_bigdom', 'map_zdanie', 'map_kino', 'map_pochta', 'map_stol'];
  const nearPool = ['map_domik', 'map_domik2', 'map_derevdom', 'map_mini_dom', 'map_garage', 'map_apteka', 'map_shop'];
  [0.06, 0.28, 0.5, 0.72, 0.94].forEach((f, i) => {
    const k = pickDecor(scene, farPool, _usedSk);
    if (k) mapDecor(scene, W * f + (i % 2 ? 40 : -40), GT, k, 300, 0.9, -8);
  });
  [0.17, 0.4, 0.6, 0.83].forEach((f, i) => {
    const k = pickDecor(scene, nearPool, _usedSk);
    if (k) mapDecor(scene, W * f + (i % 2 ? -30 : 30), GT, k, 200, 1, -5);
  });
  // Край карты: по два дома за границами (дальний + ближний).
  const ke = pickDecor(scene, farPool, _usedSk);
  if (ke) mapDecor(scene, -260, GT, ke, 300, 0.9, -8);
  const ke2 = pickDecor(scene, farPool, _usedSk);
  if (ke2) mapDecor(scene, W + 260, GT, ke2, 300, 0.9, -8);
  const ke3 = pickDecor(scene, nearPool, _usedSk);
  if (ke3) mapDecor(scene, -520, GT, ke3, 200, 1, -5);
  const ke4 = pickDecor(scene, nearPool, _usedSk);
  if (ke4) mapDecor(scene, W + 520, GT, ke4, 200, 1, -5);
  // Заграждения: колючка по бокам, ежи у центра (декор, без коллизии).
  mapDecor(scene, W * 0.08, GT + 8, 'map_wire', 110);
  mapDecor(scene, W * 0.92, GT + 8, 'map_wire', 110);
  mapDecor(scene, cx - 260, GT, 'map_eji', 70);
  mapDecor(scene, cx + 260, GT, 'map_eji', 70);
}
