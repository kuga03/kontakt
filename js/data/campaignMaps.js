// js/data/campaignMaps.js
// Генератор карт кампании.
//   • боевые миссии (TDM/FFA/CTF/BOMB/KOTH) — по эталону «Форты» через
//     genFlankArena: низ/мост/плато, ступени 730→620→520→470, автолейны;
//   • учебка (mode CAMPAIGN) — простой шаблон: новичку не нужны форты.
// Инварианты старого шаблона (гарантирует sanitize):
//   - геометрия не лезет в зоны спавнов/флагов/баз;
//   - низкие объекты (у земли) держатся от краёв дальше, чем зоны спавнов;
//   - укрытие ВСЕГДА стоит на опоре (низ ящика = верх опоры);
//   - флаги стоят на земле (низ древка = верх земли);
//   - спавны висят в чистом небе над землёй.
import { genFlankArena } from './flankGen.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const GT = 850;
const EDGE = 300;
const LOW_EDGE = 700;
const LOW_Y = 700;
const FLAG_Y = GT - 38;
const SPAWN_Y = GT - 60;

function onSurface(top, h) { return top - h / 2; }

const THEME_TEX = {
  ulica: 'gr_scorch', krisha: 'gr_beton', zavod: 'gr_beton',
  pustinya: 'gr_sand', pustoch: 'gr_grass', pechera: 'gr_stones',
  peshera: 'gr_stones', wasteland: 'gr_scorch'
};

function addSpawnsAndFlags(objs, W, mode) {
  objs.push({ type: 'spawn', spawnType: 'player', x: 400, y: SPAWN_Y, w: 26, h: 26 });
  const nE = mode === 'FFA' ? 5 : 4;
  for (let i = 0; i < nE; i++)
    objs.push({ type: 'spawn', spawnType: 'enemy', x: W - 400 - i * 80, y: SPAWN_Y, w: 26, h: 26 });
  if (mode !== 'FFA' && mode !== 'CAMPAIGN') {
    objs.push({ type: 'spawn', spawnType: 'team', x: 480, y: SPAWN_Y, w: 26, h: 26 });
    objs.push({ type: 'spawn', spawnType: 'team', x: 560, y: SPAWN_Y, w: 26, h: 26 });
    objs.push({ type: 'spawn', spawnType: 'team', x: 640, y: SPAWN_Y, w: 26, h: 26 });
  }
  if (mode === 'CTF') {
    objs.push({ type: 'spawn', spawnType: 'flagBlue', x: 170, y: FLAG_Y, w: 26, h: 26 });
    objs.push({ type: 'spawn', spawnType: 'flagRed', x: W - 170, y: FLAG_Y, w: 26, h: 26 });
  }
}

// 0: Классика — симметричные башни по флангам, верхний мост.

// 1: Долина — чаша: высокие края, провал в центре.
function t1(rng, W) {
  const o = [];
  o.push({ type: 'platform', x: Math.round(W * 0.18), y: 470, w: 420, h: 16 });
  o.push({ type: 'platform', x: Math.round(W * 0.22), y: 590, w: 320, h: 16 });
  o.push({ type: 'platform', x: Math.round(W * 0.26), y: 710, w: 360, h: 16 });
  o.push({ type: 'platform', x: Math.round(W * 0.82), y: 470, w: 420, h: 16 });
  o.push({ type: 'platform', x: Math.round(W * 0.78), y: 590, w: 320, h: 16 });
  o.push({ type: 'platform', x: Math.round(W * 0.74), y: 710, w: 360, h: 16 });
  o.push({ type: 'platform', x: W / 2, y: 800, w: 620, h: 16 });
  o.push({ type: 'platform', x: W / 2, y: 690, w: Math.min(1500, W - 560), h: 16 });
  o.push({ type: 'platform', x: W / 2, y: 540, w: 420, h: 16 });
  o.push({ type: 'platform', x: Math.round(W * 0.36), y: 640, w: 180, h: 14 });
  o.push({ type: 'platform', x: Math.round(W * 0.64), y: 640, w: 180, h: 14 });
  o.push({ type: 'cover', x: Math.round(W * 0.2), y: 820, w: 100, h: 60 });
  o.push({ type: 'cover', x: Math.round(W * 0.8), y: 820, w: 100, h: 60 });
  o.push({ type: 'cover', x: W / 2, y: onSurface(792, 60), w: 120, h: 60 });
  o.push({ type: 'cover', x: Math.round(W * 0.22), y: onSurface(582, 60), w: 80, h: 60 });
  o.push({ type: 'cover', x: Math.round(W * 0.78), y: onSurface(582, 60), w: 80, h: 60 });
  return o;
}

