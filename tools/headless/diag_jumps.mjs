// diag_jumps.mjs — ЧИСТАЯ ДИАГНОСТИКА «прыгают на месте»: считает прыжки,
// при которых тело почти не сместилось по X за полёт (бесполезные хопы),
// и прыжки с набором высоты без смещения (долбёжка в потолок).
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_jumps.mjs [--seed 1337]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

const SEED = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--seed') || '1337', 10);
const TICKS = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--ticks') || '18000', 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');

const S = { total: 0, inPlace: 0, bySrc: {}, inPlaceBySrc: {} };
const air = new Map();   // name -> {x0, y0, t, src}
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
    const prevGround = new Map();
    for (const p of sc.players) if (p && p.isAI && !p.dead) prevGround.set(p, !!(p.body && (p.body.blocked.down || p.body.touching.down)));
    game.headlessStep(t, 1000 / 60);
    if (sc.gameOver) break;
    for (const p of sc.players) {
      if (!p || !p.isAI || p.dead || !p.body) continue;
      const grounded = !!(p.body.blocked.down || p.body.touching.down);
      const wasG = prevGround.get(p);
      const st = air.get(p.playerName);
      if (wasG === true && grounded === false) {
        air.set(p.playerName, { x0: p.x, y0: p.body.y + p.body.height, t, src: (p.ai && p.ai._dbgSrc) || '?' });
      } else if (wasG === false && grounded === true && st) {
        const dx = Math.abs(p.x - st.x0);
        const up = st.y0 - (p.body.y + p.body.height);
        S.total++;
        S.bySrc[st.src] = (S.bySrc[st.src] || 0) + 1;
        if (dx < 30) {
          S.inPlace++;
          S.inPlaceBySrc[st.src] = (S.inPlaceBySrc[st.src] || 0) + 1;
        }
        air.delete(p.playerName);
      }
    }
  }
  console.log('[jp] seed', SEED, 'прыжков всего:', S.total, '| почти без смещения (<30px):', S.inPlace,
    '(' + (S.total ? Math.round(100 * S.inPlace / S.total) : 0) + '%)');
  console.log('[jp] по режимам:', JSON.stringify(S.bySrc));
  console.log('[jp] на месте по режимам:', JSON.stringify(S.inPlaceBySrc));
  clearInterval(keep);
  process.exit(0);
}
