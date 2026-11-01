import { wire, glow, smoke, stars, birds, clouds, vignette, poly, stalac, crystalCluster, dune, boulder, deadBush, rubble, ruin, leanPole, deadTree, mesa } from './util.js';
import { BAND_PALS, bandHouse } from './bands.js';
export function paintPustoch(ctx, rng, W, H) {
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#5c5c66');
  sky.addColorStop(0.42, '#9a8f80');
  sky.addColorStop(0.66, '#c8a878');
  sky.addColorStop(0.78, '#e0bc82');
  sky.addColorStop(0.86, '#4a4038');
  sky.addColorStop(1, '#221d18');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // блеклое солнце в дымке
  glow(ctx, 480, 420, 200, '#f0d8a8', 0.5);
  ctx.fillStyle = '#f4e2b8';
  ctx.beginPath();
  ctx.arc(480, 420, 46, 0, Math.PI * 2);
  ctx.fill();
  clouds(ctx, rng, W, 160, 420, 6, '#c8b898', 0.9);
  birds(ctx, rng, W, 240, 440, 6);
  const horizon = 660;
  // дальний рваный силуэт
  let fx = -50;
  while (fx < W + 50) {
    const bw = 110 + rng() * 170, bh = 120 + rng() * 190;
    ctx.fillStyle = 'rgba(52,48,44,0.85)';
    const bx = Math.round(fx);
    ctx.beginPath();
    ctx.moveTo(bx, horizon);
    ctx.lineTo(bx, horizon - Math.round(bh * 0.5));
    const jag = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < jag; j++) {
      ctx.lineTo(bx + (bw / jag) * (j + 0.5), horizon - Math.round(bh * (0.5 + rng() * 0.5)));
      ctx.lineTo(bx + (bw / jag) * (j + 1), horizon - Math.round(bh * (0.4 + rng() * 0.3)));
    }
    ctx.lineTo(bx + Math.round(bw), horizon);
    ctx.closePath();
    ctx.fill();
    fx += bw + 20 + rng() * 60;
  }
  // пыль над горизонтом
  const haze = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 40);
  haze.addColorStop(0, 'rgba(224,188,130,0)');
  haze.addColorStop(1, 'rgba(224,188,130,0.35)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 50, W, 90);
  // средние руины
  const bodies = ['#6e665c', '#7a6e5e', '#655c52'];
  let bx = -40;
  let bi = 0;
  while (bx < W + 40) {
    const bw = 230 + rng() * 170;
    ruin(ctx, rng, bx, horizon + 60, bw, 250 + rng() * 120, {
      body: bodies[bi % bodies.length], litP: 0.22
    });
    // груды у подножий
    if (rng() < 0.7) rubble(ctx, rng, bx + bw / 2, horizon + 62, 120 + rng() * 80, 40 + rng() * 26);
    bx += bw - 10 + rng() * 30;
    bi++;
  }
  // наклонные столбы + провода
  const pxs = [240, 820, 1360];
  pxs.forEach((px) => leanPole(ctx, px, horizon + 60, 230, (rng() - 0.5) * 60));
  wire(ctx, 240 + 18, horizon - 150, 820 - 12, horizon - 160, 50, 'rgba(10,10,12,0.8)', 2);
  wire(ctx, 820 + 12, horizon - 155, 1360 - 16, horizon - 145, 55, 'rgba(10,10,12,0.8)', 2);
  // мёртвое дерево
  deadTree(ctx, 1080, horizon + 62, 1.1, '#26201a');
  // передний план: земля с обломками
  ctx.fillStyle = '#3a332c';
  ctx.fillRect(0, horizon + 60, W, H - horizon - 60);
  ctx.fillStyle = '#4a4238';
  ctx.fillRect(0, horizon + 60, W, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(Math.floor(rng() * W), horizon + 90 + Math.floor(rng() * (H - horizon - 110)), 2 + Math.floor(rng() * 9), 2 + Math.floor(rng() * 4));
  }
  for (let i = 0; i < 5; i++) rubble(ctx, rng, rng() * W, H - 20 - rng() * 60, 90 + rng() * 70, 30 + rng() * 22);
  vignette(ctx, W, H, 0.38);
}

