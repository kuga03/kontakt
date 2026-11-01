import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('C:/Users/Admin/Desktop/project/js/data/flankGen.js', 'utf8');
writeFileSync('C:/Users/Admin/AppData/Local/Temp/opencode/flankGen_test.mjs', src);
const { genFlankArena, validateArena } = await import('file:///C:/Users/Admin/AppData/Local/Temp/opencode/flankGen_test.mjs');
const widths = [2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400];
const res = { 0: { ok: 0, bad: 0, errs: {} }, 1: { ok: 0, bad: 0, errs: {} }, 2: { ok: 0, bad: 0, errs: {} } };
for (const W of widths) {
  for (let seed = 1; seed <= 600; seed++) {
    const g = genFlankArena({ seed, mode: 'TDM', width: W, height: 900, theme: 'ulica' });
    const variant = (seed >>> 5) % 3 === 2 && W < 2800 ? 0 : (seed >>> 5) % 3;
    const errs = validateArena(g);
    if (errs.length) {
      res[variant].bad++;
      for (const e of errs) { const k = e.replace(/[\d.\-]+/g, '#'); res[variant].errs[k] = (res[variant].errs[k] || 0) + 1; }
      if (res[variant].bad <= 2) console.log('FAIL W', W, 'seed', seed, 'variant', variant, errs.slice(0, 3));
    } else res[variant].ok++;
  }
}
console.log(JSON.stringify(res, null, 1));
