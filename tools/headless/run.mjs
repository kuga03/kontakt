// run.mjs — точка входа headless-харнесса.
// Запуск:
//   node --import ./tools/headless/register.mjs ./tools/headless/run.mjs \
//        --ticks 6000 --seed 1337 [--verbose] [--out metrics.json]
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { collectMetrics, teamFitness } from './metrics.mjs';
import { TACTICS } from '../../js/ai/tactics.js';
import { gameState } from '../../js/data/gameState.js';

function deepMerge(base, over) {
  for (const k of Object.keys(over)) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
        base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], over[k]);
    } else {
      base[k] = over[k];
    }
  }
  return base;
}

const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
}
// 18000 = 300с — реальная длина CTF при scoreLimit=3 (CTF_TIME_BY_LIMIT).
// 6000 (100с) обрезал матч втрое и давал ложные «доставки нет».
const TICKS = parseInt(arg('ticks', '18000'), 10);
const SEED = parseInt(arg('seed', '1337'), 10);
const VERBOSE = argv.includes('--verbose');
const OUT = arg('out', null);
const TACTICS_FILE = arg('tactics', null);
const MAP_FILE = arg('map', 'maps/ctf.json');

setupDom(SEED);
const clock = setupClock();

globalThis.Phaser = require('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
// k519 (только замер, поведение не меняется): штамп времени последнего вызова
// движения. Нужен, чтобы отделить «стоит, потому что никто не ведёт» от
// «стоит по роли/на прицеле». Патчим ТОТ ЖЕ экземпляр модуля (?v=191) — иначе
// патч прототипа молча не сработает (грабли §1.8 п.2).
try {
  const { default: _EnemyAI } = await import('../../js/ai/EnemyAI.js');
  const _P = _EnemyAI.prototype;
  const _oMV = _P.moveToward;
  if (typeof _oMV === 'function' && !_P.__movStamp) {
    _P.__movStamp = true;
    _P.moveToward = function (...a) {
      try { this._movAt = (this.scene && this.scene.time && Number.isFinite(this.scene.time.now)) ? this.scene.time.now : 0; } catch (e) {}
      return _oMV.apply(this, a);
    };
  }
} catch (e) {}
// k471: считаем ВСЕ срабатывания коллайдеров с участием бойца — на уровне
// фабрики, чтобы покрыть все ветки спавна (прошлый счётчик висел только на
// одной и давал ложный ноль). Только диагностика.
try {
  const _F = Phaser.Physics.Arcade.Factory.prototype;
  const _orig = _F.collider;
  _F.collider = function (o1, o2, cb, ctx) {
    const wrapped = function (a, b) {
      try {
        const f = (a && a.playerName) ? a : ((b && b.playerName) ? b : null);
        if (f) {
          f._hits = (f._hits | 0) + 1;
          const other = (f === a) ? b : a;
          const sc = f.scene;
          if (sc && sc.covers && other &&
              (other === sc.covers || (sc.covers.contains && sc.covers.contains(other)))) {
            f._coverHits = (f._coverHits | 0) + 1;
          }
        }
      } catch (e) {}
      return (typeof cb === 'function') ? cb(a, b) : true;
    };
    return _orig.call(this, o1, o2, wrapped, ctx);
  };
} catch (e) {}
stubAssets(Phaser);
try { if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]); } catch (e) {}

if (TACTICS_FILE) {
  try {
    let ov = JSON.parse(readFileSync(TACTICS_FILE, 'utf8'));
    if (ov && ov.tactics && typeof ov.tactics === 'object') ov = ov.tactics; // evolve.mjs пишет {fitness,tactics}
    deepMerge(TACTICS, ov);
    console.log('[headless] tactics overridden from', TACTICS_FILE);
  } catch (e) { console.log('[headless] tactics override fail', e.message); }
}

const { default: GameScene } = await import('../../js/scenes/GameScene.js');

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

// Демо-режим: игроком управляет ИИ — полноценный ботовый матч (все 10 — ИИ).
// Без него CTF-логика частично рассчитана на живого игрока, и боты не крадут.
gameState.demoMode = true;
console.log('[headless] demoMode set =', gameState.demoMode);

const CTF_DATA = {
  mode: 'CTF',
  selectedClass: 'Assault',
  playerName: 'Headless',
  scoreLimit: 3,
  suddenStart: false,
};

