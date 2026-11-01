import { hashStr, mulberry32, glow } from './util.js';
export const BAND_PALS = {
  night:     { arch: 'city', wall: '#1a2030', roof: '#11141f', win: '#ffd97a', litP: 0.45 },
  sunset:    { arch: 'city', wall: '#2e1f2e', roof: '#1c1220', win: '#ffb46b', litP: 0.5 },
  wasteland: { arch: 'waste', wall: '#33342a', roof: '#1e2016', win: '#ffe08a', litP: 0 },
  krisha:    { arch: 'city', wall: '#232530', roof: '#14151d', win: '#ffe08a', litP: 0.5 },
  ulica:     { arch: 'city', wall: '#20222e', roof: '#13141c', win: '#ffd97a', litP: 0.55 },
  zavod:     { arch: 'ind',  wall: '#1c2026', roof: '#101216', win: '#ff9a55', litP: 0.3 },
  pustoch:   { arch: 'desert', wall: '#2a2012', roof: '#1a1408', win: '#ffc46b', litP: 0.4 },
  pustinya:  { arch: 'desert', wall: '#3a3220', roof: '#241e10', win: '#ffd080', litP: 0.4 },
  pechera:   { arch: 'cave', rock: '#101012', glow: '#7dffb0' },
  peshera:   { arch: 'cave', rock: '#141418', glow: '#8fb8ff' }
};

