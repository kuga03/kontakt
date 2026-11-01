// evolve.mjs — эволюционный поиск параметров ИИ (Phase 2).
//
// Идея: вектор параметров TACTICS (js/ai/tactics.js) мутируется, каждый
// кандидат прогоняется в headless-матче (tools/headless/run.mjs) на нескольких
// сидах, фитнес = объективная игра + вклад + бой − поломки. Лучшие кандидаты
// формируют следующее поколение. Экспорт лучшего вектора — в js/data/botBrain.js.
//
// Запуск (--import ОБЯЗАТЕЛЕН: tactics.js — ESM в commonjs-пакете):
//   node --import ./tools/headless/register.mjs ./tools/train/evolve.mjs \
//     --generations 10 --pop 10 --seeds 5 --ticks 18000
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TACTICS } from '../../js/ai/tactics.js';
import { matchFitness } from '../headless/fitness.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const argv = process.argv.slice(2);
function arg(name, def) { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; }
const GENERATIONS = parseInt(arg('generations', '20'), 10);
const POP = parseInt(arg('pop', '12'), 10);
const MU = Math.max(2, Math.floor(POP / 3));
const SEEDS = parseInt(arg('seeds', '3'), 10);
// 18000 = 300с, реальная длина CTF при scoreLimit=3. Не уменьшать без причины:
// на 6000/100с доставка просто не успевает и фитнес учит не тому.
const TICKS = parseInt(arg('ticks', '18000'), 10);
// Потолок ОДНОВРЕМЕННЫХ матчей, а не кандидатов: один матч ~400 МБ,
// поэтому WORKERS × SEEDS процессов (12×5) уводили машину в своп.
const WORKERS = parseInt(arg('workers', '8'), 10);
const CAND_BATCH = Math.max(1, Math.floor(WORKERS / SEEDS));
const ONLY = arg('only', 'nav,kit,combat,ult,escort,carry');
const OUT = arg('out', 'tools/train/best.json');

