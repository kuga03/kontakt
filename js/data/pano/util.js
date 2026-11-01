// Процедурные фоновые панорамы (ulica/krisha/zavod/pustoch/pustinya/pechera/peshera).
// Рисуются кодом в стиле игры (как ящики/персонаж: чёткий контур, детали,
// тёплые окна), но плотнее и чище. Печём ОДИН раз в СТАТИЧНУЮ canvas-текстуру
// 1600x1000 (TileSprite/dynamic-проблем нет — это обычный Image-фон).
// Детерминировано (seed от темы): фон одинаковый каждый матч.
// Нет нужной темы — возвращаем null, сцена показывает старый fon_* PNG.
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PANO_W = 2560;
export const PANO_H = 1600;
// Арт пишется в координатах 1600x1000 и масштабируется: на широких картах
// апскейл 1600->(W+1800) давал мыло в 3x, теперь текстура больше — чётко.

// ---------- мелкие помощники ----------
export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Сетка окон с рамами, часть горит тёплым. Всё целыми пикселями — чётко.
export function windows(ctx, rng, x, y, cols, rows, cw, ch, gx, gy, opt) {
  const o = opt || {};
  const litP = o.litP != null ? o.litP : 0.45;
  const litCols = o.litCols || ['#ffd97a', '#ffbf5a', '#fff2c0'];
  const darkCol = o.darkCol || 'rgba(12,16,26,0.92)';
  const frameCol = o.frameCol || 'rgba(8,10,16,0.9)';
  for (let rI = 0; rI < rows; rI++) {
    for (let cI = 0; cI < cols; cI++) {
      const wx = Math.round(x + cI * (cw + gx));
      const wy = Math.round(y + rI * (ch + gy));
      const lit = rng() < litP;
      ctx.fillStyle = frameCol;
      ctx.fillRect(wx - 2, wy - 2, cw + 4, ch + 4);
      if (lit) {
        const lc = litCols[Math.floor(rng() * litCols.length)];
        const grd = ctx.createLinearGradient(wx, wy, wx, wy + ch);
        grd.addColorStop(0, lc);
        grd.addColorStop(1, shade(lc, -18));
        ctx.fillStyle = grd;
        ctx.fillRect(wx, wy, cw, ch);
        // блик сверху
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(wx, wy, cw, 2);
      } else {
        ctx.fillStyle = darkCol;
        ctx.fillRect(wx, wy, cw, ch);
        ctx.fillStyle = 'rgba(140,170,210,0.16)';
        ctx.fillRect(wx, wy, cw, 3);
      }
      // переплёт
      ctx.fillStyle = frameCol;
      ctx.fillRect(wx + Math.floor(cw / 2) - 1, wy, 2, ch);
      ctx.fillRect(wx, wy + Math.floor(ch / 2) - 1, cw, 2);
    }
  }
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + amt), g = cl(((n >> 8) & 255) + amt), b = cl((n & 255) + amt);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Провод со стрелой провиса.
export function wire(ctx, x0, y0, x1, y1, sag, col, w) {
  ctx.strokeStyle = col || 'rgba(10,10,14,0.85)';
  ctx.lineWidth = w || 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
  ctx.stroke();
}

// Мягкое свечение (фонарь, топка, солнце в дымке).
export function glow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha != null ? alpha : 0.5;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Дым из трубы: 5–7 полупрозрачных кругов вверх с дрейфом.
export function smoke(ctx, rng, x, y, baseR, drift, col) {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const r = baseR * (0.7 + t * 1.1);
    const sx = x + drift * t + (rng() - 0.5) * 14;
    const sy = y - t * baseR * 4.2;
    ctx.globalAlpha = 0.28 * (1 - t * 0.7);
    ctx.fillStyle = col || '#9aa0ab';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function stars(ctx, rng, W, yMax, n, alpha) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = rng() * W, y = rng() * yMax;
    const a = (0.25 + rng() * 0.6) * (alpha != null ? alpha : 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#dfe8ff';
    const s = rng() < 0.12 ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
  ctx.restore();
}

export function birds(ctx, rng, W, y0, y1, n) {
  ctx.save();
  ctx.strokeStyle = 'rgba(15,18,26,0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const x = rng() * W, y = y0 + rng() * (y1 - y0);
    const s = 5 + rng() * 5;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s / 2, y - 3, x, y);
    ctx.quadraticCurveTo(x + s / 2, y - 3, x + s, y);
    ctx.stroke();
  }
  ctx.restore();
}

// Плоские облака полосами.
export function clouds(ctx, rng, W, y0, y1, n, col, alpha) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const w = 180 + rng() * 420, h = 14 + rng() * 26;
    const x = rng() * (W + w) - w / 2, y = y0 + rng() * (y1 - y0);
    ctx.globalAlpha = (0.10 + rng() * 0.14) * (alpha != null ? alpha : 1);
    ctx.fillStyle = col || '#e8d8c8';
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
  }
  ctx.restore();
}

