// diag_flag.mjs — ЧИСТАЯ ДИАГНОСТИКА жалобы «бот встаёт под флагом и не берёт».
// Смотрим только ЧУЖОЙ флаг (свой по правилам не подбирают).
// Три зоны: (A) в окне подбора |dx|<=40,|dy|<=90 — должен взять;
//           (B) по X в зоне, но по Y ниже/выше (90 < dy <= 400) — «стоит под флагом»;
//           (C) в окне, но флаг недостижим пробником (ctf.js flagReachable).
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_flag.mjs --seed 1337
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

function reachable(sc, p, f) {
  try {
    if (!sc || typeof sc._inSolid !== 'function') return true;
    for (const tt of [0.3, 0.55, 0.8]) {
      const x = p.x + (f.x - p.x) * tt, y = p.y + (f.y - p.y) * tt;
      if (sc._inSolid(x, y, 6)) return false;
    }
    return true;
  } catch (e) { return true; }
}

// Кто именно перекрывает отрезок «тело → флаг»: первый солид по пути.
function blocker(sc, p, f) {
  try {
    const groups = [['platform', sc.platforms], ['cover', sc.covers]];
    for (let k = 1; k <= 10; k++) {
      const tt = k / 10;
      const x = p.x + (f.x - p.x) * tt, y = p.y + (f.y - p.y) * tt;
      for (const [tag, g] of groups) {
        if (!g) continue;
        for (const o of g.getChildren()) {
          const b = o && o.body;
          if (!b) continue;
          if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
            return { tag, rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)], at: [Math.round(x), Math.round(y)], t: +tt.toFixed(1) };
          }
        }
      }
    }
  } catch (e) {}
  return null;
}

const S = {
  picks: 0,
  winTicks: 0, winNoPick: 0, winUnreach: 0,
  underTicks: 0, underIdle: 0,
  episodes: [], unreachSamples: [], noPickSamples: [],
};
const ep = new Map();

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
    const was = { blue: !!(sc.blueFlag && sc.blueFlag.carrier), red: !!(sc.redFlag && sc.redFlag.carrier) };
    game.headlessStep(t, 1000 / 60);
    if (sc.gameOver) break;
    if (sc.blueFlag && !was.blue && sc.blueFlag.carrier) S.picks++;
    if (sc.redFlag && !was.red && sc.redFlag.carrier) S.picks++;

    for (const p of sc.players) {
      if (!p || !p.isAI || p.dead) continue;
      const f = p.team === 'blue' ? sc.redFlag : sc.blueFlag;
      if (!f || f.carrier) { ep.delete(p.playerName); continue; }
      if (p.team === f.team) { ep.delete(p.playerName); continue; }   // свой флаг не подбирают
      const dx = Math.abs(p.x - f.x), dy = Math.abs(p.y - f.y);
      const b = p.body;
      const idle = !!(b && (b.blocked.down || b.touching.down) &&
        Math.abs(b.velocity.x) < 15 && Math.abs(b.velocity.y) < 15);

      if (dx <= 40 && dy <= 90) {
        S.winTicks++;
        const ok = reachable(sc, p, f);
        if (!ok) {
          S.winUnreach++;
          if (S.unreachSamples.length < 8) S.unreachSamples.push({ t: Math.round(t), who: p.playerName, px: Math.round(p.x), py: Math.round(p.y), fx: Math.round(f.x), fy: Math.round(f.y), src: (p.ai && p.ai._dbgSrc) || '?', blocker: blocker(sc, p, f) });
        } else {
          S.winNoPick++;
          if (S.noPickSamples.length < 8) S.noPickSamples.push({ t: Math.round(t), who: p.playerName, px: Math.round(p.x), py: Math.round(p.y), fx: Math.round(f.x), fy: Math.round(f.y), state: f.state, noPickupMs: Math.round((f._noPickupUntil || 0) - t), src: (p.ai && p.ai._dbgSrc) || '?' });
        }
      } else if (dx <= 40 && dy <= 400) {
        S.underTicks++;
        if (idle) S.underIdle++;
        const e = ep.get(p.playerName);
        if (!e) ep.set(p.playerName, { n: 1, t0: t, rec: { who: p.playerName, dx: Math.round(dx), dy: Math.round(dy), above: p.y < f.y, src: (p.ai && p.ai._dbgSrc) || '?', crouch: !!p.crouching, px: Math.round(p.x), py: Math.round(p.y), fx: Math.round(f.x), fy: Math.round(f.y) } });
        else e.n++;
      } else {
        const e = ep.get(p.playerName);
        if (e && e.n >= 60 && S.episodes.length < 10) S.episodes.push({ ...e.rec, ticks: e.n, sec: +(e.n / 60).toFixed(1) });
        ep.delete(p.playerName);
      }
    }
  }
  console.log('[fl] seed', SEED, 'тиков', TICKS, '| подборов', S.picks);
  console.log('[fl] в окне подбора (dx<=40, dy<=90): тиков', S.winTicks,
    '| не взят несмотря на окно:', S.winNoPick, '| недостижим пробником:', S.winUnreach);
  console.log('[fl] «по X в зоне, по Y нет» (90<dy<=400):', S.underTicks, 'тиков, из них стоя:', S.underIdle);
  if (S.noPickSamples.length) { console.log('[fl] примеры «в окне, но не взят»:'); for (const x of S.noPickSamples) console.log('[fl]  ' + JSON.stringify(x)); }
  if (S.unreachSamples.length) { console.log('[fl] примеры «недостижим»:'); for (const x of S.unreachSamples) console.log('[fl]  ' + JSON.stringify(x)); }
  if (S.episodes.length) { console.log('[fl] эпизоды >=1с «под флагом»:'); for (const x of S.episodes) console.log('[fl]  ' + JSON.stringify(x)); }
  clearInterval(keep);
  process.exit(0);
}
