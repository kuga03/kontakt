
import { getEquippedShoes, getEquippedPants } from '../../../data/gameState.js?v=175';

import { ensureGeoTextures } from './gear.js?v=395';
import { artTex, cropH, cropW, GEO_HUMAN, partCfg, targetH } from './config.js';
export function buildLegsRun(player) {
  const scene = player.scene;
  const cfg = partCfg(player, 'legs');
  // Процедурный скелет ног. Два режима:
  //  - full: ЦЕЛЬНАЯ PNG на ногу — текстура режется по линии колена
  //    (kneeL/kneeR) на бедро+икру. Пара текстур (оливковая пара, джинсы)
  //    или одна на обе ноги (клон). Нога масштабируется РАВНОМЕРНО
  //    (пропорции арта не искажаются), и гнётся той же 2-сегментной IK;
  //  - parts: классические 4 части (chr_pants_thigh/shin_l/r) + стопа chr_shoes.
  player._legsSkeleton = true;
  player._legsFull = hasFullLegs(player, cfg.legSet);
  player._legsH = targetH(player, 'legs');
  player._shoeH = targetH(player, 'shoes');
  // Длина ног: явные thigh/shin в конфиге — приоритет; иначе s*0.5+s*0.5.
  // Раньше тут всегда читался cfg.thigh (дефолт RIG_DEFAULTS = 13), из-за чего
  // кнопки «Размер ∓» (legs.s) не меняли длину скелета вообще.
  const rawLegs = cfg;
  player._legThigh = typeof rawLegs.thigh === 'number' ? rawLegs.thigh : (cfg.s ? cfg.s * 0.5 : 12);
  player._legShin = typeof rawLegs.shin === 'number' ? rawLegs.shin : (cfg.s ? cfg.s * 0.5 : 12);

  player.legsRun = scene.add.container(player.x, player.y).setDepth(4.6);
  player._allParts.push(player.legsRun);

  if (player._legsFull) {
    const pair = legTexPair(player);
    player._thighL = legSlicePart(player, pair[0], cfg.kneeL ?? 0.5, 0x2a4f8f, 'thigh', 'l');
    player._thighR = legSlicePart(player, pair[1], cfg.kneeR ?? 0.5, 0x2a4f8f, 'thigh', 'r');
    player._shinL = legSlicePart(player, pair[0], cfg.kneeL ?? 0.5, 0x22407a, 'shin', 'l');
    player._shinR = legSlicePart(player, pair[1], cfg.kneeR ?? 0.5, 0x22407a, 'shin', 'r');
  } else {
    player._thighL = bonePart(player, 'chr_pants_thigh_l', 0x2a4f8f, cfg.thighW ?? 0.45, 'thigh');
    player._thighR = bonePart(player, 'chr_pants_thigh_r', 0x2a4f8f, cfg.thighW ?? 0.45, 'thigh');
    player._shinL = bonePart(player, 'chr_pants_shin_l', 0x22407a, cfg.shinW ?? 0.65, 'shin');
    player._shinR = bonePart(player, 'chr_pants_shin_r', 0x22407a, cfg.shinW ?? 0.65, 'shin');
  }
  player._footL = bonePart(player, 'chr_shoes', 0x111111, cfg.footW ?? 1, 'foot');
  player._footR = bonePart(player, 'chr_shoes', 0x111111, cfg.footW ?? 1, 'foot');
  // Порядок слоёв: сначала ступни, потом штаны — штанина лежит ПОВЕРХ
  // кроссовка (низ джинсов закрывает верх обуви, как в жизни).
  player.legsRun.add([player._footL, player._footR, player._thighL, player._thighR, player._shinL, player._shinR]);
  // Левая/правая нога отображаются ОДИНАКОВОЙ толщины: арт ног/их срезов обычно
  // разной ширины (напр. chr_pants_leg_l 56px vs chr_pants_leg_r 104px), из-за чего
  // при повороте персонажа одна икра «жирнее» другой. Толщина пары нормализуется
  // к среднему отношению ширина/высота, высота (длина кости) остаётся как есть.
  legPairW(player, '_thighL', '_thighR');
  legPairW(player, '_shinL', '_shinR');

  // Авто-выравнивание ботинок под икру: ботинок (ступня) пиннится в геометрическую
  // цель стопы, а визуальная щиколотка арта икры смещена в кадре (у левой/правой
  // ноги арт разной ширины). Запоминаем сдвиг низа _shin* от его шарнира; poseFoot
  // пересчитывает его в мировые пиксели по текущему повороту/масштабу кости.
  ankleAlign(player, '_shinL');
  ankleAlign(player, '_shinR');

  console.info('[RIG] skeleton legs:', JSON.stringify({
    legSet: player._legsFull ? 'full' : 'parts',
    pair: player._legsFull ? legTexPair(player) : null,
    kneeL: player._legsFull ? +(cfg.kneeL ?? 0.5).toFixed(2) : null,
    kneeR: player._legsFull ? +(cfg.kneeR ?? 0.5).toFixed(2) : null,
    thigh: player._legThigh, shin: player._legShin, s: cfg.s, fps: cfg.fps || 14,
    bobX: cfg.bobX, bobY: cfg.bobY, swing: cfg.swing ?? 0.28, knee: cfg.knee ?? 0.15,
    lift: cfg.lift ?? 0.4, shoes: !!scene.textures.exists('chr_shoes')
  }));
}

