// diag_freeze.mjs — ЧИСТАЯ ДИАГНОСТИКА (поведение не меняет).
// Ищем НАСТОЯЩИЙ вход тела в статику и «заморозку внутри»:
//   1) прыжки позиции спрайта > 6px за тик (телепорт/сдвиг кодом) рядом с укрытием;
//   2) длительное перекрытие при почти нулевом движении (Arcade embedded:
//      _dx=_dy=0 → разделение не выполняется).
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_freeze.mjs --seed 1337
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

const TICKS = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--ticks') || '18000', 10);
const SEED = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--seed') || '1337', 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');

function rectOf(b) { return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }
function coverOverlap(p) {
  const b = p.body, sc = p.scene;
  if (!b || !sc || !sc.covers) return null;
  for (const c of sc.covers.getChildren()) {
    const cb = c && c.body;
    if (!cb) continue;
    if (b.x < cb.x + cb.width && b.x + b.width > cb.x &&
        b.y < cb.y + cb.height && b.y + b.height > cb.y) {
      const ovX = Math.min(b.x + b.width, cb.x + cb.width) - Math.max(b.x, cb.x);
      const ovY = Math.min(b.y + b.height, cb.y + cb.height) - Math.max(b.y, cb.y);
      if (ovX > 0.5 && ovY > 0.5) return { ovX: +ovX.toFixed(1), ovY: +ovY.toFixed(1), cb: rectOf(cb) };
    }
  }
  return null;
}

const S = { jumps: [], freezes: [], physicalTicks: 0 };
const run = new Map();   // name -> {n, x, y, t0, best}

const BP = Phaser.Physics.Arcade.Body.prototype;
const _pre = BP.preUpdate;
BP.preUpdate = function (willStep, delta) {
  const r = _pre.call(this, willStep, delta);
  try {
    const p = this.gameObject;
    if (p && p.playerName && p.isAI && !p.dead) {
      const o = coverOverlap(p);
      const st = run.get(p.playerName) || { n: 0, x: 0, y: 0, t0: 0, best: null };
      if (o) {
        S.physicalTicks++;
        if (st.n === 0) { st.t0 = clock.now; st.x = this.x; st.y = this.y; st.best = o; }
        st.n++;
        if (o.ovY > (st.best ? st.best.ovY : 0)) st.best = o;
      } else if (st.n) {
        if (st.n >= 3) {
          S.freezes.push({
            who: p.playerName, t: Math.round(st.t0), ticks: st.n,
            moved: [Math.round(this.x - st.x), Math.round(this.y - st.y)],
            ov: st.best, crouch: !!p.crouching,
            src: (p.ai && p.ai._dbgSrc) || '?',
          });
        }
        st.n = 0;
      }
      run.set(p.playerName, st);
    }
  } catch (e) {}
  return r;
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

game.events.on('ready', () => {
  try {
    const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
  } catch (e) { console.log('[df] map fail', e.message); }
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });
  setImmediate(loop);
});

function loop() {
  const sc = game.scene.getScene('GameScene');
  if (!sc || !sc.players || !sc.players.length) { setImmediate(loop); return; }
  const last = new Map();
  for (const p of sc.players) if (p && p.isAI) last.set(p, { x: p.x, y: p.y });
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    if (sc.gameOver) break;
    for (const p of sc.players) {
      if (!p || !p.isAI || p.dead) continue;
      const L = last.get(p);
      if (!L) continue;
      const dx = p.x - L.x, dy = p.y - L.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const o = coverOverlap(p);
        if (o) {
          S.jumps.push({
            t: Math.round(t), who: p.playerName, d: +d.toFixed(1), dxy: [+dx.toFixed(1), +dy.toFixed(1)],
            ov: o.ov, crate: o.cb, body: rectOf(p.body), crouch: !!p.crouching,
            src: (p.ai && p.ai._dbgSrc) || '?', embedded: !!p.body.embedded,
            onGround: !!(p.body.blocked.down || p.body.touching.down),
          });
        }
      }
      L.x = p.x; L.y = p.y;
    }
  }
  console.log('[df] seed', SEED, 'ticks', TICKS);
  console.log('[df] physics-overlap ticks', S.physicalTicks);
  console.log('[df] телепорты (|Δ|>6px) в укрытие:', S.jumps.length);
  for (const j of S.jumps.slice(0, 15)) console.log('[df]  ' + JSON.stringify(j));
  console.log('[df] заморозки (перекрытие ≥3 шагов физики):', S.freezes.length);
  for (const f of S.freezes.slice(0, 15)) console.log('[df]  ' + JSON.stringify(f));
  clearInterval(keep);
  process.exit(0);
}
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
