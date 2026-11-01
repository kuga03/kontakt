// probe_route.mjs — ЧИСТАЯ ФИЗИКА: проверяет ключевые переходы маршрута.
// Тело ставится НА конкретную поверхность (y = top - 82), прыгает с заданным
// vx, смотрим, куда село. Если feet0 не совпал с ожидаемым — кейс невалиден.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/probe_route.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

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

  // [имя, x старта, top старта, vx, ожидаемый top посадки]
  const cases = [
    ['ЯЩИК 2950@790 → БАЗА 3150@730  vx=+120', 2950, 790, 120, 730],
    ['ЯЩИК 2950@790 → БАЗА 3150@730  vx=+240', 2950, 790, 240, 730],
    ['ЯЩИК 780@790  → БАЗА 640@730   vx=-120', 780, 790, -120, 730],
    ['ЯЩИК 780@790  → БАЗА 640@730   vx=-240', 780, 790, -240, 730],
    ['ЗЕМЛЯ 1000@850 → ЯЩИК 840@790  vx=-240', 1000, 850, -240, 790],
    ['ЗЕМЛЯ 2850@850 → ЯЩИК 2950@790 vx=+240', 2850, 850, 240, 790],
    ['БАЗА 700@730  → ЯЩИК 780@790 (спуск, vx=0)', 690, 730, 0, 790],
    ['СЕРЕДИНА 2750@690 → НИЗ 2850@850 (спуск)', 2750, 690, 120, 850],
    ['НИЗ 950@850 → СЕРЕДИНА 1050@690 (подъём)', 950, 850, 120, 690],
  ];
  const out = [];
  for (const [name, sx, top, vx, want] of cases) {
    const p = new Player(sc, sx, top - 82, { name: 'R', team: 'blue', isAI: false });
    try { sc.physics.add.collider(p, sc.platforms); } catch (e) {}
    try { sc.physics.add.collider(p, sc.covers); } catch (e) {}
    p.body.setVelocity(0, 0);
    for (let k = 0; k < 60; k++) { step(1); const b = p.body; if (b.blocked.down || b.touching.down) break; }
    const feet0 = Math.round(p.body.y + p.body.height);
    const valid = Math.abs(feet0 - top) <= 2;
    p.body.setVelocity(vx, -470);
    let used2 = false, landed = null;
    for (let k = 0; k < 220; k++) {
      step(1);
      const b = p.body;
      if (!used2 && b.velocity.y >= 0) { used2 = true; b.setVelocity(vx, -420); }
      if (b.blocked.down || b.touching.down) { landed = { feet: Math.round(b.y + b.height), x: Math.round(p.x) }; break; }
    }
    const ok = valid && !!(landed && Math.abs(landed.feet - want) <= 2);
    out.push({ name, feet0, valid, landed, ok });
    p.destroy();
  }
  console.log('[pr] проверка переходов:');
  for (const r of out) {
    console.log('[pr]  ' + (r.ok ? 'OK  ' : (r.valid ? 'FAIL' : 'BAD ')) + ' ' + r.name +
      '  feet0=' + r.feet0 + ' -> ' + JSON.stringify(r.landed));
  }
  console.log('[pr] итог: ' + out.filter(r => r.ok).length + '/' + out.length);
  clearInterval(keep);
  process.exit(0);
});
