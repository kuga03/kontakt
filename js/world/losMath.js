// losMath.js — чистая геометрия боя (без Phaser, без сцены).
// Вынесено из GameScene.js (hasWallLos/hasLineOfSight/_seg* и т.д.).
// Работает и в браузере, и в Node (для будущего авторитетного LAN-сервера).
// rects — массив {L,R,T,B} (допустимо {left,right,top,bottom}).
// clouds — массив {x,y,radius}.

function normRect(r) {
  if (!r) return null;
  if (r.L !== undefined || r.R !== undefined || r.T !== undefined || r.B !== undefined) {
    return { L: r.L, R: r.R, T: r.T, B: r.B };
  }
  return { L: r.left, R: r.right, T: r.top, B: r.bottom };
}

// Параметр t пересечения отрезка p1→p2 с прямоугольником, null — мимо.
export function segRectT(x1, y1, x2, y2, L, T, R, B) {
  try {
    const dx = x2 - x1, dy = y2 - y1;
    let tmin = 0, tmax = 1;
    if (Math.abs(dx) < 1e-9) {
      if (x1 < L || x1 > R) return null;
    } else {
      let t1 = (L - x1) / dx, t2 = (R - x1) / dx;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    if (Math.abs(dy) < 1e-9) {
      if (y1 < T || y1 > B) return null;
    } else {
      let t1 = (T - y1) / dy, t2 = (B - y1) / dy;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin;
  } catch (e) { return null; }
}

// Параметр t пересечения отрезка с кругом, null — мимо.
export function segCircleT(x1, y1, x2, y2, cx, cy, r) {
  try {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-9) {
      return (fx * fx + fy * fy <= r * r) ? 0 : null;
    }
    const bb = 2 * (fx * dx + fy * dy);
    const cc = fx * fx + fy * fy - r * r;
    if (cc <= 0) return 0;
    const disc = bb * bb - 4 * a * cc;
    if (disc < 0) return null;
    const t = (-bb - Math.sqrt(disc)) / (2 * a);
    return (t >= 0 && t <= 1) ? t : null;
  } catch (e) { return null; }
}

// Пересекает ли отрезок круг (луч зрения сквозь дым). Булево.
export function segCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + dx * t - cx, py = y1 + dy * t - cy;
  return (px * px + py * py) <= r * r;
}

export function lineSegIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1x = x2 - x1, d1y = y2 - y1;
  const d2x = x4 - x3, d2y = y4 - y3;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((x3 - x1) * d2y - (y3 - y1) * d2x) / cross;
  const u = ((x3 - x1) * d1y - (y3 - y1) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ВНИМАНИЕ: rw/rh здесь — это right/bottom, а не width/height
// (так было в GameScene.lineIntersectsRect, сохраняем сигнатуру).
export function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  // Отрезок целиком внутри солида (оба конца в боксе): рёбер не касается,
  // но луч заблокирован (иначе «вижу» изнутри стены). Обычных лучей не
  // касается — их концы вне солидов.
  if (x1 >= rx && x1 <= rw && y1 >= ry && y1 <= rh &&
      x2 >= rx && x2 <= rw && y2 >= ry && y2 <= rh) return true;
  if (lineSegIntersect(x1, y1, x2, y2, rx, ry, rw, ry)) return true;
  if (lineSegIntersect(x1, y1, x2, y2, rw, ry, rw, rh)) return true;
  if (lineSegIntersect(x1, y1, x2, y2, rx, rh, rw, rh)) return true;
  if (lineSegIntersect(x1, y1, x2, y2, rx, ry, rx, rh)) return true;
  return false;
}

// Собрать плоские rects из тел Phaser (body.x/y/width/height).
// Чистая функция-конвертер: на вход массив {x,y,width,height}.
export function toLosRects(bodies) {
  const out = [];
  if (!bodies) return out;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b) continue;
    const bx = (b.x !== undefined) ? b.x : (b.left !== undefined ? b.left : b.L);
    const by = (b.y !== undefined) ? b.y : (b.top !== undefined ? b.top : b.T);
    const bw = b.width, bh = b.height;
    if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;
    if (Number.isFinite(bw) && Number.isFinite(bh)) {
      out.push({ L: bx, R: bx + bw, T: by, B: by + bh });
    } else if (b.L !== undefined) {
      const n = normRect(b);
      if (n) out.push(n);
    }
  }
  return out;
}

// Только геометрия, без дыма. strict=true — без льготы "стою на платформе".
export function hasWallLos(rects, x1, y1, x2, y2, strict) {
  const segLen = Math.hypot(x2 - x1, y2 - y1);
  // Кап дальности: макс. range стволов 1300 (Barrett_M82, см. data/weapons.js)
  // x1.2 запаса ~= 1560 + округление вверх на rangeMult/апгрейды/гены -> 2000 (лимит 4000).
  if (!Number.isFinite(segLen) || segLen > 2000) return false;
  if (!rects || !rects.length) return true;
  const segMinX = Math.min(x1, x2), segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2), segMaxY = Math.max(y1, y2);
  for (let i = 0; i < rects.length; i++) {
    const rn = normRect(rects[i]);
    if (!rn) continue;
    const left = rn.L, right = rn.R, top = rn.T, bottom = rn.B;
    if (right < segMinX || left > segMaxX || bottom < segMinY || top > segMaxY) continue;
    const supportsSrc =
      !strict &&
      y1 >= top - 24 && y1 <= bottom + 12 &&
      x1 >= left - 8 && x1 <= right + 8;
    const supportsDst =
      !strict &&
      y2 >= top - 24 && y2 <= bottom + 12 &&
      x2 >= left - 8 && x2 <= right + 8;
    if (supportsSrc || supportsDst) continue;
    if (lineIntersectsRect(x1, y1, x2, y2, left, top, right, bottom)) {
      return false;
    }
  }
  return true;
}