// 2: Холм — ступенчатая пирамида в центре, базы по краям.

// 3: Лестница — ступени через всю карту слева направо.

// 4: Террасы — широкие уровни-плато по обе стороны.

// 5: Открытое поле — редкие островки и много укрытий на земле.

// 6: Город — ярусы платформ + здания.

// 7: Каньон — вертикальные стены и узкие уступы.

function sanitize(objs, W, mode) {
  const ground = [];
  const spawns = [];
  const geo = [];
  for (const o of objs) {
    if (o.type === 'ground') {
      o.x = W / 2; o.y = GT + 25; o.w = W; o.h = 50;
      ground.push(o);
    } else if (o.type === 'spawn') {
      spawns.push(o);
    } else {
      geo.push(o);
    }
  }
  // 1) Рабочая зона по X: у земли шире отступ, чем наверху.
  for (const o of geo) {
    if (typeof o.w !== 'number' || typeof o.h !== 'number') continue;
    const low = (o.y + o.h / 2) > LOW_Y;
    const margin = low ? LOW_EDGE : EDGE;
    o.w = Math.min(o.w, Math.max(80, W - 2 * margin));
    o.x = clamp(o.x, margin + o.w / 2, W - margin - o.w / 2);
  }
  // 2) Зоны, где ничего не должно стоять.
  const boxes = [];
  const addBox = (x, top, bottom, half) => boxes.push({ x, top, bottom, half });
  for (const s of spawns) {
    if (s.spawnType === 'flagBlue' || s.spawnType === 'flagRed')
      addBox(s.x, s.y - 42, s.y + 42, 26);
    else
      addBox(s.x, s.y - 62, s.y + 32, 37);
  }
  if (mode === 'BOMB') {
    addBox(220, GT - 115, GT + 5, 110);
    addBox(W - 220, GT - 115, GT + 5, 110);
  }
  if (mode === 'KOTH') {
    addBox(Math.round(W * 0.25), GT - 75, GT + 5, 46);
    addBox(Math.round(W * 0.75), GT - 75, GT + 5, 46);
  }
  const hits = (o, b) => {
    const l = o.x - o.w / 2, r = o.x + o.w / 2;
    const t = o.y - o.h / 2, bo = o.y + o.h / 2;
    return r > b.x - b.half && l < b.x + b.half && bo > b.top && t < b.bottom;
  };
  // ВАЖНО: проверяем отступы между платформами (включая ящики).
  // Минимальный зазор: 35 px по X и 90 px по Y — иначе платформы слипаются.
  const spacingConflict = (a, aCrate, b, bCrate) => {
    const aTop = a.y - a.h / 2;
    const aBottom = a.y + a.h / 2;
    const bTop = b.y - b.h / 2;
    const bBottom = b.y + b.h / 2;
    const aTopEff = aCrate ? (aTop - 90) : aTop;
    const bTopEff = bCrate ? (bTop - 90) : bTop;
    const aH = aBottom - aTopEff;
    const bH = bBottom - bTopEff;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const hGap = dx - (a.w + b.w) / 2;
    const vGap = dy - (aH + bH) / 2;
    return hGap < 35 && vGap < 90;
  };
  const _solidsRaw = geo.filter(o => o.type !== 'cover').filter(o => !boxes.some(b => hits(o, b)));
  // spacing filter (base): убираем платформы, которые стоят слишком близко.
  const _groundBox = { type: 'ground', x: W / 2, y: GT + 25, w: W, h: 50, _hasCrate: false };
  const _spacingNodes = [_groundBox];
  let solids = [];
  for (const o of _solidsRaw) {
    if (o.type !== 'platform') { solids.push(o); continue; }
    let _conflict = false;
    for (const k of _spacingNodes) {
      if (k.type === 'platform' || k.type === 'ground') {
        if (spacingConflict(o, false, k, !!k._hasCrate)) { _conflict = true; break; }
      }
    }
    if (_conflict) continue;
    o._hasCrate = false;
    _spacingNodes.push(o);
    solids.push(o);
  }
  // 3) Достижимость: недостижимые платформы не оставляем висеть декором.
  const nodes = solids.filter(o => o.type === 'platform' || o.type === 'building').map(o => ({
    ref: o, top: o.y - o.h / 2, l: o.x - o.w / 2, r: o.x + o.w / 2
  }));
  const reach = nodes.map(n => GT - n.top <= 175 && n.top - GT <= 60);
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (let i = 0; i < nodes.length; i++) {
      if (reach[i]) continue;
      for (let j = 0; j < nodes.length; j++) {
        if (!reach[j]) continue;
        const A = nodes[j], B = nodes[i];
        if (Math.max(0, Math.max(B.l - A.r, A.l - B.r)) > 170) continue;
        if (B.top - A.top >= -175) { reach[i] = true; changed = true; break; }
      }
    }
    if (!changed) break;
  }
  const dropped = new Set();
  nodes.forEach((n, i) => { if (!reach[i] && n.ref.type === 'platform') dropped.add(n.ref); });
  solids = solids.filter(o => !dropped.has(o));
  // 4) Укрытия на опоры (нижние первыми — стопки).
  const supports = [{ top: GT, l: 0, r: W }];
  for (const o of solids) {
    if (o.type === 'platform' || o.type === 'building' || o.type === 'wall')
      supports.push({ top: o.y - o.h / 2, l: o.x - o.w / 2, r: o.x + o.w / 2 });
  }
  const covers = geo.filter(o => o.type === 'cover')
    .sort((a, b) => (b.y + b.h / 2) - (a.y + a.h / 2));
  const placed = [];
  for (const c of covers) {
    let best = null, bestD = 1e9;
    const l = c.x - c.w / 2, r = c.x + c.w / 2;
    for (const s of supports) {
      const ov = Math.min(r, s.r) - Math.max(l, s.l);
      if (ov < Math.min(c.w * 0.5, 60)) continue;
      const d = Math.abs(s.top - (c.y + c.h / 2));
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best || bestD > 220) continue;
    c.y = onSurface(best.top, c.h);
    placed.push(c);
    supports.push({ top: c.y - c.h / 2, l, r });
  }
  const crates = placed.filter(o => !boxes.some(b => hits(o, b)));
  // mark platforms that actually have a crate on them
  const _solidsBefore = solids.slice();
  for (const p of solids) {
    if (p.type !== 'platform') continue;
    p._hasCrate = crates.some(c => {
      const crateBottom = c.y + c.h / 2;
      const pTop = p.y - p.h / 2;
      return Math.abs(crateBottom - pTop) <= 4 &&
        (c.x + c.w / 2 > p.x - p.w / 2) && (c.x - c.w / 2 < p.x + p.w / 2);
    });
  }
  // ground — базовая платформа для проверки зазоров.
  const _groundHasCrate = false;
  const _groundBox2 = { type: 'ground', x: W / 2, y: GT + 25, w: W, h: 50, _hasCrate: _groundHasCrate };
  // second spacing filter with crate-adjusted heights
  const _removedPlatforms = new Set();
  const _spacingNodes2 = [_groundBox2];
  const _finalSolids = [];
  for (const o of solids) {
    if (o.type !== 'platform') { _finalSolids.push(o); continue; }
    let _conflict = false;
    for (const k of _spacingNodes2) {
      if (k.type === 'platform' || k.type === 'ground') {
        if (spacingConflict(o, !!o._hasCrate, k, !!k._hasCrate)) { _conflict = true; break; }
      }
    }
    if (_conflict) { _removedPlatforms.add(o); continue; }
    _spacingNodes2.push(o);
    _finalSolids.push(o);
  }
  solids = _finalSolids;
  // remove crates sitting on removed platforms
  const _finalCrates = crates.filter(c => {
    const crateBottom = c.y + c.h / 2;
    const support = _solidsBefore.find(p => p.type === 'platform' &&
      Math.abs((p.y - p.h / 2) - crateBottom) <= 4 &&
      (c.x + c.w / 2 > p.x - p.w / 2) && (c.x - c.w / 2 < p.x + p.w / 2));
    if (support && _removedPlatforms.has(support)) return false;
    return true;
  });
  const out = [...ground, ...spawns, ...solids, ..._finalCrates];
  for (const o of out) {
    if (o.type !== 'spawn') continue;
    if (o.spawnType === 'flagBlue' || o.spawnType === 'flagRed') o.y = FLAG_Y;
    else if (o.spawnType === 'player' || o.spawnType === 'team' || o.spawnType === 'enemy') o.y = SPAWN_Y;
  }
  return out;
}

