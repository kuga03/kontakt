// check-weapons.cjs — сверка справочника сервера с js/data/weapons.js.
// Запуск: node server/check-weapons.cjs (код 0 = синхронно).
'use strict';
const fs = require('fs');
const path = require('path');
const { WEAPONS, ALIASES, lookupWeapon } = require('./weapons.cjs');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'weapons.js'), 'utf8');
const names = [...src.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);
const uniq = [...new Set(names)];

let fail = 0;
function check(label, cond) {
  console.log((cond ? 'ok   ' : 'FAIL ') + label);
  if (!cond) fail++;
}

for (const n of uniq) {
  // Однострочные записи вида { name: 'X', damage: 22, ... } тоже ловим.
  check(`ствол ${n} в справочнике`, !!lookupWeapon(n));
}
// Алиасы резолвятся.
for (const [a, base] of Object.entries(ALIASES)) {
  check(`алиас ${a} -> ${base}`, !!lookupWeapon(a) && !!WEAPONS[base]);
}
// Боты резолвятся.
for (const b of ['BOT-Assault', 'BOT-Tank', 'BOT-Medic', 'BOT-Sniper']) {
  check(`бот ${b}`, !!lookupWeapon(b));
}
check('frag/smoke как взрыв', !!lookupWeapon('frag') && !!lookupWeapon('smoke'));
// Справочник не содержит лишнего (кроме алиасов): всё из него есть в клиенте.
for (const n of Object.keys(WEAPONS)) {
  check(`серверный ${n} есть у клиента`, uniq.includes(n));
}
// Цифры зеркал (п.3 ТЗ): dmg/rate/range клиента обязаны совпадать с сервером.
// Имена сверены выше — тут ловим тихий дрейф баланса (был: Сайга 32/36).
// Клиентские записи многострочные — режем файл по name: 'X'.
(function checkValues() {
  const parts = src.split(/name:\s*'/).slice(1);
  for (const p of parts) {
    const nm = p.slice(0, p.indexOf("'"));
    const s = WEAPONS[nm];
    if (!s) continue;
    const body = p.slice(0, 600);
    const num = (k) => {
      const m = body.match(new RegExp(k + ':\\s*([0-9.]+)'));
      return m ? +m[1] : null;
    };
    const pairs = [['damage', 'dmg'], ['fireRate', 'rate'], ['range', 'range']];
    for (const [ck, sk] of pairs) {
      const cv = num(ck);
      if (cv != null && s[sk] != null) {
        check(`${nm}.${ck}=${cv} (сервер ${s[sk]})`, cv === s[sk]);
      }
    }
  }
})();
if (fail) { console.log('WEAPONS CHECK FAILED'); process.exit(1); }
console.log('WEAPONS CHECK OK');