// Пара цельных текстур ног [левая, правая]: оливковая пара (левая без
// кармана + правая); одна правая + клон; пара джинсов; иначе null (parts).
function legTexPair(player) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return null;
  const t = player.scene.textures;
  if (t.exists('olive_pants_l') && t.exists('olive_pants')) return ['olive_pants_l', 'olive_pants'];
  if (t.exists('olive_pants') && t.exists('olive_pants_r')) return ['olive_pants', 'olive_pants_r'];
  if (t.exists('jeans_left') && t.exists('jeans_right')) return ['jeans_left', 'jeans_right'];
  return null;
}

// Режим «одна PNG на ногу»: auto = включён, если есть пара цельных текстур
// (одна на обе ноги или две); 'full'/'parts' — принудительно, для отладки/фолбэка.
function hasFullLegs(player, legSet) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return false;
  if (legSet === 'parts') return false;
  if (legSet === 'full') return true;
  return !!legTexPair(player);
}

// Срез-кость из ЦЕЛЬНОЙ текстуры ноги: одной PNG режем по линии колена кадры
// 'LEG_TOP' (таз..колено) и 'LEG_BOT' (колено..стопа). Оба среза — из одной
// текстуры, поэтому стык на колене идеально совпадает. Шарнир = верхний сустав
// СРЕЗА: у бедра — таз, у икры — колено (по альфе арта, как у обычных костей).
// Толщина у срезов не множится (thighW/shinW): это ЕДИНЫЙ арт ноги — его нельзя
// «сузить» на одной половине, не сломав пропорции; PNG ресуется автором.
function legSlicePart(player, texKey, cut, fallbackColor, kind, sideKey) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return null;
  const scene = player.scene;
  const artKey = artTex(player, texKey);
  const tex = artKey && scene.textures.exists(artKey) ? scene.textures.get(artKey) : null;
  const hasTex = scene.textures.exists(texKey);
  if (!hasTex || !tex) {
    // цельной PNG нет — фолбэк на классическую часть (chr_pants_thigh/shin_*)
    return bonePart(player, 'chr_pants_' + kind + '_' + sideKey, fallbackColor, 0.45, kind);
  }
  const src = tex.getSourceImage();
  const W = (src && src.width) || 0;
  const H = (src && src.height) || 0;
  if (!W || H < 4) {
    return bonePart(player, 'chr_pants_' + kind + '_' + sideKey, fallbackColor, 0.45, kind);
  }
  const top = kind === 'thigh';
  // Битый cut (NaN) даёт NaN-кадр нулевого размера → WebGL
  // texImage2D падает и чёрный экран. Уходим в классику.
  if (typeof cut !== 'number' || !Number.isFinite(cut)) {
    return bonePart(player, 'chr_pants_' + kind + '_' + sideKey, fallbackColor, 0.45, kind);
  }
  const cutPx = Math.round(Phaser.Math.Clamp(cut, 0.2, 0.8) * H);
  const oy = top ? 0 : Math.min(H - 2, cutPx);
  const h = top ? Math.max(2, cutPx) : Math.max(2, H - cutPx);
  if (!Number.isFinite(oy) || !Number.isFinite(h) || h < 2) {
    return bonePart(player, 'chr_pants_' + kind + '_' + sideKey, fallbackColor, 0.45, kind);
  }
  const name = top ? 'LEG_TOP' : 'LEG_BOT';
  // Пересоздаём кадр ТОЛЬКО если срез реально изменился: кадры общие для всех
  // спрайтов этой текстуры, и пересоздание «на пустом месте» сломало бы ноги
  // других игроков (у всех один глобальный rig-конфиг — срезы совпадают,
  // мутаций не происходит).
  const curFr = tex.frames ? tex.frames[name] : null;
  if (!curFr || curFr.width !== W || curFr.height !== h || curFr.cutY !== oy) {
    if (curFr) tex.remove(name);
    tex.add(name, 0, 0, oy, W, h);
  }
  const img = scene.add.image(0, 0, artKey, name).setDepth(4.6);
  img._srcW = W;
  img._srcH = h;
  img._boneWf = 1;
  img._boneWfKey = null;
  img._boneBot = null;
  const pv = bonePivot(player, artKey, W, h, kind, oy);
  const lg = partCfg(player, 'legs');
  if (lg) {
    if (typeof lg[kind + 'Px'] === 'number') pv.px = lg[kind + 'Px'];
    if (typeof lg[kind + 'Py'] === 'number') pv.py = lg[kind + 'Py'];
  }
  img._bonePx = pv.px;
  img._bonePy = pv.py;
  img.setOrigin(pv.px, pv.py);
  player._allParts.push(img);
  return img;
}

