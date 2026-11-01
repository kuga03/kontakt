// probe_jump.mjs — ЧИСТАЯ ФИЗИКА: можно ли реально прыгнуть с платформы 690
// (середина, край x≈1000) на платформу 628 (660..860)? Bake ребра не даёт —
// проверяем, врёт ли bake или геометрия.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/probe_jump.mjs
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

  const runs = [];
  const tries = [
    { x: 1010, vx: -240 }, { x: 1010, vx: -120 }, { x: 960, vx: -240 }, { x: 900, vx: -240 },
    { x: 1000, vx: -60 }, { x: 1000, vx: 0 },
  ];
  for (let i = 0; i < tries.length; i++) {
    const { x, vx } = tries[i];
    const p = new Player(sc, x, 560, { name: 'J' + i, team: 'blue', isAI: false });
    p.body.setAllowGravity(true);
    p.body.setVelocity(0, 0);
    // Без коллайдеров тело провалится сквозь всё (у спавна сцены они
    // вешаются поштучно) — добавляем как настоящему бойцу.
    try { sc.physics.add.collider(p, sc.platforms); } catch (e) {}
    try { sc.physics.add.collider(p, sc.covers); } catch (e) {}
    // ждём приземления на 690 (край платформы 1000..2800, верх 690)
    for (let k = 0; k < 120; k++) { step(1); const b = p.body; if (b.blocked.down || b.touching.down) break; }
    const feet0 = Math.round(p.body.y + p.body.height);
    // прыжок с заданным боковым импульсом
    p.body.setVelocity(vx, -470);
    let landed = null;
    for (let k = 0; k < 180; k++) {
      step(1);
      const b = p.body;
      if (b.blocked.down || b.touching.down) { landed = { feet: Math.round(b.y + b.height), x: Math.round(p.x), k }; break; }
    }
    runs.push({ startX: x, vx, feet0, landed, endX: Math.round(p.x), endFeet: Math.round(p.body.y + p.body.height) });
    p.destroy();
  }
  console.log('[pj] прыжок с середины 690 на 628 (платформа 660..860):');
  for (const r of runs) console.log('[pj]  ' + JSON.stringify(r));
  clearInterval(keep);
  process.exit(0);
});