// ============================================================ ПУСТЫНЯ
export function paintPustinya(ctx, rng, W, H) {
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#3f6a9a');
  sky.addColorStop(0.45, '#9ab0c0');
  sky.addColorStop(0.68, '#e0c48e');
  sky.addColorStop(0.8, '#f0d49a');
  sky.addColorStop(0.88, '#8a7358');
  sky.addColorStop(1, '#4a3d2e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // жаркое солнце высоко
  glow(ctx, 1050, 240, 260, '#fff0c0', 0.6);
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  ctx.arc(1050, 240, 54, 0, Math.PI * 2);
  ctx.fill();
  clouds(ctx, rng, W, 140, 380, 4, '#f0e0c0', 0.7);
  birds(ctx, rng, W, 300, 460, 4);
  // горизонт на 60%: штурмовой зум показывает низ текстуры —
  // интересное (руина, столбы) живёт внизу, а не только песок.
  const horizon = 600;
  // ДАЛЬНИЙ ПЛАН: месы выбелены дымкой (воздушная перспектива)
  mesa(ctx, rng, 80, horizon, 240, 150, 'rgba(150,124,138,0.75)');
  mesa(ctx, rng, 380, horizon, 150, 100, 'rgba(140,116,128,0.75)');
  mesa(ctx, rng, 1060, horizon, 300, 180, 'rgba(150,124,138,0.75)');
  mesa(ctx, rng, 1380, horizon, 130, 90, 'rgba(140,116,128,0.75)');
  // бледная гряда у самого горизонта
  ctx.fillStyle = 'rgba(216,189,146,0.85)';
  ctx.beginPath();
  ctx.moveTo(-10, horizon + 26);
  for (let x = -10; x <= W + 10; x += 20) {
    ctx.lineTo(x, horizon + 8 + Math.sin(x * 0.011 + 2.2) * 12);
  }
  ctx.lineTo(W + 10, horizon + 26);
  ctx.closePath();
  ctx.fill();
  // крошечные дальние силуэты (развалины у горизонта)
  [[500, 44], [760, 60], [940, 38]].forEach(([sx, sw2]) => {
    const sh2 = 22 + rng() * 18;
    ctx.fillStyle = 'rgba(176,154,124,0.9)';
    ctx.fillRect(Math.round(sx), Math.round(horizon + 8 - sh2), Math.round(sw2), Math.round(sh2));
    ctx.fillStyle = 'rgba(74,58,40,0.9)';
    for (let bI = 0; bI < 3; bI++) ctx.fillRect(Math.round(sx + 6 + bI * (sw2 / 3)), Math.round(horizon - 2 - sh2), 5, 12);
  });
  // дымка
  const haze = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 30);
  haze.addColorStop(0, 'rgba(240,212,154,0)');
  haze.addColorStop(1, 'rgba(240,212,154,0.4)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 60, W, 90);
  // дюны: дальняя светлая, ближняя тёмная — на ней стоит развалина
  dune(ctx, W, H, horizon + 80, 20, '#b08a58', 'rgba(255,235,200,0.35)', 1.2);
  dune(ctx, W, H, horizon + 330, 30, '#c8a068', 'rgba(255,240,210,0.4)', 4.1);
  // скалы и кусты у ближней гряды
  [[300, 30], [760, 38], [1180, 32], [1420, 40]].forEach(([rx, rs]) => {
    boulder(ctx, rng, rx, horizon + 330, rs, '#7a6a58');
  });
  for (let i = 0; i < 8; i++) {
    deadBush(ctx, rng, rng() * W, horizon + 300 + rng() * 50, 10 + rng() * 10, '#5d4c34');
  }
  // белёная глинобитная развалина — низко, в полосе штурмового зума
  ctx.save();
  ctx.translate(620, horizon + 350);
  ctx.scale(0.7, 0.7);
  {
    const ax = 0, ay = 0;
    ctx.fillStyle = '#cfc2ae';
    poly(ctx, [[ax, ay], [ax, ay - 130], [ax + 150, ay - 150], [ax + 230, ay - 110], [ax + 230, ay]], '#cfc2ae');
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(ax + 60, ay - 100, 40, 100);
    ctx.fillStyle = '#4a3a28';
    for (let bI = 0; bI < 4; bI++) ctx.fillRect(ax - 12 + bI * 62, ay - 128 - (bI % 2) * 8, 10, 26);
    ctx.strokeStyle = 'rgba(8,8,12,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ax, ay - 150, 230, 150);
  }
  ctx.restore();
  // покосившиеся столбы — от низа кадра вверх (видны и в штурмовой полосе)
  // первый стоит у спавна, чтобы левый край не пустовал
  const posts = [300, 700, 1050, 1400];
  posts.forEach((px, i) => {
    const lean = (i % 2 ? -1 : 1) * (10 + rng() * 16);
    ctx.strokeStyle = '#3a2e22';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(px, horizon + 360);
    ctx.lineTo(px + lean, horizon + 140);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px + lean - 26, horizon + 162);
    ctx.lineTo(px + lean + 26, horizon + 156);
    ctx.stroke();
  });
  for (let i = 0; i < posts.length - 1; i++) {
    wire(ctx, posts[i] + 16, horizon + 160, posts[i + 1] - 16, horizon + 156, 40, 'rgba(20,16,12,0.8)', 2);
  }
  // низ: тёмная земля у самых ног (дальше — уже игровая земля)
  ctx.fillStyle = '#6e5638';
  ctx.fillRect(0, horizon + 350, W, H - horizon - 350);
  ctx.fillStyle = 'rgba(255,235,200,0.12)';
  ctx.fillRect(0, horizon + 350, W, 4);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(240,220,180,0.3)';
    ctx.fillRect(Math.floor(rng() * W), horizon + 360 + Math.floor(rng() * (H - horizon - 370)), 2 + Math.floor(rng() * 6), 2 + Math.floor(rng() * 3));
  }
  ctx.strokeStyle = 'rgba(120,100,60,0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const gx = rng() * W, gy = horizon + 365 + rng() * 30;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + 4, gy - 12, gx + (rng() - 0.5) * 18, gy - 16 - rng() * 10);
    ctx.stroke();
  }
  vignette(ctx, W, H, 0.34);
}