// Виньетка по краям — глубина без затрат.
export function vignette(ctx, W, H, strength) {
  const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(4,5,10,' + (strength != null ? strength : 0.42) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Фасад: корпус + карниз + окна + детали (кондиционеры, труба-стояк).
export function facade(ctx, rng, x, baseY, w, h, opt) {
  const o = opt || {};
  const body = o.body || '#4a4038';
  const edge = 'rgba(8,8,12,0.55)';
  x = Math.round(x); baseY = Math.round(baseY); w = Math.round(w); h = Math.round(h);
  const top = baseY - h;
  // корпус
  ctx.fillStyle = body;
  ctx.fillRect(x, top, w, h);
  // фактура: редкие тёмные штрихи-пятна
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let i = 0; i < Math.floor(w * h / 9000); i++) {
    ctx.fillRect(x + Math.floor(rng() * w), top + Math.floor(rng() * h), 3 + Math.floor(rng() * 8), 2);
  }
  // боковая тень справа
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + w - 10, top, 10, h);
  // светлый кант слева сверху
  ctx.fillStyle = 'rgba(255,235,200,0.10)';
  ctx.fillRect(x, top, 3, h);
  // карниз
  ctx.fillStyle = shade(body, -28);
  ctx.fillRect(x - 5, top - 10, w + 10, 12);
  ctx.fillStyle = 'rgba(255,240,210,0.14)';
  ctx.fillRect(x - 5, top - 10, w + 10, 2);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, top + 1, w - 2, h - 2);
  // окна
  const cols = Math.max(1, Math.floor((w - 40) / 56));
  const rows = Math.max(1, Math.floor((h - 70) / 64));
  const gx = cols > 1 ? (w - 40 - cols * 30) / (cols - 1 || 1) : 0;
  windows(ctx, rng, x + 24, top + 34, cols, rows, 30, 40, Math.max(14, gx), 24,
    { litP: o.litP != null ? o.litP : 0.42, darkCol: o.winDark, frameCol: o.winFrame });
  // стояк-труба сбоку
  if (rng() < (o.pipeP != null ? o.pipeP : 0.6)) {
    const px = x + 8 + Math.floor(rng() * (w - 16));
    ctx.fillStyle = shade(body, -34);
    ctx.fillRect(px, top - 6, 8, h + 6);
    ctx.fillStyle = 'rgba(255,240,210,0.10)';
    ctx.fillRect(px, top - 6, 2, h + 6);
  }
  // кондиционеры
  if (rng() < 0.7) {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const ax = x + 14 + Math.floor(rng() * (w - 44));
      const ay = top + 40 + Math.floor(rng() * (h - 90));
      ctx.fillStyle = '#8b9097';
      rr(ctx, ax, ay, 26, 18, 3);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let l = 0; l < 3; l++) ctx.fillRect(ax + 4, ay + 4 + l * 4, 18, 1.5);
    }
  }
  // дверь/витрина внизу
  if (o.shop) {
    const sh = 74;
    ctx.fillStyle = 'rgba(10,12,18,0.9)';
    ctx.fillRect(x + 14, baseY - sh, w - 28, sh);
    ctx.fillStyle = o.shopGlow || '#ffd97a';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x + 18, baseY - sh + 6, w - 36, sh - 26);
    ctx.globalAlpha = 1;
    // силуэты товаров/полок
    ctx.fillStyle = 'rgba(20,20,28,0.55)';
    for (let sI = 0; sI < 3; sI++) {
      ctx.fillRect(x + 24, baseY - sh + 16 + sI * 16, w - 48, 3);
    }
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 14, baseY - sh, w - 28, sh);
    // козырёк в полоску
    const aw = 22;
    for (let sI = 0; sI < Math.floor((w - 28) / aw); sI++) {
      ctx.fillStyle = sI % 2 ? '#7a2e2e' : '#d8cfc0';
      ctx.fillRect(x + 14 + sI * aw, baseY - sh - 18, aw, 18);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 14, baseY - sh - 18, w - 28, 4);
  } else if (rng() < 0.8) {
    const dw = 34, dh = 56;
    const dx = x + Math.floor(w / 2 - dw / 2);
    ctx.fillStyle = '#2c2119';
    ctx.fillRect(dx, baseY - dh, dw, dh);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, baseY - dh, dw, dh);
    ctx.fillStyle = 'rgba(255,220,150,0.25)';
    ctx.fillRect(dx + dw - 8, baseY - dh + 8, 4, 20);
  }
  return { top, cols, rows };
}

