import { createRequire } from 'node:module';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';

setupDom(1337);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { gameState } = await import('../../js/data/gameState.js');

const modeToTest = process.argv[2] || 'BOMB';
let t = 0;
let duckCount = 0;
function step(n = 1) {
  for (let i = 0; i < n; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    const sc = game.scene.getScene('GameScene');
    if (sc && sc.players) {
      for (const p of sc.players) {
        if (p.ai && (p.ai._coverDucking || p.crouching)) duckCount++;
      }
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene]
});

gameState.demoMode = true;
const keep = setInterval(() => {}, 1000);
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);

game.events.on('ready', () => {
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: modeToTest, selectedClass: 'Assault', playerName: 'ProbePlayer', scoreLimit: 10 });
  const sc = game.scene.getScene('GameScene');
  gameState.demoMode = false;
  step(30);

  const covs = sc.covers ? sc.covers.getChildren() : [];
  console.log(`[COVERS COUNT] ${covs.length}`);
  for (let i = 0; i < Math.min(10, covs.length); i++) {
    const cb = covs[i].body;
    console.log(`  Cover #${i}: x=${Math.round(cb.x)}, y=${Math.round(cb.y)}, w=${Math.round(cb.width)}, h=${Math.round(cb.height)}, bottom=${Math.round(cb.bottom)}`);
  }
  const start = new Map();
  for (const p of sc.players) start.set(p, { x: p.x, y: p.y });

  console.log(`[TEST] Starting ${modeToTest} simulation for 10 seconds...`);
  step(600);

  const rows = [];
  for (const p of sc.players) {
    if (!p || p === sc.player) continue;
    const s = start.get(p) || { x: p.x, y: p.y };
    rows.push({
      n: p.playerName, team: p.team, dead: !!p.dead,
      x: Math.round(p.x), y: Math.round(p.y),
      hp: Math.round(p.hp),
      moved: Math.round(Math.hypot(p.x - s.x, p.y - s.y))
    });
  }

  const moved = rows.filter(r => r.moved > 40).length;
  console.log(`[TEST] ${modeToTest} finished: bots=${rows.length}, moved>40=${moved}, coverDucksObserved=${duckCount}`);
  console.log(JSON.stringify(rows));

  if (modeToTest === 'BOMB') {
    console.log(`[BOMB STATUS] blueBomb carrier=${sc.blueBomb?.carrier?.playerName || 'none'}, redBomb carrier=${sc.redBomb?.carrier?.playerName || 'none'}`);
  } else if (modeToTest === 'KOTH') {
    const pointsInfo = (sc.kothPoints || []).map(pt => ({ name: pt.name, holder: pt.holder, prog: Math.round(pt.prog) }));
    console.log(`[KOTH STATUS] points:`, JSON.stringify(pointsInfo));
  }

  clearInterval(keep);
  process.exit(0);
});