// ============================================================ ПЕЩЕРА (зелёная)
export function paintPechera(ctx, rng, W, H) {
  // скальный мрак с зелёным подтоном
  let bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07090c');
  bg.addColorStop(0.5, '#0e1412');
  bg.addColorStop(1, '#131a15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // трещина со светом сверху
  const cx = 760;
  poly(ctx, [[cx - 26, 0], [cx + 26, 0], [cx + 120, H], [cx - 120, H]], 'rgba(190,255,215,0.10)');
  poly(ctx, [[cx - 10, 0], [cx + 10, 0], [cx + 52, H], [cx - 52, H]], 'rgba(200,255,220,0.10)');
  glow(ctx, cx, 120, 150, '#c8ffd8', 0.35);
  // боковые стены
  poly(ctx, [[0, 0], [190, 0], [120, 300], [170, 550], [90, 800], [140, H], [0, H]], '#16181d');
  poly(ctx, [[W, 0], [W - 210, 0], [W - 130, 320], [W - 180, 580], [W - 100, 820], [W - 150, H], [W, H]], '#14161b');
  // слои-страты на стенах
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const y = 120 + i * 100 + rng() * 30;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(90, y + 20, 170, y - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W, y + 40);
    ctx.quadraticCurveTo(W - 90, y + 60, W - 170, y + 30);
    ctx.stroke();
  }
  // сталактиты сверху + сталагмиты снизу
  stalac(ctx, rng, 180, W - 180, 0, 90, 260, '#1e2126', false);
  stalac(ctx, rng, 60, 420, H, 70, 190, '#1e2126', true);
  stalac(ctx, rng, 1180, W - 40, H, 70, 190, '#1e2126', true);
  // валуны
  boulder(ctx, rng, 330, 880, 70, '#20242a');
  boulder(ctx, rng, 1290, 900, 84, '#1e2228');
  boulder(ctx, rng, 760, 940, 60, '#22262c');
  // зелёные кристаллы
  crystalCluster(ctx, rng, 520, 900, 1.15, '#7dffb0', '#1a5a3a', '#54ff9a');
  crystalCluster(ctx, rng, 1050, 915, 0.9, '#7dffb0', '#1a5a3a', '#54ff9a');
  crystalCluster(ctx, rng, 1330, 880, 0.6, '#a8ffc8', '#1a5a3a', '#54ff9a');
  crystalCluster(ctx, rng, 190, 905, 0.55, '#7dffb0', '#1a5a3a', '#54ff9a');
  // подземное озерцо с отражениями
  ctx.fillStyle = '#0d1a16';
  ctx.beginPath();
  ctx.ellipse(800, 955, 260, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 3 ? '#54ff9a' : '#c8ffd8';
    const rx = 600 + rng() * 400;
    ctx.fillRect(Math.round(rx), 946 + Math.floor(rng() * 18), 3 + Math.floor(rng() * 14), 2);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(125,255,176,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(800, 955, 260, 34, 0, 0, Math.PI * 2);
  ctx.stroke();
  // светляки-споры
  ctx.save();
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.3 + rng() * 0.6;
    ctx.fillStyle = '#8affb8';
    ctx.fillRect(Math.floor(rng() * W), Math.floor(rng() * H), 2, 2);
  }
  ctx.restore();
  vignette(ctx, W, H, 0.55);
}

// ============================================================ ПЕЩЕРА 2 (синяя, с рекой)
export function paintPeshara(ctx, rng, W, H) {
  // холодный мрак
  let bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#06080e');
  bg.addColorStop(0.5, '#0c121c');
  bg.addColorStop(1, '#0e1620');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // свет слева сверху
  const cx = 420;
  poly(ctx, [[cx - 20, 0], [cx + 30, 0], [cx + 170, H], [cx + 40, H]], 'rgba(170,200,255,0.10)');
  poly(ctx, [[cx - 8, 0], [cx + 12, 0], [cx + 80, H], [cx + 10, H]], 'rgba(180,210,255,0.10)');
  glow(ctx, cx, 100, 140, '#b8ccff', 0.35);
  // стены
  poly(ctx, [[0, 0], [150, 0], [90, 340], [150, 620], [70, 860], [120, H], [0, H]], '#151923');
  poly(ctx, [[W, 0], [W - 170, 0], [W - 100, 300], [W - 160, 560], [W - 80, 800], [W - 130, H], [W, H]], '#131722');
  // мокрые потёки на стенах
  ctx.strokeStyle = 'rgba(160,190,255,0.14)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 10; i++) {
    const wx = (i < 5 ? rng() * 150 : W - rng() * 160);
    const wy = rng() * 500;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + (rng() - 0.5) * 20, wy + 120 + rng() * 160);
    ctx.stroke();
  }
  // частые тонкие сталактиты
  stalac(ctx, rng, 140, W - 140, 0, 120, 300, '#1b2130', false);
  stalac(ctx, rng, 40, 360, H, 60, 150, '#1b2130', true);
  // водопад trickle слева
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#9fc0e8';
  for (let sI = 0; sI < 4; sI++) {
    const wx = 150 + sI * 14 + rng() * 6;
    ctx.fillRect(wx, 300 + rng() * 60, 4, 320);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(220,235,255,0.5)';
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(140 + Math.floor(rng() * 70), 610 + Math.floor(rng() * 30), 3, 3);
  }
  // синие кристаллы
  crystalCluster(ctx, rng, 700, 700, 0.8, '#8fb8ff', '#1a3a6a', '#5a94ff');
  crystalCluster(ctx, rng, 1150, 660, 1.0, '#8fb8ff', '#1a3a6a', '#5a94ff');
  crystalCluster(ctx, rng, 250, 680, 0.55, '#b8d0ff', '#1a3a6a', '#5a94ff');
  // подземная река
  const ry = 830;
  let rg = ctx.createLinearGradient(0, ry - 40, 0, H);
  rg.addColorStop(0, '#14202e');
  rg.addColorStop(0.35, '#0e1826');
  rg.addColorStop(1, '#080d14');
  ctx.fillStyle = rg;
  ctx.fillRect(0, ry - 40, W, H - ry + 40);
  // блики и отражения кристаллов
  ctx.save();
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.25 + rng() * 0.45;
    ctx.fillStyle = rng() < 0.6 ? '#5a94ff' : '#c8dcff';
    ctx.fillRect(Math.floor(rng() * W), ry - 20 + Math.floor(rng() * 130), 4 + Math.floor(rng() * 26), 2);
  }
  ctx.restore();
  // туман над рекой
  clouds(ctx, rng, W, ry - 90, ry - 20, 7, '#9fb8d8', 0.8);
  ctx.strokeStyle = 'rgba(140,175,230,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ry - 40);
  ctx.lineTo(W, ry - 40);
  ctx.stroke();
  // валуны у воды
  boulder(ctx, rng, 480, ry + 60, 56, '#1c222e');
  boulder(ctx, rng, 1420, ry + 80, 66, '#1a202c');
  vignette(ctx, W, H, 0.55);
}

