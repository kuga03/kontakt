// mapPrimitives.js — создание статики карты (было в GameScene).
// Все функции принимают сцену первым аргументом.
// Группы scene.platforms / scene.covers должны существовать.

// Старые PNG-здания assets/buildings (bld_*) больше не грузим:
// подменяем рисованными map_* (те же ключи, что палитра редактора).
// Старые сейвы/карты с bld_* продолжают показываться.
const BLD_ALIAS = {
  bld_0: 'map_shop', bld_1: 'map_sarai', bld_2: 'map_kino', bld_3: 'map_zdanie',
  bld_4: 'map_garage', bld_5: 'map_zdanie', bld_6: 'map_domik2', bld_7: 'map_stol',
  bld_8: 'map_shop', bld_9: 'map_shop', bld_10: 'map_shop', bld_11: 'map_apteka',
  bld_12: 'map_shop', bld_13: 'map_pochta', bld_14: 'map_crate', bld_15: 'map_rabica',
  bld_16: 'map_mini_dom', bld_17: 'map_derevdom', bld_18: 'map_sarai', bld_19: 'map_sarai',
  bld_20: 'map_garage', bld_21: 'map_pochta', bld_22: 'map_crate', bld_23: 'map_shop',
  bld_24: 'map_domik', bld_25: 'map_stol', bld_26: 'map_apteka', bld_27: 'map_stol',
  bld_28: 'map_bigdom', bld_29: 'map_shop', bld_30: 'map_sarai', bld_31: 'map_kino',
  bld_32: 'map_stol', bld_33: 'map_shop', bld_34: 'map_zdanie', bld_35: 'map_sarai',
  bld_36: 'map_garage', bld_37: 'map_stol', bld_38: 'map_domik', bld_39: 'map_wire',
  bld_40: 'map_shop', bld_41: 'map_mini_dom', bld_42: 'map_apteka', bld_43: 'map_garage',
  bld_44: 'map_crate', bld_45: 'map_sarai', bld_46: 'map_kino', bld_47: 'map_shop',
  bld_48: 'map_bigdom', bld_49: 'map_derevdom', bld_50: 'map_pochta', bld_51: 'map_garage'
};
// bld_51 был map_rabica: прозрачная сетка-рабица на solid-блоке 240x120 —
// стена выглядела проходимой, но блочила. Глухой гараж вместо неё
// (и в игре, и в палитре редактора — алиас общий).

export function resolveBuildingTex(texKey) {
  if (!texKey) return texKey;
  return BLD_ALIAS[texKey] || texKey;
}

// Платформа по теме карты (геймдизайн): свой материал, светлая кромка везде.
// Нет темы/арта — тихий откат на базовую (без throw).
const PLATFORM_THEME = {
  wasteland: 'platform_waste', pustinya: 'platform_desert', pustoch: 'platform_desert',
  zavod: 'platform_ind', pechera: 'platform_cave1', peshera: 'platform_cave2',
  sunset: 'platform_sunset', night: 'platform_city', ulica: 'platform_city', krisha: 'platform_city'
};

export function resolvePlatformTex(scene) {
  try {
    let th = null;
    try { th = (scene && scene._platformTheme) || (scene && scene.campaignLevel && scene.campaignLevel.theme) || null; } catch (e) {}
    const k = PLATFORM_THEME[th] || 'platform_city';
    if (k && scene && scene.textures && scene.textures.exists(k)) return k;
  } catch (e) {}
  return 'platform';
}

