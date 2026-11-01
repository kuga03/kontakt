// diag_carry.mjs — ЧИСТАЯ ДИАГНОСТИКА (только чтения): кто ведёт носильщика.
// Каждый тик с флагом печатает состояние: позиция/цель/коридор k427/детур/
// навпуть/руль. Плюс события создания детура (smartDetour, dropStep, краевой
// сеттер ctfMove) со стеком вызова — видно, КТО выставил det вправо.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_carry.mjs --seed 1007 --ticks 18000
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const SEED = parseInt(arg('seed', '1007'), 10);
const TICKS = parseInt(arg('ticks', '18000'), 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
try { if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]); } catch (e) {}

const { default: GameScene } = await import('../../js/scenes/GameScene.js');
// ВАЖНО: игра импортирует EnemyAI с ?v=191 — это ДРУГОЙ экземпляр модуля.
// Без того же ?v= патч прототипа молча не сработает (грабли §1.8 п.2).
const { default: EnemyAI } = await import('../../js/ai/EnemyAI.js?v=194');

const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene],
});
gameState.demoMode = true;

const R = (v) => (Number.isFinite(v) ? Math.round(v) : '-');
const callSite = () => {
  try {
    const s = (new Error().stack || '').split('\n');
    // 0 Error, 1 hook, 2.. callers — берём 2 кадра с именем файла:строки
    return s.slice(2, 4).map(l => l.trim().replace(/^at\s+/, '').replace(/\(.*?([^\\/]+:\d+:\d+)\)/, '$1'))
      .map(l => l.length > 90 ? l.slice(0, 90) : l).join(' <- ');
  } catch (e) { return '?'; }
};

function explainClimb(ai, tx) {
  const p = ai.player;
  let feet = p.y + 10;
  try { const k = (typeof p._rigHitboxK === 'function') ? p._rigHitboxK() : 1; feet = p.y + 28 * k; } catch (e) {}
  const out = [];
  for (const g of [ai.scene.platforms, ai.scene.covers]) {
    if (!g) continue;
    for (const o of g.getChildren()) {
      const b = o.body;
      if (!b || !b.enable || b.width > 2500) continue;
      const hAbove = feet - b.y;
      if (hAbove < 20 || hAbove > 180) continue;
      const mid = b.x + b.width / 2;
      const nearEdge = (tx < mid) ? b.x - 6 : b.x + b.width + 6;
      const d = Math.abs(nearEdge - p.x), w = Math.abs(nearEdge - tx);
      out.push({ k: b.x + ':' + b.y + ':' + Math.round(b.width), e: Math.round(nearEdge), d: Math.round(d), w: Math.round(w), s: Math.round(d + w * 0.5), h: Math.round(hAbove) });
    }
  }
  out.sort((a, b) => a.s - b.s);
  return out.slice(0, 4).map(o => `${o.e}(s${o.s} h${o.h} d${o.d} w${o.w} ${o.k})`).join(' ');
}