// Один чёткий домик-силуэт: корпус + крыша по архетипу + окна + детали.
export function bandHouse(ctx, rng, x, baseY, w, h, pal) {
  x = Math.round(x); baseY = Math.round(baseY);
  w = Math.round(w); h = Math.round(h);
  const top = baseY - h;
  const edge = 'rgba(0,0,0,0.55)';
  const arch = pal.arch || 'city';
  if (arch === 'waste') {
    // Разбитый дом: рваный верх, арматура, почти все окна тёмные.
    // Стена — серая или тёплая (полосы не однотонные).
    const teeth = 4 + Math.floor(rng() * 3);
    ctx.fillStyle = rng() < 0.55 ? pal.wall : '#4a4132';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, top + Math.round(rng() * 30));
    for (let i = 1; i <= teeth; i++) {
      ctx.lineTo(x + Math.round((w / teeth) * i), top + Math.round(rng() * 36));
    }
    ctx.lineTo(x + w, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + w - 9, top + 18, 9, h - 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, baseY - 6, w, 6);
    // арматура из рваного верха
    ctx.strokeStyle = '#24241c';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const ax = x + 10 + rng() * (w - 20);
      const ay = top + 6 + rng() * 14;
      ctx.beginPath();
      ctx.moveTo(ax, ay + 14);
      ctx.lineTo(ax + (rng() - 0.5) * 8, ay - 8 - rng() * 8);
      ctx.stroke();
    }
    // трещина по стене
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    let cx = x + w * (0.3 + rng() * 0.4), cy = top + 24;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    while (cy < baseY - 10) {
      cx += (rng() - 0.5) * 18;
      cy += 14 + rng() * 14;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    // щебень у подножия
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(Math.round(x + rng() * w), Math.round(baseY - 8 + rng() * 6), 2 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 3));
    }
  } else {
  ctx.fillStyle = pal.wall;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + w - 9, top, 9, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x, baseY - 6, w, 6);
  if (arch === 'city') {
    const peak = 30 + rng() * 26;
    ctx.fillStyle = pal.roof;
    ctx.beginPath();
    ctx.moveTo(x - 8, top);
    ctx.lineTo(x + w / 2, top - peak);
    ctx.lineTo(x + w + 8, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 8, top - 2, w + 16, 4);
    if (rng() < 0.6) {
      const tx = x + 12 + rng() * Math.max(1, w - 36);
      ctx.fillStyle = pal.roof;
      ctx.fillRect(Math.round(tx), Math.round(top - peak * 0.55 - 20), 11, 24);
    }
    if (rng() < 0.5) {
      const ax = x + 14 + rng() * Math.max(1, w - 28);
      ctx.strokeStyle = pal.roof;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, top - 2);
      ctx.lineTo(ax + 5, top - 24);
      ctx.stroke();
      ctx.fillStyle = '#ff5555';
      ctx.fillRect(ax + 3, top - 28, 4, 4);
    }
  } else if (arch === 'ind') {
    ctx.fillStyle = pal.roof;
    ctx.fillRect(x - 4, top - 10, w + 8, 12);
    if (rng() < 0.55) {
      const bw2 = 24 + rng() * 20;
      const bx2 = x + 8 + rng() * Math.max(1, w - bw2 - 16);
      ctx.fillStyle = pal.wall;
      ctx.fillRect(Math.round(bx2), top - 32, Math.round(bw2), 22);
    }
    if (rng() < 0.5) {
      const tx = x + 10 + rng() * Math.max(1, w - 28);
      const th = 50 + rng() * 50;
      ctx.fillStyle = pal.wall;
      ctx.fillRect(Math.round(tx), Math.round(top - th), 15, Math.round(th));
      ctx.fillStyle = pal.roof;
      ctx.fillRect(Math.round(tx) - 3, Math.round(top - th) - 4, 21, 5);
      if (rng() < 0.4) {
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(Math.round(tx) + 6, Math.round(top - th) - 8, 3, 3);
      }
    }
  } else {
    // desert: плоская крыша + бак/будка
    ctx.fillStyle = pal.roof;
    ctx.fillRect(x - 4, top - 9, w + 8, 11);
    if (rng() < 0.5) {
      const bw2 = 24 + rng() * 18;
      ctx.fillStyle = pal.wall;
      ctx.fillRect(Math.round(x + 8 + rng() * Math.max(1, w - bw2 - 16)), top - 30, Math.round(bw2), 20);
    }
  }
  } // конец обычной стены (у waste свой рваный корпус выше)
  // окна сеткой (у waste litP≈0 — почти все тёмные глазницы;
  // ряд ниже, чтобы не висеть в выбитых зубцах верха)
  const cols = Math.max(1, Math.floor((w - 22) / 26));
  const rows = Math.max(1, Math.floor((h - 40) / 34));
  const winTop = top + (arch === 'waste' ? 45 : 15);
  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      if (rng() < 0.18) continue;
      const wx = Math.round(x + 13 + ci * ((w - 26) / Math.max(1, cols - 1 || 1)) - 7);
      const wy = winTop + ri * 32;
      if (wy + 18 > baseY - 8) continue;
      if (rng() < pal.litP) {
        ctx.fillStyle = pal.win;
        ctx.fillRect(wx, wy, 14, 18);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(wx + 6, wy, 2, 18);
        ctx.fillRect(wx, wy + 8, 14, 2);
      } else {
        ctx.fillStyle = 'rgba(6,8,14,0.9)';
        ctx.fillRect(wx, wy, 14, 18);
      }
    }
  }
  // дверь
  if (arch !== 'cave') {
    ctx.fillStyle = 'rgba(5,6,10,0.9)';
    ctx.fillRect(Math.round(x + w / 2 - 10), baseY - 32, 20, 32);
  }
  // полный контур — всем, кроме waste (у него свой рваный контур выше,
  // прямоугольник повис бы над выбитыми зубцами)
  if (arch !== 'waste') {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, top + 1, w - 2, h - 2);
  }
}

// Индустриальный силуэт для дальнего бэнда пустоши (ТЗ: вышки, трубы,
// краны среди руин). Один из 4 видов, ноги на base. Деталей минимум — даль.
function bandWasteInd(ctx, rng, x, base, s, pal) {
  x = Math.round(x); base = Math.round(base);
  const kind = Math.floor(rng() * 4);
  const body = rng() < 0.5 ? pal.wall : '#4a4132';
  ctx.fillStyle = body;
  if (kind === 0) {
    // заводская труба с жерлом
    const w = Math.round(14 + s * 0.28), h = Math.round(s * 1.6);
    ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = 'rgba(8,8,10,0.9)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, base - h, w / 2, Math.max(2, w / 5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 2, base - Math.round(h * 0.55), w + 4, 5);
  } else if (kind === 1) {
    // эстакада с трубой на опорах
    const w = Math.round(s * 2.2), h = Math.round(s * 0.9);
    ctx.fillRect(x + 6, base - h - 8, w, 9);
    ctx.fillRect(x, base - h, 8, h);
    ctx.fillRect(x + w - 2, base - h, 8, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 6, base - h - 8, w, 2);
  } else if (kind === 2) {
    // цистерна на ножках
    const w = Math.round(s * 1.5), h = Math.round(s * 0.7);
    ctx.fillRect(x, base - h - 10, w, h);
    ctx.beginPath();
    ctx.ellipse(x + w / 2, base - h - 10, w / 2, Math.max(3, h / 4), 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 6, base - 10, 6, 10);
    ctx.fillRect(x + w - 12, base - 10, 6, 10);
  } else {
    // покосившаяся вышка-опора ЛЭП
    const h = Math.round(s * 1.8);
    ctx.save();
    ctx.translate(x + 14, base);
    ctx.rotate(0.1 + rng() * 0.08);
    ctx.fillStyle = body;
    ctx.fillRect(-3, -h, 6, h);
    ctx.fillRect(-16, -Math.round(h * 0.72), 32, 4);
    ctx.fillRect(-12, -Math.round(h * 0.45), 24, 4);
    ctx.restore();
    // провисший провод к следующей опоре
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 14, base - Math.round(h * 0.72));
    ctx.quadraticCurveTo(x + 60, base - Math.round(h * 0.72) + 16, x + 110, base - Math.round(h * 0.6));
    ctx.stroke();
  }
}

