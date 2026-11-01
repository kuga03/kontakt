// bench.mjs — многомерный прогон матчей на наборе сидов (A/B слоёв тактик).
//
// ЗАЧЕМ: одиночный матч ничего не доказывает — фитнес шумит, а «доставка есть»
// на одном сиде и «доставки нет» на другом. Этот инструмент даёт:
//   • доставку по сидам (синие захваты), а не один суммарный фитнес;
//   • парное сравнение двух слоёв тактик на ОДНИХ сидах (честный A/B);
//   • разделение тренировочных и валидационных сидов.
//
// Запуск:
//   node tools/train/bench.mjs --seeds 1337,1000,1007 --ticks 18000
//   node tools/train/bench.mjs --seeds 1337,1000 --tactics a.json --tactics2 b.json
//
// Не требует --import: импортирует только fitness.mjs (без игровых модулей),
// а матчи запускает как дочерние процессы run.mjs.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchFitness, breakagePenalty } from '../headless/fitness.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
}

const SEEDS = String(arg('seeds', '1337,1000,1007,1014,1021,1028,1035,1049'))
  .split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
const TICKS = parseInt(arg('ticks', '18000'), 10);
const WORKERS = Math.max(1, parseInt(arg('workers', '6'), 10));
// 'current'/'none' = без файла, т.е. живой слой TACTICS (дефолты + botBrain.js).
function layerArg(name) {
  const v = arg(name, null);
  return (v == null || v === 'current' || v === 'none') ? null : v;
}
const TACTICS_A = layerArg('tactics');
// B задан, если флаг ВООБЩЕ присутствует: 'current' — валидная B-сторона.
// (null файла ≠ отсутствие B — на этом A/B раньше молча терял вторую сторону.)
const HAS_B = arg('tactics2', null) != null;
const TACTICS_B = layerArg('tactics2');  // второй слой для парного A/B
const OUT = arg('out', null);
const TIMEOUT_MS = parseInt(arg('timeout', '300000'), 10);
const MAP = arg('map', null);   // k486: прогон на копии карты без правки maps/
const LABEL = arg('label', TACTICS_A ? String(TACTICS_A) : 'current');

if (!SEEDS.length) { console.error('[bench] no seeds'); process.exit(1); }
for (const f of [TACTICS_A, TACTICS_B]) {
  if (f && !existsSync(f)) { console.error('[bench] tactics file not found:', f); process.exit(1); }
}

// Один матч. Возвращает метрики или { error }.
function runMatch(seed, tactics, idx, workDir) {
  return new Promise((resolve) => {
    const outFile = join(workDir, `out_${idx}.json`);
    const args = ['--import', './tools/headless/register.mjs', './tools/headless/run.mjs',
      '--ticks', String(TICKS), '--seed', String(seed), '--out', outFile];
    if (tactics) args.push('--tactics', tactics);
    if (MAP) args.push('--map', MAP);
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
    // Страховка от зависания: матч не должен жить дольше ~1.5× ожидаемого.
    // 300с: матч на 18000 тиков при 8-12 параллельных прогонах идёт 85-190с,
    // прежний гейт 120с убивал живые матчи (ложные «FAILED»).
    const guard = setTimeout(() => { try { child.kill(); } catch (e) {} }, TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(guard);
      try {
        const m = JSON.parse(readFileSync(outFile, 'utf8'));
        resolve({
          ok: true, sig: m.scores || { blue: 0, red: 0 }, flag: m.flag || {},
          saw: m.saw || {}, fitness: matchFitness(m),
          breakage: breakagePenalty(m.saw), mapId: m.mapId, gameOver: !!m.gameOver,
          idle: m.idle || null,
          pen: m.pen || null,
          tps: m.tps, wallMs: m.wallMs,
        });
      } catch (e) {
        resolve({ ok: false, error: `exit=${code} ${e.message}` });
      }
    });
  });
}

// Пул воркеров: не больше WORKERS одновременных матчей.
async function pool(tasks, workers) {
  const out = new Array(tasks.length);
  let next = 0;
  async function lane() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      out[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, tasks.length) }, lane));
  return out;
}