// Вектор параметров: [путь, min, max]. Дефолт = текущее значение в TACTICS.
const SPEC = [
  ['nav.dist', 200, 600], ['nav.dur', 1000, 4000], ['nav.distHigh', 100, 300],
  ['nav.feetTier', 500, 800], ['nav.coverFails', 2, 5], ['nav.wideDist', 400, 900],
  ['nav.wideDur', 2000, 5000], ['nav.forceDist', 600, 1200], ['nav.forceDur', 3000, 6000],
  ['nav.stuckN', 2, 5], ['nav.stuckWindow', 10000, 40000], ['nav.stuckRadius', 60, 200],
  ['nav.refuseWindow', 10000, 60000], ['nav.jumpCooldown', 200, 800],
  ['nav.edgeMin', 80, 200], ['nav.edgeAdd', 40, 150], ['nav.edgeStep', 10, 40],
  ['nav.edgeStart', 20, 80], ['nav.margin', 150, 400], ['nav.replanMove', 40, 150],
  ['nav.replanStale', 3000, 8000], ['nav.nodeRadius', 150, 350],
  ['kit.corridor', 20, 80], ['kit.up', 80, 250], ['kit.down', 120, 350],
  ['kit.probeY', 20, 80], ['kit.probeUp', 30, 120], ['kit.healNeed', 0.2, 0.5],
  ['kit.healOpp', 0.6, 0.9], ['kit.healRadius', 800, 2000], ['kit.healOppDist', 100, 400],
  ['kit.healChase', 10000, 30000], ['kit.healSkip', 30000, 90000],
  ['kit.enemyNear', 250, 500], ['kit.enemyFar', 300, 600], ['kit.healHighDy', 50, 200],
  ['kit.ammoRadius', 800, 2000], ['kit.ammoFar', 300, 600],
  ['kit.grenadeRadius', 800, 2000], ['kit.grenadeFar', 300, 700],
  ['kit.seekOffset', 0, 120],
  ['combat.strafeMin', 1500, 4000], ['combat.strafeMax', 3000, 7000],
  ['combat.strafeSideMin', 60, 200], ['combat.strafeSideMax', 120, 300],
  ['combat.strafeTimeout', 2000, 8000], ['combat.flankSide', 120, 350],
  ['combat.movingSpeed', 80, 250], ['combat.sniperRetreatFactor', 0.5, 0.95],
  ['combat.sniperFar', 300, 800], ['combat.engageFactor', 0.8, 1.1],
  ['combat.aimK', 0.2, 0.6], ['combat.spotDelay', 80, 300],
  ['combat.nadeChance', 0.2, 0.7], ['combat.nadeMin', 150, 400],
  ['combat.nadeMaxFactor', 0.7, 1.1], ['combat.nadeDy', 80, 200],
  ['combat.nadeCooldown', 1500, 4000],
  ['move.deadbandTask', 8, 40], ['move.deadbandPatrol', 1, 10],
  // Сторож простоя и темп прыжков (k454).
  ['move.idleMax', 400, 2000], ['move.idleNudge', 60, 300], ['move.idleCooldown', 400, 3000],
  ['jump.throttle', 150, 400], ['jump.plainThrottle', 300, 1500],
  ['jump.airThrottle', 200, 1200], ['jump.airBelowSkip', 20, 200],
  ['ult.abilityCooldown', 1500, 4000], ['ult.ultCooldown', 800, 3000],
  ['ult.medicAbilityHp', 0.3, 0.7], ['ult.medicAbilityMateHp', 0.5, 0.9],
  ['ult.medicAbilityMateRadius', 200, 500], ['ult.medicAbilityMateY', 80, 250],
  ['ult.tankAbilityHp', 0.35, 0.75], ['ult.assaultAmmo', 0.1, 0.4],
  ['ult.assaultMateDist', 350, 800], ['ult.assaultMateY', 80, 250],
  ['ult.medicHp', 0.5, 0.9], ['ult.medicMateHp', 0.5, 0.9], ['ult.mateRadius', 200, 500],
  ['ult.tankHp', 0.45, 0.85], ['ult.freshWindow', 1000, 4000],
  // CTF-эскорт: держим носильщика живым на проносе.
  ['escort.lead', 150, 500], ['escort.leadCamp', 300, 800],
  ['escort.side', 30, 160], ['escort.flankY', 60, 260],
  ['escort.visFactor', 0.6, 1.2],
  ['escort.campStill', 1500, 6000], ['escort.campReset', 5000, 20000],
  ['escort.campMove', 80, 300],
  ['escort.shadowAt', 1500, 7000], ['escort.shadowFor', 2000, 8000],
  ['escort.stall', 2000, 8000],
  // CTF-пронос: выбор верхнего коридора и его удержание.
  ['carry.corrLead', 300, 1000], ['carry.corrY', 0.35, 0.75],
  ['carry.corrHold', 10000, 40000], ['carry.corrSwitch', 80, 300],
];

function getPath(obj, path) { return path.split('.').reduce((o, k) => o[k], obj); }
function setPath(obj, path, v) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = v;
}

function fitness(m) { return matchFitness(m); }

function runMatch(tactics, seed, workDir, idx) {
  return new Promise((resolve) => {
    const tacFile = join(workDir, `tac_${idx}.json`);
    const outFile = join(workDir, `out_${idx}.json`);
    writeFileSync(tacFile, JSON.stringify(tactics));
    const args = [
      '--import', './tools/headless/register.mjs', './tools/headless/run.mjs',
      '--ticks', String(TICKS), '--seed', String(seed),
      '--tactics', tacFile, '--out', outFile,
    ];
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('close', () => {
      try {
        const m = JSON.parse(readFileSync(outFile, 'utf8'));
        resolve({ fitness: fitness(m), metrics: m });
      } catch (e) {
        resolve({ fitness: -1e9, metrics: null, error: String(e) });
      }
    });
  });
}