export function buildHouseLayers(scene, themeId, ...bakes) {
  try {
    scene._bgFar = null;
    scene._bgNear = null;
    let keys = null;
    for (const bake of bakes) {
      try {
        keys = (typeof bake === 'function') ? bake(scene, themeId) : null;
      } catch (e) { keys = null; }
      if (keys) break;
    }
    if (!keys) return;
    const W = scene.mapWidth || 3000;
    const GT = (scene.mapHeight || 900) - 50;
    // Полосы шире карты на ±900: за краями карты тоже дома, а не пустота.
    // TileSprite тайлится — стыков нет, вид внутри карты тот же.
    scene._bgFar = scene.add.tileSprite(W / 2, GT - 180, W + 1800, 380, keys.far)
      .setDepth(-9.5).setAlpha(0.85);
    scene._bgNear = scene.add.tileSprite(W / 2, GT - 215, W + 1800, 430, keys.near)
      .setDepth(-9.2).setAlpha(0.95);
    // Пустошь: детали уже мелкие в самой текстуре (preK в bakeCrispBands),
    // бэнды идут 1:1. tileScale < 1 здесь давал период 640/880px и видимую
    // горизонтальную копипасту — не возвращать. Дальний — бледнее,
    // ближний — плотнее (только alpha, не масштаб).
    try {
      if (themeId === 'wasteland') {
        if (scene._bgFar && scene._bgFar.setTileScale) scene._bgFar.setTileScale(1, 1);
        if (scene._bgFar) scene._bgFar.setAlpha(0.7);
        if (scene._bgNear && scene._bgNear.setTileScale) scene._bgNear.setTileScale(1, 1);
        if (scene._bgNear) scene._bgNear.setAlpha(0.95);
      }
    } catch (e) {}
  } catch (e) {
    scene._bgFar = null;
    scene._bgNear = null;
  }
}

// Визуальное продолжение земли за края карты (без физики!): иначе
// за границами пустота. Фазу тайлинга стыкуем нахлёстом 50px под
// настоящую землю (она непрозрачная и шов прячет). Границы игрока,
// физику и коллайдеры не трогаем. вызывать один раз после постройки карты.
export function addGroundSkirts(scene) {
  try {
    const W = scene.mapWidth || 3000;
    const kids = (scene.platforms && scene.platforms.getChildren)
      ? scene.platforms.getChildren() : [];
    let best = null;
    kids.forEach(o => {
      try {
        if (!o || o.width == null) return;
        const key = o.texture && o.texture.key;
        if (key !== 'ground' && !(key && key.indexOf('gr_') === 0)) return;
        if (!scene.textures.exists(key)) return;
        if (!best || o.width > best.width) {
          best = { key, width: o.width, height: o.height || 50, y: o.y };
        }
      } catch (e) {}
    });
    if (!best) return;
    const gy = (typeof best.y === 'number') ? best.y : ((scene.mapHeight || 900) - 25);
    const gh = best.height || 50;
    [-900, W + 900].forEach(cx => {
      try {
        const t = scene.add.tileSprite(cx, gy, 1900, gh, best.key);
        t.setDepth(-1);
      } catch (e) {}
    });
    try { console.info('[BG] ground skirts: ' + best.key); } catch (e) {}
  } catch (e) {}
}

export function createPlatform(scene, x, y, width, height, alpha = 1) {
  let ptex = 'platform';
  try { ptex = resolvePlatformTex(scene) || 'platform'; } catch (e) {}
  const platform = scene.textures.exists(ptex)
    ? scene.add.tileSprite(x, y, width, height, ptex)
    : scene.add.rectangle(x, y, width, height, 0x333366);
  if (alpha < 1) platform.setAlpha(alpha);
  scene.physics.add.existing(platform, true);
  scene.platforms.add(platform);
}

export function createGround(scene, x, y, width, height, alpha = 1, texKey = null) {
  const gt = texKey || 'ground';
  const ground = scene.textures.exists(gt)
    ? scene.add.tileSprite(x, y, width, height, gt)
    : scene.add.rectangle(x, y, width, height, 0x3a3a52);
  if (alpha < 1) ground.setAlpha(alpha);
  scene.physics.add.existing(ground, true);
  scene.platforms.add(ground);
}

