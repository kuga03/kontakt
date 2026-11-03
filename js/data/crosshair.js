import { gameState, saveGameState } from './gameState.js?v=175';

// Прицел: цвет/фигура/размер/толщина/точка/динамика.
// Дефолт = старый вид (кольцо + лапки + точка, pale green).
// Рисовальщик один на игру и предпросмотр в настройках.
export const CROSS_COLORS = [
  { id: '#ccffcc', label: 'зелёный' },
  { id: '#ffe27a', label: 'жёлтый' },
  { id: '#ff6666', label: 'красный' },
  { id: '#7dd8ff', label: 'голубой' },
  { id: '#ffffff', label: 'белый' },
  { id: '#ff7df2', label: 'розовый' }
];

export const CROSS_SHAPES = [
  { id: 'circle', label: 'круг' },
  { id: 'square', label: 'квадрат' },
  { id: 'triangle', label: 'треугольник' },
  { id: 'none', label: 'ничего' }
];

const CROSS_SIZES = [5, 6, 8, 10, 12, 14, 16];
const CROSS_THICKS = [1, 1.5, 2, 2.5, 3, 4];
// Лапки: длина 4 штук вокруг фигуры, 0 = без лапок.
const CROSS_ARMS = [0, 4, 6, 8, 10, 12, 14];
// Точка: радиус, 0 = выкл.
const CROSS_DOTS = [0, 1, 1.5, 2, 2.5, 3, 4];

export function crossDefaults() {
  return { color: '#ccffcc', shape: 'circle', size: 8, thick: 2.5, arms: 8, dot: 2, dynamic: true };
}

export function getCrosshair() {
  try {
    const c = (gameState && gameState.crosshair) || {};
    const color = CROSS_COLORS.some(o => o.id === c.color) ? c.color : '#ccffcc';
    const shape = CROSS_SHAPES.some(o => o.id === c.shape) ? c.shape : 'circle';
    const size = CROSS_SIZES.includes(c.size) ? c.size : 8;
    const thick = CROSS_THICKS.includes(c.thick) ? c.thick : 2.5;
    const arms = CROSS_ARMS.includes(c.arms) ? c.arms : 8;
    // Миграция со старой схемы (dot: true/false).
    let dot = c.dot;
    if (dot === true) dot = 2;
    else if (dot === false) dot = 0;
    if (!CROSS_DOTS.includes(dot)) dot = 2;
    return {
      color, shape, size, thick, arms, dot,
      dynamic: c.dynamic !== false
    };
  } catch (e) {
    return crossDefaults();
  }
}

export function setCrosshair(patch) {
  try {
    gameState.crosshair = Object.assign({}, getCrosshair(), patch || {});
    saveGameState();
  } catch (e) {}
}

function crossCycle(list, cur, key) {
  const i = list.findIndex(o => (o.id !== undefined ? o.id : o) === cur[key]);
  const next = list[(i + 1) % list.length];
  return next.id !== undefined ? next.id : next;
}

export function nextCrossColor() {
  const c = getCrosshair();
  setCrosshair({ color: crossCycle(CROSS_COLORS, c, 'color') });
}

export function nextCrossShape() {
  const c = getCrosshair();
  setCrosshair({ shape: crossCycle(CROSS_SHAPES, c, 'shape') });
}

export function nextCrossSize() {
  const c = getCrosshair();
  setCrosshair({ size: crossCycle(CROSS_SIZES, c, 'size') });
}

export function nextCrossThick() {
  const c = getCrosshair();
  setCrosshair({ thick: crossCycle(CROSS_THICKS, c, 'thick') });
}

export function nextCrossArms() {
  const c = getCrosshair();
  setCrosshair({ arms: crossCycle(CROSS_ARMS, c, 'arms') });
}

export function nextCrossDot() {
  const c = getCrosshair();
  setCrosshair({ dot: crossCycle(CROSS_DOTS, c, 'dot') });
}

export function crossDotLabel(v) {
  return v > 0 ? String(v) : 'выкл';
}

export function crossArmsLabel(v) {
  return v > 0 ? String(v) : 'ничего';
}

export function crossLabel(id, list) {
  const o = (list || []).find(x => x.id === id);
  return o ? o.label : String(id);
}

// Фигура прицела в точке (0,0) graphics: контур + 4 лапки + точка.
// r — текущий радиус (в бою едет от разброса, в предпросмотре = размер).
export function drawCrosshairFigure(g, cfg, r) {
  try {
    const c = cfg && cfg.color ? cfg : getCrosshair();
    const col = parseInt(String(c.color).replace('#', ''), 16) || 0xccffcc;
    const thick = c.thick;
    const armLen = CROSS_ARMS.includes(c.arms) ? c.arms : 8;
    if (c.shape === 'square') {
      g.lineStyle(thick * 0.56, col, 0.55);
      g.strokeRect(-r, -r, r * 2, r * 2);
    } else if (c.shape === 'triangle') {
      g.lineStyle(thick * 0.56, col, 0.55);
      g.beginPath();
      g.moveTo(0, -r - 2);
      g.lineTo(r + 2, r * 0.75);
      g.lineTo(-r - 2, r * 0.75);
      g.closePath();
      g.strokePath();
    } else if (c.shape === 'circle') {
      g.lineStyle(thick * 0.56, col, 0.55);
      g.strokeCircle(0, 0, r);
    }
    // 'none' — без контура, только лапки и точка.
    // Лапки 0 — без лапок.
    g.lineStyle(thick, col, 0.95);
    if (armLen > 0) {
      g.beginPath();
      g.moveTo(0, r); g.lineTo(0, r + armLen);
      g.moveTo(0, -r); g.lineTo(0, -(r + armLen));
      g.moveTo(r, 0); g.lineTo(r + armLen, 0);
      g.moveTo(-r, 0); g.lineTo(-(r + armLen), 0);
      g.strokePath();
    }
    if (c.dot > 0) {
      g.fillStyle(col, 0.95);
      g.fillCircle(0, 0, c.dot);
    }
  } catch (e) {}
}
