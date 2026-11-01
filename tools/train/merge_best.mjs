// merge_best.mjs — частичный результат эволюции → в общий best.json.
//
// Эволюция с --only группы пишет только эти поля. Чтобы не потерять ранее
// найденные параметры, мержим её поверх базы:
//   node tools/train/merge_best.mjs \
//     --base tools/train/best.json --add tools/train/best_escort.json \
//     --out tools/train/best.json
//
// Фитнес берётся из --add (он измерен уже с базой в TACTICS).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const BASE = resolve(ROOT, arg('base', 'tools/train/best.json'));
const ADD = resolve(ROOT, arg('add', 'tools/train/best_escort.json'));
const OUT = resolve(ROOT, arg('out', 'tools/train/best.json'));

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error('[merge] cannot read', path, '-', e.message);
    process.exit(1);
  }
}

function merge(base, over) {
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) &&
        base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      merge(base[k], v);
    } else {
      base[k] = v;
    }
  }
  return base;
}

const base = readJson(BASE);
const add = readJson(ADD);
const tactics = merge(JSON.parse(JSON.stringify(base.tactics || {})), add.tactics || {});
const fitness = Number.isFinite(add.fitness) ? add.fitness : (base.fitness || 0);

writeFileSync(OUT, JSON.stringify({ fitness, tactics }, null, 2));
console.log('[merge] base', BASE);
console.log('[merge] add ', ADD, 'fitness', fitness);
console.log('[merge] wrote', OUT);
