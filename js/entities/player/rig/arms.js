import { weaponImage } from '../../../data/weapons.js';

import { RIG_DEFAULTS } from '../../../data/rigConfig.js';
import { getCharacterColors, getEquippedTorso } from '../../../data/gameState.js';

import { ensureGeoTextures } from './gear.js';
import { artTex, cropH, cropInfo, cropW, elbowCache, GEO_HUMAN, jointsCache, partCfg } from './config.js';

// Средний цвет текстуры торса: рукав должен совпадать с надетым торсом,
// а не с абстрактным «цветом тела». Кэш на ключ текстуры.
const torsoColorCache = new Map();
function texAvgColor(scene, key) {
  if (!key) return null;
  if (torsoColorCache.has(key)) return torsoColorCache.get(key);
  let out = null;
  try {
    if (!scene || !scene.textures || !scene.textures.exists(key)) return null;
    const src = scene.textures.get(key).getSourceImage();
    const w = (src && src.width) | 0, h = (src && src.height) | 0;
    if (!w || !h) return null;
    let ctx = src.getContext ? src.getContext('2d') : null;
    let data;
    if (ctx) {
      data = ctx.getImageData(0, 0, w, h).data;
    } else {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      ctx = cv.getContext('2d');
      ctx.drawImage(src, 0, 0);
      data = ctx.getImageData(0, 0, w, h).data;
    }
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 24) continue;
      r += data[i] * a; g += data[i + 1] * a; b += data[i + 2] * a; n += a;
    }
    if (n > 0) out = (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
  } catch (e) { out = null; }
  torsoColorCache.set(key, out);
  return out;
}

function mulColor(a, b) {
  const r = Math.round(((a >> 16) & 255) * ((b >> 16) & 255) / 255);
  const g = Math.round(((a >> 8) & 255) * ((b >> 8) & 255) / 255);
  const bl = Math.round((a & 255) * (b & 255) / 255);
  return (r << 16) | (g << 8) | bl;
}

function lightenColor(c, k) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

function tintPart(p, c) {
  try { if (p && typeof p.setTint === 'function') p.setTint(c); } catch (e) {}
}

// Рукав = средний цвет надетого торса (торс красится цветом тела, поэтому
// умножаем на него же). Кисть/предплечье = выбранный цвет кожи.
function armColors(player) {
  let bodyC = 0x888888;
  let skinC = 0xd49a6a;
  try {
    const cc = getCharacterColors() || {};
    if (Number.isFinite(cc.body)) bodyC = cc.body;
    if (Number.isFinite(cc.head)) skinC = cc.head;
  } catch (e) {}
  if (Number.isFinite(player._bodyColor)) bodyC = player._bodyColor;
  if (Number.isFinite(player._skinColor)) skinC = player._skinColor;
  let sleeveC = bodyC;
  try {
    let tex = null;
    if (player._botGear && player._botGear.torso) {
      tex = player._botGear.torso;
    } else if (!player._netForeign) {
      const cls = (player.constructor && player.constructor.name) || undefined;
      tex = getEquippedTorso(cls);
    }
    const avg = texAvgColor(player.scene, tex);
    if (avg != null) sleeveC = mulColor(avg, bodyC);
  } catch (e) {}
  return { sleeveC: lightenColor(sleeveC, 1.12), skinC };
}

function applyArmColors(player, sleeveC, skinC) {
  const sleeves = [player._armUpRear, player._armUpFront].filter(Boolean);
  const skins = [player._armForeRear, player._armForeFront, player._handRear, player._handFront].filter(Boolean);
  player._sleeveParts = sleeves;
  player._skinParts = skins;
  player._sleeveColor = sleeveC;
  player._skinColor = skinC;
  sleeves.forEach(p => tintPart(p, sleeveC));
  skins.forEach(p => tintPart(p, skinC));
  // Тинт тела/команды вешаем только на рукав. Кисти — всегда кожа.
  sleeves.forEach(p => {
    player._tintParts = player._tintParts || [];
    if (!player._tintParts.includes(p)) player._tintParts.push(p);
  });
}

export function buildArmsSkeleton(player) {
  const scene = player.scene;
  player._gunArt = true;
  const ac = partCfg(player, 'arms');
  const { sleeveC, skinC } = armColors(player);

  // задняя (гриф/рукоятка) — ПРАВАЯ рука. Контейнер НАД автоматом (4.6>4.2):
  // рукав поверх футболки, перчатка поверх рукоятки — пальцы обхватывают,
  // а не приклеены под стволом.
  player.armGun = scene.add.container(player.x, player.y).setDepth(4.6);
  if (!buildArmSide(player, 'r', player.armGun, ac)) {
    player._armUpRear = armPart(player, 'chr_arm_up', sleeveC);
    player._armForeRear = armSlots(player, 'chr_arm_fore', skinC, '_r');
    player._handRear = armSlots(player, 'chr_hand', skinC, '_r');
    player.armGun.add([player._armUpRear, player._armForeRear, player._handRear]);
  }
  player._allParts.push(player.armGun);

  // передняя (цевьё) — ЛЕВАЯ рука. Контейнер ЗА торсом (3.6<4): дальняя рука
  // выходит из-за корпуса и держит цевьё с дальней стороны ствола —
  // на другом слое с правой (4.6), не на одном.
  player.armFront = scene.add.container(player.x, player.y).setDepth(3.6);
  if (!buildArmSide(player, 'l', player.armFront, ac)) {
    player._armUpFront = armPart(player, 'chr_arm_up', sleeveC);
    player._armForeFront = armSlots(player, 'chr_arm_fore', skinC, '_l');
    player._handFront = armSlots(player, 'chr_hand', skinC, '_l');
    player.armFront.add([player._armUpFront, player._armForeFront, player._handFront]);
  }
  player._allParts.push(player.armFront);

  applyArmColors(player, sleeveC, skinC);

  const realT = k => !!(k && scene.textures.exists(k));
  console.info('[RIG] skeleton arms (2 руки):', JSON.stringify({
    upper: ac.upper, fore: ac.fore,
    elbowL: ac.elbowL, elbowR: ac.elbowR,
    sliced: player._armsSliced || [],
    up_png: realT('chr_arm_up'),
    fore_rear: realT('chr_arm_fore_r'), fore_front: realT('chr_arm_fore_l'),
    hand_rear: realT('chr_hand_r'), hand_front: realT('chr_hand_l')
  }));
}