export function createCover(scene, x, y, width, height, texOrAlpha = 1, opts = {}) {
  const CRATE_KEYS = ['map_crate', 'ящик 2', 'длинный ящик'];
  let texKey = null, alpha = 1;
  if (typeof texOrAlpha === 'string') texKey = texOrAlpha;
  else if (typeof texOrAlpha === 'number') alpha = texOrAlpha;
  if (texKey && CRATE_KEYS.includes(texKey)) texKey = null;
  if (texKey && !scene.textures.exists(texKey)) texKey = null;
  // Бочки: 10 фасонов (map_barrelN, BootScene/artEnv). Выбор детерминирован
  // координатами/размером — одна и та же бочка в каждом матче выглядит
  // одинаково (важно для нетматчей), соседние — отличаются.
  if (texKey === 'map_barrel' && scene.textures.exists('map_barrel9')) {
    let bseed = ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ (width * 83492791)) >>> 0;
    bseed = ((bseed ^ (bseed >>> 13)) * 2654435761) >>> 0;
    const bi = bseed % 10;
    texKey = bi === 0 ? 'map_barrel' : 'map_barrel' + bi;
  }
  const o = opts || {};
  const rows = Math.max(1, o.rows | 0 || 1);
  const body = scene.add.rectangle(x, y, width, height, 0xffffff, 0);
  scene.physics.add.existing(body, true);
  body.setVisible(false);
  if (alpha < 1) body.setAlpha(alpha);
  scene.covers.add(body);
  const paintArt = (key) => {
    const src = scene.textures.get(key).getSourceImage();
    const sw = (src && src.width) || 1, sh = (src && src.height) || 1;
    const bw = (typeof opts !== 'undefined' && opts.dw) || width, bh = (typeof opts !== 'undefined' && opts.dh) || height;
    const s = Math.max(bw / sw, bh / sh);
    const baseOy = ((typeof opts !== 'undefined' && opts.anchorBottom) ? (height - sh * s) / 2 : 0);
    const rows = Math.max(1, (typeof opts !== 'undefined' && (opts.rows | 0)) || 1);
    const P = (typeof Phaser !== 'undefined') ? Phaser : null;
    for (let i = 0; i < rows; i++) {
      const oy = (rows === 1 ? 0 : (i / (rows - 1) - 0.5) * height * 0.5) + baseOy;
      const img = scene.add.image(x, y + oy, key).setDepth(2);
      img.setScale(s);
      if (rows === 1) {
        const cw = Math.min(sw, bw / s), ch = Math.min(sh, bh / s);
        img.setCrop((sw - cw) / 2, (sh - ch) / 2, cw, ch);
      }
      if (alpha < 1) img.setAlpha(alpha);
    }
  };
  if (texKey) {
    paintArt(texKey);
    scene.add.ellipse(x, y + height / 2 + 2, width * 0.9, 8, 0x000000, 0.35).setDepth(1.5);
    if (texKey !== 'map_bags') {
      const rim = scene.add.rectangle(x, y, width, height, 0x000000, 0).setStrokeStyle(2, 0x0a0806, 0.9).setDepth(2.5);
      if (alpha < 1) rim.setAlpha(alpha);
    }
  } else {
    const g = scene.add.graphics();
    g.save();
    g.translateCanvas(width / 2, height / 2);
    const hw = width / 2, hh = height / 2;
    // Вариативность ящиков: детерминированный seed из координат/размера —
    // один и тот же ящик каждый матч выглядит одинаково (важно для нетматчей),
    // но соседние различаются фасоном. Размеры не трогаем.
    let cseed = ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ (width * 83492791) ^ (height * 2971215073)) >>> 0;
    const crnd = () => { cseed = (cseed * 1664525 + 1013904223) >>> 0; return cseed / 4294967296; };
    const wood = [
      [0x8b6b43, 0x6e542f, 0x77592f, 0x4e3a22, 0xa8834f, 0x3e2d1a],
      [0x7a6a4a, 0x5d5236, 0x655837, 0x42392a, 0x96814f, 0x332b1c],
      [0x6f6450, 0x554c3a, 0x635740, 0x3c352a, 0x8a7d64, 0x2f2a20]
    ][Math.floor(crnd() * 3)];
    const vert = crnd() < 0.4;
    g.fillStyle(wood[0], 1);
    g.fillRoundedRect(-hw, -hh, width, height, 4);
    g.fillStyle(wood[1], 1);
    const planks = Math.max(2, Math.round((vert ? width : height) / 26));
    if (vert) {
      for (let i = 1; i < planks; i++) {
        g.fillRect(-hw + (width / planks) * i - 1, -hh + 4, 2, height - 8);
      }
    } else {
      for (let i = 1; i < planks; i++) {
        g.fillRect(-hw + 4, -hh + (height / planks) * i - 1, width - 8, 2);
      }
    }
    g.lineStyle(Math.max(4, Math.min(width, height) * 0.09), wood[2], 1);
    g.lineBetween(-hw + 7, hh - 7, hw - 7, -hh + 7);
    if (crnd() < 0.35) g.lineBetween(-hw + 7, -hh + 7, hw - 7, hh - 7);
    g.lineStyle(Math.max(3, width * 0.035), wood[3], 1);
    g.strokeRoundedRect(-hw, -hh, width, height, 4);
    g.lineStyle(2, wood[3], 0.8);
    g.strokeRect(-hw + 6, -hh + 6, width - 12, height - 12);
    g.fillStyle(wood[4], 1);
    g.fillRect(-hw + 3, -hh + 1, width - 6, 3);
    g.fillStyle(wood[5], 1);
    g.fillRect(-hw + 3, hh - 4, width - 6, 3);
    g.fillStyle(0x2e2114, 1);
    const nx = Math.max(8, hw - 9), ny = Math.max(8, hh - 9);
    g.fillCircle(-nx, -ny, 2.2); g.fillCircle(nx, -ny, 2.2);
    g.fillCircle(-nx, ny, 2.2); g.fillCircle(nx, ny, 2.2);
    if (width >= 70 && height >= 50) {
      const Pt = (typeof Phaser !== 'undefined' && Phaser.Geom) ? Phaser.Geom.Point : function (x, y) { this.x = x; this.y = y; };
      g.lineStyle(3, 0xd8cfae, 0.35);
      try {
        g.strokePoints([new Pt(0, -12), new Pt(10, 0), new Pt(0, 12), new Pt(-10, 0)], true);
      } catch (e) {}
      // трафаретная маркировка на части ящиков
      if (crnd() < 0.4) {
        g.lineStyle(2, 0xd8cfae, 0.22);
        const my = (crnd() < 0.5 ? -6 : 8);
        g.lineBetween(-hw + 14, my, hw - 14, my);
        g.lineBetween(-hw + 14, my + 6, hw - 14, my + 6);
      }
    }
    const _texKey = 'cover_' + Math.round(x) + '_' + Math.round(y) + '_' + Math.round(width) + '_' + Math.round(height);
    if (!scene.textures.exists(_texKey)) {
      try { g.restore(); g.generateTexture(_texKey, width, height); } catch (e) {}
    }
    try { g.destroy(); } catch (e) {}
    const _img = scene.add.image(x, y, _texKey).setDepth(2);
    if (alpha < 1) _img.setAlpha(alpha);
  }
  // Инвалидация LOS-кэша: геометрия изменилась.
  try { if (scene) scene._losRects = []; } catch (e) {}
  return body;
}

