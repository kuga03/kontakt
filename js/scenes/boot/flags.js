
export function generateFlagArt(key) {
    const COLS = {
      flag_ally: { base: '#2c5aa0', dark: '#1c3a6e', lite: '#5a8ad0', badge: '#dfe8f4', star: '#2c5aa0' },
      flag_foe: { base: '#a02c2c', dark: '#6e1c1c', lite: '#d05a5a', badge: '#f0e2e2', star: '#a02c2c' },
      flag_neutral: { base: '#9a9a9a', dark: '#6e6e6e', lite: '#c8c8c8', badge: '#3a3a3a', star: '#9a9a9a' }
    };
    const c = COLS[key];
    if (!c) return false;
    if (this.textures.exists(key)) return true;
    const W = 132, H = 296;
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    const edge = 'rgba(8,8,12,0.75)';
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    // полотнище: от древка влево, свободный край трепещет фестонами
    const cx0 = 14, cx1 = 116, cyT = 30, cyB = 232;
    const cloth = () => {
      ctx.beginPath();
      ctx.moveTo(cx1, cyT);
      ctx.quadraticCurveTo((cx0 + cx1) / 2, cyT + 10, cx0 + 8, cyT + 18);
      ctx.quadraticCurveTo(cx0 - 2, cyT + 70, cx0 + 6, cyT + 110);
      ctx.quadraticCurveTo(cx0 - 2, cyT + 150, cx0 + 8, cyB - 14);
      ctx.quadraticCurveTo((cx0 + cx1) / 2, cyB + 8, cx1, cyB - 6);
      ctx.lineTo(cx1, cyT);
      ctx.closePath();
    };
    ctx.fillStyle = c.base;
    cloth();
    ctx.fill();
    // глубина ткани: тень у древка + свет в середине
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(cx1 - 16, cyT + 4, 16, cyB - cyT - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(cx0 + 30, cyT + 12, 22, cyB - cyT - 24);
    // складки: волнистые вертикали (тёмные долины + светлые гребни)
    const fold = (fx, col, lw) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(fx, cyT + 14);
      ctx.quadraticCurveTo(fx - 7, (cyT + cyB) / 2, fx + 2, cyB - 12);
      ctx.stroke();
    };
    fold(44, 'rgba(0,0,0,0.3)', 9);
    fold(72, 'rgba(255,255,255,0.16)', 6);
    fold(94, 'rgba(0,0,0,0.3)', 9);
    fold(58, 'rgba(255,255,255,0.1)', 4);
    // стежка по периметру (пунктир, с отступом внутрь)
    try {
      if (ctx.setLineDash) ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx1 - 8, cyT + 8);
      ctx.quadraticCurveTo((cx0 + cx1) / 2, cyT + 16, cx0 + 13, cyT + 23);
      ctx.quadraticCurveTo(cx0 + 4, cyT + 72, cx0 + 11, cyT + 108);
      ctx.quadraticCurveTo(cx0 + 4, cyT + 146, cx0 + 13, cyB - 19);
      ctx.quadraticCurveTo((cx0 + cx1) / 2, cyB + 1, cx1 - 8, cyB - 12);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    } catch (e) {}
    // контур полотнища
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    cloth();
    ctx.stroke();
    // тканое зерно (только безопасная середина — без выползания за край)
    let seed = 11;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 46; i++) {
      ctx.fillRect(Math.round(cx0 + 12 + rnd() * (cx1 - cx0 - 26)), Math.round(cyT + 22 + rnd() * (cyB - cyT - 44)), 2, 2);
    }
    // шеврон команды
    const star = (sx, sy, r, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.45 : r;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };
    if (key === 'flag_neutral') {
      // кольцо + точка
      ctx.strokeStyle = c.badge;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(64, 132, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = c.badge;
      ctx.beginPath();
      ctx.arc(64, 132, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (key === 'flag_ally') {
      // щит + звезда
      ctx.fillStyle = c.badge;
      ctx.beginPath();
      ctx.moveTo(42, 108);
      ctx.lineTo(86, 108);
      ctx.lineTo(86, 132);
      ctx.quadraticCurveTo(86, 150, 64, 160);
      ctx.quadraticCurveTo(42, 150, 42, 132);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      star(64, 131, 13, c.star);
    } else {
      // ромб + звезда
      ctx.fillStyle = c.badge;
      ctx.beginPath();
      ctx.moveTo(64, 104);
      ctx.lineTo(88, 132);
      ctx.lineTo(64, 160);
      ctx.lineTo(40, 132);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      star(64, 132, 12, c.star);
    }
    // древко справа поверх кромки полотнища (удлинённое вниз и вверх)
    ctx.fillStyle = '#4a3428';
    ctx.fillRect(116, 6, 8, 274);
    ctx.fillStyle = 'rgba(255,240,210,0.2)';
    ctx.fillRect(117, 6, 2, 274);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(121, 6, 3, 274);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(116, 6, 8, 274);
    // кольца-обоймы
    [62, 182].forEach(ry => {
      ctx.fillStyle = '#2c2c34';
      ctx.fillRect(114, ry, 12, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(114, ry, 12, 2);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(114, ry, 12, 6);
    });
    // рукава-петли полотнища на древке
    [44, 128, 208].forEach(ry => {
      ctx.fillStyle = c.dark;
      ctx.fillRect(112, ry, 16, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(112, ry, 16, 2);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(112, ry, 16, 11);
    });
    // остриё внизу (вбит в землю) + навершие-шар
    ctx.fillStyle = '#3a2a20';
    ctx.beginPath();
    ctx.moveTo(116, 280);
    ctx.lineTo(124, 280);
    ctx.lineTo(120, 294);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#d8a83a';
    ctx.beginPath();
    ctx.arc(120, 12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(117, 9, 3, 0, Math.PI * 2);
    ctx.fill();
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Рисованный щит команды (бейджи — тоже кодом, PNG удалены): стальной
  // обод с заклёпками, поле цвета команды, эмблема (звезда/молния).
  // Пропорции 26x32 / 30x37 в HUD и меню — холст 64x80, код не трогаем.
export function generateBadgeArt(key) {
    const isBlue = key === 'badge_blue';
    if (!isBlue && key !== 'badge_red') return false;
    if (this.textures.exists(key)) return true;
    const W = 64, H = 80;
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    const edge = 'rgba(8,8,12,0.8)';
    const field = isBlue ? '#2c5aa0' : '#a02c2c';
    const fieldD = isBlue ? '#1c3a6e' : '#6e1c1c';
    const fieldL = isBlue ? '#5a8ad0' : '#d05a5a';
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    // Арт впритык к краям (старый PNG был без полей — иначе на тех же
    // 26x32 щит кажется меньше). Показ не трогаем.
    try { ctx.save(); ctx.translate(32, 40); ctx.scale(1.15, 1.15); ctx.translate(-32, -40); } catch (e) {}
    const shield = (inset) => {
      ctx.beginPath();
      ctx.moveTo(6 + inset, 8 + inset);
      ctx.lineTo(W - 6 - inset, 8 + inset);
      ctx.lineTo(W - 6 - inset, 42);
      ctx.quadraticCurveTo(W - 6 - inset, 60, W / 2, 72 - inset);
      ctx.quadraticCurveTo(6 + inset, 60, 6 + inset, 42);
      ctx.closePath();
    };
    // стальной обод
    ctx.fillStyle = '#6a7078';
    shield(0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(9, 10, W - 18, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(9, H - 14, W - 18, 3);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    shield(0);
    ctx.stroke();
    // поле команды
    ctx.fillStyle = field;
    shield(6);
    ctx.fill();
    ctx.fillStyle = fieldL;
    ctx.fillRect(14, 16, W - 28, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(14, H - 24, W - 28, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    shield(6);
    ctx.stroke();
    // заклёпки на ободе
    ctx.fillStyle = '#c8ccd4';
    [[16, 12], [W - 16, 12]].forEach(([rx, ry]) => {
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(rx - 1, ry + 1, 2, 1);
      ctx.fillStyle = '#c8ccd4';
    });
    // эмблема по центру
    ctx.fillStyle = '#eef2f8';
    if (isBlue) {
      // звезда
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? 7 : 15;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = 32 + Math.cos(a) * rr, py = 40 + Math.sin(a) * rr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = fieldD;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // молния
      ctx.beginPath();
      ctx.moveTo(38, 22);
      ctx.lineTo(26, 44);
      ctx.lineTo(34, 44);
      ctx.lineTo(26, 60);
      ctx.lineTo(42, 38);
      ctx.lineTo(34, 38);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = fieldD;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // блик по диагонали
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(14, 62);
    ctx.lineTo(30, 62);
    ctx.lineTo(18, 20);
    ctx.lineTo(12, 20);
    ctx.closePath();
    ctx.fill();
    try { ctx.restore(); } catch (e) {}
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Индивидуальный бейдж банды (стиль командных щитов, поле — цвет банды):
  // своя — корона, Синдром — когти, Рой — рой точек, Химера — глаза.
  // Холст 64x80, как badge_*.
export function generateGangBadge(key) {
    const G = {
      gang_player: { field: '#1f8a4d', dark: '#146032', lite: '#4ec47e' },
      gang_syndicate: { field: '#b03030', dark: '#7a1e1e', lite: '#e06060' },
      gang_swarm: { field: '#7a2cc0', dark: '#551a8a', lite: '#b46aee' },
      gang_chimera: { field: '#3a6ab0', dark: '#264a80', lite: '#7aaae0' }
    };
    const c = G[key];
    if (!c) return false;
    if (this.textures.exists(key)) return true;
    const W = 64, H = 80;
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    const edge = 'rgba(8,8,12,0.8)';
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    // Арт впритык к краям — как у командных щитов.
    try { ctx.save(); ctx.translate(32, 40); ctx.scale(1.15, 1.15); ctx.translate(-32, -40); } catch (e) {}
    const shield = (inset) => {
      ctx.beginPath();
      ctx.moveTo(6 + inset, 8 + inset);
      ctx.lineTo(W - 6 - inset, 8 + inset);
      ctx.lineTo(W - 6 - inset, 42);
      ctx.quadraticCurveTo(W - 6 - inset, 60, W / 2, 72 - inset);
      ctx.quadraticCurveTo(6 + inset, 60, 6 + inset, 42);
      ctx.closePath();
    };
    // стальной обод
    ctx.fillStyle = '#6a7078';
    shield(0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(9, 10, W - 18, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(9, H - 14, W - 18, 3);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    shield(0);
    ctx.stroke();
    // поле банды
    ctx.fillStyle = c.field;
    shield(6);
    ctx.fill();
    ctx.fillStyle = c.lite;
    ctx.fillRect(14, 16, W - 28, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(14, H - 24, W - 28, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    shield(6);
    ctx.stroke();
    // заклёпки
    ctx.fillStyle = '#c8ccd4';
    [[16, 12], [W - 16, 12]].forEach(([rx, ry]) => {
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // эмблема
    ctx.fillStyle = '#eef2f8';
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 2;
    if (key === 'gang_player') {
      // корона: band + 3 зубца + камни
      ctx.fillRect(20, 44, 24, 10);
      ctx.strokeRect(20, 44, 24, 10);
      ctx.beginPath();
      ctx.moveTo(20, 44);
      ctx.lineTo(18, 28);
      ctx.lineTo(27, 36);
      ctx.lineTo(32, 24);
      ctx.lineTo(37, 36);
      ctx.lineTo(46, 28);
      ctx.lineTo(44, 44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.dark;
      ctx.fillRect(24, 47, 4, 4);
      ctx.fillRect(36, 47, 4, 4);
    } else if (key === 'gang_syndicate') {
      // когти: три рваных росчерка (левая не впритык к краю поля)
      for (let i = 0; i < 3; i++) {
        const ox = 25 + i * 8;
        ctx.beginPath();
        ctx.moveTo(ox, 24);
        ctx.quadraticCurveTo(ox - 2, 38, ox - 4, 58);
        ctx.lineTo(ox - 1, 58);
        ctx.quadraticCurveTo(ox + 1, 38, ox + 4, 24);
        ctx.closePath();
        ctx.fill();
      }
    } else if (key === 'gang_swarm') {
      // рой: горсть точек разного калибра
      [[24, 30, 4], [34, 26, 3], [42, 32, 4.5], [28, 42, 3], [38, 44, 4], [32, 54, 3], [44, 52, 2.5], [22, 52, 2.5]].forEach(([hx, hy, hr]) => {
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = c.dark;
      [[34, 26, 1.5], [42, 32, 2], [38, 44, 1.5]].forEach(([hx, hy, hr]) => {
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      // химера: два глаза с бровью
      [[25, 40], [39, 40]].forEach(([ex, ey]) => {
        ctx.beginPath();
        ctx.arc(ex, ey, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.dark;
        ctx.beginPath();
        ctx.arc(ex, ey + 1, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#eef2f8';
      });
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(15, 30);
      ctx.lineTo(32, 26);
      ctx.moveTo(49, 30);
      ctx.lineTo(32, 26);
      ctx.stroke();
    }
    // блик по диагонали
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(14, 62);
    ctx.lineTo(30, 62);
    ctx.lineTo(18, 20);
    ctx.lineTo(12, 20);
    ctx.closePath();
    ctx.fill();
    try { ctx.restore(); } catch (e) {}
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Платформы по темам (геймдизайн): у каждой темы свой материал, но у всех
  // светлая верхняя кромка — платформа обязана читаться на фоне (не сливаться).
  // Плитка 240x16 (тайлится, стыки каждые 60; тонкие h8 показывают верх).
  // waste — ржавый бетон, desert — песчаник, ind — сталь с hazard-кромкой,
  // caves — скала со светящейся кромкой в цвет темы, city/sunset — металл.
