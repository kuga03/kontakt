// tools/headless/campaign_nav_diag.mjs — дамп состояния навигации ботов в момент прыжка/срыва.
// node --import ./tools/headless/register.mjs ./tools/headless/campaign_nav_diag.mjs <levelIndex> [seconds]
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
const secs = Number(process.argv[3] || 20);
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
  gameState.demoMode = false;
  try { sc._storyOpen = false; sc._introDone = true; } catch (e) {}
  step(30);
  const lv = sc.campaignLevel;
  const start = new Map();
  for (const p of sc.players) start.set(p, { x: p.x, y: p.y });
  step(Math.round(secs * 60));
  const dump = () => {
    const rows = [];
    for (const p of sc.players) {
      if (!p || p === sc.player) continue;
      const nav = p.ai && p.ai._nav;
      const e = nav && nav.path ? nav.path[nav.i] : null;
      rows.push({
        n: p.playerName, team: p.team, dead: !!p.dead,
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.body.velocity.x * 10) / 10, vy: Math.round(p.body.velocity.y * 10) / 10,
        grounded: !!(p.body.blocked.down || p.body.touching.down),
        edge: e ? { type: e.type, dbl: !!e.dbl, vert: !!e.vert, from: [Math.round(e.from.x), Math.round(e.from.y)], to: [Math.round(e.to.x), Math.round(e.to.y)], vx: Math.round(e.vx * 10) / 10 } : null,
        phase: nav ? nav.phase : -1,
        wantDbl: nav ? !!nav.wantDbl : false,
        used: nav ? !!nav.used : false,
        retried: nav ? !!nav._retried : false,
        altVx: nav ? nav.altVx : null,
        fails: p.ai ? (p.ai._navFails || 0) : -1,
        reason: p.ai ? (p.ai._navReason || null) : null,
        hops: p.ai ? (p.ai._hopSkipClamp ? Math.round((p.ai._hopSkipClamp - t) / 1000 * 10) / 10 : null) : null,
      });
    }
    console.log('[DIAG]', JSON.stringify({ t: Math.round(t), mode: sc.mode, level: sc.levelIndex, bots: rows }));
  };
  let fr = 0;
  const fig = setInterval(() => { fr += 1; if (fr % 20 === 0) dump(); if (fr > secs * 60) { clearInterval(fig); clearInterval(keep); process.exit(0); } }, 16);
  return;
});