// Спрайт/прямогоугольник одного сегмента скелета.  texKey — имя текстуры PNG-части
// (chr_pants_thigh_l / chr_pants_shin_l / chr_shoes); пока файла нет — прямоугольник-заглушка.
// У частей с суффиксом _l/_r есть запасной «общий» ключ без суффикса (chr_pants_thigh).
function bonePart(player, texKey, fallbackColor, widthFactor, kind) {
  const scene = player.scene;
  // GEO: кости — прямоугольники, а ступня — нарисованный кед
  // (PNG не трогаем, без canvas-сканов).
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
    if (kind === 'foot') {
      ensureGeoTextures(player, scene);
      // Купленная обувь вместо базового кеда (тот же размер 22x13).
      // У ботов — рандомная из гардероба.
      let shoeKey = '__geo_shoe';
      try {
        if (player._botGear && player._botGear.shoe && scene.textures.exists(player._botGear.shoe)) {
          shoeKey = player._botGear.shoe;
        } else if (!player._netForeign) {
          const eqS = getEquippedShoes((player.constructor && player.constructor.name) || undefined);
          // Любая купленная обувь (её текстуры бейкаются вместе с гардеробом).
          if (eqS && scene.textures.exists(eqS)) shoeKey = eqS;
        }
      } catch (e) {}
      const shoe = scene.add.image(0, 0, shoeKey).setDepth(4.6);
      shoe._srcH = 13;
      shoe._srcW = 22;
      shoe._boneRect = false;
      shoe._boneWf = widthFactor;
      shoe._boneWfKey = kind + 'W';
      shoe.setOrigin(0.5, 0.25);
      player._allParts.push(shoe);
      return shoe;
    }
    // Штаны тоже рисованные: бедро с карманом, икра с манжетой.
    // Шарнир кости («Пив» + Px/Py) сразу ставим в origin — превью
    // пересоздаётся на каждый клик, так что origin всегда свежий.
    if (kind === 'thigh' || kind === 'shin') {
      ensureGeoTextures(player, scene);
      const isThigh = kind === 'thigh';
      // Купленные штаны из магазина вместо базовых (тот же размер).
      // У ботов — рандомные из гардероба.
      let legKey = isThigh ? '__geo_thigh' : '__geo_shin';
      try {
        let pantsId = null;
        if (player._botGear && player._botGear.pants && scene.textures.exists(player._botGear.pants + (isThigh ? '_up' : '_low'))) {
          pantsId = player._botGear.pants;
        } else if (!player.isAI) {
          const eqP = (typeof getEquippedPants === 'function') ? getEquippedPants((player.constructor && player.constructor.name) || undefined) : null;
          if (eqP) pantsId = eqP;
        }
        const cand = pantsId ? pantsId + (isThigh ? '_up' : '_low') : null;
        if (cand && scene.textures.exists(cand)) legKey = cand;
      } catch (e) {}
      const leg = scene.add.image(0, 0, legKey).setDepth(4.6);
      leg._srcH = isThigh ? 28 : 26;
      leg._srcW = isThigh ? 16 : 14;
      leg._boneRect = false;
      leg._boneWf = widthFactor;
      leg._boneWfKey = kind + 'W';
      try {
        const lg = partCfg(player, 'legs');
        const opx = lg[kind + 'Px'];
        const opy = lg[kind + 'Py'];
        leg.setOrigin(typeof opx === 'number' ? opx : 0.5, typeof opy === 'number' ? opy : 0);
      } catch (e) {
        leg.setOrigin(0.5, 0);
      }
      player._allParts.push(leg);
      return leg;
    }
    const img = scene.add.rectangle(0, 0, 10, 10, fallbackColor, 1).setDepth(4.6);
    img._boneRect = true;
    img._boneWf = widthFactor;
    img._boneWfKey = kind + 'W';
    img._boneRectStick = { thigh: 0.45, shin: 0.35, foot: 0.9 }[kind] ?? 0.5;
    img._skeletonColor = fallbackColor;
    if (kind === 'foot') img.setOrigin(0.5, 0.25);
    else img.setOrigin(0.5, 0);
    player._allParts.push(img);
    return img;
  }
  const cand = [texKey];
  const base = texKey.replace(/_(l|r)$/, '');
  if (base !== texKey) cand.push(base);
  const realKey = cand.find(k => window.__realTextures && window.__realTextures.has(k));
  const shoeFb = !realKey && texKey === 'chr_shoes' && scene.textures.exists(texKey);
  let img;
  if (realKey || shoeFb) {
    img = scene.add.image(0, 0, artTex(player, realKey)).setDepth(4.6);
    img._srcH = cropH(player, realKey) || 1;
    img._srcW = cropW(player, realKey) || 1;
    img._boneWf = widthFactor;
    img._boneWfKey = kind + 'W';
    // Шарнир кости ставим в РЕАЛЬНЫЙ сустав арта (верхний сустав PNG), а не в
    // геометрический центр кадра: арт нарисован наискось, из-за чего икра
    // «отъезжала» от бедра (щель на колене). Пивот вычисляем по альфе PNG.
    const pv = bonePivot(player, artTex(player, realKey), img._srcW, img._srcH, kind);
    // пивот кости можно переопределить вручную (thighPx/thighPy/shinPx/shinPy):
    // auto = по альфе арта. thighBot/shinBot (ручная «натяжка») превращают
    // stretch в полосу [Py..Bot] арта → ровно на длину кости.
    const lg = partCfg(player, 'legs');
    img._boneBot = null;
    if (lg && kind !== 'foot') {
      if (typeof lg[kind + 'Px'] === 'number') pv.px = lg[kind + 'Px'];
      if (typeof lg[kind + 'Py'] === 'number') pv.py = lg[kind + 'Py'];
      if (typeof lg[kind + 'Bot'] === 'number') img._boneBot = lg[kind + 'Bot'];
    }
    img._bonePx = pv.px;
    img._bonePy = pv.py;
    img.setOrigin(pv.px, pv.py);
  } else {
    img = scene.add.rectangle(0, 0, 10, 10, fallbackColor, 1).setDepth(4.6);
    img._boneRect = true;
    img._boneWf = widthFactor;
    img._boneWfKey = kind + 'W';
    // у прямоугольника-заглушки толщина — «доля длины» (0.45 бедро, 0.35 икра,
    // 0.9 ступня), а cfg.*W (множитель ширины НАТУРАЛЬНОГО PNG-арта) лишь
    // подстраивает её: при дефолте 1.0 пропорция та же, что раньше.
    img._boneRectStick = { thigh: 0.45, shin: 0.35, foot: 0.9 }[kind] ?? 0.5;
    img._skeletonColor = fallbackColor;
    // у заглушки-прямоугольника шарнир геометрический
    if (kind === 'foot') img.setOrigin(0.5, 0.25);
    else img.setOrigin(0.5, 0);
  }
  player._allParts.push(img);
  return img;
}

