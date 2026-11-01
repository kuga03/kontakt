// Генератор уровней из спрайтов автора: не каша, а связная карта.
// Логика: земля во всю ширину → цепочка допрыгиваемых платформ
// (шаг ≤320 по X, ≤90 вверх) → ящики-укрытия у земли между ними →
// спавны (игрок слева, враги справа врозь) → предметы вдоль маршрута.
const SETS = [
  { theme: 'pustinya', ground: 'gr_sand', plat: 'gr_beton_sand', hi: 'gr_stones', name: 'Пустынный' },
  { theme: 'pustoch', ground: 'gr_grass', plat: 'gr_beton', hi: 'gr_stones', name: 'Зелёный' },
  { theme: 'zavod', ground: 'gr_beton', plat: 'gr_beton', hi: 'gr_stones', name: 'Заводской' }
];

const PLACE_NAMES = ['Полигон', 'Руины', 'Плацдарм', 'Перекрёсток', 'Форпост', 'Карьер'];

const R = (a, b) => a + Math.random() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
// Phaser может быть недоступен (юнит-тесты/редактор без движка) — безопасный фолбэк.
const Clamp = (typeof Phaser !== 'undefined' && Phaser.Math)
  ? Phaser.Math.Clamp
  : ((v, a, b) => Math.min(b, Math.max(a, v)));

export function generateLevel(existingCount) {
  const set = SETS[Math.floor(Math.random() * SETS.length)];
  const width = [2800, 3200, 3600, 4000, 4400, 4800][Math.floor(Math.random() * 6)];
  const height = 900;
  const groundTop = height - 80;
  const objects = [];

  // Земля во всю ширину.
  objects.push({ type: 'ground', x: width / 2, y: groundTop + 40, w: width, h: 80, texKey: set.ground });

  // Цепочка платформ слева направо: каждая достижима с предыдущей.
  let x = 350 + R(0, 150);
  let y = 660 + R(0, 40);
  const plats = [];
  const nPlat = RI(4, 6);
  for (let i = 0; i < nPlat && x < width - 350; i++) {
    const w = 260 + R(0, 120);
    plats.push({ x, y, w });
    objects.push({ type: 'ground', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: 28, texKey: set.plat });
    x += 240 + R(0, 100);
    y -= 20 + R(0, 70);
    if (y < 380) y = 620 + R(0, 40);
  }

  // 1–2 высокие каменные полки над серединой пролётов.
  const nHi = RI(1, 2);
  for (let i = 0; i < nHi && plats.length > 2; i++) {
    const p = plats[1 + Math.floor(Math.random() * (plats.length - 2))];
    const hx = Clamp(p.x + R(-140, 140), 300, width - 300);
    objects.push({ type: 'ground', x: Math.round(hx), y: Math.round(p.y - 130), w: 240, h: 28, texKey: set.hi });
  }

  // Ящики-укрытия у земли между платформами.
  const nCov = RI(3, 5);
  for (let i = 0; i < nCov; i++) {
    const cx = 500 + (width - 1000) * ((i + 0.5) / nCov) + R(-80, 80);
    objects.push({ type: 'cover', x: Math.round(cx), y: groundTop - 45, w: 60, h: 90 });
  }

  // Спавны: игрок слева, враги справа врозь.
  const px = 150 + R(0, 120);
  objects.push({ type: 'spawn', spawnType: 'player', x: Math.round(px), y: 700, w: 26, h: 26 });
  const nEn = RI(3, 5);
  for (let i = 0; i < nEn; i++) {
    const ex = width - 250 - i * Math.max(180, (width * 0.35) / nEn) - R(0, 60);
    objects.push({ type: 'spawn', spawnType: 'enemy', x: Math.round(Math.max(width * 0.55, ex)), y: 700, w: 26, h: 26 });
  }

  // Предметы вдоль маршрута: аптечка в центре, патроны у старта,
  // граната и броня дальше.
  objects.push({ type: 'spawn', spawnType: 'medkit', x: Math.round(width / 2), y: 780, w: 26, h: 26 });
  objects.push({ type: 'spawn', spawnType: 'ammo', x: Math.round(px + 400), y: 780, w: 26, h: 26 });
  objects.push({ type: 'spawn', spawnType: 'frag', x: Math.round(width * 0.68), y: 780, w: 26, h: 26 });
  objects.push({ type: 'spawn', spawnType: 'armor', x: Math.round(width * 0.82), y: 780, w: 26, h: 26 });

  const place = PLACE_NAMES[Math.floor(Math.random() * PLACE_NAMES.length)];
  return {
    name: `${set.name} ${place} ${(existingCount || 0) + 1}`,
    width,
    height,
    theme: set.theme,
    enemies: nEn,
    objective: 'Уничтожить всех врагов',
    reward: { coins: 200, experience: 100 },
    objects
  };
}
