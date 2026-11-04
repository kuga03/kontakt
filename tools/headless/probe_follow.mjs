// probe_follow.mjs вЂ” РїСЂРѕРІРµСЂРєР° РњРђР РЁР РЈРўРђ С†РµР»РёРєРѕРј: С‚РµР»Рѕ РёРґС‘С‚ РїРѕ С‚РѕС‡РєР°Рј
// С‡РµСЂРµР· routeAction (С‚РѕС‚ Р¶Рµ РєРѕРґ, С‡С‚Рѕ Р±СѓРґРµС‚ Сѓ Р±РѕС‚Р°) РѕС‚ Р±Р°Р·С‹ РґРѕ С„Р»Р°РіР°.
// РР Р±РѕС‚РѕРІ РЅР° СЃС†РµРЅРµ РѕС‚РєР»СЋС‡Р°РµС‚СЃСЏ вЂ” РїСЂРѕРіРѕРЅ Р±С‹СЃС‚СЂС‹Р№ Рё Р±РµР· Р±РѕСЏ.
// Р—Р°РїСѓСЃРє: node --import ./tools/headless/register.mjs ./tools/headless/probe_follow.mjs
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
const { routeAction } = await import('../../js/ai/routes.js');

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

function walkRoute(sc, team, maxTicks) {
  const startX = team === 'blue' ? 430 : 3800 - 430;
  const p = new Player(sc, startX, 730 - 82, { name: 'F' + team, team, isAI: false });
  try { sc.physics.add.collider(p, sc.platforms); } catch (e) {}
  try { sc.physics.add.collider(p, sc.covers); } catch (e) {}
  p.body.setVelocity(0, 0);
  for (let k = 0; k < 60; k++) { step(1); if (p.body.blocked.down || p.body.touching.down) break; }

  const ai = {};
  const targetX = team === 'blue' ? 3630 : 170;
  let stuck = 0, lastX = p.x, done = false, jumps = 0, k = 0;
  const trace = [];
  for (k = 0; k < maxTicks; k++) {
    const act = routeAction(p, ai, t, 'ctfAttack');
    if (!act) break;
    if (act.done) { done = true; break; }
    if (act.jump) { p.body.setVelocity(act.vx, act.double ? -420 : -470); if (!act.double) jumps++; }
    if (ai._dbgWp !== act.wp) { ai._dbgWp = act.wp; console.log('[rf]   wp' + act.wp + ' x=' + Math.round(p.x) + ' feet=' + Math.round(p.body.y + p.body.height)); }
    if (k % 60 === 0) trace.push(Math.round(p.x) + '@' + Math.round(p.body.y + p.body.height));
    if (!act.jump) p.move(act.dir);
    step(1);
    if (Math.abs(p.x - lastX) < 1.2) stuck++; else stuck = 0;
    lastX = p.x;
    if (stuck > 300) break;
  }
  const res = {
    team, done, x: Math.round(p.x), feet: Math.round(p.body.y + p.body.height),
    dist: Math.round(Math.abs(p.x - targetX)), jumps, ticks: k,
    stuck: stuck > 300, trace: trace.slice(-8).join(' '),
  };
  p.destroy();
  return res;
}

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

  for (const team of ['blue', 'red']) {
    const r = walkRoute(sc, team, 2400);
    console.log('[rf] ' + r.team + ': ' + (r.done ? 'РњРђР РЁР РЈРў РџР РћР™Р”Р•Рќ' : (r.stuck ? 'Р—РђРЎРўР РЇР›' : 'РќР• Р”РћРЁРЃР›')) +
      ' x=' + r.x + ' feet=' + r.feet + ' РґРѕ С†РµР»Рё ' + r.dist + 'px, РїСЂС‹Р¶РєРѕРІ ' + r.jumps +
      ', С‚РёРєРѕРІ ' + r.ticks + ' | С…РІРѕСЃС‚: ' + r.trace);
  }
  clearInterval(keep);
  process.exit(0);
});