// Нормализация толщины ПАРЫ ног (бедро/икра): если левая и правая текстурки
// разной ширины (разные PNG, разные срезы), без этого одна нога выглядит жирнее
// другой. Берём СРЕДНЮЮ пропорцию ширины к высоте арта пары и виртуально
// растягиваем обе текстуры до неё — видимая толщина становится одинаковой,
// а «Толщ.б/и» (wf) по-прежнему меняет обе ноги разом.
function legPairW(player, keyL, keyR) {
  const a = player[keyL];
  const b = player[keyR];
  if (!a || !b || a._boneRect || b._boneRect) return;
  // Пропорции вырожденных срезов-щепок (срез у края арта) не должны отравлять
  // среднее: клампим каждую долю к sane-диапазону, иначе здоровая нога пары
  // раздувается в разы (щепка 69x19 даёт пропорцию 3.6 и тянет среднюю вверх).
  const cl = r => Phaser.Math.Clamp(r, 0.15, 1.5);
  const ra = (a._srcH && a._srcW) ? a._srcW / a._srcH : 0;
  const rb = (b._srcH && b._srcW) ? b._srcW / b._srcH : 0;
  if (!(ra > 0) || !(rb > 0)) return;
  const avg = (cl(ra) + cl(rb)) / 2;
  a._pairAvg = avg;
  b._pairAvg = avg;
}

