
export function generateMapArt(key) {
    const SIZES = {
      map_barrel: [64, 64], map_wall_iron2: [128, 128], map_wall_metal: [128, 128],
      map_wire: [132, 96], map_rabica: [120, 96], map_eji: [96, 96],
      map_crate: [120, 100],
      map_jerry: [40, 52], map_ammo: [66, 40], map_tires: [60, 44], map_crate_stack: [56, 62]
    };
    let sz = SIZES[key];
    // Варианты бочек живут под map_barrel1..9 тем же размером.
    if (!sz && /^map_barrel[1-9]$/.test(key)) sz = [64, 64];
    if (!sz) return false;
    if (this.textures.exists(key)) return true;
    const W = sz[0], H = sz[1];
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
    const R = (a, b) => a + rnd() * (b - a);
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}

    if (key === 'map_barrel' || /^map_barrel[1-9]$/.test(key)) {
      // Бочки: 10 фасонов. 'map_barrel' — классическая ржавая (вариант 0),
      // map_barrel1..9 — армейская, синяя, оливковая с жёлтой полосой,
      // стальная, медпункт со крестом, светлая, тёмная, хим-ромб, старая
      // ржавь. Размер один (64x64) — ключи карт не меняются.
      const v = key === 'map_barrel' ? 0 : parseInt(key.slice(-1), 10);
      const bv = [
        ['#d08040', '#b06028', '#5d3016', '#4e2812', null, 0],
        ['#7a9a5e', '#5f7a44', '#466032', '#3a4e28', '#e8e0c8', 1],
        ['#5a7fae', '#44659a', '#2f4a74', '#263c60', null, 0],
        ['#77794f', '#616341', '#47492f', '#3b3d27', '#d8b23c', 1],
        ['#8a9098', '#6f767e', '#565c64', '#4a5058', null, 0],
        ['#9a5044', '#7e3f36', '#5e2e28', '#4e2620', '#e8e0c8', 3],
        ['#a8a094', '#8c8579', '#6a6459', '#5a544c', '#4a7a4e', 1],
        ['#4e5044', '#3e4038', '#2e3028', '#262822', null, 0],
        ['#b09a3a', '#8f7c2c', '#6a5c20', '#554a18', '#26261e', 4],
        ['#8a6244', '#6e4c34', '#513826', '#412d1f', null, 0]
      ][v];
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, bv[0]);
      bg.addColorStop(0.45, bv[1]);
      bg.addColorStop(1, bv[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(2, 4, W - 4, H - 8);
      // знак/полоса (фон корпуса сразу различит фасоны)
      if (bv[5] === 1) {
        ctx.fillStyle = bv[4];
        ctx.fillRect(2, 27, W - 4, 9);
      } else if (bv[5] === 3) {
        ctx.fillStyle = bv[4];
        ctx.fillRect(W / 2 - 5, 16, 10, H - 38);
        ctx.fillRect(W / 2 - 13, 28, 26, 4);
      } else if (bv[5] === 4) {
        ctx.save();
        ctx.translate(W / 2, 32);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = bv[4];
        ctx.fillRect(-10, -10, 20, 20);
        ctx.restore();
      }
      // рёбра
      [14, 32, 50].forEach(y => {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(2, y, W - 4, 4);
        ctx.fillStyle = 'rgba(255,220,170,0.3)';
        ctx.fillRect(2, y, W - 4, 1.5);
      });
      // крышка
      ctx.fillStyle = bv[3];
      ctx.fillRect(2, 2, W - 4, 5);
      ctx.fillStyle = 'rgba(255,220,170,0.25)';
      ctx.fillRect(2, 2, W - 4, 1.5);
      // дно-тень
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(2, H - 6, W - 4, 4);
      // ржавчина: у ржавых фасонов больше
      const rustN = (v === 0 || v === 9) ? 26 : 9;
      for (let i = 0; i < rustN; i++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(90,40,15,0.5)' : 'rgba(60,25,10,0.5)';
        const rx = 3 + rnd() * (W - 8), ry = 6 + rnd() * (H - 14);
        ctx.fillRect(Math.round(rx), Math.round(ry), 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 2));
      }
      // потёки
      ctx.fillStyle = 'rgba(70,30,12,0.4)';
      ctx.fillRect(Math.round(14 + rnd() * (W - 30)), 8, 5, 26 + rnd() * 10);
      ctx.fillRect(Math.round(10 + rnd() * (W - 24)), 12, 4, 18);
      // контур
      ctx.strokeStyle = 'rgba(20,10,5,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 3, W - 4, H - 6);
    } else if (key === 'map_jerry') {
      // Канистра: зелёный металл, крышка-гайка, ручка-скоба, X-рёбра.
      ctx.fillStyle = '#4f6a3f';
      ctx.fillRect(4, 10, W - 8, H - 14);
      ctx.fillStyle = 'rgba(255,240,210,0.15)';
      ctx.fillRect(4, 10, W - 8, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(9, 15, W - 18, H - 24);
      ctx.beginPath();
      ctx.moveTo(11, 17);
      ctx.lineTo(W - 13, H - 11);
      ctx.moveTo(W - 13, 17);
      ctx.lineTo(11, H - 11);
      ctx.stroke();
      ctx.fillStyle = '#3a4f2f';
      ctx.fillRect(W / 2 - 8, 5, 16, 7);
      ctx.fillStyle = '#2b3a23';
      ctx.fillRect(W / 2 - 4, 2, 8, 5);
      ctx.strokeStyle = '#3a4f2f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2 + 8, 8);
      ctx.lineTo(W / 2 + 15, 8);
      ctx.lineTo(W / 2 + 15, 16);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(120,64,26,0.35)' : 'rgba(0,0,0,0.25)';
        ctx.fillRect(Math.round(6 + rnd() * (W - 14)), Math.round(12 + rnd() * (H - 22)), 2 + Math.floor(rnd() * 3), 2);
      }
      ctx.strokeStyle = 'rgba(12,16,10,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 10, W - 8, H - 14);
    } else if (key === 'map_ammo') {
      // Патронный ларец: длинный армейский, крышка с замками, маркировка.
      ctx.fillStyle = '#5f6a48';
      ctx.fillRect(2, 8, W - 4, H - 12);
      ctx.fillStyle = '#4c5639';
      ctx.fillRect(2, 8, W - 4, 6);
      ctx.fillStyle = 'rgba(255,240,210,0.14)';
      ctx.fillRect(2, 8, W - 4, 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(5, 11, W - 10, 8);
      ctx.fillStyle = '#2e3426';
      ctx.fillRect(8, 20, 6, 10);
      ctx.fillRect(W - 14, 20, 6, 10);
      ctx.save();
      ctx.translate(W / 2, 26);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = 'rgba(216,207,174,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
      ctx.strokeStyle = 'rgba(12,16,10,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 8, W - 4, H - 12);
    } else if (key === 'map_tires') {
      // Стопка шин: две шины друг на друге; резина + диски.
      const tire = (cy, r) => {
        ctx.fillStyle = '#1c1c20';
        ctx.beginPath();
        ctx.ellipse(W / 2, cy, W / 2 - 4, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(8,8,12,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#4a4e54';
        ctx.beginPath();
        ctx.ellipse(W / 2, cy, W / 5, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1c1c20';
        ctx.beginPath();
        ctx.ellipse(W / 2, cy, W / 10, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      tire(33, 13);
      tire(15, 11);
    } else if (key === 'map_crate_stack') {
      // Два ящика друг на друге (фасон createCover-ящиков).
      const miniCrate = (x, y2, w2, h2, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(x, y2, w2, h2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for (let i = 1; i < 3; i++) ctx.fillRect(x + 2, y2 + (h2 / 3) * i - 1, w2 - 4, 2);
        ctx.strokeStyle = 'rgba(78,58,34,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y2, w2, h2);
        ctx.strokeStyle = 'rgba(119,89,47,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 4, y2 + h2 - 4);
        ctx.lineTo(x + w2 - 4, y2 + 4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(168,131,79,0.9)';
        ctx.fillRect(x + 1, y2 + 1, w2 - 2, 2);
      };
      miniCrate(2, 34, W - 4, 26, '#7a6a4a');
      miniCrate(6, 4, W - 14, 28, '#8b6b43');
    } else if (key === 'map_wall_iron2') {
      // Профнастил: вертикальные гофры, болты, ржавые потёки.
      ctx.fillStyle = '#9aa0a8';
      ctx.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 16) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x, 0, 5, H);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(x + 10, 0, 6, H);
      }
      // горизонтальный шов
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, H / 2 - 1, W, 3);
      // болты + потёки
      for (let bx = 8; bx < W; bx += 24) {
        for (const by of [12, Math.round(H / 2) + 12]) {
          ctx.fillStyle = '#3c4046';
          ctx.beginPath();
          ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(bx - 1, by - 1, 2, 2);
          const ph = 14 + rnd() * 26;
          const pg = ctx.createLinearGradient(0, by, 0, by + ph);
          pg.addColorStop(0, 'rgba(150,80,30,0.55)');
          pg.addColorStop(1, 'rgba(150,80,30,0)');
          ctx.fillStyle = pg;
          ctx.fillRect(bx - 3, by + 3, 6, ph);
        }
      }
      // низ-грязь
      ctx.fillStyle = 'rgba(40,30,20,0.4)';
      ctx.fillRect(0, H - 12, W, 12);
      ctx.strokeStyle = 'rgba(15,15,20,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, W - 2, H - 2);
    } else if (key === 'map_wall_metal') {
      // Стальные плиты 2x2: швы, заклёпки, царапины.
      ctx.fillStyle = '#6a7078';
      ctx.fillRect(0, 0, W, H);
      const pw = W / 2, ph = H / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const px = i * pw, py = j * ph;
          const lg = ctx.createLinearGradient(px, py, px, py + ph);
          lg.addColorStop(0, 'rgba(255,255,255,0.14)');
          lg.addColorStop(1, 'rgba(0,0,0,0.22)');
          ctx.fillStyle = lg;
          ctx.fillRect(px + 2, py + 2, pw - 4, ph - 4);
          ctx.fillStyle = '#2c3036';
          [[8, 8], [pw - 8, 8], [8, ph - 8], [pw - 8, ph - 8]].forEach(([ox, oy]) => {
            ctx.beginPath();
            ctx.arc(px + ox, py + oy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(px + ox - 1, py + oy - 1, 2, 2);
            ctx.fillStyle = '#2c3036';
          });
        }
      }
      // швы-крест
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(pw - 2, 0, 4, H);
      ctx.fillRect(0, ph - 2, W, 4);
      // царапины
      ctx.strokeStyle = 'rgba(220,228,238,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const sx = rnd() * W, sy = rnd() * H;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + R(-24, 24), sy + R(-10, 10));
        ctx.stroke();
      }
      // ржавь по низу
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = 'rgba(140,75,30,0.4)';
        ctx.fillRect(Math.round(rnd() * W), H - 4 - Math.floor(rnd() * 8), 2 + Math.floor(rnd() * 4), 3);
      }
      ctx.strokeStyle = 'rgba(12,12,16,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, W - 2, H - 2);
    } else if (key === 'map_wire') {
      // Колючка: столбы + 3 нити с шипами и тёмными пятнами.
      const post = (x) => {
        ctx.fillStyle = '#4e3a26';
        ctx.fillRect(x - 5, 6, 10, H - 12);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 2, 6, 3, H - 12);
        ctx.fillStyle = '#33261a';
        ctx.fillRect(x - 7, 4, 14, 6);
        ctx.fillRect(x - 7, H - 10, 14, 6);
      };
      post(10); post(W - 10);
      [20, 48, 76].forEach((y, rI) => {
        ctx.strokeStyle = 'rgba(30,30,34,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.quadraticCurveTo(W / 2, y + 8, W - 10, y + (rI - 1) * 4);
        ctx.stroke();
        // шипы
        ctx.strokeStyle = 'rgba(60,60,66,0.95)';
        ctx.lineWidth = 2;
        for (let x = 20; x < W - 14; x += 13) {
          const wy = y + 8 * ((x - 10) / (W - 20)) * ((x - 10) / (W - 20));
          ctx.beginPath();
          ctx.moveTo(x, wy - 5);
          ctx.lineTo(x - 3, wy + 1);
          ctx.moveTo(x, wy - 5);
          ctx.lineTo(x + 3, wy + 1);
          ctx.stroke();
        }
        // тёмные пятна на средней нити
        if (rI === 1) {
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = 'rgba(110,18,18,0.5)';
            ctx.beginPath();
            ctx.arc(24 + rnd() * (W - 48), y + R(-4, 8), 2 + rnd() * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    } else if (key === 'map_rabica') {
      // Рабица: рама-столбы + ромбовидная сетка.
      const postM = (x) => {
        const pg = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
        pg.addColorStop(0, '#7c828a');
        pg.addColorStop(0.5, '#c8ced6');
        pg.addColorStop(1, '#5a6068');
        ctx.fillStyle = pg;
        ctx.fillRect(x - 6, 4, 12, H - 8);
        ctx.fillStyle = '#3a3e44';
        ctx.fillRect(x - 8, 0, 16, 7);
        ctx.fillRect(x - 8, H - 7, 16, 7);
      };
      postM(8); postM(W - 8);
      ctx.fillStyle = '#3a3e44';
      ctx.fillRect(8, 4, W - 16, 6);
      ctx.fillRect(8, H - 10, W - 16, 6);
      // сетка
      ctx.strokeStyle = 'rgba(150,158,168,0.9)';
      ctx.lineWidth = 2;
      const step = 15;
      ctx.save();
      ctx.beginPath();
      ctx.rect(10, 10, W - 20, H - 20);
      ctx.clip();
      for (let d = -H; d < W + H; d += step) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + H, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d + H, 0);
        ctx.lineTo(d, H);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(20,22,26,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(9, 9, W - 18, H - 18);
    } else if (key === 'map_eji') {
      // Противотанковый ёж: три угловатых двутавра, сваренные звездой.
      // Балки — плоскими гранями с рублеными торцами, не колбасой.
      const cx = W / 2, cy = H / 2 + 4;
      const beam = (ang) => {
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const nx = -dy, ny = dx;
        const len = 26, hw = 7;
        const P = (t, o) => [cx + dx * t + nx * o, cy + dy * t + ny * o];
        const quad = (pts) => {
          ctx.beginPath();
          pts.forEach(([px, py], idx) => {
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.fill();
        };
        // тёмная фаска-подложка пошире
        ctx.fillStyle = '#1c1c22';
        quad([P(-len - 2, -hw - 2), P(len + 2, -hw - 2), P(len + 2, hw + 2), P(-len - 2, hw + 2)]);
        // тело балки
        ctx.fillStyle = '#5d646e';
        quad([P(-len, -hw), P(len, -hw), P(len, hw), P(-len, hw)]);
        // верхняя грань-блик
        ctx.fillStyle = 'rgba(230,236,244,0.4)';
        quad([P(-len, -hw), P(len, -hw), P(len, -hw + 2.5), P(-len, -hw + 2.5)]);
        // V-паз уголка по центру
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(...P(-len + 3, 0));
        ctx.lineTo(...P(len - 3, 0));
        ctx.stroke();
      };
      beam(Math.PI / 2 + 0.12);
      beam(Math.PI / 2 + 0.12 + Math.PI / 3);
      beam(Math.PI / 2 + 0.12 - Math.PI / 3);
      // центральная косынка — квадрат, болт круглый (болтам можно)
      ctx.fillStyle = '#1c1c22';
      ctx.fillRect(cx - 8, cy - 8, 16, 16);
      ctx.fillStyle = '#5d646e';
      ctx.fillRect(cx - 6, cy - 6, 12, 12);
      ctx.strokeStyle = 'rgba(10,10,14,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 8, cy - 8, 16, 16);
      ctx.fillStyle = '#8a919a';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // ржавь
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = 'rgba(140,75,30,0.45)';
        ctx.fillRect(Math.round(cx - 22 + rnd() * 44), Math.round(cy - 22 + rnd() * 44), 2 + Math.floor(rnd() * 3), 2);
      }
      // тень-подставка
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, H - 8, 30, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (key === 'map_crate') {
      // Деревянный ящик: тот же вид, что рисованные укрытия в бою
      // (createCover): доски, диагональ, гвозди. Ключ нужен палитре
      // редактора и exists()-проверкам арен; пиксели PNG не используются.
      ctx.fillStyle = '#8b6b43';
      ctx.fillRect(0, 0, W, H);
      // доски-горизонтали
      const planks = Math.max(2, Math.round(H / 26));
      ctx.fillStyle = '#6e542f';
      for (let i = 1; i < planks; i++) {
        ctx.fillRect(4, Math.round(H / planks * i) - 1, W - 8, 2);
      }
      // верх-блик, низ-тень
      ctx.fillStyle = '#a8834f';
      ctx.fillRect(3, 1, W - 6, 3);
      ctx.fillStyle = '#3e2d1a';
      ctx.fillRect(3, H - 4, W - 6, 3);
      // диагональ
      ctx.strokeStyle = '#77592f';
      ctx.lineWidth = Math.max(4, Math.min(W, H) * 0.09);
      ctx.beginPath();
      ctx.moveTo(7, H - 7);
      ctx.lineTo(W - 7, 7);
      ctx.stroke();
      // рамка + внутренняя
      ctx.strokeStyle = '#4e3a22';
      ctx.lineWidth = Math.max(3, W * 0.035);
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.strokeStyle = 'rgba(78,58,34,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, W - 12, H - 12);
      // гвозди
      ctx.fillStyle = '#2e2114';
      const nx = W / 2 - 9, ny = H / 2 - 9;
      [[-nx, -ny], [nx, -ny], [-nx, ny], [nx, ny]].forEach(([gx, gy]) => {
        ctx.beginPath();
        ctx.arc(W / 2 + gx, H / 2 + gy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      // по потёртости
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,230,190,0.10)';
        ctx.fillRect(Math.round(4 + rnd() * (W - 10)), Math.round(4 + rnd() * (H - 10)), 1 + Math.floor(rnd() * 3), 2);
      }
    } else {
      return false;
    }
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Земля gr_* — процедурные плитки 256x128 (стиль игры: плоский цвет,
  // тёмный контур, блик). Статика через createCanvas — TileSprite такое
  // умеет (см. правило: НЕ RenderTexture, иначе зелёный __MISSING).
  // Ключи те же — карты/сейвы не трогаем. Шов только горизонтальный:
  // высота грунтов в игре 28-80px < 128, вертикально плитка не повторяется.
  // Весь шум — через seeded RNG + дубли у краёв (x±W), иначе стык виден.
export function generateGroundArt(key) {
    const KNOWN = ['gr_grass', 'gr_sand', 'gr_stones', 'gr_beton', 'gr_beton_sand', 'gr_scorch'];
    if (!KNOWN.includes(key)) return false;
    if (this.textures.exists(key)) {
      try {
        window.__realTextures = window.__realTextures || new Set();
        window.__realTextures.add(key);
      } catch (e) {}
      return true;
    }
    const W = 256, H = 128;
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
    const R = (a, b) => a + rnd() * (b - a);
    const RI = (a, b) => Math.floor(R(a, b + 1));
    // Прямоугольник с дублями у левого/правого края (бесшовность).
    const rectW = (x, y, w, h) => {
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
      if (x < 12) ctx.fillRect(Math.round(x + W), Math.round(y), w, h);
      if (x + w > W - 12) ctx.fillRect(Math.round(x - W), Math.round(y), w, h);
    };
    const dotW = (x, y, r) => {
      [[0, 0], [W, 0], [-W, 0]].forEach(([dx]) => {
        const px = x + dx;
        if (px < -8 || px > W + 8) return;
        ctx.beginPath();
        ctx.arc(px, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}

    if (key === 'gr_grass' || key === 'gr_sand') {
      const sand = key === 'gr_sand';
      const cTop = sand ? '#e8c890' : '#5aa03a';
      const cTopHi = sand ? '#f4dcab' : '#7ac04e';
      const cLine = sand ? '#8a6a42' : '#1e3a14';
      const cDirt0 = sand ? '#d8b078' : '#7a5636';
      const cDirt1 = sand ? '#b89060' : '#4e3320';
      const g = ctx.createLinearGradient(0, 26, 0, H);
      g.addColorStop(0, cDirt0);
      g.addColorStop(1, cDirt1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // крап тела
      for (let i = 0; i < 110; i++) {
        const p = rnd();
        ctx.fillStyle = p < 0.5 ? 'rgba(0,0,0,0.16)' : (sand ? 'rgba(255,240,210,0.20)' : 'rgba(255,230,180,0.10)');
        const w = 1 + Math.floor(rnd() * 3), h = 1 + Math.floor(rnd() * 2);
        rectW(R(0, W), R(30, H - 3), w, h);
      }
      // камешки в теле
      for (let i = 0; i < 10; i++) {
        const sx = R(4, W - 4), sy = R(44, H - 10), sr = R(2.5, 5.5);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        dotW(sx + 1, sy + 1, sr);
        ctx.fillStyle = sand ? '#c8a878' : '#8a8a8e';
        dotW(sx, sy, sr);
        ctx.fillStyle = sand ? 'rgba(255,245,220,0.5)' : 'rgba(230,236,244,0.45)';
        dotW(sx - sr * 0.3, sy - sr * 0.3, Math.max(1, sr * 0.35));
      }
      // корешки / сухие травинки в теле
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const sx = R(0, W);
        ctx.strokeStyle = sand ? 'rgba(120,90,50,0.6)' : 'rgba(60,40,22,0.6)';
        ctx.beginPath();
        ctx.moveTo(sx, 30);
        ctx.lineTo(sx + R(-8, 8), 30 + R(8, 20));
        ctx.stroke();
        if (sx < 14) {
          ctx.beginPath();
          ctx.moveTo(sx + W, 30);
          ctx.lineTo(sx + W + R(-4, 4), 44);
          ctx.stroke();
        }
      }
      // поверхность: полоса 0..24
      ctx.fillStyle = cTop;
      ctx.fillRect(0, 0, W, 24);
      ctx.fillStyle = cTopHi;
      ctx.fillRect(0, 0, W, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 20, W, 4);
      ctx.fillStyle = cLine;
      ctx.fillRect(0, 24, W, 3);
      // травинки на верхней кромке
      ctx.lineWidth = 2;
      for (let i = 0; i < 30; i++) {
        const bx = R(0, W), bh = R(4, 11);
        ctx.strokeStyle = (i % 2) ? cTopHi : cLine;
        const x2 = bx + R(-3, 3);
        [[0], [W], [-W]].forEach(([dx]) => {
          const px = bx + dx;
          if (px < -6 || px > W + 6) return;
          ctx.beginPath();
          ctx.moveTo(px, 5);
          ctx.lineTo(x2 + dx, 5 - bh);
          ctx.stroke();
        });
      }
      // комки дёрна на полосе
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)';
        rectW(R(0, W), R(6, 20), 2 + Math.floor(rnd() * 4), 2);
      }
    } else if (key === 'gr_scorch') {
      // Выжженная земля пустоши: пепел, угли, ни травинки зелёной.
      const g = ctx.createLinearGradient(0, 26, 0, H);
      g.addColorStop(0, '#3a352c');
      g.addColorStop(1, '#201e16');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // пепел и гарь
      for (let i = 0; i < 120; i++) {
        const p = rnd();
        ctx.fillStyle = p < 0.45 ? 'rgba(0,0,0,0.22)' : (p < 0.8 ? 'rgba(150,145,130,0.16)' : 'rgba(210,200,180,0.12)');
        rectW(R(0, W), R(30, H - 3), 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 2));
      }
      // угли-головёшки
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        rectW(R(2, W - 8), R(44, H - 12), 3 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 3));
        ctx.fillStyle = 'rgba(140,135,120,0.3)';
        rectW(R(2, W - 8), R(44, H - 12), 2, 1);
      }
      // камни
      for (let i = 0; i < 8; i++) {
        const sx = R(4, W - 4), sy = R(44, H - 10), sr = R(2.5, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        dotW(sx + 1, sy + 1, sr);
        ctx.fillStyle = '#6e6a5e';
        dotW(sx, sy, sr);
        ctx.fillStyle = 'rgba(200,190,170,0.35)';
        dotW(sx - sr * 0.3, sy - sr * 0.3, Math.max(1, sr * 0.35));
      }
      // тлеющие искры в глубине
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(255,120,40,0.7)';
        dotW(R(10, W - 10), R(60, H - 10), 1.5);
      }
      // горелые стебли (серые, не зелёные)
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const sx = R(0, W);
        ctx.strokeStyle = 'rgba(70,64,52,0.8)';
        ctx.beginPath();
        ctx.moveTo(sx, 28);
        ctx.lineTo(sx + R(-6, 6), 28 - R(4, 10));
        ctx.stroke();
        if (sx < 14) {
          ctx.beginPath();
          ctx.moveTo(sx + W, 28);
          ctx.lineTo(sx + W + R(-4, 4), 18);
          ctx.stroke();
        }
      }
      // поверхность: горелая корка
      ctx.fillStyle = '#4a4238';
      ctx.fillRect(0, 0, W, 24);
      ctx.fillStyle = '#6e675a';
      ctx.fillRect(0, 0, W, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 20, W, 4);
      ctx.fillStyle = '#14120e';
      ctx.fillRect(0, 24, W, 3);
      // комья золы на полосе
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = rnd() < 0.6 ? 'rgba(0,0,0,0.22)' : 'rgba(190,180,160,0.14)';
        rectW(R(0, W), R(6, 20), 2 + Math.floor(rnd() * 4), 2);
      }
    } else if (key === 'gr_stones') {
      // швы-фон
      ctx.fillStyle = '#3a3a42';
      ctx.fillRect(0, 0, W, H);
      const tones = ['#8a8a92', '#9a9aa2', '#7a7a82', '#84848c'];
      const rowH = 32;
      for (let row = 0; row < H / rowH; row++) {
        const y = row * rowH;
        const off = (row % 2) ? 34 : 0;
        let x = -off;
        while (x < W) {
          const sw = 56 + Math.floor(rnd() * 18);
          const tone = tones[Math.floor(rnd() * tones.length)];
          const drawStone = (px) => {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(Math.round(px + 1), Math.round(y + 2), sw, rowH - 3);
            ctx.fillStyle = tone;
            ctx.fillRect(Math.round(px), Math.round(y + 1), sw, rowH - 3);
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(Math.round(px + 2), Math.round(y + 2), sw - 4, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(Math.round(px + 2), Math.round(y + rowH - 5), sw - 4, 3);
            // выбоины
            for (let s = 0; s < 4; s++) {
              ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)';
              ctx.fillRect(Math.round(px + 4 + rnd() * (sw - 8)), Math.round(y + 5 + rnd() * (rowH - 12)), 1 + Math.floor(rnd() * 3), 2);
            }
          };
          drawStone(x);
          // дубль через край для бесшовности
          if (x < 6) drawStone(x + W);
          if (x + sw > W - 6) drawStone(x - W);
          x += sw + 6;
        }
      }
      // верхняя кромка-поверхность во всю ширину
      ctx.fillStyle = '#b8bcc2';
      ctx.fillRect(0, 0, W, 3);
      ctx.fillStyle = '#2c2c34';
      ctx.fillRect(0, 3, W, 2);
    } else {
      // бетон: та же сетка 4x2, разная палитра
      const sandB = key === 'gr_beton_sand';
      const cBase = sandB ? '#c8b090' : '#b8bcc2';
      const cHi = sandB ? '#e0c8a8' : '#d8dce2';
      const cLo = sandB ? '#9a8060' : '#8a8e96';
      const cSeam = sandB ? '#5a4a38' : '#3a3e44';
      ctx.fillStyle = cSeam;
      ctx.fillRect(0, 0, W, H);
      const bw = 64, bh = 64;
      for (let by = 0; by < H / bh; by++) {
        for (let bx = 0; bx < W / bw; bx++) {
          const px = bx * bw, py = by * bh;
          const drawBlock = (ox) => {
            ctx.fillStyle = cBase;
            ctx.fillRect(ox + 2, py + 2, bw - 4, bh - 4);
            ctx.fillStyle = cHi;
            ctx.fillRect(ox + 2, py + 2, bw - 4, 3);
            ctx.fillRect(ox + 2, py + 2, 3, bh - 4);
            ctx.fillStyle = cLo;
            ctx.fillRect(ox + 2, py + bh - 5, bw - 4, 3);
            ctx.fillRect(ox + bw - 5, py + 2, 3, bh - 4);
            // крап
            for (let s = 0; s < 12; s++) {
              ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.12)';
              ctx.fillRect(Math.round(ox + 6 + rnd() * (bw - 12)), Math.round(py + 6 + rnd() * (bh - 12)), 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2));
            }
            if (sandB) {
              // ржавые потёки
              for (let s = 0; s < 4; s++) {
                ctx.fillStyle = 'rgba(138,90,48,0.35)';
                ctx.fillRect(Math.round(ox + 6 + rnd() * (bw - 14)), Math.round(py + 8 + rnd() * (bh - 18)), 2 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
              }
            }
            // трещина
            if (rnd() < 0.7) {
              ctx.strokeStyle = 'rgba(20,20,24,0.7)';
              ctx.lineWidth = 2;
              let cx = ox + 10 + rnd() * (bw - 20), cy = py + 8;
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              for (let s = 0; s < 4; s++) {
                cx += R(-12, 12);
                cy += R(8, 16);
                ctx.lineTo(cx, cy);
              }
              ctx.stroke();
            }
          };
          drawBlock(px);
        }
      }
      // шов на x=0 уже есть фоном — этого достаточно для стыка 0/W.
      ctx.fillStyle = cHi;
      ctx.fillRect(0, 0, W, 2);
    }

    try { ct.refresh(); } catch (e) {}
    try {
      window.__realTextures = window.__realTextures || new Set();
      window.__realTextures.add(key);
    } catch (e) {}
    return this.textures.exists(key);
  }

  // Кейсы экрана «Кейсы» (НЕ меню): 6 шт, холст 240x120, статика через
  // createCanvas. Стиль игры: плоский цвет, тёмный контур, блик.
  // Ключи показа: case_weapons/case_wardrobe/case_skins/case_rare/case_epic/case_leg.
  // PNG (`Оружейный арсенал.png`, `Кейс скинов.png`, `Вещевой кейс.png`)
  // больше не грузим (к удалению). true = нарисовано.
export function generateCaseArt(key) {
    const CONF = {
      case_weapons:  { line: '#b44dff', body: '#3a4a5a', lid: '#2c3844', tag: 'AMMO' },
      case_wardrobe: { line: '#66d9e8', body: '#3a5a50', lid: '#2c443c', tag: 'GEAR' },
      case_skins:    { line: '#ffd24a', body: '#4a3a6a', lid: '#382c52', tag: 'DNA' },
      case_rare:     { line: '#35d07f', body: '#2a4a3e', lid: '#1e382e', tag: 'II' },
      case_epic:     { line: '#b44dff', body: '#3e2a52', lid: '#2e1e40', tag: 'III' },
      case_leg:      { line: '#ffd24a', body: '#4a3a1a', lid: '#382c12', tag: 'IV' }
    };
    const cf = CONF[key];
    if (!cf) return false;
    if (this.textures.exists(key)) return true;
    const W = 240, H = 120;
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
    try { ctx.clearRect(0, 0, W, H); } catch (e) {}
    const edge = 'rgba(10,10,16,0.9)';
    // Фон: тёмная панель + радиальное свечение в цвете кейса.
    ctx.fillStyle = '#14142e';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, 110);
    glow.addColorStop(0, cf.line + '55');
    glow.addColorStop(1, cf.line + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // Рамка редкости + заклёпки.
    ctx.strokeStyle = cf.line;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = cf.line;
    [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(([rx, ry]) => {
      ctx.beginPath();
      ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    [[8, 8], [W - 8, 8]].forEach(([rx, ry]) => ctx.fillRect(rx - 1, ry - 1, 2, 2));
    // Сундук: корпус + крышка + шов + металлические уголки.
    const bx = 52, bw = 136, by = 34, bh = 62, lidH = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(bx + 3, by + 5, bw, bh);
    ctx.fillStyle = cf.body;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = cf.lid;
    ctx.fillRect(bx, by, bw, lidH);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bx + 2, by + 2, bw - 4, 3);
    ctx.fillRect(bx + 2, by + 2, 3, bh - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(bx + 2, by + bh - 5, bw - 4, 3);
    ctx.fillStyle = edge;
    ctx.fillRect(bx, by + lidH - 2, bw, 3);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    // Вертикальные ремни + заклёпки.
    [bx + 14, bx + bw - 14].forEach(rx => {
      ctx.fillStyle = '#5d646e';
      ctx.fillRect(rx - 5, by + 2, 10, bh - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(rx - 5, by + 2, 2, bh - 4);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx - 5, by + 2, 10, bh - 4);
      ctx.fillStyle = '#1c1c22';
      ctx.beginPath();
      ctx.arc(rx, by + 12, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx, by + bh - 12, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // Замок-медальон в цвете кейса.
    const lx = bx + bw / 2, ly = by + lidH + 8;
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(lx - 13, ly - 8, 26, 22);
    ctx.fillStyle = cf.line;
    ctx.fillRect(lx - 10, ly - 5, 20, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(lx - 10, ly - 5, 20, 3);
    ctx.fillStyle = '#1c1c22';
    ctx.beginPath();
    ctx.arc(lx, ly + 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath();
    ctx.arc(lx, ly + 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(lx - 13, ly - 8, 26, 22);
    // Эмблема по центру крышки: у каждого кейса своя.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    if (key === 'case_weapons') {
      // Скрещенные стволы.
      const drawGun = (flip) => {
        ctx.save();
        ctx.translate(W / 2, by + lidH / 2 + 1);
        ctx.rotate(flip ? -0.28 : 0.28);
        ctx.fillRect(-34, -3, 62, 6);
        ctx.fillRect(16, -5, 18, 5);
        ctx.fillRect(-30, 3, 8, 7);
        ctx.restore();
      };
      drawGun(false);
      drawGun(true);
    } else if (key === 'case_wardrobe') {
      // Вешалка + плечики.
      ctx.beginPath();
      ctx.arc(W / 2, by + 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W / 2, by + 7);
      ctx.lineTo(W / 2 - 26, by + 17);
      ctx.lineTo(W / 2 + 26, by + 17);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 - 14, by + 12);
      ctx.lineTo(W / 2 - 14, by + 17);
      ctx.moveTo(W / 2 + 14, by + 12);
      ctx.lineTo(W / 2 + 14, by + 17);
      ctx.stroke();
    } else if (key === 'case_skins') {
      // ДНК: две синусоиды + перекладины.
      ctx.lineWidth = 2.5;
      for (const ph of [0, Math.PI]) {
        ctx.beginPath();
        for (let x = -30; x <= 30; x += 3) {
          const y = Math.sin((x / 30) * Math.PI * 2 + ph) * 6;
          if (x === -30) ctx.moveTo(W / 2 + x, by + 11 + y);
          else ctx.lineTo(W / 2 + x, by + 11 + y);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      for (let x = -24; x <= 24; x += 12) {
        const y1 = Math.sin((x / 30) * Math.PI * 2) * 6;
        const y2 = Math.sin((x / 30) * Math.PI * 2 + Math.PI) * 6;
        ctx.beginPath();
        ctx.moveTo(W / 2 + x, by + 11 + y1);
        ctx.lineTo(W / 2 + x, by + 11 + y2);
        ctx.stroke();
      }
    } else {
      // Гарантированные: звёзды редкости (2/3/4) на крышке.
      const stars = key === 'case_rare' ? 2 : (key === 'case_epic' ? 3 : 4);
      const star = (sx, sy, r) => {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = (i % 2) ? r * 0.45 : r;
          const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
          const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      };
      const step = 20, x0 = W / 2 - (stars - 1) * step / 2;
      for (let i = 0; i < stars; i++) star(x0 + i * step, by + 11, 8);
    }
    ctx.restore();
    // Трафаретная подпись на корпусе.
    try {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cf.tag, W / 2, by + lidH + 34);
    } catch (e) {}
    // Блёстки-вау (детерминированы).
    for (let i = 0; i < 10; i++) {
      const sx = 12 + rnd() * (W - 24), sy = 10 + rnd() * (H - 20);
      if (sx > bx - 6 && sx < bx + bw + 6 && sy > by - 6 && sy < by + bh + 6) continue;
      const sr = 2 + rnd() * 3;
      ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.8)' : cf.line + 'CC';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - sr, sy);
      ctx.lineTo(sx + sr, sy);
      ctx.moveTo(sx, sy - sr);
      ctx.lineTo(sx, sy + sr);
      ctx.stroke();
    }
    try { ct.refresh(); } catch (e) {}
    return this.textures.exists(key);
  }

  // Подборы (аптечки/патроны/броня/гранаты): холст 64x64, показ в боксе
  // 32px (Pickup) и 0.35 скейлом в полёте (Grenade, с тинтом!). Поэтому
  // гранаты — светлые (тинт их красит), остальное — в полный цвет.
  // PNG пока лежат (на оценку), грузить перестали (см. KIT_PNG_CODE).
  // true = нарисовано.
