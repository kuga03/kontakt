// mapPrimitives.js — создание статики карты (было в GameScene).
// Все функции принимают сцену первым аргументом.
// Группы scene.platforms / scene.covers должны существовать.

// Арты карт рисуются кодом. Импортируем напрямую, чтобы укрытие могло
// сгенерировать недостающую текстуру даже в GameScene (у BootScene-хелперов
// там нет). Версии (?v=) обязательны: иначе браузер/WebView кеширует старый
// модуль без новых вариантов ящиков/бочек.
import * as ArtEnv from '../scenes/boot/artEnv.js';
import * as ArtBuildings from '../scenes/boot/artBuildings.js';

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

export function createPlatform(scene, x, y, width, height, alpha = 1, texKey = null) {
  let ptex = texKey;
  if (!ptex || !scene.textures.exists(ptex)) {
    try { ptex = resolvePlatformTex(scene) || 'platform'; } catch (e) { ptex = 'platform'; }
  }
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

  if (!texKey || CRATE_KEYS.includes(texKey)) {
    let bseed = ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ (width * 83492791)) >>> 0;
    bseed = ((bseed ^ (bseed >>> 13)) * 2654435761) >>> 0;
    const ci = bseed % 10;
    texKey = ci === 0 ? 'map_crate' : 'map_crate' + ci;
  } else if (texKey === 'map_barrel') {
    let bseed = ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ (width * 83492791)) >>> 0;
    bseed = ((bseed ^ (bseed >>> 13)) * 2654435761) >>> 0;
    const bi = bseed % 10;
    texKey = bi === 0 ? 'map_barrel' : 'map_barrel' + bi;
  }

  // Гарантируем, что текстура существует: если BootScene её не создал
  // (старый кеш, смена списка артов), рисуем прямо здесь.
  try {
    if (!scene.textures.exists(texKey)) {
      if (/^map_(crate|barrel|generator|pipes|dune_rock|sand_barrier|vent_unit|concrete_block|stalagmite|shield|office_desk|server_rack|support_pillar|interior_wall)/.test(texKey)) ArtEnv.generateMapArt.call(scene, texKey);
      else if (/^map_(bags|wreck)/.test(texKey)) ArtBuildings.generateMapBuilding.call(scene, texKey);
    }
  } catch (e) {}

  // Для ступенчатых укрытий разбиваем физику на sub-rectangles,
  // чтобы форма коллайдера соответствовала силуэту и боты/игроки могли перепрыгивать
  // и стрелять через низкие края (капот/багажник/плечи мешков/боковые секции блоков).
  const STEPPED_COVERS = {
    map_wreck: [
      { rw: 0.29, rh: 0.58 },
      { rw: 0.35, rh: 0.72 },
      { rw: 0.36, rh: 0.56 },
    ],
    map_bags: [
      { rw: 0.24, rh: 0.46 },
      { rw: 0.52, rh: 0.62 },
      { rw: 0.24, rh: 0.46 },
    ],
    map_generator: [
      { rw: 0.32, rh: 0.78 },
      { rw: 0.36, rh: 0.52 },
      { rw: 0.32, rh: 0.68 },
    ],
    // Связка труб: две нижние почти на всю ширину (~58% H) + верхняя по центру (~88% H)
    map_pipes: [
      { rw: 0.23, rh: 0.58 },
      { rw: 0.54, rh: 0.88 },
      { rw: 0.23, rh: 0.58 },
    ],
    map_dune_rock: [
      { rw: 0.28, rh: 0.48 },
      { rw: 0.44, rh: 0.82 },
      { rw: 0.28, rh: 0.52 },
    ],
    map_sand_barrier: [
      { rw: 0.25, rh: 0.42 },
      { rw: 0.50, rh: 0.75 },
      { rw: 0.25, rh: 0.42 },
    ],
    map_vent_unit: [
      { rw: 0.34, rh: 0.58 },
      { rw: 0.38, rh: 0.84 },
      { rw: 0.28, rh: 0.64 },
    ],
    map_concrete_block: [
      { rw: 0.24, rh: 0.48 },
      { rw: 0.52, rh: 0.74 },
      { rw: 0.24, rh: 0.48 },
    ],
    map_stalagmite: [
      { rw: 0.30, rh: 0.52 },
      { rw: 0.40, rh: 0.84 },
      { rw: 0.30, rh: 0.56 },
    ],
    map_shield: [
      { rw: 0.25, rh: 0.54 },
      { rw: 0.50, rh: 0.82 },
      { rw: 0.25, rh: 0.54 },
    ],
    // Стол: кресло/монитор дают высокую левую часть, тумба справа ниже монитора
    map_office_desk: [
      { rw: 0.38, rh: 0.82 },
      { rw: 0.62, rh: 0.78 },
    ],
    map_server_rack: [
      { rw: 1.0, rh: 0.95 },
    ],
  };

  const subBodies = [];
  const baseBotY = y + height / 2;
  const leftX = x - width / 2;

  const stepDef = STEPPED_COVERS[texKey];
  if (stepDef) {
    let curX = leftX;
    for (const p of stepDef) {
      const rw = width * p.rw;
      const rh = height * p.rh;
      const px = curX + rw / 2;
      const py = baseBotY - rh / 2;
      const sb = scene.add.rectangle(px, py, rw, rh, 0xffffff, 0);
      scene.physics.add.existing(sb, true);
      sb.setVisible(false);
      if (alpha < 1) sb.setAlpha(alpha);
      scene.covers.add(sb);
      subBodies.push(sb);
      curX += rw;
    }
  }

  // Главное тело: если ступенчатое укрытие, главное тело делаем бестелесным триггером/сенсором
  // либо отключаем его физику, чтобы коллизии шли через subBodies.
  const body = scene.add.rectangle(x, y, width, height, 0xffffff, 0);
  scene.physics.add.existing(body, true);
  body.setVisible(false);
  if (alpha < 1) body.setAlpha(alpha);

  if (subBodies.length > 0) {
    // Отключаем хитбокс габаритного тела, чтобы коллизии не блокировали свободное пространство
    if (body.body) body.body.enable = false;
    body._subBodies = subBodies;
  } else {
    scene.covers.add(body);
  }

  // Всегда рисуем надежную текстурную подложку нужного оттенка под спрайтом
  const bgCol = (texKey && texKey.indexOf('barrel') >= 0) ? 0x5a6068 : 0x8b6b43;
  let img = scene.add.rectangle(x, y, width, height, bgCol).setStrokeStyle(2, 0x3e2d1a).setDepth(85);
  if (alpha < 1) img.setAlpha(alpha);

  let spr = null;
  if (scene.textures.exists(texKey)) {
    try { img.destroy(); img = null; } catch (e) {}
    spr = scene.add.image(x, y, texKey).setDepth(85);
    // Физические границы укрытий должны совпадать с визуальными: спрайт
    // рисуем ровно по хитбоксу (без «увеличений только для вида»), а
    // несовпадения устраняем в самом арте (см. FIT в artBuildings.js).
    spr.setDisplaySize(width, height);
    if (alpha < 1) spr.setAlpha(alpha);
  }

  const shW = width * 0.9;
  const sh = scene.add.ellipse(x, y + height / 2 + 2, shW, 8, 0x000000, 0.35).setDepth(84);

  body.on('destroy', () => {
    try { if (img && img.active) img.destroy(); } catch (e) {}
    try { if (spr && spr.active) spr.destroy(); } catch (e) {}
    try { if (sh && sh.active) sh.destroy(); } catch (e) {}
    if (body._subBodies) {
      for (const sb of body._subBodies) {
        try { if (sb && sb.active) sb.destroy(); } catch (e) {}
      }
      body._subBodies = null;
    }
  });

  try { if (scene) scene._losRects = []; } catch (e) {}
  return body;
}