// Установить позицию, поворот и масштаб сегмента скелета.  sgn: 1=вправо, -1=влево (зеркало).
// Толщина кости читается ЖИВОЙ из конфига (img._boneWfKey → legs.*W), а не из
// значения, запечённого при создании: иначе кнопки «Толщ.и» в редакторе ничего
// не меняют на PNG-костях.
function boneWfCurrent(player, img) {
  if (img._boneWfKey) {
    const v = partCfg(player, 'legs')[img._boneWfKey];
    if (typeof v === 'number') return v;
  }
  return img._boneWf ?? 1;
}

// overshoot — «запас» длины ВИЗУАЛА кости вниз вдоль неё (ширина не
// меняется): кончик арта уходит глубже цели сустава и прячется под
// следующую часть. Нужен икре: её позиция сдвинута вверх на OVERLAP
// (перекрыть колено), без overshoot кончик не доставал бы до ботинка.
// Короткий топот на посадке ноги: фаза уже синхронизирована с шагом
// (вызывается в момент касания). Громкость по дистанции (далёких не слышно),
// плюс антидребезг 140мс на персонажа.
export function playStep(player) {
  try {
    const sc = player.scene;
    if (!sc || !sc.sound || sc.sound.locked) return;
    if (!sc.cache || !sc.cache.audio || !sc.cache.audio.exists('sfx_step')) return;
    const now = sc.time.now;
    if (now - (player._stepAt || 0) < 140) return;
    player._stepAt = now;
    let vol = 0.3;
    if (typeof sc._sfxVolAt === 'function') {
      vol = sc._sfxVolAt(player.x, player.y, 0.32);
      if (vol < 0.04) return;
    }
    sc.sound.play('sfx_step', { volume: vol });
  } catch (e) { /* noop */ }
}

