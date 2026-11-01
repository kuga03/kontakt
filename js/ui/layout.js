// layout.js — ширина экрана.
// На ПК/iOS строго 1280x720 (как всегда). На Андроиде — адаптивная ширина
// W = 720*aspect (широкий мир), а весь интерфейс 1280-пространства центрируется
// сдвигом OX = (W-1280)/2 через UX(). FIT вписывает канвас в экран.

const BASE_W = 1280;
export const BASE_H = 720;
export const BASE_CX = 640;

// Текущая логическая ширина игры (в FIT+setGameSize всегда актуальна).
export function gameW(scene) {
  try {
    const w = scene && scene.scale && scene.scale.width;
    if (Number.isFinite(w) && w > 0) return w;
  } catch (e) {}
  return BASE_W;
}

// Центр экрана (замена хардкода 640 для UI).
export function CX(scene) { return gameW(scene) / 2; }

// Сдвиг 1280-блока для центрирования (0 на ПК/iOS и на 16:9).
export function OX(scene) { return (gameW(scene) - BASE_W) / 2; }

// X внутри 1280-блока → экранный X (центрирование блока на широком Андроиде).
// На ПК/iOS OX=0, поэтому UX(x) === x — координаты не меняются.
export function UX(scene, x) { return x + OX(scene); }

// Андроид — единственная платформа с адаптивной шириной и центрированием блока.
function isAndroid() {
  try {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    return /Android/i.test(ua);
  } catch (e) {}
  return false;
}

// Стартовая ширина под текущий экран (вызывается до создания Phaser.Game).
// Андроид — адаптивная ширина (широкий мир + центрирование UI через OX).
// ПК/iOS — строго 1280, как было.
export function bootW() {
  if (!isAndroid()) return BASE_W;
  try {
    const w = (typeof window !== 'undefined' && window.innerWidth) || BASE_W;
    const h = (typeof window !== 'undefined' && window.innerHeight) || BASE_H;
    if (w > 0 && h > 0) return Math.max(960, Math.round(BASE_H * w / h));
  } catch (e) {}
  return BASE_W;
}