// ============================================================ ПУСТОШЬ
// Чистая даль: небо, горы, одна развалина, земля. Без каши слоёв.
export function paintWasteland(ctx, rng, W, H) {
  // Мутное пепельное небо без чёткого солнца: сверху пыль, у горизонта
  // грязно-жёлтая полоса смога. Никаких чистых цветов (ТЗ пустоши).
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#565449');
  sky.addColorStop(0.35, '#7d7660');
  sky.addColorStop(0.55, '#a89061');
  sky.addColorStop(0.68, '#776e55');
  sky.addColorStop(0.8, '#33352a');
  sky.addColorStop(1, '#171810');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // мутное свечение неба вместо солнца: пятна без чёткого края
  // (x джиттерим — панорама двойная, половины не должны совпадать)
  const glowX = 920 + Math.floor(rng() * 400);
  glow(ctx, glowX, 430, 260, '#d8c890', 0.32);
  glow(ctx, glowX, 640, 340, '#a88f5e', 0.22);
  clouds(ctx, rng, W, 140, 340, 4, '#98907a', 0.5);
  const horizon = 600;
  // ДАЛЬНИЙ ПЛАН (ТЗ пустоши): мёртвый город в дымке, два ряда.
  // Задний ряд — broken небоскрёбы: выше, бледнее, почти без деталей.
  const rim = 'rgba(224,208,164,0.35)';
  const deadTower = (x, base, w, h, col, detail) => {
    const teeth = 3 + Math.floor(rng() * 3);
    const tops = [];
    for (let i = 0; i <= teeth; i++) {
      tops.push([x + (w / teeth) * i, base - h + Math.round(rng() * h * 0.25)]);
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, tops[0][1]);
    for (let i = 1; i <= teeth; i++) ctx.lineTo(tops[i][0], tops[i][1]);
    ctx.lineTo(x + w, base);
    ctx.closePath();
    ctx.fill();
    // контровой свет: бледная кромка по рваному верху
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, tops[0][1]);
    for (let i = 1; i <= teeth; i++) ctx.lineTo(tops[i][0], tops[i][1]);
    ctx.stroke();
    if (detail) {
      // редкие тёмные глазницы + трещина
      ctx.fillStyle = 'rgba(18,20,14,0.7)';
      const n = Math.max(1, Math.floor(w / 34));
      for (let i = 0; i < n; i++) {
        const wx = x + 12 + i * ((w - 24) / Math.max(1, n - 1 || 1));
        const wy = base - h * 0.55 + (i % 2) * 26;
        if (wy > base - 14) continue;
        ctx.fillRect(Math.round(wx), Math.round(wy), 10, 14);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      let cx = x + w * 0.5, cy = base - h * 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      while (cy < base - 12) {
        cx += (rng() - 0.5) * 16;
        cy += 14 + rng() * 14;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  };
  // задний ряд: 5 сломанных высоток, ноги у горизонта+18
  {
    let zx = 40 + rng() * 60;
    while (zx < W - 120) {
      const zw = 90 + rng() * 70, zh = 150 + rng() * 110;
      deadTower(Math.round(zx), horizon + 18, Math.round(zw), Math.round(zh), 'rgba(122,118,94,0.55)', false);
      zx += zw + 50 + rng() * 120;
    }
  }
  // дымка между рядами — дальний тонет в пыли
  const hazeFar = ctx.createLinearGradient(0, horizon - 260, 0, horizon + 40);
  hazeFar.addColorStop(0, 'rgba(200,190,150,0)');
  hazeFar.addColorStop(1, 'rgba(200,190,150,0.35)');
  ctx.fillStyle = hazeFar;
  ctx.fillRect(0, horizon - 260, W, 300);
  // передний ряд дали: корпуса пониже + завод с трубами + кран. Читаются
  // детали, но цвета приглушены.
  {
    let zx = 120 + rng() * 80;
    while (zx < W - 160) {
      const zw = 110 + rng() * 90, zh = 80 + rng() * 70;
      deadTower(Math.round(zx), horizon + 34, Math.round(zw), Math.round(zh), 'rgba(94,92,70,0.8)', true);
      zx += zw + 90 + rng() * 140;
    }
    // завод: низкий цех + две трубы + бак
    const fx = 560 + Math.floor(rng() * 120), fb = horizon + 34;
    ctx.fillStyle = 'rgba(88,86,64,0.85)';
    ctx.fillRect(fx, fb - 70, 190, 70);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fb - 70);
    ctx.lineTo(fx + 190, fb - 70);
    ctx.stroke();
    ctx.fillStyle = 'rgba(80,78,58,0.9)';
    ctx.fillRect(fx + 24, fb - 150, 22, 84);
    ctx.fillRect(fx + 62, fb - 128, 18, 62);
    ctx.fillStyle = 'rgba(30,30,24,0.9)';
    ctx.beginPath();
    ctx.ellipse(fx + 35, fb - 152, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fx + 71, fb - 130, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // бак-цистерна рядом
    ctx.fillStyle = 'rgba(96,88,64,0.85)';
    ctx.fillRect(fx + 210, fb - 52, 64, 52);
    ctx.beginPath();
    ctx.ellipse(fx + 242, fb - 52, 32, 9, 0, Math.PI, 0);
    ctx.fill();
    // покосившийся кран: ноги, стрела, противовес, висящий трос с крюком
    const kx = 1080 + Math.floor(rng() * 80), kb = horizon + 34;
    ctx.strokeStyle = 'rgba(70,68,52,0.9)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(kx, kb);
    ctx.lineTo(kx + 14, kb - 170);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(kx + 44, kb);
    ctx.lineTo(kx + 14, kb - 170);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(kx - 90, kb - 148);
    ctx.lineTo(kx + 120, kb - 186);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,68,52,0.9)';
    ctx.fillRect(kx - 104, kb - 162, 26, 22);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(kx + 84, kb - 180);
    ctx.lineTo(kx + 84, kb - 118);
    ctx.stroke();
    ctx.fillRect(kx + 79, kb - 118, 10, 8);
    // дым из труб — воздух густой, город ещё тлеет
    smoke(ctx, rng, fx + 35, fb - 160, 12, 26, '#8a8474');
    smoke(ctx, rng, fx + 71, fb - 138, 9, 20, '#847e6e');
  }
  // светлая гряда у горизонта
  ctx.fillStyle = 'rgba(150,148,116,0.85)';
  ctx.beginPath();
  ctx.moveTo(-10, horizon + 24);
  for (let x = -10; x <= W + 10; x += 20) {
    ctx.lineTo(x, horizon + 8 + Math.sin(x * 0.011 + 2.2) * 10);
  }
  ctx.lineTo(W + 10, horizon + 24);
  ctx.closePath();
  ctx.fill();
  // дымка
  const haze = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 40);
  haze.addColorStop(0, 'rgba(200,190,150,0)');
  haze.addColorStop(1, 'rgba(200,190,150,0.4)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 50, W, 90);
  // ОДНА дальняя развалина — тихий акцент, не кричит.
  // Низ притоплен в землю на 20px + тень, иначе visibly парит.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(640, horizon + 108, 90, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(80 + Math.floor(rng() * 300), horizon + 110);
  ctx.scale(0.55, 0.55);
  ctx.fillStyle = '#7a7a66';
  ctx.beginPath();
  ctx.moveTo(-110, 0);
  ctx.lineTo(-110, -120);
  ctx.lineTo(-30, -140);
  ctx.lineTo(30, -110);
  ctx.lineTo(110, -120);
  ctx.lineTo(110, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(20,22,16,0.85)';
  for (let bI = 0; bI < 3; bI++) ctx.fillRect(-88 + bI * 66, -96, 14, 30);
  ctx.strokeStyle = 'rgba(8,8,12,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-110, -140, 220, 140);
  ctx.restore();
  // второй тихий акцент справа: низкая развалина + пара сухих столбов.
  // Мелко и бледно — даль, не второй герой.
  ctx.save();
  ctx.translate(1300 + Math.floor(rng() * 200), horizon + 96);
  ctx.scale(0.32, 0.32);
  ctx.fillStyle = '#75735f';
  ctx.beginPath();
  ctx.moveTo(-100, 0);
  ctx.lineTo(-100, -90);
  ctx.lineTo(-20, -110);
  ctx.lineTo(60, -80);
  ctx.lineTo(100, -90);
  ctx.lineTo(100, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(20,22,16,0.85)';
  ctx.fillRect(-70, -70, 12, 26);
  ctx.fillRect(-6, -78, 12, 26);
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,42,32,0.9)';
  ctx.lineWidth = 4;
  [[150 + Math.floor(rng() * 200), 690], [1250 + Math.floor(rng() * 200), 688]].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 8, py - 130);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px - 14, py - 108);
    ctx.lineTo(px + 28, py - 112);
    ctx.stroke();
    ctx.lineWidth = 4;
  });
  // земля: спокойный градиент + корка
  const gy = horizon + 90;
  let gg = ctx.createLinearGradient(0, gy, 0, H);
  gg.addColorStop(0, '#3a3b24');
  gg.addColorStop(0.4, '#2b2c1f');
  gg.addColorStop(1, '#17180f');
  ctx.fillStyle = gg;
  ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = '#45462b';
  ctx.fillRect(0, gy, W, 12);
  ctx.fillStyle = 'rgba(255,250,220,0.1)';
  ctx.fillRect(0, gy, W, 3);
  // мягкая дюна-волна
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(W * 0.3, gy + 150, 320, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(210,205,170,0.07)';
  ctx.beginPath();
  ctx.ellipse(W * 0.72, gy + 200, 260, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // зерно
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.28)' : 'rgba(200,195,160,0.15)';
    ctx.fillRect(Math.floor(rng() * W), gy + 30 + Math.floor(rng() * (H - gy - 50)), 2 + Math.floor(rng() * 6), 2 + Math.floor(rng() * 3));
  }
  // редкие травинки
  ctx.strokeStyle = 'rgba(96,94,66,0.65)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const tx = rng() * W, ty = gy + 60 + rng() * (H - gy - 100);
    for (let b = 0; b < 3; b++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(a) * 5, ty + Math.sin(a) * 5);
      ctx.stroke();
    }
  }
  // жухлые кусты: природа отвоёвывает город, но всё выгорело и в пыли
  for (let i = 0; i < 4; i++) {
    const bx = 100 + rng() * (W - 200), by = gy + 90 + rng() * (H - gy - 130);
    const bs = 10 + rng() * 14;
    ctx.strokeStyle = 'rgba(88,80,58,0.8)';
    ctx.lineWidth = 2;
    for (let b = 0; b < 7; b++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 2.2;
      const bl = bs * (0.5 + rng() * 0.7);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + Math.cos(a) * bl * 0.5, by + Math.sin(a) * bl * 0.6,
        bx + Math.cos(a) * bl, by + Math.sin(a) * bl);
      ctx.stroke();
    }
    // сухие листья-комочки
    ctx.fillStyle = 'rgba(112,96,58,0.55)';
    for (let b = 0; b < 8; b++) {
      ctx.fillRect(Math.round(bx + (rng() - 0.5) * bs * 2), Math.round(by - rng() * bs), 3, 2);
    }
  }
  // пепельные проплешины
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(150,146,124,0.1)';
    ctx.beginPath();
    ctx.ellipse(rng() * W, gy + 80 + rng() * (H - gy - 120), 60 + rng() * 90, 8 + rng() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  vignette(ctx, W, H, 0.4);
}