// Завал: трапеция щебня с обломками и торчащей балкой, ноги на baseY.
// Заполняет разрывы между группами домов.
function wasteRubble(ctx, rng, x, baseY, w, h, colA, colB) {
  x = Math.round(x); baseY = Math.round(baseY);
  ctx.fillStyle = colA || (rng() < 0.5 ? '#33342a' : '#4a4132');
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + Math.round(w * 0.2), baseY - h);
  ctx.lineTo(x + Math.round(w * 0.75), baseY - h - Math.round(rng() * 8));
  ctx.lineTo(x + w, baseY);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colB || (rng() < 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(150,145,130,0.35)');
    ctx.fillRect(Math.round(x + rng() * w), Math.round(baseY - h + rng() * Math.max(1, h - 2)), 2 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 3));
  }
  if (rng() < 0.6) {
    ctx.save();
    ctx.translate(x + w * (0.3 + rng() * 0.4), baseY - h);
    ctx.rotate((rng() - 0.5) * 0.9);
    ctx.fillStyle = '#3a342c';
    ctx.fillRect(-2, -h - 14, 4, h + 14);
    ctx.restore();
  }
}

// Забор-заполнитель разрывов для города: столбы + две перекладины.
// Без вывесок и огней — тихий ритм между домами.
function bandFence(ctx, rng, x, baseY, w) {
  x = Math.round(x); baseY = Math.round(baseY);
  const h = 24 + Math.round(rng() * 10);
  ctx.fillStyle = 'rgba(10,10,14,0.9)';
  for (let px = x; px <= x + w; px += 22) {
    ctx.fillRect(Math.round(px), Math.round(baseY - h), 4, h);
  }
  ctx.fillRect(x, Math.round(baseY - h), w, 3);
  ctx.fillRect(x, Math.round(baseY - h + 10), w, 2);
  if (rng() < 0.5) {
    // покосившаяся секция
    ctx.save();
    ctx.translate(x + w / 2, baseY);
    ctx.rotate((rng() - 0.5) * 0.12);
    ctx.fillRect(Math.round(-w / 2), Math.round(-h), w, 3);
    ctx.restore();
  }
}
// Кластерная застройка: группы по 1–3 дома С НАХЛЁСТОМ (окклюзия =
// глубина: задний дом выглядывает из-за переднего), высота с выбросами
// (башни и огрызки), между группами — широкие разрывы с заполнителем.
// Равномерный шаг запрещён: именно он давал конвейер «домик-домик».
function wasteClusterRow(ctx, rng, W, baseY, wMin, wMax, hMin, hMax, pal, opts) {
  opts = opts || {};
  const o = opts;
  const alpha = (o.alpha != null) ? o.alpha : 1;
  const alphaV = o.alphaV || 0;
  const rubbleP = (o.rubbleP != null) ? o.rubbleP : 0.5;
  const overlapP = (o.overlapP != null) ? o.overlapP : 0.55;
  const endX = W - 8;
  let x = 8 + rng() * 30;
  while (x < endX - 40) {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const w = Math.round(wMin + rng() * (wMax - wMin));
      if (x + w > endX) break;
      const r = rng();
      let h;
      if (r < 0.12) h = Math.round(hMax * (1.15 + rng() * 0.3));
      else if (r < 0.3) h = Math.round(hMin * (0.55 + rng() * 0.25));
      else h = Math.round(hMin + rng() * (hMax - hMin));
      try {
        if (alphaV > 0) {
          ctx.save();
          try { ctx.globalAlpha = Math.max(0.3, Math.min(1, alpha + (rng() - 0.5) * 2 * alphaV)); } catch (e) {}
        }
        bandHouse(ctx, rng, Math.round(x), baseY, w, h, pal);
        if (alphaV > 0) { try { ctx.restore(); } catch (e) {} }
      } catch (e) { try { ctx.restore(); } catch (e2) {} }
      x += (i < n - 1 && rng() < overlapP) ? Math.round(w * (0.45 + rng() * 0.3)) : w + Math.round(6 + rng() * 30);
    }
    // разрыв: к концу холста — короче, чтобы у шва не зияла дыра.
    // Заполнитель по теме: пустошь/пустыня — завал, город — забор,
    // завод — малая индустрия (труба/эстакада/бак/вышка).
    const gap = (x > endX - 600) ? Math.round(30 + rng() * 60) : Math.round(60 + rng() * 120);
    const filler = (o.filler !== undefined) ? o.filler : 'rubble';
    if (filler !== null && rng() < rubbleP && gap > 60) {
      if (filler === 'fence') {
        const fw = Math.min(gap - 16, 60 + Math.round(rng() * 60));
        bandFence(ctx, rng, Math.round(x + 8 + rng() * Math.max(1, gap - fw - 16)), baseY, fw);
      } else if (filler === 'ind') {
        bandWasteInd(ctx, rng, Math.round(x + 8 + rng() * Math.max(1, gap - 60)), baseY, 30 + rng() * 22, pal);
      } else {
        const rw = Math.round(50 + rng() * Math.min(90, gap - 20));
        wasteRubble(ctx, rng, Math.min(Math.round(x + 8 + rng() * Math.max(1, gap - rw - 16)), endX - rw), baseY, rw, Math.round(16 + rng() * 22));
      }
    }
    x += gap;
  }
}