async function evalCandidate(tactics, tag) {
  const workDir = mkdtempSync(join(tmpdir(), `evo_${tag}_`));
  const jobs = [];
  for (let s = 0; s < SEEDS; s++) jobs.push(runMatch(tactics, 1000 + s * 7, workDir, `${tag}_${s}`));
  const results = await Promise.all(jobs);
  const ok = results.filter((r) => r.metrics);
  const avg = ok.length ? ok.reduce((a, r) => a + r.fitness, 0) / ok.length : -1e9;
  try { rmSync(workDir, { recursive: true, force: true }); } catch (e) {}
  return { fitness: avg, results };
}

// --- простая (mu, lambda) эволюционная стратегия ---
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

async function main() {
  const groups = ONLY.split(',');
  const spec = SPEC.filter(([p]) => groups.includes(p.split('.')[0]));
  console.log(`[evolve] params=${spec.length} pop=${POP} mu=${MU} seeds=${SEEDS} ticks=${TICKS}`);
  console.log(`[evolve] concurrent matches=${CAND_BATCH * SEEDS} (candidates/batch=${CAND_BATCH}, cap=${WORKERS})`);

  const mean = {};
  for (const [p, mn, mx] of spec) mean[p] = getPath(TACTICS, p);
  let sigma = 0.15; // доля диапазона

  let best = { fitness: -1e9, tactics: null };

  // Оцениваем дефолт (нулевую точку).
  const defTactics = {};
  for (const [p] of spec) setPath(defTactics, p, getPath(TACTICS, p));
  const defRes = await evalCandidate(defTactics, 'def');
  console.log(`[evolve] default fitness = ${defRes.fitness.toFixed(1)}`);
  best = { fitness: defRes.fitness, tactics: JSON.parse(JSON.stringify(defTactics)) };

  for (let g = 0; g < GENERATIONS; g++) {
    const candidates = [];
    for (let i = 0; i < POP; i++) {
      const t = {};
      for (const [p, mn, mx] of spec) {
        const range = mx - mn;
        const v = mean[p] + sigma * range * randn();
        setPath(t, p, Math.max(mn, Math.min(mx, v)));
      }
      candidates.push(t);
    }
    // Параллельная оценка батчами: CAND_BATCH кандидатов × SEEDS матчей
    // не превышают потолок WORKERS одновременных процессов.
    const results = [];
    for (let i = 0; i < candidates.length; i += CAND_BATCH) {
      const batch = candidates.slice(i, i + CAND_BATCH);
      const res = await Promise.all(batch.map((t, j) => evalCandidate(t, `g${g}_${i + j}`)));
      results.push(...res);
    }
    const order = results.map((r, i) => ({ r, i })).sort((a, b) => b.r.fitness - a.r.fitness);
    const top = order.slice(0, MU);
    for (const [p, mn, mx] of spec) {
      const range = mx - mn;
      let sum = 0;
      for (const { i } of top) sum += getPath(candidates[i], p);
      mean[p] = Math.max(mn, Math.min(mx, sum / top.length));
    }
    sigma = Math.max(0.02, Math.min(0.4, sigma * (order[0].r.fitness > best.fitness ? 1.1 : 0.9)));
    const genBest = order[0];
    if (genBest.r.fitness > best.fitness) {
      best = { fitness: genBest.r.fitness, tactics: JSON.parse(JSON.stringify(candidates[genBest.i])) };
    }
    console.log(`[evolve] gen ${g + 1}/${GENERATIONS} best=${best.fitness.toFixed(1)} genBest=${genBest.r.fitness.toFixed(1)} sigma=${sigma.toFixed(3)}`);
  }

  writeFileSync(OUT, JSON.stringify({ fitness: best.fitness, tactics: best.tactics }, null, 2));
  console.log(`[evolve] wrote ${OUT}`);
  console.log('[evolve] best tactics:', JSON.stringify(best.tactics));
}

main().catch((e) => { console.error(e); process.exit(1); });
