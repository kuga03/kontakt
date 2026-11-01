// export_brain.mjs — best.json (тренер) → js/data/botBrain.js (слой для игры).
//
// Запуск:
//   node tools/train/export_brain.mjs [--in tools/train/best.json] [--out js/data/botBrain.js]
//
// Числа округляются до 2 знаков: в игре такая точность достаточна и файл
// остаётся читаемым. Дефолты в js/ai/tactics.js не трогаются — бот получает
// дефолт + этот слой (deep-merge).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const IN = resolve(ROOT, arg('in', 'tools/train/best.json'));
const OUT = resolve(ROOT, arg('out', 'js/data/botBrain.js'));

// ОКРУГЛЕНИЕ УБРАНО (было: 2 знака). Симуляция хаотична: округление
// escort.lead с 272.5364 до 272.54 меняло исходы матчей. Замер
// full-precision vs 2dp на 4 тренировочных сидах: фитнес 1435.0 -> 1139.7,
// захваты 8 -> 5 (лучше 0 из 4). То есть экспорт «ломал» найденный слой.
// Слой пишется в полной точности double: числа обязаны быть ровно те, с
// которыми тренер измерял фитнес. Читаемость файла — вторична.
function round(v) {
  return v;
}

function serialize(obj, indent) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${pad}${k}: {`);
      lines.push(serialize(v, indent + 2));
      lines.push(`${pad}},`);
    } else {
      lines.push(`${pad}${k}: ${JSON.stringify(round(v))},`);
    }
  }
  return lines.join('\n');
}

let data;
try {
  data = JSON.parse(readFileSync(IN, 'utf8'));
} catch (e) {
  console.error('[export] cannot read', IN, '-', e.message);
  process.exit(1);
}

const fitness = typeof data.fitness === 'number' ? data.fitness : 0;
const tactics = data.tactics && typeof data.tactics === 'object' ? data.tactics : data;
const body = serialize(tactics, 2);

const header = `// botBrain.js — экспортированные эволюцией параметры ботов (${IN.replace(/\\/g, '/')}).
// Сгенерировано ${new Date().toISOString().slice(0, 10)} тренером tools/train/evolve.mjs
// (фитнес ${Math.round(fitness * 10) / 10}). Пересобрать: node tools/train/export_brain.mjs
// tactics.js переопределяет дефолты этим объектом: дефолты в tactics.js не
// тронуты, поведение без тренера = дефолт + этот слой.
export const BOT_BRAIN = {
${body}
};
`;

writeFileSync(OUT, header, 'utf8');
console.log('[export] wrote', OUT, 'fitness', Math.round(fitness * 10) / 10);
