import { rr, windows, shade, wire, glow, smoke, stars, birds, clouds, vignette, facade, antenna } from './util.js';
export function paintUlica(ctx, rng, W, H) {
  // небо: вечерний градиент
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2b3c64');
  sky.addColorStop(0.45, '#4c4c74');
  sky.addColorStop(0.68, '#9a6448');
  sky.addColorStop(0.8, '#e89a58');
  sky.addColorStop(0.86, '#38302a');
  sky.addColorStop(1, '#1d1813');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, rng, W, 300, 90, 0.8);
  // луна
  ctx.fillStyle = '#f2e9d0';
  ctx.beginPath();
  ctx.arc(1290, 170, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(29,39,66,0.9)';
  ctx.beginPath();
  ctx.arc(1308, 158, 40, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, 1290, 170, 90, '#f2e9d0', 0.25);
  clouds(ctx, rng, W, 240, 480, 6, '#c8a084', 0.8);
  birds(ctx, rng, W, 300, 460, 5);
  // дальние высотки
  const horizon = 640;
  let fx = -40;
  while (fx < W + 40) {
    const bw = 90 + rng() * 150, bh = 140 + rng() * 200;
    ctx.fillStyle = 'rgba(24,26,40,0.85)';
    ctx.fillRect(Math.round(fx), horizon - Math.round(bh), Math.round(bw), Math.round(bh));
    // редкие огоньки
    ctx.fillStyle = 'rgba(255,200,120,0.5)';
    for (let i = 0; i < Math.floor(bw * bh / 2600); i++) {
      if (rng() < 0.5) ctx.fillRect(Math.round(fx + 8 + rng() * (bw - 16)), Math.round(horizon - bh + 8 + rng() * (bh - 16)), 3, 4);
    }
    fx += bw + 14 + rng() * 60;
  }
  // дымка над горизонтом
  const haze = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 40);
  haze.addColorStop(0, 'rgba(217,138,78,0)');
  haze.addColorStop(1, 'rgba(217,138,78,0.35)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 60, W, 100);
  // средний ряд: фасады во всю ширину
  const bodies = ['#665244', '#564b52', '#6f5c4a', '#5d4d48', '#525c66', '#695648'];
  let bx = -30;
  let bi = 0;
  while (bx < W + 30) {
    const bw = 220 + rng() * 160, bh = 250 + rng() * 130;
    const shop = rng() < 0.45;
    facade(ctx, rng, bx, horizon + 90, bw, bh + 90, {
      body: bodies[bi % bodies.length],
      shop,
      shopGlow: ['#ffd97a', '#9fd8ff', '#ffb08a'][Math.floor(rng() * 3)],
      litP: 0.56
    });
    // вывеска-табличка
    if (rng() < 0.6) {
      const sw2 = 60 + rng() * 60;
      ctx.fillStyle = '#20242e';
      rr(ctx, bx + 24 + rng() * (bw - sw2 - 48), horizon - bh + 44, sw2, 26, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,130,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,215,130,0.85)';
      const dots = 3 + Math.floor(rng() * 4);
      for (let d = 0; d < dots; d++) ctx.fillRect(bx + 32 + d * 12, horizon - bh + 54, 7, 3);
    }
    bx += bw - 6 + rng() * 20;
    bi++;
  }
  // провода между домами
  for (let wI = 0; wI < 5; wI++) {
    const y = 560 + wI * 26;
    wire(ctx, -10, y + rng() * 10, W + 10, y + rng() * 10, 40 + rng() * 30, 'rgba(8,8,12,0.8)', 2);
  }
  // столбы с фонарями
  [180, 700, 1220].forEach((px) => {
    ctx.fillStyle = '#23262e';
    ctx.fillRect(px, horizon - 40, 10, 250);
    ctx.fillRect(px, horizon - 40, 70, 8);
    glow(ctx, px + 66, horizon - 28, 52, '#ffcf7a', 0.7);
    ctx.fillStyle = '#ffe2a0';
    rr(ctx, px + 56, horizon - 36, 20, 12, 3);
    ctx.fill();
  });
  // земля: асфальт + тротуар
  ctx.fillStyle = '#3e3936';
  ctx.fillRect(0, horizon + 90, W, H - horizon - 90);
  ctx.fillStyle = '#514943';
  ctx.fillRect(0, horizon + 90, W, 26);
  ctx.fillStyle = 'rgba(255,240,210,0.08)';
  ctx.fillRect(0, horizon + 90, W, 3);
  // разметка
  ctx.fillStyle = 'rgba(220,200,150,0.35)';
  for (let lx = 20; lx < W; lx += 120) ctx.fillRect(lx, horizon + 150, 60, 6);
  // трещины
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  for (let cI = 0; cI < 7; cI++) {
    let cx = rng() * W, cy = horizon + 130 + rng() * 160;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) { cx += (rng() - 0.5) * 60; cy += rng() * 24; ctx.lineTo(cx, cy); }
    ctx.stroke();
  }
  vignette(ctx, W, H, 0.34);
}