// k477: физически честный счётчик перекрытия «тело ↔ укрытие».
// Считаем его на входе шага физики (Body.preUpdate), где позиция тела уже
// пересчитана из спрайта — то есть ровно та геометрия, с которой работает
// Arcade. Это отличается от [pen] (сэмпл после scene.update): там тело
// живёт в «мёртвом окне» до следующего preUpdate и показывает старый
// прямоугольник при новых height/offset (см. docs §17).
const PHYS_PEN = { events: 0, ticks: 0, maxOv: 0, maxDur: 0, bots: {} };
const _physWas = new Map();
const _physEp = new Map();
function installPhysPen() {
  try {
    const BP = Phaser.Physics.Arcade.Body.prototype;
    if (BP.__physPenHooked) return;
    BP.__physPenHooked = true;
    const orig = BP.preUpdate;
    BP.preUpdate = function (willStep, delta) {
      const r = orig.call(this, willStep, delta);
      try {
        const p = this.gameObject;
        if (p && p.playerName && p.isAI && !p.dead) {
          const sc = p.scene;
          let ov = null;
          for (const c of (sc && sc.covers ? sc.covers.getChildren() : [])) {
            const cb = c && c.body;
            if (!cb) continue;
            if (this.x < cb.x + cb.width && this.x + this.width > cb.x &&
                this.y < cb.y + cb.height && this.y + this.height > cb.y) {
              const ox = Math.min(this.x + this.width, cb.x + cb.width) - Math.max(this.x, cb.x);
              const oy = Math.min(this.y + this.height, cb.y + cb.height) - Math.max(this.y, cb.y);
              if (ox > 0.5 && oy > 0.5) { ov = { ox, oy }; break; }
            }
          }
          const nm = p.playerName;
          if (ov) {
            PHYS_PEN.ticks++;
            if (ov.oy > PHYS_PEN.maxOv) PHYS_PEN.maxOv = +ov.oy.toFixed(1);
            if (!_physWas.get(nm)) {
              PHYS_PEN.events++;
              PHYS_PEN.bots[nm] = (PHYS_PEN.bots[nm] || 0) + 1;
              _physEp.set(nm, { n: 0 });
            }
            const e = _physEp.get(nm);
            if (e) { e.n++; if (e.n > PHYS_PEN.maxDur) PHYS_PEN.maxDur = e.n; }
            _physWas.set(nm, true);
          } else {
            _physWas.set(nm, false);
            _physEp.delete(nm);
          }
        }
      } catch (e) {}
      return r;
    };
  } catch (e) { console.log('[headless] physPen hook fail', e.message); }
}