function hook() {
  const P = EnemyAI.prototype;
  const oDet = P._smartDetour;
  P._smartDetour = function (time, mx, my) {
    const before = this._detourX;
    const r = oDet.call(this, time, mx, my);
    if (this._detourX != null && this._detourX !== before) {
      console.log(`[DET] t=${R(time)} who=${this.player && this.player.playerName} mx=${R(mx)} my=${R(my)} ` +
        `side=${this._detourSide} det=${R(this._detourX)} until=${R(this._detourUntil)} ` +
        `stuck=${this._detourStuck && this._detourStuck.n} fails=${this._coverFails} src=${this._dbgSrc} @ ${callSite()}`);
    }
    return r;
  };
  const oMV = P.moveToward;
  P.moveToward = function (time, tx) {
    const r = oMV.call(this, time, tx);
    try {
      const st = (new Error().stack || '').split('\n');
      let call = '';
      for (let i = 2; i < st.length; i++) {
        const m = st[i].match(/([A-Za-z0-9_]+\.js):(\d+):/);
        if (m && !/diag_carry/.test(m[1])) { call = m[1] + ':' + m[2]; break; }
      }
      (this.__mv = this.__mv || []).push(Math.round(tx) + ':' + (this._dbgDir ?? '?') + ':' + (this._dbgVeto ?? '-') + '@' + call);
    } catch (e) {}
    return r;
  };
  const oFJ = P.forceJump;
  P.forceJump = function () {
    try { this.__fj = (this.__fj | 0) + 1; } catch (e) {}
    return oFJ.call(this);
  };
  const oCT = P.climbToward;
  P.climbToward = function (time, target) {
    const r = oCT.call(this, time, target);
    try {
      const p = this.player;
      if (p && (p.isCarrier || (this.scene && ((this.scene.blueFlag && this.scene.blueFlag.carrier === p) || (this.scene.redFlag && this.scene.redFlag.carrier === p))))) {
        console.log(`[CT] t=${R(time)} who=${p.playerName} tx=${target && R(target.x)} p=${R(p.x)},${R(p.y)} -> cx=${R(r)} ` +
          `key=${this._climbKey} for=${R(this._climbFor)} best=${R(this._climbBest)} taboo=${this._climbTaboo ? R(this._climbTaboo.until) + '/' + this._climbTaboo.key : '-'}` +
          ` | ${explainClimb(this, target && target.x)}`);
      }
    } catch (e) {}
    return r;
  };
  const oDrop = P._dropStep;
  P._dropStep = function (time, x) {
    const ok = oDrop.call(this, time, x);
    if (ok) console.log(`[DROPST] t=${R(time)} who=${this.player && this.player.playerName} to=${R(x)} @ ${callSite()}`);
    return ok;
  };
  // Краевой сеттер в ctfMove пишет _detourX напрямую — ловим смену из тика.
  return function tickDetWatch(ai, time) {
    const cur = ai._detourX;
    const prev = ai.__diagDetPrev;
    if (cur != null && cur !== prev) {
      console.log(`[DETset] t=${R(time)} who=${ai.player && ai.player.playerName} det=${R(cur)} ` +
        `until=${R(ai._detourUntil)} setAt=${R(ai._detourSetAt)} src=${ai._dbgSrc} @ ${callSite()}`);
    }
    ai.__diagDetPrev = cur;
  };
}

