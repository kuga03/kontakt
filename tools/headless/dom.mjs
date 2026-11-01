// dom.mjs — поднимает браузерное окружение в Node: jsdom + глобалы +
// заглушка canvas-2d + seeded RNG (детерминизм обучения).
import { JSDOM } from 'jsdom';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stub2d() {
  const noop = () => {};
  return {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)',
    measureText: (t) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, rect: noop,
    ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    setTransform: noop, transform: noop, resetTransform: noop, drawImage: noop, putImageData: noop, clip: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
  };
}

// setupClock — детерминированные часы. Игровой код местами использует
// Date.now() (Weapon._reloadEndsAt, Pickup._wantAt и т.п.), а симуляция идёт
// на фиксированном времени. Подменяем Date.now симуляционным временем.
export function setupClock() {
  const state = { now: 0 };
  Date.now = () => state.now;
  return state;
}

export function setupDom(seed = 1337) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost/',
  });
  const { window } = dom;
  globalThis.self = window;
  for (const k of Object.getOwnPropertyNames(window)) {
    if (k in globalThis) continue;
    try { globalThis[k] = window[k]; } catch (e) { /* пропускаем геттеры, которые кидают */ }
  }
  if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  try { if (!globalThis.OffscreenCanvas) globalThis.OffscreenCanvas = class {}; } catch (e) {}

  try {
    window.HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === '2d') { const c = stub2d(); c.canvas = this; return c; }
      return null;
    };
  } catch (e) {}

  // Детерминизм: seeded RNG вместо Math.random (используется и игрой,
  // и Phaser.Math.Between). Сохраняем оригинал для нужд харнесса.
  globalThis.__origRandom = Math.random;
  const rng = mulberry32(seed);
  Math.random = rng;

  return { dom, window, rng };
}