export function antenna(ctx, x, baseY, h) {
  ctx.strokeStyle = 'rgba(12,12,16,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + 8, baseY - h);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const y = baseY - (h / 4) * i;
    const wdt = 16 - i * 3;
    ctx.beginPath();
    ctx.moveTo(x + 8 - (16 - i * 3) * 0.28 - wdt / 2, y);
    ctx.lineTo(x + 8 - (16 - i * 3) * 0.28 + wdt / 2, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(x + 8, baseY - h - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, x + 8, baseY - h - 3, 10, '#ff5544', 0.5);
}

// ============================================================ УЛИЦА
export function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath();
  ctx.fill();
}

// Рваный сталактит (вверх — сталагмит): yBase — линия роста.
export function stalac(ctx, rng, x0, x1, yBase, hMin, hMax, col, up) {
  let x = x0;
  while (x < x1) {
    const w = 26 + rng() * 46, h = hMin + rng() * (hMax - hMin);
    const dir = up ? -1 : 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, yBase);
    ctx.lineTo(x + w, yBase);
    ctx.lineTo(x + w * 0.5 + (rng() - 0.5) * 10, yBase + dir * h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.18, yBase);
    ctx.lineTo(x + w * 0.36, yBase);
    ctx.lineTo(x + w * 0.30, yBase + dir * h * 0.7);
    ctx.closePath();
    ctx.fill();
    x += w * 0.55 + rng() * 30;
  }
}

// Один кристалл-осколок + куст из них.
export function shard(ctx, x, y, len, wid, ang, core, edge) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, edge);
  g.addColorStop(0.55, core);
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-wid / 2, 0);
  ctx.lineTo(-wid * 0.28, -len * 0.72);
  ctx.lineTo(0, -len);
  ctx.lineTo(wid * 0.28, -len * 0.72);
  ctx.lineTo(wid / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -len * 0.12);
  ctx.lineTo(0, -len * 0.9);
  ctx.stroke();
  ctx.restore();
}

export function crystalCluster(ctx, rng, x, y, s, core, edge, glowCol) {
  glow(ctx, x, y - 30 * s, 95 * s, glowCol, 0.5);
  ctx.fillStyle = '#22242a';
  rr(ctx, x - 46 * s, y - 14 * s, 92 * s, 22 * s, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const n = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * 1.1 + (rng() - 0.5) * 0.2;
    shard(ctx, x + (rng() - 0.5) * 56 * s, y - 8 * s,
      (46 + rng() * 54) * s, (14 + rng() * 10) * s, a, core, edge);
  }
}

// Дюна: синусный гребень с подсветкой кромки.
export function dune(ctx, W, H, yBase, amp, col, crestCol, phase) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-10, H);
  for (let x = -10; x <= W + 10; x += 20) {
    ctx.lineTo(x, yBase + Math.sin(x * 0.008 + phase) * amp + Math.sin(x * 0.021 + phase * 2) * amp * 0.35);
  }
  ctx.lineTo(W + 10, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = crestCol;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = -10; x <= W + 10; x += 20) {
    const y = yBase + Math.sin(x * 0.008 + phase) * amp + Math.sin(x * 0.021 + phase * 2) * amp * 0.35;
    x <= 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// Угловатый валун с гранью.
export function boulder(ctx, rng, x, y, s, col) {
  const n = 6 + Math.floor(rng() * 3);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = s * (0.7 + rng() * 0.5);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.75;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,220,0.10)';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.2);
  ctx.lineTo(x, y - s * 0.55);
  ctx.lineTo(x + s * 0.4, y - s * 0.1);
  ctx.closePath();
  ctx.fill();
}

// Сухой куст: веер веток.
export function deadBush(ctx, rng, x, y, s, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 2.2;
    const len = s * (0.6 + rng() * 0.7);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - 4,
      x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
}

// Груда обломков с торчащей арматурой.
export function rubble(ctx, rng, x, yBase, w, h) {
  ctx.fillStyle = '#4a443c';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, yBase);
  ctx.quadraticCurveTo(x, yBase - h * 1.4, x + w / 2, yBase);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < Math.floor(w * h / 700); i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(220,200,170,0.25)';
    ctx.fillRect(x - w / 2 + rng() * w, yBase - rng() * h, 2 + rng() * 7, 2 + rng() * 4);
  }
  ctx.strokeStyle = 'rgba(60,40,30,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const rx = x - w / 3 + rng() * w * 0.66, ry = yBase - rng() * h * 0.8;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + (rng() - 0.5) * 30, ry - 14 - rng() * 22);
    ctx.stroke();
  }
}

