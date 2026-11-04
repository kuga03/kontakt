// diag_phantom.mjs — ЧИСТАЯ ДИАГНОСТИКА. Доказывает по каждому событию, что
// перекрытие в «мёртвом окне» (конец тика) исчезает на входе следующего шага
// физики (Body.preUpdate), т.е. физика его никогда не видит.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_phantom.mjs --seed 1337
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js';

const TICKS = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--ticks') || '18000', 10);
const SEED = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--seed') || '1337', 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');

function overlap(p) {
  const b = p.body, sc = p.scene;
  if (!b || !sc || !sc.covers) return null;
  for (const c of sc.covers.getChildren()) {
    const cb = c && c.body;
    if (!cb) continue;
    if (b.x < cb.x + cb.width && b.x + b.width > cb.x &&
        b.y < cb.y + cb.height && b.y + b.height > cb.y) {
      const ox = Math.min(b.x + b.width, cb.x + cb.width) - Math.max(b.x, cb.x);
      const oy = Math.min(b.y + b.height, cb.y + cb.height) - Math.max(b.y, cb.y);
      if (ox > 0.5 && oy > 0.5) return { ox, oy };
    }
  }
  return null;
}

const pending = new Map();      // name -> замер в конце тика
const R = { total: 0, goneAtPre: 0, sameAtPre: 0, rows: [] };

const BP = Phaser.Physics.Arcade.Body.prototype;
const _pre = BP.preUpdate;
BP.preUpdate = function (willStep, delta) {
  const r = _pre.call(this, willStep, delta);
  try {
    const p = this.gameObject;
    if (p && p.playerName) {
      const rec = pending.get(p.playerName);
      if (rec) {
        pending.delete(p.playerName);
        const o2 = overlap(p);
        R.total++;
        if (o2) { R.sameAtPre++; if (R.rows.length < 12) R.rows.push({ ...rec, after: o2, who: p.playerName, verdict: 'STILL' }); }
        else {
          R.goneAtPre++;
          if (R.rows.length < 12) {
            R.rows.push({ t: rec.t, who: p.playerName, crouch: rec.crouch, ov: [rec.ox, rec.oy], dBodyY: +(this.y - rec.by).toFixed(2), verdict: 'PHANTOM' });
          }
        }
      }
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
    pending.clear();
    for (const p of sc.players) {
      if (!p || !p.isAI || p.dead || !p.body) continue;
      const o = overlap(p);
      if (o) pending.set(p.playerName, { t: Math.round(t), crouch: !!p.crouching, ox: +o.ox.toFixed(1), oy: +o.oy.toFixed(1), by: p.body.y, h: p.body.height, offY: p.body.offset.y });
    }
  }
  console.log('[ph] seed', SEED, 'событий в мёртвом окне:', R.total,
    '| исчезли на preUpdate:', R.goneAtPre, '| остались:', R.sameAtPre);
  for (const r of R.rows) console.log('[ph]  ' + JSON.stringify(r));
  clearInterval(keep);
  process.exit(0);
}
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
