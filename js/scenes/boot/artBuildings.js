
import { drawSandbags } from './artSandbags.js?v=410';

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

    // Вывеска с текстом.
    const sign = (x, y, w, h, text, bgc, txc, fs) => {
      ctx.fillStyle = bgc;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 5);
      else ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold ${fs || 24}px Verdana, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(text, x + w / 2, y + h / 2 + 1);
      ctx.fillStyle = txc;
      ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    };
    // Ряд окон.
    const winRow = (x, y, n, cw, ch, gap, litCol) => {
      for (let i = 0; i < n; i++) {
        const wx = x + i * (cw + gap);
        ctx.fillStyle = edge;
        ctx.fillRect(wx - 2, y - 2, cw + 4, ch + 4);
        if (rnd() < 0.5) {
          ctx.fillStyle = litCol || '#ffd97a';
          ctx.fillRect(wx, y, cw, ch);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(wx + cw / 2 - 1, y, 2, ch);
        } else {
          ctx.fillStyle = 'rgba(12,16,26,0.92)';
          ctx.fillRect(wx, y, cw, ch);
        }
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
      // вместо вывески — вентрешётка, фонарь и труба (как в жизни)
      ctx.fillStyle = '#2c3036';
      ctx.fillRect(pad + 30, topY + 12, 64, 24);
      ctx.fillStyle = 'rgba(200,210,220,0.5)';
      for (let vI = 0; vI < 4; vI++) ctx.fillRect(pad + 36 + vI * 14, topY + 15, 7, 18);
      ctx.strokeStyle = edge;
      ctx.strokeRect(pad + 30, topY + 12, 64, 24);
      wallLamp(pad + bw - 40, topY + 44);
      pipeV(pad + bw - 18, topY + 8, topY + bh - 12, 7);
      // ворота-роллета во всю нижнюю часть (окон тут нет — только ворота)
      // роллета
      const dx = pad + 30, dw = bw - 60, dy = topY + 56, dh = bh - 66;
      ctx.fillStyle = '#3a4046';
      ctx.fillRect(dx, dy, dw, dh);
      for (let l = dy + 8; l < dy + dh; l += 10) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(dx + 2, l, dw - 4, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(dx + 2, l, dw - 4, 1);
      }
      ctx.strokeStyle = edge;
      ctx.strokeRect(dx, dy, dw, dh);
    } else if (key === 'map_apteka') {
      body(pad, topY, bw, bh, '#9aa894', true);
      stains(3, pad + 8, topY + 90, pad + bw - 8, topY + bh - 14);
      sign(pad + 30, topY + 8, bw - 60, 30, 'АПТЕКА', '#1d5a34', '#e8ffe8', 22);
      shopWin(pad + 24, topY + 52, 90, bh - 66, '#bfe8c8');
      curtains(pad + 24, topY + 52, 90, bh - 66);
      // зелёный крест — левее двери, с зазором
      ctx.fillStyle = '#22cc55';
      ctx.fillRect(pad + 110, topY + 58, 24, 9);
      ctx.fillRect(pad + 118, topY + 50, 9, 25);
      ctx.strokeStyle = edge;
      ctx.strokeRect(pad + 110, topY + 58, 24, 9);
      wallLamp(pad + 184, topY + 54);
      door(pad + bw - 64, topY + bh - 78, 44, 68);
    } else if (key === 'map_shop') {
      body(pad, topY, bw, bh, '#6e4a3c', true);
      brickLines(pad + 6, topY + 78, bw - 12, bh - 90, 13);
      stains(3, pad + 8, topY + 80, pad + bw - 8, topY + bh - 14);
      awning(pad + 10, topY + 46, bw - 20, '#7a2e2e', '#d8cfc0');
      sign(pad + 30, topY + 8, bw - 60, 28, 'МАГАЗИН', '#3a2c22', '#ffd24a', 20);
      shopWin(pad + 20, topY + 68, 80, bh - 82);
      curtains(pad + 20, topY + 68, 80, bh - 82);
      wallLamp(pad + bw - 41, topY + 48);
      door(pad + bw - 62, topY + bh - 74, 42, 64);
      winRow(pad + 102, topY + 68, 1, 22, 30, 0);
    } else if (key === 'map_zdanie') {
      body(pad, topY, bw, bh, '#565660', true);
      stains(3, pad + 8, topY + 100, pad + bw - 8, topY + bh - 14);
      pipeV(pad + 10, topY + 10, topY + bh - 12, 8);
      winRow(pad + 28, topY + 18, 4, 30, 36, 14);
      winRow(pad + 28, topY + 66, 1, 30, 36, 0);
      winRow(pad + 154, topY + 66, 1, 30, 36, 0);
      // вход с козырьком только над дверью
      const edx = pad + bw / 2 - 27, edy = topY + bh - 76;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(edx - 12, edy - 12, 78, 9);
      wallLamp(pad + bw / 2, edy - 22);
      door(edx, edy, 54, 64);
      winRow(pad + 28, topY + 108, 1, 30, 30, 0);
      winRow(pad + bw - 58, topY + 108, 1, 30, 30, 0);
    } else if (key === 'map_kino') {
      body(pad, topY, bw, bh, '#6a4438', true);
      brickLines(pad + 6, topY + 110, bw - 12, bh - 122, 13);
      stains(3, pad + 8, topY + 100, pad + bw - 8, topY + bh - 14);
      // вертикальная вывеска с лампочками
      ctx.fillStyle = '#8a2020';
      ctx.fillRect(pad + bw - 52, topY - 6, 34, 96);
      ctx.strokeStyle = edge;
      ctx.strokeRect(pad + bw - 52, topY - 6, 34, 96);
      ctx.fillStyle = '#ffe9a0';
      ctx.font = 'bold 20px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ['К', 'И', 'Н', 'О'].forEach((ch, i2) => ctx.fillText(ch, pad + bw - 35, topY + 14 + i2 * 22));
      for (let i2 = 0; i2 < 8; i2++) {
        ctx.fillStyle = i2 % 2 ? '#ffdd55' : '#885511';
        ctx.beginPath();
        ctx.arc(pad + bw - 52 + (i2 % 2) * 34, topY + (i2 >> 1) * 30, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      sign(pad + 18, topY + 8, 120, 26, 'КИНО', '#20242e', '#ffd24a', 20);
      // афиши
      for (let i2 = 0; i2 < 2; i2++) {
        const ax = pad + 22 + i2 * 62;
        ctx.fillStyle = i2 ? '#3a5a7a' : '#7a3a4a';
        ctx.fillRect(ax, topY + 48, 52, 66);
        ctx.strokeStyle = edge;
        ctx.strokeRect(ax, topY + 48, 52, 66);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(ax + 6, topY + 54, 40, 20);
      }
      door(pad + bw - 70, topY + bh - 60, 42, 50);
      wallLamp(pad + bw - 92, topY + bh - 68);
    } else if (key === 'map_pochta') {
      body(pad, topY, bw, bh, '#a89a80', true);
      stains(3, pad + 8, topY + 90, pad + bw - 8, topY + bh - 14);
      sign(pad + 30, topY + 8, bw - 60, 30, 'ПОЧТА', '#2c4a6a', '#e8f0ff', 22);
      shopWin(pad + 20, topY + 52, 84, bh - 66, '#c8d8e8');
      curtains(pad + 20, topY + 52, 84, bh - 66);
      wallLamp(pad + bw - 42, topY + 56);
      door(pad + bw - 66, topY + bh - 76, 44, 66);
      // почтовый ящик — в простенке между витриной и дверью
      ctx.fillStyle = '#2c5aa0';
      ctx.fillRect(pad + 108, topY + bh - 52, 26, 34);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(pad + 108, topY + bh - 52, 26, 4);
      ctx.strokeStyle = edge;
      ctx.strokeRect(pad + 108, topY + bh - 52, 26, 34);
    } else if (key === 'map_stol') {
      body(pad, topY, bw, bh, '#7a6a52', true);
      brickLines(pad + 6, topY + 84, bw - 12, bh - 96, 13);
      stains(3, pad + 8, topY + 84, pad + bw - 8, topY + bh - 14);
      sign(pad + 24, topY + 8, bw - 48, 30, 'СТОЛОВАЯ', '#5a3a1a', '#ffe2a0', 20);
      shopWin(pad + 18, topY + 52, 100, bh - 66, '#ffe0a8');
      curtains(pad + 24, topY + 58, 68, bh - 78);
      wallLamp(pad + bw - 41, topY + 48);
      door(pad + bw - 62, topY + bh - 74, 42, 64);
      winRow(pad + 114, topY + 56, 1, 30, 34, 0);
    } else if (key === 'map_sarai' || key === 'map_derevdom') {
      const conc = key === 'map_sarai';
      body(pad, topY + 10, bw, bh - 10, conc ? '#8a8a8e' : '#6a7076', false);
      stains(3, pad + 8, topY + 30, pad + bw - 8, topY + bh - 14);
      // фактура корпуса: профлист со швами (сараи) / доски (деревянный);
      // до ворот-дверей-окон, чтобы они ложились поверх
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
      // налипшая земля у цоколя
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = 'rgba(40,36,28,0.35)';
        ctx.beginPath();
        ctx.ellipse(Math.round(pad + 6 + rnd() * (bw - 12)), Math.round(topY + bh - 14), 5 + rnd() * 9, 2 + rnd() * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = conc ? '#6e6e72' : '#54585e';
      ctx.fillRect(pad - 5, topY - 2, bw + 10, 14);
      // ворота
      const dx = pad + 34, dw = 74, dy = topY + 52;
      ctx.fillStyle = conc ? '#5d6066' : '#484c52';
      ctx.fillRect(dx, dy, dw, bh - 62);
      ctx.strokeStyle = edge;
      ctx.strokeRect(dx, dy, dw, bh - 62);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      for (let l = 0; l < 4; l++) {
        ctx.beginPath();
        ctx.moveTo(dx + 6, dy + 10 + l * 18);
        ctx.lineTo(dx + dw - 6, dy + 10 + l * 18);
        ctx.stroke();
      }
      // заклёпки по корпусу
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let rx = pad + 10; rx < pad + bw; rx += 26) {
        ctx.fillRect(rx, topY + 16, 3, 3);
        ctx.fillRect(rx, topY + bh - 22, 3, 3);
      }
      winRow(pad + 16, topY + 22, 1, 30, 28, 0);
      door(pad + bw - 56, topY + 50, 38, 58);
      // труба
      ctx.fillStyle = '#4a4e54';
      ctx.fillRect(pad + 30, topY - 26, 16, 28);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(pad + 30, topY - 26, 16, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad + 28, topY - 28, 20, 4);
    } else if (key === 'map_bigdom') {
      body(pad, topY, bw, bh, '#7a4a3c', true);
      brickLines(pad + 6, topY + 100, bw - 12, bh - 112, 13);
      stains(4, pad + 8, topY + 100, pad + bw - 8, topY + bh - 14);
      pipeV(pad + bw - 16, topY + 6, topY + bh - 12, 7);
      // труба на крыше
      ctx.fillStyle = '#5a3a2c';
      ctx.fillRect(pad + 30, topY - 26, 18, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad + 27, topY - 30, 24, 6);
      // два жилых ряда сверху, внизу — только подъезды и пустая табличка
      for (let f = 0; f < 2; f++) {
        winRow(pad + 22, topY + 16 + f * 48, 4, 28, 32, 20);
      }
      // шторы на паре окон
      curtains(pad + 70, topY + 16, 28, 32);
      curtains(pad + 166, topY + 64, 28, 32);
      door(pad + 38, topY + bh - 70, 42, 60);
      door(pad + bw - 80, topY + bh - 70, 42, 60);
      // пустая табличка (без номера — не клонируем identity)
      ctx.fillStyle = '#2c343c';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(pad + bw / 2 - 30, topY + bh - 42, 60, 20, 4);
      else ctx.rect(pad + bw / 2 - 30, topY + bh - 42, 60, 20);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (key === 'map_ruin' || key === 'map_scrap' || key === 'map_ruin2' || key === 'map_wreck' || key === 'map_ruin3' ||
               key === 'map_ruin4' || key === 'map_ruin5' || key === 'map_ruin6' || key === 'map_ruin7' ||
               key === 'map_tank' || key === 'map_tower' || key === 'map_bags') {
      if (key === 'map_wreck') {
        // Остов ужатый 0.62 вокруг точки ПОД машиной (H+2): низ кузова
        // садится к краю холста. Центр выше — и машина парила.
        ctx.save();
        ctx.translate(W / 2, H + 2);
        ctx.scale(1.0, 1.0);
        ctx.translate(-W / 2, -(H + 2));
        // кузов: капот ниже, кабина выше
        ctx.fillStyle = '#5d5240';
        ctx.beginPath();
        ctx.moveTo(18, H - 34);
        ctx.lineTo(30, H - 58);
        ctx.lineTo(66, H - 66);
        ctx.lineTo(118, H - 64);
        ctx.lineTo(150, H - 52);
        ctx.lineTo(182, H - 54);
        ctx.lineTo(184, H - 34);
        ctx.closePath();
        ctx.fill();
        // ржавые потёки и вмятины
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(138,90,48,0.5)' : 'rgba(0,0,0,0.3)';
          ctx.fillRect(Math.round(22 + rnd() * 156), Math.round(H - 60 + rnd() * 22), 2 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 4));
        }
        ctx.fillStyle = 'rgba(255,240,210,0.1)';
        ctx.fillRect(32, H - 56, 60, 3);
        // выбитые окна — тёмные дыры с осколками
        const winHole = (wx, ww) => {
          ctx.fillStyle = 'rgba(8,8,10,0.92)';
          ctx.fillRect(wx, H - 62, ww, 20);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, H - 62, ww, 20);
          ctx.fillStyle = 'rgba(150,170,190,0.5)';
          ctx.beginPath();
          ctx.moveTo(wx + 3, H - 62);
          ctx.lineTo(wx + 10, H - 62);
          ctx.lineTo(wx + 4, H - 50);
          ctx.closePath();
          ctx.fill();
        };
        winHole(70, 26);
        winHole(100, 22);
        // фара — разбита (тёмная), вторая вырвана
        ctx.fillStyle = 'rgba(8,8,10,0.9)';
        ctx.fillRect(16, H - 46, 8, 8);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(16, H - 46, 8, 8);
        // колёса: одно спущено
        const wheel = (wx, flat) => {
          const wy = flat ? H - 26 : H - 30, wr = flat ? 15 : 17;
          ctx.fillStyle = '#1c1c20';
          ctx.beginPath();
          ctx.arc(wx, wy, wr, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#4a4e54';
          ctx.beginPath();
          ctx.arc(wx, wy, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1c1c20';
          ctx.fillRect(wx - 1, wy - 6, 2, 12);
          ctx.fillRect(wx - 6, wy - 1, 12, 2);
        };
        wheel(52, false);
        wheel(148, true);
        // бампер волочится
        ctx.strokeStyle = '#3a3e44';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(14, H - 30);
        ctx.lineTo(4, H - 18);
        ctx.stroke();
        ctx.restore(); // конец ужатой отрисовки (0.62)
        // земля под колёсами: тень + щебень до края холста
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(W / 2, H - 7, 62, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, H - 8, W, 8);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(140,140,130,0.4)';
          ctx.fillRect(Math.round(rnd() * W), Math.round(H - 18 + rnd() * 14), 2 + Math.floor(rnd() * 4), 2 + Math.floor(rnd() * 3));
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
        const gbaseB = H - 14;
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
        for (let i = 0; i < 5; i++) bag(pad + 30 + i * 37 + (rnd() - 0.5) * 6, gbaseB - 14 + (rnd() - 0.5) * 6, 40 + Math.floor(rnd() * 4), 19 + Math.floor(rnd() * 4));
        for (let i = 0; i < 4; i++) bag(pad + 49 + i * 36 + (rnd() - 0.5) * 6, gbaseB - 30 + (rnd() - 0.5) * 6, 39 + Math.floor(rnd() * 4), 19 + Math.floor(rnd() * 4));
        for (let i = 0; i < 3; i++) bag(pad + 68 + i * 37 + (rnd() - 0.5) * 6, gbaseB - 46 + (rnd() - 0.5) * 4, 40 + Math.floor(rnd() * 4), 19 + Math.floor(rnd() * 3));
        // доска-балка поперёк
        ctx.save();
        ctx.translate(pad + bw / 2, gbaseB - 52);
        ctx.rotate(-0.12);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-86, -4, 172, 12);
        ctx.fillStyle = '#6e542f';
        ctx.fillRect(-88, -8, 172, 12);
        ctx.fillStyle = 'rgba(255,240,210,0.15)';
        ctx.fillRect(-88, -8, 172, 3);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(-88, -8, 172, 12);
        ctx.restore();
        // пара кирпичей сбоку
        ctx.fillStyle = '#7a5a44';
        ctx.fillRect(pad + bw - 34, gbaseB - 24, 22, 10);
        ctx.fillRect(pad + bw - 30, gbaseB - 34, 22, 10);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pad + bw - 34, gbaseB - 24, 22, 10);
        ctx.strokeRect(pad + bw - 30, gbaseB - 34, 22, 10);
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
      // труба на коньке
      ctx.fillStyle = '#4e3423';
      ctx.fillRect(pad + bw - 52, topY - 6, 14, 34);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(pad + bw - 55, topY - 10, 20, 5);
      // заколоченное окно у ветхих — левее двери, с зазором
      if (shabby) {
        const wx = pad + 14, wy = topY + 70;
        ctx.fillStyle = 'rgba(10,12,18,0.92)';
        ctx.fillRect(wx, wy, 44, 48);
        ctx.strokeStyle = '#6e5638';
        ctx.lineWidth = 5;
        for (let pI = -1; pI < 3; pI++) {
          ctx.beginPath();
          ctx.moveTo(wx - 4, wy + 12 + pI * 16);
          ctx.lineTo(wx + 48, wy + 4 + pI * 16);
          ctx.stroke();
        }
        ctx.lineWidth = 2;
        winRow(pad + bw - 66, topY + 70, 1, 28, 32, 0);
      } else {
        // два окна по бокам от двери
        winRow(pad + 14, topY + 70, 1, 28, 32, 0);
        winRow(pad + 130, topY + 70, 1, 28, 32, 0);
      }
      door(pad + bw / 2 - 19, topY + bh - 68, 38, 58);
      // трещины
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
