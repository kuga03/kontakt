// tools/headless/campaign_bots_probe.mjs — короткий прогон ботов на кампанийской карте.
// node --import ./tools/headless/register.mjs ./tools/headless/campaign_bots_probe.mjs <levelIndex> [seconds]
import { createRequire } from 'node:module';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';

setupDom(1337);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { gameState } = await import('../../js/data/gameState.js?v=171');

const idx = Number(process.argv[2] || 0);
const secs = Number(process.argv[3] || 15);
let t = 0;
function step(n = 1) { for (let i = 0; i < n; i++) { t += 1000 / 60; clock.now = t; game.headlessStep(t, 1000 / 60); } }
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
  game.scene.start('GameScene', { mode: 'CAMPAIGN', levelIndex: idx, selectedClass: 'Assault', playerName: 'Probe', scoreLimit: 200 });
  const sc = game.scene.getScene('GameScene');
  // demoMode на старте отключает сюжетное интро; сразу выключаем, иначе
  // victory.js в demo-режиме завершает миссию «поражением» через 1с.
  gameState.demoMode = false;
  try { sc._storyOpen = false; sc._introDone = true; } catch (e) {}
  step(30);
  const lv = sc.campaignLevel;
  const start = new Map();
  for (const p of sc.players) start.set(p, { x: p.x, y: p.y });
  step(Math.round(secs * 60));
  const rows = [];
  for (const p of sc.players) {
    if (!p || p === sc.player) continue;
    const s = start.get(p) || { x: p.x, y: p.y };
    rows.push({
      n: p.playerName, team: p.team, dead: !!p.dead,
      x: Math.round(p.x), y: Math.round(p.y),
      moved: Math.round(Math.hypot(p.x - s.x, p.y - s.y)),
      route: p.ai && p.ai._ctfRoute || '-', lane: p.ai && p.ai._laneIdx
    });
  }
  const moved = rows.filter(r => r.moved > 60).length;
  console.log('[MAP]', lv.id, lv.mapName, 'mode', sc.mode, 'W', lv.width, 'lanes', !!lv._lanes, 'bots', rows.length, 'moved>60', moved);
  console.log(JSON.stringify(rows.slice(0, 12)));
  clearInterval(keep);
  process.exit(0);
});
