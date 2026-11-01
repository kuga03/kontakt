// Фоновые дома: два параллакс-слоя (дальний/ближний) векторной графики.
// Пекутся один раз на тему в текстуры bgh_<theme>_far|near (1600px, тайлятся),
// дальше сцена только двигает tilePositionX. Детальные: крыши, окна
// (тёплые/тёмные), двери, трубы, антенны. Палитры — под цвета MAP_THEMES.
const PALS = {
  night:     { wall: 0x1a2030, roof: 0x11141f, winDark: 0x0d1018, winLit: 0xffd97a, door: 0x0c0e14, roofStyle: 'pitched', litP: 0.45 },
  sunset:    { wall: 0x2e1f2e, roof: 0x1c1220, winDark: 0x180f1a, winLit: 0xffb46b, door: 0x140c14, roofStyle: 'pitched', litP: 0.5 },
  wasteland: { wall: 0x2a2c20, roof: 0x1a1c12, winDark: 0x14150e, winLit: 0xffe08a, door: 0x101208, roofStyle: 'pitched', litP: 0.35 },
  krisha:    { wall: 0x232530, roof: 0x14151d, winDark: 0x101118, winLit: 0xffe08a, door: 0x0e0f16, roofStyle: 'pitched', litP: 0.5 },
  ulica:     { wall: 0x20222e, roof: 0x13141c, winDark: 0x0f1016, winLit: 0xffd97a, door: 0x0c0d13, roofStyle: 'pitched', litP: 0.55 },
  pechera:   { wall: 0x101012, roof: 0x08080a, winDark: 0x060607, winLit: 0x7dffb0, door: 0x08080a, roofStyle: 'rock', litP: 0.12 },
  peshera:   { wall: 0x141418, roof: 0x0a0a0d, winDark: 0x0a0a0e, winLit: 0x8fb8ff, door: 0x0a0a0d, roofStyle: 'rock', litP: 0.15 },
  pustoch:   { wall: 0x2a2012, roof: 0x1a1408, winDark: 0x140f06, winLit: 0xffc46b, door: 0x100b05, roofStyle: 'flat', litP: 0.4 },
  pustinya:  { wall: 0x3a3220, roof: 0x241e10, winDark: 0x1c1810, winLit: 0xffd080, door: 0x161208, roofStyle: 'flat', litP: 0.4 },
  zavod:     { wall: 0x1c2026, roof: 0x101216, winDark: 0x0e1014, winLit: 0xff9a55, door: 0x0a0c10, roofStyle: 'flat', litP: 0.3 }
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Один дом: корпус + крыша + окна + дверь + труба/антенна.
// baseY — низ (земля полосы), h — высота корпуса без крыши.
function drawHouse(g, rng, x, baseY, w, h, pal) {
  g.fillStyle(pal.wall, 1);
  g.fillRect(x, baseY - h, w, h);
  // Боковая тень справа — объём.
  g.fillStyle(0x000000, 0.25);
  g.fillRect(x + w - 9, baseY - h, 9, h);
  // Приземление: тёмная полоса снизу.
  g.fillStyle(0x000000, 0.35);
  g.fillRect(x, baseY - 6, w, 6);

  const top = baseY - h;
  if (pal.roofStyle === 'pitched') {
    const peak = 34 + rng() * 26;
    g.fillStyle(pal.roof, 1);
    g.fillTriangle(x - 9, top, x + w / 2, top - peak, x + w + 9, top);
    // Свес крыши.
    g.fillStyle(0x000000, 0.3);
    g.fillRect(x - 9, top - 2, w + 18, 5);
    // Труба (иногда) + антенна (иногда).
    if (rng() < 0.6) {
      const tx = x + 12 + rng() * (w - 36);
      g.fillStyle(pal.roof, 1);
      g.fillRect(tx, top - peak * 0.55 - 22, 12, 26);
      g.fillStyle(0x000000, 0.4);
      g.fillRect(tx, top - peak * 0.55 - 22, 12, 4);
    }
    if (rng() < 0.5) {
      const ax = x + 14 + rng() * (w - 28);
      g.lineStyle(2, pal.roof, 1);
      g.lineBetween(ax, top - 4, ax + 6, top - 26);
      g.fillStyle(pal.winLit, 0.9);
      g.fillCircle(ax + 6, top - 27, 2);
    }
  } else if (pal.roofStyle === 'flat') {
    // Парапет + будка/бак на крыше (иногда).
    g.fillStyle(pal.roof, 1);
    g.fillRect(x - 4, top - 11, w + 8, 13);
    if (rng() < 0.55) {
      const bw = 26 + rng() * 20;
      const bx = x + 8 + rng() * Math.max(1, w - bw - 16);
      g.fillStyle(pal.wall, 1);
      g.fillRect(bx, top - 11 - 22, bw, 22);
      g.fillStyle(pal.roof, 1);
      g.fillRect(bx - 3, top - 11 - 25, bw + 6, 5);
    }
    // Заводская труба (толстая, высокая, иногда с огоньком).
    if (pal === PALS.zavod || rng() < 0.25) {
      const tx = x + 10 + rng() * (w - 30);
      const th = 60 + rng() * 70;
      g.fillStyle(pal.wall, 1);
      g.fillRect(tx, top - th, 18, th);
      g.fillStyle(pal.roof, 1);
      g.fillRect(tx - 3, top - th - 5, 24, 6);
      if (rng() < 0.4) {
        g.fillStyle(0xff4444, 0.9);
        g.fillCircle(tx + 9, top - th - 9, 2.5);
      }
    }
  } else {
    // Скала: рваный верх из 3–4 зубцов.
    g.fillStyle(pal.roof, 1);
    const n = 3 + Math.floor(rng() * 2);
    let px = x;
    g.fillRect(x, top, w, 6);
    for (let i = 0; i < n; i++) {
      const nx = x + (w * (i + 1)) / n;
      const ph = 18 + rng() * 30;
      g.fillTriangle(px, top + 2, (px + nx) / 2, top - ph, nx, top + 2);
      px = nx;
    }
  }

  // Окна сеткой: тёплые / тёмные / пропуск.
  const cols = Math.max(1, Math.floor((w - 24) / 26));
  const rows = Math.max(1, Math.floor((h - 44) / 34));
  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      if (rng() < 0.18) continue;
      const wx = x + 14 + ci * ((w - 28) / Math.max(1, cols - 1 || 1)) - 7;
      const wy = top + 16 + ri * 32;
      if (wy + 18 > baseY - 8) continue;
      const lit = rng() < pal.litP;
      g.fillStyle(lit ? pal.winLit : pal.winDark, 1);
      g.fillRect(wx, wy, 14, 18);
      // Рама крестом.
      g.fillStyle(lit ? pal.wall : 0x000000, lit ? 0.55 : 0.5);
      g.fillRect(wx + 6, wy, 2, 18);
      g.fillRect(wx, wy + 8, 14, 2);
    }
  }
  // Дверь (кроме скал).
  if (pal.roofStyle !== 'rock') {
    g.fillStyle(pal.door, 1);
    g.fillRect(x + w / 2 - 11, baseY - 34, 22, 34);
    g.fillStyle(pal.winLit, 0.5);
    g.fillCircle(x + w / 2 + 6, baseY - 18, 1.5);
  }
}