function stepMatch() {
  const t0 = process.hrtime.bigint();
  let t = 0;
  let ticks = 0;
  const fe = { bluePickup: 0, redPickup: 0, blueCarried: false, redCarried: false, blueMaxX: 0, redMinX: 1e9, minBlue: 1e9, minRed: 1e9 };
  let _navDumped = false;
  for (let i = 0; i < TICKS; i++) {
    ticks = i + 1;
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    const sc = game.scene.getScene('GameScene');
    // «Стоит на месте»: жив, на земле, скорость ~0. Считаем по каждому боту:
    // всего тиков / из них простой / текущая и максимальная серия простоя.
    if (sc && sc.players) {
      for (const p of sc.players) {
        if (!p || p.dead || p.active === false || !p.isAI) continue;
        const b = p.body;
        if (!b) continue;
        const grounded = !!(b.blocked?.down || b.touching?.down);
        const vx = Math.abs((b.velocity && b.velocity.x) || 0);
        const vy = Math.abs((b.velocity && b.velocity.y) || 0);
        const st = p._idleStat || (p._idleStat = { ticks: 0, idle: 0, run: 0, maxRun: 0 });
        st.ticks++;
        // k473: кольцевой буфер последних кадров. На входе в ящик покажет,
        // КАКОЙ кадр создал перекрытие: скачок позиции/размера/offset.
        try {
          const pb0 = p.body;
          const rb = p._ring || (p._ring = []);
          rb.push([Math.round(t), Math.round(pb0.x), Math.round(pb0.y),
            Math.round(pb0.width), Math.round(pb0.height),
            Math.round(pb0.velocity.x), Math.round(pb0.velocity.y),
            p.crouching ? 1 : 0, Math.round(pb0.offset.x), Math.round(pb0.offset.y),
            Math.round(p.x), Math.round(p.y)]);
          if (rb.length > 90) rb.shift();
        } catch (eR) {}
        // k465: тело ВНУТРИ укрытия (ящика) — проверка жалобы «залез в текстуру».
        // k477: классификация — сменилась ли стойка на этом же тике. Замер
        // (diag_phantom) показал: все такие входы исчезают на следующем
        // Body.preUpdate, т.е. это «мёртвое окно» смены стойки, а не движение.
        const _stanceChanged = (p._prevCrouch !== undefined) && (p._prevCrouch !== !!p.crouching);
        p._prevCrouch = !!p.crouching;
        try {
          const _cov = sc.covers ? sc.covers.getChildren() : [];
          const pb = p.body;
          for (const c of _cov) {
            const cb = c && c.body;
            if (!cb) continue;
            if (pb.x < cb.x + cb.width && pb.x + pb.width > cb.x &&
                pb.y < cb.y + cb.height && pb.y + pb.height > cb.y) {
              st.clip = (st.clip || 0) + 1;
              // k468: пишем ТОЛЬКО кадр ВХОДА (переход снаружи -> внутри):
              // последующие кадры показывают лишь следствие.
              try {
                const logs = sc._penLog || (sc._penLog = []);
                // k477: критерий (принят пользователем 2026-10-22):
                //   глубокий вход (обе оси > 2px) БЕЗ смены стойки = дефект.
                // Глубокие со сменой стойки — «мёртвое окно» движка
                // (доказано diag_phantom: 25/25 исчезают на preUpdate).
                const ovX = Math.min(pb.x + pb.width, cb.x + cb.width) - Math.max(pb.x, cb.x);
                const ovY = Math.min(pb.y + pb.height, cb.y + cb.height) - Math.max(pb.y, cb.y);
                const _deep = (ovX > 2 && ovY > 2);
                if (!st._wasClip) {
                  if (_deep) {
                    sc._penCount = (sc._penCount || 0) + 1;   // все глубокие входы
                    if (_stanceChanged) sc._penStance = (sc._penStance || 0) + 1;
                    else sc._penUnexpl = (sc._penUnexpl || 0) + 1;  // ← критерий
                    if (sc._penBots) sc._penBots[p.playerName] = (sc._penBots[p.playerName] || 0) + 1;
                    else sc._penBots = { [p.playerName]: 1 };
                  } else {
                    sc._penThin = (sc._penThin || 0) + 1;    // тонкие касания (≤2px)
                  }
                }
                if (_deep && !st._wasClip &&
                    (logs.length < 12 || logs.filter((x) => !x.stance).length < 40)) {
                  if (!sc._penDump) {
                      sc._penDump = { who: p.playerName, ring: (p._ring || []).slice(-45) };
                    }
                    const pv = pb.prev || {};
                    logs.push({
                      t: Math.round(t), who: p.playerName, ai: !!p.isAI, crouch: !!p.crouching,
                      stance: _stanceChanged,
                      body: [Math.round(pb.x), Math.round(pb.y), Math.round(pb.width), Math.round(pb.height)],
                      prev: [Math.round(pv.x ?? NaN), Math.round(pv.y ?? NaN)],
                      sprite: [Math.round(p.x), Math.round(p.y)],
                      vel: [Math.round(pb.velocity.x), Math.round(pb.velocity.y)],
                      off: [Math.round(pb.offset.x), Math.round(pb.offset.y)],
                      blocked: (pb.blocked.down ? 'D' : '') + (pb.blocked.left ? 'L' : '') +
                        (pb.blocked.right ? 'R' : '') + (pb.blocked.up ? 'U' : ''),
                      touching: (pb.touching.down ? 'd' : '') + (pb.touching.left ? 'l' : '') +
                        (pb.touching.right ? 'r' : '') + (pb.touching.up ? 'u' : ''),
                      crate: [Math.round(cb.x), Math.round(cb.y), Math.round(cb.width), Math.round(cb.height)],
                      ov: [Math.round(ovX), Math.round(ovY)],
                      onGround: !!(pb.blocked.down || pb.touching.down),
                      hits: p._coverHits | 0,
                      hitsAll: p._hits | 0,
                      // k469: флаги коллизий — если у тела выключен
                      // checkCollision, разделение не выполняется ВООБЩЕ.
                      pFlags: [pb.physicsType, pb.enable ? 1 : 0,
                        (pb.checkCollision.none ? 'N' : '') + (pb.checkCollision.up ? 'U' : '') +
                        (pb.checkCollision.down ? 'D' : '') + (pb.checkCollision.left ? 'L' : '') +
                        (pb.checkCollision.right ? 'R' : '')].join('|'),
                      cFlags: [cb.physicsType, cb.enable ? 1 : 0,
                        (cb.checkCollision.none ? 'N' : '') + (cb.checkCollision.up ? 'U' : '') +
                        (cb.checkCollision.down ? 'D' : '') + (cb.checkCollision.left ? 'L' : '') +
                        (cb.checkCollision.right ? 'R' : '')].join('|'),
                      // k469: сколько активных коллайдеров вообще есть у этого
                      // бойца — если 0, причина найдена (коллайдер не повешен).
                      cols: (() => {
                        try {
                          let n = 0;
                          const list = sc.physics.world.colliders.getActive();
                          for (const c of list) {
                            if (c.object1 === p || c.object2 === p ||
                                (c.object1 === sc.covers) || (c.object2 === sc.covers)) n++;
                          }
                          return n;
                        } catch (eC) { return -1; }
                      })(),
                    });
                  }
                st._wasClip = true;
              } catch (eP) {}
              break;
            } else {
              st._wasClip = false;
            }
          }
        } catch (eC) {}
        if (grounded && vx < 15 && vy < 15) {
          st.idle++; st.run++;
          if (st.run > st.maxRun) st.maxRun = st.run;
          // k519: различение простоя по владельцу движения.
          //   noMove — движение не звали >0.8с (никто не ведёт);
          //   dead   — из них ещё и врага не видно (не «держу фланг», а забыли).
          try {
            const _a0 = p.ai || {};
            const _mvAgo = Number.isFinite(_a0._movAt) ? (t - _a0._movAt) : 1e9;
            if (_mvAgo > 800) {
              st.idleNoMove = (st.idleNoMove || 0) + 1;
              const _sn = _a0._seenCache;
              if (!_sn || !_sn.length) st.idleDead = (st.idleDead || 0) + 1;
            } else {
              // k520: движение звали только что, а бот стоит — по какому вето.
              // Это и есть класс arrived/deadband/hold/latch, куда бить.
              const _vt = String(_a0._dbgVeto || (_a0._dbgDir === 0 ? 'dir0' : '-'));
              const _bv = st.byVeto || (st.byVeto = {});
              _bv[_vt] = (_bv[_vt] || 0) + 1;
            }
          } catch (e) {}
          // В каком режиме бот простаивает — ключ к причине.
          const _ms = (p.ai && p.ai._dbgSrc) || '?';
          const _bs = st.bySrc || (st.bySrc = {});
          _bs[_ms] = (_bs[_ms] || 0) + 1;
          // k454: длинный простой — печатаем состояние каждые 3с серии,
          // чтобы увидеть ПРИЧИНУ (цель/направление/вето/защёлки).
          if (st.run >= 180 && st.run % 180 === 0) {
            const a = p.ai || {};
            console.log(`[idle] t=${Math.round(t)} ${p.playerName}(${p.team}) x=${Math.round(p.x)} y=${Math.round(p.y)}` +
              ` run=${Math.round(st.run / 60 * 1000)}ms src=${_ms}` +
              ` g=${Math.round(a._dbgGoalX ?? -1)},${Math.round(a._dbgGoalY ?? -1)}` +
              ` tar=${Math.round(a._dbgTar ?? -1)}` +
              ` dir=${a._dbgDir ?? '-'} veto=${a._dbgVeto ?? '-'}` +
              ` nav=${a._navPath ? a._navPath.length : '-'} det=${a._detourX != null ? Math.round(a._detourX) : '-'}` +
              ` latch=${a._nearLatch ? 1 : 0} hh=${a._hhStopSince ? 1 : 0} drop=${a._dropLatch ? 1 : 0}` +
              ` hold=${a._holdMoveUntil ? 1 : 0}`);
          }
        } else st.run = 0;
      }
    }
    // k463: геометрия тело/спрайт по направлению взгляда. Если тело не
    // зеркалится при развороте, эффект попадания «съезжает» в сторону стрелка —
    // ровно симптом «пуля не долетает до персонажа при стрельбе в спину».
    if (sc && sc.players && t > 6000) {
      for (const p of sc.players) {
        if (!p || !p.body) continue;
        const st = p._geomStat || (p._geomStat = {});
        const f = p.flipX ? 'L' : 'R';
        if (!st[f]) {
          st[f] = 1;
          const b = p.body;
          // Реальные границы РИГА (персонаж рисуется частями, а displayWidth
          // спрайта — только базовый плейсхолдер 32px).
          let rL = Infinity, rR = -Infinity, rT = Infinity, rB = -Infinity;
          try {
            const parts = [p.head, p.neck, p.torso, p.legs, p.legsRun, p.armGun, p.armFront,
              p.headImg, p.capImg, p.shoeL, p.shoeR];
            for (const o of parts) {
              if (!o || o.active === false) continue;
              const dw = o.displayWidth || 0, dh = o.displayHeight || 0;
              if (!dw && !dh) continue;
              const ox = (o.originX == null) ? 0.5 : o.originX;
              const oy = (o.originY == null) ? 0.5 : o.originY;
              rL = Math.min(rL, o.x - dw * ox); rR = Math.max(rR, o.x + dw * (1 - ox));
              rT = Math.min(rT, o.y - dh * oy); rB = Math.max(rB, o.y + dh * (1 - oy));
            }
          } catch (eG) {}
          const rigStr = rL === Infinity ? 'rig=?' :
            `rig L=${Math.round(rL)} R=${Math.round(rR)} w=${Math.round(rR - rL)} cx-sprX=${Math.round((rL + rR) / 2 - p.x)}` +
            ` T=${Math.round(rT)} B=${Math.round(rB)} h=${Math.round(rB - rT)} cy-sprY=${Math.round((rT + rB) / 2 - p.y)}`;
          console.log(`[geom2] ${p.playerName}${p.isAI ? '(AI)' : '(P)'} face=${f}` +
            ` sprX=${Math.round(p.x)} sprY=${Math.round(p.y)} offX=${b.offset ? Math.round(b.offset.x) : '?'} sc=${(p.scaleX ?? 1).toFixed(3)}` +
            ` | body L=${Math.round(b.x)} R=${Math.round(b.x + b.width)} w=${Math.round(b.width)}` +
            ` T=${Math.round(b.y)} B=${Math.round(b.y + b.height)} h=${Math.round(b.height)}` +
            ` cx-sprX=${Math.round(b.x + b.width / 2 - p.x)} | ${rigStr}`);
        }
      }
    }
    if (!_navDumped && sc && sc._navGraph && sc._navGraph.nodes && sc._navGraph.nodes.length) {      _navDumped = true;
      const g = sc._navGraph;
      // --navdump x0,x1,y0,y1 — прямоугольник; по умолчанию угол C1.
      const nd = (arg('navdump', '0,400,400,900') || '').split(',').map(Number);
      const [nx0, nx1, ny0, ny1] = nd.length === 4 && nd.every(Number.isFinite)
        ? nd : [0, 400, 400, 900];
      const near = g.nodes.map((n, idx) => ({ ...n, idx }))
        .filter((n) => n.x >= nx0 && n.x <= nx1 && n.y >= ny0 && n.y <= ny1)
        .sort((a, b) => a.x - b.x || a.y - b.y);
      console.log('[navdump] total nodes', g.nodes.length,
        'rect', [nx0, nx1, ny0, ny1].join(','),
        'nodes:', near.map((n) => `${n.idx}:${Math.round(n.x)},${Math.round(n.y)}`).join(' '));
      try {
        const bs = (sc.players || []).map((p) => {
          const k = (p && typeof p._rigHitboxK === 'function') ? p._rigHitboxK() : 1;
          return `${p.playerName}:${p.isAI ? 'AI' : 'P'}:k=${Number(k).toFixed(2)}:${Math.round(p.body ? p.body.width : 0)}x${Math.round(p.body ? p.body.height : 0)}`;
        });
        console.log('[navdump] bodies', bs.join(' '));
      } catch (e) {}
      // --navcheck x0,y0,x1,y1 — есть ли путь по графу между точками.
      const _nc = arg('navcheck', null);
      if (_nc) {
        const q = _nc.split(',').map(Number);
        if (q.length === 4 && q.every(Number.isFinite)) {
          const nearNode = (x, y) => {
            let bi = -1, bd = Infinity;
            g.nodes.forEach((n, i) => {
              const d = Math.abs(n.x - x) + Math.abs(n.y - y) * 0.5;
              if (d < bd) { bd = d; bi = i; }
            });
            return bi;
          };
          const a = nearNode(q[0], q[1]), b = nearNode(q[2], q[3]);
          const prev = new Array(g.nodes.length).fill(-1);
          const seen = new Uint8Array(g.nodes.length);
          const qq = [a]; seen[a] = 1;
          for (let h = 0; h < qq.length && !seen[b]; h++) {
            const cur = qq[h];
            for (const nb of (g.links[cur] || [])) {
              if (!seen[nb]) { seen[nb] = 1; prev[nb] = cur; qq.push(nb); }
            }
          }
          if (!seen[b]) {
            console.log(`[navcheck] ${q[0]},${q[1]} -> ${q[2]},${q[3]}: NO PATH (from ${a} to ${b})`);
          } else {
            const p = [];
            for (let c = b; c >= 0; c = prev[c]) { p.unshift(c); if (c === a) break; }
            console.log(`[navcheck] ${q[0]},${q[1]} -> ${q[2]},${q[3]}: ${p.length} hops | ` +
              p.map((i) => `${i}:${Math.round(g.nodes[i].x)},${Math.round(g.nodes[i].y)}`).join(' '));
          }
        }
      }
      // --navcomp [x,y;x,y] — компоненты связности графа.
      const _ncomp = arg('navcomp', null);
      if (_ncomp != null) {
        const N0 = g.nodes.length;
        const comp = new Int32Array(N0).fill(-1);
        const info = [];
        for (let i0 = 0; i0 < N0; i0++) {
          if (comp[i0] >= 0) continue;
          const cid = info.length;
          const q0 = [i0]; comp[i0] = cid;
          let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
          for (let h0 = 0; h0 < q0.length; h0++) {
            const cur = q0[h0], nd0 = g.nodes[cur];
            minx = Math.min(minx, nd0.x); maxx = Math.max(maxx, nd0.x);
            miny = Math.min(miny, nd0.y); maxy = Math.max(maxy, nd0.y);
            for (const nb of (g.links[cur] || [])) {
              if (comp[nb] < 0) { comp[nb] = cid; q0.push(nb); }
            }
          }
          info.push({ size: q0.length, minx: Math.round(minx), maxx: Math.round(maxx), miny: Math.round(miny), maxy: Math.round(maxy) });
        }
        console.log('[navcomp] ' + info.map((c, i) => `#${i}:${c.size}@${c.minx}..${c.maxx},${c.miny}..${c.maxy}`).join(' | '));
        for (const pair of String(_ncomp).split(';')) {
          const q = pair.split(',').map(Number);
          if (q.length !== 2 || !q.every(Number.isFinite)) continue;
          let bi = -1, bd = Infinity;
          g.nodes.forEach((n, i) => {
            const d = Math.abs(n.x - q[0]) + Math.abs(n.y - q[1]) * 0.5;
            if (d < bd) { bd = d; bi = i; }
          });
          console.log(`[navcomp] point ${q[0]},${q[1]} -> node ${bi}:${Math.round(g.nodes[bi].x)},${Math.round(g.nodes[bi].y)} comp #${comp[bi]} size ${info[comp[bi]].size}`);
        }
      }
      const solid = (x, y) => {
        try { return typeof sc._inSolid === 'function' ? sc._inSolid(x, y, 6) : false; } catch (e) { return false; }
      };
      for (const n of near) {
        const ls = (g.links[n.idx] || []).map((j) => {
          const m = g.nodes[j];
          if (!m) return `${j}:?`;
          const bits = [0.3, 0.55, 0.8].map((t) =>
            solid(n.x + (m.x - n.x) * t, n.y + (m.y - n.y) * t) ? '1' : '0').join('');
          return `${j}:${Math.round(m.x)},${Math.round(m.y)}/${bits}`;
        });
        console.log(`[navdump] node ${n.idx} (${Math.round(n.x)},${Math.round(n.y)}) -> ${ls.join(' | ')}`);
      }
    }
    if (sc && sc.blueFlag) {
      const bf = sc.blueFlag, rf = sc.redFlag;
      const _wasB = fe.blueCarried, _wasR = fe.redCarried;
      if (bf.carrier && !_wasB) { fe.bluePickup++; console.log(`[flag] t=${Math.round(t)} BLUE flag picked by ${bf.carrier.playerName}(${bf.carrier.team})`); }
      if (rf.carrier && !_wasR) { fe.redPickup++; console.log(`[flag] t=${Math.round(t)} RED flag picked by ${rf.carrier.playerName}(${rf.carrier.team})`); }
      if (!bf.carrier && _wasB) console.log(`[flag] t=${Math.round(t)} BLUE flag dropped/returned @${Math.round(bf.x)},${Math.round(bf.y)}`);
      if (!rf.carrier && _wasR) console.log(`[flag] t=${Math.round(t)} RED flag dropped/returned @${Math.round(rf.x)},${Math.round(rf.y)}`);
      // Диагностика носителя: hp, эскорт (синие в 300px), состояние ИИ.
      const _carr = bf.carrier || rf.carrier;
      if (_carr && _carr.team === 'blue' && (i + 1) % 300 === 0) {
        let escort = 0, escMode = 0;
        for (const p of sc.players) {
          if (!p || p === _carr || p.dead || p.team !== 'blue') continue;
          // Радиус 450, а не 300: якорь эскорта (escort.lead + side) стоит на
          // ~380px ВПЕРЕДИ носильщика, поэтому старый радиус 300 показывал
          // escort=0 у исправно работающего эскорта — отсюда ложный вывод
          // «никто не эскортирует» (docs §4.3.1). escMode — сколько реально
          // в режиме ctfEscort, независимо от дистанции.
          const _d = Math.hypot(p.x - _carr.x, p.y - _carr.y);
          if (_d < 450) escort++;
          if (p.ai && p.ai._dbgSrc === 'ctfEscort') escMode++;
        }
        const blues = sc.players.filter((p) => p && p.team === 'blue' && !p.dead && p !== _carr);
        const bstr = blues.map((p) => {
          const a = p.ai;
          const bd = p.body;
          const blk = bd ? ((bd.blocked?.left ? 'L' : '') + (bd.blocked?.right ? 'R' : '') + (bd.blocked?.up ? 'U' : '') + (bd.blocked?.down ? 'D' : '')) : '?';
          const nav = a && a._navPath ? a._navPath.length : '-';
          const det = a && a._detourX != null ? Math.round(a._detourX) : '-';
          return `${p.playerName}:${Math.round(p.x)},${Math.round(p.y)}[${a ? a._dbgSrc : '-'} g${Math.round(a?._dbgGoalX ?? -1)} blk${blk} nav${nav} det${det}]`;
        }).join(' ');
        const _home = _carr.team === 'blue' ? sc.blueFlag : sc.redFlag;
        const _homeAtBase = _home && Math.hypot(_home.x - _home.baseX, _home.y - _home.baseY) <= 60;
        const _gC = sc._navGraph;
        let _pC = 'none';
        try {
          if (_carr.ai && _carr.ai._navPath && _gC) {
            const _iC = _carr.ai._navI || 0;
            _pC = _carr.ai._navPath.map((j, k) => `${k === _iC ? '*' : ''}${Math.round(_gC.nodes[j].x)},${Math.round(_gC.nodes[j].y)}`).join(' ');
          }
        } catch (eC) { _pC = 'err'; }
        console.log(`[carry] t=${Math.round(t)} ${_carr.playerName} x=${Math.round(_carr.x)} y=${Math.round(_carr.y)} hp=${Math.round(_carr.hp)} escort=${escort} escMode=${escMode} src=${_carr.ai ? _carr.ai._dbgSrc : '-'} det=${_carr.ai && _carr.ai._detourX != null ? Math.round(_carr.ai._detourX) : '-'} navI=${_carr.ai ? _carr.ai._navI ?? '-' : '-'} home=${_home ? Math.round(_home.x) + ',' + Math.round(_home.y) : '?'}@base${_homeAtBase ? 'Y' : 'N'} dx=${_home ? Math.round(Math.abs(_carr.x - _home.x)) : '?'} dy=${_home ? Math.round(Math.abs(_carr.y - _home.y)) : '?'} path=${_pC} | ${bstr}`);
      }
      fe.blueCarried = !!bf.carrier;
      if (bf.carrier) fe.blueMaxX = Math.max(fe.blueMaxX, bf.x);
      fe.redCarried = !!rf.carrier;
      if (rf.carrier) fe.redMinX = Math.min(fe.redMinX, rf.x);
      // Насколько близко ИИ-боты подходили к вражескому флагу.
      if (sc.players) {
        for (const p of sc.players) {
          if (!p || !p.isAI) continue;
          if (p.team === 'blue' && rf) fe.minBlue = Math.min(fe.minBlue, Math.abs(p.x - rf.x) + Math.abs(p.y - rf.y));
          else if (p.team === 'red' && bf) fe.minRed = Math.min(fe.minRed, Math.abs(p.x - bf.x) + Math.abs(p.y - bf.y));
        }
      }
    }
    if (VERBOSE && (i + 1) % 300 === 0) {
      const _scT = game.scene.getScene('GameScene');
      const _blT = (_scT.players || []).filter((p) => p && p.isAI && p.team === 'blue' && !p.dead);
      console.log(`[trace ${i + 1}] ` + _blT.map((p) => `${p.playerName}:${Math.round(p.x)},${Math.round(p.y)}[${p.ai ? p.ai._dbgSrc : '-'} n${p.ai && p.ai._navPath ? p.ai._navPath.length : '-'}i${p.ai ? p.ai._navI ?? '-' : '-'} d${p.ai && p.ai._detourX != null ? Math.round(p.ai._detourX) : '-'}]`).join(' '));
    }
    if (VERBOSE && (i + 1) % 600 === 0) {
      const sc = game.scene.getScene('GameScene');
      const f = (x) => (x ? `${x.state}@${Math.round(x.x)},${Math.round(x.y)}` : 'null');
      const carr = (x) => (x && x.carrier ? x.carrier.playerName + '(' + x.carrier.team + ')@' + Math.round(x.carrier.x) : '-');
      const bots = (sc.players || []).filter((p) => p.isAI);
      const bp = bots.slice(0, 5).map((p) => {
        const ai = p.ai;
        return `${p.team[0]}${p.playerName}:${Math.round(p.x)},${Math.round(p.y)}[${ai ? ai._dbgSrc : '-'}]`;
      }).join(' ');
      console.log(`[tick ${i + 1}] scores=${JSON.stringify(sc.scores)} bF=${f(sc.blueFlag)}/${carr(sc.blueFlag)} rF=${f(sc.redFlag)}/${carr(sc.redFlag)} | ${bp}`);
      if ((i + 1) >= 1800 && (i + 1) <= 2100 && (i + 1) % 60 === 0) {
        const _gA = game.scene.getScene('GameScene')._navGraph;
        for (const _b of bots.slice(0, 6)) {
          if (!_b.ai) continue;
          let _ps = 'none';
          try {
            if (_b.ai._navPath && _gA) {
              const _i0 = _b.ai._navI || 0;
              _ps = _b.ai._navPath.map((j, k) => `${k === _i0 ? '*' : ''}${Math.round(_gA.nodes[j].x)},${Math.round(_gA.nodes[j].y)}`).join(' ');
            }
          } catch (eP) { _ps = 'err'; }
          console.log(`   [all] ${_b.team[0]}${_b.playerName} x=${Math.round(_b.x)} src=${_b.ai._dbgSrc} g=${Math.round(_b.ai._dbgGoalX || 0)},${Math.round(_b.ai._dbgGoalY || 0)} navI=${_b.ai._navI ?? '-'} det=${_b.ai._detourX ?? '-'} path=${_ps}`);
        }
        const b0 = bots[0];
        if (b0 && b0.ai) {
          const bd = b0.body;
          const blk = bd ? ((bd.blocked?.left ? 'L' : '') + (bd.blocked?.right ? 'R' : '') + (bd.blocked?.up ? 'U' : '') + (bd.blocked?.down ? 'D' : '')) : '?';
          const vel = bd ? `${Math.round(bd.velocity?.x || 0)},${Math.round(bd.velocity?.y || 0)}` : '?';
          const kits = (sc.pickups ? sc.pickups.getChildren() : []).filter((pk) => pk && pk.active && pk.pickupType === 'medkit');
          const near = kits.map((pk) => ({ x: Math.round(pk.x), y: Math.round(pk.y), d: Math.round(Math.hypot(pk.x - b0.x, pk.y - b0.y)) }))
            .sort((a, b) => a.d - b.d).slice(0, 3);
          const bb = b0.body;
          const solid = (x, y) => (sc._inSolid && sc._inSolid(x, y, 4)) ? 1 : 0;
          const probe = `${solid(bb.x, bb.y + bb.height)}${solid(bb.x + bb.width, bb.y + bb.height)}${solid(bb.x + bb.width / 2, bb.y + bb.height + 20)}`;
          console.log(`   [geom] ${b0.playerName} pX=${Math.round(b0.x)} pY=${Math.round(b0.y)} bodyX=${Math.round(bb.x)} bodyY=${Math.round(bb.y)} bodyW=${Math.round(bb.width)} bodyH=${Math.round(bb.height)} dispW=${Math.round(b0.displayWidth)} dispH=${Math.round(b0.displayHeight)} h=${b0.height} w=${b0.width} scaleY=${b0.scaleY} originY=${b0.originY} offY=${bb.offset ? Math.round(bb.offset.y) : '?'} feet=${Math.round(bb.y + bb.height)}`);
          const _g = game.scene.getScene('GameScene')._navGraph;
          let _pathStr = 'none';
          try {
            if (b0.ai._navPath && _g) {
              const _i0 = b0.ai._navI || 0;
              _pathStr = b0.ai._navPath.map((j, k) => `${k === _i0 ? '*' : ''}${Math.round(_g.nodes[j].x)},${Math.round(_g.nodes[j].y)}`).join(' ');
            }
          } catch (eP) { _pathStr = 'err'; }
          console.log(`   ${b0.playerName} src=${b0.ai._dbgSrc} goal=${Math.round(b0.ai._dbgGoalX || 0)},${Math.round(b0.ai._dbgGoalY || 0)} blk=${blk} vel=${vel} dir=${b0.ai._dbgDir ?? '-'} veto=${b0.ai._dbgVeto ?? '-'} det=${b0.ai._detourX ?? '-'}@${b0.ai._detourUntil ?? 0} body=${Math.round(bb.x)},${Math.round(bb.y)} ${Math.round(bb.width)}x${Math.round(bb.height)} feetSolid=${probe} nav=${b0.ai._navPath ? b0.ai._navPath.length : '-'} navI=${b0.ai._navI ?? '-'} hp=${Math.round(b0.hp)} kits=${JSON.stringify(near)}`);
          console.log(`      path: ${_pathStr}`);
        }
      }
    }
    if (game.scene.getScene('GameScene').gameOver) {
      console.log(`[headless] gameOver at tick ${i + 1}`);
      break;
    }
  }
  const wall = Number(process.hrtime.bigint() - t0) / 1e6;
  const sc = game.scene.getScene('GameScene');
  try {
    const lv = sc.campaignLevel;
    console.log('[map] campaignLevel=', lv ? (lv.id || lv.name || ('keys:' + Object.keys(lv).join(','))) : null,
      'mapWidth=', sc.mapWidth, 'covers=', (sc.covers ? sc.covers.getChildren().length : -1),
      'platforms=', (sc.platforms ? sc.platforms.getChildren().length : -1));
  } catch (e) { console.log('[map] diag fail', e.message); }
  const m = collectMetrics(sc);
  m.flag = {
    bluePickup: fe.bluePickup, redPickup: fe.redPickup,
    blueProgress: Math.round(fe.blueMaxX), redProgress: fe.redMinX > 1e8 ? 0 : Math.round(sc.mapWidth - fe.redMinX),
    minBlue: fe.minBlue > 1e8 ? null : Math.round(fe.minBlue),
    minRed: fe.minRed > 1e8 ? null : Math.round(fe.minRed),
  };
  // Простой ИИ-ботов: доля тиков на земле без движения + худшая серия.
  m.idle = (() => {
    let bt = 0, bi = 0, rt = 0, ri = 0, maxRun = 0, n = 0, clip = 0, clipBots = 0;
    let bNoMove = 0, bDead = 0;
    // k518: разбивка простоя по источникам (какой режим держит бота). Нужна,
    // чтобы бить в причину: «стоит под огнём» и «стоит без владельца» — разные вещи.
    const bySrc = {};
    const byVeto = {};
    for (const p of (sc.players || [])) {
      const st = p && p._idleStat;
      if (!st || !p.isAI) continue;
      n++;
      if (st.clip) { clip += st.clip; clipBots++; }
      if (p.team === 'blue') {
        bt += st.ticks; bi += st.idle;
        bNoMove += st.idleNoMove || 0; bDead += st.idleDead || 0;
      }
      else { rt += st.ticks; ri += st.idle; }
      if (p.team === 'blue' && st.bySrc) {
        for (const k in st.bySrc) bySrc[k] = (bySrc[k] || 0) + st.bySrc[k];
      }
      if (p.team === 'blue' && st.byVeto) {
        for (const k in st.byVeto) byVeto[k] = (byVeto[k] || 0) + st.byVeto[k];
      }
      if (st.maxRun > maxRun) maxRun = st.maxRun;
    }
    return {
      bluePct: bt ? Math.round(bi / bt * 1000) / 10 : 0,
      redPct: rt ? Math.round(ri / rt * 1000) / 10 : 0,
      noMovePct: bt ? Math.round(bNoMove / bt * 1000) / 10 : 0,
      deadPct: bt ? Math.round(bDead / bt * 1000) / 10 : 0,
      maxStreakMs: Math.round(maxRun * 1000 / 60),
      aiBots: n,
      clipTicks: clip,
      clipBots,
      bySrc,
      byVeto,
    };
  })();
  // k476: счётчик [pen] в метрики — чтобы bench видел его по сидам, а не
  // только в stdout одного матча.
  // k477: pen.events — ВСЕ входы (без капа), pen.phys — перекрытия на входе
  // шага физики (preUpdate), т.е. реальная геометрия для Arcade.
  m.pen = {
    events: (sc && sc._penCount) || 0,
    stance: (sc && sc._penStance) || 0,
    unexpl: (sc && sc._penUnexpl) || 0,
    thin: (sc && sc._penThin) || 0,
    logged: (sc && sc._penLog) ? sc._penLog.length : 0,
    bots: (sc && sc._penBots) || {},
    clipTicks: m.idle.clipTicks,
    clipBots: m.idle.clipBots,
    phys: { events: PHYS_PEN.events, ticks: PHYS_PEN.ticks, maxOv: PHYS_PEN.maxOv, maxDur: PHYS_PEN.maxDur, bots: PHYS_PEN.bots },
  };
  m.wallMs = Math.round(wall);  m.tps = Math.round(ticks / (wall / 1000));
  m.fitness = { blue: Math.round(teamFitness(m, 'blue') * 10) / 10, red: Math.round(teamFitness(m, 'red') * 10) / 10 };
  const text = JSON.stringify(m);
  if (sc && sc._penDump && sc._penDump.ring) {
    console.log('[penring] кто: ' + sc._penDump.who +
      ' | t,bodyX,bodyY,W,H,vx,vy,crouch,offX,offY,sprX,sprY');
    for (const r of sc._penDump.ring) console.log('[penring] ' + r.join(','));
  }
  if (sc && sc._penLog && sc._penLog.length) {
    console.log('[pen] записей о глубоком проникновении: ' + sc._penLog.length);
    for (const r of sc._penLog) console.log('[pen] ' + JSON.stringify(r));
  }
  if (OUT) { try { writeFileSync(OUT, text); console.log('[headless] wrote', OUT); } catch (e) { console.log('[headless] write fail', e.message); } }
  else console.log('[metrics]', text);
  console.log(`[headless] ${TICKS} ticks in ${Math.round(wall)}ms (${m.tps} tps, ${(wall / TICKS).toFixed(2)} ms/tick)`);
  process.exit(0);
}

game.events.on('ready', () => {
  try { game.scene.stop('GameScene'); } catch (e) {}
  // Карта режима в headless: BootScene не работает, загрузчик не кэширует
  // maps/*.json. Кладём карту в кэш вручную — иначе сцена берёт дефолтную
  // арену (3000px), а игра идёт на maps/ctf.json (3800px). Верность!
  try {
    const mapData = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
    console.log('[headless] map loaded:', mapData.id, 'width=', mapData.width);
  } catch (e) { console.log('[headless] map load fail', e.message); }
  game.scene.start('GameScene', CTF_DATA);
  installPhysPen();   // k477: честный счётчик перекрытий (preUpdate)
  stepMatch();
});

setTimeout(() => {
  if (!game.isRunning) {
    try { game.texturesReady(); } catch (e) { console.log('[headless] texturesReady fail', e && e.stack || e); }
  }
}, 700);
