// diag_hops.mjs — ЧИСТАЯ ДИАГНОСТИКА «прыгают на месте»: на каждый forceJump
// пишем контекст (режим, блокировки, подъём, dy до цели), затем ловим
// приземление и считаем смещение/набор высоты. Цель — назвать, какие именно
// хопы бесполезны (а не резать все подряд).
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_hops.mjs [--seed 1337]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js';

const SEED = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--seed') || '1337', 10);
const TICKS = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--ticks') || '18000', 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { default: EnemyAI } = await import('../../js/ai/EnemyAI.js');

const S = { jumps: 0, inPlace: 0, patterns: {}, useless: [] };
const pend = new Map();   // name -> {x,y,t,src,blocked,climb,dy,hop}

const _fj = EnemyAI.prototype.forceJump;
EnemyAI.prototype.forceJump = function () {
  try {
    const p = this.player, b = p && p.body;
    if (p && b && (b.blocked.down || b.touching.down)) {
      const feet = b.y + b.height;
      const rec = {
        t: clock.now, x: p.x, y: feet, src: (this._dbgSrc || '?'),
        blocked: (b.blocked.left ? 'L' : '') + (b.blocked.right ? 'R' : '') + (b.blocked.up ? 'U' : ''),
        climb: this._navClimb ? 1 : 0,
        dyGoal: Number.isFinite(this._dbgGoalY) ? Math.round(this._dbgGoalY - feet) : null,
        dxGoal: Number.isFinite(this._dbgGoalX) ? Math.round(this._dbgGoalX - p.x) : null,
        veto: this._dbgVeto || '-',
      };
      pend.set(p.playerName, rec);
      S.jumps++;
    }
  } catch (e) {}
  return _fj.call(this);
};

let t = 0;
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
  setImmediate(loop);
});

function loop() {
  const sc = game.scene.getScene('GameScene');
  if (!sc || !sc.players || !sc.players.length) { setImmediate(loop); return; }
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    if (sc.gameOver) break;
    for (const p of sc.players) {
      if (!p || !p.isAI || !p.body) continue;
      const rec = pend.get(p.playerName);
      if (!rec) continue;
      const b = p.body;
      const gr = !!(b.blocked.down || b.touching.down);
      if (!gr) {
        // k541-фикс инструмента: ждём РЕАЛЬНОГО отрыва. Раньше мерили в тот
        // же кадр (тело ещё на земле) и получали «все прыжки на месте».
        if (!rec.air) {
          rec.air = true;
          rec.x0 = p.x;
          rec.y0 = b.y + b.height;
        }
        continue;
      }
      if (!rec.air) { if (t - rec.t > 3000) pend.delete(p.playerName); continue; }
      pend.delete(p.playerName);
      const dx = Math.abs(p.x - rec.x0);
      const dh = rec.y0 - (b.y + b.height);
      if (dx < 30) {
        S.inPlace++;
        const key = rec.src + '|blk' + (rec.blocked || '-') + '|climb' + rec.climb +
          '|dy' + (rec.dyGoal == null ? '?' : (rec.dyGoal > 40 ? '+' : rec.dyGoal < -40 ? '-' : '0'));
        S.patterns[key] = (S.patterns[key] || 0) + 1;
        if (dh < 12 && S.useless.length < 12) {
          S.useless.push({ ...rec, dx: Math.round(dx), dh: Math.round(dh) });
        }
      }
    }
  }
  console.log('[hp] прыжков', S.jumps, '| на месте (<30px):', S.inPlace);
  const top = Object.entries(S.patterns).sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [k, n] of top) console.log('[hp]  ' + n + '  ' + k);
  console.log('[hp] без набора высоты (dh<12):', S.useless.length);
  for (const u of S.useless) console.log('[hp]  ' + JSON.stringify(u));
  clearInterval(keep);
  process.exit(0);
}