export function createDecor(scene, x, y, width, height, texKey, alpha = 1, depth = -2) {
  texKey = resolveBuildingTex(texKey);
  if (!texKey) return null;
  if (!scene.textures.exists(texKey)) {
    try {
      if (/^map_(crate|barrel|generator|pipes|dune_rock|sand_barrier|vent_unit|concrete_block|stalagmite|shield|office_desk|server_rack|support_pillar|interior_wall|int_|wall_brick|wall_concrete|wall_partition|lamp_post|ladder_truss)/.test(texKey)) {
        ArtEnv.generateMapArt.call(scene, texKey);
      } else if (/^map_/.test(texKey)) {
        ArtBuildings.generateMapBuilding.call(scene, texKey);
      }
    } catch (e) {}
  }
  if (!scene.textures.exists(texKey)) {
    if (/^map_(interior_wall|int_)/.test(texKey)) {
      const fb = scene.add.rectangle(x, y, width, height, 0x181c24).setStrokeStyle(1, 0x10131a).setDepth(depth != null ? depth : -2.8);
      if (alpha < 1) fb.setAlpha(alpha);
      return fb;
    }
    return null;
  }
  const img = scene.add.image(x, y, texKey).setDepth(depth != null ? depth : -2);
  img.setDisplaySize(width, height);
  if (alpha < 1) img.setAlpha(alpha);
  return img;
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
  const img = scene.add.image(x, y, texKey).setDepth(300);
  const src = scene.textures.exists(texKey) ? scene.textures.get(texKey).getSourceImage() : null;
  const sw = (src && src.width) || width, sh = (src && src.height) || height;
  img.setDisplaySize(width, height);
  if (alpha < 1) img.setAlpha(alpha);
  try { scene._losRects = []; } catch (e) {}
}

export function createWall(scene, x, y, width, height, alpha = 1, texKey = null) {
  const wt = texKey || 'wall';
  const wall = scene.textures.exists(wt)
    ? scene.add.tileSprite(x, y, width, height, wt)
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