// Ночь и закат: своих художников не было — только плоская заливка + полосы.
// Минимум по эталону: небо, светило в дымке, дальний ряд силуэтов, земля.
export function paintNight(ctx, rng, W, H) {
  const horizon = 600;
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05060f');
  sky.addColorStop(0.4, '#0d1024');
  sky.addColorStop(0.55, '#1c1a34');
  sky.addColorStop(0.62, '#3a2a3a');
  sky.addColorStop(0.7, '#14141c');
  sky.addColorStop(1, '#08080e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, rng, W, 420, 130, 1);
  // луна в дымке
  glow(ctx, 1180, 240, 150, '#cfd8ee', 0.5);
  ctx.fillStyle = '#e2e8f4';
  ctx.beginPath();
  ctx.arc(1180, 240, 34, 0, Math.PI * 2);
  ctx.fill();
  clouds(ctx, rng, W, 120, 300, 4, '#232742', 0.6);
  // дальний ряд: спящий город, редкие огни
  ctx.save();
  try { ctx.globalAlpha = 0.75; } catch (e) {}
  let zx = 20 + rng() * 60;
  const pal = BAND_PALS.night;
  while (zx < W - 120) {
    const zw = 110 + rng() * 130, zh = 130 + rng() * 130;
    bandHouse(ctx, rng, Math.round(zx), horizon + 24, Math.round(zw), Math.round(zh), pal);
    zx += zw + 60 + rng() * 150;
  }
  try { ctx.restore(); } catch (e) {}
  const hz = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 50);
  hz.addColorStop(0, 'rgba(40,36,60,0)');
  hz.addColorStop(1, 'rgba(40,36,60,0.5)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, horizon - 40, W, 90);
  // земля: темно + зерно
  const gg = ctx.createLinearGradient(0, horizon + 40, 0, H);
  gg.addColorStop(0, '#101018');
  gg.addColorStop(1, '#050508');
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizon + 40, W, H - horizon - 40);
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(140,150,200,0.08)';
    ctx.fillRect(Math.floor(rng() * W), horizon + 60 + Math.floor(rng() * (H - horizon - 80)), 2 + Math.floor(rng() * 4), 2);
  }
  vignette(ctx, W, H, 0.5);
}