// Одна сторона руки из ЦЕЛЬНОЙ PNG (sac 'r' — задняя, 'l' — передняя).
// Возвращает true, если срез удался (плечо+предплечье из арта, кисть-бокс
// спрятан — перчатка уже нарисована в срезе предплечья).
function buildArmSide(player, sac, container, ac) {
  // GEO: срезы PNG не делаем — руки соберутся из простых фигур в фолбэке.
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return false;
  const texKey = 'chr_arm_fore_' + sac;
  // Срез по анатомическому локтю (~0.30 ширины арта: рукав сверху-слева,
  // локоть-уголок снизу, предплечье с перчаткой вправо).
  const cut = ac[sac === 'l' ? 'elbowL' : 'elbowR'] ?? 0.36;
  // ОБЩАЯ точка локтя для обоих срезов: стык не разъезжается, даже если
  // детекторы срезов по отдельности нашли бы разные «локти».
  const elbow = armElbow(player, texKey, cut);
  const up = armSlicePart(player, texKey, cut, 'upper', elbow);
  const fore = armSlicePart(player, texKey, cut, 'fore', elbow);
  if (!up || !fore) return false;
  const hand = hiddenHand(player, 0xffcc99);
  if (sac === 'r') {
    player._armUpRear = up; player._armForeRear = fore; player._handRear = hand;
  } else {
    player._armUpFront = up; player._armForeFront = fore; player._handFront = hand;
  }
  container.add([up, fore, hand]);
  player._armsSliced = player._armsSliced || [];
  player._armsSliced.push(sac);
  return true;
}

// Кисть-заглушка, которую НЕ видно: перчатка уже есть в срезе предплечья
// цельной PNG руки. Объект нужен позе (точка хвата), но не рендеру.
function hiddenHand(player, fallbackColor) {
  const img = player.scene.add.rectangle(0, 0, 4, 4, fallbackColor, 1).setDepth(6);
  img._boneRect = true;
  img._hiddenBySlice = true;
  img.setVisible(false);
  player._allParts.push(img);
  return img;
}

// Срез-кость из ЦЕЛЬНОЙ текстуры руки: PNG режем ВЕРТИКАЛЬНО по линии локтя
// на кадры 'ARM_TOP' (плечо: 0..локоть) и 'ARM_BOT' (предплечье+кисть:
// локоть..конец). Оба среза — из одной текстуры, стык на локте совпадает.
// Сустав обоих срезов — ЛЕВЫЙ край кадра (плечо крепится плечом, предплечье —
// локтем), ось кости — вдоль X, поэтому доворота на 90° не нужно.
// Общая точка локтя ЦЕЛОЙ руки (пиксели арта). В согнутой руке верхний
// контур имеет выемку-паз между рукавом и предплечьем: сустав — на дне
// выемки. Центроид полосы уходит в мясо плеча (рука гнулась не в локте),
// поэтому сначала ищем выемку, центроид — только запасной вариант.
// Оба среза шарнирятся ровно в неё — на локте нет ступеньки.
// Возвращает null, если арта нет (тогда у срезов своя геометрия).
function armElbow(player, texKey, cut) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return null;
  try {
    const artKey = artTex(player, texKey);
    if (!artKey || !player.scene.textures.exists(artKey)) return null;
    if (!player.scene.textures.exists(texKey)) return null;
    // Кэш на сессию: один арт+срез считается раз (лобби строит 4 превью).
    const ck = `${artKey}|${(+cut).toFixed(2)}`;
    if (elbowCache.has(ck)) {
      const hit = elbowCache.get(ck);
      return hit ? { ...hit } : null;
    }
    const remember = (v) => {
      try {
        if (elbowCache.size > 40) {
          const first = elbowCache.keys().next().value;
          elbowCache.delete(first);
        }
        elbowCache.set(ck, v ? { ...v } : null);
      } catch (e) {}
      return v;
    };
    const src = player.scene.textures.get(artKey).getSourceImage();
    const ctx = src && src.getContext ? src.getContext('2d') : null;
    const W = (src && src.width) || 0;
    const H = (src && src.height) || 0;
    if (!ctx || !W || !H) return null;
    const cutPx = Math.round(Phaser.Math.Clamp(cut, 0.05, 0.95) * W);
    const data = ctx.getImageData(0, 0, W, H).data;
    // Выемка: самая глубокая точка верхнего контура в окне возле среза.
    // База — медиана контура СЛЕВА (рукав), а не всего окна: иначе широкая
    // выемка загрязняет медиану и не детектируется.
    const wx0 = Math.max(0, cutPx - 90);
    const wx1 = Math.min(W - 1, cutPx + 60);
    const tops = [];
    for (let x = wx0; x <= wx1; x++) {
      for (let y = 0; y < H; y++) {
        if (data[(y * W + x) * 4 + 3] >= 12) { tops.push({ x, y }); break; }
      }
    }
    if (tops.length > 10) {
      const leftYs = tops.filter(p => p.x <= cutPx).map(p => p.y).sort((a, b) => a - b);
      const base = leftYs.length ? leftYs[Math.floor(leftYs.length / 2)] : tops[0].y;
      let best = null;
      tops.forEach(p => { if (!best || p.y > best.y) best = p; });
      // Выемка выражена: дно ниже базы рукава минимум на 12% высоты.
      if (best && best.y - base > H * 0.12) {
        return remember({ x: best.x, y: Math.max(0, best.y - 8), W, H });
      }
    }
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = Math.max(0, cutPx - 8); x <= Math.min(W - 1, cutPx + 8); x++) {
        if (data[(y * W + x) * 4 + 3] >= 12) { sx += x; sy += y; n++; }
      }
    }
    if (!n) return remember({ x: cutPx, y: Math.round(H * 0.55), W, H });
    return remember({ x: sx / n, y: sy / n, W, H });
  } catch (e) {
    return null;
  }
}

function armSlicePart(player, texKey, cut, kind, elbowPx) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return null;
  const scene = player.scene;
  const artKey = artTex(player, texKey);
  const tex = artKey && scene.textures.exists(artKey) ? scene.textures.get(artKey) : null;
  const hasTex = scene.textures.exists(texKey);
  if (!hasTex || !tex) return null;
  // Диагональный срез: печём кусок в canvas-текстуру с наклонным краем
  // (фреймы Phaser только прямоугольные). Не вышло — вертикальный срез.
  try {
    const baked = bakeArmSlice(player, texKey, artKey, cut, kind, elbowPx);
    if (baked) return baked;
  } catch (e) { /* ниже — старый вертикальный путь */ }
  const src = tex.getSourceImage();
  const W = (src && src.width) || 0;
  const H = (src && src.height) || 0;
  if (!W || !H) return null;
  const top = kind === 'upper';
  // Конверт среза широкий (0.05–0.95): точку можно ставить почти где угодно.
  // У краёв один из срезов вырождается в полоску — движок такое переживает
  // (масштаб считается по суставам, минимум 2px).
  const cutPx = Math.round(Phaser.Math.Clamp(cut, 0.05, 0.95) * W);
  const ox = top ? 0 : Math.min(W - 2, cutPx);
  const w = top ? Math.max(2, cutPx) : Math.max(2, W - cutPx);
  const name = top ? 'ARM_TOP' : 'ARM_BOT';
  // Кадры общие для всех спрайтов текстуры — пересоздаём только если срез
  // реально изменился, чтобы не ломать руки других игроков.
  const curFr = tex.frames ? tex.frames[name] : null;
  if (!curFr || curFr.width !== w || curFr.height !== H || curFr.cutX !== ox) {
    if (curFr) tex.remove(name);
    tex.add(name, 0, ox, 0, w, H);
  }
  const img = scene.add.image(0, 0, artKey, name).setDepth(6);
  img._srcW2 = w;
  img._srcH2 = H;
  img._boneRect = false;
  // ось кости — вдоль X кадра (сустав слева): авто-доворот по пропорциям
  // кадра запрещён, иначе высокий срез предплечья повернуло бы на 90°.
  img._armAxis = 'x';
  // Суставы НАРИСОВАННОГО арта (доли кадра среза): равномерный масштаб кости
  // считается по расстоянию между ними — PNG никогда не растягивается.
  // Локоть (elbowPx) — общий для обоих срезов, остальные суставы — свои.
  const j = armJoints(player, artKey, ox, 0, w, H, kind, elbowPx);
  img._armJ0 = j.j0;
  img._armAng = j.ang;
  img._armDist = j.dist;
  img._armKind = kind;
  img.setOrigin(j.j0.x, j.j0.y);
  player._allParts.push(img);
  return img;
}

