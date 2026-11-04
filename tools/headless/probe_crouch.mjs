// probe_crouch.mjs — ЧИСТЫЙ ЗАМЕР (без изменения поведения):
//   1) коэффициент body.offset → мир у тела в покое;
//   2) что делает смена стойки (setCrouch) с НИЗОМ тела: на земле, на ящике,
//      в воздухе.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/probe_crouch.mjs
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
if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([1337, 1338]);

const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { default: Player } = await import('../../js/entities/Player.js');

const game = new Phaser.Game({
  type: Phaser.HEADLESS,
  width: 1280, height: 720,
  audio: { noAudio: true },
  banner: false,
  dom: { createContainer: false },
  fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene],
});
gameState.demoMode = true;

let t = 0;
function step(n = 1) {
  for (let i = 0; i < n; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
  }
}

const f = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v)) ? +v.toFixed(d) : v;
function snap(p, label) {
  const b = p.body;
  return {
    label,
    sprX: f(p.x), sprY: f(p.y),
    dOH: f(p.displayOriginX), dOV: f(p.displayOriginY), dH: f(p.displayHeight), scY: f(p.scaleY, 3),
    offY: f(b.offset.y), h: f(b.height), bodyY: f(b.y), bodyB: f(b.y + b.height),
    vx: f(b.velocity.x, 1), vy: f(b.velocity.y, 1),
    grounded: !!(b.blocked.down || b.touching.down),
    crouch: !!p.crouching,
  };
}
function dump(rows) {
  const keys = Object.keys(rows[0]);
  const w = {};
  for (const k of keys) w[k] = Math.max(k.length, ...rows.map(r => String(r[k]).length));
  for (const r of rows) console.log(keys.map(k => String(r[k]).padStart(w[k])).join('  '));
}

const keep = setInterval(() => {}, 1000);
process.on('exit', () => clearInterval(keep));
setTimeout(() => {
  if (!game.isRunning) {
    try { game.texturesReady(); } catch (e) { console.log('[probe] texturesReady fail', e && e.stack || e); }
  }
}, 700);
setTimeout(() => { console.log('[probe] TIMEOUT: scene не поднялась'); process.exit(2); }, 60000);

game.events.on('ready', () => {
  try {
    const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
  } catch (e) { console.log('[probe] map fail', e.message); }
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });
  const sc1 = game.scene.getScene('GameScene');
  console.log('[probe] ready; scene active=', !!(sc1 && sc1.scene.isActive()),
    'players=', sc1 && sc1.players ? sc1.players.length : 'none');
  step(5);
  console.log('[probe] after 5 steps: active=', !!(sc1 && sc1.scene.isActive()),
    'players=', sc1 && sc1.players ? sc1.players.length : 'none');
  setImmediate(run);
});

function run() {
  const sc = game.scene.getScene('GameScene');
  if (!sc || !sc.players || !sc.players.length) { if (!globalThis._probeTries) { globalThis._probeTries = 0; console.log('[probe] waiting players, sc=', !!sc, 'active=', sc && sc.scene.isActive()); } globalThis._probeTries++; if (globalThis._probeTries > 200) { console.log('[probe] no players after tries'); process.exit(4); } setImmediate(run); return; }
  step(30);
  console.log('[probe] tick base', Math.round(t));

  // ---------- Т1: что делает offset.y в покое ----------
  const pr = new Player(sc, 1900, 200, { name: 'Probe', team: 'blue', isAI: false });
  pr.body.setAllowGravity(false);
  pr.body.setVelocity(0, 0);
  pr.body.setImmovable(true);
  step(3);
  const a0 = snap(pr, 'A stand idle');
  pr.body.setOffset(pr.body.offset.x, pr.body.offset.y + 10);
  const a1 = snap(pr, 'B off+10 (до шага)');
  step(1);
  const a2 = snap(pr, 'C off+10 (после шага)');
  pr.body.setOffset(pr.body.offset.x, pr.body.offset.y - 10);
  step(1);
  const a3 = snap(pr, 'D off вернули');
  console.log('\n=== Т1: offset → мир (тело в воздухе, гравитация выкл) ===');
  dump([a0, a1, a2, a3]);

  // ---------- Т2: смена стойки в воздухе ----------
  const b0 = snap(pr, 'E stand air');
  pr.setCrouch(true);
  const b1 = snap(pr, 'F crouch (до шага)');
  step(1);
  const b2 = snap(pr, 'G crouch (после шага)');
  pr.setCrouch(false);
  const b3 = snap(pr, 'H stand (до шага)');
  step(1);
  const b4 = snap(pr, 'I stand (после шага)');
  console.log('\n=== Т2: присед/вставание в воздухе ===');
  dump([b0, b1, b2, b3, b4]);

  // ---------- Т3: смена стойки на земле ----------
  pr.body.setAllowGravity(true);
  pr.setPosition(1900, 700); // над средней платформой (y=698)
  step(40);
  const c0 = snap(pr, 'J stand ground');
  pr.setCrouch(true);
  const c1 = snap(pr, 'K crouch (до шага)');
  step(1);
  const c2 = snap(pr, 'L crouch (после шага)');
  pr.setCrouch(false);
  const c3 = snap(pr, 'M stand (до шага)');
  step(1);
  const c4 = snap(pr, 'N stand (после шага)');
  step(1);
  const c5 = snap(pr, 'O +1 шаг');
  console.log('\n=== Т3: присед/вставание на земле ===');
  dump([c0, c1, c2, c3, c4, c5]);

  // ---------- Т4: вставание, стоя НА ящике ----------
  // ящик: центр (840,820) 140x60 → верхняя грань y=790.
  pr.setCrouch(false);
  pr.setPosition(840, 700);
  step(40);
  const d0 = snap(pr, 'P stand on crate');
  pr.setCrouch(true);
  const d1 = snap(pr, 'Q crouch (до шага)');
  step(1);
  const d2 = snap(pr, 'R crouch (после шага)');
  pr.setCrouch(false);
  const d3 = snap(pr, 'S stand (до шага)');
  step(1);
  const d4 = snap(pr, 'T stand (после шага)');
  step(1);
  const d5 = snap(pr, 'U +1 шаг');
  step(1);
  const d6 = snap(pr, 'V +2 шага');
  const crates = (sc.covers ? sc.covers.getChildren() : []).map(c => [Math.round(c.body.x), Math.round(c.body.y), Math.round(c.body.width), Math.round(c.body.height)]);
  console.log('\n=== Т4: присед/вставание на ящике (верх y=790) ===');
  dump([d0, d1, d2, d3, d4, d5, d6]);
  console.log('[probe] covers', JSON.stringify(crates));
  process.exit(0);
}

