// probe_speed.mjs — ЧИСТАЯ ДИАГНОСТИКА: фактическая скорость носильщика и
// обычного бота в одном матче (замер гипотезы «носильщик медленнее на 25%
// из-за carryMul бомбы»). Ничего не меняет: только чтения velocity/moveSpeed.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/probe_speed.mjs --seed 1021
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const SEED = parseInt(arg('seed', '1021'), 10);
const TICKS = parseInt(arg('ticks', '18000'), 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
try { if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]); } catch (e) {}

const { default: GameScene } = await import('../../js/scenes/GameScene.js');

const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene],
});
gameState.demoMode = true;

const R = (v) => (Number.isFinite(v) ? Math.round(v) : '-');

game.events.on('ready', () => {
  try {
    const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
  } catch (e) {}
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });

  // samples: только «чистый бег по земле»: gr=1, не присед, не blocked по X,
  // |vx|>=40, и за последние 6 тиков цель по X не меняла знак (не дёрганье).
  const stat = {};
  const key = (kind, cls) => kind + '/' + cls;
  const add = (k, v) => { const s = stat[k] || (stat[k] = { n: 0, sum: 0, vmax: 0 }); s.n++; s.sum += v; if (v > s.vmax) s.vmax = v; };
  let t = 0;
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    const sc = game.scene.getScene('GameScene');
    if (!sc || !sc.players) continue;
    for (const p of sc.players) {
      if (!p || p.dead || !p.body) continue;
      const b = p.body;
      const gr = !!(b.blocked && b.blocked.down) || !!(b.touching && b.touching.down);
      if (!gr || p.crouching) continue;
      if (b.blocked && (b.blocked.left || b.blocked.right)) continue;
      const vx = Math.abs(b.velocity.x || 0);
      if (vx < 40) continue;
      const carrier = !!(p.isCarrier ||
        (sc.blueFlag && sc.blueFlag.carrier === p) ||
        (sc.redFlag && sc.redFlag.carrier === p));
      add(key(carrier ? 'carrier' : 'plain', p.constructor && p.constructor.name), vx);
    }
    if (i % 6000 === 0) {
      // раз в ~100с — снимок «кто есть кто»
      const arr = [];
      for (const p of sc.players) {
        arr.push(`${p.playerName}(${p.team}) spd=${R(p.moveSpeed)} pct=${R(p.moveSpeedPct)} car=${(p.isCarrier || (sc.blueFlag && sc.blueFlag.carrier === p) || (sc.redFlag && sc.redFlag.carrier === p)) ? 1 : 0}`);
      }
      console.log(`[T] t=${R(t)} ` + arr.join(' | '));
    }
  }
  console.log('\n[SPEED] средняя |vx| на земле (без приседа, без упора в стену):');
  for (const k of Object.keys(stat).sort()) {
    const s = stat[k];
    console.log(`  ${k.padEnd(24)} n=${String(s.n).padStart(6)} avg=${(s.sum / s.n).toFixed(1).padStart(6)} max=${s.vmax.toFixed(0)}`);
  }
  process.exit(0);
});

setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
