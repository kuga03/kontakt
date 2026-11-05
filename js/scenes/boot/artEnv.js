
export function generateMapArt(key) {
    const SIZES = {
      map_barrel: [64, 64], map_wall_iron2: [128, 128], map_wall_metal: [128, 128],
      map_wire: [132, 96], map_rabica: [120, 96], map_eji: [96, 96],
      map_crate: [120, 100],
      map_jerry: [40, 52], map_ammo: [66, 40], map_tires: [60, 44], map_crate_stack: [56, 62],
      map_generator: [140, 80], map_pipes: [140, 70],
      map_dune_rock: [150, 75], map_sand_barrier: [130, 65],
      map_vent_unit: [140, 80], map_concrete_block: [120, 65],
      map_stalagmite: [130, 85], map_shield: [130, 75],
      map_lamp_post: [32, 128], map_ladder_truss: [32, 128],
      map_office_desk: [110, 55], map_server_rack: [70, 110],
      map_support_pillar: [40, 240], map_interior_wall: [120, 120],
      map_int_office: [240, 160], map_int_factory: [240, 160],
      map_int_fact_assembly: [240, 160], map_int_fact_reactor: [240, 160],
      map_int_fact_warehouse: [240, 160], map_int_fact_control: [240, 160],
      map_int_canyon: [240, 160], map_int_bunker: [240, 160],
      map_wall_brick: [128, 128], map_wall_concrete: [128, 128], map_wall_partition: [64, 128],
      p_dust: [8, 8], p_ember: [8, 8], p_drop: [6, 10]
    };
    let sz = SIZES[key];
    // Варианты бочек и ящиков живут под map_barrel1..9 и map_crate1..9 тем же размером.
    if (!sz && /^map_barrel[1-9]$/.test(key)) sz = [64, 64];
    if (!sz && /^map_crate[1-9]$/.test(key)) sz = [120, 100];
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
    } else if (key === 'map_crate' || /^map_crate[1-9]$/.test(key)) {
      // 10 уникальных вариантов ящиков (map_crate и map_crate1..9):
      // разная расцветка досок, усиленные уголки, металлические пластины,
      // маркировка, кресты, полосы и кастомный оттенок.
      const cv = key === 'map_crate' ? 0 : parseInt(key.slice(-1), 10);
      const cPal = [
        ['#8b6b43', '#6e542f', '#4e3a22', '#3e2d1a', '#a8834f'],
        ['#6b7a8a', '#546270', '#3e4a56', '#2e3842', '#8aa0b4'],
        ['#7a5e44', '#5f4734', '#443324', '#34261a', '#9a7c5e'],
        ['#5e7a5c', '#466044', '#324630', '#263824', '#7da47a'],
        ['#8a7a44', '#6e5f34', '#504424', '#3e351a', '#a8985e'],
        ['#7a4444', '#5f3434', '#462424', '#381c1c', '#9a5e5e'],
        ['#505050', '#3c3c3c', '#282828', '#1c1c1c', '#787878'],
        ['#8a5c44', '#6e4734', '#513426', '#3e261c', '#a87a5e'],
        ['#447a72', '#345f59', '#244642', '#1c3431', '#5ea49a'],
        ['#7c6844', '#615034', '#463924', '#362b1a', '#9e845e']
      ][cv];

      ctx.fillStyle = cPal[0];
      ctx.fillRect(0, 0, W, H);
      const planks = Math.max(2, Math.round(H / 26));
      ctx.fillStyle = cPal[1];
      for (let i = 1; i < planks; i++) {
        ctx.fillRect(4, Math.round(H / planks * i) - 1, W - 8, 2);
      }
      ctx.fillStyle = cPal[4];
      ctx.fillRect(3, 1, W - 6, 3);
      ctx.fillStyle = cPal[3];
      ctx.fillRect(3, H - 4, W - 6, 3);
      
      // Декоративные элементы в зависимости от варианта
      if (cv % 2 === 1) {
        // Металлические уголки
        ctx.fillStyle = '#2c3036';
        ctx.fillRect(0, 0, 14, 14);
        ctx.fillRect(W - 14, 0, 14, 14);
        ctx.fillRect(0, H - 14, 14, 14);
        ctx.fillRect(W - 14, H - 14, 14, 14);
      }
      if (cv % 3 === 0) {
        // Диагональные крепления
        ctx.strokeStyle = cPal[2];
        ctx.lineWidth = Math.max(4, Math.min(W, H) * 0.08);
        ctx.beginPath();
        ctx.moveTo(7, H - 7);
        ctx.lineTo(W - 7, 7);
        ctx.stroke();
      }
      if (cv === 4 || cv === 8) {
        // Полосы опасности/маркировка
        ctx.fillStyle = '#d8b23c';
        ctx.fillRect(0, H / 2 - 6, W, 12);
        ctx.fillStyle = '#202020';
        for (let stripe = 10; stripe < W; stripe += 24) {
          ctx.fillRect(stripe, H / 2 - 6, 8, 12);
        }
      }

      ctx.strokeStyle = cPal[3];
      ctx.lineWidth = Math.max(3, W * 0.035);
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.fillStyle = '#1c150e';
      const nx = W / 2 - 9, ny = H / 2 - 9;
      [[-nx, -ny], [nx, -ny], [-nx, ny], [nx, ny]].forEach(([gx, gy]) => {
        ctx.beginPath();
        ctx.arc(W / 2 + gx, H / 2 + gy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (key === 'map_generator') {
      // Дизель-генератор: левый высокий выхлопной блок (80% H), центральный пульт (55% H), правый кожух мотора (70% H)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(4, H - 8, W - 8, 8); // тень основания
      // Левая секция (выхлоп и радиатор)
      ctx.fillStyle = '#383e46';
      ctx.fillRect(4, 16, 42, H - 22);
      ctx.fillStyle = '#22262c';
      for (let y = 24; y < H - 12; y += 6) ctx.fillRect(8, y, 34, 3); // ребра радиатора
      // Выхлопная труба
      ctx.fillStyle = '#2a2d32';
      ctx.fillRect(12, 4, 10, 14);
      ctx.fillStyle = '#8a5232'; // ржавый раструб
      ctx.fillRect(10, 2, 14, 4);
      // Центральная секция (пульт управления, пониженный)
      ctx.fillStyle = '#4e5648';
      ctx.fillRect(46, 36, 48, H - 42);
      ctx.fillStyle = '#e5b82c'; // сигнальная диагональ
      ctx.fillRect(50, 42, 40, 6);
      ctx.fillStyle = '#222';
      for (let x = 52; x < 88; x += 8) { ctx.fillRect(x, 42, 4, 6); }
      // Приборная панель
      ctx.fillStyle = '#1e221c';
      ctx.fillRect(52, 54, 36, 14);
      ctx.fillStyle = '#55ff55';
      ctx.fillRect(56, 58, 4, 4);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(64, 58, 4, 4);
      // Правая секция (моторный блок и бак)
      ctx.fillStyle = '#454c56';
      ctx.fillRect(94, 24, 42, H - 30);
      ctx.fillStyle = '#606a78';
      ctx.fillRect(98, 28, 34, 10); // люк бака
      ctx.fillStyle = '#2a3038';
      ctx.fillRect(110, 22, 10, 6); // горловина
      // Контуры
      ctx.strokeStyle = 'rgba(12,14,18,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 16, 42, H - 22);
      ctx.strokeRect(46, 36, 48, H - 42);
      ctx.strokeRect(94, 24, 42, H - 30);
    } else if (key === 'map_pipes') {
      // Связка промышленных труб (пирамида из 3 труб: низ шире, верх уже)
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(6, H - 10, W - 12, 10);
      // Деревянный/стальной ложемент снизу
      ctx.fillStyle = '#3a3226';
      ctx.fillRect(8, H - 16, W - 16, 8);
      const drawPipe = (cx, cy, r, len) => {
        const pg = ctx.createLinearGradient(0, cy - r, 0, cy + r);
        pg.addColorStop(0, '#78828e');
        pg.addColorStop(0.3, '#b4becc');
        pg.addColorStop(0.7, '#4e5660');
        pg.addColorStop(1, '#2c3238');
        ctx.fillStyle = pg;
        ctx.fillRect(cx - len / 2, cy - r, len, r * 2);
        ctx.strokeStyle = '#181c20';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - len / 2, cy - r, len, r * 2);
        // обод на торце
        ctx.fillStyle = '#3a4048';
        ctx.beginPath();
        ctx.ellipse(cx - len / 2, cy, 6, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      };
      // Две нижние трубы
      drawPipe(38, H - 26, 16, 64);
      drawPipe(102, H - 26, 16, 64);
      // Верхняя труба по центру
      drawPipe(70, H - 46, 17, 72);
      // Стальная крепежная лента/стяжка
      ctx.strokeStyle = '#d4aa33';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, H - 16);
      ctx.lineTo(60, H - 60);
      ctx.lineTo(80, H - 60);
      ctx.lineTo(110, H - 16);
      ctx.stroke();
    } else if (key === 'map_dune_rock') {
      // Пустынный скалистый останец: пологий подъем слева (45%), пик в центре (82%), обрыв справа (52%)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(W / 2, H - 4, W * 0.46, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Основное скальное тело
      ctx.fillStyle = '#8a6442';
      ctx.beginPath();
      ctx.moveTo(6, H - 8);
      ctx.lineTo(34, H - 36);
      ctx.lineTo(64, H - 62);
      ctx.lineTo(84, H - 60);
      ctx.lineTo(118, H - 40);
      ctx.lineTo(144, H - 8);
      ctx.closePath();
      ctx.fill();
      // Освещенные грани песчаника
      ctx.fillStyle = '#ba8c5c';
      ctx.beginPath();
      ctx.moveTo(6, H - 8);
      ctx.lineTo(34, H - 36);
      ctx.lineTo(64, H - 62);
      ctx.lineTo(76, H - 12);
      ctx.closePath();
      ctx.fill();
      // Слоистые трещины
      ctx.strokeStyle = '#5a3e26';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(24, H - 20); ctx.lineTo(68, H - 46);
      ctx.moveTo(76, H - 54); ctx.lineTo(124, H - 24);
      ctx.stroke();
      // Песчаная насыпь у основания
      ctx.fillStyle = '#dcb074';
      ctx.beginPath();
      ctx.moveTo(2, H - 6); ctx.lineTo(44, H - 18); ctx.lineTo(70, H - 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#342214';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (key === 'map_sand_barrier') {
      // Железобетонный блок, занесенный барханом
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(6, H - 6, W - 12, 6);
      // Центральный бетонный блок
      ctx.fillStyle = '#827c72';
      ctx.beginPath();
      ctx.moveTo(34, H - 8);
      ctx.lineTo(44, 18);
      ctx.lineTo(92, 18);
      ctx.lineTo(102, H - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9e968c';
      ctx.fillRect(46, 20, 44, 4); // фаска
      // Торчащая ржавая арматура
      ctx.strokeStyle = '#a65428';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(56, 18); ctx.lineTo(52, 6);
      ctx.moveTo(78, 18); ctx.lineTo(84, 8);
      ctx.stroke();
      // Песчаный нанос слева и справа
      ctx.fillStyle = '#d4a46a';
      ctx.beginPath();
      ctx.moveTo(4, H - 6);
      ctx.quadraticCurveTo(28, H - 28, 52, H - 14);
      ctx.lineTo(52, H - 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(88, H - 14);
      ctx.quadraticCurveTo(108, H - 28, 126, H - 6);
      ctx.lineTo(88, H - 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2c261e';
      ctx.lineWidth = 2;
      ctx.strokeRect(44, 18, 48, H - 26);
    } else if (key === 'map_vent_unit') {
      // Крышный блок вентиляции / чиллер: вентилятор (60% H), шахта воздуховода (85% H), электрощит (65% H)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(6, H - 6, W - 12, 6);
      // Левая секция: круглая крыльчатка вентилятора
      ctx.fillStyle = '#68727c';
      ctx.fillRect(6, 32, 44, H - 38);
      ctx.fillStyle = '#1c2024';
      ctx.beginPath();
      ctx.arc(28, H - 26, 16, 0, Math.PI * 2);
      ctx.fill();
      // Лопасти вентилятора
      ctx.strokeStyle = '#b0bac6';
      ctx.lineWidth = 3;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
        ctx.beginPath();
        ctx.moveTo(28, H - 26);
        ctx.lineTo(28 + Math.cos(a) * 14, H - 26 + Math.sin(a) * 14);
        ctx.stroke();
      }
      // Центральная высокая секция: короб с жалюзи
      ctx.fillStyle = '#88929e';
      ctx.fillRect(48, 12, 50, H - 18);
      ctx.fillStyle = '#2c323a';
      for (let y = 18; y < H - 12; y += 5) ctx.fillRect(52, y, 42, 2.5); // решетка
      // Правая секция: шкаф управления
      ctx.fillStyle = '#5c646e';
      ctx.fillRect(96, 26, 38, H - 32);
      ctx.fillStyle = '#ffd033'; // предупреждающий знак
      ctx.beginPath();
      ctx.moveTo(115, 34); ctx.lineTo(123, 48); ctx.lineTo(107, 48);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#181a1e';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 32, 44, H - 38);
      ctx.strokeRect(48, 12, 50, H - 18);
      ctx.strokeRect(96, 26, 38, H - 32);
    } else if (key === 'map_concrete_block') {
      // Городской блок «Джерси»: скошенные фланги (48% H) и центральный гребень (75% H)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(4, H - 6, W - 8, 6);
      ctx.fillStyle = '#8a8e94';
      ctx.beginPath();
      ctx.moveTo(6, H - 6);
      ctx.lineTo(12, H - 28);
      ctx.lineTo(34, 18);
      ctx.lineTo(86, 18);
      ctx.lineTo(108, H - 28);
      ctx.lineTo(114, H - 6);
      ctx.closePath();
      ctx.fill();
      // Светоотражающая желто-черная полоса на ребре
      ctx.fillStyle = '#e2b024';
      ctx.fillRect(18, H - 26, 84, 8);
      ctx.fillStyle = '#222';
      for (let x = 22; x < 96; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, H - 18); ctx.lineTo(x + 6, H - 26);
        ctx.lineTo(x + 10, H - 26); ctx.lineTo(x + 4, H - 18);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = '#22252a';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (key === 'map_stalagmite') {
      // Пещерный сталагмит: малый зубец (50% H), высокий шпиль (85% H), средний зубец (55% H)
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(W / 2, H - 4, W * 0.45, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const drawSpire = (bx, w2, h2, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(bx - w2 / 2, H - 6);
        ctx.lineTo(bx - w2 * 0.2, H - h2 * 0.6);
        ctx.lineTo(bx, H - h2);
        ctx.lineTo(bx + w2 * 0.2, H - h2 * 0.5);
        ctx.lineTo(bx + w2 / 2, H - 6);
        ctx.closePath();
        ctx.fill();
        // кристаллический блеск
        ctx.fillStyle = 'rgba(160,200,240,0.35)';
        ctx.beginPath();
        ctx.moveTo(bx, H - h2);
        ctx.lineTo(bx - w2 * 0.15, H - h2 * 0.5);
        ctx.lineTo(bx, H - 8);
        ctx.closePath();
        ctx.fill();
      };
      drawSpire(28, 36, 44, '#383c44');  // левый зубец
      drawSpire(100, 38, 48, '#32363e'); // правый зубец
      drawSpire(62, 48, 72, '#424852');  // центральный пик
      ctx.strokeStyle = '#181a20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, H - 6); ctx.lineTo(62, H - 72); ctx.lineTo(122, H - 6);
      ctx.stroke();
    } else if (key === 'map_shield') {
      // Оборонительный бронещит бункера с амбразурой: крылья (52% H), высокий центр (82% H)
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(8, H - 6, W - 16, 6);
      // Укрепленные мешки с песком у основания
      ctx.fillStyle = '#6a6048';
      ctx.fillRect(10, H - 20, W - 20, 14);
      // Броневой лист с наклонными скосами
      ctx.fillStyle = '#3a404a';
      ctx.beginPath();
      ctx.moveTo(12, H - 18);
      ctx.lineTo(24, H - 40);
      ctx.lineTo(38, 14);
      ctx.lineTo(92, 14);
      ctx.lineTo(106, H - 40);
      ctx.lineTo(118, H - 18);
      ctx.closePath();
      ctx.fill();
      // Смотровая щель / амбразура
      ctx.fillStyle = '#0e1014';
      ctx.fillRect(52, 28, 26, 7);
      ctx.strokeStyle = '#606a78';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(51, 27, 28, 9);
      // Болты крепления бронеплит
      ctx.fillStyle = '#8a94a2';
      [[42, 20], [88, 20], [28, H - 36], [102, H - 36]].forEach(([bx, by]) => {
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.strokeStyle = '#161a20';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (key === 'map_lamp_post') {
      // Уличный фонарный столб: цоколь, стальная опора, изогнутый кронштейн и плафон
      ctx.fillStyle = '#22242a';
      ctx.fillRect(10, H - 12, 12, 12);
      ctx.fillStyle = '#16181c';
      ctx.fillRect(8, H - 4, 16, 4);
      // Опора
      ctx.fillStyle = '#3e424c';
      ctx.fillRect(13, 18, 6, H - 30);
      ctx.fillStyle = '#5c6270';
      ctx.fillRect(14, 18, 2, H - 30);
      // Верхний изогнутый кронштейн
      ctx.strokeStyle = '#3e424c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(16, 26);
      ctx.lineTo(16, 10);
      ctx.quadraticCurveTo(16, 4, 26, 6);
      ctx.stroke();
      // Плафон светильника
      ctx.fillStyle = '#282b32';
      ctx.fillRect(21, 6, 9, 4);
      // Светящаяся лампа
      ctx.fillStyle = '#fff2a8';
      ctx.fillRect(22, 10, 7, 5);
      // Мягкое свечение фонаря
      ctx.fillStyle = 'rgba(255, 238, 150, 0.32)';
      ctx.beginPath();
      ctx.arc(25.5, 12.5, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (key === 'map_ladder_truss') {
      // Вертикальная стальная пожарная лестница с перекладинами и боковыми балками
      ctx.fillStyle = '#282b33';
      ctx.fillRect(6, 0, 4, H);
      ctx.fillRect(22, 0, 4, H);
      ctx.fillStyle = '#4c5260';
      ctx.fillRect(7, 0, 1.5, H);
      ctx.fillRect(23, 0, 1.5, H);
      // Ступени
      ctx.fillStyle = '#3a3f4b';
      ctx.strokeStyle = '#181a20';
      ctx.lineWidth = 1;
      for (let y = 8; y < H; y += 14) {
        ctx.fillRect(6, y, 20, 3);
        ctx.strokeRect(6, y, 20, 3);
      }
      // Настенные анкерные кронштейны
      ctx.fillStyle = '#1c1e24';
      ctx.fillRect(0, 20, 6, 4);
      ctx.fillRect(0, H - 24, 6, 4);
    } else if (key === 'map_office_desk') {
      // Офисный рабочий стол со стулом, монитором и системным блоком
      // Тень под столом
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(6, H - 6, W - 12, 6);
      // Офисное кресло на колесиках (слева)
      ctx.fillStyle = '#1e2229';
      ctx.fillRect(14, H - 38, 22, 28);
      ctx.fillStyle = '#323842';
      ctx.fillRect(16, H - 46, 18, 14); // спинка
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(23, H - 10, 4, 8); // стойка колес
      // Каркас и тумба стола
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(72, H - 32, 28, 30); // тумба справа
      ctx.fillStyle = '#22252a';
      ctx.strokeRect(72, H - 32, 28, 30);
      ctx.fillRect(76, H - 24, 20, 2); // ручка верхнего ящика
      ctx.fillRect(76, H - 12, 20, 2); // ручка нижнего ящика
      // Ножки стола
      ctx.fillStyle = '#1a1d22';
      ctx.fillRect(40, H - 30, 4, 28);
      // Столешница
      ctx.fillStyle = '#4a505b';
      ctx.fillRect(36, H - 35, 70, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(36, H - 35, 70, 1.5);
      // Системный блок под столом
      ctx.fillStyle = '#15171c';
      ctx.fillRect(46, H - 26, 14, 24);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(56, H - 23, 2, 2); // индикатор питания
      // Монитор на столе
      ctx.fillStyle = '#181b20';
      ctx.fillRect(68, H - 52, 24, 16); // корпус экрана
      ctx.fillStyle = '#304259';
      ctx.fillRect(70, H - 50, 20, 12); // светящийся экран с кодом/графиками
      ctx.fillStyle = 'rgba(120,200,255,0.7)';
      ctx.fillRect(72, H - 47, 10, 2);
      ctx.fillRect(72, H - 43, 14, 2);
      ctx.fillStyle = '#15171a';
      ctx.fillRect(78, H - 36, 4, 3); // ножка подставки
      ctx.fillRect(75, H - 34, 10, 1.5); // база
      // Клавиатура
      ctx.fillStyle = '#20242b';
      ctx.fillRect(46, H - 36, 16, 2.5);
    } else if (key === 'map_server_rack') {
      // Серверный шкаф с мигающими светодиодами и кабелями
      ctx.fillStyle = '#181a1f';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#2d333d';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
      // Горизонтальные серверные юниты (1U/2U)
      for (let y = 8; y < H - 12; y += 12) {
        ctx.fillStyle = '#242831';
        ctx.fillRect(6, y, W - 12, 10);
        ctx.fillStyle = '#131518';
        ctx.fillRect(8, y + 2, W - 16, 6);
        // Индикаторы
        ctx.fillStyle = '#00ff66';
        ctx.fillRect(12, y + 4, 2, 2);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(16, y + 4, 2, 2);
        ctx.fillStyle = '#00aaff';
        ctx.fillRect(20, y + 4, 2, 2);
        // Вентиляционная решетка
        ctx.fillStyle = '#222';
        for (let vx = 30; vx < W - 16; vx += 4) {
          ctx.fillRect(vx, y + 3, 2, 4);
        }
      }
      // Цоколь шкафа
      ctx.fillStyle = '#0f1114';
      ctx.fillRect(4, H - 8, W - 8, 7);
    } else if (key === 'map_support_pillar') {
      // Несущая железобетонная опора / пилон для поддержки мостов и этажей
      ctx.fillStyle = '#3a3e47';
      ctx.fillRect(6, 0, W - 12, H);
      // Верхний и нижний стальные оголовки
      ctx.fillStyle = '#242830';
      ctx.fillRect(2, 0, W - 4, 12);
      ctx.fillRect(2, H - 14, W - 4, 14);
      // Вертикальные швы и ребра
      ctx.fillStyle = '#4c525e';
      ctx.fillRect(10, 12, 3, H - 26);
      ctx.fillRect(W - 13, 12, 3, H - 26);
      // Стальные фиксирующие хомуты со швами каждые 45px
      ctx.fillStyle = '#20242b';
      for (let y = 30; y < H - 20; y += 45) {
        ctx.fillRect(4, y, W - 8, 8);
        ctx.fillStyle = '#555e6d';
        ctx.fillRect(8, y + 2, 4, 4); // заклёпки
        ctx.fillRect(W - 12, y + 2, 4, 4);
        ctx.fillStyle = '#20242b';
      }
      ctx.strokeStyle = '#121418';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 0, W - 12, H);
    } else if (key === 'map_interior_wall' || key === 'map_int_office') {
      // 1. ОФИСНЫЙ ИНТЕРЬЕР: темные графитовые панели, окна с видом на небоскребы, потолочный свет
      ctx.fillStyle = '#161920';
      ctx.fillRect(0, 0, W, H);
      // Стеновые декоративные акустические панели
      ctx.fillStyle = '#1e2430';
      ctx.fillRect(6, 6, W - 12, H - 12);
      ctx.strokeStyle = '#12161f';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, W - 12, H - 12);
      // Вертикальные декоративные рейки
      ctx.fillStyle = '#283040';
      for (let rx = 16; rx < W - 16; rx += 28) {
        ctx.fillRect(rx, 8, 3, H - 16);
      }
      // Офисные окна на заднем плане с видом на силуэты города и вечернее небо
      const winW = 60, winH = 75, winY = 24;
      [36, W - 36 - winW].forEach(wx => {
        // Проем окна
        ctx.fillStyle = '#0f141d';
        ctx.fillRect(wx, winY, winW, winH);
        // Небо в окне
        const grad = ctx.createLinearGradient(0, winY, 0, winY + winH);
        grad.addColorStop(0, '#1a2638');
        grad.addColorStop(1, '#2c3c54');
        ctx.fillStyle = grad;
        ctx.fillRect(wx + 2, winY + 2, winW - 4, winH - 4);
        // Силуэт дальних высоток
        ctx.fillStyle = '#101722';
        ctx.fillRect(wx + 4, winY + 35, 18, winH - 37);
        ctx.fillRect(wx + 26, winY + 20, 22, winH - 22);
        // Огоньки в окнах города
        ctx.fillStyle = 'rgba(255, 230, 140, 0.7)';
        ctx.fillRect(wx + 8, winY + 42, 3, 3);
        ctx.fillRect(wx + 14, winY + 52, 3, 3);
        ctx.fillRect(wx + 30, winY + 28, 3, 3);
        ctx.fillRect(wx + 38, winY + 38, 3, 3);
        // Оконная рама
        ctx.strokeStyle = '#0c0f16';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, winY, winW, winH);
        ctx.strokeRect(wx + winW / 2 - 1, winY, 2, winH);
      });
      // Потолочный встроенный LED-светильник (светодиодная линия)
      ctx.fillStyle = 'rgba(230, 245, 255, 0.35)';
      ctx.fillRect(20, 8, W - 40, 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(W / 2 - 40, 8, 80, 2);
      // Темный напольный плинтус
      ctx.fillStyle = '#0c0e12';
      ctx.fillRect(0, H - 8, W, 8);
    } else if (key === 'map_int_factory' || key === 'map_int_fact_assembly') {
      // 2A. СБОРОЧНЫЙ ЦЕХ: огромные многосекционные заводские окна, подвесная кран-балка, двутавры
      ctx.fillStyle = '#15181c';
      ctx.fillRect(0, 0, W, H);
      // Стальные листы обшивки
      ctx.fillStyle = '#1c2128';
      ctx.fillRect(4, 4, W - 8, H - 8);
      // Высокие заводские окна в верхней части (свет с улицы через мутное стекло)
      const winW = 80, winH = 70, winY = 16;
      [24, W - 24 - winW].forEach(wx => {
        ctx.fillStyle = '#0b0d11';
        ctx.fillRect(wx, winY, winW, winH);
        // Стекло с дневным рассеянным заводским светом
        const g = ctx.createLinearGradient(0, winY, 0, winY + winH);
        g.addColorStop(0, '#32404e');
        g.addColorStop(1, '#1e2630');
        ctx.fillStyle = g;
        ctx.fillRect(wx + 2, winY + 2, winW - 4, winH - 4);
        // Решётка переплёта окна (6 секций)
        ctx.strokeStyle = '#101317';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, winY, winW, winH);
        ctx.beginPath();
        ctx.moveTo(wx + winW / 2, winY); ctx.lineTo(wx + winW / 2, winY + winH);
        ctx.moveTo(wx, winY + winH / 3); ctx.lineTo(wx + winW, winY + winH / 3);
        ctx.moveTo(wx, winY + (winH * 2) / 3); ctx.lineTo(wx + winW, winY + (winH * 2) / 3);
        ctx.stroke();
      });
      // Жёлтая подвесная кран-балка (overhead crane rail)
      ctx.fillStyle = '#b88612';
      ctx.fillRect(6, 92, W - 12, 10);
      ctx.fillStyle = '#181b20';
      for (let x = 8; x < W - 12; x += 16) {
        ctx.fillRect(x, 94, 6, 6);
      }
      // Подвесная каретка с тросом и крюком по центру
      ctx.fillStyle = '#d49b16';
      ctx.fillRect(W / 2 - 14, 98, 28, 14);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(W / 2 - 14, 98, 28, 14);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, 112); ctx.lineTo(W / 2, 132); // трос
      ctx.arc(W / 2 + 4, 136, 6, -Math.PI / 2, Math.PI / 2); // крюк
      ctx.stroke();
      // Настенный электрощит с рубильником
      ctx.fillStyle = '#2a313b';
      ctx.fillRect(W / 2 - 20, 24, 40, 48);
      ctx.strokeStyle = '#12151a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(W / 2 - 20, 24, 40, 48);
      ctx.fillStyle = '#e83434';
      ctx.fillRect(W / 2 - 14, 34, 8, 16); // рубильник
      ctx.fillStyle = '#34e855';
      ctx.fillRect(W / 2 + 6, 32, 4, 4); // зеленый LED
      ctx.fillRect(W / 2 + 6, 40, 4, 4); // индикатор
      // Плинтус
      ctx.fillStyle = '#0e1014';
      ctx.fillRect(0, H - 8, W, 8);
    } else if (key === 'map_int_fact_reactor') {
      // 2B. РЕАКТОРНЫЙ ЭНЕРГОБЛОК: бронеплиты, переплетение труб, манометры, знак радиации
      ctx.fillStyle = '#14161a';
      ctx.fillRect(0, 0, W, H);
      // Массивные бронеплиты с заклёпками
      ctx.fillStyle = '#1b2027';
      ctx.fillRect(4, 4, W - 8, H - 8);
      ctx.strokeStyle = '#0e1013';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      // Заклёпки по периметру
      ctx.fillStyle = '#525e6e';
      for (let x = 12; x < W - 12; x += 24) {
        ctx.fillRect(x, 8, 3, 3);
        ctx.fillRect(x, H - 14, 3, 3);
      }
      for (let y = 14; y < H - 14; y += 24) {
        ctx.fillRect(8, y, 3, 3);
        ctx.fillRect(W - 12, y, 3, 3);
      }
      // Жёлтый предупреждающий знак радиации / опасности по центру
      const zx = W / 2, zy = 40;
      ctx.fillStyle = '#d49b16';
      ctx.beginPath();
      ctx.moveTo(zx, zy - 18); ctx.lineTo(zx + 22, zy + 18); ctx.lineTo(zx - 22, zy + 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#14161a';
      ctx.beginPath();
      ctx.arc(zx, zy + 4, 4, 0, Math.PI * 2);
      ctx.fill();
      // Сложная система труб (горизонтальные и вертикальные)
      // Толстая главная труба
      ctx.fillStyle = '#445163';
      ctx.fillRect(10, 78, W - 20, 16);
      ctx.fillStyle = '#657790';
      ctx.fillRect(10, 80, W - 20, 4); // блик
      // Соединительные фланцы
      [60, W - 60].forEach(fx => {
        ctx.fillStyle = '#28313d';
        ctx.fillRect(fx, 74, 8, 24);
      });
      // Медная тонкая труба
      ctx.fillStyle = '#8c5028';
      ctx.fillRect(10, 104, W - 20, 8);
      ctx.fillStyle = '#ba703c';
      ctx.fillRect(10, 105, W - 20, 2);
      // Круглые аналоговые манометры со стрелками
      [75, W - 75].forEach(mx => {
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(mx, 70, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff4d6';
        ctx.beginPath(); ctx.arc(mx, 70, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.stroke();
        // Красная стрелка
        ctx.strokeStyle = '#c42222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx, 70); ctx.lineTo(mx + 6, 65); ctx.stroke();
      });
      // Аварийный красный пульсирующий маяк
      ctx.fillStyle = 'rgba(255, 40, 40, 0.4)';
      ctx.beginPath(); ctx.arc(zx, 18, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(zx - 4, 14, 8, 8);
      // Цоколь
      ctx.fillStyle = '#0a0c0e';
      ctx.fillRect(0, H - 8, W, 8);
    } else if (key === 'map_int_fact_warehouse') {
      // 2C. СКЛАДСКОЙ СЕКТОР: рулонные ворота с зеброй, грузовые стеллажи с ящиками
      ctx.fillStyle = '#15171b';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1e2229';
      ctx.fillRect(4, 4, W - 8, H - 8);
      // Большие рулонные секционные ворота по центру
      const gateW = 120, gateH = 100, gateX = W / 2 - gateW / 2, gateY = 48;
      ctx.fillStyle = '#262c36';
      ctx.fillRect(gateX, gateY, gateW, gateH);
      // Горизонтальные ламели ворот
      ctx.strokeStyle = '#14171d';
      ctx.lineWidth = 2;
      for (let y = gateY; y <= gateY + gateH; y += 12) {
        ctx.beginPath(); ctx.moveTo(gateX, y); ctx.lineTo(gateX + gateW, y); ctx.stroke();
      }
      // Сигнальная желто-черная полоса над воротами
      ctx.fillStyle = '#c49214';
      ctx.fillRect(gateX, gateY - 12, gateW, 12);
      ctx.fillStyle = '#14171d';
      for (let x = gateX - 10; x < gateX + gateW; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, gateY); ctx.lineTo(x + 8, gateY - 12); ctx.lineTo(x + 14, gateY - 12); ctx.lineTo(x + 6, gateY);
        ctx.closePath(); ctx.fill();
      }
      // Складские стеллажи по бокам
      [10, W - 46].forEach(rx => {
        // Вертикальные стойки стеллажа
        ctx.fillStyle = '#3a4454';
        ctx.fillRect(rx, 20, 6, H - 28);
        ctx.fillRect(rx + 30, 20, 6, H - 28);
        // Полки
        ctx.fillRect(rx, 50, 36, 4);
        ctx.fillRect(rx, 90, 36, 4);
        ctx.fillRect(rx, 130, 36, 4);
        // Ящики на полках
        ctx.fillStyle = '#5c452e';
        ctx.fillRect(rx + 4, 34, 14, 16);
        ctx.fillStyle = '#3a4e62';
        ctx.fillRect(rx + 20, 32, 12, 18);
        ctx.fillStyle = '#5c452e';
        ctx.fillRect(rx + 6, 74, 24, 16);
      });
      // Светофор ворот (красный/зеленый)
      ctx.fillStyle = '#121417';
      ctx.fillRect(gateX - 14, gateY + 10, 10, 22);
      ctx.fillStyle = '#ff3333';
      ctx.beginPath(); ctx.arc(gateX - 9, gateY + 16, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#33cc55';
      ctx.beginPath(); ctx.arc(gateX - 9, gateY + 26, 3, 0, Math.PI * 2); ctx.fill();
      // Плинтус
      ctx.fillStyle = '#0a0c0e';
      ctx.fillRect(0, H - 8, W, 8);
    } else if (key === 'map_int_fact_control') {
      // 2D. ДИСПЕТЧЕРСКАЯ: пульты управления, настенные мониторы с осциллограммами, вентиляция
      ctx.fillStyle = '#16191f';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#202630';
      ctx.fillRect(4, 4, W - 8, H - 8);
      // Панель из 3 настенных CRT/LCD мониторов
      const monW = 54, monH = 42, monY = 32;
      [24, W / 2 - monW / 2, W - 24 - monW].forEach((mx, i) => {
        ctx.fillStyle = '#12151a';
        ctx.fillRect(mx - 2, monY - 2, monW + 4, monH + 4);
        // Экран
        ctx.fillStyle = '#08141e';
        ctx.fillRect(mx, monY, monW, monH);
        // Графика на мониторе (осциллограмма / схема)
        ctx.strokeStyle = i === 1 ? '#33e885' : '#38b2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mx + 4, monY + monH / 2);
        for (let x = 6; x < monW - 4; x += 6) {
          const dy = ((x * 17 + i * 23) % 18) - 9;
          ctx.lineTo(mx + x, monY + monH / 2 + dy);
        }
        ctx.stroke();
      });
      // Серверный шкаф внизу по центру
      const srvW = 90, srvH = 64, srvX = W / 2 - srvW / 2, srvY = 88;
      ctx.fillStyle = '#14181f';
      ctx.fillRect(srvX, srvY, srvW, srvH);
      ctx.strokeStyle = '#2c3545';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(srvX, srvY, srvW, srvH);
      // Серверные юниты со светодиодами
      for (let sy = srvY + 4; sy < srvY + srvH - 6; sy += 12) {
        ctx.fillStyle = '#1c222b';
        ctx.fillRect(srvX + 4, sy, srvW - 8, 9);
        ctx.fillStyle = '#33ff77';
        ctx.fillRect(srvX + 8, sy + 3, 3, 3);
        ctx.fillRect(srvX + 14, sy + 3, 3, 3);
        ctx.fillStyle = '#ffaa22';
        ctx.fillRect(srvX + 22, sy + 3, 3, 3);
        ctx.fillStyle = '#10141a';
        ctx.fillRect(srvX + 32, sy + 2, srvW - 40, 5); // решётка
      }
      // Настенные круглые промышленные часы
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(W / 2, 18, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#c00'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(W / 2, 18); ctx.lineTo(W / 2 + 5, 15); ctx.stroke();
      // Плинтус
      ctx.fillStyle = '#0a0c0e';
      ctx.fillRect(0, H - 8, W, 8);
    } else if (key === 'map_int_canyon') {
      // 3. СКАЛЬНЫЙ ГРОТ КАНЬОНА: слоистый песчаник, деревянные крепи рудника, подвесной фонарь
      ctx.fillStyle = '#221610';
      ctx.fillRect(0, 0, W, H);
      // Слои горной породы
      const rockColors = ['#2c1c14', '#38241a', '#442c20', '#301e16', '#261812'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = rockColors[i];
        ctx.beginPath();
        const y0 = i * 32;
        ctx.moveTo(0, y0);
        ctx.bezierCurveTo(W * 0.3, y0 + 6, W * 0.7, y0 - 6, W, y0 + 3);
        ctx.lineTo(W, y0 + 34);
        ctx.bezierCurveTo(W * 0.6, y0 + 30, W * 0.2, y0 + 38, 0, y0 + 34);
        ctx.closePath();
        ctx.fill();
      }
      // Деревянная шахтная крепь (стойки и балка)
      ctx.fillStyle = '#3d2516';
      ctx.fillRect(24, 0, 20, H);
      ctx.fillRect(W - 44, 0, 20, H);
      ctx.fillRect(24, 12, W - 48, 16);
      // Текстура древесины и скобы
      ctx.fillStyle = '#5a3822';
      ctx.fillRect(28, 0, 4, H);
      ctx.fillRect(W - 40, 0, 4, H);
      ctx.fillStyle = '#1a100a';
      ctx.fillRect(22, 10, 24, 4); // скобы
      ctx.fillRect(W - 46, 10, 24, 4);
      // Подвесной керосиновый фонарь
      ctx.fillStyle = '#1a100a';
      ctx.fillRect(W / 2 - 1, 14, 2, 28);
      ctx.fillStyle = 'rgba(255, 180, 60, 0.4)';
      ctx.beginPath();
      ctx.arc(W / 2, 48, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc55';
      ctx.fillRect(W / 2 - 3, 44, 6, 8);
    } else if (key === 'map_int_bunker') {
      // 4. ВОЕННЫЙ БУНКЕР: массивный бетон, коммуникации, серверная ниша с индикаторами
      ctx.fillStyle = '#14171d';
      ctx.fillRect(0, 0, W, H);
      // Бетонные армированные блоки
      ctx.fillStyle = '#1c2028';
      ctx.fillRect(6, 6, W - 12, H - 12);
      ctx.strokeStyle = '#0d0f13';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, W - 12, H - 12);
      // Ниша стойки серверного оборудования по центру
      const sW = 84, sH = 95, sY = 32;
      ctx.fillStyle = '#0f1217';
      ctx.fillRect(W / 2 - sW / 2, sY, sW, sH);
      ctx.strokeStyle = '#252b36';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(W / 2 - sW / 2, sY, sW, sH);
      // Серверные юниты и мигающие индикаторы
      for (let sy = sY + 6; sy < sY + sH - 10; sy += 16) {
        ctx.fillStyle = '#181d24';
        ctx.fillRect(W / 2 - sW / 2 + 4, sy, sW - 8, 12);
        // Зеленые и янтарные LED
        ctx.fillStyle = '#33ff88';
        ctx.fillRect(W / 2 - sW / 2 + 8, sy + 4, 3, 3);
        ctx.fillRect(W / 2 - sW / 2 + 14, sy + 4, 3, 3);
        ctx.fillStyle = '#ffaa33';
        ctx.fillRect(W / 2 - sW / 2 + 22, sy + 4, 3, 3);
        // Вентиляционная решетка юнита
        ctx.fillStyle = '#0e1115';
        ctx.fillRect(W / 2 - sW / 2 + 32, sy + 3, sW - 42, 6);
      }
      // Красная аварийная световая полоса сверху
      ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
      ctx.fillRect(16, 10, W - 32, 4);
      // Массивный гермоборд по низу
      ctx.fillStyle = '#0b0d10';
      ctx.fillRect(0, H - 10, W, 10);
    } else if (key === 'map_wall_brick') {
      // Капитальная кирпичная стена здания (темный терракотовый клинкер)
      ctx.fillStyle = '#422822';
      ctx.fillRect(0, 0, W, H);
      const bH = 16, bW = 32;
      for (let y = 0; y < H; y += bH) {
        const row = Math.floor(y / bH);
        const shift = (row % 2) * (bW / 2);
        for (let x = -bW; x < W + bW; x += bW) {
          const bx = x + shift;
          ctx.fillStyle = '#6e382c';
          ctx.fillRect(bx + 1.5, y + 1.5, bW - 3, bH - 3);
          // Блик и тень на кирпиче
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(bx + 1.5, y + 1.5, bW - 3, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(bx + 1.5, y + bH - 3.5, bW - 3, 2);
        }
      }
      ctx.strokeStyle = '#1e1412';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    } else if (key === 'map_wall_concrete') {
      // Монолитная бетонная панель здания с технологическими стыками
      ctx.fillStyle = '#3c4048';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#4a505a';
      ctx.fillRect(3, 3, W - 6, H - 6);
      ctx.strokeStyle = '#22252a';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, W - 6, H - 6);
      // Анкерные гнезда по углам
      [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]].forEach(([ax, ay]) => {
        ctx.fillStyle = '#181a1e';
        ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#555e6c';
        ctx.beginPath(); ctx.arc(ax - 1, ay - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      });
    } else if (key === 'map_wall_partition') {
      // Тонкая внутренняя перегородка (офисная стена с алюминиевым профилем)
      ctx.fillStyle = '#262a32';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#343a46';
      ctx.fillRect(4, 4, W - 8, H - 8);
      ctx.strokeStyle = '#181a1f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      // Матовое стекло/вставка в верхней части
      ctx.fillStyle = 'rgba(120,160,200,0.25)';
      ctx.fillRect(8, 12, W - 16, 40);
      ctx.strokeStyle = 'rgba(180,210,240,0.4)';
      ctx.strokeRect(8, 12, W - 16, 40);
    } else if (key === 'p_dust') {
      // Песчинка/пылинка с мягким градиентным краем
      const rad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
      rad.addColorStop(0, 'rgba(235, 195, 135, 0.95)');
      rad.addColorStop(0.5, 'rgba(200, 155, 95, 0.6)');
      rad.addColorStop(1, 'rgba(160, 115, 65, 0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);
    } else if (key === 'p_ember') {
      // Горящая искра/пепел
      const rad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
      rad.addColorStop(0, 'rgba(255, 235, 160, 1)');
      rad.addColorStop(0.4, 'rgba(255, 120, 40, 0.8)');
      rad.addColorStop(1, 'rgba(180, 40, 10, 0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);
    } else if (key === 'p_drop') {
      // Капля конденсата/влаги в пещере
      ctx.fillStyle = 'rgba(160, 210, 255, 0.75)';
      ctx.beginPath();
      ctx.moveTo(W / 2, 1);
      ctx.lineTo(W - 1, H - 3);
      ctx.quadraticCurveTo(W / 2, H + 1, 1, H - 3);
      ctx.closePath();
      ctx.fill();
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
    const KNOWN = ['gr_grass', 'gr_sand', 'gr_stones', 'gr_beton', 'gr_beton_sand', 'gr_scorch', 'gr_city_pavement', 'gr_canyon_rock'];
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
    } else if (key === 'gr_city_pavement') {
      // Городской мощеный тротуар с бордюром и аккуратными плитками
      ctx.fillStyle = '#22252b';
      ctx.fillRect(0, 0, W, H);
      // Верхний гранитный бордюр
      ctx.fillStyle = '#656b78';
      ctx.fillRect(0, 0, W, 8);
      ctx.fillStyle = '#8a92a2';
      ctx.fillRect(0, 0, W, 2);
      ctx.fillStyle = '#181a1f';
      ctx.fillRect(0, 8, W, 2);
      // Квадратные тротуарные плиты 32x32
      const tW = 32, tH = 24;
      for (let y = 10; y < H; y += tH) {
        const row = Math.floor((y - 10) / tH);
        const shift = (row % 2) * (tW / 2);
        for (let x = -tW; x < W + tW; x += tW) {
          const px = x + shift;
          const col = ((row + Math.floor(px / tW)) % 2 === 0) ? '#484e5a' : '#3e4450';
          ctx.fillStyle = col;
          rectW(px + 1, y + 1, tW - 2, tH - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          rectW(px + 1, y + 1, tW - 2, 1.5);
        }
      }
    } else if (key === 'gr_canyon_rock') {
      // Слоистый природный скальный массив каньона
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(0, 0, W, H);
      const layers = [
        { y: 0, h: 22, col: '#7a5434', hi: '#9a6e45' },
        { y: 22, h: 28, col: '#5e3e24', hi: '#764e2d' },
        { y: 50, h: 36, col: '#48301c', hi: '#5c3d24' },
        { y: 86, h: 42, col: '#342214', hi: '#442d1a' }
      ];
      for (const L of layers) {
        ctx.fillStyle = L.col;
        ctx.fillRect(0, L.y, W, L.h);
        ctx.fillStyle = L.hi;
        ctx.fillRect(0, L.y, W, 2);
        // Швы и разломы
        ctx.fillStyle = '#1c120a';
        ctx.fillRect(0, L.y + L.h - 2, W, 2);
        for (let i = 0; i < 4; i++) {
          const rx = R(0, W);
          ctx.fillRect(rx, L.y + 2, 2, L.h - 4);
        }
      }
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
