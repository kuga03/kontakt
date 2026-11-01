// check-ns.cjs — статические связи модулей (дополнение к check-arena/check-weapons).
// node --check такое НЕ ловит:
//  1. именованный импорт существует в экспортах цели (?v=xxx отрезаем, BOM учитываем);
//  2. вызовы NS.name(...) резолвятся в module.exports соответствующего модуля
//     (класс бага: Rooms.livePositions вызывался, но не был экспортирован —
//     тики умирали молча в try/catch, боты замирали).
// Запуск: node server/check-ns.cjs (код выхода 0 — чисто, 1 — есть ошибки).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const JSDIR = path.join(ROOT, 'js');
const SRVDIR = __dirname;

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules') continue; out = out.concat(walk(f)); }
    else if (/\.m?js$/.test(e.name)) out.push(f);
  }
  return out;
}
const files = [...walk(JSDIR), ...walk(SRVDIR).filter(f => !/node_modules/.test(f))];

function fileExports(src) {
  const named = new Set();
  let hasDefault = false;
  const stars = [];
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) named.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const am = t.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (am) named.add(am[2]);
      else if (/^[A-Za-z_$][\w$]*$/.test(t)) named.add(t);
    }
  }
  if (/^export\s+default\b/m.test(src)) hasDefault = true;
  for (const m of src.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) stars.push(m[1]);
  for (const m of src.matchAll(/^module\.exports\s*=\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(t)) named.add(t);
    }
  }
  return { named, hasDefault, stars };
}
function resolveImp(fromFile, spec) {
  const clean = spec.split('?')[0];
  if (!clean.startsWith('.')) return null;
  const abs = path.normalize(path.join(path.dirname(fromFile), clean));
  if (fs.existsSync(abs)) return abs;
  if (fs.existsSync(abs + '.js')) return abs + '.js';
  if (fs.existsSync(abs + '.cjs')) return abs + '.cjs';
  return null;
}
const cache = new Map();
function getExports(f, depth = 0) {
  if (cache.has(f)) return cache.get(f);
  if (depth > 5) return { named: new Set(), hasDefault: false };
  const src = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
  const e = fileExports(src);
  for (const s of e.stars) {
    const r = resolveImp(f, s);
    if (r) for (const n of getExports(r, depth + 1).named) e.named.add(n);
  }
  cache.set(f, e);
  return e;
}
// короткие алиасы неймспейсов -> файлы (проверяем только известные runtime-алиасы)
function nsTargets(fromFile) {
  const src = fs.readFileSync(fromFile, 'utf8');
  const map = new Map();
  for (const m of src.matchAll(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['"]([^'"]+)['"]\)/gm)) {
    const r = resolveImp(fromFile, m[2]);
    if (r) map.set(m[1], r);
  }
  return map;
}

let errors = 0, checked = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const src = fs.readFileSync(f, 'utf8');
  const nss = nsTargets(f);
  // 1. именованные импорты (ESM)
  for (const m of src.matchAll(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
    const target = resolveImp(f, m[2]);
    if (!target) { console.log('UNRESOLVED TARGET', rel, '::', m[2]); errors++; continue; }
    let exp;
    try { exp = getExports(target); } catch (e) { console.log('READ FAIL', target); errors++; continue; }
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const am = t.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      const imported = am ? am[1] : t;
      if (!/^[A-Za-z_$][\w$]*$/.test(imported)) continue;
      checked++;
      if (!exp.named.has(imported)) {
        console.log('MISSING EXPORT', rel, '::', imported, 'from', path.relative(ROOT, target));
        errors++;
      }
    }
  }
  // 2. NS.name(...) в коде (и ESM-namespace, и CJS-алиасы)
  // ESM: import * as NS from 'path' — резолвим путь
  const esmNs = new Map();
  for (const m of src.matchAll(/^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/gm)) {
    const r = resolveImp(f, m[2]);
    if (r) esmNs.set(m[1], r);
  }
  const allNs = new Map([...nss, ...esmNs]);
  for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    const target = allNs.get(m[1]);
    if (!target) continue;
    let exp;
    try { exp = getExports(target); } catch (e) { continue; }
    checked++;
    if (!exp.named.has(m[2])) {
      console.log('MISSING NS EXPORT', rel, '::', m[1] + '.' + m[2], 'from', path.relative(ROOT, target));
      errors++;
    }
  }
  // 3. дубли определений: методы внутри тел классов + топ-уровневые
  //    function (Map, а не {} — иначе фантомный 'constructor':
  //    {}.constructor truthy с первого взгляда). if/for/while не трогаем.
  const seenDefs = new Map();
  const dup = (kind, name) => {
    const k = kind + ':' + name;
    if (seenDefs.has(k)) {
      console.log('DUP ' + kind, rel, '::', name);
      errors++;
    } else {
      seenDefs.set(k, true);
    }
  };
  // регионы тел классов: от `class` до парной закрывающей скобки.
  // Считаем по копии без строк/комментов (с сохранением длины для оффсетов).
  let stripped = '';
  {
    let i = 0, st = 'code', q = null;
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (st === 'code') {
        if (c === '/' && n === '/') { st = 'line'; stripped += '  '; i += 2; continue; }
        if (c === '/' && n === '*') { st = 'block'; stripped += '  '; i += 2; continue; }
        if (c === "'" || c === '"' || c === '`') { st = 'str'; q = c; stripped += ' '; i++; continue; }
        stripped += c; i++; continue;
      }
      if (st === 'line') { if (c === '\n') { st = 'code'; stripped += '\n'; } else stripped += ' '; i++; continue; }
      if (st === 'block') {
        if (c === '*' && n === '/') { st = 'code'; stripped += '  '; i += 2; } else { stripped += (c === '\n' ? '\n' : ' '); i++; }
        continue;
      }
      if (c === '\\') { stripped += '  '; i += 2; continue; }
      if (c === q) { st = 'code'; stripped += ' '; i++; continue; }
      stripped += (c === '\n' ? '\n' : ' ');
      i++;
    }
  }
  const regions = [];
  for (const m of stripped.matchAll(/^[^\n]*\bclass\b[^\n]*\{/gm)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < stripped.length; i++) {
      const c = stripped[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) break; }
    }
    regions.push([m.index, i]);
  }
  const inClass = (idx) => regions.some(([a, b]) => idx >= a && idx <= b);
  for (const m of src.matchAll(/^  (?:async )?([A-Za-z_$][\w$]*)\s*\(/gm)) {
    if (inClass(m.index)) dup('METHOD', m[1]);
  }
  for (const m of src.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)) {
    dup('FUNCTION', m[1]);
  }
}
console.log('checked refs:', checked, errors ? ('ERRORS: ' + errors) : 'OK');
process.exit(errors ? 1 : 0);
