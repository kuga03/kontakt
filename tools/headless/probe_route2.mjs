// probe_route2.mjs вЂ” Р§РРЎРўРђРЇ Р¤РР—РРљРђ: РїРѕРґР±РѕСЂ С‚РѕС‡РЅС‹С… РїРµСЂРµС…РѕРґРѕРІ РґР»СЏ РјР°СЂС€СЂСѓС‚РѕРІ.
// РљР°Р¶РґС‹Р№ РєРµР№СЃ: СЃС‚Р°СЂС‚ РЅР° РїРѕРІРµСЂС…РЅРѕСЃС‚Рё (x, top), РїСЂС‹Р¶РѕРє СЃ vx, РѕР¶РёРґР°РµРјР°СЏ РїРѕСЃР°РґРєР°.
// РџРµС‡Р°С‚Р°РµС‚ OK/FAIL РїРѕ РєР°Р¶РґРѕРјСѓ, С‡С‚РѕР±С‹ РёР· СЌС‚РѕРіРѕ СЃРѕР±СЂР°С‚СЊ botRoutes.
// Р—Р°РїСѓСЃРє: node --import ./tools/headless/register.mjs ./tools/headless/probe_route2.mjs
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

  const tryJump = (sx, top, vx, wantTops) => {
    const p = new Player(sc, sx, top - 82, { name: 'R', team: 'blue', isAI: false });
    try { sc.physics.add.collider(p, sc.platforms); } catch (e) {}
    try { sc.physics.add.collider(p, sc.covers); } catch (e) {}
    p.body.setVelocity(0, 0);
    for (let k = 0; k < 60; k++) { step(1); const b = p.body; if (b.blocked.down || b.touching.down) break; }
    const feet0 = Math.round(p.body.y + p.body.height);
    if (Math.abs(feet0 - top) > 2) { p.destroy(); return { bad: true, feet0 }; }
    p.body.setVelocity(vx, -470);
    let used2 = false, landed = null;
    for (let k = 0; k < 200; k++) {
      step(1);
      const b = p.body;
      if (!used2 && b.velocity.y >= 0) { used2 = true; b.setVelocity(vx, -420); }
      if (b.blocked.down || b.touching.down) { landed = { feet: Math.round(b.y + b.height), x: Math.round(p.x) }; break; }
    }
    p.destroy();
    return { landed, ok: !!(landed && wantTops.includes(landed.feet)) };
  };

  // РљР»СЋС‡РµРІС‹Рµ РїРµСЂРµС…РѕРґС‹. wantTops вЂ” РґРѕРїСѓСЃС‚РёРјС‹Рµ РІС‹СЃРѕС‚С‹ РїРѕСЃР°РґРєРё.
  const cases = [
    // РїСЂР°РІР°СЏ Р±Р°Р·Р°: Р·Р°С…РѕРґ СЃ СЏС‰РёРєР° 2890..3030 (РІРµСЂС… 790) РЅР° Р±Р°Р·Сѓ 3100..3680 (РІРµСЂС… 730)
    ['R: СЏС‰РёРє 3010@790 в†’ Р±Р°Р·Р° 730 vx=150', 3010, 790, 150, [730]],
    ['R: СЏС‰РёРє 3010@790 в†’ Р±Р°Р·Р° 730 vx=180', 3010, 790, 180, [730]],
    ['R: СЏС‰РёРє 3010@790 в†’ Р±Р°Р·Р° 730 vx=200', 3010, 790, 200, [730]],
    ['R: СЏС‰РёРє 3000@790 в†’ Р±Р°Р·Р° 730 vx=170', 3000, 790, 170, [730]],
    ['R: СЏС‰РёРє 3020@790 в†’ Р±Р°Р·Р° 730 vx=160', 3020, 790, 160, [730]],
    // Р»РµРІР°СЏ Р±Р°Р·Р°: Р·Р°С…РѕРґ СЃ СЏС‰РёРєР° 770..910 РЅР° Р±Р°Р·Сѓ 120..700
    ['L: СЏС‰РёРє 790@790 в†’ Р±Р°Р·Р° 730 vx=-170', 790, 790, -170, [730]],
    ['L: СЏС‰РёРє 800@790 в†’ Р±Р°Р·Р° 730 vx=-150', 800, 790, -150, [730]],
    // РІС‹С…РѕРґ СЃ Р±Р°Р·С‹ РЅР° СЏС‰РёРє (РІРїСЂР°РІРѕ, РІРЅРёР·)
    ['L: Р±Р°Р·Р° 690@730 в†’ СЏС‰РёРє 790 vx=240', 690, 730, 240, [790]],
    ['L: Р±Р°Р·Р° 690@730 в†’ РЅРёР· 850 vx=240', 690, 730, 240, [850]],
    ['R: Р±Р°Р·Р° 3120@730 в†’ СЏС‰РёРє 790 vx=-240', 3120, 730, -240, [790]],
    // Р·РµРјР»СЏ в†” СЃРµСЂРµРґРёРЅР° 690 (РїР»Р°С‚С„РѕСЂРјР° 1000..2800)
    ['РЅРёР· 960@850 в†’ СЃРµСЂРµРґРёРЅР° 690 vx=120', 960, 850, 120, [690]],
    ['РЅРёР· 960@850 в†’ СЃРµСЂРµРґРёРЅР° 690 vx=180', 960, 850, 180, [690]],
    ['РЅРёР· 980@850 в†’ СЃРµСЂРµРґРёРЅР° 690 vx=0', 980, 850, 0, [690]],
    ['СЃРµСЂРµРґРёРЅР° 1020@690 в†’ РЅРёР· 850 vx=-120', 1020, 690, -120, [850]],
    // Р·РµРјР»СЏ в†” РјРѕСЃС‚ 470 (900..2900)
    ['РЅРёР· 950@850 в†’ РјРѕСЃС‚ 470 vx=120', 950, 850, 120, [470]],
    ['СЃРµСЂРµРґРёРЅР° 1050@690 в†’ РјРѕСЃС‚ 470 vx=-120', 1050, 690, -120, [470]],
    // Р±Р°Р·Р° в†” РІС‹СЃС‚СѓРї 770 (0..160)
    ['РЅРёР· 100@850 в†’ РІС‹СЃС‚СѓРї 770 vx=-120', 100, 850, -120, [770]],
    ['crate 850@790 -> ledge 620 vx=-40', 850, 790, -40, [620]],
    ['crate 800@790 -> ledge 620 vx=-60', 800, 790, -60, [620]],
    ['crate 780@790 -> ledge 620 vx=-120', 780, 790, -120, [620]],
    ['ledge 840@620 -> mid 690 vx=240', 840, 620, 240, [690]],
    ['ledge 700@620 -> mid 690 vx=180', 700, 620, 180, [690]],
    ['mid 1050@690 -> ledge 620 vx=-240', 1050, 690, -240, [620]],
  ];

  const rows = [];
  for (const [name, sx, top, vx, wants] of cases) {
    const r = tryJump(sx, top, vx, wants);
    rows.push({ name, ...r });
    console.log('[pr2] ' + (r.bad ? 'BAD ' : (r.ok ? 'OK  ' : 'FAIL')) + ' ' + name +
      '  feet0=' + (r.feet0 ?? top) + ' -> ' + JSON.stringify(r.landed || null));
  }
  const okN = rows.filter(r => r.ok).length;
  console.log('[pr2] РёС‚РѕРі: ' + okN + '/' + rows.length);
  clearInterval(keep);
  process.exit(0);
});

