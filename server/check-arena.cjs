// check-arena.cjs — сверка арены клиента и сервера.
// Запуск: node server/check-arena.cjs (код 0 = синхронно).
'use strict';
const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, '..', 'js', 'net', 'arena.js');
const srv = require('./netArena.cjs');

const src = fs.readFileSync(clientPath, 'utf8');
function numAfter(re) {
  const m = src.match(re);
  return m ? Number(m[1]) : null;
}
let fail = 0;
function check(label, cond) {
  console.log((cond ? 'ok   ' : 'FAIL ') + label);
  if (!cond) fail++;
}

check('NET_BUILD совпадает', src.includes('NET_BUILD = ' + srv.NET_BUILD));
check('ширина 2400', srv.NET_ARENA.width === 2400);
check('высота 900', srv.NET_ARENA.height === 900);
check('платформ 5', srv.NET_ARENA.platforms.length === 5);
check('спауны 4+4', srv.NET_ARENA.spawnsBlue.length === 4 && srv.NET_ARENA.spawnsRed.length === 4);
check('точки 3', srv.NET_ARENA.points.length === 3);
check('солидов 6 (земля+5)', srv.NET_SOLIDS.length === 6);
// Клиентские платформы должны быть в серверных солидах (кроме земли).
for (const p of srv.NET_ARENA.platforms) {
  const hit = srv.NET_SOLIDS.some(s => s.x === p.x && s.y === p.y && s.w === p.w && s.h === p.h);
  check(`платформа ${p.x},${p.y} в солидах`, hit);
}
// Точки/базы/спавны клиента — текстом в файле (грубая сверка без ESM-импорта).
for (const pt of srv.NET_ARENA.points) {
  check(`точка ${pt.name} в arena.js`, src.includes(`x: ${pt.x}, y: ${pt.y}`) || src.includes(`x:${pt.x}`));
}
if (fail) { console.log('ARENA CHECK FAILED'); process.exit(1); }
console.log('ARENA CHECK OK');
