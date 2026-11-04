// tools/headless/campaign_stuck_probe.mjs — ловит ботов, которые не двигаются, и дампит их состояние.
// node --import ./tools/headless/register.mjs ./tools/headless/campaign_stuck_probe.mjs <levelIndex> [seconds]
import { createRequire } from 'node:module';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';

setupDom(1337);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { gameState } = await import('../../js/data/gameState.js');
const { navGraph, nearestNode, findPath, sim } = await import('../../js/ai/navMesh.js');

const idx = Number(process.argv[2] || 1);
const secs = Number(process.argv[3] || 30);
let t = 0;
function step(n = 1) { for (let i = 0; i < n; i++) { t += 1000 / 60; clock.now = t; game.headlessStep(t, 1000 / 60); } }
const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene]
});
gameState.demoMode = true;
const keep = setInterval(() => {}, 1000);
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
game.events.on('ready', () => {
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CAMPAIGN', levelIndex: idx, selectedClass: 'Assault', playerName: 'Probe', scoreLimit: 200 });
  const sc = game.scene.getScene('GameScene');
  gameState.demoMode = false;
  try { sc._storyOpen = false; sc._introDone = true; } catch (e) {}
  step(30);
  const throws = [];
  const friendly = [];
  for (const p of sc.players) {
    if (!p || typeof p.receiveDamage !== 'function') continue;
    const origRD = p.receiveDamage.bind(p);
    p.receiveDamage = (amount, attacker, src, zone) => {
      if (attacker && attacker !== p && attacker.team === p.team) {
        friendly.push({ t: Math.round(t / 1000), shooter: attacker.playerName, victim: p.playerName, team: p.team, carrier: !!(sc.blueFlag && sc.blueFlag.carrier === p) || !!(sc.redFlag && sc.redFlag.carrier === p), src: src || null, amount: Math.round(amount) });
      }
      return origRD(amount, attacker, src, zone);
    };
  }
  const origThrow = sc.throwGrenade.bind(sc);
  sc.throwGrenade = (owner, type, angle) => {
    let bd = 1e9;
    for (const o of sc.players) { if (!o || o.dead || o === owner || o.team === owner.team) continue; bd = Math.min(bd, Math.hypot(o.x - owner.x, o.y - owner.y)); }
    throws.push({ t: Math.round((t - 0) / 1000), who: owner.playerName, type, enemyDist: Math.round(bd) });
    return origThrow(owner, type, angle);
  };
  {
    const list = [];
    for (const grp of [sc.platforms, sc.covers]) {
      if (!grp || !grp.getChildren) continue;
      for (const o of grp.getChildren()) {
        const ob = o.body;
        if (!ob || !ob.enable) continue;
        if (ob.x < 1500 || ob.x > 1900) continue;
        list.push([grp === sc.covers ? 'C' : 'P', Math.round(ob.x), Math.round(ob.y), Math.round(ob.width), Math.round(ob.height)]);
      }
    }
    console.log('[LAYOUT]', JSON.stringify(list));
  }
  let reachDumped = false;
  const lastPos = new Map();
  const since = new Map();
  const reported = new Set();
  const moveSrc = new Map();
  for (const p of sc.players) {
    if (!p || !p.ai || typeof p.move !== 'function') continue;
    const orig = p.move.bind(p);
    p.move = (dir, ...rest) => {
      const st = (new Error().stack || '').split('\n').slice(2, 4).map(s => s.trim().replace(/^at /, '').slice(0, 90)).join(' | ');
      moveSrc.set(p, { dir, st });
      return orig(dir, ...rest);
    };
  }
  const frames = Math.round(secs * 60);
  const tiers = {};
  for (let f = 0; f < frames; f++) {
    step(1);
    if (f % 30 === 0) {
      for (const p of sc.players) {
        if (!p || p.dead || p.active === false || !p.body) continue;
        if (!(p.body.blocked.down || p.body.touching.down)) continue;
        const k = String(Math.round(p.body.bottom / 10) * 10);
        tiers[k] = (tiers[k] || 0) + 1;
      }
    }
    for (const p of sc.players) {
      if (!p || p === sc.player || p.dead || p.active === false) continue;
      const cur = { x: p.x, y: p.y };
      const prev = lastPos.get(p);
      if (!prev || Math.abs(prev.x - cur.x) > 4 || Math.abs(prev.y - cur.y) > 4) {
        lastPos.set(p, cur); since.set(p, t); continue;
      }
      const idle = t - since.get(p);
      if (idle > 5000 && !reported.has(p)) {
        reported.add(p);
        const b = p.body;
        const n = p.ai && p.ai._nav;
        const e = n && n.path ? n.path[n.i] : null;
        const rects = [];
        for (const grp of [sc.platforms, sc.covers]) {
          if (!grp || !grp.getChildren) continue;
          for (const o of grp.getChildren()) {
            const ob = o.body;
            if (!ob || !ob.enable) continue;
            if (ob.x < p.x + 80 && ob.x + ob.width > p.x - 80 && ob.y < p.y + 60 && ob.y + ob.height > p.y - 110) {
              rects.push([Math.round(ob.x), Math.round(ob.y), Math.round(ob.width), Math.round(ob.height)]);
            }
          }
        }
        {
          const g = navGraph(sc, (b.height > 75));
          const cx = b.x + b.width / 2;
          const st = nearestNode(g, cx, b.bottom, 20, 14);
          let nearAny = null, nd = 1e9;
          for (const n of g.nodes) { const d = Math.hypot(n.x - cx, n.y - b.bottom); if (d < nd) { nd = d; nearAny = n; } }
          const under = [];
          for (const grp of [sc.platforms, sc.covers]) { if (!grp || !grp.getChildren) continue; for (const o of grp.getChildren()) { const ob = o.body; if (ob && ob.enable && ob.x < cx + 60 && ob.x + ob.width > cx - 60 && ob.y < b.bottom + 40 && ob.y + ob.height > b.bottom - 140) under.push([Math.round(ob.x), Math.round(ob.y), Math.round(ob.width), Math.round(ob.height)]); } }
          console.log('[NODEDBG]', p.playerName, JSON.stringify({ cx: Math.round(cx), feet: Math.round(b.bottom), tall: b.height > 75, start: st ? [Math.round(st.x), Math.round(st.y)] : null, nearAny: nearAny ? [Math.round(nearAny.x), Math.round(nearAny.y), Math.round(nd)] : null, under }));
        }
        const ms = moveSrc.get(p);
        console.log('[NEAR]', p.playerName, JSON.stringify(rects));
        console.log('[MOVE]', p.playerName, JSON.stringify(ms ? { dir: ms.dir, st: ms.st } : null));
        {
          const g = navGraph(sc, (b.height > 75));
          const cx = b.x + b.width / 2;
          const st = nearestNode(g, cx, b.bottom, 20, 14);
          const goalNode = p.ai && p.ai._nav && p.ai._nav.goal != null ? g.nodes[p.ai._nav.goal] : null;
          const path = st && goalNode ? findPath(g, st, goalNode, new Set()) : null;
          if (!reachDumped && st) {
            reachDumped = true;
            const seen = new Set([st.id]); const q = [st];
            while (q.length) { const u = q.shift(); for (const e of u.edges) if (!seen.has(e.to.id)) { seen.add(e.to.id); q.push(e.to); } }
            const ys = {}; for (const id of seen) { const n = g.nodes[id]; const k = Math.round(n.y); ys[k] = (ys[k] || 0) + 1; }
            const kinds = {}; for (const n of g.nodes) for (const e of n.edges) { const k = e.type + (e.low ? '_low' : '') + (e.dbl ? '2' : ''); kinds[k] = (kinds[k] || 0) + 1; }
            console.log('[REACH]', p.playerName, 'tall', !!(b.height > 75), 'reachable', seen.size, 'of', g.nodes.length, 'byY', JSON.stringify(ys), 'edgeKinds', JSON.stringify(kinds));
            const near = g.nodes.filter(n => Math.abs(n.x - st.x) < 260 && Math.abs(n.y - st.y) < 2).map(n => [Math.round(n.x), n.edges.length]);
            const rr = [];
            for (const grp of [sc.platforms, sc.covers]) { if (!grp || !grp.getChildren) continue; for (const o of grp.getChildren()) { const ob = o.body; if (ob && ob.enable && ob.x < st.x + 260 && ob.x + ob.width > st.x - 260 && ob.y < 900 && ob.y + ob.height > 600) rr.push([Math.round(ob.x), Math.round(ob.y), Math.round(ob.width), Math.round(ob.height)]); } }
            console.log('[NEARNODES]', JSON.stringify(near));
            console.log('[RECTS]', JSON.stringify(rr));
            console.log('[STARTEDGES]', JSON.stringify(st.edges.map(e => [e.type, Math.round(e.to.x), Math.round(e.to.y), !!e.low])));
            const loc = rr.map(r => ({ x0: r[0], x1: r[0] + r[2], y0: r[1], y1: r[1] + r[3] }));
            const floorNodes = g.nodes.filter(n => n.y === 850 && Math.abs(n.x - st.x) < 250);
            const tries = [];
            for (const fn of floorNodes.slice(0, 6)) {
              let ok = null;
              for (let T = 0.2; T <= 1.3 && ok === null; T += 0.05) { const vx = (fn.x - st.x) / T; if (Math.abs(vx) > 250) continue; if (sim(loc, st.x, st.y, vx, 0, 92, fn.x, fn.y, false)) ok = T; }
              tries.push([Math.round(fn.x), ok]);
            }
            console.log('[FALLTRY]', JSON.stringify({ floorNodes: floorNodes.length, tries }));
            const lowTries = [];
            for (const fx of [1635, 1600, 1545]) {
              let ok = null;
              for (let T = 0.2; T <= 1.3 && ok === null; T += 0.05) { const vx = (fx - st.x) / T; if (Math.abs(vx) > 250) continue; if (sim(loc, st.x, st.y, vx, 0, 62, fx, 850, false)) ok = T; }
              lowTries.push([fx, ok]);
            }
            console.log('[LOWFALL]', JSON.stringify(lowTries), 'crouching', !!p.crouching, 'canCrouchBodyH', Math.round(b.height));
          }
          console.log('[PATH]', p.playerName, JSON.stringify({ start: st ? [st.id, Math.round(st.x), Math.round(st.y)] : null, nodes: g.nodes.length, goal: goalNode ? [goalNode.id, Math.round(goalNode.x), Math.round(goalNode.y)] : null, pathLen: path ? path.length : null, navCd: p.ai ? Math.round(p.ai._navCd - t) : null, feet: Math.round(b.bottom) }));
        }
        console.log('[STUCK]', JSON.stringify({
          who: p.playerName, team: p.team, t: Math.round(t / 1000),
          x: Math.round(p.x), y: Math.round(p.y), w: b.width, h: b.height,
          vx: Math.round(b.velocity.x), vy: Math.round(b.velocity.y),
          down: !!b.blocked.down, up: !!b.blocked.up, left: !!b.blocked.left, right: !!b.blocked.right,
          crouch: !!p.isCrouching,
          edge: e ? { type: e.type, dbl: !!e.dbl, vert: !!e.vert, from: [Math.round(e.from.x), Math.round(e.from.y)], to: [Math.round(e.to.x), Math.round(e.to.y)] } : null,
          navI: n ? n.i : null, navLen: n && n.path ? n.path.length : null, phase: n ? n.phase : null,
          reason: p.ai ? p.ai._navReason : null, fails: p.ai ? p.ai._navFails : null,
          hasAI: !!p.ai, hopClamp: p.ai ? p.ai._hopSkipClamp : null,
          enemy: (() => { let best = null, bd = 1e9; for (const o of sc.players) { if (!o || o.dead || o === p || o.team === p.team) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } } return best ? { d: Math.round(bd), dy: Math.round(best.y - p.y), los: !!sc.hasLineOfSight(p.x, p.y, best.x, best.y), range: p.weapon ? p.weapon.range : null } : null; })()
        }));
      }
    }
  }
  console.log('[TIERS]', JSON.stringify(tiers));
  console.log('[DONE] stuck=' + reported.size + ' of players=' + sc.players.length);
  console.log('[THROWS]', JSON.stringify(throws));
  console.log('[FRIENDLY]', JSON.stringify(friendly.slice(0, 20)), 'total', friendly.length);
  clearInterval(keep);
  process.exit(0);
});