// Диагональный срез руки: шов идёт через локоть перпендикулярно предплечью
// (а не вертикально) — при сгибе нет ступеньки. Позиция шва — кнопками
// ЛокЗ/ЛокП (вдоль оси предплечья от локтя). Возвращает готовый img или null.
function bakeArmSlice(player, texKey, artKey, cut, kind, elbowPx) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return null;
  const scene = player.scene;
  const top = kind === 'upper';
  const tex = scene.textures.get(artKey);
  const src = tex.getSourceImage();
  const W = (src && src.width) || 0;
  const H = (src && src.height) || 0;
  if (!W || !H || !elbowPx || !elbowPx.W) return null;
  const sctx = src.getContext ? src.getContext('2d') : null;
  if (!sctx) return null;
  const data = sctx.getImageData(0, 0, W, H).data;
  const E = { x: elbowPx.x, y: elbowPx.y };

  // Запястье: центроид контента в правых 15% (там перчатка).
  let wx = 0, wy = 0, wn = 0;
  for (let y = 0; y < H; y++) {
    for (let x = Math.floor(W * 0.85); x < W; x++) {
      if (data[(y * W + x) * 4 + 3] >= 12) { wx += x; wy += y; wn++; }
    }
  }
  let fx = 1, fy = 0;
  if (wn > 4) {
    const dx = wx / wn - E.x, dy = wy / wn - E.y;
    const len = Math.hypot(dx, dy);
    if (len > 8) { fx = dx / len; fy = dy / len; }
  }
  const foreLen = wn > 4 ? Math.max(30, Math.hypot(wx / wn - E.x, wy / wn - E.y)) : Math.max(30, W * 0.4);
  // Якорь шва: cut едет вдоль оси предплечья от локтя.
  const along = (Phaser.Math.Clamp(cut, 0.05, 0.95) - E.x / W) * foreLen;
  const A = { x: E.x + fx * along, y: E.y + fy * along };
  // Направление шва — перпендикуляр предплечью, ближе к вертикали.
  let ang = Math.atan2(fy, fx) + Math.PI / 2;
  let deg = ((ang * 180 / Math.PI) % 180 + 180) % 180;
  if (deg < 45) deg += 90;
  if (deg >= 135) deg -= 90;
  const dr = deg * Math.PI / 180;
  let dx = Math.cos(dr), dy = Math.sin(dr);
  // Нормаль в правую сторону (там предплечье).
  let nx = dy, ny = -dx;
  if (nx < 0) { nx = -nx; ny = -ny; dx = -dx; dy = -dy; }

  const m = 5; // нахлёст шва, чтобы не светилась щель
  const dot = (x, y) => (x - A.x) * nx + (y - A.y) * ny;
  const keep = (x, y) => {
    if (data[(y * W + x) * 4 + 3] < 12) return false;
    const d = dot(x, y);
    return top ? d <= m : d >= -m;
  };
  // Ббокс хранимой части.
  let bx0 = W, bx1 = -1, by0 = H, by1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!keep(x, y)) continue;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
  if (bx1 < bx0 || by1 < by0) return null;
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  if (bw < 2 || bh < 2) return null;

  const bkey = `${texKey}_${top ? 'DT' : 'DB'}_${Math.round(Phaser.Math.Clamp(cut, 0.05, 0.95) * 100)}_${W}x${H}`;
  if (!scene.textures.exists(bkey)) {
    const cv = document.createElement('canvas');
    cv.width = bw;
    cv.height = bh;
    const cctx = cv.getContext('2d');
    if (!cctx) return null;
    cctx.drawImage(src, bx0, by0, bw, bh, 0, 0, bw, bh);
    // Стираем треугольник за швом (многоугольник сброса).
    const C = [[0, 0], [bw, 0], [bw, bh], [0, bh]];
    const ED = [[0, 1], [1, 2], [2, 3], [3, 0]];
    const val = (p) => (bx0 + p[0] - A.x) * nx + (by0 + p[1] - A.y) * ny;
    const drop = (p) => top ? val(p) > m : val(p) < -m;
    const poly = [];
    for (let e = 0; e < 4; e++) {
      const p1 = C[ED[e][0]], p2 = C[ED[e][1]];
      if (drop(p1)) poly.push({ x: p1[0], y: p1[1] });
      const v1 = val(p1), v2 = val(p2);
      const t1 = top ? v1 - m : -(v1 + m);
      const t2 = top ? v2 - m : -(v2 + m);
      if ((t1 > 0) !== (t2 > 0)) {
        const t = t1 / (t1 - t2);
        poly.push({ x: p1[0] + (p2[0] - p1[0]) * t, y: p1[1] + (p2[1] - p1[1]) * t });
      }
    }
    if (poly.length >= 3) {
      cctx.save();
      cctx.globalCompositeOperation = 'destination-out';
      cctx.beginPath();
      poly.forEach((p, i) => { if (i) cctx.lineTo(p.x, p.y); else cctx.moveTo(p.x, p.y); });
      cctx.closePath();
      cctx.fill();
      cctx.restore();
    }
    if (scene.textures.exists(bkey)) scene.textures.remove(bkey);
    const ct = scene.textures.createCanvas(bkey, bw, bh);
    if (!ct || !ct.context) return null;
    ct.context.drawImage(cv, 0, 0);
    ct.refresh();
  }
  // LRU: печёных срезов не больше 24 на сцену.
  scene._armBakeKeys = scene._armBakeKeys || [];
  const arr = scene._armBakeKeys;
  const ix = arr.indexOf(bkey);
  if (ix >= 0) arr.splice(ix, 1);
  arr.push(bkey);
  while (arr.length > 24) {
    const old = arr.shift();
    try { if (scene.textures.exists(old)) scene.textures.remove(old); } catch (e) { /* noop */ }
  }

  const img = scene.add.image(0, 0, bkey).setDepth(6);
  img._srcW2 = bw;
  img._srcH2 = bh;
  img._boneRect = false;
  img._armAxis = 'x';
  const j = armJoints(player, bkey, 0, 0, bw, bh, kind,
    { x: E.x - bx0, y: E.y - by0, W: bw, H: bh });
  img._armJ0 = j.j0;
  img._armAng = j.ang;
  img._armDist = j.dist;
  img._armKind = kind;
  img.setOrigin(j.j0.x, j.j0.y);
  player._allParts.push(img);
  return img;
}