function summarize(rows, label) {
  const ok = rows.filter((r) => r.ok);
  const n = ok.length || 1;
  const blue = ok.reduce((a, r) => a + (r.sig.blue | 0), 0);
  const red = ok.reduce((a, r) => a + (r.sig.red | 0), 0);
  const bPick = ok.reduce((a, r) => a + (r.flag.bluePickup | 0), 0);
  const rPick = ok.reduce((a, r) => a + (r.flag.redPickup | 0), 0);
  const fit = ok.reduce((a, r) => a + r.fitness, 0) / n;
  const minB = ok.reduce((a, r) => a + (typeof r.flag.minBlue === 'number' ? r.flag.minBlue : 3800), 0) / n;
  const brk = ok.reduce((a, r) => a + r.breakage, 0) / n;
  const jumps = ok.reduce((a, r) => a + (r.saw.hopf | 0), 0) / n;
  const idle = ok.reduce((a, r) => a + ((r.idle && r.idle.bluePct) || 0), 0) / n;
  const idleNoMove = ok.reduce((a, r) => a + ((r.idle && r.idle.noMovePct) || 0), 0) / n;
  const idleDead = ok.reduce((a, r) => a + ((r.idle && r.idle.deadPct) || 0), 0) / n;
  const idleMax = ok.reduce((a, r) => Math.max(a, (r.idle && r.idle.maxStreakMs) || 0), 0);
  const penEvents = ok.reduce((a, r) => a + ((r.pen && r.pen.events) || 0), 0);
  const penStance = ok.reduce((a, r) => a + ((r.pen && r.pen.stance) || 0), 0);
  const penUnexpl = ok.reduce((a, r) => a + ((r.pen && r.pen.unexpl) || 0), 0);
  const penThin = ok.reduce((a, r) => a + ((r.pen && r.pen.thin) || 0), 0);
  const penPhys = ok.reduce((a, r) => a + ((r.pen && r.pen.phys && r.pen.phys.events) || 0), 0);
  const penPhysTicks = ok.reduce((a, r) => a + ((r.pen && r.pen.phys && r.pen.phys.ticks) || 0), 0);
  const penPhysMaxDur = ok.reduce((a, r) => Math.max(a, (r.pen && r.pen.phys && r.pen.phys.maxDur) || 0), 0);
  const clipTicks = ok.reduce((a, r) => a + ((r.pen && r.pen.clipTicks) || 0), 0);
  const idleBySrc = {};
  const idleByVeto = {};
  for (const r of ok) {
    const b = r.idle && r.idle.bySrc;
    if (b) for (const k in b) idleBySrc[k] = (idleBySrc[k] || 0) + b[k];
    const v = r.idle && r.idle.byVeto;
    if (v) for (const k in v) idleByVeto[k] = (idleByVeto[k] || 0) + v[k];
  }
  return {
    label, matches: ok.length, failed: rows.length - ok.length,
    blueCaps: blue, redCaps: red,
    // Доставка — доля СИДОВ, где синие хотя бы раз занесли (капсов бывает >1 на матч).
    seedsWithBlue: ok.filter((r) => (r.sig.blue | 0) > 0).length,
    deliveryRate: ok.length ? ok.filter((r) => (r.sig.blue | 0) > 0).length / ok.length : 0,
    bluePickups: bPick, redPickups: rPick,
    meanFitness: fit, meanMinBlue: minB, meanBreakage: brk,
    jumps, idlePct: idle, idleMaxMs: idleMax, idleBySrc, idleByVeto,
    idleNoMovePct: idleNoMove, idleDeadPct: idleDead,
    penEvents, penStance, penUnexpl, penThin, clipTicks, penPhys, penPhysTicks, penPhysMaxDur,
  };
}

function fmt(s) {
  return `${s.label}: matches=${s.matches}${s.failed ? ` FAILED=${s.failed}` : ''} ` +
    `capsB=${s.blueCaps} capsR=${s.redCaps} delivery=${(s.deliveryRate * 100).toFixed(0)}% ` +
    `withBlue=${s.seedsWithBlue}/${s.matches} picksB=${s.bluePickups} picksR=${s.redPickups} ` +
    `fit=${s.meanFitness.toFixed(1)} minBlue=${s.meanMinBlue.toFixed(0)} brk=${s.meanBreakage.toFixed(1)} ` +
    `jumps=${s.jumps.toFixed(0)} idle=${s.idlePct.toFixed(1)}% maxIdle=${Math.round(s.idleMaxMs)}ms ` +
    `pen=${s.penEvents} (стойка=${s.penStance} БЕЗ_СТОЙКИ=${s.penUnexpl} тонких=${s.penThin}) ` +
    `clipT=${s.clipTicks} penPhys=${s.penPhys} physMaxDur=${s.penPhysMaxDur}`;
}

