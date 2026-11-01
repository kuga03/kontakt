
export function generatePickupArt(key) {
    const KNOWN = ['medkit', 'ammo_kit', 'armor_kit', 'frag_granade', 'smoke_granade'];
    if (!KNOWN.includes(key)) return false;
    if (this.textures.exists(key)) return true;
    const W = 64, H = 64;
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    let seed = 0;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const edge = 'rgba(10,10,14,0.9)';
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    // мягкая тень под предметом — всем, кроме гранат: они летают
    // и крутятся (тень бы оказалась сверху), им тень даёт Pickup отдельно.
    if (key !== 'frag_granade' && key !== 'smoke_granade') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(W / 2, H - 7, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (key === 'medkit') {
      // белый кейс с красным крестом
      ctx.fillStyle = '#f2f4f8';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(8, 14, 48, 40, 8);
      else ctx.rect(8, 14, 48, 40);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      ctx.stroke();
      // крышка-шов
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(10, 26, 44, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(12, 16, 20, 4);
      // крест
      ctx.fillStyle = '#8a1622';
      ctx.fillRect(26, 30, 12, 24);
      ctx.fillRect(20, 36, 24, 12);
      ctx.fillStyle = '#e8334a';
      ctx.fillRect(27, 29, 10, 24);
      ctx.fillRect(21, 35, 22, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(28, 30, 3, 10);
      ctx.fillRect(22, 36, 8, 3);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(26, 30, 12, 24);
      ctx.strokeRect(20, 36, 24, 12);
      // защёлки
      [16, 44].forEach(lx => {
        ctx.fillStyle = '#9aa0ac';
        ctx.fillRect(lx, 12, 6, 8);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(lx, 12, 6, 8);
        ctx.fillStyle = '#1c1c22';
        ctx.fillRect(lx + 2, 15, 2, 3);
      });
    } else if (key === 'ammo_kit') {
      // ящик патронов: латунь поверх оливы + трафарет
      ctx.fillStyle = '#434a26';
      ctx.fillRect(10, 30, 44, 24);
      ctx.fillStyle = '#5a6234';
      ctx.fillRect(10, 30, 44, 14);
      ctx.fillStyle = 'rgba(255,250,220,0.18)';
      ctx.fillRect(10, 30, 44, 3);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 30, 44, 24);
      // тёмное нутро + 5 латунных носиков
      ctx.fillStyle = '#1c1e12';
      ctx.fillRect(13, 24, 38, 8);
      for (let i = 0; i < 5; i++) {
        const bx = 16 + i * 7;
        ctx.fillStyle = '#8a6a1a';
        ctx.fillRect(bx, 18, 5, 10);
        ctx.fillStyle = '#d8b400';
        ctx.fillRect(bx, 16, 5, 9);
        ctx.fillStyle = '#ffe97a';
        ctx.fillRect(bx + 1, 16, 2, 9);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, 16, 5, 12);
      }
      // уголки + трафарет
      ctx.fillStyle = '#2e3319';
      [[10, 30], [50, 30], [10, 50], [50, 50]].forEach(([rx, ry]) => {
        ctx.beginPath();
        ctx.arc(rx + 2, ry + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      try {
        ctx.fillStyle = 'rgba(240,235,210,0.85)';
        ctx.font = 'bold 9px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('7.62', W / 2, 47);
      } catch (e) {}
    } else if (key === 'armor_kit') {
      // синий бронежилет фасом: плита, лямки, пряжки, блик
      ctx.fillStyle = '#223388';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(14, 10, 36, 46, 10);
      else ctx.rect(14, 10, 36, 46);
      ctx.fill();
      ctx.fillStyle = '#3355cc';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(17, 13, 30, 40, 8);
      else ctx.rect(17, 13, 30, 40);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(14, 10, 36, 46, 10);
      else ctx.rect(14, 10, 36, 46);
      ctx.stroke();
      // центральный шов-плита
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(30, 14, 4, 38);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(19, 15, 5, 36);
      // лямки + пряжки
      [21, 39].forEach(sx => {
        ctx.fillStyle = '#1a1c44';
        ctx.fillRect(sx, 6, 6, 12);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, 6, 6, 12);
        ctx.fillStyle = '#9aa3b5';
        ctx.fillRect(sx - 1, 15, 8, 6);
        ctx.strokeStyle = edge;
        ctx.strokeRect(sx - 1, 15, 8, 6);
        ctx.fillStyle = '#1c1c22';
        ctx.fillRect(sx + 2, 17, 2, 2);
      });
      // шеврон
      ctx.fillStyle = '#7d9bff';
      ctx.beginPath();
      ctx.moveTo(32, 34);
      ctx.lineTo(40, 42);
      ctx.lineTo(32, 50);
      ctx.lineTo(24, 42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // гранаты: цвет сразу в арте (полётный тинт убран — в HUD и в полёте
      // один и тот же вид). Осколочная — зелёный овал с рёбрами, дымовая —
      // серый цилиндр-шашка с крышкой и боковым кольцом (свой форм-фактор).
      const frag = key === 'frag_granade';
      // корпус-овал — только осколочной; у дымовой свой цилиндр ниже
      if (frag) {
        ctx.fillStyle = '#5f7a2a';
        ctx.beginPath();
        ctx.ellipse(W / 2, 38, 15, 17, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // рёбра/пояски
      if (frag) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        [28, 36, 44].forEach(ry => ctx.fillRect(18, ry, 28, 3));
        ctx.fillStyle = '#7a9440';
        [26, 34, 42].forEach(ry => ctx.fillRect(20, ry, 12, 2));
      } else {
        // ДЫМОВАЯ ШАШКА — свой форм-фактор (не овал как осколочная):
        // цилиндр с крышкой, боковым кольцом и вентилями снизу.
        // корпус-цилиндр
        ctx.fillStyle = '#9aa0ac';
        ctx.fillRect(22, 16, 20, 40);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(24, 16, 4, 40);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(36, 16, 6, 40);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(22, 16, 20, 40);
        // верхний/нижний ободки цилиндра
        ctx.fillStyle = '#6e727c';
        ctx.beginPath();
        ctx.ellipse(32, 16, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(32, 56, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(32, 56, 10, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        // белая маркировочная полоса + точки
        ctx.fillStyle = 'rgba(230,235,240,0.9)';
        ctx.fillRect(22, 26, 20, 7);
        ctx.fillStyle = '#4a4e58';
        ctx.fillRect(26, 28, 3, 3);
        ctx.fillRect(32, 28, 3, 3);
        ctx.fillRect(38, 28, 3, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(22, 33, 20, 2);
        // потёртости
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
          ctx.fillRect(Math.round(23 + rnd() * 17), Math.round(38 + rnd() * 8), 2 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 2));
        }
        // вентили снизу
        ctx.fillStyle = '#565a64';
        ctx.fillRect(22, 48, 20, 8);
        ctx.fillStyle = 'rgba(8,8,10,0.9)';
        [26, 31, 36, 41].forEach(hx => {
          ctx.beginPath();
          ctx.arc(hx, 52, 1.8, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(22, 48, 20, 8);
      }
      if (frag) {
        // контур овала + горловина + рычаг + кольцо + чека + блик
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(W / 2, 38, 15, 17, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#8a8e96';
        ctx.fillRect(27, 14, 10, 9);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(27, 14, 10, 9);
        ctx.fillStyle = '#a8acb6';
        ctx.fillRect(36, 12, 5, 16);
        ctx.strokeStyle = edge;
        ctx.strokeRect(36, 12, 5, 16);
        ctx.strokeStyle = '#565a64';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(45, 14, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(45, 14, 7, -2.4, -1.2);
        ctx.stroke();
        ctx.fillStyle = '#d8b400';
        ctx.fillRect(24, 10, 8, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(26, 32, 4, 8, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // крышка шашки + боковое кольцо с чекой
        ctx.fillStyle = '#6e727c';
        ctx.fillRect(20, 9, 24, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(20, 9, 24, 2);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 9, 24, 7);
        // насечка крышки
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let kx = 23; kx < 42; kx += 4) ctx.fillRect(kx, 10, 2, 5);
        // чека сбоку + кольцо
        ctx.fillStyle = '#d8b400';
        ctx.fillRect(44, 11, 5, 3);
        ctx.strokeStyle = '#565a64';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(54, 12, 5.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(54, 12, 5.5, -2.4, -1.2);
        ctx.stroke();
        // блик на цилиндре
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(26, 24, 3, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // пылинки
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(Math.round(10 + rnd() * 44), Math.round(10 + rnd() * 44), 2, 2);
    }
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Снаряд РПГ: холст 28x10, нос вправо (спрайт крутится под угол полёта,
  // показ 1.4 → ~39x14: чуть больше старой 25x8, не лопасть. Плюс
  // оранжевый трассер сзади. PNG пока лежит (на оценку). true = нарисовано.
export function generateRocketArt() {
    const key = 'bullet_RPG';
    if (this.textures.exists(key)) return true;
    const W = 28, H = 10;
    const ct = this.textures.createCanvas(key, W, H);
    if (!ct || !ct.context) {
      try { this.textures.remove(key); } catch (e) {}
      return false;
    }
    const ctx = ct.context;
    const edge = 'rgba(10,10,14,0.9)';
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    // стабилизаторы сверху/снизу
    ctx.fillStyle = '#4a5228';
    [7, 13].forEach(fx => {
      ctx.beginPath();
      ctx.moveTo(fx, 3);
      ctx.lineTo(fx + 3, 0);
      ctx.lineTo(fx + 6, 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx, 7);
      ctx.lineTo(fx + 3, 10);
      ctx.lineTo(fx + 6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    // корпус
    ctx.fillStyle = '#5a6234';
    ctx.fillRect(5, 3, 15, 4);
    ctx.fillStyle = '#7a8448';
    ctx.fillRect(5, 3, 15, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(5, 6, 15, 1);
    // медный поясок
    ctx.fillStyle = '#b46a3a';
    ctx.fillRect(18, 3, 2, 4);
    // боеголовка-конус носом вправо
    ctx.fillStyle = '#434a26';
    ctx.beginPath();
    ctx.moveTo(20, 2);
    ctx.lineTo(27, 5);
    ctx.lineTo(20, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.stroke();
    // белая полоса-маркировка
    ctx.fillStyle = '#d8d4c4';
    ctx.fillRect(8, 4, 3, 2);
    ctx.strokeStyle = edge;
    ctx.strokeRect(5, 3, 15, 4);
    // сопло сзади
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(2, 4, 3, 2);
    ctx.strokeStyle = edge;
    ctx.strokeRect(2, 4, 3, 2);
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Рисованный флаг (флаги/бомбы больше не PNG — решение владельца 15.10.2026,
  // нужен детализированный): древко СПРАВА (Flag.js целит шестом: POLE_DX),
  // полотнище с фестонами, складки, стежка, шеврон команды. Пропорции кадра
  // как у старого PNG (36x77, 48x103 в КОТХ) — математику показа не трогаем.
  // Нейтральный — светло-серый: золотой флаг внезапной смерти красится
  // тинтом поверх него.