// Суставы среза руки по альфа-каналу (в долях кадра среза + угол оси + длина
// оси в пикселях арта). Верхний срез: плечо (верхняя полоса контента) и
// локоть (контент у линии среза). Нижний срез: локоть (первые столбцы) и
// кисть (контент у правого края — перчатка). Нет контента — геометрия кадра.
function armJoints(player, texKey, fx, fy, fw, fh, kind, elbowPx) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
    const top = kind === 'upper';
    const def = top
      ? { j0: { x: 0.06, y: 0.08 }, j1: { x: 0.97, y: 0.55 } }
      : { j0: { x: 0.03, y: 0.55 }, j1: { x: 0.95, y: 0.5 } };
    return armJointsFin(player, def, fw, fh);
  }
  const top = kind === 'upper';
  const def = top
    ? { j0: { x: 0.06, y: 0.08 }, j1: { x: 0.97, y: 0.55 } }
    : { j0: { x: 0.03, y: 0.55 }, j1: { x: 0.95, y: 0.5 } };
  // Кэш на сессию: суставы среза зависят только от арта (лобби/рестарт).
  const ekey = elbowPx && elbowPx.W
    ? `${Math.round(elbowPx.x)}:${Math.round(elbowPx.y)}` : 'n';
  const jkey = `${texKey}|${fx}|${fy}|${fw}|${fh}|${kind}|${ekey}`;
  if (jointsCache.has(jkey)) {
    const hit = jointsCache.get(jkey);
    return { j0: { ...hit.j0 }, ang: hit.ang, dist: hit.dist };
  }
  const rememberJ = (v) => {
    try {
      if (jointsCache.size > 80) {
        const first = jointsCache.keys().next().value;
        jointsCache.delete(first);
      }
      jointsCache.set(jkey, { j0: { ...v.j0 }, ang: v.ang, dist: v.dist });
    } catch (e) {}
    return v;
  };
  // Общая точка локтя (в пикселях целого арта) → в доли текущего среза.
  // fx — левый край среза в арте, fw — его ширина.
  const elbowFrac = elbowPx && elbowPx.W
    ? { x: (elbowPx.x - fx) / fw, y: elbowPx.y / fh }
    : null;
  const elbowOk = elbowFrac && elbowFrac.x >= -0.05 && elbowFrac.x <= 1.05 &&
    elbowFrac.y >= 0 && elbowFrac.y <= 1
    ? { x: Phaser.Math.Clamp(elbowFrac.x, 0, 1), y: elbowFrac.y }
    : null;
  try {
    const src = player.scene.textures.get(texKey).getSourceImage();
    const ctx = src && src.getContext ? src.getContext('2d') : null;
    if (!ctx || !fw || !fh) return rememberJ(armJointsFin(player, def, fw, fh));
    const data = ctx.getImageData(fx, fy, fw, fh).data;
    const centroid = (x0, x1, y0, y1) => {
      let sx = 0;
      let sy = 0;
      let n = 0;
      const xa = Math.max(0, Math.floor(x0 * fw));
      const xb = Math.min(fw - 1, Math.ceil(x1 * fw));
      const ya = Math.max(0, Math.floor(y0 * fh));
      const yb = Math.min(fh - 1, Math.ceil(y1 * fh));
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
          if (data[(y * fw + x) * 4 + 3] >= 12) { sx += x; sy += y; n++; }
        }
      }
      return n ? { x: sx / n / fw, y: sy / n / fh } : null;
    };
    let j0;
    let j1;
    if (top) {
      j0 = centroid(0, 1, 0, 0.15) || def.j0;
      // локоть верхнего среза — всегда общий (конец кости = начало предплечья)
      j1 = elbowOk || centroid(0.85, 1, 0, 1) || def.j1;
    } else {
      // локоть нижнего среза — всегда общий (начало кости = конец плеча)
      j0 = elbowOk || centroid(0, 0.15, 0, 1) || def.j0;
      j1 = centroid(0.85, 1, 0, 1) || def.j1;
    }
    return rememberJ(armJointsFin(player, { j0, j1 }, fw, fh));
  } catch (e) {
    return rememberJ(armJointsFin(player, def, fw, fh));
  }
}

function armJointsFin(player, j, fw, fh) {
  const dx = (j.j1.x - j.j0.x) * (fw || 1);
  const dy = (j.j1.y - j.j0.y) * (fh || 1);
  return {
    j0: { x: Phaser.Math.Clamp(j.j0.x, 0, 1), y: Phaser.Math.Clamp(j.j0.y, 0, 1) },
    ang: Math.atan2(dy, dx),
    dist: Math.max(2, Math.hypot(dx, dy))
  };
}

// GEO-рука из нарисованной текстуры (вместо прямоугольника-заглушки).
// ВАЖНО: поза доворачивает высокую текстуру вдоль кости (низ = дальний
// конец), поэтому у высоких шарнир СВЕРХУ по центру, а у широких —
// слева по центру. Иначе кость центрируется на суставе и торчит назад.
function geoArmImg(player, geoKey, w, h) {
  const scene = player.scene;
  ensureGeoTextures(player, scene);
  const img = scene.add.image(0, 0, geoKey).setDepth(6);
  img._srcW2 = w;
  img._srcH2 = h;
  img._boneRect = false;
  img._slots = [];
  img._setTex = () => {};
  if (h > w) img.setOrigin(0.5, 0.02);
  else img.setOrigin(0.02, 0.5);
  player._allParts.push(img);
  return img;
}

// если texKey нет — ищем fallbackKey (например, предплечье вместо плеча)
function armPart(player, texKey, fallbackColor, fallbackKey) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN && texKey === 'chr_arm_up') {
    return geoArmImg(player, '__geo_arm_up', 14, 24);
  }
  const scene = player.scene;
  const tryKeys = [texKey];
  if (fallbackKey && scene.textures.exists(fallbackKey)) tryKeys.push(fallbackKey);
  let useKey = tryKeys.find(k => scene.textures.exists(k));
  let img;
  if (useKey) {
    img = scene.add.image(0, 0, artTex(player, useKey)).setDepth(6);
    img._srcW2 = cropW(player, useKey);
    img._srcH2 = cropH(player, useKey);
    img._boneRect = false;
  } else {
    img = scene.add.rectangle(0, 0, 10, 10, fallbackColor, 1).setDepth(6);
    img._boneRect = true;
  }
  img.setOrigin(0.02, 0.5);
  player._allParts.push(img);
  return img;
}

