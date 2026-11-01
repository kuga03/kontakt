// t_penwatch.mjs вЂ” РџР РћР’Р•Р РљРђ Р±СЂР°СѓР·РµСЂРЅРѕРіРѕ РІРѕС‚С‡РµСЂР° (js/debug/penWatch.js) РІ headless:
// РІРєР»СЋС‡Р°РµРј С„Р»Р°Рі С‡РµСЂРµР· localStorage, СЃС‚Р°РІРёРј С‚РµР»Рѕ РІРЅСѓС‚СЂСЊ СЏС‰РёРєР° Рё Р¶РґС‘Рј РґР°РјРї.
// Р—Р°РїСѓСЃРє: node --import ./tools/headless/register.mjs ./tools/headless/t_penwatch.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

setupDom(1337);
const clock = setupClock();
globalThis.localStorage = { getItem: (k) => (k === 'penwatch' ? '1' : null), setItem() {}, removeItem() {} };
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
  // СЏС‰РёРє (840,820) 140x60 в†’ С‚РµР»Рѕ 30x92 СЃС‚Р°РІРёРј С‚Р°Рє, С‡С‚РѕР±С‹ РѕРЅРѕ Р±С‹Р»Рѕ Р’РќРЈРўР Р РїРѕ РѕР±РµРёРј РѕСЃСЏРј
  const pr = new Player(sc, 840, 760, { name: 'WatchProbe', team: 'blue', isAI: false });
  pr.body.setAllowGravity(false);
  pr.body.setVelocity(0, 0);
  sc.players.push(pr);
  step(3);
  console.log('[t] probe body', Math.round(pr.body.x), Math.round(pr.body.y),
    Math.round(pr.body.width), Math.round(pr.body.height));
  step(10);
  clearInterval(keep);
  process.exit(0);
});