game.events.on('ready', () => {
  try {
    const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
  } catch (e) {}
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });
  const watch = hook();
  let t = 0;
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    // счётчики хода — до шага, чтобы [C] видел именно этот тик
    try {
      const scp = game.scene.getScene('GameScene');
      for (const p of (scp && scp.players) || []) { if (p && p.ai) { p.ai.__mv = []; p.ai.__fj = 0; } }
    } catch (e) {}
    game.headlessStep(t, 1000 / 60);
    const sc = game.scene.getScene('GameScene');
    if (!sc || !sc.players) continue;
    const bf = sc.blueFlag, rf = sc.redFlag;
    // [F]/[DEATH]: подбор/потеря флага + контекст гибели (кто рядом, LOS,
    // динамика hp за 2с). Только чтения — нужно, чтобы фикс живучести бил
    // в факт, а не в догадку.
    try {
      const bc = !!(bf && bf.carrier), rc = !!(rf && rf.carrier);
      const st = watch.__f || (watch.__f = { b: false, r: false, hb: [], hr: [], bRef: null, rRef: null });
      const pushH = (arr, p, ai) => { arr.push({ t, hp: p.hp, x: p.x, y: p.y, src: ai && ai._dbgSrc }); if (arr.length > 130) arr.shift(); };
      const hpAt = (arr, dt) => {
        const tgt = t - dt; let best = null;
        for (const s of arr) if (!best || Math.abs(s.t - tgt) < Math.abs(best.t - tgt)) best = s;
        return best ? best.hp : null;
      };
      const deathCtx = (p, ref, arr) => {
        if (!p || !ref) return '';
        const near = [];
        for (const q of sc.players) {
          if (!q || q.dead || q === ref || q.team === ref.team) continue;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < 600) {
            let los = null;
            try { if (typeof sc.hasLineOfSight === 'function') los = sc.hasLineOfSight(p.x, p.y, q.x, q.y - 28, true) ? 1 : 0; } catch (eL) {}
            near.push({ n: q.playerName, d: Math.round(d), los });
          }
        }
        near.sort((a, b) => a.d - b.d);
        const hp2 = hpAt(arr, 2000), hp1 = hpAt(arr, 1000), hp05 = hpAt(arr, 500);
        return `hp: 2s=${R(hp2)} 1s=${R(hp1)} 0.5s=${R(hp05)} now=${R(p.hp)} src=${(ref.ai && ref.ai._dbgSrc) || '-'} ` +
          `| near(${near.length}): ` + (near.slice(0, 4).map((q) => `${q.n}@${q.d}${q.los == null ? '' : (q.los ? 'L' : 'x')}`).join(' ') || '-');
      };
      if (bc && !st.b) console.log(`[F] t=${R(t)} BLUE picked by ${bf.carrier.playerName}(${bf.carrier.team}) @${R(bf.carrier.x)},${R(bf.carrier.y)} hp${R(bf.carrier.hp)}`);
      if (rc && !st.r) console.log(`[F] t=${R(t)} RED picked by ${rf.carrier.playerName}(${rf.carrier.team}) @${R(rf.carrier.x)},${R(rf.carrier.y)} hp${R(rf.carrier.hp)}`);
      if (bc) { st.bRef = bf.carrier; pushH(st.hb, bf.carrier, bf.carrier.ai); }
      if (rc) { st.rRef = rf.carrier; pushH(st.hr, rf.carrier, rf.carrier.ai); }
      if (!bc && st.b) {
        const p = st.bRef || {};
        console.log(`[DEATH] t=${R(t)} BLUE flag lost @${R(p.x)},${R(p.y)} ${deathCtx(p, st.bRef, st.hb)}`);
        st.hb = [];
      }
      if (!rc && st.r) {
        const p = st.rRef || {};
        console.log(`[DEATH] t=${R(t)} RED flag lost @${R(p.x)},${R(p.y)} ${deathCtx(p, st.rRef, st.hr)}`);
        st.hr = [];
      }
      st.b = bc; st.r = rc;
    } catch (eF) {}
    const car = (bf && bf.carrier) || (rf && rf.carrier);
    if (!car) { continue; }
    const ai = car.ai || {};
    try { watch(ai, t); } catch (e) {}
    const b = car.body || {};
    let path = '';
    try {
      const p = ai._navPath || [];
      path = p.slice(0, 4).map((id) => {
        const n = sc._navGraph.nodes[id];
        return n ? `${Math.round(n.x)},${Math.round(n.y)}` : '?';
      }).join('>');
      if (p.length > 4) path += '..' + p.length;
    } catch (e) { path = 'ERR'; }
    const cc = ai._carryCorr || {};
    const bl = (b.blocked || {});
    const feet = (Number.isFinite(b.y) && Number.isFinite(b.height)) ? b.y + b.height : (car.y + 28);
    console.log(`[C] t=${R(t)} ${car.playerName} x=${R(car.x)} y=${R(car.y)} ft=${R(feet)} gr=${(bl.down || (b.touching && b.touching.down)) ? 1 : 0} hp=${R(car.hp)} ` +
      `src=${ai._dbgSrc || '-'} g=${R(ai._dbgGoalX)},${R(ai._dbgGoalY)} ` +
      `corr=${cc.corr || '-'} wx=${R(cc.wx)} wy=${R(cc.wy)} corrAge=${cc.at ? R(t - cc.at) : '-'} ` +
      `det=${R(ai._detourX)} detLeft=${ai._detourUntil ? R(ai._detourUntil - t) : '-'} setAt=${R(ai._detourSetAt)} ` +
      `stk=${(ai._detourStuck && ai._detourStuck.n) || 0} dl=${(ai._dropLatch && ai._dropLatch.until > t) ? 'Y' : '-'} ` +
      `navI=${ai._navI ?? '-'} path=${path || '-'} ` +
      `mv=${(ai.__mv || []).slice(-3).join(' ')} fj=${ai.__fj || 0} ` +
      `wedge=${ai._wedgeWhy || '-'} rev=${R(ai._stuckReverse)} hold=${(ai._holdMoveUntil || 0) > t ? 'Y' : '-'} ` +
      `bl=${(bl.left ? 'L' : '') + (bl.right ? 'R' : '') + (bl.down ? 'D' : '') + (bl.up ? 'U' : '') || '-'} ` +
      `v=${R(b.velocity && b.velocity.x)},${R(b.velocity && b.velocity.y)}`);
  }
  process.exit(0);
});

setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