// Кость с ПАРНЫМИ текстурами (chr_arm_fore/_hand + суффикс _r/_l).
// fixedSac — если задаётся, текстура ЗАКРЕПЛЯЕТСЯ за этой стороной навсегда
// (например, у задней руки всегда chr_arm_fore_r); иначе кость по-прежнему
// меняет текстуру через img._setTex(sac). Нет ни одной PNG — прямоугольная палка.
function armSlots(player, base, fallbackColor, fixedSac) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
    if (base === 'chr_arm_fore') return geoArmImg(player, '__geo_arm_fore', 10, 22);
    if (base === 'chr_hand') return geoArmImg(player, '__geo_hand', 12, 8);
  }
  const scene = player.scene;
  const slots = [];
  for (const sac of ['_r', '_l']) {
    const key = base + sac;
    const c = cropInfo(player, key);
    const hasTex = scene.textures.exists(key);
    slots.push({ sac, real: hasTex, key, w: c ? c.w : player._srcW(key), h: c ? c.h : player._srcH(key) });
  }
  let firstReal = slots.find(s => s.real || scene.textures.exists(s.key));
  if (fixedSac) {
    const fixed = slots.find(s => s.sac === fixedSac && (s.real || scene.textures.exists(s.key)));
    if (fixed) firstReal = fixed;
  }
  let img;
  if (firstReal) {
    img = scene.add.image(0, 0, artTex(player, firstReal.key)).setDepth(6);
    img._srcW2 = firstReal.w;
    img._srcH2 = firstReal.h;
    img._boneRect = false;
  } else {
    img = scene.add.rectangle(0, 0, 10, 10, fallbackColor, 1).setDepth(6);
    img._srcW2 = 1;
    img._srcH2 = 1;
    img._boneRect = true;
  }
  img.setOrigin(0.02, 0.5);
  img._slots = slots;
  img._setTex = (sac) => {
    if (img._boneRect || fixedSac) return;
    const s = slots.find(v => v.sac === sac && (v.real || scene.textures.exists(v.key)));
    if (!s) return;
    const tk = artTex(player, s.key);
    if (img.texture && img.texture.key !== tk) img.setTexture(tk);
    img._srcW2 = s.w;
    img._srcH2 = s.h;
  };
  player._allParts.push(img);
  return img;
}

function setArmBone(player, img, x, y, rot, len, thick) {
  img.setPosition(x, y);
  if (img._boneRect) {
    img.setRotation(rot);
    img.setSize(Math.max(4, len), Math.max(3, thick));
    img.setScale(1, 1);
  } else if (img._armJ0 && img._armDist > 0) {
    // Срез цельной PNG руки: РАВНОМЕРНЫЙ масштаб по оси суставов арта
    // (сустав0 → сустав1 ложится ровно на кость) — арт не растягивается
    // никогда, при любых длинах костей. Толщина (*W) — лишь лёгкая
    // поправка ±, длину не трогает. Страховка от вырожденной геометрии:
    // масштаб не больше 4× от «прямого» (длина/ширина среза).
    let sc = len / img._armDist;
    sc = Math.min(sc, 4 * len / Math.max(4, img._srcW2 || 1));
    const ac = partCfg(player, 'arms');
    const wfRaw = ac[img._armKind === 'upper' ? 'upW' : 'foreW'];
    const wf = Phaser.Math.Clamp(typeof wfRaw === 'number' ? wfRaw : 1, 0.75, 1.33);
    img.setOrigin(img._armJ0.x, img._armJ0.y);
    img.setRotation(rot - (img._armAng || 0));
    img.setScale(sc, sc * wf);
  } else {
    const w = Math.max(0.05, (img._srcW2 || 1));
    const h = Math.max(0.05, (img._srcH2 || 1));
    // Срезы цельной PNG руки лежат осью кости вдоль X кадра (сустав слева) —
    // их нельзя доворачивать по пропорциям, иначе высокий срез предплечья
    // встал бы поперёк кости. Для остальных PNG — прежняя эвристика.
    const landscape = img._armAxis ? img._armAxis === 'x' : h <= w;
    if (!landscape) {
      // портретный PNG (длинная сторона) — кость лежит вдоль горизонтали,
      // поэтому арт доворачиваем на 90°: верх арта к шарниру, длинная сторона
      // становится длиной кости (иначе «предплечье» сжималось в полоску).
      img.setRotation(rot - Math.PI / 2);
      img.setScale(thick / w, len / h);
    } else {
      img.setRotation(rot);
      img.setScale(len / w, thick / h);
    }
  }
}

// Угол плечо->цель в «зеркальном» кадре (как будто смотрим вправо).
function armBase(player, sx, sy, tx, ty, side) {
  const htx = side < 0 ? 2 * sx - tx : tx;
  return Math.atan2(ty - sy, htx - sx);
}

// 2-сегментная IK рук (плечо+предплечье). Возвращает углы u/f в локальном
// кадре контейнера; контейнер зеркалится scaleX по стороне.
function solveArm(player, sx, sy, tx, ty, side, L1, L2) {
  const htx = side < 0 ? 2 * sx - tx : tx;
  const lx = htx - sx;
  const ly = ty - sy;
  const d = Math.hypot(lx, ly);
  const base = Math.atan2(ly, lx);
  let u;
  let f;
  if (d <= 0.001) {
    u = base;
    f = base + Math.PI;
  } else if (d >= L1 + L2 - 0.001) {
    u = base;
    f = base;
  } else {
    const dEff = Math.max(Math.abs(L1 - L2) + 0.001, Math.min(d, L1 + L2 - 0.001));
    const cosA = Phaser.Math.Clamp((L1 * L1 + dEff * dEff - L2 * L2) / (2 * L1 * dEff), -1, 1);
    const cosB = Phaser.Math.Clamp((L1 * L1 + L2 * L2 - dEff * dEff) / (2 * L1 * L2), -1, 1);
    const alpha = Math.acos(cosA);
    const beta = Math.acos(cosB);
    u = base + alpha;
    f = u + Math.PI + beta;
  }
  return { u, f };
}

