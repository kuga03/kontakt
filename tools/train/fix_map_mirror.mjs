// fix_map_mirror.mjs — две опечатки в maps/ctf.json, из-за которых карта
// «Форты» получалась НЕзеркальной: платформа у красной базы стояла на 70px
// левее своего зеркала, а четвёртый спавн красных — на 40px правее.
// Правим данные (геометрия остаётся прежней по смыслу), формат — одна строка.
import fs from 'node:fs';

const p = 'maps/ctf.json';
const before = fs.readFileSync(p, 'utf8');
const m = JSON.parse(before);
const W = m.width;

let fixed = 0;
for (const o of m.objects) {
  if (o.type === 'platform' && o.x === 3075 && o.y === 738 && o.w === 90) { o.x = W - 655; fixed++; }
  if (o.type === 'spawn' && o.x === 3300 && o.y === 680) { o.x = W - 540; fixed++; }
}

if (!fixed) { console.error('[fix] нечего править (уже зеркально?)'); process.exit(0); }

fs.writeFileSync(p, JSON.stringify(m), 'utf8');

const miss = m.objects.filter((o) => !m.objects.some((q) =>
  q.type === o.type && Math.abs(q.x - (W - o.x)) <= 2 && Math.abs(q.y - o.y) <= 2 &&
  Math.abs(q.w - o.w) <= 2 && Math.abs(q.h - o.h) <= 2));
console.log('[fix] исправлено объектов:', fixed, '| незеркальных осталось:', miss.length);
for (const o of miss) console.log('   осталось:', o.type, o.x, o.y, o.w, o.h);