// Полоса домов 1600px (тайлится): дома не пересекают края.
function drawStrip(g, themeId, W, H, hMin, hMax, haze) {
  const pal = PALS[themeId] || PALS.night;
  const rng = mulberry32(hashStr(themeId + ':' + W + 'x' + H));
  let x = 16 + rng() * 30;
  while (x < W - 120) {
    const w = 130 + rng() * 170;
    if (x + w > W - 16) break;
    const h = hMin + rng() * (hMax - hMin);
    drawHouse(g, rng, Math.round(x), H, Math.round(w), Math.round(h), pal);
    x += w + 26 + rng() * 90;
  }
  // Воздушная перспектива: лёгкое высветление верха полосы.
  if (haze > 0) {
    g.fillStyle(0xffffff, haze * 0.06);
    g.fillRect(0, 0, W, Math.round(H * 0.4));
  }
}

// Печёт оба слоя (1600px). Возвращает ключи текстур или null.
export function bakeHouseLayers(scene, themeId) {
  try {
    const id = (themeId && PALS[themeId]) ? themeId : 'night';
    const farKey = `bgh_${id}_far`;
    const nearKey = `bgh_${id}_near`;
    if (!scene || !scene.textures || !scene.make) return null;
    if (!scene.textures.exists(farKey)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      drawStrip(g, id, 1600, 360, 90, 180);
      g.generateTexture(farKey, 1600, 360);
      g.destroy();
    }
    if (!scene.textures.exists(nearKey)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      drawStrip(g, id, 1600, 430, 150, 300);
      g.generateTexture(nearKey, 1600, 430);
      g.destroy();
    }
    return { far: farKey, near: nearKey };
  } catch (e) {
    return null;
  }
}