// Схема хвата руки для ТЕКУЩЕГО оружия (per-weapon): задняя/передняя кисть по
// линии прицела + своя точка вылета пули. Берём настройку оружия, иначе default.
// Красные точки на PNG (window.__gunGrips) — точнее таблицы: доли арта
// пересчитываются в хват под ТЕКУЩИЕ длины костей (ac).
export function weaponHands(player, ac) {
  const name = player.weapon && player.weapon.name;
  let w = null;
  if (name && player._rcfg && player._rcfg.weaponHands && player._rcfg.weaponHands[name]) {
    w = player._rcfg.weaponHands[name];
  } else if (name && RIG_DEFAULTS.weaponHands && RIG_DEFAULTS.weaponHands[name]) {
    w = RIG_DEFAULTS.weaponHands[name];
  }
  const dw = (RIG_DEFAULTS.weaponHands && RIG_DEFAULTS.weaponHands.default) || {};
  const tw = (name && RIG_DEFAULTS.weaponHands && RIG_DEFAULTS.weaponHands[name]) || null;
  // Полная ширина показа ствола: точки хвата считаются под неё же,
  // иначе ладони не лягут на увеличенный/уменьшенный автомат.
  const gunDispW = 44 * player._gunFullScale(name);
  // Кончик ствола по альфе PNG (window.__gunTips): точнее любой таблицы —
  // точка вылета сидит ровно на дульном срезе при любом масштабе показа.
  // Табличные 57px при показе 44px давали зелёную точку в 20px перед стволом.
  let tipMuzzle = null;
  try {
    const tips = window.__gunTips || {};
    const tkey = name ? weaponImage(name) : null;
    const tip = tkey && tips[tkey];
    if (tip && tip.W > 0 && tip.H > 0) {
      const dispH = tip.H * gunDispW / tip.W;
      tipMuzzle = {
        x: (tip.tx - 0.15) * gunDispW,
        y: (tip.ty - 0.5) * dispH
      };
    }
  } catch (e) { /* без кончика — табличный muzzle */ }
  // Цели кистей — АБСОЛЮТНЫЕ дистанции от плеча вдоль прицела (px),
  // посчитанные от ЖИВОГО положения/размера ствола. Поэтому ладони сидят
  // на рукоятке/цевье при любом СтвX/СтвY и размере, а не только в дефолте.
  // STOCK_G = вынос origin ствола впереди плеча (как в _handWorld).
  // palmP: у GEO-кисти центр ладони ВПЕРЕДИ запястья (пальцы вперёд),
  // поэтому запястье целим чуть назад от точки — ладонь ляжет ровно на неё.
  const STOCK_G = 7;
  const goW = player._gunOffset(name);
  const W0 = 44 * player._charGunK();
  const kW = W0 > 0 ? gunDispW / W0 : 1;
  const L1 = Math.max(4, (ac && ac.upper) || 16);
  const L2 = Math.max(4, (ac && ac.fore) || 12);
  const palmP = Math.min(L2 * 0.45, 10) / 2;
  const baseRearFrac = (w && w.rearFrac) ?? dw.rearFrac ?? 0.86;
  const baseFrontFrac = (w && w.frontFrac) ?? dw.frontFrac ?? 0.92;
  const baseRearDrop = (w && w.rearDrop) ?? dw.rearDrop ?? 3;
  const baseFrontDrop = (w && w.frontDrop) ?? dw.frontDrop ?? 4;
  const out = {
    // Табличный хват, привязанный к стволу: при дефолтном положении
    // и размере (go=0, kW=1) даёт старые доли минус центр ладони;
    // при сдвиге/размере хват едет вместе со стволом.
    rearD: STOCK_G + goW.x + (baseRearFrac * L1 - STOCK_G) * kW - palmP,
    frontD: STOCK_G + goW.x + ((L1 + baseFrontFrac * L2) - STOCK_G) * kW - palmP,
    // Хват НИЖЕ линии ствола (px): ладони лежат на рукоятке/цевье.
    rearDrop: goW.y + baseRearDrop * kW,
    frontDrop: goW.y + baseFrontDrop * kW,
    // Точечная доводка кистей (px, в рамке СТВОЛА: X вдоль, Y вниз
    // по оружию — едет вместе со стволом при любом прицеле/развороте,
    // в отличие от старых мировых rearPX (подхватываются как fallback).
    // Задняя/передняя кисть. По умолчанию нули.
    rearFX: (w && w.rearFX) ?? (w && w.rearPX) ?? 0,
    rearFY: (w && w.rearFY) ?? (w && w.rearPY) ?? 0,
    frontFX: (w && w.frontFX) ?? (w && w.frontPX) ?? 0,
    frontFY: (w && w.frontFY) ?? (w && w.frontPY) ?? 0,
    // Точка вылета: ручная → кончик ствола по PNG → табличная → дефолт.
    // Табличная точка задана под базу 44px — масштабируем под показ;
    // ручная уже в мировых пикселях показа, её не трогаем.
    muzzle: (w && w.muzzle) || tipMuzzle || (tw && tw.muzzle
      ? { x: tw.muzzle.x * player._gunFullScale(name), y: tw.muzzle.y * player._gunFullScale(name) }
      : null)
  };
  try {
    const G = window.__gunGrips || {};
    const gkey = name ? weaponImage(name) : null;
    const g = gkey && G[gkey];
    player._lastGripKey = gkey;
    // Красные точки на PNG (доли арта) → мировые цели от живого ствола:
    // origin ствола стоит на STOCK_G+go.x впереди плеча, точка арта
    // (gx,gy) ложится на (gx-0.15)*W вдоль и (gy-0.5)*высоту поперёк.
    // Запястье целим на palmP назад от точки — центр ладони ляжет ровно
    // на неё. Свес — точный, без зажимов: где точка, там ладонь.
    if (g && g.W > 0 && g.H > 0) {
      const dispH = g.H * gunDispW / g.W;
      const dotRearD = STOCK_G + goW.x + (g.rx - 0.15) * gunDispW - palmP;
      const dotFrontD = STOCK_G + goW.x +
        (g.fx != null ? (g.fx - 0.15) * gunDispW : (g.rx - 0.15) * gunDispW) - palmP;
      const dotRearDrop = (g.ry - 0.5) * dispH;
      const dotFrontDrop = g.fy != null ? (g.fy - 0.5) * dispH : dotRearDrop;
      // Ручные правки (Рук/Цев/РукY/ЦевY) работают ОФФСЕТАМИ поверх точек:
      // неоткрученное = 0 и чистые точки; покрутил — сдвинул. Поэтому с
      // точками кнопки никогда не «мертвые».
      const tR = (RIG_DEFAULTS.weaponHands[name] && RIG_DEFAULTS.weaponHands[name].rearFrac) ?? dw.rearFrac ?? 0.86;
      const tF = (RIG_DEFAULTS.weaponHands[name] && RIG_DEFAULTS.weaponHands[name].frontFrac) ?? dw.frontFrac ?? 0.92;
      const tRd = (RIG_DEFAULTS.weaponHands[name] && RIG_DEFAULTS.weaponHands[name].rearDrop) ?? dw.rearDrop ?? 3;
      const tFd = (RIG_DEFAULTS.weaponHands[name] && RIG_DEFAULTS.weaponHands[name].frontDrop) ?? dw.frontDrop ?? 4;
      const oR = ((w && w.rearFrac) ?? tR) - tR;
      const oF = ((w && w.frontFrac) ?? tF) - tF;
      const oRd = ((w && w.rearDrop) ?? tRd) - tRd;
      const oFd = ((w && w.frontDrop) ?? tFd) - tFd;
      out.rearD = dotRearD + oR * L1;
      out.frontD = dotFrontD + oF * L2;
      out.rearDrop = goW.y + dotRearDrop + oRd;
      out.frontDrop = goW.y + dotFrontDrop + oFd;
      out.src = 'dots';
    } else {
      out.src = 'table';
    }
  } catch (e) { /* без точек — табличный хват */ out.src = 'table'; }
  player._lastGripSrc = out.src;
  return out;
}