// Разрушенный фасад: рваный верх, плиты перекрытий, выбитые окна, трещины.
export function ruin(ctx, rng, x, baseY, w, hMax, opt) {
  const o = opt || {};
  const body = o.body || '#6e665c';
  x = Math.round(x); baseY = Math.round(baseY); w = Math.round(w);
  const teeth = 4 + Math.floor(rng() * 4);
  const pts = [[x, baseY], [x, baseY - hMax * 0.4]];
  for (let i = 0; i < teeth; i++) {
    pts.push([Math.round(x + (w / teeth) * (i + 1)), Math.round(baseY - hMax * (0.4 + rng() * 0.6))]);
  }
  pts.push([x + w, baseY]);
  poly(ctx, pts, body);
  // плиты перекрытий — светлые горизонтали
  ctx.fillStyle = 'rgba(220,205,180,0.20)';
  const floors = 2 + Math.floor(rng() * 3);
  for (let f = 1; f <= floors; f++) {
    const fy = baseY - (hMax * 0.85 / (floors + 1)) * f;
    if (fy > baseY - hMax * 0.35) ctx.fillRect(x + 4, Math.round(fy), w - 8, 5);
  }
  // окна целые + выбитые дыры
  const cols = Math.max(1, Math.floor((w - 40) / 62));
  for (let cI = 0; cI < cols; cI++) {
    for (let rI = 0; rI < 2; rI++) {
      const wx = x + 24 + cI * 62, wy = baseY - 120 - rI * 66;
      if (wy < baseY - hMax * 0.75) continue;
      if (rng() < 0.45) {
        // выбитое: тёмная дыра с рваным краем
        ctx.fillStyle = 'rgba(8,8,10,0.95)';
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 34, wy + 4);
        ctx.lineTo(wx + 30, wy + 44);
        ctx.lineTo(wx + 4, wy + 40);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(8,10,16,0.9)';
        ctx.fillRect(wx - 2, wy - 2, 34, 44);
        if (rng() < (o.litP != null ? o.litP : 0.3)) {
          ctx.fillStyle = '#ffcf7a';
          ctx.fillRect(wx, wy, 30, 40);
        } else {
          ctx.fillStyle = 'rgba(14,18,28,0.95)';
          ctx.fillRect(wx, wy, 30, 40);
        }
      }
    }
  }
  // арматура из рваного верха
  ctx.strokeStyle = 'rgba(70,45,32,0.95)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < teeth; i++) {
    const ax = x + (w / teeth) * (i + 0.5);
    const ay = pts[2 + i][1];
    ctx.beginPath();
    ctx.moveTo(ax, ay + 4);
    ctx.quadraticCurveTo(ax + (rng() - 0.5) * 20, ay - 16, ax + (rng() - 0.5) * 30, ay - 26 - rng() * 14);
    ctx.stroke();
  }
  // трещины
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  for (let cI = 0; cI < 3; cI++) {
    let cx = x + rng() * w, cy = baseY - 20 - rng() * hMax * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) { cx += (rng() - 0.5) * 26; cy -= rng() * 30; ctx.lineTo(cx, cy); }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(8,8,12,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, baseY - hMax + 1, w - 2, hMax - 2);
}

// Наклонный столб с перекладиной.
export function leanPole(ctx, x, yBase, h, lean) {
  ctx.strokeStyle = '#2c2620';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(x, yBase);
  ctx.lineTo(x + lean, yBase - h);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + lean - 30, yBase - h + 24);
  ctx.lineTo(x + lean + 30, yBase - h + 18);
  ctx.stroke();
}

// Мёртвое дерево.
export function deadTree(ctx, x, yBase, s, col) {
  ctx.strokeStyle = col || '#241d16';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x, yBase);
  ctx.quadraticCurveTo(x + 8, yBase - 70 * s, x - 6, yBase - 120 * s);
  ctx.stroke();
  ctx.lineWidth = 4;
  const branch = (bx, by, ang, len) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (len > 22) {
      branch(ex, ey, ang - 0.5, len * 0.62);
      branch(ex, ey, ang + 0.45, len * 0.62);
    }
  };
  branch(x - 6, yBase - 120 * s, -Math.PI / 2 - 0.5, 60 * s);
  branch(x - 6, yBase - 120 * s, -Math.PI / 2 + 0.4, 66 * s);
  branch(x + 2, yBase - 80 * s, -0.4, 44 * s);
}

// Меса: столовый останец со слоями.
export function mesa(ctx, rng, x, baseY, w, h, col) {
  const topW = w * (0.55 + rng() * 0.2);
  const x0 = x + (w - topW) / 2;
  poly(ctx, [[x, baseY], [x0, baseY - h], [x0 + topW, baseY - h], [x + w, baseY]], col);
  ctx.fillStyle = 'rgba(255,235,210,0.12)';
  ctx.fillRect(Math.round(x0), Math.round(baseY - h), Math.round(topW), 5);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 1; i <= 3; i++) {
    const ly = baseY - (h / 4) * i;
    ctx.fillRect(Math.round(x + 8), Math.round(ly), Math.round(w - 16), 3);
  }
}