// ============================================================ КРЫШИ
export function paintKrisha(ctx, rng, W, H) {
  // небо: светлый вечер, большое солнце
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#3d5274');
  sky.addColorStop(0.4, '#6b6b8c');
  sky.addColorStop(0.62, '#d59e6a');
  sky.addColorStop(0.74, '#f0c282');
  sky.addColorStop(0.82, '#463c38');
  sky.addColorStop(1, '#232020');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // солнце с дымкой — справа, в стороне от даунтауна
  glow(ctx, 1340, 540, 260, '#ffe0a0', 0.65);
  ctx.fillStyle = '#ffedd0';
  ctx.beginPath();
  ctx.arc(1340, 540, 52, 0, Math.PI * 2);
  ctx.fill();
  clouds(ctx, rng, W, 180, 520, 8, '#e8c8a8', 0.9);
  birds(ctx, rng, W, 220, 420, 7);
  const horizon = 660;
  // даунтаун в центре
  let tx = 480;
  while (tx < 1150) {
    const bw = 70 + rng() * 110, bh = 180 + rng() * 220;
    const bx = Math.round(tx);
    ctx.fillStyle = 'rgba(38,44,60,0.9)';
    ctx.fillRect(bx, horizon - Math.round(bh), Math.round(bw), Math.round(bh));
    ctx.fillStyle = 'rgba(255,205,130,0.55)';
    for (let i = 0; i < Math.floor(bw * bh / 1500); i++) {
      ctx.fillRect(bx + 6 + Math.floor(rng() * (bw - 12)), horizon - Math.round(bh) + 6 + Math.floor(rng() * (bh - 12)), 4, 5);
    }
    // шпиль
    if (rng() < 0.5) {
      ctx.fillStyle = 'rgba(38,44,60,0.9)';
      ctx.fillRect(bx + Math.floor(bw / 2) - 3, horizon - Math.round(bh) - 46, 6, 46);
      ctx.fillStyle = '#ff5555';
      ctx.fillRect(bx + Math.floor(bw / 2) - 2, horizon - Math.round(bh) - 50, 4, 4);
    }
    tx += bw + 10 + rng() * 40;
  }
  // бока: низкие кварталы
  [[-40, 500], [1140, 1640]].forEach(([sx, ex]) => {
    let qx = sx;
    while (qx < ex) {
      const bw = 120 + rng() * 130, bh = 90 + rng() * 130;
      ctx.fillStyle = 'rgba(44,46,58,0.88)';
      ctx.fillRect(Math.round(qx), horizon - Math.round(bh), Math.round(bw), Math.round(bh));
      qx += bw + 12 + rng() * 40;
    }
  });
  // море крыш: 2 яруса
  const roofBodies = ['#5a5860', '#62544a', '#505c66', '#665650'];
  // дальний ярус
  let rx = -50;
  let ri = 0;
  while (rx < W + 50) {
    const bw = 200 + rng() * 170, bh = 120 + rng() * 90;
    const bx = Math.round(rx);
    ctx.fillStyle = 'rgba(30,32,42,0.9)';
    ctx.fillRect(bx, horizon - 30, Math.round(bw), 120);
    // парапет
    ctx.fillStyle = roofBodies[ri % roofBodies.length];
    ctx.fillRect(bx, horizon - Math.round(bh), Math.round(bw), Math.round(bh));
    ctx.fillStyle = 'rgba(255,235,200,0.10)';
    ctx.fillRect(bx, horizon - Math.round(bh), Math.round(bw), 3);
    // будка/надстройка
    if (rng() < 0.65) {
      const ew = 50 + rng() * 60;
      ctx.fillStyle = shade(roofBodies[ri % roofBodies.length], -22);
      ctx.fillRect(bx + 20 + Math.floor(rng() * (bw - ew - 40)), horizon - Math.round(bh) - 44, Math.round(ew), 44);
    }
    // окна-бойницы с огоньками
    ctx.fillStyle = 'rgba(255,200,120,0.5)';
    for (let i = 0; i < Math.floor(bw / 26); i++) {
      if (rng() < 0.4) ctx.fillRect(bx + 10 + i * 26, horizon - Math.round(bh) + 18 + Math.floor(rng() * (bh - 40)), 8, 10);
    }
    rx += bw + 8 + rng() * 30;
    ri++;
  }
  // ближний ярус: высокие соседние корпуса до самого низа,
  // крыши с водонапорками, антеннами и вентами
  let nx = -60;
  while (nx < W + 60) {
    const bw = 260 + rng() * 200, bh = 200 + rng() * 110;
    const bx = Math.round(nx);
    const col = roofBodies[Math.floor(rng() * roofBodies.length)];
    const topY = horizon + 60 - Math.round(bh);
    ctx.fillStyle = col;
    ctx.fillRect(bx, topY, Math.round(bw), H - topY);
    // фактура-пятна
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let fI = 0; fI < Math.floor(bw / 34); fI++) {
      ctx.fillRect(bx + Math.floor(rng() * bw), topY + Math.floor(rng() * (H - topY)), 3 + Math.floor(rng() * 9), 2);
    }
    ctx.fillStyle = 'rgba(255,235,200,0.12)';
    ctx.fillRect(bx, topY, Math.round(bw), 4);
    ctx.strokeStyle = 'rgba(8,8,12,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, topY + 1, bw - 2, H - topY - 2);
    // парапет-кант
    ctx.fillStyle = shade(col, 22);
    ctx.fillRect(bx - 4, topY - 12, Math.round(bw) + 8, 14);
    // перила на парапете
    ctx.strokeStyle = 'rgba(12,12,16,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 6, topY - 12);
    ctx.lineTo(bx + 6, topY - 34);
    ctx.moveTo(bx + Math.round(bw) - 6, topY - 12);
    ctx.lineTo(bx + Math.round(bw) - 6, topY - 34);
    ctx.moveTo(bx, topY - 34);
    ctx.lineTo(bx + Math.round(bw), topY - 34);
    ctx.stroke();
    // водонапорка
    if (rng() < 0.5) {
      const wx2 = bx + 30 + Math.floor(rng() * (bw - 110));
      const wy2 = topY - 12;
      ctx.strokeStyle = 'rgba(10,10,14,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(wx2 + 8, wy2); ctx.lineTo(wx2 + 2, wy2 - 52);
      ctx.moveTo(wx2 + 52, wy2); ctx.lineTo(wx2 + 58, wy2 - 52);
      ctx.stroke();
      ctx.fillStyle = '#5d4a38';
      rr(ctx, wx2 - 6, wy2 - 108, 72, 58, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(8,8,12,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#3c3227';
      ctx.beginPath();
      ctx.moveTo(wx2 - 6, wy2 - 108);
      ctx.lineTo(wx2 + 30, wy2 - 132);
      ctx.lineTo(wx2 + 66, wy2 - 108);
      ctx.closePath();
      ctx.fill();
    }
    // антенна / вент-труба / световой короб
    if (rng() < 0.75) antenna(ctx, bx + 40 + rng() * (bw - 80), topY - 12, 60 + rng() * 50);
    if (rng() < 0.6) {
      const vx = bx + 60 + Math.floor(rng() * (bw - 120));
      ctx.fillStyle = '#6a6f76';
      ctx.fillRect(vx, topY - 52, 22, 42);
      ctx.fillStyle = '#54585e';
      ctx.fillRect(vx - 3, topY - 58, 28, 8);
    }
    if (rng() < 0.5) {
      const kx = bx + 40 + Math.floor(rng() * (bw - 160));
      ctx.fillStyle = 'rgba(255,190,110,0.8)';
      rr(ctx, kx, topY + 30, 110, 26, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(8,8,12,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,20,26,0.7)';
      for (let sI = 0; sI < 4; sI++) ctx.fillRect(kx + 12 + sI * 24, topY + 38, 12, 4);
    }
    // тёплые окна-иллюминаторы по всей высоте
    windows(ctx, rng, bx + 26, topY + 70, Math.max(2, Math.floor((bw - 52) / 56)), Math.max(2, Math.floor((H - topY - 120) / 58)), 30, 36, 22, 20, { litP: 0.62 });
    nx += bw - 10 + rng() * 40;
  }
  // провода на переднем плане
  for (let wI = 0; wI < 3; wI++) {
    wire(ctx, -10, 700 + wI * 40, W + 10, 690 + wI * 44, 60, 'rgba(8,8,12,0.9)', 3);
  }
  vignette(ctx, W, H, 0.35);
}

// ============================================================ ЗАВОД
export function paintZavod(ctx, rng, W, H) {
  // небо: дымчатое, оранжевое зарево у труб
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2f3a44');
  sky.addColorStop(0.45, '#4c525a');
  sky.addColorStop(0.68, '#8a6a50');
  sky.addColorStop(0.8, '#d08848');
  sky.addColorStop(0.88, '#463528');
  sky.addColorStop(1, '#1c1713');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 1150, 660, 340, '#ff8a3c', 0.5);
  glow(ctx, 400, 680, 220, '#ff9a3c', 0.35);
  stars(ctx, rng, W, 220, 60, 0.6);
  clouds(ctx, rng, W, 200, 420, 5, '#8a8078', 0.9);
  const horizon = 680;
  // дальний план: трубы и градирня
  const stacks = [1020, 1120, 1240, 1330];
  stacks.forEach((sx, i) => {
    const sh = 260 + (i % 2) * 70 + rng() * 40;
    const sw2 = 34 - (i % 2) * 6;
    ctx.fillStyle = 'rgba(30,30,36,0.92)';
    ctx.fillRect(Math.round(sx), horizon - Math.round(sh), Math.round(sw2), Math.round(sh));
    // ободки
    ctx.fillStyle = 'rgba(255,150,80,0.25)';
    for (let b = 1; b <= 3; b++) ctx.fillRect(Math.round(sx), horizon - Math.round(sh) + b * 60, Math.round(sw2), 4);
    // огонёк
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(Math.round(sx + sw2 / 2 - 2), horizon - Math.round(sh) - 8, 4, 4);
    smoke(ctx, rng, sx + sw2 / 2, horizon - sh - 10, 22, 60 + i * 12, '#7d838d');
  });
  // градирня
  const cx0 = 250;
  ctx.fillStyle = 'rgba(34,34,40,0.92)';
  ctx.beginPath();
  ctx.moveTo(cx0, horizon);
  ctx.lineTo(cx0 + 40, horizon - 230);
  ctx.lineTo(cx0 + 160, horizon - 230);
  ctx.lineTo(cx0 + 200, horizon);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,150,80,0.18)';
  ctx.fillRect(cx0 + 36, horizon - 226, 128, 8);
  smoke(ctx, rng, cx0 + 100, horizon - 240, 34, 30, '#8d939d');
  // цеха с шедовыми крышами
  let bx = -40;
  let bi = 0;
  const shopCols = ['#4b4744', '#52463d', '#454b52'];
  while (bx < W + 40) {
    const bw = 260 + rng() * 180, bh = 170 + rng() * 80;
    const col = shopCols[bi % shopCols.length];
    const by = horizon + 30;
    const btop = by - Math.round(bh);
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(bx), btop, Math.round(bw), Math.round(bh));
    // пила-крыша
    ctx.fillStyle = shade(col, -26);
    const teeth = 3 + Math.floor(rng() * 2);
    const tw = bw / teeth;
    ctx.beginPath();
    ctx.moveTo(bx, btop);
    for (let tI = 0; tI < teeth; tI++) {
      ctx.lineTo(bx + tI * tw + tw * 0.55, btop - 44);
      ctx.lineTo(bx + (tI + 1) * tw, btop);
    }
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fill();
    // световые фонари на скатах
    ctx.fillStyle = 'rgba(255,190,110,0.75)';
    for (let tI = 0; tI < teeth; tI++) {
      ctx.fillRect(Math.round(bx + tI * tw + tw * 0.55 - 14), btop - 40, 26, 8);
    }
    // ряд топочных окон
    const wn = Math.floor(bw / 64);
    for (let wI = 0; wI < wn; wI++) {
      const wx2 = Math.round(bx + 20 + wI * 64);
      const wy2 = by - 92;
      ctx.fillStyle = 'rgba(8,8,12,0.9)';
      ctx.fillRect(wx2 - 3, wy2 - 3, 44, 54);
      const hot = rng() < 0.55;
      if (hot) {
        const fg = ctx.createLinearGradient(0, wy2, 0, wy2 + 48);
        fg.addColorStop(0, '#ffcf6a');
        fg.addColorStop(0.6, '#ff8a2a');
        fg.addColorStop(1, '#a83a10');
        ctx.fillStyle = fg;
        glow(ctx, wx2 + 19, wy2 + 24, 44, '#ff8a2a', 0.5);
      } else {
        ctx.fillStyle = 'rgba(16,20,28,0.95)';
      }
      ctx.fillRect(wx2, wy2, 38, 48);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(wx2 + 17, wy2, 4, 48);
    }
    // труба-вентиляция на крыше
    if (rng() < 0.7) {
      const vx = Math.round(bx + 40 + rng() * (bw - 80));
      ctx.fillStyle = '#2c2c32';
      ctx.fillRect(vx, btop - 90, 26, 52);
      ctx.fillStyle = '#1c1c22';
      ctx.fillRect(vx - 4, btop - 96, 34, 8);
      smoke(ctx, rng, vx + 13, btop - 100, 12, 26, '#7d838d');
    }
    bx += bw - 8 + rng() * 30;
    bi++;
  }
  // эстакада с трубами поперёк
  const gy = horizon - 40;
  ctx.fillStyle = 'rgba(20,20,26,0.95)';
  [150, 1450].forEach((px) => {
    ctx.fillRect(px, gy, 22, H - gy);
    ctx.fillRect(px - 14, gy, 50, 12);
  });
  const pipeCols = ['#5a5e66', '#6e5a48', '#4e5a5e'];
  pipeCols.forEach((pc, i) => {
    ctx.fillStyle = pc;
    ctx.fillRect(-10, gy - 34 - i * 22, W + 20, 16);
    ctx.fillStyle = 'rgba(255,235,200,0.12)';
    ctx.fillRect(-10, gy - 34 - i * 22, W + 20, 3);
  });
  // передний план: забор + бочки-силуэты + фонарь
  ctx.fillStyle = '#272320';
  ctx.fillRect(0, horizon + 90, W, H - horizon - 90);
  // сетка-рабица силуэтом
  ctx.strokeStyle = 'rgba(120,124,132,0.5)';
  ctx.lineWidth = 2;
  for (let dx = 0; dx < W; dx += 44) {
    ctx.beginPath();
    ctx.moveTo(dx, horizon + 90);
    ctx.lineTo(dx + 44, horizon + 190);
    ctx.moveTo(dx + 44, horizon + 90);
    ctx.lineTo(dx, horizon + 190);
    ctx.stroke();
  }
  ctx.fillStyle = '#1d1a16';
  ctx.fillRect(0, horizon + 84, W, 10);
  ctx.fillRect(0, horizon + 186, W, 8);
  // бочки
  [300, 380, 1150, 1240].forEach((px, i) => {
    const bw2 = 56, bh2 = 76 + (i % 2) * 10;
    ctx.fillStyle = i % 2 ? '#4e3a28' : '#3a3f46';
    rr(ctx, px, horizon + 200 - bh2, bw2, bh2, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,170,0.15)';
    ctx.fillRect(px + 6, horizon + 200 - bh2 + 4, 5, bh2 - 8);
  });
  // фонарь на столбе
  ctx.fillStyle = '#22242a';
  ctx.fillRect(790, horizon - 60, 12, 260);
  glow(ctx, 796, horizon - 66, 70, '#ffc87a', 0.6);
  ctx.fillStyle = '#ffe0a0';
  rr(ctx, 784, horizon - 78, 24, 14, 3);
  ctx.fill();
  vignette(ctx, W, H, 0.37);
}

// ---------- helpers для руин/пустыни/пещер ----------
