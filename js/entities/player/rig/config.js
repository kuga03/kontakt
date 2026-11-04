

import { RIG_DEFAULTS } from '../../../data/rigConfig.js';
export const GEO_HUMAN = true;

// Уборы пекутся СТРОГО один раз за запуск игры: повторное пересоздание
// убивает текстуры уже построенных персонажей (лобби строит 4 превью
// подряд) и роняет рендер внутри движка с masked-ошибкой.
export let GEO_GEAR_BAKED = false;

export const elbowCache = new Map();
export const jointsCache = new Map();

export function detectArt(player) {
  // GEO: настоящих PNG-частей тела нет — всё рисуется фигурами.
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
    return {
      torso: false,
      head: false,
      cap: false,
      legsRun: false,
      legsWalk: false,
      shoes: false,
      arms: false
    };
  }
  const RT = window.__realTextures;
  const has = k => Boolean(RT && RT.has(k));
  return {
    torso: has('chr_torso'),
    head: has('chr_head'),
    cap: has('chr_cap'),
    legsRun: has('chr_legs_run') || has('chr_legs_walk'),
    legsWalk: has('chr_legs_walk'),
    shoes: has('chr_shoes'),
    arms: has('chr_arms')
  };
}

// Геометрические текстуры тела (рисуются кодом один раз):
// __geo_torso — белый эллипс-футболка с поясом (красится тинтом тела),
// __geo_cap — кепка с козырьком. Глаза/кисти/обувь — примитивы и цвета.
export function cropInfo(player, key) {
  return (window.__chrCrops && window.__chrCrops[key]) || null;
}

// Кэш разобранных конфигов рига (k631): partCfg зовут ~24 раза на бойца
// за кадр, и каждый вызов собирал новый объект на ~50 полей — это десятки
// тысяч аллокаций в секунду при 16 бойцах (GC + время). Конфиг бойца
// создаётся один раз (getRigConfig отдаёт свежий клон), поэтому кэш живёт
// вместе с бойцом. previewScale меняет _previewK — это и есть сброс кэша.
const _cfgCache = new WeakMap();

