// tools/train/gate.mjs — ГЕЙТ ПРИЁМКИ. Гоняет 33 сида и проверяет критерии ТЗ.
// Правило (2026-10-25): решение принимается ТОЛЬКО по 33 сидам; 11 — скрин,
// он врёт (доказано: 12/13 → 24/26). Порог: капсы ≥35, доставка ≥24,
// фитнес ≥1805, простой ≤28.5%, клип physMaxDur = 1.
//
// Запуск: node tools/train/gate.mjs [--tactics f.json] [--out tmp/gate.json]
// Выход: 0 — приёмка взята, 1 — нет (печатает, какие критерии провалены).
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const SEEDS33 = '1000,1007,1014,1021,1035,1049,1105,1337,2000,2001,2002,3000,3007,3014, ' +
  '3021,3035,3049,3105,3337,4000,4001,4002,500,507,514,521,535,549,605,637,700,701,702';
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const OUT = arg('out', 'tmp/gate.json');
const TAC = arg('tactics', null);

const LIMITS = {
  blueCaps: { min: 35, label: 'капсы синих' },
  seedsWithBlue: { min: 24, label: 'доставка (матчей с заносом)' },
  meanFitness: { min: 1805, label: 'фитнес' },
  idlePct: { max: 28.5, label: 'простой, %' }
};

const args = ['tools/train/bench.mjs', '--seeds', SEEDS33, '--ticks', '18000',
  '--workers', '11', '--out', OUT];
if (TAC) args.push('--tactics', TAC);
const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (r.status !== 0) { console.log('[gate] bench упал'); process.exit(2); }

const m = JSON.parse(readFileSync(OUT, 'utf8'));
const a = m.a || {};
const fails = [];
for (const [k, lim] of Object.entries(LIMITS)) {
  const v = a[k];
  if (typeof v !== 'number') { fails.push(`${lim.label}: нет данных (${k})`); continue; }
  if (lim.min != null && v < lim.min) fails.push(`${lim.label}: ${v} < ${lim.min}`);
  if (lim.max != null && v > lim.max) fails.push(`${lim.label}: ${v} > ${lim.max}`);
}
// клип: physMaxDur должен быть 1 (кратковременный), penUnexpl — 0
const pd = a.penPhysMaxDur, pe = a.penUnexpl;
if (typeof pd === 'number' && pd !== 1) fails.push(`клип physMaxDur: ${pd} ≠ 1`);
if (typeof pe === 'number' && pe !== 0) fails.push(`клип penUnexpl: ${pe} ≠ 0`);

console.log(`[gate] 33 сида: капсы ${a.blueCaps}/${a.redCaps}, доставка ${a.seedsWithBlue}/33, ` +
  `фитнес ${(a.meanFitness || 0).toFixed(1)}, простой ${(a.idlePct || 0).toFixed(1)}%, ` +
  `клип ${pe}/${pd}, прыжков ${Math.round(a.jumps || 0)}`);
if (fails.length) {
  console.log('[gate] ПРИЁМКА НЕ ВЗЯТА:');
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
console.log('[gate] ПРИЁМКА ВЗЯТА ✅');