// Боевые карты кампании — по эталону «Форты» (maps/ctf.json):
// три независимых фланга (низ/мост/плато), ступени 730→620→520→470,
// зазоры ≤140 и подъём ≤120 (бюджеты genFlankArena), укрытия на опорах.
// Отличие от эталона: ширина/пропорции/джиттер от seed, тема уровня,
// спавны 4+4, флаги на земле и 7 подборов — не копия карты 3800×900.
const FORTS_MODES = new Set(['TDM', 'FFA', 'CTF', 'BOMB', 'KOTH']);

// Ящики на опорах: висячий ящик опускаем на верх ближайшей опоры под ним,
// ящик, заходящий за край опоры, сдвигаем внутрь. Стоящие ящики не трогаем.
function settleCrates(geo) {
  const sup = geo.filter(o => o.type === 'platform' || o.type === 'ground');
  const topOf = p => p.y - p.h / 2;
  for (const c of geo.filter(o => o.type === 'cover')) {
    const cw = c.w || 0, ch = c.h || 0;
    const onX = p => c.x + cw / 2 > p.x - p.w / 2 + 1 && c.x - cw / 2 < p.x + p.w / 2 - 1;
    const bottom = c.y + ch / 2;
    if (!sup.some(p => onX(p) && Math.abs(topOf(p) - bottom) <= 4)) {
      const below = sup.filter(p => onX(p) && topOf(p) >= bottom - 4).map(topOf);
      if (!below.length) continue;
      c.y = Math.min(...below) - ch / 2;
    }
    const base = sup.find(p => onX(p) && Math.abs(topOf(p) - (c.y + ch / 2)) <= 4);
    if (base) {
      const lo = base.x - base.w / 2 + cw / 2, hi = base.x + base.w / 2 - cw / 2;
      c.x = Math.min(hi, Math.max(lo, c.x));
    }
  }
}

