// diag_clip.mjs — ЧИСТАЯ ДИАГНОСТИКА (поведение не меняет).
// Вопрос: перекрытие тела с укрытием — только «мёртвое окно» между
// scene.update (смена стойки) и следующим preUpdate, или настоящее состояние?
// Пишем контекст каждого события на входе шага физики (preUpdate, позиция уже
// пересчитана из спрайта): тело, offset, стойка, скорость, защёлки, и что было
// в конце прошлого тика.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_clip.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { collectMetrics } from './metrics.mjs';
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
const { default: Player } = await import('../../js/entities/Player.js');

// --- счётчики ---
const S = {
  physClipTicks: 0, physClipEvents: 0, staleClipEvents: 0,
  standUp: 0, standUpOnSolid: 0, longEpisodes: [], events: [],
};
const prevPhys = new Map(), curEp = new Map();
const lastCrouchChg = new Map();
const lastPost = new Map();

function rectOf(b) {
  return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
}
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
      if (ovX > 0.5 && ovY > 0.5) {
        return { ovX: +ovX.toFixed(1), ovY: +ovY.toFixed(1), cb: rectOf(cb) };
      }
    }
  }
  return null;
}

// ловим смену стойки (кто и когда)
const _setCrouch = Player.prototype.setCrouch;
Player.prototype.setCrouch = function (c, e) {
  const before = !!this.crouching;
  const r = _setCrouch.call(this, c, e);
  if (!!this.crouching !== before) lastCrouchChg.set(this.playerName, { t: clock.now, to: !!this.crouching });
  return r;
};

const BP = Phaser.Physics.Arcade.Body.prototype;
const _pre = BP.preUpdate;
BP.preUpdate = function (willStep, delta) {
  const r = _pre.call(this, willStep, delta);
  try {
    const p = this.gameObject;
    if (p && p.playerName && p.isAI && !p.dead) {
      const o = coverOverlap(p);
      const was = prevPhys.get(p.playerName) || false;
      if (o) {
        S.physClipTicks++;
        if (!was) {
          S.physClipEvents++;
          const cc = lastCrouchChg.get(p.playerName);
          const post = lastPost.get(p.playerName);
          const ev = {
            t: Math.round(clock.now), who: p.playerName,
            body: rectOf(this), off: [Math.round(this.offset.x), Math.round(this.offset.y)],
            crouch: !!p.crouching, vel: [Math.round(this.velocity.x), Math.round(this.velocity.y)],
            blocked: (this.blocked.down ? 'D' : '') + (this.blocked.left ? 'L' : '') +
              (this.blocked.right ? 'R' : '') + (this.blocked.up ? 'U' : ''),
            crate: o.cb, ov: [o.ovX, o.ovY],
            post: post || null,
            crouchChgAgoMs: cc ? Math.round(clock.now - cc.t) : null,
            crouchChgTo: cc ? (cc.to ? 'crouch' : 'stand') : null,
            src: (p.ai && p.ai._dbgSrc) || '?',
          };
          S.events.push(ev);
          curEp.set(p.playerName, { t0: clock.now, ov: o.ovY });
        } else {
          const e = curEp.get(p.playerName);
          if (e) e.ov = Math.max(e.ov, o.ovY);
        }
        prevPhys.set(p.playerName, true);
      } else {
        if (was) {
          const e = curEp.get(p.playerName);
          if (e) {
            const dur = Math.round((clock.now - e.t0) / (1000 / 60));
            if (dur >= 2) S.longEpisodes.push({ who: p.playerName, tick0: Math.round(e.t0), durTicks: dur, ov: e.ov });
          }
          curEp.delete(p.playerName);
        }
        prevPhys.set(p.playerName, false);
      }
    }
  } catch (e) {}
  return r;
};

let t = 0;
const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720,
  audio: { noAudio: true }, banner: false, dom: { createContainer: false },
  fps: { forceSetTimeOut: true, target: 60 },
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
  } catch (e) { console.log('[diag] map fail', e.message); }
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });
  setImmediate(run);
});

function run() {
  const sc = game.scene.getScene('GameScene');
  if (!sc || !sc.players || !sc.players.length) { setImmediate(run); return; }
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    const before = new Map();
    for (const p of sc.players) if (p && p.isAI && !p.dead) before.set(p, p.crouching);
    game.headlessStep(t, 1000 / 60);
    if (sc.gameOver) { console.log('[diag] gameOver at', Math.round(t)); break; }
    for (const p of sc.players) {
      if (!p || !p.isAI || p.dead || !p.body) continue;
      if (before.get(p) === true && p.crouching === false) {
        S.standUp++;
        const o = coverOverlap(p);
        if (o && o.ovY > 5) S.standUpOnSolid++;
        if (o) S.staleClipEvents++;
      }
      lastPost.set(p.playerName, {
        body: rectOf(p.body), crouch: !!p.crouching,
        off: [Math.round(p.body.offset.x), Math.round(p.body.offset.y)],
        vel: [Math.round(p.body.velocity.x), Math.round(p.body.velocity.y)],
        y: Math.round(p.y),
      });
    }
  }
  const m = collectMetrics(sc);
  console.log('[diag] ticks', TICKS, 'seed', SEED);
  console.log('[diag] standUp=', S.standUp, 'standUpOnSolid=', S.standUpOnSolid,
    '| stale window overlaps=', S.staleClipEvents,
    '| PHYSICS clip ticks=', S.physClipTicks, 'events=', S.physClipEvents,
    'long(≥2)=', S.longEpisodes.length);
  const byWho = {};
  for (const e of S.events) byWho[e.who] = (byWho[e.who] || 0) + 1;
  console.log('[diag] клипы по ботам:', JSON.stringify(byWho));
  console.log('[diag] первые события:');
  for (const e of S.events.slice(0, 20)) console.log('[diag]  ' + JSON.stringify(e));
  if (S.longEpisodes.length) { console.log('[diag] длинные эпизоды:'); for (const e of S.longEpisodes.slice(0, 10)) console.log('[diag]  ' + JSON.stringify(e)); }
  console.log('[diag] scores', JSON.stringify(m.scores), 'flag', JSON.stringify(m.flag));
  clearInterval(keep);
  process.exit(0);
}
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) { console.log('[diag] texturesReady fail', e.message); } } }, 700);