export function partCfg(player, name) {
  const pk = player._previewK || 1;
  let entry = _cfgCache.get(player);
  if (!entry || entry.pk !== pk) {
    entry = { pk, map: new Map() };
    _cfgCache.set(player, entry);
  }
  const cached = entry.map.get(name);
  if (cached) return cached;
  const c = (player._rcfg && player._rcfg[name]) || {};
  const d = RIG_DEFAULTS[name] || {};
  const out = {
    s: c.s ?? d.s ?? null,
    ox: c.ox ?? d.ox ?? 0,
    oy: c.oy ?? d.oy ?? 0,
    mx: c.mx ?? d.mx ?? c.ox ?? d.ox ?? 0,
    my: c.my ?? d.my ?? c.oy ?? d.oy ?? 0,
    rotF: c.rotF ?? d.rotF ?? 1,
    px: c.px ?? d.px ?? 0.5,
    py: c.py ?? d.py ?? 0.5,
    paX: c.paX ?? d.paX ?? 0.5,
    paY: c.paY ?? d.paY ?? 1,
    dist: c.dist ?? d.dist ?? 0,
    baked: c.baked ?? d.baked ?? false,
    lx: c.lx ?? d.lx ?? 0,
    ly: c.ly ?? d.ly ?? 0,
    rx: c.rx ?? d.rx ?? 0,
    ry: c.ry ?? d.ry ?? 0,
    lPx: c.lPx ?? d.lPx ?? 0.38,
    lPy: c.lPy ?? d.lPy ?? 0.2,
    rPx: c.rPx ?? d.rPx ?? 0.38,
    rPy: c.rPy ?? d.rPy ?? 0.2,
    fps: c.fps ?? d.fps ?? 14,
    bobFreq: c.bobFreq ?? d.bobFreq ?? 1,
    bobX: c.bobX ?? d.bobX ?? 2,
    bobY: c.bobY ?? d.bobY ?? 4,
    skeleton: c.skeleton ?? d.skeleton ?? true,
    run: c.run ?? d.run ?? true,
    thigh: c.thigh ?? d.thigh ?? 13,
    shin: c.shin ?? d.shin ?? 13,
    upper: c.upper ?? d.upper ?? 16,
    fore: c.fore ?? d.fore ?? 12,
    swing: c.swing ?? d.swing ?? 0.28,
    knee: c.knee ?? d.knee ?? 0.15,
    lift: c.lift ?? d.lift ?? 0.4,
    hip: c.hip ?? d.hip ?? 0.5,
    _animModes: c._animModes || null,
    thighW: c.thighW ?? d.thighW ?? 1,
    shinW: c.shinW ?? d.shinW ?? 0.65,
    footW: c.footW ?? d.footW ?? 1,
    thighPx: c.thighPx ?? d.thighPx ?? null,
    thighPy: c.thighPy ?? d.thighPy ?? null,
    shinPx: c.shinPx ?? d.shinPx ?? null,
    shinPy: c.shinPy ?? d.shinPy ?? null,
    thighBot: c.thighBot ?? d.thighBot ?? null,
    shinBot: c.shinBot ?? d.shinBot ?? null,
    // режим «одна PNG на ногу»: срез колена и способ натяжки
    legSet: c.legSet ?? d.legSet ?? 'auto',
    kneeL: c.kneeL ?? d.kneeL ?? 0.5,
    kneeR: c.kneeR ?? d.kneeR ?? 0.5,
    hipLx: c.hipLx ?? d.hipLx ?? 0,
    hipLy: c.hipLy ?? d.hipLy ?? 0,
    hipRx: c.hipRx ?? d.hipRx ?? 0,
    hipRy: c.hipRy ?? d.hipRy ?? 0,
    upW: c.upW ?? d.upW ?? 0.28,
    foreW: c.foreW ?? d.foreW ?? 0.22,
    // Сгиб локтей раздельно: задняя (рукоятка) и передняя (цевьё).
    // Старый общий elbowBend подхватывается обеими (миграция на лету).
    elbowBendRear: c.elbowBendRear ?? c.elbowBend ?? 0,
    elbowBendFront: c.elbowBendFront ?? c.elbowBend ?? 0,
    elbowL: c.elbowL ?? d.elbowL ?? 0.36,
    elbowR: c.elbowR ?? d.elbowR ?? 0.36,
    framesX: c.framesX ?? d.framesX ?? {}
  };
  entry.map.set(name, out);
  return out;
}

export function artTex(player, key) {
  return cropInfo(player, key) ? key + '_crop' : key;
}

export function renderDims(player, key, cfgName) {
  const s = artScale(player, key, cfgName);
  const c = cropInfo(player, key);
  const w = c ? c.w : player._srcW(key);
  const h = c ? c.h : player._srcH(key);
  if (!s || !h) return { w: 0, h: 0 };
  return { w: s * w, h: s * h };
}

export function artScale(player, key, cfgName) {
  const target = partCfg(player, cfgName || key.replace('chr_','')).s || 0;
  if (!target) return null;
  let h = 0;
  const c = cropInfo(player, key);
  if (c && c.h) h = c.h;
  else h = player._srcH(key);
  return h > 0 ? target / h : null;
}

export function targetH(player, cfgName) {
  return (partCfg(player, cfgName).s) || 0;
}

export function cropH(player, key) {
  const c = cropInfo(player, key);
  if (c && c.h) return c.h;
  return player._srcH(key);
}

export function cropW(player, key) {
  const c = cropInfo(player, key);
  if (c && c.w) return c.w;
  return player._srcW(key);
}

export function setGearBaked(v) { GEO_GEAR_BAKED = v; }
