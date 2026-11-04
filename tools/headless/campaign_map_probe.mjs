// tools/headless/campaign_map_probe.mjs — проверка построения кампанийских карт.
// node --import ./tools/headless/register.mjs ./tools/headless/campaign_map_probe.mjs <levelIndex>
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

const idx = Number(process.argv[2] || 0);
let t = 0;
function step(n = 1) { for (let i = 0; i < n; i++) { t += 1000 / 60; clock.now = t; game.headlessStep(t, 1000 / 60); } }
const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene]
});
const demo = process.env.DEMO !== '0';
gameState.demoMode = demo;
const keep = setInterval(() => {}, 1000);
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
game.events.on('ready', () => {
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CAMPAIGN', levelIndex: idx, selectedClass: 'Assault', playerName: 'Probe', scoreLimit: 200 });
  if (!demo) {
    const sc0 = game.scene.getScene('GameScene');
    try { sc0._storyOpen = false; sc0._introDone = true; } catch (e) {}
  }
  step(90);
  const sc = game.scene.getScene('GameScene');
  const lv = sc.campaignLevel;
  const plats = sc.platforms ? sc.platforms.getChildren().length : -1;
  const covers = sc.covers ? sc.covers.getChildren().length : -1;
  const picks = sc.pickups ? sc.pickups.getChildren().length : -1;
  const p = sc.player;
  const items = (lv.objects || []).filter(o => o.spawnType && ['medkit', 'armor', 'ammo', 'frag', 'smoke'].includes(o.spawnType));
  const spawns = (lv.objects || []).filter(o => o.spawnType === 'player' || o.spawnType === 'team' || o.spawnType === 'enemy');
  const flags = (lv.objects || []).filter(o => o.spawnType === 'flagBlue' || o.spawnType === 'flagRed');
  console.log(JSON.stringify({
    idx, id: lv.id, mode: sc.mode, name: lv.mapName, width: lv.width,
    objects: (lv.objects || []).length, plats, covers, picks,
    items: items.length, spawns: spawns.length, flags: flags.length,
    lanes: !!lv._lanes, koth: (lv.kothPoints || []).length,
    players: sc.players.length, player: { x: Math.round(p.x), y: Math.round(p.y) },
    playerStanding: !!(p.body && (p.body.blocked.down || p.body.touching.down))
  }));
  clearInterval(keep);
  process.exit(0);
});
