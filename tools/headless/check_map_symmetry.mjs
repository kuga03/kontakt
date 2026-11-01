// check_map_symmetry.mjs — ЧИСТАЯ ДИАГНОСТИКА: проверка зеркальности карты
// относительно вертикальной оси x = width/2.
//
// ВАЖНО про конвенции maps/*.json: у ВСЕХ объектов (platform/cover/ground/
// wall/spawn) x и y — ЦЕНТР, w/h — размер. (Проверено: площадка 1900,w2000
// при левом крае вылезала бы за карту 3800; при центре — 900..2900.)
// Спавны зеркалятся ПО РОЛИ: player↔enemy, team↔enemy, flagBlue↔flagRed;
// объекты, стоящие на оси (|2*axis - x - x| == 0), симметричны сами себе.
//
// Запуск: node tools/headless/check_map_symmetry.mjs [--map maps/ctf.json] [--tol 2]
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const MAP = arg('map', 'maps/ctf.json');
const TOL = parseFloat(arg('tol', '2'));

const m = JSON.parse(readFileSync(MAP, 'utf8'));
const W = m.width || 3800;
const axis = W / 2;

const spawnMirror = { player: 'enemy', enemy: 'player', team: 'enemy', flagBlue: 'flagRed', flagRed: 'flagBlue' };
const kind = (o) => (o.type === 'spawn' ? 'spawn:' + (o.spawnType || '?') : o.type);
const mirrorKind = (o) => {
  if (o.type !== 'spawn') return kind(o);
  const ms = spawnMirror[o.spawnType];
  return ms ? 'spawn:' + ms : kind(o);
};

const items = m.objects.map((o) => ({ o, t: kind(o), mt: mirrorKind(o), cx: o.x, y: o.y, w: o.w || 0, h: o.h || 0 }));
const used = new Set();
const pairs = [];
const unpaired = [];

for (let i = 0; i < items.length; i++) {
  if (used.has(i)) continue;
  const a = items[i];
  if (Math.abs(2 * axis - a.cx - a.cx) <= TOL) { used.add(i); pairs.push([a, a, 'self']); continue; }
  let found = -1;
  for (let j = 0; j < items.length; j++) {
    if (j === i || used.has(j)) continue;
    const b = items[j];
    if (b.t !== a.mt) continue;
    if (Math.abs((2 * axis - b.cx) - a.cx) <= TOL &&
        Math.abs(b.y - a.y) <= TOL &&
        Math.abs(b.w - a.w) <= TOL &&
        Math.abs(b.h - a.h) <= TOL) { found = j; break; }
  }
  if (found >= 0) { used.add(i); used.add(found); pairs.push([a, items[found], 'pair']); }
  else unpaired.push(a);
}

console.log(`[sym] ${MAP}: объектов ${items.length}, ось x=${axis}, допуск ${TOL}px`);
console.log(`[sym] пар/самосимметричных: ${pairs.length}, БЕЗ ПАРЫ: ${unpaired.length}`);
for (const a of unpaired) {
  console.log(`[sym] НЕТ ПАРЫ: ${a.t} x=${a.cx} y=${a.y} w=${a.w} h=${a.h} | зеркало: ${a.mt} x=${2 * axis - a.cx}`);
}
if (!unpaired.length) console.log('[sym] КАРТА ЗЕРКАЛЬНА');
process.exit(unpaired.length ? 1 : 0);