async function main() {
  const workDir = mkdtempSync(join(tmpdir(), 'bench_'));
  const t0 = Date.now();
  console.log(`[bench] seeds=${SEEDS.length} ticks=${TICKS} workers=${WORKERS} ` +
    `A=${TACTICS_A || 'current'}${HAS_B ? ` B=${TACTICS_B || 'current'}` : ''}`);

  const rowsA = await pool(SEEDS.map((s, i) => () => runMatch(s, TACTICS_A, `a${i}`, workDir)), WORKERS);
  let rowsB = null;
  if (HAS_B) {
    rowsB = await pool(SEEDS.map((s, i) => () => runMatch(s, TACTICS_B, `b${i}`, workDir)), WORKERS);
  }
  try { rmSync(workDir, { recursive: true, force: true }); } catch (e) {}

  const A = summarize(rowsA, LABEL);
  console.log('[bench] ' + fmt(A));
  if (A.idleBySrc) {
    const tot = Object.values(A.idleBySrc).reduce((x, y) => x + y, 0) || 1;
    const top = Object.entries(A.idleBySrc).sort((x, y) => y[1] - x[1]).slice(0, 6)
      .map(([k, v]) => `${k}:${(100 * v / tot).toFixed(0)}%`).join(' ');
    console.log(`[bench] idle by src (синие): ${top}`);
    console.log(`[bench] idle split (синие): без владельца ${A.idleNoMovePct.toFixed(1)}% ` +
      `(из них без видимого врага ${A.idleDeadPct.toFixed(1)}%) из ${A.idlePct.toFixed(1)}%`);
    if (A.idleByVeto) {
      const tv = Object.values(A.idleByVeto).reduce((x, y) => x + y, 0) || 1;
      const topv = Object.entries(A.idleByVeto).sort((x, y) => y[1] - x[1]).slice(0, 8)
        .map(([k, v]) => `${k}:${(100 * v / tv).toFixed(0)}%`).join(' ');
      console.log(`[bench] idle by veto (синие, команда была): ${topv}`);
    }
  }

  const out = { ticks: TICKS, seeds: SEEDS, workMs: Date.now() - t0, a: A, rowsA,
    perSeedA: SEEDS.map((s, i) => ({ seed: s, blue: rowsA[i].ok ? rowsA[i].sig.blue : null, red: rowsA[i].ok ? rowsA[i].sig.red : null, fit: rowsA[i].ok ? Math.round(rowsA[i].fitness) : null })) };

  if (rowsB) {
    const B = summarize(rowsB, TACTICS_B || 'B(current)');
    console.log('[bench] ' + fmt(B));
    // Парное сравнение: важно не среднее, а на скольких сидах B лучше.
    let better = 0, worse = 0, same = 0;
    const paired = SEEDS.map((s, i) => {
      const a = rowsA[i], b = rowsB[i];
      if (!a.ok || !b.ok) return { seed: s, delta: null };
      const d = b.fitness - a.fitness;
      if (d > 1e-9) better++; else if (d < -1e-9) worse++; else same++;
      return { seed: s, fitA: Math.round(a.fitness), fitB: Math.round(b.fitness), delta: Math.round(d), capsA: a.sig.blue, capsB: b.sig.blue };
    });
    console.log(`[bench] paired: B better ${better}, worse ${worse}, same ${same} of ${SEEDS.length}`);
    console.log(`[bench] delta meanFitness ${(B.meanFitness - A.meanFitness >= 0 ? '+' : '')}${(B.meanFitness - A.meanFitness).toFixed(1)} ` +
      `capsB ${A.blueCaps}->${B.blueCaps} capsR ${A.redCaps}->${B.redCaps}`);
    out.b = B; out.rowsB = rowsB; out.paired = paired;
    out.comparison = { better, worse, same, dFit: B.meanFitness - A.meanFitness, dCapsB: B.blueCaps - A.blueCaps };
    console.table(paired);
  }
  console.table(out.perSeedA);

  if (OUT) {
    try { mkdirSync(dirname(OUT), { recursive: true }); } catch (e) {}
    writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log('[bench] wrote', OUT);
  }
  console.log(`[bench] done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
