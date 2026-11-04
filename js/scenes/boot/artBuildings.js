
import { drawSandbags } from './artSandbags.js';

export function generateMapBuilding(key) {
    const SIZES = {
      map_garage: [240, 180], map_apteka: [230, 190], map_shop: [220, 180],
      map_zdanie: [240, 200], map_kino: [250, 190], map_pochta: [230, 190],
      map_stol: [240, 180], map_sarai: [220, 160], map_derevdom: [200, 160],
      map_bigdom: [260, 220], map_mini_dom: [200, 170], map_domik2: [210, 170],
      map_domik: [210, 170], map_ruin: [260, 220], map_scrap: [200, 140],
      map_ruin2: [220, 240], map_wreck: [200, 120], map_ruin3: [260, 180],
      map_ruin4: [260, 220], map_ruin5: [200, 240], map_ruin6: [280, 180],
      map_ruin7: [260, 140], map_tank: [240, 150], map_tower: [200, 230],
      map_bags: [240, 120]
    };
    const sz = SIZES[key];
    if (!sz) return false;
    if (this.textures.exists(key)) return true;
    const W = sz[0], H = sz[1];
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    let seed = 7;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    const edge = 'rgba(8,8,12,0.7)';
    if (key === 'map_bags') {
      drawSandbags(ctx, W, H, rnd);
      // refresh() обязателен: без него WebGL может загрузить пустой канвас.
      try { ct.refresh(); } catch (e) {}
      return this.textures.exists(key);
    }

    // Архитектурная фасадная панель / фриз (вместо текстовых вывесок).
    const fascia = (x, y, w, h, bgCol, accentCol) => {
      ctx.fillStyle = bgCol || '#2a2f38';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 3);
      else ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 2, y + 2, w - 4, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 2, y + h - 4, w - 4, 2);
      if (accentCol) {
        ctx.fillStyle = accentCol;
        ctx.fillRect(x + 8, y + Math.floor(h / 2) - 1, w - 16, 3);
      }
    };
    // Козырёк над дверью / входом.
    const canopy = (x, y, w) => {
      ctx.fillStyle = '#2c3036';
      ctx.fillRect(x - 5, y - 5, w + 10, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - 5, y - 5, w + 10, 1.5);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 5, y - 5, w + 10, 6);
      ctx.strokeStyle = '#181a1e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 1);
      ctx.lineTo(x + 4, y + 8);
      ctx.moveTo(x + w + 2, y - 1);
      ctx.lineTo(x + w - 4, y + 8);
      ctx.stroke();
    };
    // Блок кондиционера на фасаде.
    const acUnit = (x, y) => {
      ctx.fillStyle = '#cfd3d8';
      ctx.fillRect(x, y, 22, 15);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, 22, 15);
      ctx.fillStyle = '#22262c';
      ctx.beginPath();
      ctx.arc(x + 7, y + 7.5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#858d96';
      ctx.fillRect(x + 15, y + 4, 4, 7);
      ctx.strokeStyle = '#4a5058';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 15);
      ctx.lineTo(x + 20, y + 23);
      ctx.stroke();
    };
    // Ряд окон с переплётом, подоконным отливом и сандриком.
    const winRow = (x, y, n, cw, ch, gap, litCol) => {
      for (let i = 0; i < n; i++) {
        const wx = x + i * (cw + gap);
        ctx.fillStyle = edge;
        ctx.fillRect(wx - 2, y - 2, cw + 4, ch + 4);
        if (rnd() < 0.5) {
          ctx.fillStyle = litCol || '#ffd97a';
          ctx.fillRect(wx, y, cw, ch);
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(wx + cw / 2 - 1, y, 2, ch);
          ctx.fillRect(wx, y + Math.floor(ch * 0.38), cw, 2);
        } else {
          ctx.fillStyle = 'rgba(12,16,26,0.92)';
          ctx.fillRect(wx, y, cw, ch);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(wx + cw / 2 - 1, y, 1, ch);
          ctx.fillRect(wx, y + Math.floor(ch * 0.38), cw, 1);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(wx - 3, y + ch + 1, cw + 6, 3);
        ctx.fillStyle = 'rgba(255,240,210,0.15)';
        ctx.fillRect(wx - 3, y + ch, cw + 6, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(wx - 2, y - 3, cw + 4, 1);
      }
    };
    // Дверь с филёнками, ручкой и порожком.
    const door = (x, y, w, h) => {
      ctx.fillStyle = '#2c2119';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      // филёнки
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 5, y + 6, w - 10, Math.floor((h - 12) / 2));
      ctx.strokeRect(x + 5, y + 6 + Math.floor((h - 12) / 2), w - 10, Math.floor((h - 12) / 2));
      // ручка + блик
      ctx.fillStyle = '#c8a83a';
      ctx.fillRect(x + w - 9, y + Math.floor(h / 2), 4, 10);
      ctx.fillStyle = 'rgba(255,220,150,0.3)';
      ctx.fillRect(x + w - 8, y + 8, 3, 16);
      // порожек
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x - 3, y + h - 2, w + 6, 5);
    };
    // Витрина (светлая, с полками).
    const shopWin = (x, y, w, h, glowCol) => {
      ctx.fillStyle = edge;
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      const g2 = ctx.createLinearGradient(0, y, 0, y + h);
      g2.addColorStop(0, glowCol || '#ffd97a');
      g2.addColorStop(1, '#8a6a3a');
      ctx.fillStyle = g2;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(20,20,28,0.55)';
      for (let sI = 0; sI < 3; sI++) ctx.fillRect(x + 6, y + 10 + sI * Math.floor((h - 16) / 3), w - 12, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + h - 6);
      ctx.lineTo(x + w - 30, y + 6);
      ctx.stroke();
    };
    // Козырёк в полоску.
    const awning = (x, y, w, c1, c2) => {
      const sw = 18;
      for (let i = 0; i * sw < w; i++) {
        ctx.fillStyle = i % 2 ? c1 : c2;
        ctx.fillRect(x + i * sw, y, Math.min(sw, w - i * sw), 14);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y, w, 3);
    };
    // Корпус + карниз + цоколь.
    const body = (x, y, w, h, col, parapet) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + w - 10, y, 10, h);
      ctx.fillStyle = 'rgba(255,240,210,0.10)';
      ctx.fillRect(x, y, 3, h);
      if (parapet) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x - 4, y - 10, w + 8, 12);
        ctx.fillStyle = 'rgba(255,240,210,0.12)';
        ctx.fillRect(x - 4, y - 10, w + 8, 2);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y + h - 12, w, 12);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    };
    // Кирпичная кладка: горизонтальные швы.
    const brickLines = (x, y, w, h, step) => {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let ly = y + step; ly < y + h; ly += step) ctx.fillRect(x, Math.round(ly), w, 2);
      ctx.fillStyle = 'rgba(255,240,210,0.06)';
      for (let ly = y + 2; ly < y + h; ly += step) ctx.fillRect(x, Math.round(ly), w, 1);
    };
    // Пятна/потёки на штукатурке.
    const stains = (n, x0, y0, x1, y1) => {
      for (let i = 0; i < n; i++) {
        const sx = x0 + rnd() * (x1 - x0), sy = y0 + rnd() * (y1 - y0);
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(60,40,25,0.14)';
        ctx.beginPath();
        ctx.ellipse(Math.round(sx), Math.round(sy), 6 + rnd() * 16, 4 + rnd() * 10, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    // Настенный фонарь с ореолом.
    const wallLamp = (x, y) => {
      ctx.fillStyle = '#1c1c22';
      ctx.fillRect(x - 8, y - 3, 16, 6);
      const lg = ctx.createRadialGradient(x, y + 8, 1, x, y + 8, 22);
      lg.addColorStop(0, 'rgba(255,205,120,0.85)');
      lg.addColorStop(1, 'rgba(255,205,120,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(x, y + 8, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe2a0';
      ctx.fillRect(x - 5, y, 10, 9);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 5, y, 10, 9);
    };
    // Вертикальная труба с хомутами.
    const pipeV = (x, y0, y1, w) => {
      w = w || 8;
      ctx.fillStyle = '#4a4440';
      ctx.fillRect(x, y0, w, y1 - y0);
      ctx.fillStyle = 'rgba(255,240,210,0.12)';
      ctx.fillRect(x, y0, 2, y1 - y0);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let cy = y0 + 14; cy < y1 - 6; cy += 34) ctx.fillRect(x - 2, cy, w + 4, 4);
    };
    // Шторы на окне (боковые драпировки + ламбрекен).
    const curtains = (x, y, w, h) => {
      ctx.fillStyle = 'rgba(150,60,50,0.85)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x + 6, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w - 12, y);
      ctx.lineTo(x + w - 6, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(120,45,40,0.9)';
      ctx.fillRect(x - 2, y - 6, w + 4, 8);
    };
    // Двускатная крыша.
    const gable = (x, y, w, peak, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + w / 2, y - peak);
      ctx.lineTo(x + w + 8, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,120,60,0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (w / 5) * i - 6, y - 4);
        ctx.lineTo(x + w / 2 + ((w / 5) * i - w / 2) * 0.4, y - peak + 6);
        ctx.stroke();
      }
    };

    const pad = 14, topY = 34;
    const bw = W - pad * 2, bh = H - topY - 16;
    if (key === 'map_garage') {
      body(pad, topY, bw, bh, '#5a6068', true);
      brickLines(pad + 6, topY + 40, bw - 12, bh - 52, 14);
      stains(4, pad + 8, topY + 40, pad + bw - 8, topY + bh - 14);
      // Вентрешётка с ламелями
      ctx.fillStyle = '#2c3036';
      ctx.fillRect(pad + 24, topY + 12, 54, 20);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad + 24, topY + 12, 54, 20);
      ctx.fillStyle = 'rgba(200,210,220,0.4)';
      for (let vI = 0; vI < 5; vI++) ctx.fillRect(pad + 28 + vI * 10, topY + 15, 6, 14);
      // Электрощиток с кабель-каналом
      ctx.fillStyle = '#7a8088';
      ctx.fillRect(pad + bw - 42, topY + 14, 18, 22);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad + bw - 42, topY + 14, 18, 22);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(pad + bw - 34, topY + 18);
      ctx.lineTo(pad + bw - 30, topY + 24);
      ctx.lineTo(pad + bw - 33, topY + 24);
      ctx.lineTo(pad + bw - 31, topY + 31);
      ctx.stroke();
      pipeV(pad + bw - 18, topY + 8, topY + bh - 12, 6);
      // Ворота-роллета
      const dx = pad + 24, dw = bw - 58, dy = topY + 48, dh = bh - 58;
      // Защитный короб рулонных ворот
      ctx.fillStyle = '#26292e';
      ctx.fillRect(dx - 4, dy - 8, dw + 8, 9);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(dx - 4, dy - 8, dw + 8, 9);
      // Полотно роллеты
      ctx.fillStyle = '#3a4046';
      ctx.fillRect(dx, dy, dw, dh);
      for (let l = dy + 6; l < dy + dh - 2; l += 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(dx + 2, l, dw - 4, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(dx + 2, l, dw - 4, 1);
      }
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(dx, dy, dw, dh);
      // Замок внизу
      ctx.fillStyle = '#202226';
      ctx.fillRect(dx + dw / 2 - 8, dy + dh - 8, 16, 6);
      // Прожектор освещения ворот строго над защитным коробом
      wallLamp(dx + dw / 2, dy - 18);
    } else if (key === 'map_apteka') {
      body(pad, topY, bw, bh, '#8e9e8a', true);
      brickLines(pad + 6, topY + 44, bw - 12, bh - 56, 13);
      stains(3, pad + 8, topY + 80, pad + bw - 8, topY + bh - 14);
      // Архитектурный фриз вместо вывески с текстом
      fascia(pad + 20, topY + 10, bw - 40, 26, '#1d4a2d', '#38cc66');
      // Символ: аккуратный светящийся медицинский крест в рамке на фризе
      const crx = pad + 38, cry = topY + 16;
      ctx.fillStyle = '#22cc55';
      ctx.fillRect(crx - 2, cry + 4, 16, 6);
      ctx.fillRect(crx + 3, cry - 1, 6, 16);
      ctx.fillStyle = '#e8ffe8';
      ctx.fillRect(crx, cry + 5, 12, 4);
      ctx.fillRect(crx + 4, cry + 1, 4, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let li = 0; li < 6; li++) ctx.fillRect(pad + 70 + li * 16, topY + 18, 10, 10);
      // Витрина
      const wx = pad + 16, ww = 98, wy = topY + 48, wh = bh - 60;
      shopWin(wx, wy, ww, wh, '#bfe8c8');
      curtains(wx, wy, ww, wh);
      // Входная дверь
      const dx = pad + bw - 60, dw = 46, dy = topY + 48, dh = bh - 56;
      canopy(dx, dy, dw);
      door(dx, dy, dw, dh);
      // Фонарь в простенке между витриной и дверью
      wallLamp(pad + 128, topY + 42);
      // Кондиционер на фасаде над простенком
      acUnit(pad + 117, topY + 68);
    } else if (key === 'map_shop') {
      body(pad, topY, bw, bh, '#724c3c', true);
      brickLines(pad + 6, topY + 44, bw - 12, bh - 56, 13);
      stains(3, pad + 8, topY + 70, pad + bw - 8, topY + bh - 14);
      // Архитектурный карниз с дентикулами вместо вывески с текстом
      fascia(pad + 16, topY + 8, bw - 32, 24, '#2e2620', '#d88e40');
      ctx.fillStyle = 'rgba(255,240,210,0.15)';
      for (let bi = 0; bi < 10; bi++) ctx.fillRect(pad + 24 + bi * 16, topY + 14, 8, 12);
      // Полосатая маркиза над витриной
      const wx = pad + 16, ww = 102, wy = topY + 54, wh = bh - 66;
      awning(wx - 2, wy - 10, ww + 4, '#8a3434', '#dfd7c8');
      shopWin(wx, wy, ww, wh, '#ffdca0');
      curtains(wx, wy, ww, wh);
      // Дверь
      const dx = pad + bw - 58, dw = 44, dy = topY + 54, dh = bh - 62;
      canopy(dx, dy, dw);
      door(dx, dy, dw, dh);
      // Фонарь над входом (строго над козырьком двери, с зазором по высоте)
      wallLamp(dx + dw / 2, dy - 18);
      // Кондиционер на стене над витриной
      acUnit(wx + 8, topY + 22);
    } else if (key === 'map_zdanie') {
      body(pad, topY, bw, bh, '#565660', true);
      stains(4, pad + 8, topY + 60, pad + bw - 8, topY + bh - 14);
      pipeV(pad + 10, topY + 10, topY + bh - 12, 8);
      // 3-й этаж: 4 окна
      winRow(pad + 26, topY + 14, 4, 30, 32, 14);
      // 2-й этаж: 4 окна
      winRow(pad + 26, topY + 54, 4, 30, 32, 14);
      // Кондиционеры между окнами 2-го этажа
      acUnit(pad + 68, topY + 60);
      acUnit(pad + 156, topY + 60);
      // 1-й этаж: Парадный вход по центру
      const edx = pad + bw / 2 - 27, edy = topY + 96, edw = 54, edh = bh - 104;
      canopy(edx, edy, edw);
      door(edx, edy, edw, edh);
      wallLamp(pad + bw / 2, edy - 18);
      // Окна 1-го этажа — строго на уровне верха двери edy (topY + 96), не ниже дверей!
      winRow(pad + 26, edy, 1, 30, 36, 0);
      winRow(pad + bw - 56, edy, 1, 30, 36, 0);
    } else if (key === 'map_kino') {
      body(pad, topY, bw, bh, '#684236', true);
      brickLines(pad + 6, topY + 44, bw - 12, bh - 56, 13);
      stains(3, pad + 8, topY + 70, pad + bw - 8, topY + bh - 14);
      // Вертикальная неоновая стела ар-деко вместо букв "К И Н О"
      const stX = pad + bw - 48, stY = topY - 6, stW = 34, stH = 96;
      ctx.fillStyle = '#22262e';
      ctx.fillRect(stX, stY, stW, stH);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(stX, stY, stW, stH);
      // Неоновые геометрические шевроны и вертикальные полосы
      ctx.fillStyle = '#ffb03a';
      ctx.fillRect(stX + 8, stY + 8, 4, stH - 16);
      ctx.fillRect(stX + stW - 12, stY + 8, 4, stH - 16);
      ctx.fillStyle = '#ffd868';
      for (let si = 0; si < 4; si++) {
        ctx.beginPath();
        ctx.moveTo(stX + 6, stY + 18 + si * 20);
        ctx.lineTo(stX + stW / 2, stY + 28 + si * 20);
        ctx.lineTo(stX + stW - 6, stY + 18 + si * 20);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffcc44';
        ctx.stroke();
      }
      // Верхний карниз кинотеатра вместо "КИНО"
      fascia(pad + 16, topY + 8, bw - 74, 26, '#1e222a', '#d43c3c');
      for (let li = 0; li < 8; li++) {
        ctx.fillStyle = li % 2 ? '#ffea70' : '#d45a20';
        ctx.beginPath();
        ctx.arc(pad + 24 + li * 15, topY + 21, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Афишные стенды со стеклом
      for (let i2 = 0; i2 < 2; i2++) {
        const ax = pad + 18 + i2 * 56;
        ctx.fillStyle = '#2a2420';
        ctx.fillRect(ax - 2, topY + 44, 48, 64);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ax - 2, topY + 44, 48, 64);
        ctx.fillStyle = i2 ? '#3a5a7a' : '#7a3a4a';
        ctx.fillRect(ax, topY + 46, 44, 60);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(ax + 4, topY + 50, 36, 18);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(ax + 14, topY + 42, 16, 2);
      }
      // Дверь входа:
      const kdx = pad + bw - 104, kdw = 50, kdy = topY + 52, kdh = bh - 60;
      canopy(kdx, kdy, kdw);
      door(kdx, kdy, kdw, kdh);
      // Фонарь НАД дверью (а не на афише!)
      wallLamp(kdx + kdw / 2, kdy - 18);
    } else if (key === 'map_pochta') {
      body(pad, topY, bw, bh, '#9a9482', true);
      brickLines(pad + 6, topY + 44, bw - 12, bh - 56, 13);
      stains(3, pad + 8, topY + 70, pad + bw - 8, topY + bh - 14);
      // Верхний карниз вместо "ПОЧТА"
      fascia(pad + 20, topY + 8, bw - 40, 26, '#263e58', '#4ea2e8');
      // Витрина
      const wx = pad + 18, ww = 88, wy = topY + 48, wh = bh - 60;
      shopWin(wx, wy, ww, wh, '#c8d8e8');
      curtains(wx, wy, ww, wh);
      // Дверь
      const dx = pad + bw - 60, dw = 44, dy = topY + 48, dh = bh - 56;
      canopy(dx, dy, dw);
      door(dx, dy, dw, dh);
      // Почтовый ящик в простенке
      ctx.fillStyle = '#265492';
      ctx.fillRect(pad + 112, topY + bh - 50, 24, 32);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad + 112, topY + bh - 50, 24, 32);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(pad + 115, topY + bh - 44, 18, 3);
      // Фонарь в простенке над почтовым ящиком (без наложения на дверь!)
      wallLamp(pad + 124, topY + 40);
    } else if (key === 'map_stol') {
      body(pad, topY, bw, bh, '#7e6c56', true);
      brickLines(pad + 6, topY + 44, bw - 12, bh - 56, 13);
      stains(3, pad + 8, topY + 70, pad + bw - 8, topY + bh - 14);
      // Верхний фриз вместо "СТОЛОВАЯ"
      fascia(pad + 18, topY + 8, bw - 36, 26, '#462e1e', '#e09a48');
      // Витрина слева
      const wx = pad + 16, ww = 88, wy = topY + 50, wh = bh - 62;
      shopWin(wx, wy, ww, wh, '#ffe0a8');
      curtains(wx, wy, ww, wh);
      // Отдельное окно по центру (с зазором от витрины, без наложений)
      winRow(pad + 114, wy, 1, 30, 36, 0);
      // Дверь справа
      const dx = pad + bw - 56, dw = 42, dy = topY + 50, dh = bh - 58;
      canopy(dx, dy, dw);
      door(dx, dy, dw, dh);
      // Фонарь НАД козырьком двери
      wallLamp(dx + dw / 2, dy - 18);
    } else if (key === 'map_sarai' || key === 'map_derevdom') {
      const conc = key === 'map_sarai';
      body(pad, topY + 10, bw, bh - 10, conc ? '#8a8a8e' : '#6a7076', false);
      stains(3, pad + 8, topY + 30, pad + bw - 8, topY + bh - 14);
      if (conc) {
        for (let px = pad + 17; px < pad + bw - 8; px += 34) {
          ctx.fillStyle = 'rgba(0,0,0,0.14)';
          ctx.fillRect(px, topY + 12, 2, bh - 24);
          ctx.fillStyle = 'rgba(255,240,210,0.06)';
          ctx.fillRect(px + 2, topY + 12, 1, bh - 24);
          if (rnd() < 0.6) {
            ctx.fillStyle = 'rgba(140,72,28,0.18)';
            ctx.fillRect(px + 2, Math.round(topY + 16 + rnd() * 30), 2, 14 + rnd() * 26);
          }
        }
      } else {
        for (let px = pad + 10; px < pad + bw - 6; px += 18) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,240,210,0.06)';
          ctx.fillRect(px, topY + 12, 7, bh - 24);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(pad + 24 + Math.floor(rnd() * (bw - 60)), topY + 26 + Math.floor(rnd() * 20), 8, bh - 44);
      }
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = 'rgba(40,36,28,0.35)';
        ctx.beginPath();
        ctx.ellipse(Math.round(pad + 6 + rnd() * (bw - 12)), Math.round(topY + bh - 14), 5 + rnd() * 9, 2 + rnd() * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = conc ? '#6e6e72' : '#54585e';
      ctx.fillRect(pad - 5, topY - 2, bw + 10, 14);
      // Ворота:
      const dx = pad + 30, dw = 76, dy = topY + 46;
      ctx.fillStyle = conc ? '#5d6066' : '#484c52';
      ctx.fillRect(dx, dy, dw, bh - 56);
      ctx.strokeStyle = edge;
      ctx.strokeRect(dx, dy, dw, bh - 56);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      for (let l = 0; l < 4; l++) {
        ctx.beginPath();
        ctx.moveTo(dx + 6, dy + 10 + l * 18);
        ctx.lineTo(dx + dw - 6, dy + 10 + l * 18);
        ctx.stroke();
      }
      // Окно на высоте ворот dy
      winRow(pad + 12, dy + 4, 1, 26, 26, 0);
      // Дверь справа:
      door(pad + bw - 52, dy, 38, bh - 56);
      wallLamp(pad + bw - 33, dy - 16);
      // Труба
      ctx.fillStyle = '#4a4e54';
      ctx.fillRect(pad + 30, topY - 26, 16, 28);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(pad + 30, topY - 26, 16, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad + 28, topY - 28, 20, 4);
    } else if (key === 'map_bigdom') {
      body(pad, topY, bw, bh, '#7a4a3c', true);
      brickLines(pad + 6, topY + 40, bw - 12, bh - 52, 13);
      stains(4, pad + 8, topY + 60, pad + bw - 8, topY + bh - 14);
      pipeV(pad + bw - 16, topY + 6, topY + bh - 12, 7);
      // Труба на крыше
      ctx.fillStyle = '#5a3a2c';
      ctx.fillRect(pad + 30, topY - 26, 18, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad + 27, topY - 30, 24, 6);
      // Два жилых ряда окон (3-й и 2-й этажи):
      for (let f = 0; f < 2; f++) {
        winRow(pad + 22, topY + 16 + f * 48, 4, 28, 32, 20);
      }
      curtains(pad + 70, topY + 16, 28, 32);
      curtains(pad + 166, topY + 64, 28, 32);
      acUnit(pad + 116, topY + 24);
      acUnit(pad + 212, topY + 72);
      // 1-й этаж: подъезды с козырьками и фонарями
      const p1x = pad + 34, p2x = pad + bw - 78, pdy = topY + bh - 68, pdw = 44, pdh = 58;
      canopy(p1x, pdy, pdw);
      door(p1x, pdy, pdw, pdh);
      wallLamp(p1x + pdw / 2, pdy - 18);
      canopy(p2x, pdy, pdw);
      door(p2x, pdy, pdw, pdh);
      wallLamp(p2x + pdw / 2, pdy - 18);
      // Окна 1-го этажа между подъездами — на уровне дверей pdy!
      winRow(pad + 104, pdy, 1, 28, 34, 0);
      winRow(pad + 140, pdy, 1, 28, 34, 0);
    } else if (key === 'map_ruin' || key === 'map_scrap' || key === 'map_ruin2' || key === 'map_wreck' || key === 'map_ruin3' ||
               key === 'map_ruin4' || key === 'map_ruin5' || key === 'map_ruin6' || key === 'map_ruin7' ||
               key === 'map_tank' || key === 'map_tower' || key === 'map_bags') {
      if (key === 'map_wreck') {
        // Остов рисуем ВО ВЕСЬ холст 200×120 — спрайт в createCover
        // растягивается ровно по хитбоксу укрытия, поэтому art должен
        // заполнять свои размеры (иначе физика больше/меньше картинки).
        ctx.save();
        // кузов: капот ниже, кабина выше
        ctx.fillStyle = '#5d5240';
        ctx.beginPath();
        ctx.moveTo(10, H - 42);
        ctx.lineTo(22, H - 74);
        ctx.lineTo(58, H - 86);
        ctx.lineTo(112, H - 84);
        ctx.lineTo(150, H - 68);
        ctx.lineTo(190, H - 70);
        ctx.lineTo(192, H - 42);
        ctx.closePath();
        ctx.fill();
        // ржавые потёки и вмятины
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(138,90,48,0.5)' : 'rgba(0,0,0,0.3)';
          ctx.fillRect(Math.round(14 + rnd() * 172), Math.round(H - 80 + rnd() * 30), 2 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 4));
        }
        ctx.fillStyle = 'rgba(255,240,210,0.1)';
        ctx.fillRect(24, H - 74, 66, 3);
        // выбитые окна — тёмные дыры с осколками
        const winHole = (wx, ww) => {
          ctx.fillStyle = 'rgba(8,8,10,0.92)';
          ctx.fillRect(wx, H - 82, ww, 26);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, H - 82, ww, 26);
          ctx.fillStyle = 'rgba(150,170,190,0.5)';
          ctx.beginPath();
          ctx.moveTo(wx + 3, H - 82);
          ctx.lineTo(wx + 10, H - 82);
          ctx.lineTo(wx + 4, H - 66);
          ctx.closePath();
          ctx.fill();
        };
        winHole(62, 30);
        winHole(98, 26);
        // фара — разбита (тёмная), вторая вырвана
        ctx.fillStyle = 'rgba(8,8,10,0.9)';
        ctx.fillRect(8, H - 58, 10, 10);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(8, H - 58, 10, 10);
        // колёса: одно спущено
        const wheel = (wx, flat) => {
          const wy = flat ? H - 32 : H - 38, wr = flat ? 20 : 23;
          ctx.fillStyle = '#1c1c20';
          ctx.beginPath();
          ctx.arc(wx, wy, wr, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#4a4e54';
          ctx.beginPath();
          ctx.arc(wx, wy, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1c1c20';
          ctx.fillRect(wx - 1, wy - 8, 2, 16);
          ctx.fillRect(wx - 8, wy - 1, 16, 2);
        };
        wheel(46, false);
        wheel(154, true);
        // бампер волочится
        ctx.strokeStyle = '#3a3e44';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(8, H - 38);
        ctx.lineTo(2, H - 22);
        ctx.stroke();
        ctx.restore();
        // земля под колёсами: тень + щебень до края холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(W / 2, H - 8, 74, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, H - 8, W, 8);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 20 + rnd() * 16), 2 + Math.floor(rnd() * 4), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_ruin2') {
        // Сломанная башня: высокий корпус, правый угол обвален ниже,
        // плиты перекрытий, щели-бойницы, пробоина, арматура, щебень.
        const drop = 44 + Math.floor(rnd() * 20);
        const teeth = 6;
        const rTop = [];
        for (let i = 0; i <= teeth; i++) {
          rTop.push(topY + 6 + Math.floor(rnd() * 16));
        }
        ctx.fillStyle = '#75736a';
        ctx.beginPath();
        ctx.moveTo(pad, topY + bh);
        ctx.lineTo(pad, rTop[0]);
        for (let i = 1; i <= teeth; i++) {
          const jx = pad + (bw / teeth) * i;
          const jy = (i >= teeth - 2) ? topY + drop + rnd() * 10 : rTop[i];
          ctx.lineTo(jx, jy);
        }
        ctx.lineTo(pad + bw, topY + bh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(pad, topY + 40, 8, bh - 40);
        ctx.fillStyle = 'rgba(255,240,210,0.08)';
        ctx.fillRect(pad + bw - 5, topY + 60, 3, bh - 60);
        // плиты перекрытий
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let ly = topY + 52; ly < topY + bh - 20; ly += 34) {
          ctx.fillRect(pad + 4, Math.round(ly), bw - 8, 3);
        }
        // сборные патч-панели: тон стены слегка гуляет по квадратам
        ctx.fillStyle = 'rgba(255,240,210,0.07)';
        ctx.fillRect(pad + 6, topY + 14, Math.round(bw * 0.3), 74);
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(Math.round(pad + bw * 0.55), topY + 118, Math.round(bw * 0.32), 66);
        stains(4, pad + 8, topY + 50, pad + bw - 8, topY + bh - 14);
        // потёки с рваного верха вниз
        for (let i = 0; i < 5; i++) {
          const dx2 = pad + 10 + rnd() * (bw - 26);
          ctx.fillStyle = 'rgba(70,50,30,0.16)';
          ctx.fillRect(Math.round(dx2), topY + 12, 2, 28 + rnd() * 58);
        }
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // бойницы-щели
        for (let i = 0; i < 5; i++) {
          const wx = pad + 14 + (i % 3) * Math.floor((bw - 30) / 3);
          const wy = topY + 56 + Math.floor(i / 3) * 52 + Math.floor(rnd() * 10);
          ctx.fillStyle = 'rgba(8,8,10,0.92)';
          ctx.fillRect(wx, wy, 12, 30);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, wy, 12, 30);
        }
        // пробоина: компактная, с диагональным сплющиванием
        const hx = pad + bw * 0.58, hy = topY + bh * 0.42;
        ctx.fillStyle = 'rgba(8,8,10,0.9)';
        ctx.beginPath();
        ctx.ellipse(hx, hy, 17, 13, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // рваные края пробоины: светлее стена — читаются как осколки бетона
        ctx.fillStyle = '#83817a';
        for (let i = 0; i < 6; i++) {
          const a = rnd() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(hx + Math.cos(a) * 15, hy + Math.sin(a) * 12);
          ctx.lineTo(hx + Math.cos(a) * 21, hy + Math.sin(a) * 17);
          ctx.lineTo(hx + Math.cos(a + 0.4) * 15, hy + Math.sin(a + 0.4) * 12);
          ctx.closePath();
          ctx.fill();
        }
        // свес кромки: тень снизу + блик сверху — дыра обретает глубину
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(hx, hy + 11, 14, 4, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,210,0.1)';
        ctx.beginPath();
        ctx.ellipse(hx - 9, hy - 10, 7, 3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // арматура сверху и из пробоины
        ctx.strokeStyle = '#3a3430';
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const ax = pad + 12 + rnd() * (bw - 24);
          const ay = (i < 4) ? topY + 4 + rnd() * 10 : hy - 10 + rnd() * 20;
          ctx.beginPath();
          ctx.moveTo(ax, ay + 14);
          ctx.lineTo(ax + (rnd() - 0.5) * 10, ay - 10 - rnd() * 8);
          ctx.stroke();
        }
        // трещина
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        let tx = pad + bw * 0.35, ty = topY + 40;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        while (ty < topY + bh - 8) {
          tx += (rnd() - 0.5) * 22;
          ty += 16 + rnd() * 16;
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        // упавшая плита у стены + щебень
        ctx.save();
        ctx.translate(pad + 26, topY + bh - 26);
        ctx.rotate(-0.35);
        ctx.fillStyle = '#5d5c53';
        ctx.fillRect(-34, -8, 68, 16);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(-34, -8, 68, 16);
        ctx.restore();
        // низ до края холста (иначе visibly висит)
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(pad, topY + bh - 12, bw, H - (topY + bh - 12));
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(140,140,130,0.35)';
          ctx.fillRect(Math.round(pad + rnd() * bw), Math.round(topY + bh - 16 + rnd() * 14), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_ruin') {
        // Развалина: рваный верх, арматура, тёмные глазницы окон,
        // трещина через весь корпус, щебень у подножия. Без вывесок.
        const rTop = [];
        const teeth = 7;
        for (let i = 0; i <= teeth; i++) {
          rTop.push(topY + 6 + Math.floor(rnd() * (bh * 0.28)));
        }
        ctx.fillStyle = '#6e6e66';
        ctx.beginPath();
        ctx.moveTo(pad, topY + bh);
        ctx.lineTo(pad, rTop[0]);
        for (let i = 1; i <= teeth; i++) {
          ctx.lineTo(pad + (bw / teeth) * i, rTop[i]);
        }
        ctx.lineTo(pad + bw, topY + bh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(pad + bw - 10, topY, 10, bh);
        ctx.fillStyle = 'rgba(255,240,210,0.08)';
        ctx.fillRect(pad, topY + 20, 3, bh - 20);
        brickLines(pad + 6, topY + 60, bw - 12, bh - 72, 14);
        stains(4, pad + 8, topY + 60, pad + bw - 8, topY + bh - 14);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // арматура из рваного верха
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const ax = pad + 14 + rnd() * (bw - 28);
          const ay = topY + 4 + rnd() * 12;
          ctx.strokeStyle = '#3a3430';
          ctx.beginPath();
          ctx.moveTo(ax, ay + 16);
          ctx.lineTo(ax + (rnd() - 0.5) * 8, ay - 12 - rnd() * 10);
          ctx.stroke();
          ctx.fillStyle = 'rgba(150,80,30,0.6)';
          ctx.fillRect(Math.round(ax - 2), Math.round(ay - 14), 4, 4);
        }
        // глазницы окон: тёмные дыры, одна заколочена
        for (let i = 0; i < 4; i++) {
          const wx = pad + 16 + i * Math.floor((bw - 40) / 4);
          const wy = topY + 66 + (i % 2) * 44;
          ctx.fillStyle = 'rgba(8,8,10,0.92)';
          ctx.fillRect(wx, wy, 30, 34);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, wy, 30, 34);
          if (i === 1) {
            ctx.strokeStyle = '#6e5638';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(wx - 4, wy + 30);
            ctx.lineTo(wx + 34, wy + 4);
            ctx.moveTo(wx - 4, wy + 4);
            ctx.lineTo(wx + 34, wy + 30);
            ctx.stroke();
          } else {
            // скол на углу проёма
            ctx.fillStyle = '#6e6e66';
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + 10, wy);
            ctx.lineTo(wx, wy + 10);
            ctx.closePath();
            ctx.fill();
          }
        }
        // трещина через корпус
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        let tx = pad + bw * (0.3 + rnd() * 0.4), ty = topY + 30;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        while (ty < topY + bh - 8) {
          tx += (rnd() - 0.5) * 26;
          ty += 16 + rnd() * 18;
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        // цоколь-щебень до самого низа холста (иначе visibly висит)
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(pad, topY + bh - 12, bw, H - (topY + bh - 12));
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(140,140,130,0.35)';
          ctx.fillRect(Math.round(pad + rnd() * bw), Math.round(topY + bh - 16 + rnd() * 14), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_ruin3') {
        // Низкая разбитая стена: два огрызка по бокам, середина осыпалась,
        // две пробоины, арматура. Без дверей, вывесок и огней.
        const gbase = H - 14;
        // левый огрызок с рваным верхом
        ctx.fillStyle = '#6e6a5e';
        ctx.beginPath();
        ctx.moveTo(14, gbase);
        ctx.lineTo(14, 52 + Math.floor(rnd() * 8));
        for (let i = 1; i <= 4; i++) {
          ctx.lineTo(14 + (82 / 4) * i, 44 + Math.floor(rnd() * 22));
        }
        ctx.lineTo(96, gbase);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // кладка + светлые сколы на кромке обрыва
        brickLines(18, 54, 72, gbase - 58, 12);
        ctx.fillStyle = '#7d7b72';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(Math.round(22 + i * 19 + rnd() * 6), Math.round(48 + rnd() * 20), 5 + Math.floor(rnd() * 4), 3);
        }
        // правый огрызок пониже
        ctx.fillStyle = '#676356';
        ctx.beginPath();
        ctx.moveTo(170, gbase);
        ctx.lineTo(170, 66 + Math.floor(rnd() * 8));
        for (let i = 1; i <= 3; i++) {
          ctx.lineTo(170 + (76 / 3) * i, 60 + Math.floor(rnd() * 20));
        }
        ctx.lineTo(246, gbase);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        brickLines(174, 70, 68, gbase - 76, 12);
        ctx.fillStyle = '#7a786e';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(Math.round(178 + i * 21 + rnd() * 6), Math.round(64 + rnd() * 16), 5 + Math.floor(rnd() * 4), 3);
        }
        // середина осыпалась рваной кучей (не треугольник): ломаный
        // силуэт, торчащая балка и доски внутри, пыль поверх.
        ctx.fillStyle = '#5d5a4c';
        ctx.beginPath();
        ctx.moveTo(88, gbase);
        ctx.lineTo(100, 132);
        ctx.lineTo(112, 118);
        ctx.lineTo(126, 128);
        ctx.lineTo(138, 106);
        ctx.lineTo(152, 122);
        ctx.lineTo(164, 112);
        ctx.lineTo(178, gbase);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        stains(3, 92, 124, 176, gbase - 10);
        // торчащая балка поперёк кучи
        ctx.save();
        ctx.translate(134, 128);
        ctx.rotate(-0.28);
        ctx.fillStyle = '#4a4438';
        ctx.fillRect(-34, -5, 68, 10);
        ctx.strokeStyle = edge;
        ctx.strokeRect(-34, -5, 68, 10);
        ctx.restore();
        // доски в куче
        ctx.save();
        ctx.translate(112, 142);
        ctx.rotate(0.35);
        ctx.fillStyle = '#6e542f';
        ctx.fillRect(-20, -3, 40, 6);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-20, -3, 40, 6);
        ctx.restore();
        // пыль и мелочь поверх
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(150,145,130,0.35)';
          ctx.fillRect(Math.round(92 + rnd() * 80), Math.round(112 + rnd() * 48), 2 + Math.floor(rnd() * 4), 2 + Math.floor(rnd() * 3));
        }
        // потёки и трещины на огрызках
        stains(3, 16, 70, 94, gbase - 10);
        stains(3, 172, 80, 244, gbase - 10);
        // пробоины: компактные, со светлыми осколками, арматурой и свесом
        const hole = (hx, hy, hr) => {
          ctx.fillStyle = 'rgba(8,8,10,0.92)';
          ctx.beginPath();
          ctx.ellipse(hx, hy, hr, hr * 0.75, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#7d7b72';
          for (let i = 0; i < 5; i++) {
            const a = rnd() * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(hx + Math.cos(a) * hr * 0.85, hy + Math.sin(a) * hr * 0.65);
            ctx.lineTo(hx + Math.cos(a) * hr, hy + Math.sin(a) * hr * 0.88);
            ctx.lineTo(hx + Math.cos(a + 0.5) * hr * 0.85, hy + Math.sin(a + 0.5) * hr * 0.65);
            ctx.closePath();
            ctx.fill();
          }
          // арматура поперёк дыры
          ctx.strokeStyle = '#3a3430';
          ctx.lineWidth = 2.5;
          for (let i = 0; i < 2; i++) {
            const ay = hy - 6 + i * 9;
            ctx.beginPath();
            ctx.moveTo(hx - hr * 0.7, ay + (rnd() - 0.5) * 4);
            ctx.lineTo(hx + hr * 0.7, ay + (rnd() - 0.5) * 4);
            ctx.stroke();
          }
          // свес кромки снизу
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(hx, hy + hr * 0.85, hr * 0.9, 4, 0.1, 0, Math.PI * 2);
          ctx.fill();
        };
        hole(58, 112, 16);
        hole(208, 122, 19);
        // арматура из обломов
        ctx.strokeStyle = '#3a3430';
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const ax = (i < 3 ? 20 + rnd() * 70 : 176 + rnd() * 64);
          const ay = 50 + rnd() * 20;
          ctx.beginPath();
          ctx.moveTo(ax, ay + 14);
          ctx.lineTo(ax + (rnd() - 0.5) * 10, ay - 10 - rnd() * 8);
          ctx.stroke();
        }
        // щебень во всю ширину низа — до края холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 16, W, 16);
        for (let i = 0; i < 18; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 28 + rnd() * 26), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 4));
        }
      } else if (key === 'map_scrap') {
        // Баррикада из хлама: листы, доски, шина. Без огней.
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(W / 2, H - 12, 58, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        const sheet = (cx, cy, w, h, rot, col) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
          ctx.fillStyle = col;
          ctx.fillRect(-w / 2, -h / 2, w, h);
          // гофра: «зуб-тень» по вертикали
          for (let rx = 3; rx < w - 3; rx += 7) {
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(Math.round(-w / 2 + rx), Math.round(-h / 2 + 1), 2, h - 2);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(Math.round(-w / 2 + rx + 2), Math.round(-h / 2 + 1), 2, h - 2);
          }
          // ржавые пятна и потёки
          for (let r = 0; r < 4; r++) {
            ctx.fillStyle = rnd() < 0.5 ? 'rgba(140,72,28,0.4)' : 'rgba(96,52,22,0.45)';
            ctx.fillRect(Math.round(-w / 2 + 3 + rnd() * (w - 10)), Math.round(-h / 2 + 3), 3 + rnd() * 5, h - 6);
          }
          for (let r = 0; r < 3; r++) {
            ctx.fillStyle = 'rgba(140,72,28,0.3)';
            ctx.fillRect(Math.round(-w / 2 + 4 + rnd() * (w - 12)), Math.round(-h / 2 + rnd() * h * 0.35), 2, h * (0.35 + rnd() * 0.5));
          }
          // прореха с рваным тёмным нутром
          if (rnd() < 0.7) {
            const px = -w / 2 + 12 + rnd() * (w - 24), py = -h / 2 + 8 + rnd() * (h - 20);
            ctx.fillStyle = 'rgba(10,10,12,0.85)';
            ctx.beginPath();
            ctx.ellipse(px, py, 4 + rnd() * 5, 3 + rnd() * 4, rnd(), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(-w / 2, -h / 2, w, 2);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.fillStyle = '#2c3036';
          ctx.beginPath();
          ctx.arc(-w / 2 + 7, -h / 2 + 7, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(w / 2 - 7, h / 2 - 7, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };
        sheet(W / 2 - 30, H / 2 + 6, 90, 44, -0.22, '#6b7278');
        sheet(W / 2 + 34, H / 2 + 10, 84, 40, 0.24, '#5d625a');
        sheet(W / 2 + 2, H / 2 - 18, 96, 36, -0.06, '#777468');
        // доски
        ctx.save();
        ctx.translate(W / 2 - 52, H / 2 - 8);
        ctx.rotate(0.5);
        ctx.fillStyle = '#6e542f';
        ctx.fillRect(-8, -42, 16, 84);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(-8, -42, 16, 84);
        ctx.restore();
        ctx.save();
        ctx.translate(W / 2 + 58, H / 2 - 2);
        ctx.rotate(-0.4);
        ctx.fillStyle = '#5d4a28';
        ctx.fillRect(-7, -38, 14, 76);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(-7, -38, 14, 76);
        ctx.restore();
        // шина (ужата: на показе 200px была с колесо персонажа)
        const tx2 = W / 2 + 8, ty2 = H - 34;
        ctx.fillStyle = '#1c1c20';
        ctx.beginPath();
        ctx.arc(tx2, ty2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx2, ty2, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        ctx.arc(tx2, ty2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6a7078';
        ctx.beginPath();
        ctx.arc(tx2, ty2, 3, 0, Math.PI * 2);
        ctx.fill();
        // контакт с землёй: щебень во всю ширину низа — иначе низ холста
        // прозрачный и баррикада visibly висит над травой.
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 12, W, 12);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 26 + rnd() * 22), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 4));
        }
      } else if (key === 'map_ruin4') {
        // Обломок панельки с балконами: слева ровный торец, справа рваный
        // верх; две выступающие балконные плиты с решёткой (одна покосилась).
        // Балконов нет ни у одной другой развалины — силуэт узнаваем.
        const flatTop = topY + 18;
        ctx.fillStyle = '#716e62';
        ctx.beginPath();
        ctx.moveTo(pad, topY + bh);
        ctx.lineTo(pad, flatTop);
        ctx.lineTo(pad + bw * 0.55, flatTop);
        const teeth4 = 4;
        for (let i = 1; i <= teeth4; i++) {
          ctx.lineTo(pad + bw * 0.55 + (bw * 0.45 / teeth4) * i,
            flatTop + 8 + Math.floor(rnd() * 30));
        }
        ctx.lineTo(pad + bw, topY + bh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(pad + bw - 10, flatTop, 10, bh - 18);
        brickLines(pad + 6, flatTop + 44, bw - 12, bh - 56, 14);
        stains(4, pad + 8, flatTop + 40, pad + bw - 8, topY + bh - 14);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // балконные плиты с перилами: верхняя целая, нижняя покосилась
        const balc = (by, tilt) => {
          ctx.save();
          ctx.translate(pad + 6, by);
          ctx.rotate(tilt);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(-12, 4, 76, 8);
          ctx.fillStyle = '#5d5c53';
          ctx.fillRect(-14, 0, 76, 8);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(-14, 0, 76, 8);
          // решётка перил
          ctx.strokeStyle = '#3a3430';
          ctx.lineWidth = 2;
          for (let b = 0; b <= 6; b++) {
            ctx.beginPath();
            ctx.moveTo(-14 + b * 10, 0);
            ctx.lineTo(-14 + b * 10, -20);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(-14, -20);
          ctx.lineTo(62, -20);
          ctx.stroke();
          ctx.restore();
        };
        balc(flatTop + 62, 0);
        balc(flatTop + 112, -0.09);
        // узкие балконные двери-глазницы (тёмные дыры)
        for (let i = 0; i < 3; i++) {
          const wx = pad + 78 + i * Math.floor((bw - 100) / 3);
          const wy = flatTop + 30 + (i % 2) * 50;
          ctx.fillStyle = 'rgba(8,8,10,0.92)';
          ctx.fillRect(wx, wy, 26, 46);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, wy, 26, 46);
          // скол на углу проёма
          ctx.fillStyle = '#716e62';
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + 9, wy);
          ctx.lineTo(wx, wy + 9);
          ctx.closePath();
          ctx.fill();
        }
        // арматура из рваного верха справа
        ctx.strokeStyle = '#3a3430';
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const ax = pad + bw * 0.6 + rnd() * bw * 0.35;
          const ay = flatTop + 4 + rnd() * 10;
          ctx.beginPath();
          ctx.moveTo(ax, ay + 14);
          ctx.lineTo(ax + (rnd() - 0.5) * 10, ay - 10 - rnd() * 8);
          ctx.stroke();
        }
        // трещина через корпус
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        let tx4 = pad + bw * 0.5, ty4 = flatTop + 26;
        ctx.beginPath();
        ctx.moveTo(tx4, ty4);
        while (ty4 < topY + bh - 8) {
          tx4 += (rnd() - 0.5) * 22;
          ty4 += 16 + rnd() * 16;
          ctx.lineTo(tx4, ty4);
        }
        ctx.stroke();
        // цоколь-щебень до самого низа холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(pad, topY + bh - 12, bw, H - (topY + bh - 12));
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(140,140,130,0.35)';
          ctx.fillRect(Math.round(pad + rnd() * bw), Math.round(topY + bh - 16 + rnd() * 14), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_ruin5') {
        // Обломанная кирпичная труба: узкая вертикаль по центру + кольцевая
        // груда кирпича вокруг. Единственная «свечка» среди развалин.
        const gbase5 = H - 14;
        // груда кирпича во всю ширину (трапеция с ломаным верхом)
        ctx.fillStyle = '#5d5a4c';
        ctx.beginPath();
        ctx.moveTo(6, gbase5);
        ctx.lineTo(28, gbase5 - 44 - Math.floor(rnd() * 8));
        ctx.lineTo(52, gbase5 - 30);
        ctx.lineTo(74, gbase5 - 52 - Math.floor(rnd() * 8));
        ctx.lineTo(100, gbase5 - 34);
        ctx.lineTo(126, gbase5 - 50 - Math.floor(rnd() * 8));
        ctx.lineTo(150, gbase5 - 32);
        ctx.lineTo(174, gbase5 - 46 - Math.floor(rnd() * 8));
        ctx.lineTo(194, gbase5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // кладка по груде + пятна — иначе гладкая серая подушка
        brickLines(8, gbase5 - 46, W - 16, 44, 9);
        stains(3, 10, gbase5 - 40, W - 10, gbase5 - 6);
        // отдельные кирпичи в груде
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = rnd() < 0.5 ? '#7a5a44' : '#6e6a5e';
          const bx = 14 + rnd() * (W - 40), by = gbase5 - 44 + rnd() * 32;
          ctx.fillRect(Math.round(bx), Math.round(by), 12, 6);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(Math.round(bx), Math.round(by), 12, 6);
        }
        // камни/трещины в зазорах между кирпичами
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(Math.round(10 + rnd() * (W - 26)), Math.round(gbase5 - 42 + rnd() * 34), 5 + Math.floor(rnd() * 6), 3 + Math.floor(rnd() * 3));
        }
        // тело трубы
        const txx = Math.round(W / 2 - 32), tww = 64;
        const tTop = topY + 30;
        ctx.fillStyle = '#7a5a44';
        ctx.beginPath();
        ctx.moveTo(txx, gbase5 - 40);
        ctx.lineTo(txx, tTop + 10);
        const teeth5 = 5;
        for (let i = 0; i <= teeth5; i++) {
          ctx.lineTo(txx + (tww / teeth5) * i, tTop + Math.floor(rnd() * 14));
        }
        ctx.lineTo(txx + tww, gbase5 - 40);
        ctx.closePath();
        ctx.fill();
        brickLines(txx + 4, tTop + 20, tww - 8, gbase5 - 60 - tTop, 10);
        // контакт трубы с груда: тёмная полоса-прожим
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(txx - 2, gbase5 - 46, tww + 4, 7);
        stains(3, txx + 4, tTop + 20, txx + tww - 4, gbase5 - 46);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // жерло сверху — тёмная дыра
        ctx.fillStyle = 'rgba(8,8,10,0.92)';
        ctx.beginPath();
        ctx.ellipse(W / 2, tTop + 6, 20, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.stroke();
        // обручи-обоймы
        ctx.fillStyle = '#2c3036';
        ctx.fillRect(txx - 3, tTop + 52, tww + 6, 7);
        ctx.fillRect(txx - 3, tTop + 96, tww + 6, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(txx - 3, tTop + 52, tww + 6, 2);
        ctx.fillRect(txx - 3, tTop + 96, tww + 6, 2);
        // вертикальная трещина
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2.5;
        let tx5 = W / 2 + 10, ty5 = tTop + 30;
        ctx.beginPath();
        ctx.moveTo(tx5, ty5);
        while (ty5 < gbase5 - 48) {
          tx5 += (rnd() - 0.5) * 12;
          ty5 += 14 + rnd() * 12;
          ctx.lineTo(tx5, ty5);
        }
        ctx.stroke();
        // арматура из рваного верха трубы
        ctx.strokeStyle = '#3a3430';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          const ax = txx + 8 + rnd() * (tww - 16);
          ctx.beginPath();
          ctx.moveTo(ax, tTop + 12);
          ctx.lineTo(ax + (rnd() - 0.5) * 8, tTop - 8 - rnd() * 6);
          ctx.stroke();
        }
        // щебень во всю ширину низа — до края холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 14, W, 14);
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 26 + rnd() * 24), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_ruin6') {
        // Разбитая арка-проезд: две тумбы + перемычка, по центру сквозной
        // арочный проезд. Единственная развалина с дырой-проездом.
        const gbase6 = H - 14;
        // левая тумба с рваным верхом
        ctx.fillStyle = '#6e6a5e';
        ctx.beginPath();
        ctx.moveTo(14, gbase6);
        ctx.lineTo(14, 62 + Math.floor(rnd() * 6));
        for (let i = 1; i <= 3; i++) {
          ctx.lineTo(14 + (82 / 3) * i, 54 + Math.floor(rnd() * 18));
        }
        ctx.lineTo(96, gbase6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // правая тумба
        ctx.fillStyle = '#676356';
        ctx.beginPath();
        ctx.moveTo(184, gbase6);
        ctx.lineTo(184, 64 + Math.floor(rnd() * 6));
        for (let i = 1; i <= 3; i++) {
          ctx.lineTo(184 + (82 / 3) * i, 58 + Math.floor(rnd() * 18));
        }
        ctx.lineTo(266, gbase6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // перемычка с рваным верхом
        ctx.fillStyle = '#716e62';
        ctx.beginPath();
        ctx.moveTo(14, 62);
        for (let i = 0; i <= 8; i++) {
          ctx.lineTo(14 + (252 / 8) * i, 42 + Math.floor(rnd() * 16));
        }
        ctx.lineTo(266, 66);
        ctx.lineTo(266, 62);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        brickLines(20, 66, 60, 40, 12);
        brickLines(192, 68, 60, 40, 12);
        stains(3, 16, 70, 94, gbase6 - 10);
        stains(3, 186, 72, 264, gbase6 - 10);
        // сквозной проезд: тёмная арка
        ctx.fillStyle = 'rgba(8,8,10,0.92)';
        ctx.beginPath();
        ctx.moveTo(100, gbase6);
        ctx.lineTo(100, 108);
        ctx.quadraticCurveTo(140, 78, 180, 108);
        ctx.lineTo(180, gbase6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // блик-полоса внутри проезда (глубина)
        ctx.fillStyle = 'rgba(150,170,190,0.18)';
        ctx.fillRect(106, 116, 10, gbase6 - 122);
        // колея через проезд
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(118, gbase6 - 8, 44, 8);
        // бойницы на перемычке
        for (let i = 0; i < 2; i++) {
          const wx = 112 + i * 34;
          ctx.fillStyle = 'rgba(8,8,10,0.92)';
          ctx.fillRect(wx, 70, 18, 18);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, 70, 18, 18);
        }
        // скол угла на правой тумбе — обнажённая кладка
        ctx.fillStyle = '#7a5a44';
        ctx.beginPath();
        ctx.moveTo(266, 96);
        ctx.lineTo(248, 96);
        ctx.lineTo(266, 114);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.stroke();
        // радиальные трещины от арки
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(100, 108);
        ctx.lineTo(78, 88);
        ctx.moveTo(180, 108);
        ctx.lineTo(202, 88);
        ctx.stroke();
        // арматура из обломов
        ctx.strokeStyle = '#3a3430';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const ax = (i < 3 ? 18 + rnd() * 70 : 192 + rnd() * 64);
          const ay = 48 + rnd() * 16;
          ctx.beginPath();
          ctx.moveTo(ax, ay + 14);
          ctx.lineTo(ax + (rnd() - 0.5) * 10, ay - 10 - rnd() * 8);
          ctx.stroke();
        }
        // щебень и пыль в проезде — во всю ширину низа
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 14, W, 14);
        for (let i = 0; i < 18; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 26 + rnd() * 24), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_ruin7') {
        // Фундамент с торчащими сваями: низкий плоский ростверк во всю ширину
        // + 6 обломанных свай-гребёнкой, упавшая плита и люк-спуск в подвал.
        // Самый низкий и плоский силуэт — не путать с ruin3 (у той огрызки и куча).
        const gbase7 = H - 14;
        const rostY = gbase7 - 36;
        // сваи-гребёнка за ростверком
        for (let i = 0; i < 6; i++) {
          const px = pad + 8 + i * Math.floor((bw - 16) / 6);
          const ph = 22 + Math.floor(rnd() * 26);
          ctx.fillStyle = i % 2 ? '#676356' : '#6e6a5e';
          ctx.beginPath();
          ctx.moveTo(px, rostY);
          ctx.lineTo(px, rostY - ph + 6);
          ctx.lineTo(px + 8, rostY - ph - Math.floor(rnd() * 6));
          ctx.lineTo(px + 16, rostY - ph + 6);
          ctx.lineTo(px + 24, rostY - ph + 4 + Math.floor(rnd() * 6));
          ctx.lineTo(px + 24, rostY);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.stroke();
          // арматура из сваи
          ctx.strokeStyle = '#3a3430';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(px + 12, rostY - ph);
          ctx.lineTo(px + 12 + (rnd() - 0.5) * 8, rostY - ph - 10 - rnd() * 6);
          ctx.stroke();
        }
        // упавшая плита наискосок между сваями
        ctx.save();
        ctx.translate(pad + bw * 0.38, rostY - 8);
        ctx.rotate(-0.22);
        ctx.fillStyle = '#5d5c53';
        ctx.fillRect(-40, -7, 80, 14);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(-40, -7, 80, 14);
        ctx.restore();
        // ростверк-плита во всю ширину
        ctx.fillStyle = '#716e62';
        ctx.fillRect(pad, rostY, bw, 36);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(pad, rostY + 28, bw, 8);
        ctx.fillStyle = 'rgba(255,240,210,0.10)';
        ctx.fillRect(pad, rostY, bw, 3);
        brickLines(pad + 6, rostY + 8, bw - 12, 18, 9);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, rostY, bw, 36);
        // продухи в ростверке: жалюзи внутри — читаются решёткой, не чёрным квадратом
        for (let i = 0; i < 4; i++) {
          const wx = pad + 16 + i * Math.floor((bw - 40) / 4);
          ctx.fillStyle = 'rgba(8,8,10,0.85)';
          ctx.fillRect(wx, rostY + 12, 18, 12);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(wx, rostY + 12, 18, 4);
          ctx.fillStyle = 'rgba(140,140,130,0.3)';
          ctx.fillRect(wx + 3, rostY + 17, 12, 2);
          ctx.fillRect(wx + 3, rostY + 21, 12, 2);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(wx, rostY + 12, 18, 12);
          ctx.fillStyle = 'rgba(255,240,210,0.10)';
          ctx.fillRect(wx - 1, rostY + 25, 20, 2);
        }
        // погодка ростверка: пятна, потёки от продухов, трещины, налипшая земля у подножия
        stains(5, pad + 6, rostY + 6, pad + bw - 6, rostY + 33);
        for (let i = 0; i < 4; i++) {
          const dx7 = pad + 20 + i * Math.floor((bw - 44) / 4);
          ctx.fillStyle = 'rgba(60,45,25,0.16)';
          ctx.fillRect(Math.round(dx7), rostY + 26, 2, 7 + rnd() * 6);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.5;
        for (let c = 0; c < 2; c++) {
          let cx7 = pad + 20 + rnd() * (bw - 70), cy7 = rostY + 7;
          ctx.beginPath();
          ctx.moveTo(cx7, cy7);
          while (cx7 < pad + bw - 24 && cy7 < rostY + 32) {
            cx7 += 7 + rnd() * 13;
            cy7 += (rnd() - 0.3) * 8;
            ctx.lineTo(Math.round(cx7), Math.round(cy7));
          }
          ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = 'rgba(56,48,30,0.4)';
          ctx.beginPath();
          ctx.ellipse(Math.round(pad + 10 + rnd() * (bw - 20)), Math.round(rostY + 32 + rnd() * 4), 6 + rnd() * 10, 2 + rnd() * 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // люк-спуск в подвал (справа): светлые контрастные ступени + рама
        // проёма — иначе читается просто чёрным квадратом
        const lx = pad + bw - 64;
        ctx.fillStyle = 'rgba(8,8,10,0.92)';
        ctx.fillRect(lx, rostY - 2, 48, 38);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(lx, rostY - 2, 48, 38);
        ctx.strokeStyle = 'rgba(255,240,210,0.22)';
        ctx.lineWidth = 2;
        ctx.strokeRect(lx + 4, rostY + 2, 40, 34);
        for (let s = 0; s < 4; s++) {
          const sy = Math.round(rostY + 26 - s * 8);
          ctx.fillStyle = '#9a9788';
          ctx.fillRect(Math.round(lx + 8), sy, 32, 5);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(Math.round(lx + 8), sy, 32, 5);
        }
        // цоколь-щебень до края холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 12, W, 12);
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 24 + rnd() * 22), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_tank') {
        // Ржавая цистерна на бетонных опорах: люк, боковой патрубок
        // с вентилем, лесенка, потёки ржавчины. Без вывесок и огней.
        const gbaseT = H - 14;
        // опоры
        ctx.fillStyle = '#5d5c53';
        const sup1 = pad + 34, sup2 = pad + bw - 58;
        ctx.fillRect(sup1, gbaseT - 34, 24, 34);
        ctx.fillRect(sup2, gbaseT - 34, 24, 34);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(sup1, gbaseT - 34, 24, 4);
        ctx.fillRect(sup2, gbaseT - 34, 24, 4);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(sup1, gbaseT - 34, 24, 34);
        ctx.strokeRect(sup2, gbaseT - 34, 24, 34);
        // бочка: корпус + торцы
        const tx = pad + 12, tw = bw - 24, ty = gbaseT - 88, th = 54;
        ctx.fillStyle = '#6e5a44';
        ctx.fillRect(tx, ty, tw, th);
        ctx.fillStyle = 'rgba(255,240,210,0.14)';
        ctx.fillRect(tx, ty, tw, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(tx, ty + th - 8, tw, 8);
        // потьки ржавчины и вмятины
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = rnd() < 0.6 ? 'rgba(150,80,30,0.5)' : 'rgba(0,0,0,0.3)';
          ctx.fillRect(Math.round(tx + 4 + rnd() * (tw - 12)), Math.round(ty + 6 + rnd() * (th - 14)), 3 + Math.floor(rnd() * 5), 4 + Math.floor(rnd() * 10));
        }
        // торцы-крышки
        ctx.fillStyle = '#5d4c38';
        ctx.beginPath();
        ctx.ellipse(tx, ty + th / 2, 9, th / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(tx + tw, ty + th / 2, 9, th / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, ty, tw, th);
        // люк сверху + патрубок с вентилем сбоку
        ctx.fillStyle = '#4a4438';
        ctx.fillRect(tx + tw / 2 - 12, ty - 12, 24, 12);
        ctx.strokeStyle = edge;
        ctx.strokeRect(tx + tw / 2 - 12, ty - 12, 24, 12);
        ctx.fillStyle = '#4a4438';
        ctx.fillRect(tx + tw - 6, ty + 12, 22, 10);
        ctx.fillStyle = '#8a2a2a';
        ctx.beginPath();
        ctx.arc(tx + tw + 12, ty + 17, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.stroke();
        // лесенка на бок
        ctx.strokeStyle = '#3a3430';
        ctx.lineWidth = 2.5;
        const lxx = tx + 18;
        ctx.beginPath();
        ctx.moveTo(lxx, ty + th);
        ctx.lineTo(lxx, ty - 2);
        ctx.moveTo(lxx + 10, ty + th);
        ctx.lineTo(lxx + 10, ty - 2);
        ctx.stroke();
        for (let s = 0; s < 4; s++) {
          ctx.beginPath();
          ctx.moveTo(lxx, ty + 8 + s * 12);
          ctx.lineTo(lxx + 10, ty + 8 + s * 12);
          ctx.stroke();
        }
        // щебень во всю ширину низа — до края холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 12, W, 12);
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 24 + rnd() * 22), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_tower') {
        // Покосившаяся вышка (водонапорная/наблюдательная): ДЛИННЫЕ ноги,
        // маленькая кренящаяся кабина наверху, рваный навес, короткий
        // антенный штырь, висящий трос с крюком. Узкая и высокая — таких нет.
        const gbaseW = H - 14;
        const legTop = topY + 56;
        // ноги: внешние толстые вразлёт, внутренние потоньше
        ctx.strokeStyle = '#4a4438';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(pad + 34, gbaseW);
        ctx.lineTo(pad + 58, legTop);
        ctx.moveTo(pad + bw - 34, gbaseW);
        ctx.lineTo(pad + bw - 58, legTop);
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(pad + 56, gbaseW);
        ctx.lineTo(pad + 72, legTop);
        ctx.moveTo(pad + bw - 56, gbaseW);
        ctx.lineTo(pad + bw - 72, legTop);
        ctx.stroke();
        // раскосы-кресты между ногами
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#3a342c';
        const brT = legTop + 18, brB = gbaseW - 18;
        ctx.beginPath();
        ctx.moveTo(pad + 44, brB);
        ctx.lineTo(pad + bw - 44, brT);
        ctx.moveTo(pad + bw - 44, brB);
        ctx.lineTo(pad + 44, brT);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad + 50, (brT + brB) / 2);
        ctx.lineTo(pad + bw - 50, (brT + brB) / 2);
        ctx.stroke();
        // кабина с креном (маленькая — ноги главные)
        ctx.save();
        ctx.translate(pad + bw / 2 + 8, legTop - 52);
        ctx.rotate(0.09);
        ctx.fillStyle = '#6a6558';
        ctx.fillRect(-60, 0, 120, 56);
        ctx.fillStyle = 'rgba(255,240,210,0.12)';
        ctx.fillRect(-60, 0, 120, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-60, 48, 120, 8);
        // тёмные проёмы-глазницы
        ctx.fillStyle = 'rgba(8,8,10,0.92)';
        ctx.fillRect(-48, 10, 28, 24);
        ctx.fillRect(-6, 10, 28, 24);
        ctx.fillRect(36, 10, 16, 24);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(-60, 0, 120, 56);
        // рваный навес
        ctx.fillStyle = '#4e4a3e';
        ctx.beginPath();
        ctx.moveTo(-70, 0);
        ctx.lineTo(-36, -14);
        ctx.lineTo(8, -7);
        ctx.lineTo(44, -16);
        ctx.lineTo(70, -2);
        ctx.lineTo(70, 2);
        ctx.lineTo(-70, 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.stroke();
        // короткий антенный штырь (влезает в холст)
        ctx.strokeStyle = '#3a3430';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(34, -12);
        ctx.lineTo(40, -34);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(36, -27);
        ctx.lineTo(50, -27);
        ctx.moveTo(37, -19);
        ctx.lineTo(49, -19);
        ctx.stroke();
        ctx.restore();
        // висящий трос с крюком из-под кабины
        ctx.strokeStyle = '#2c2824';
        ctx.lineWidth = 2.5;
        const hx = pad + bw - 52;
        ctx.beginPath();
        ctx.moveTo(hx, legTop + 8);
        ctx.quadraticCurveTo(hx + 8, legTop + 52, hx - 2, legTop + 82);
        ctx.stroke();
        ctx.fillStyle = '#3a3430';
        ctx.fillRect(hx - 6, legTop + 82, 8, 10);
        // щебень во всю ширину низа
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 12, W, 12);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 24 + rnd() * 22), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      } else if (key === 'map_bags') {
        // Баррикада из мешков (следы обороны по ТЗ): три ряда со сдвигом,
        // доска-балка поперёк, кирпичи и щебень. Низкая и широкая.
        // Мешки/балка/кирпичи рисуем ВО ВЕСЬ холст (pad=0): спрайт в
        // createCover растягивается ровно по хитбоксу, поэтому art должен
        // заполнять свои размеры (иначе физика больше картинки).
        const gbaseB = H - 8;
        const bagColsB = ['#7a6e52', '#6f6448', '#847a5c', '#72684e'];
        const bag = (cx, cy, w, h) => {
          const col = bagColsB[Math.floor(rnd() * bagColsB.length)];
          const hw = w / 2, hh = h / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((rnd() - 0.5) * 0.1);
          // тень под мешком
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(0, 2, hw, hh, 0, 0, Math.PI * 2);
          ctx.fill();
          // корпус
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
          ctx.fill();
          // низ лежит в тени ряда — темнее
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.ellipse(0, hh * 0.55, hw * 0.9, hh * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // блик сверху
          ctx.fillStyle = 'rgba(255,240,210,0.14)';
          ctx.beginPath();
          ctx.ellipse(-hw * 0.25, -hh * 0.35, hw * 0.45, hh * 0.3, -0.35, 0, Math.PI * 2);
          ctx.fill();
          // сшитый шов
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-hw * 0.7, hh * 0.15);
          ctx.quadraticCurveTo(0, hh * 0.55, hw * 0.7, hh * 0.15);
          ctx.stroke();
          // грязь/затёки
          for (let d = 0; d < 4; d++) {
            ctx.fillStyle = rnd() < 0.5 ? 'rgba(60,45,25,0.25)' : 'rgba(0,0,0,0.18)';
            ctx.fillRect(Math.round((rnd() - 0.7) * hw), Math.round((rnd() - 0.4) * hh), 2 + Math.floor(rnd() * 4), 2);
          }
          // завязка-ушки справа
          ctx.fillStyle = '#5d533c';
          ctx.beginPath();
          ctx.moveTo(hw - 5, -3);
          ctx.lineTo(hw + 4, 0);
          ctx.lineTo(hw - 5, 3);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = edge;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        };
        // три ряда: 5 + 4 + 3 (верх короче — горка); перекрытие мешков —
        // без щелей, живой ряд через джиттер позиции/размера
        for (let i = 0; i < 5; i++) bag(30 + i * 45 + (rnd() - 0.5) * 6, gbaseB - 14 + (rnd() - 0.5) * 6, 44 + Math.floor(rnd() * 4), 22 + Math.floor(rnd() * 4));
        for (let i = 0; i < 4; i++) bag(52 + i * 44 + (rnd() - 0.5) * 6, gbaseB - 32 + (rnd() - 0.5) * 6, 43 + Math.floor(rnd() * 4), 22 + Math.floor(rnd() * 4));
        for (let i = 0; i < 3; i++) bag(74 + i * 45 + (rnd() - 0.5) * 6, gbaseB - 50 + (rnd() - 0.5) * 4, 44 + Math.floor(rnd() * 4), 22 + Math.floor(rnd() * 3));
        // доска-балка поперёк
        ctx.save();
        ctx.translate(W / 2, gbaseB - 56);
        ctx.rotate(-0.12);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-96, -4, 192, 12);
        ctx.fillStyle = '#6e542f';
        ctx.fillRect(-98, -8, 192, 12);
        ctx.fillStyle = 'rgba(255,240,210,0.15)';
        ctx.fillRect(-98, -8, 192, 3);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(-98, -8, 192, 12);
        ctx.restore();
        // пара кирпичей сбоку
        ctx.fillStyle = '#7a5a44';
        ctx.fillRect(W - 44, gbaseB - 26, 24, 11);
        ctx.fillRect(W - 40, gbaseB - 38, 24, 11);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(W - 44, gbaseB - 26, 24, 11);
        ctx.strokeRect(W - 40, gbaseB - 38, 24, 11);
        // щебень во всю ширину низа — до края холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H - 12, W, 12);
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 24 + rnd() * 22), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
        }
      }
    } else {
      // map_mini_dom / map_domik2 / map_domik: ветхие домики под крышей
      const shabby = key !== 'map_mini_dom';
      body(pad, topY + 26, bw, bh - 26, shabby ? '#8a7a64' : '#7a7e84', false);
      gable(pad, topY + 28, bw, key === 'map_domik' ? 52 : 42, '#6e3a24');
      stains(2, pad + 8, topY + 40, pad + bw - 8, topY + bh - 60);
      // Труба на коньке
      ctx.fillStyle = '#4e3423';
      ctx.fillRect(pad + bw - 52, topY - 6, 14, 34);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad + bw - 55, topY - 10, 20, 5);
      // Входная дверь по центру
      const ddx = pad + bw / 2 - 19, ddy = topY + 54, ddw = 38, ddh = bh - 60;
      canopy(ddx, ddy, ddw);
      door(ddx, ddy, ddw, ddh);
      wallLamp(ddx + ddw / 2, ddy - 16);
      // Окна — строго на одной горизонтали с дверью (ddy), а не опущены в цоколь!
      if (shabby) {
        // Одно окно заколочено досками крест-накрест
        const wx = pad + 14, wy = ddy;
        ctx.fillStyle = 'rgba(10,12,18,0.92)';
        ctx.fillRect(wx, wy, 38, 38);
        ctx.strokeStyle = '#6e5638';
        ctx.lineWidth = 4;
        for (let pI = -1; pI < 3; pI++) {
          ctx.beginPath();
          ctx.moveTo(wx - 3, wy + 10 + pI * 12);
          ctx.lineTo(wx + 41, wy + 4 + pI * 12);
          ctx.stroke();
        }
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = edge;
        ctx.strokeRect(wx, wy, 38, 38);
        // Второе окно нормальное справа
        winRow(pad + bw - 52, ddy, 1, 28, 34, 0);
      } else {
        // Два окна по бокам от двери на уровне ddy
        winRow(pad + 16, ddy, 1, 28, 34, 0);
        winRow(pad + bw - 46, ddy, 1, 28, 34, 0);
      }
      // Трещины на штукатурке
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad + bw - 30, topY + 40);
      ctx.lineTo(pad + bw - 22, topY + 70);
      ctx.lineTo(pad + bw - 28, topY + 100);
      ctx.stroke();
    }
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }
