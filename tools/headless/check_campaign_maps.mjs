// tools/headless/check_campaign_maps.mjs — проверка кампанийских карт:
// эталон «Форты» (3 фланга), симметрия, лейны на поверхностях, бюджеты
// подъёма/пролёта, флаги/точки/предметы и количество объектов.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/check_campaign_maps.mjs
import { campaignLevels } from '../../js/data/levels.js';
import { validateArena } from '../../js/data/flankGen.js';

const ITEM_TYPES = ['medkit', 'armor', 'ammo', 'frag', 'smoke'];
let fail = 0;
const check = (ok, msg) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + msg);
  if (!ok) fail++;
};

for (const lv of campaignLevels) {
  const objs = lv.objects || [];
  const items = objs.filter(o => o.spawnType && ITEM_TYPES.includes(o.spawnType));
  const spawns = objs.filter(o => ['player', 'team', 'enemy'].includes(o.spawnType));
  const flags = objs.filter(o => o.spawnType === 'flagBlue' || o.spawnType === 'flagRed');
  const tag = `#${lv.id} ${lv.mapName} ${lv.mode} ${lv.width}x${lv.height}`;
  if (lv.mode === 'CAMPAIGN') {
    // Учебка — намеренно простая, без эталонных лейнов.
    check(objs.length > 0, tag + ' — учебка собрана');
    continue;
  }
  check(!!lv._lanes, tag + ' — есть _lanes');
  check(items.length === 7, tag + ` — 7 подборов (${items.length})`);
  // FFA спавнит бойцов сам (ffaSpawns), точки team/enemy там не нужны.
  const wantSpawns = lv.mode === 'FFA' ? 1 : 9;
  check(spawns.length === wantSpawns, tag + ` — спавны (${spawns.length}/${wantSpawns})`);
  if (lv.mode === 'CTF') check(flags.length === 2, tag + ' — 2 флага');
  else check(flags.length === 0, tag + ' — без флагов');
  if (lv.mode === 'KOTH') check((lv.kothPoints || []).length === 3, tag + ' — 3 точки');
  check(objs.length >= 29 && objs.length <= 42, tag + ` — объектов как у Фортов (${objs.length})`);
  const errs = validateArena({ width: lv.width, height: lv.height, objects: objs, _lanes: lv._lanes });
  check(errs.length === 0, tag + ' — валидатор: ' + (errs.slice(0, 2).join('; ') || 'чисто'));
}

console.log(fail ? `CAMPAIGN MAPS FAILED (${fail})` : 'CAMPAIGN MAPS OK');
process.exit(fail ? 1 : 0);
