// diag_start.mjs — ЧИСТАЯ ДИАГНОСТИКА старта матча: почему синие дёргаются
// на базе. Первые 15 секунд, каждые 10 тиков — позиция, решение, вето, цель.
// Считаем флипы направления и прыжки на месте.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_start.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js';

const SEED = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--seed') || '1337', 10);
const TICKS = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--ticks') || '900', 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');

const stat = new Map();   // name -> {flips, jumps, rows, prevDir, prevY, samples}
let t = 0;
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
  setImmediate(loop);
});

function loop() {
  const sc = game.scene.getScene('GameScene');
  if (!sc || !sc.players || !sc.players.length) { setImmediate(loop); return; }
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    if (sc.gameOver) break;
    if (i % 10 !== 0) continue;
    for (const p of sc.players) {
      if (!p || !p.isAI || p.team !== 'blue' || p.dead) continue;
      const a = p.ai || {};
      const st = stat.get(p.playerName) || { flips: 0, jumps: 0, prevDir: 0, prevFeet: 0, rows: [] };
      const dir = a._dbgDir ?? 0;
      if (st.prevDir !== 0 && dir !== 0 && dir !== st.prevDir) st.flips++;
      st.prevDir = dir;
      const feet = Math.round(p.body.y + p.body.height);
      if (st.prevFeet && feet < st.prevFeet - 20) st.jumps++;
      st.prevFeet = feet;
      if (st.rows.length < 26 && i % 30 === 0) {
        st.rows.push(Math.round(t / 100) / 10 + 's x' + Math.round(p.x) + ' d' + (dir > 0 ? '+' : dir < 0 ? '-' : '0') +
          ' ' + (a._dbgSrc || '?') + ' veto=' + (a._dbgVeto || '-') +
          ' g' + Math.round(a._dbgGoalX ?? -1) + ' hold=' + (t < (a._holdMoveUntil || 0) ? 1 : 0));
      }
      stat.set(p.playerName, st);
    }
  }
  console.log('[st] синие боты, первые ' + Math.round(TICKS / 60) + 'с:');
  for (const [name, s] of stat) {
    console.log('[st] ' + name + ': флипов ' + s.flips + ', подъёмов ' + s.jumps);
    for (const r of s.rows) console.log('[st]    ' + r);
  }
  clearInterval(keep);
  process.exit(0);
}