export function setBone(player, img, x, y, rot, sgn, targetH, overshoot = 0) {
  img.setPosition(x, y);
  img.setRotation(rot);
  const wf = boneWfCurrent(player, img);
  if (img._boneRect) {
    // Пивот кости бедра/икры (кнопки «Пив» + Px/Py): свой шарнир вместо
    // геометрического. Не задан — как раньше (верх по центру).
    try {
      const wfk = img._boneWfKey || '';
      const bkind = wfk === 'thighW' ? 'thigh' : (wfk === 'shinW' ? 'shin' : null);
      if (bkind) {
        const lg = partCfg(player, 'legs');
        const cpx = lg[bkind + 'Px'];
        const cpy = lg[bkind + 'Py'];
        if (typeof cpx === 'number' || typeof cpy === 'number') {
          img.setOrigin(typeof cpx === 'number' ? cpx : 0.5, typeof cpy === 'number' ? cpy : 0);
        } else {
          img.setOrigin(0.5, 0);
        }
      }
    } catch (e) {}
    img.setSize(Math.max(4, targetH * wf * (img._boneRectStick ?? 0.5)), targetH + overshoot);
    img.setScale(sgn, 1);
  } else {
    // Ручная натяжка ([Py..Bot] арта — ровно на длину кости): полоса арта между
    // суставами ложится на кость без искажений, верх обрезается родителем,
    // низ — ботинком. Без Bot (null) — прежняя авто-натяжка (весь PNG под кость).
    if (typeof img._boneBot === 'number' && img._boneBot > img._bonePy + 0.02) {
      const band = img._boneBot - img._bonePy;
      const sc = targetH / (band * (img._srcH || 1));
      img.setOrigin(img._bonePx, img._bonePy);
      img.setScale(sc * sgn * wf, (targetH + overshoot) / (band * (img._srcH || 1)));
    } else {
      const sc = targetH / (img._srcH || 1);
      // Выравнивание толщины пары ног: виртуальная ширина = средняя пропорция
      // пары × длина кости. Меняем только scaleX (по ширине), высота (длина)
      // кости неприкосновенна.
      img.setScale(img._pairAvg ? (img._pairAvg * targetH * wf) / (img._srcW || 1) * sgn : sc * sgn * wf, (targetH + overshoot) / (img._srcH || 1));
    }
  }
}

// Шарнир кости ноги = верхний сустав НАРИСОВАННОГО арта (а не центр кадра).
// Считаем центр масс верхней полосы PNG по альфа-каналу: это и есть точка,
// которой кость крепится к родителю. Без этого арт, нарисованный наискось,
// создаёт щели/ступеньки на колене между бедром и икрой.
// параметр oy — верхний ряд СРЕЗА текстуры (для бедра — 0, для икры — линия
// колена): полоса считается в локальных координатах среза.
function bonePivot(player, texKey, w, h, kind, oy = 0) {
  const def = kind === 'foot' ? { px: 0.5, py: 0.25 } : { px: 0.5, py: 0 };
  // GEO: кости — прямоугольники, шарнир геометрический, canvas не читаем.
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return { ...def };
  try {
    const src = player.scene.textures.get(texKey).getSourceImage();
    const ctx = src && src.getContext ? src.getContext('2d') : null;
    if (!ctx || !w || !h) return def;
    const H = src.height || 0;
    const start = Math.max(0, Math.round(oy));
    const rows = Math.min(h, Math.max(0, H - start));
    if (!rows) return def;
    const data = ctx.getImageData(0, start, w, rows).data;
    const band = Math.max(1, Math.round(h * 0.06));
    let sum = 0;
    let n = 0;
    let firstY = -1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] >= 12) {
          if (firstY < 0) firstY = y;
          if (y < band) {
            sum += x;
            n++;
          }
        }
      }
    }
    if (firstY < 0) return def;
    const px = n ? Phaser.Math.Clamp(sum / n / w, 0.05, 0.95) : def.px;
    return { px, py: Phaser.Math.Clamp(firstY / h, 0, 0.4) };
  } catch (e) {
    return def;
  }
}

// Центр НИЖНЕЙ полосы альфы арта (щиколотка/низ икры) минус пивот кости — авто-поправка
// ботинка: ботинок пиннится в геометрическую цель стопы IK (fx, fy), но визуальная
// щиколотка арта икры обычно НЕ совпадает с геометрическим кончиком кости (арт
// нарисован наискось / смещён в кадре). Из-за этого одна и та же ботинка-текстура
// на левой и правой ноге (арты разной ширины, напр. 56 и 104px) сидит «впереди»
// или «позади» ноги. Считаем центр нижних ~10% строк и возвращаем его сдвиг
// относительно шарнира кости (доля ширины текстуры, от -0.35 до +0.35).
// startY — верхний ряд СРЕЗА текстуры (для икры из цельной ноги — линия колена).
export function ankleOff(player, texKey, w, h, startY = 0, pivotX = 0.5) {
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) return 0;
  try {
    const src = player.scene.textures.get(texKey).getSourceImage();
    const ctx = src && src.getContext ? src.getContext('2d') : null;
    if (!ctx || !w || !h) return 0;
    const H = src.height || 0;
    const start = Math.max(0, Math.round(startY));
    const rows = Math.min(h, Math.max(0, H - start));
    if (!rows) return 0;
    const data = ctx.getImageData(0, start, w, rows).data;
    const band = Math.max(1, Math.round(h * 0.1));
    let sum = 0;
    let n = 0;
    for (let y = Math.max(0, rows - band); y < rows; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] >= 12) {
          sum += x;
          n++;
        }
      }
    }
    if (!n) return 0;
    return Phaser.Math.Clamp(sum / n / w - (pivotX ?? 0.5), -0.35, 0.35);
  } catch (e) {
    return 0;
  }
}

