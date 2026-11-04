// probe_ledge.mjs вЂ” Р§РРЎРўРђРЇ Р¤РР—РРљРђ: РјРѕР¶РЅРѕ Р»Рё СЃ Р·РµРјР»Рё (РІРµСЂС… 850) Р·Р°РїСЂС‹РіРЅСѓС‚СЊ
// РЅР° ledge 770 (0..160) Сѓ СЃРёРЅРµР№ Р±Р°Р·С‹, РєР°Рє СЌС‚Рѕ СЃРґРµР»Р°Р» Р±С‹ РёРіСЂРѕРє (РїСЂС‹Р¶РѕРє +
// РґРІРѕР№РЅРѕР№ РІ РІРѕР·РґСѓС…Рµ). Р•СЃР»Рё РґР° вЂ” РІРёРЅРѕРІР°С‚ bake (РЅРµ РЅР°С…РѕРґРёС‚ СЂРµР±СЂРѕ). Р•СЃР»Рё РЅРµС‚ вЂ”
// РЅР° РєР°СЂС‚Рµ РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ РЅРµС‚ РїРѕРґСЉС‘РјР°.
// Р—Р°РїСѓСЃРє: node --import ./tools/headless/register.mjs ./tools/headless/probe_ledge.mjs
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

  const starts = [700, 720, 760, 800, 860, 900, 950];
  const vxs = [-240, -180, -120, -60, 0, 60, 120];
  const rows = [];
  for (const sx of starts) {
    for (const vx of vxs) {
      const p = new Player(sc, sx, 700, { name: 'L', team: 'blue', isAI: false });
      try { sc.physics.add.collider(p, sc.platforms); } catch (e) {}
      try { sc.physics.add.collider(p, sc.covers); } catch (e) {}
      p.body.setVelocity(0, 0);
      for (let k = 0; k < 90; k++) { step(1); const b = p.body; if (b.blocked.down || b.touching.down) break; }
      const feet0 = Math.round(p.body.y + p.body.height);
      p.body.setVelocity(vx, -470);
      let used2 = false, landed = null;
      for (let k = 0; k < 200; k++) {
        step(1);
        const b = p.body;
        if (!used2 && b.velocity.y >= 0) { used2 = true; b.setVelocity(vx, -420); }   // РґРІРѕР№РЅРѕР№, РєР°Рє forceJump
        if (b.blocked.down || b.touching.down) { landed = { feet: Math.round(b.y + b.height), x: Math.round(p.x), k }; break; }
      }
      rows.push({ startX: sx, vx, feet0, landed });
      p.destroy();
    }
  }
  const ok = rows.filter(r => r.landed && r.landed.feet === 770);
  console.log('[pl] РїРѕРїС‹С‚РѕРє', rows.length, '| СЃРµР»Рё РЅР° ledge 770:', ok.length);
  for (const r of rows) console.log('[pl]  ' + JSON.stringify(r));
  clearInterval(keep);
  process.exit(0);
});