function genFortsCampaignMapData(seed, width, height, mode, theme) {
  // genFlankArena уже проверен валидатором: симметрия, лейны на поверхностях,
  // подъёмы/пролёты в бюджетах, чистые базы. Кампании нужен тот же каркас,
  // но свои спавны/предметы и без лишних точек одиночных карт.
  const g = genFlankArena({
    seed: (seed * 7919 + 42) >>> 0,
    mode, width, height, theme
  });
  const objs = g.objects || [];
  const player = objs.find(o => o.spawnType === 'player') || { type: 'spawn', spawnType: 'player', x: 420, y: 680, w: 26, h: 26 };
  const playerX = Number.isFinite(player.x) ? player.x : 420;
  // 4+4 спавна, зеркально; точку игрока из парной пары убираем, чтобы
  // синий не рожался в спине у союзника.
  const team = mode === 'FFA' ? [] : objs.filter(o => o.spawnType === 'team' && Math.abs(o.x - playerX) > 2).slice(0, 4);
  const enemy = mode === 'FFA' ? [] : objs.filter(o => o.spawnType === 'enemy' && Math.abs(o.x - (width - playerX)) > 2).slice(0, 4);
  const flags = objs.filter(o => o.spawnType === 'flagBlue' || o.spawnType === 'flagRed')
    .map(o => ({ ...o, y: FLAG_Y }));
  const picks = objs.filter(o => ['medkit', 'armor', 'ammo', 'frag', 'smoke'].includes(o.spawnType));
  let geo = objs.filter(o => !o.spawnType);
  // Нижние ящики — только вне пролёта моста. На Фортах пара ящиков стоит
  // ПОД мостом (зазор 84 при теле 92), и низовой маршрут физически
  // непроходим: перепрыгнуть ящик мешает настил. В кампании ставим все
  // четыре у внешних краёв (перепрыгиваются в чистом небе) — низ остаётся
  // третьим честным флангом, а не ловушкой.
  const lowCovers = geo.filter(o => o.type === 'cover' &&
    Math.abs((o.y + (o.h || 0) / 2) - (height - 50)) <= 2).sort((a, b) => a.x - b.x);
  if (lowCovers.length === 4) {
    if (mode === 'KOTH') {
      const ptAx = Math.round(width * 0.25);
      const ptCx = Math.round(width * 0.75);
      // В KOTH укрытия фланкируют точки А и С (отступ 150), чтобы зоны захвата не блокировались ящиками
      const xs = [ptAx - 150, ptAx + 150, ptCx - 150, ptCx + 150];
      lowCovers.forEach((o, i) => { o.x = xs[i]; });
    } else {
      const xs = [740, 860, width - 860, width - 740];
      lowCovers.forEach((o, i) => { o.x = xs[i]; });
    }
  }
  // Разная высота нижних/мостовых ящиков от уровня к уровню (50–70):
  // все они вне настила, прыгаются одиночным; это даёт картам разный
  // силуэт, не трогая ярусы 730/690/620/520/470, к которым привязан ИИ.
  const lowH = 50 + (seed % 3) * 10;
  lowCovers.forEach(o => { o.h = lowH; o.y = (height - 50) - lowH / 2; });
  const bridgeH = 50 + (Math.floor(seed / 3) % 3) * 10;
  geo.filter(o => o.type === 'cover' && Math.abs((o.y + (o.h || 0) / 2) - 690) <= 2)
    .forEach(o => { o.h = bridgeH; o.y = 690 - bridgeH / 2; });

  if (mode === 'KOTH') {
    // Точки А, Б, С в режиме KOTH:
    // Б стоит по центру (width / 2) на мосту/платформе; А и С — на земле (0.25W и 0.75W).
    // Убираем укрытия, накладывающиеся на флаги и зоны захвата.
    const ptAx = Math.round(width * 0.25);
    const ptBx = Math.round(width / 2);
    const ptCx = Math.round(width * 0.75);
    const pts = [
      { x: ptAx, y: height - 50 },
      { x: ptBx, y: 690 },
      { x: ptCx, y: height - 50 }
    ];
    geo = geo.filter(o => {
      if (o.type !== 'cover') return true;
      const hw = (o.w || 60) / 2;
      return !pts.some(p => Math.abs(o.x - p.x) < hw + 50 && Math.abs(o.y - p.y) < 150);
    });
  }

  settleCrates(geo);
  const objects = [...geo, {...player}, ...team.map(o => ({ ...o })), ...enemy.map(o => ({ ...o }))];
  // Флаги — только CTF; в TDM/FFA/BOMB/KOTH их нет (в генераторе они есть
  // всегда — это каркас, а не режимная логика).
  if (mode === 'CTF') objects.push(...flags);
  // 7 подборов — столько же, сколько на картах режимов BOMB/KOTH
  // (2 ammo, 1 medkit, 2 frag, 2 smoke); позиции зеркальные из генератора.
  objects.push(...picks.map(o => ({ ...o })));
  const result = { objects, _lanes: g._lanes };
  if (mode === 'KOTH') {
    result.kothPoints = [
      { x: Math.round(width * 0.25), name: 'А' },
      { x: Math.round(width / 2), name: 'Б' },
      { x: Math.round(width * 0.75), name: 'С' }
    ];
  }
  return result;
}

export function genCampaignMapData(seed, width, height, mode, theme) {
  if (mode !== 'CAMPAIGN' && FORTS_MODES.has(mode)) {
    return genFortsCampaignMapData(seed, width, height, mode, theme);
  }
      const ground = { type: 'ground', x: width / 2, y: GT + 25, w: width, h: 50, texKey: THEME_TEX[theme] || 'gr_scorch' };
  const objs = [ground, ...t1(null, width, height)];
  addSpawnsAndFlags(objs, width, mode);
  const result = { objects: sanitize(objs, width, mode) };
  if (mode === 'KOTH') {
    result.kothPoints = [
      { x: Math.round(width * 0.25), name: 'А' },
      { x: Math.round(width / 2), name: 'Б' },
      { x: Math.round(width * 0.75), name: 'С' }
    ];
  }
  return result;
}
