// probe_plinth.mjs — ЧИСТАЯ ДИАГНОСТИКА: может ли ТЕЛО физически залезть
// с земли на плиту базы (где лежит флаг), и видит ли этот переход навграф.
// Мотивация: человек за 20–30с берёт флаг и доносит; бот стоит под плитой.
// Если физика может, а граф — нет, виноват bake (модель мира), а не карта.
//
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/probe_plinth.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js';

setupDom(1337);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { default: Player } = await import('../../js/entities/Player.js');

let t = 0;
function step(n = 1) { for (let i = 0; i < n; i++) { t += 1000 / 60; clock.now = t; game.headlessStep(t, 1000 / 60); } }

const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene],
});
gameState.demoMode = true;
const keep = setInterval(() => {}, 1000);
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);

game.events.on('ready', () => {
  try {
    const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
  } catch (e) {}
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });
  step(20);
  const sc = game.scene.getScene('GameScene');
  for (const q of sc.players) { try { q.ai = null; } catch (e) {} }

  // Плиты баз по карте (x — ЦЕНТР, y — ЦЕНТР): синяя 0..160 верх 770,
  // красная 3640..3800 верх 770; флаги на 170/3630, y=704.
  const cases = [
    { name: 'blue: разбег vx-120', sx: 200, vx: -120, apex: 0, wantTop: 770, wantL: 0, wantR: 170 },
    { name: 'blue: разбег vx-160', sx: 230, vx: -160, apex: 0, wantTop: 770, wantL: 0, wantR: 170 },
    { name: 'blue: прыжок ВВЕРХ, vx на апексе', sx: 200, vx: 0, apex: -200, wantTop: 770, wantL: 0, wantR: 170 },
    { name: 'blue: вверх + дабл, vx на апексе', sx: 210, vx: 0, apex: -160, wantTop: 770, wantL: 0, wantR: 170 },
    { name: 'red: прыжок ВВЕРХ, vx на апексе', sx: 3600, vx: 0, apex: 200, wantTop: 770, wantL: 3630, wantR: 3800 },
  ];

  console.log('[plinth] === ФИЗИКА: прыжок с земли (850) на плиту (770) ===');
  for (const c of cases) {
    // Чистое тело без управления игрока (Player-контроль гасит vx каждый кадр
    // и портит траекторию — поэтому раньше все прыжки «не получались»).
    let rect = null;
    try { rect = sc.add.rectangle(c.sx, 850 - 28, 30, 56, 0xff0000); sc.physics.add.existing(rect); } catch (e) { rect = null; }
    if (!rect) { console.log('[plinth] нет тела'); break; }
    try { sc.physics.add.collider(rect, sc.platforms); } catch (e) {}
    try { sc.physics.add.collider(rect, sc.covers); } catch (e) {}
    const rb = rect.body;
    rb.setVelocity(0, 0);
    for (let k = 0; k < 50; k++) { step(1); if (rb.blocked.down || rb.touching.down) break; }
    const feet0 = Math.round(rb.y + rb.height);
    rb.setVelocity(c.vx, -470);
    let used2 = false, land = null, apexHit = false;
    for (let k = 0; k < 220; k++) {
      step(1);
      if (!used2 && rb.velocity.y >= 0) {
        used2 = true;
        if (c.apex) { rb.setVelocity(c.apex, -420); apexHit = true; }
        else rb.setVelocity(c.vx, -420);
      }
      if (rb.blocked.down || rb.touching.down) { land = { feet: Math.round(rb.y + rb.height), x: Math.round(rect.x) }; break; }
    }
    try { rect.destroy(); } catch (e) {}
    const ok = land && Math.abs(land.feet - c.wantTop) <= 2 && land.x >= c.wantL - 8 && land.x <= c.wantR + 8;
    console.log(`[plinth] ${ok ? 'ДА ' : 'НЕТ'} ${c.name}: старт x=${c.sx} (ноги ${feet0}) vx0=${c.vx} apexVx=${c.apex}` +
      (apexHit ? ' [дабл]' : ' [одиночный]') + ' → ' + (land ? `сел x=${land.x} ноги=${land.feet}` : 'не приземлился'));
  }

  // Навграф: есть ли узлы на плитах и связаны ли они с землёй.
  const g = sc._navGraph || (typeof sc._buildNavGraph === 'function' ? sc._buildNavGraph() : null);
  if (!g || !g.nodes || !g.nodes.length) { console.log('[plinth] графа нет'); process.exit(0); }
  const n = g.nodes.length;
  const comp = new Int32Array(n).fill(-1);
  let nc = 0;
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue;
    const id = nc++;
    const q = [i]; comp[i] = id;
    for (let h = 0; h < q.length; h++) for (const nb of (g.links[q[h]] || [])) if (comp[nb] < 0) { comp[nb] = id; q.push(nb); }
  }
  const near = (px, py, r) => g.nodes.map((nd, i) => ({ i, nd, d: Math.hypot(nd.x - px, nd.y - py) }))
    .filter(o => o.d <= r).sort((a, b) => a.d - b.d);
  for (const [nm, px, py] of [['плита синяя', 80, 770], ['плита красная', 3720, 770], ['земля у синей', 200, 850], ['земля у красной', 3600, 850]]) {
    const list = near(px, py, 120).slice(0, 4);
    console.log(`[plinth] граф ${nm} (${px},${py}): ` + (list.length
      ? list.map(o => `${o.i}:(${Math.round(o.nd.x)},${Math.round(o.nd.y)})c${comp[o.i]}`).join(' ')
      : 'НЕТ УЗЛОВ'));
  }
  const groundNodes = near(200, 850, 60).map(o => o.i);
  const plinthNodes = g.nodes.map((nd, i) => ({ nd, i })).filter(o => o.nd.y > 740 && o.nd.y < 790 && o.nd.x < 180).map(o => o.i);
  console.log('[plinth] узлы земли у синей:', groundNodes.join(',') || '-', '| узлы синей плиты:', plinthNodes.join(',') || '-');
  let edge = false;
  for (const a of groundNodes) for (const nb of (g.links[a] || [])) if (plinthNodes.includes(nb)) edge = true;
  for (const a of plinthNodes) for (const nb of (g.links[a] || [])) if (groundNodes.includes(nb)) edge = true;
  console.log(`[plinth] РЕБРО земля↔плита в навграфе: ${edge ? 'ЕСТЬ' : 'НЕТ'}`);
  process.exit(0);
});

setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
