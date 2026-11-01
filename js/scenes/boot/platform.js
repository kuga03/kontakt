
export function generatePlatformArt(key) {
    const P = {
      platform_city:   { body: '#3d4a6e', dark: '#232a44', lite: '#a8c0e8', kind: 'rivets' },
      platform_sunset: { body: '#4a3048', dark: '#2a1a28', lite: '#e8a06a', kind: 'rivets' },
      platform_waste:  { body: '#4a4136', dark: '#2a241c', lite: '#d0b880', kind: 'rust' },
      platform_desert: { body: '#6e5638', dark: '#453522', lite: '#e8d090', kind: 'cracks' },
      platform_ind:    { body: '#2e3438', dark: '#161a1c', lite: '#d8a83a', kind: 'hazard' },
      platform_cave1:  { body: '#1a201c', dark: '#0a0d0b', lite: '#3fae72', kind: 'rock' },
      platform_cave2:  { body: '#1a1e26', dark: '#0a0c12', lite: '#5a8ad0', kind: 'rock' }
    };
    const p = P[key];
    if (!p) return false;
    if (this.textures.exists(key)) return true;
    const W = 240, H = 16;
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    let seed = 13;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    const edge = 'rgba(5,5,10,0.85)';
    // тело
    ctx.fillStyle = p.body;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 4, W, 6);
    // верхняя кромка — светлая всегда (читаемость)
    if (p.kind === 'hazard') {
      // сигнальная кромка: жёлто-чёрные блоки
      for (let bx = 0; bx < W; bx += 24) {
        ctx.fillStyle = (bx / 24) % 2 ? '#141414' : p.lite;
        ctx.fillRect(bx, 0, Math.min(24, W - bx), 3);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, 0, W, 1);
    } else {
      ctx.fillStyle = p.lite;
      ctx.fillRect(0, 0, W, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, 0, W, 1);
    }
    ctx.fillStyle = p.dark;
    ctx.fillRect(0, 3, W, 1);
    // стыки панелей каждые 60px
    ctx.fillStyle = p.dark;
    for (let px = 0; px <= W; px += 60) ctx.fillRect(px, 4, 1, 7);
    // детали материала
    if (p.kind === 'rivets') {
      for (let px = 30; px < W; px += 60) {
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.arc(px, 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.lite;
        ctx.beginPath();
        ctx.arc(px, 8, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === 'rust') {
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = rnd() < 0.6 ? 'rgba(150,80,30,0.55)' : 'rgba(0,0,0,0.35)';
        ctx.fillRect(Math.round(rnd() * W), Math.round(4 + rnd() * 6), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 4));
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.moveTo(40, 5);
      ctx.lineTo(52, 8);
      ctx.lineTo(64, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (p.kind === 'cracks') {
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        let lx = rnd() * W, ly = 5 + rnd() * 3;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        for (let s = 0; s < 3; s++) {
          lx += (rnd() - 0.5) * 14;
          ly += 2 + rnd() * 3;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(Math.round(rnd() * W), Math.round(5 + rnd() * 7), 2 + Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 2));
      }
    } else if (p.kind === 'rock') {
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = rnd() < 0.4 ? p.lite : 'rgba(0,0,0,0.5)';
        ctx.globalAlpha = 0.25 + rnd() * 0.4;
        ctx.fillRect(Math.round(rnd() * W), Math.round(4 + rnd() * 9), 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 2));
      }
      try { ctx.globalAlpha = 1; } catch (e) {}
    }
    // низ: тень и кромка
    ctx.fillStyle = p.dark;
    ctx.fillRect(0, 11, W, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 15, W, 1);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Значки статов для шапок командных таблиц (вместо букв Ф/С/ФЛ/УРОН/ПИНГ/КПД).
  // Холст 20x20, показ ~14px. Фолбэк на буквы — на местах (exists-check).
  // Пуля — детализированный патрон (не как трассеры в бою): латунная гильза
  // с капсюлем + медная пуля с каннелюрами.
export function generateStatIcon(key) {
    const KNOWN = ['icon_stat_frags', 'icon_stat_deaths', 'icon_stat_flag', 'icon_stat_kpd', 'icon_stat_damage', 'icon_stat_ping'];
    if (!KNOWN.includes(key)) return false;
    if (this.textures.exists(key)) return true;
    const W = 20, H = 20;
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    const edge = 'rgba(8,8,12,0.85)';
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    if (key === 'icon_stat_frags') {
      // прицел: кольцо + точка + риски
      ctx.strokeStyle = '#e8ecf4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(10, 10, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff5555';
      ctx.beginPath();
      ctx.arc(10, 10, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8ecf4';
      [[10, 1, 10, 4], [10, 16, 10, 19], [1, 10, 4, 10], [16, 10, 19, 10]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
    } else if (key === 'icon_stat_deaths') {
      // череп: купол + глаза + челюсть
      ctx.fillStyle = '#c8ccd4';
      ctx.beginPath();
      ctx.arc(10, 9, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(6, 12, 8, 4);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 12, 8, 4);
      ctx.fillStyle = '#14141c';
      ctx.beginPath();
      ctx.arc(7.5, 9, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(12.5, 9, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(9.4, 6.5, 1.2, 2.5);
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.moveTo(8, 14);
      ctx.lineTo(8, 16);
      ctx.moveTo(12, 14);
      ctx.lineTo(12, 16);
      ctx.stroke();
    } else if (key === 'icon_stat_flag') {
      // мини-флаг: древко + трепещущее полотнище
      ctx.fillStyle = '#5a4a38';
      ctx.fillRect(4, 2, 2, 16);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(6, 3);
      ctx.lineTo(16, 6);
      ctx.lineTo(6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#d8a83a';
      ctx.fillRect(3, 1, 4, 2);
    } else if (key === 'icon_stat_kpd') {
      // КПД: звезда рейтинга в тёмном круге
      ctx.fillStyle = '#1c2438';
      ctx.beginPath();
      ctx.arc(10, 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? 2.4 : 5.6;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = 10 + Math.cos(a) * rr, py = 10 + Math.sin(a) * rr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7a5a12';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (key === 'icon_stat_damage') {
      // Пуля горизонтально (носик справа): рисуем повёрнутым контекстом.
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-W / 2, -H / 2);
      // патрон крупно: гильза + пуля (не трассер из боя)
      // гильза
      ctx.fillStyle = '#c8a83a';
      ctx.fillRect(7, 10, 6, 7);
      ctx.fillStyle = 'rgba(255,240,200,0.5)';
      ctx.fillRect(8, 10, 1.5, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(11, 10, 2, 7);
      // закраина + капсюль
      ctx.fillStyle = '#8a6e20';
      ctx.fillRect(6, 16, 8, 2.5);
      ctx.fillStyle = '#5a4a20';
      ctx.beginPath();
      ctx.arc(10, 17.2, 1.6, 0, Math.PI * 2);
      ctx.fill();
      // пуля: медный носик
      ctx.fillStyle = '#b46a3a';
      ctx.beginPath();
      ctx.moveTo(7, 10);
      ctx.lineTo(13, 10);
      ctx.lineTo(12, 4.5);
      ctx.lineTo(10, 2.5);
      ctx.lineTo(8, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,170,0.55)';
      ctx.fillRect(8.4, 5, 1.6, 4.5);
      // каннелюры
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(7.2, 7, 5.6, 1);
      ctx.fillRect(7.2, 8.6, 5.6, 1);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(7, 10, 6, 7);
      ctx.beginPath();
      ctx.moveTo(7, 10);
      ctx.lineTo(13, 10);
      ctx.lineTo(12, 4.5);
      ctx.lineTo(10, 2.5);
      ctx.lineTo(8, 4.5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    } else {
      // пинг: три растущие полосы
      ctx.fillStyle = '#35d07f';
      ctx.fillRect(3, 12, 4, 6);
      ctx.fillRect(8, 8, 4, 10);
      ctx.fillRect(13, 4, 4, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(3, 12, 4, 2);
      ctx.fillRect(8, 8, 4, 2);
      ctx.fillRect(13, 4, 4, 2);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.strokeRect(3, 12, 4, 6);
      ctx.strokeRect(8, 8, 4, 10);
      ctx.strokeRect(13, 4, 4, 14);
    }
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Рисованные здания для декора карт (стиль игры): фасады с вывесками,
  // витринами, дверями. PNG не грузим (см. список выше). true = нарисовано.
