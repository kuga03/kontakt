'use strict';
const { NET_SOLIDS, netSpawn: netSpawnShared, NET_ARENA } = require('./netArena.cjs');

// Попадание луча в круг (голова): есть ли точка отрезка в радиусе.
function segCircle(x1, y1, x2, y2, cx, cy, r) {
  try {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / len2));
    const px = x1 + dx * t, py = y1 + dy * t;
    return Math.hypot(px - cx, py - cy) <= r;
  } catch (e) { return false; }
}

// Пересекает ли отрезок прямоугольник (slab-метод). Стены для LOS.
function segRect(x1, y1, x2, y2, r) {
  const x0 = r.x - r.w / 2, x1r = r.x + r.w / 2;
  const y0 = r.y - r.h / 2, y1r = r.y + r.h / 2;
  if (x1 > x0 && x1 < x1r && y1 > y0 && y1 < y1r) return true;
  if (x2 > x0 && x2 < x1r && y2 > y0 && y2 < y1r) return true;
  let tmin = 0, tmax = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const axes = [
    [-dx, x1 - x0], [dx, x1r - x1],
    [-dy, y1 - y0], [dy, y1r - y1]
  ];
  for (const [p, q] of axes) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) { if (t > tmax) return false; if (t > tmin) tmin = t; }
      else { if (t < tmin) return false; if (t < tmax) tmax = t; }
    }
  }
  return true;
}

// Видимость отрезка: нет солида между (как hasWallLos strict в одиночке).
// Дальше 1600 — без проверки (там же).
function wallLos(x1, y1, x2, y2) {
  try {
    if (Math.hypot(x2 - x1, y2 - y1) > 1600) return true;
    for (const r of NET_SOLIDS) {
      if (segRect(x1, y1, x2, y2, r)) return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

function netSpawn(team, index) {
  return netSpawnShared(team, index);
}

// Верх опоры под x около hintY (серверное зеркало клиентской физики):
// бот идёт по полу, а не летит по waypoint'ам. Иначе клиент видит его
// под мостом на земле, а сервер — на мосту: захват и стрельба сквозь
// платформу. Ступни = y+28 (серверная модель). Опора — не выше точки.
function supportRest(x, hintY) {
  try {
    let best = null;
    for (const r of NET_SOLIDS) {
      if (x < r.x - r.w / 2 - 2 || x > r.x + r.w / 2 + 2) continue;
      const top = r.y - r.h / 2;
      if (top < hintY - 8 || top > hintY + 200) continue;
      if (best == null || top < best) best = top;
    }
    if (best != null) return Math.max(620, Math.min(825, best - 28));
  } catch (e) {}
  return Math.max(620, Math.min(818, hintY));
}

function near(x1, y1, x2, y2, dx, dy) {
  return Math.abs(x1 - x2) <= dx && Math.abs(y1 - y2) <= dy;
}

// Ступни бойца: серверные y — центр тела ВЫШЕ ступней (низ = y+28k,
// при k~1.6 это +46). Все проверки объективов — по ступням, иначе
// подбор флага/бомбы и точки не достают до земли (расхождение до 70px+).
// +48 покрывает k до ~2.4; мосты от земли в 160px — не цепляет.
function feetY(f) {
  try {
    if (f && Number.isFinite(f.y)) return f.y + 48;
  } catch (e) {}
  return 850;
}

module.exports = { segCircle, segRect, wallLos, netSpawn, supportRest, feetY, near };