export function smokeAt(clouds, x, y) {
  try {
    for (let i = 0; i < (clouds || []).length; i++) {
      const s = clouds[i];
      const dx = x - s.x, dy = y - s.y;
      if (Math.hypot(dx, dy) <= s.radius) return s;
    }
  } catch (e) {}
  return null;
}

// Полный LOS: стены + дым. strict — см. hasWallLos.
export function hasLineOfSight(rects, clouds, x1, y1, x2, y2, strict) {
  if (!hasWallLos(rects, x1, y1, x2, y2, strict)) return false;
  if (!clouds || !clouds.length) return true;
  if (Math.hypot(x2 - x1, y2 - y1) <= 75) return true;
  const c1 = smokeAt(clouds, x1, y1);
  if (c1 && smokeAt(clouds, x2, y2) === c1) return true;
  for (let i = 0; i < clouds.length; i++) {
    const s = clouds[i];
    const nearSrc = Math.hypot(x1 - s.x, y1 - s.y) <= s.radius;
    const nearDst = Math.hypot(x2 - s.x, y2 - s.y) <= s.radius;
    if (nearSrc || nearDst) return false;
  }
  // Дым посередине отрезка (как botHiddenBySmoke): сначала дешёвый AABB-отсев
  // облаков, дорогой segCircle — только для кандидатов. При 0 облаках сюда
  // не доходим (ранний return выше), при 1–2 — единицы операций.
  const segMinX = Math.min(x1, x2), segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2), segMaxY = Math.max(y1, y2);
  for (let i = 0; i < clouds.length; i++) {
    const s = clouds[i];
    if (s.x + s.radius < segMinX || s.x - s.radius > segMaxX ||
        s.y + s.radius < segMinY || s.y - s.radius > segMaxY) continue;
    if (segCircle(x1, y1, x2, y2, s.x, s.y, s.radius)) return false;
  }
  return true;
}

// Взрывной LOS: только геометрия, строго, без дыма.
export function hasBlastLos(rects, x1, y1, x2, y2) {
  return hasWallLos(rects, x1, y1, x2, y2, true);
}

// Плита между взрывом и целью (граната НА платформе, боец ПОД ней).
export function blastBlockedBySlab(platformRects, coverRects, cx, cy, tx, ty) {
  try {
    const groups = [platformRects, coverRects];
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];
      if (!grp) continue;
      for (let i = 0; i < grp.length; i++) {
        const rn = normRect(grp[i]);
        if (!rn) continue;
        const L = rn.L, R = rn.R, T = rn.T, B = rn.B;
        const above = cy < T - 2;
        const below = ty > B + 2;
        const aboveT = ty < T - 2;
        const belowC = cy > B + 2;
        if ((above && below) || (aboveT && belowC)) {
          const xOverlap = Math.max(L - 10, Math.min(cx, tx)) <= Math.min(R + 10, Math.max(cx, tx));
          if (xOverlap) return true;
        }
      }
    }
  } catch (e) {}
  return false;
}

// Первый статик на луче — для лога зрения. Возвращает {x,y} центра или null.
export function losBlocker(rects, x1, y1, x2, y2) {
  try {
    let best = null, bd = Infinity;
    for (let i = 0; i < (rects || []).length; i++) {
      const rn = normRect(rects[i]);
      if (!rn) continue;
      const L = rn.L, R = rn.R, T = rn.T, B = rn.B;
      if (R < Math.min(x1, x2) || L > Math.max(x1, x2) ||
          B < Math.min(y1, y2) || T > Math.max(y1, y2)) continue;
      if (x1 > L - 8 && x1 < R + 8 && y1 > T - 24 && y1 < B + 12) continue;
      if (x2 > L - 8 && x2 < R + 8 && y2 > T - 24 && y2 < B + 12) continue;
      if (!lineIntersectsRect(x1, y1, x2, y2, L, T, R, B)) continue;
      const dd = Math.hypot((L + R) / 2 - x1, (T + B) / 2 - y1);
      if (dd < bd) { bd = dd; best = { x: Math.round((L + R) / 2), y: Math.round((T + B) / 2) }; }
    }
    return best;
  } catch (e) { return null; }
}

// Скрыт ли чужой бот дымом (без стен — их проверяет LOS).
export function botHiddenBySmoke(clouds, vx, vy, bx, by) {
  try {
    if (!clouds || !clouds.length) return false;
    if (Math.hypot(bx - vx, by - vy) <= 75) return false;
    const cb = smokeAt(clouds, bx, by);
    if (cb && smokeAt(clouds, vx, vy) === cb) return false;
    for (let i = 0; i < clouds.length; i++) {
      const s = clouds[i];
      if (Math.hypot(bx - s.x, by - s.y) <= s.radius) return true;
    }
    for (let i = 0; i < clouds.length; i++) {
      const s = clouds[i];
      if (segCircle(vx, vy, bx, by, s.x, s.y, s.radius)) return true;
    }
  } catch (e) {}
  return false;
}
