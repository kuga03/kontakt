// dbg_jump.mjs — точечная отладка одного прыжка: печатает траекторию.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/dbg_jump.mjs 610 730 120
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

const sx = parseFloat(process.argv[2] || '610');
const top = parseFloat(process.argv[3] || '730');
const vx = parseFloat(process.argv[4] || '120');

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
  const p = new Player(sc, sx, top - 82, { name: 'D', team: 'blue', isAI: false });
  try { sc.physics.add.collider(p, sc.platforms); } catch (e) {}
  try { sc.physics.add.collider(p, sc.covers); } catch (e) {}
  p.body.setVelocity(0, 0);
  for (let k = 0; k < 50; k++) { step(1); if (p.body.blocked.down || p.body.touching.down) break; }
  console.log('[dbg] старт x=' + Math.round(p.x) + ' feet=' + Math.round(p.body.y + p.body.height));
  p.body.setVelocity(vx, -470);
  let used2 = false;
  for (let k = 0; k < 200; k++) {
    step(1);
    const b = p.body;
    if (!used2 && b.velocity.y >= 0) { used2 = true; b.setVelocity(vx, -420); }
    if (k % 5 === 0 || b.blocked.down || b.touching.down) {
      console.log('[dbg] k=' + k + ' x=' + Math.round(p.x) + ' feet=' + Math.round(b.y + b.height) +
        ' vy=' + Math.round(b.velocity.y) + ' vx=' + Math.round(b.velocity.x) +
        ' bd=' + ((b.blocked.down ? 'D' : '') + (b.blocked.up ? 'U' : '') + (b.blocked.left ? 'L' : '') + (b.blocked.right ? 'R' : '') || '-'));
    }
    if (b.blocked.down || b.touching.down) break;
  }
  clearInterval(keep);
  process.exit(0);
});