// Запомнить на кости икры сдвиг низа арта от её шарнира (в долях ширины текстуры):
// poseFoot вычтет этот сдвиг, чтобы ботинок стоял ровно ПОД визуальной щиколоткой.
export function ankleAlign(player, boneKey) {
  const img = player[boneKey];
  if (!img || img._boneRect || img._ankleOff !== undefined) return;
  // у СРЕЗА цельной ноги (LEG_BOT) кадр текстуры начинается с линии колена
  const oy = (img.frame && img.frame.cutY) || 0;
  const key = img.texture ? img.texture.key : '';
  if (!key) return;
  img._ankleOff = ankleOff(player, key, img._srcW || 1, img._srcH || 1, oy, img._bonePx ?? 0.5);
}

// 2-сегментная IK ноги: таз в (0,0), цель стопы (fx,fy) — в локальных координатах
// контейнера ног. tip кости = (sin a, cos a) * длина (a от вертикали вниз).
// Колено гнём ВСТОРОНУ ВЗГЛЯДА (legSgn): знак alpha повторяет сторону, иначе при
// ходьбе влево нога «выгибалась в другую сторону» (колено на шаг от стопы) —
// симметрия зеркального шага требовала sign(alpha) = legSgn.
// addBend — доп. сгиб колена (рад), оставляет стопу на месте.
export function legIK(player, fx, fy, tl, sl, addBend = 0, legSgn = 1) {
  const Lmin = Math.abs(tl - sl) + 0.001;
  const Lmax = tl + sl - 0.001;
  const d = Phaser.Math.Clamp(Math.hypot(fx, fy), Lmin, Lmax);
  const base = Math.atan2(fx, fy);
  const cosA = Phaser.Math.Clamp((tl * tl + d * d - sl * sl) / (2 * tl * d), -1, 1);
  // alphaMag — всегда >=0; legSgn определяет СТОРОНУ сгиба (колено «вперёд» по взгляду).
  const alphaMag = Math.acos(cosA) + Math.max(0, addBend);
  const tAng = base + alphaMag * legSgn;
  const kx = Math.sin(tAng) * tl;
  const ky = Math.cos(tAng) * tl;
  const sAng = Math.atan2(fx - kx, fy - ky);
  return { tAng, sAng, kx, ky };
}

export function rebuildLegsAnim(player) {
  // скелетные ноги не используют анимации кадров — метод-заглушка
}

// Руки — скелет из двух сегментов: плечо (верх среза цельной PNG руки) +
// предплечье с кистью (низ среза), сгиб в локте. Каждая цельная PNG руки
// (chr_arm_fore_l/r: плечо+предплечье+перчатка) режется вертикальной линией
// локтя (elbowL/elbowR) на ARM_TOP (плечо) и ARM_BOT (предплечье+перчатка) —
// так же, как ноги режутся в колене. Нет своей PNG — прежний фолбэк.
// Руки — скелет из ДВУХ рук (каждая: плечо + предплечье + кисть), обе держат
// оружие: задняя рука — у рукоятки, передняя — на цевье. Текстуры зафиксированы
// за своей рукой (никакого зеркала одной руки): правая пара chr_arm_fore_r/
// chr_hand_r — задняя, левая chr_arm_fore_l/chr_hand_l — передняя. Обе руки
// всегда на оружии, поэтому у нас всегда «двуручный» хват.