// Отдача одним пакетом: ствол отъезжает назад по оси прицела
// и чуть вверх по экрану, обе кисти едут с ним (см. _poseArm).
// Амплитуда — от урона оружия (пистолет ~0.5, винтовка ~0.8, слонобой ~1.8).
// Ближний бой без отдачи (там свой взмах). Огибающая — синус за _recoilDur.
export function recoilKick(player) {
  try {
    if (!player._recoilT || !player.weapon || player.weapon.isMelee) return { back: 0, up: 0 };
    const p = Phaser.Math.Clamp(player._recoilT / player._recoilDur, 0, 1);
    const env = Math.sin(p * Math.PI);
    const amp = Phaser.Math.Clamp((player.weapon.damage || 20) / 28, 0.4, 1.8);
    return { back: 6 * amp * env, up: 3 * amp * env };
  } catch (e) {
    return { back: 0, up: 0 };
  }
}

// Две руки, обе на оружии: задняя — у рукоятки, передняя — на цевье.
// Автомат лежит НА линии прицела; цели кистей — на той же линии, но ОПУЩЕНЫ
// под неё (rearDrop/frontDrop): ладони обхватывают рукоятку/цевьё снизу,
// а не лежат на стволе. Локоть считает 2-сегментная IK.
// this._handWorld = точка автомата (НА линии прицела над задней кистью) —
// оттуда позиционируется оружие и считается muzzle; сама кисть — ниже.
export function poseArm(player, sx, sy, tx, ty, side, ac) {
  const L1 = Math.max(4, ac.upper || 16);
  const L2 = Math.max(4, ac.fore || 12);
  const wh = weaponHands(player, ac);
  const rearD = wh.rearD;   // уже абсолютные px от плеча (привязка к стволу внутри)
  const frontD = wh.frontD;

  let rear;
  let front;
  if (player._throwT >= 0) {
    // бросок гранаты: прежняя анимация «замах+бросок», вторая рука параллельно
    const base = armBase(player, sx, sy, tx, ty, side);
    const p = Phaser.Math.Clamp(player._throwT / Math.max(1, player._throwDur), 0, 1);
    const rise = player._throwRaise || 2.4;
    const wind = player._throwWind || 0.38;
    const ease = v => v * v * (3 - 2 * v);
    let u;
    let f;
    if (p < wind) {
      const w = Phaser.Math.Clamp(p / wind, 0, 1);
      u = base - rise * ease(w);
      f = u + 1.5 * (1 - ease(w));
    } else {
      const t = Phaser.Math.Clamp((p - wind) / (1 - wind), 0, 1);
      u = base - rise * (1 - ease(t)) + 0.3 * ease(t);
      f = u + 1.5 * (1 - ease(t));
    }
    rear = { u, f };
    front = { u: u + 0.05, f };
  } else {
    const aimAng = Math.atan2(ty - sy, tx - sx);
    // Отдача: ОБЕ кисти едут назад по оси ствола вместе с ним
    // (раньше дёргалась только задняя). Амплитуда — от урона оружия.
    const _rk = recoilKick(player);
    const rearDAdj = rearD - _rk.back;
    const frontDAdj = frontD - _rk.back;
    // Свес — ПЕРПЕНДИКУЛЯРНО стволу, на сторону рукоятки: берём угол
    // поворота самого автомата (rotAim, с зеркалом), а не линии прицела.
    // Наивный «вниз по миру» держит руки только на горизонтали, а на крутом
    // угле перчатки съезжают со ствола. Зеркало учтено: local-вниз арта
    // всегда маппится в (-sin(rot), cos(rot)) при любом side.
    const rotAim = side < 0 ? aimAng + Math.PI : aimAng;
    const ppx = -Math.sin(rotAim);
    const ppy = Math.cos(rotAim);
    const rearW = {
      x: sx + Math.cos(aimAng) * (rearDAdj + (wh.rearFX || 0)) + ppx * ((wh.rearDrop || 0) + (wh.rearFY || 0)),
      y: sy + Math.sin(aimAng) * (rearDAdj + (wh.rearFX || 0)) + ppy * ((wh.rearDrop || 0) + (wh.rearFY || 0))
    };
    const frontW = {
      x: sx + Math.cos(aimAng) * (frontDAdj + (wh.frontFX || 0)) + ppx * ((wh.frontDrop || 0) + (wh.frontFY || 0)),
      y: sy + Math.sin(aimAng) * (frontDAdj + (wh.frontFX || 0)) + ppy * ((wh.frontDrop || 0) + (wh.frontFY || 0))
    };
    // Перезарядка: кисти приклеены к стволу — едут вместе с его наклоном
    // (тот же dipR/dipY, что в updateGun), плюс передняя рука отрывается
    // от цевья и уходит к магазину. Фазы — от реального прогресса,
    // поэтому анимация ровно по длительности перезарядки.
    const _ra2 = player._reloadAnim ? player._reloadAnim() : null;
    if (_ra2 && (_ra2.tilt > 0.001 || _ra2.magEnv > 0.001)) {
      const ORIGIN_D = 7; // origin ствола впереди плеча (как STOCK_G ниже)
      const dipR2 = _ra2.dipR;
      const cD = Math.cos(dipR2), sD = Math.sin(dipR2);
      const dirX = Math.cos(aimAng), dirY = Math.sin(aimAng);
      // Вниз по оружию (зеркало учтено — как ppx/ppy выше).
      const rotA = side < 0 ? aimAng + Math.PI : aimAng;
      const dnX = -Math.sin(rotA), dnY = Math.cos(rotA);
      // Дистанции хвата от origin ствола вдоль +X.
      const Drear = (rearDAdj + (wh.rearFX || 0)) - ORIGIN_D;
      const Dfront = (frontD + (wh.frontFX || 0)) - ORIGIN_D;
      const dropr = (wh.rearDrop || 0) + (wh.rearFY || 0);
      const dropf = (wh.frontDrop || 0) + (wh.frontFY || 0);
      // Поворот точки хвата (D, drop) на dipR вокруг origin + сдвиг вниз:
      // задняя кисть держит наклонённый ствол, передняя — тоже (пока на цевье).
      // Знак кросс-членов от зеркала (side<0): локальный +X после flipX
      // маппится иначе — без mSide кисти уходили бы от ствола при развороте.
      const mSide = side < 0 ? -1 : 1;
      const gxR = Drear * (cD - 1) - mSide * dropr * sD;
      const gyR = mSide * Drear * sD + dropr * (cD - 1);
      rearW.x += dirX * gxR + dnX * gyR;
      rearW.y += dirY * gxR + dnY * gyR + _ra2.dipY;
      const gxF = Dfront * (cD - 1) - mSide * dropf * sD;
      const gyF = mSide * Dfront * sD + dropf * (cD - 1);
      frontW.x += dirX * gxF + dnX * gyF;
      frontW.y += dirY * gxF + dnY * gyF + _ra2.dipY;
      // Экскурс к магазину: магазин жёстко на стволе между кистями
      // (ближе к задней), на 30px ниже линии ствола. O сокращается —
      // считаем разность в рамке ствола, мир не нужен.
      if (_ra2.magEnv > 0.001) {
        const env = _ra2.magEnv;
        const Dm = Drear + (Dfront - Drear) * 0.35;
        const dropm = 30;
        const dX = (Dm * cD - mSide * dropm * sD) - (Dfront * cD - mSide * dropf * sD);
        const dY = (mSide * Dm * sD + dropm * cD) - (mSide * Dfront * sD + dropf * cD);
        frontW.x += (dirX * dX + dnX * dY) * env;
        frontW.y += (dirY * dX + dnY * dY) * env;
        // Захват из подсумка: в середине ухода рука ныряет ниже-назад,
        // к концу — доводит магазин в шахту (чуть вперёд-вверх).
        const grab = Math.sin(Math.PI * Math.max(0, Math.min(1, env)));
        frontW.x += (dnX * 8 - dirX * 6) * grab;
        frontW.y += (dnY * 8 + 5) * grab;
      }
    }
    // Дотягивание до цели — приоритет над позой:
    // 1) цель в пределах рук — обычная IK (сгиб работает в полную силу);
    // 2) цель близко к пределу — сгиб гаснет, локоть РАЗГИБАЕТСЯ к точке;
    // 3) цель дальше рук — плечо и предплечье РАВНОМЕРНО тянутся
    //    (один коэффициент на обе кости), локоть прямой, кисть ТОЧНО в цели.
    const solveBent = (wx, wy, bend) => {
      const hx = side < 0 ? 2 * sx - wx : wx;
      const d = Math.hypot(hx - sx, wy - sy);
      const maxR = L1 + L2;
      if (d >= maxR - 0.001) {
        const k = Math.min(d / Math.max(0.001, maxR), 3);
        const base = Math.atan2(wy - sy, hx - sx);
        return { u: base, f: base, l1: L1 * k, l2: L2 * k };
      }
      const sol = solveArm(player, sx, sy, wx, wy, side, L1, L2);
      const ext = Phaser.Math.Clamp((d - maxR * 0.55) / (maxR * 0.45), 0, 1);
      const b = (bend || 0) * (1 - ext);
      if (!b) return { u: sol.u, f: sol.f, l1: L1, l2: L2 };
      const u = sol.u + b;
      const ex = sx + L1 * Math.cos(u);
      const ey = sy + L1 * Math.sin(u);
      return { u, f: Math.atan2(wy - ey, wx - ex), l1: L1, l2: L2 };
    };
    rear = solveBent(rearW.x, rearW.y, (ac.elbowBendRear || 0));
    front = solveBent(frontW.x, frontW.y, (ac.elbowBendFront || 0));
    // Точка автомата (origin 0.15) — в STOCK_G (7px) от плеча вдоль прицела,
    // а НЕ в rearD: иначе дистанция хвата считается дважды (раз в rearD,
    // раз в позиции грипа от origin) — ствол уезжает вперёд, «парит» и
    // приклад не достаёт до плеча. Задник ствола упирается в плечо,
    // а центры ладоней ложатся ровно на свои метки.
    const aL = Math.atan2(ty - sy, (side < 0 ? 2 * sx - tx : tx) - sx);
    const STOCK_G = 7;
    player._handWorld = {
      x: sx + side * STOCK_G * Math.cos(aL),
      y: sy + STOCK_G * Math.sin(aL)
    };
  }

  const pose = (chain, u, f, l1, l2) => {
    const elbX = l1 * Math.cos(u);
    const elbY = l1 * Math.sin(u);
    const hndX = elbX + l2 * Math.cos(f);
    const hndY = elbY + l2 * Math.sin(f);
    setArmBone(player, chain.up, 0, 0, u, l1, ac.s ? Math.max(5, ac.s * (ac.upW ?? 0.28)) : 7);
    // Верх предплечья прячем на 3px ВНУТРЬ рукава (назад вдоль своей оси):
    // шов среза тонет в рукаве, кисть при этом ровно в цели. Как OVERLAP
    // у икры в колене, только вдоль своей кости — длина до кисти не страдает.
    const ARM_OV = 3;
    setArmBone(player, chain.fore, elbX - ARM_OV * Math.cos(f), elbY - ARM_OV * Math.sin(f),
      f, l2, ac.s ? Math.max(4, ac.s * (ac.foreW ?? 0.22)) : 6);
    setArmBone(player, chain.hand, hndX, hndY, f, Math.min(l2 * 0.45, 10), 7);
    return { hndX, hndY };
  };

  const rr = pose({ up: player._armUpRear, fore: player._armForeRear, hand: player._handRear }, rear.u, rear.f, rear.l1 ?? L1, rear.l2 ?? L2);
  pose({ up: player._armUpFront, fore: player._armForeFront, hand: player._handFront }, front.u, front.f, front.l1 ?? L1, front.l2 ?? L2);

  player.armGun.setPosition(sx, sy);
  player.armGun.setRotation(0);
  player.armGun.setScale(side, 1);
  player.armFront.setPosition(sx, sy);
  player.armFront.setRotation(0);
  player.armFront.setScale(side, 1);
  // Взмах ближнего боя: вся сборка рук доворачивается вокруг плеча.
  // Поворот контейнера — в мировых координатах при любом зеркале
  // (матрица T·R·S: flip внутри, rotation снаружи), поэтому знак один.
  try {
    const swW = player._swingRot();
    if (swW) {
      player.armGun.rotation += swW;
      player.armFront.rotation += swW;
    }
  } catch (e) {}
  // В броске _handWorld не выставлялся выше (там кисть = точка оружия) —
  // ставим как раньше; в обычной позе точка уже стоит на линии прицела.
  if (player._throwT >= 0) {
    player._handWorld = { x: sx + side * rr.hndX, y: sy + rr.hndY };
  }
}
