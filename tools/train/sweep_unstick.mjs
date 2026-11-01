// tools/train/sweep_unstick.mjs — СЕТОЧНЫЙ ре-тюн анти-стака (k611).
// Каждая точка = полный гейт 33 сида (node tools/train/bench.mjs) с
// --tactics-оверрайдом. Пишет tmp/sweep_unstick.json с агрегатом по точке:
// капсы B/R, доставка, фитнес, простой%, maxIdle(с), прыжки.
// Запуск: node tools/train/sweep_unstick.mjs [--only 0,1,2]
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

// tmp/ в .gitignore и может отсутствовать после чистой клоне/чистки.
mkdirSync('tmp', { recursive: true });

const SEEDS33 = '1000,1007,1014,1021,1035,1049,1105,1337,2000,2001,2002,3000,3007,3014,3021,3035,3049,3105,3337,4000,4001,4002,500,507,514,521,535,549,605,637,700,701,702';

// Сетка: intentOnMoveOnly × stallMs × movePx (moveVx/intentMs пока базовые).
const GRID = [
  { id: 'a', intentOnMoveOnly: true,  stallMs: 1500, movePx: 30 },
  { id: 'b', intentOnMoveOnly: true,  stallMs: 2500, movePx: 15 },
  { id: 'c', intentOnMoveOnly: true,  stallMs: 4000, movePx: 30 },
  { id: 'd', intentOnMoveOnly: false, stallMs: 1500, movePx: 30 },
  { id: 'e', intentOnMoveOnly: false, stallMs: 4000, movePx: 30 },
  { id: 'f', intentOnMoveOnly: true,  stallMs: 1500, movePx: 15 },
];

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const only = arg('only');
let grid = GRID;
if (only) {
  const idx = only.split(',').map((s) => parseInt(s.trim(), 10));
  grid = idx.map((i) => GRID[i]);
}

const results = [];
for (const p of grid) {
  const tacFile = `tmp/unstick_${p.id}.json`;
  writeFileSync(tacFile, JSON.stringify({ move: { unstick: { intentOnMoveOnly: p.intentOnMoveOnly, stallMs: p.stallMs, movePx: p.movePx } } }));
  const out = `tmp/sweep_${p.id}.json`;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['tools/train/bench.mjs', '--seeds', SEEDS33, '--ticks', '18000',
    '--workers', '11', '--tactics', tacFile, '--out', out], { stdio: 'inherit' });
  if (r.status !== 0 || !existsSync(out)) { results.push({ id: p.id, error: 'bench fail' }); continue; }
  const m = JSON.parse(readFileSync(out, 'utf8'));
  const a = m.a || {};
  results.push({
    id: p.id, intentOnMoveOnly: p.intentOnMoveOnly, stallMs: p.stallMs, movePx: p.movePx,
    caps: `${a.blueCaps}/${a.redCaps}`, delivery: a.seedsWithBlue, fitness: +(a.meanFitness || 0).toFixed(1),
    idle: +(a.idlePct || 0).toFixed(1), maxIdle: Math.round((a.idleMaxMs || 0) / 1000), jumps: Math.round(a.jumps || 0),
    sec: Math.round((Date.now() - t0) / 1000),
  });
  console.log(`[sweep] ${p.id} caps=${a.blueCaps}/${a.redCaps} del=${a.seedsWithBlue} fit=${(+a.meanFitness).toFixed(1)} idle=${(+a.idlePct).toFixed(1)}% maxIdle=${Math.round(a.idleMaxMs / 1000)}s jumps=${Math.round(a.jumps)}`);
}

writeFileSync('tmp/sweep_unstick.json', JSON.stringify(results, null, 2));
console.log('--- ИТОГ ---');
console.table(results);