export function createBuilding(scene, x, y, width, height, texKey, alpha = 1) {
  texKey = resolveBuildingTex(texKey);
  if (!texKey || !scene.textures.exists(texKey)) {
    const fb = scene.add.rectangle(x, y, width, height, 0x55556f).setStrokeStyle(2, 0x8888aa);
    if (alpha < 1) fb.setAlpha(alpha);
    scene.physics.add.existing(fb, true);
    scene.covers.add(fb);
    try { scene._losRects = []; } catch (e) {}
    return;
  }
  const body = scene.add.rectangle(x, y, width, height, 0xffffff, 0);
  scene.physics.add.existing(body, true);
  body.setVisible(false);
  if (alpha < 1) body.setAlpha(alpha);
  scene.covers.add(body);
  const img = scene.add.image(x, y, texKey).setDisplaySize(width, height).setDepth(2);
  if (alpha < 1) img.setAlpha(alpha);
  try { scene._losRects = []; } catch (e) {}
}

export function createWall(scene, x, y, width, height, alpha = 1) {
  const wall = scene.textures.exists('wall')
    ? scene.add.tileSprite(x, y, width, height, 'wall')
    : scene.add.rectangle(x, y, width, height, 0x6b5a4a)
        .setStrokeStyle(2, 0x9a8a6a);
  if (alpha < 1) wall.setAlpha(alpha);
  scene.physics.add.existing(wall, true);
  scene.covers.add(wall);
  try { scene._losRects = []; } catch (e) {}
}

// Сброс LOS-кэша после массовой постройки карты.
export function invalidateLosCache(scene) {
  try { if (scene) scene._losRects = []; } catch (e) {}
}