export function paintSunset(ctx, rng, W, H) {
  const horizon = 600;
  let sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a1030');
  sky.addColorStop(0.35, '#3c1c40');
  sky.addColorStop(0.5, '#8a3a44');
  sky.addColorStop(0.58, '#d87a4a');
  sky.addColorStop(0.66, '#4a2c34');
  sky.addColorStop(0.8, '#1c1418');
  sky.addColorStop(1, '#0c0a0c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, rng, W, 220, 60, 0.7);
  // низкое солнце в дымке
  glow(ctx, 700, 560, 220, '#ffb46b', 0.6);
  glow(ctx, 700, 560, 120, '#ffd890', 0.6);
  ctx.fillStyle = '#ffcf8a';
  ctx.beginPath();
  ctx.arc(700, 560, 42, 0, Math.PI * 2);
  ctx.fill();
  clouds(ctx, rng, W, 140, 320, 5, '#5a2c44', 0.65);
  // дальний ряд: контровый город, почти без огней
  const pal = { arch: 'city', wall: '#241a26', roof: '#160f18', win: '#ffb46b', litP: 0.15 };
  ctx.save();
  try { ctx.globalAlpha = 0.85; } catch (e) {}
  let zx = 20 + rng() * 60;
  while (zx < W - 120) {
    const zw = 120 + rng() * 140, zh = 140 + rng() * 140;
    bandHouse(ctx, rng, Math.round(zx), horizon + 24, Math.round(zw), Math.round(zh), pal);
    zx += zw + 60 + rng() * 150;
  }
  try { ctx.restore(); } catch (e) {}
  const hz = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 50);
  hz.addColorStop(0, 'rgba(120,60,60,0)');
  hz.addColorStop(1, 'rgba(120,60,60,0.35)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, horizon - 40, W, 90);
  const gg = ctx.createLinearGradient(0, horizon + 40, 0, H);
  gg.addColorStop(0, '#1c1216');
  gg.addColorStop(1, '#0a080a');
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizon + 40, W, H - horizon - 40);
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(220,150,120,0.07)';
    ctx.fillRect(Math.floor(rng() * W), horizon + 60 + Math.floor(rng() * (H - horizon - 80)), 2 + Math.floor(rng() * 4), 2);
  }
  vignette(ctx, W, H, 0.45);
}

// ============================================================ полосы параллакса
// Чёткие рисованные силуэты домов вместо фото-полос из assets/buildings.
// Печём в статические canvas-текстуры bgc_<тема>_far|near (3200px, тайлятся;
// период превышает вьюпорт — повторов в кадре нет).
// Детерминировано (seed от темы+слоя). Нет темы — null (сцена берёт PNG).
