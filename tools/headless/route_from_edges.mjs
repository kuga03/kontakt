// route_from_edges.mjs вЂ” РїРѕ С‚Р°Р±Р»РёС†Рµ РїСЂРѕРІРµСЂРµРЅРЅС‹С… СЂС‘Р±РµСЂ (tmp/edges.txt) РёС‰РµС‚
// РїСѓС‚СЊ РѕС‚ СЃРёРЅРµР№ Р±Р°Р·С‹ (730@120..700) РґРѕ РєСЂР°СЃРЅРѕРіРѕ С„Р»Р°РіР° (730@3100..3680)
// Рё РїРµС‡Р°С‚Р°РµС‚ РµРіРѕ РєР°Рє РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚СЊ РїРµСЂРµС…РѕРґРѕРІ СЃ С‚РѕС‡РєР°РјРё СЃС‚Р°СЂС‚Р° Рё vx.
// Р—Р°РїСѓСЃРє: node tools/headless/route_from_edges.mjs
import { readFileSync } from 'node:fs';

const txt = readFileSync('tmp/rm.log', 'utf8').split(/\r?\n/).filter(l => /^\[rm\] \d+@/.test(l));
const edges = [];
for (const line of txt) {
  // [rm] 296@820..1180  ->  360@1330..1470   СЃС‚Р°СЂС‚ x=1165 vx=120 (О”y=64, СЃРµР» x=1359)
  const m = line.match(/\[rm\] (\d+)@(\d+)\.\.(\d+)\s+->\s+(\d+)@(\d+)\.\.(\d+)\s+СЃС‚Р°СЂС‚ x=(-?\d+) vx=(-?\d+) \(О”y=(-?\d+), СЃРµР» x=(-?\d+)\)/);
  if (!m) continue;
  edges.push({
    from: { T: +m[1], L: +m[2], R: +m[3] },
    to: { T: +m[4], L: +m[5], R: +m[6] },
    sx: +m[7], vx: +m[8], land: +m[9],
  });
}
console.log('[edge] СЂР°Р·РѕР±СЂР°РЅРѕ СЂС‘Р±РµСЂ:', edges.length);

const key = (s) => s.T + '@' + s.L + '..' + s.R;
const nodes = new Map();
for (const e of edges) {
  nodes.set(key(e.from), e.from);
  nodes.set(key(e.to), e.to);
}
const adj = new Map();
for (const e of edges) {
  const a = key(e.from), b = key(e.to);
  if (!adj.has(a)) adj.set(a, []);
  adj.get(a).push({ to: b, edge: e });
}

function bfs(startKey, goalFn) {
  const prev = new Map(); const q = [startKey]; const seen = new Set([startKey]);
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    if (goalFn(cur)) {
      const path = []; let c = cur;
      while (c != null) { path.push(c); const p = prev.get(c); c = p ? p.from : null; if (p) { path[path.length - 1] = { key: path[path.length - 1], edge: p.edge }; } }
      return path.reverse();
    }
    for (const nb of (adj.get(cur) || [])) {
      if (!seen.has(nb.to)) { seen.add(nb.to); prev.set(nb.to, { from: cur, edge: nb.edge }); q.push(nb.to); }
    }
  }
  return null;
}

const start = '730@120..700';
const goal = (k) => k.startsWith('730@3100') || k.startsWith('730@3140');
const path = bfs(start, goal);
if (!path) { console.log('[edge] РїСѓС‚Рё РѕС‚ Р±Р°Р·С‹ РґРѕ Р±Р°Р·С‹ РќР•Рў'); }
else {
  console.log('[edge] РїСѓС‚СЊ (' + path.length + ' С€Р°РіРѕРІ):');
  for (const step of path) {
    if (typeof step === 'string') { console.log('[edge]   СЃС‚Р°СЂС‚ ' + step); continue; }
    const e = step.edge;
    console.log('[edge]   ' + step.key + '  --(vx ' + e.vx + ' СЃРѕ x=' + e.sx + ', СЃРµР» ' + e.land + ')-->');
  }
}