// Скальный ряд для пещер: зубья сверху/снизу + светящиеся точки.
function bandTeeth(ctx, rng, W, H, pal) {
  ctx.fillStyle = pal.rock;
  let x = -20;
  while (x < W + 20) {
    const w = 60 + rng() * 110, h = 60 + rng() * (H * 0.45);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w * 0.5 + (rng() - 0.5) * 20, h);
    ctx.closePath();
    ctx.fill();
    x += w * 0.6 + rng() * 40;
  }
  x = -20;
  while (x < W + 20) {
    const w = 70 + rng() * 120, h = 50 + rng() * (H * 0.35);
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + w, H);
    ctx.lineTo(x + w * 0.5 + (rng() - 0.5) * 20, H - h);
    ctx.closePath();
    ctx.fill();
    x += w * 0.6 + rng() * 40;
  }
  for (let i = 0; i < 26; i++) {
    glow(ctx, rng() * W, H * 0.3 + rng() * H * 0.5, 8 + rng() * 10, pal.glow, 0.5);
    ctx.fillStyle = pal.glow;
    ctx.fillRect(Math.round(rng() * W), Math.round(H * 0.3 + rng() * H * 0.5), 3, 3);
  }
}

export function bakeCrispBands(scene, themeId) {
  try {
    const id = (themeId && BAND_PALS[themeId]) ? themeId : 'night';
    const pal = BAND_PALS[id];
    const farKey = 'bgc_' + id + '_far';
    const nearKey = 'bgc_' + id + '_near';
    if (!scene || !scene.textures) return null;
    if (scene.textures.exists(farKey) && scene.textures.exists(nearKey)) {
      return { far: farKey, near: nearKey };
    }
    const compose = (key, W, H, hMin, hMax, seed) => {
      if (scene.textures.exists(key)) return;
      const rng = mulberry32(hashStr('band:' + id + ':' + key + seed));
      const ct = scene.textures.createCanvas(key, W, H);
      if (!ct || !ct.context) {
        try { scene.textures.remove(key); } catch (e) {}
        return;
      }
      const ctx = ct.context;
      try { ctx.clearRect(0, 0, W, H); } catch (e) {}
      // Пустошь: детали пекутся мелкими сразу в широкую текстуру (3200),
      // показ 1:1 (tileScale убран в mapPrimitives). Было: тайл 1600 +
      // tileScale 0.4/0.55 — период на экране 640/880px, pattern повторялся
      // ~2 раза на вьюпорт (горизонтальная копипаста). Теперь период 3200 —
      // повтора в кадре нет, а размер деталей на экране тот же.
      let preK = 1;
      if (id === 'wasteland') {
        preK = (key === farKey) ? 0.4 : 0.55;
        W = Math.round(W / preK); H = Math.round(H / preK);
        try { ctx.save(); ctx.scale(preK, preK); } catch (e) {}
      }
      try {
        if (pal.arch === 'cave') {
          bandTeeth(ctx, rng, W, H, pal);
        } else {
          const isFarBand = (key === farKey);
          if (id === 'wasteland' && isFarBand) {
            // Дальний бэнд пустоши — дальняя улица кластерами (дома группами
            // с нахлёстом + завалы), своего нижнего ряда нет. Равномерный шаг
            // запрещён (ТЗ п.8): он давал конвейер «домик-домик».
            wasteClusterRow(ctx, rng, W, Math.round(H * 0.62), 60, 110, 50, 90, pal,
              { alpha: 0.55, alphaV: 0.12, rubbleP: 0.35, overlapP: 0.5 });
            wasteClusterRow(ctx, rng, W, Math.round(H * 0.46), 44, 80, 34, 60, pal,
              { alpha: 0.32, alphaV: 0.08, rubbleP: 0.25, overlapP: 0.45 });
            // средний план дали (ТЗ пустоши): редкие трубы, эстакады,
            // цистерны, покосившиеся вышки среди домов — ноги между рядами
            ctx.save();
            try { ctx.globalAlpha = 0.45; } catch (e2) {}
            let ix = 200 + rng() * 300;
            while (ix < W - 100) {
              if (rng() < 0.6) {
                bandWasteInd(ctx, rng, Math.round(ix), Math.round(H * 0.58), 40 + rng() * 30, pal);
              }
              ix += 420 + rng() * 380;
            }
            try { ctx.restore(); } catch (e2) {}
            // дымка под силуэтами — сажает их вдаль
            const hz = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.8);
            hz.addColorStop(0, 'rgba(200,190,150,0)');
            hz.addColorStop(1, 'rgba(200,190,150,0.22)');
            ctx.fillStyle = hz;
            ctx.fillRect(0, H * 0.45, W, H * 0.35);
          } else if (id === 'wasteland') {
            // Ближний бэнд пустоши — главный ряд КЛАСТЕРАМИ (без дальней
            // улицы, иначе опять два ряда в одном бэнде).
            wasteClusterRow(ctx, rng, W, H, 110, 260, hMin, hMax, pal,
              { alpha: 1, alphaV: 0.12, rubbleP: 0.55, overlapP: 0.6 });
          } else {
            // Главный ряд остальных тем — тоже кластерами (ТЗ п.10):
            // конвейер запрещён везде, не только в пустоши.
            // Заполнитель по архетипу: город — забор, завод — индустрия,
            // пустыня — завал. У города нахлёст меньше — бережём вывески.
            const arch = pal.arch || 'city';
            const filler = arch === 'city' ? 'fence' : arch === 'ind' ? 'ind' : arch === 'desert' ? 'rubble' : null;
            wasteClusterRow(ctx, rng, W, H, 110, 260, hMin, hMax, pal,
              { alpha: 1, alphaV: 0.08, rubbleP: 0.5, overlapP: arch === 'city' ? 0.35 : 0.5, filler });
          }
        }
        // лёгкое затемнение низа — глубина
        const vg = ctx.createLinearGradient(0, 0, 0, H);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      } catch (e) {}
      try { if (preK !== 1) ctx.restore(); } catch (e) {}
      try { ct.refresh(); } catch (e) {}
    };
    // Все бэнды широкие 3200: период тайлинга превышает вьюпорт —
    // горизонтальной копипасты нет ни в одной теме (ТЗ п.7).
    const bandW = 3200;
    compose(farKey, bandW, 360, 90, 180, 'f');
    compose(nearKey, bandW, 430, 150, 300, 'n');
    if (!scene.textures.exists(farKey) || !scene.textures.exists(nearKey)) return null;
    return { far: farKey, near: nearKey };
  } catch (e) {
    return null;
  }
}
