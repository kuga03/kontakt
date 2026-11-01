// navMesh.js — граф перемещений для ботов: ходьба, прыжок, двойной прыжок, спрыгивание.
// Узел — точка на верхе опоры: центр тела по X и ноги по Y. Ребро добавляется
// только если симуляция полёта по физике игрока (гравитация 900, прыжок -470,
// двойной -420, бег 250) реально приводит тело на узел. Коллизии — точные AABB
// по platforms/covers. Граф строится лениво один раз на сцену (и отдельно для
// высоких тел — Танк/Медик).

const GRAV = 900, JUMP1 = -470, JUMP2 = -420, RUN = 250;
const HALF_W = 15, STEP = 30, DT = 1 / 120, MAX_T = 2.2;
const H_SMALL = 62, H_TALL = 92;

function collect(scene) {
  const out = [];
  for (const grp of [scene.platforms, scene.covers]) {
    if (!grp || !grp.getChildren) continue;
    for (const o of grp.getChildren()) {
      const b = o.body;
      if (!b || !b.enable || !(b.width >= 10) || !(b.height > 0)) continue;
      out.push({ x0: b.x, x1: b.x + b.width, y0: b.y, y1: b.y + b.height });
    }
  }
  return out;
}

function hits(rects, cx, feet, H) {
  const L = cx - HALF_W + 1, R = cx + HALF_W - 1, T = feet - H + 1, B = feet - 1;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (R > r.x0 && L < r.x1 && B > r.y0 && T < r.y1) return true;
  }
  return false;
}

function landed(x, y, bx, by) {
  return Math.abs(y - by) <= 4 && Math.abs(x - bx) <= HALF_W;
}

// Управление в воздухе (vert): при подъёме горизонталь нулевая, после вершины
// тянем к цели пропорционально. Так тело встаёт на край сбоку, не задевая угол.
export const steer = (x, bx) => Math.max(-RUN, Math.min(RUN, (bx - x) * 3));

// Полёт из (x,y). vert=false — постоянная скорость vx; vert=true — см. steer.
// Возвращает true, если тело садится на (bx,by).
export function sim(loc, x, y, vx, vy, H, bx, by, dbl, vert) {
  let used = false;
  let air = vy < 0;
  const n = Math.round(MAX_T / DT);
  for (let i = 0; i < n; i++) {
    let supported = false;
    if (vy >= 0 && hits(loc, x, y + 2, H)) {
      if (landed(x, y, bx, by)) return true;
      if (air) return false;
      vy = 0;
      supported = true;
    } else if (vy >= 0) {
      air = true;
    }
    if (dbl && !used && vy >= -40) { vy = JUMP2; used = true; }
    if (!supported) vy += GRAV * DT;
    const vxNow = !vert ? vx : ((vy < 0 || (dbl && !used)) ? 0 : steer(x, bx));
    const nx = x + vxNow * DT, ny = y + vy * DT;
    if (hits(loc, nx, ny, H)) {
      if (vy > 0 && hits(loc, x, ny, H)) return landed(x, y, bx, by);
      return false;
    }
    x = nx; y = ny;
  }
  return false;
}

function build(scene, H) {
  const HL = H > H_SMALL ? H_SMALL : H;
  const rects = collect(scene);
  const mapW = scene.mapWidth || 3000;
  const nodes = [];
  const byKey = new Map();
  for (const r of rects) {
    for (let x = r.x0 + HALF_W; x <= r.x1 - HALF_W + 0.5; x += STEP) {
      if (x < HALF_W || x > mapW - HALF_W) continue;
      const y = r.y0;
      if (hits(rects, x, y, H) && hits(rects, x, y, HL)) continue;
      const k = Math.round(x) + ':' + Math.round(y);
      if (byKey.has(k)) continue;
      const n = { id: nodes.length, x, y, edges: [] };
      byKey.set(k, n);
      nodes.push(n);
    }
  }
  // Узлы у краёв препятствий: сетка шагает от края плиты по STEP и может не
  // попасть в узкий проход у края ящика — там тело помещается, узла нет.
  // Кандидаты — края всех прямоугольников ±HALF_W; узел на верхе того
  // прямоугольника, что держит x.
  const edgeXs = new Set();
  for (const r of rects) { edgeXs.add(Math.round(r.x0 - HALF_W)); edgeXs.add(Math.round(r.x1 + HALF_W)); }
  for (const x of edgeXs) {
    if (x < HALF_W || x > mapW - HALF_W) continue;
    for (const r of rects) {
      if (x < r.x0 || x > r.x1) continue;
      const y = r.y0;
      if (hits(rects, x, y, H) && hits(rects, x, y, HL)) continue;
      const k = Math.round(x) + ':' + Math.round(y);
      if (byKey.has(k)) continue;
      const n = { id: nodes.length, x, y, edges: [] };
      byKey.set(k, n);
      nodes.push(n);
    }
  }
  for (const a of nodes) {
    const loc = rects.filter(r => r.x1 > a.x - 340 && r.x0 < a.x + 340 && r.y1 > a.y - 260 && r.y0 < a.y + 440);
    for (const b of nodes) {
      if (b === a) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 240 || dy < -230 || dy > 420) continue;
      if (dy === 0) {
        if (Math.abs(dx) > STEP + 12) continue;
        let ok = true, low = false;
        const s = Math.sign(dx);
        for (let x = a.x + s * 6; s * (x - a.x) < Math.abs(dx); x += s * 6) {
          if (hits(loc, x, a.y, H)) {
            if (HL < H && !hits(loc, x, a.y, HL)) { low = true; continue; }
            ok = false; break;
          }
        }
        if (ok) a.edges.push({ from: a, to: b, type: 'walk', vx: 0, dbl: false, low, cost: Math.abs(dx) / STEP + (low ? 0.5 : 0) });
        continue;
      }
      if (dy < 0) {
        const D = JUMP1 * JUMP1 - 1800 * (a.y - b.y);
        if (-dy > 230) continue;
        let single = false;
        for (let T = 0.3; T <= 2.2 && !single; T += 0.05) {
          const vx = dx / T;
          if (Math.abs(vx) > RUN) continue;
          if (sim(loc, a.x, a.y, vx, JUMP1, H, b.x, b.y, false)) {
            a.edges.push({ from: a, to: b, type: 'jump', vx, dbl: false, cost: 2 + T });
            single = true;
          }
        }
        if (single) continue;
        if (sim(loc, a.x, a.y, 0, JUMP1, H, b.x, b.y, false, true)) {
          a.edges.push({ from: a, to: b, type: 'jump', vx: 0, dbl: false, vert: true, cost: 2.5 });
          continue;
        }
        if (sim(loc, a.x, a.y, 0, JUMP1, H, b.x, b.y, true, true)) {
          a.edges.push({ from: a, to: b, type: 'jump', vx: 0, dbl: true, vert: true, cost: 3.5 });
          continue;
        }
        for (let T = 0.4; T <= 2.2; T += 0.05) {
          const vx = dx / T;
          if (Math.abs(vx) > RUN) continue;
          if (sim(loc, a.x, a.y, vx, JUMP1, H, b.x, b.y, true)) {
            a.edges.push({ from: a, to: b, type: 'jump', vx, dbl: true, cost: 3 + T });
            break;
          }
        }
        if (HL < H && !a.edges.some(e => e.to === b && e.type === 'jump')) {
          for (let T = 0.3; T <= 2.2; T += 0.05) {
            const vx = dx / T;
            if (Math.abs(vx) > RUN) continue;
            if (sim(loc, a.x, a.y, vx, JUMP1, HL, b.x, b.y, false)) {
              a.edges.push({ from: a, to: b, type: 'jump', vx, dbl: false, low: true, cost: 3 + T });
              break;
            }
          }
        }
        continue;
      }
      if (dy < 4) continue;
      for (let T = 0.2; T <= 1.3; T += 0.05) {
        const vx = dx / T;
        if (Math.abs(vx) > RUN) continue;
        if (sim(loc, a.x, a.y, vx, 0, H, b.x, b.y, false)) {
          a.edges.push({ from: a, to: b, type: 'fall', vx, dbl: false, cost: 1 + T });
          break;
        }
      }
      if (HL < H && !a.edges.some(e => e.to === b && e.type === 'fall')) {
        for (let T = 0.2; T <= 1.3; T += 0.05) {
          const vx = dx / T;
          if (Math.abs(vx) > RUN) continue;
          if (sim(loc, a.x, a.y, vx, 0, HL, b.x, b.y, false)) {
            a.edges.push({ from: a, to: b, type: 'fall', vx, dbl: false, low: true, cost: 1.5 + T });
            break;
          }
        }
      }
    }
  }
  return { nodes, count: rects.length };
}

export function navGraph(scene, tall) {
  const pl = scene.platforms, cv = scene.covers;
  const n = (pl && pl.getLength ? pl.getLength() : 0) + (cv && cv.getLength ? cv.getLength() : 0);
  let c = scene._navCache;
  if (!c || c.plat !== pl || c.cov !== cv || c.n !== n || c.mapW !== scene.mapWidth) {
    c = scene._navCache = { plat: pl, cov: cv, n, mapW: scene.mapWidth, small: null, tall: null };
  }
  const key = tall ? 'tall' : 'small';
  if (!c[key]) c[key] = build(scene, tall ? H_TALL : H_SMALL);
  return c[key];
}

export function nearestNode(graph, x, y, maxDx, maxDy) {
  let best = null, bd = Infinity;
  const mx = maxDx ?? Infinity, my = maxDy ?? Infinity;
  for (const nd of graph.nodes) {
    const dx = nd.x - x, dy = nd.y - y;
    if (Math.abs(dx) > mx || Math.abs(dy) > my) continue;
    const d = dx * dx + dy * dy * 4;
    if (d < bd) { bd = d; best = nd; }
  }
  return best;
}

export function edgeKey(e) {
  return e.from.id + '>' + e.to.id + '|' + e.type + (e.dbl ? '2' : '') + (e.vert ? 'v' : '');
}

// Дейкстра по рёбрам. Возвращает список рёбер или null (пути нет).
// banned — Set ключей рёбер (edgeKey), которые сейчас нельзя использовать.
export function findPath(graph, from, to, banned) {
  const N = graph.nodes.length;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Array(N).fill(null);
  const done = new Uint8Array(N);
  dist[from.id] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === to.id) break;
    done[u] = 1;
    for (const e of graph.nodes[u].edges) {
      if (banned && banned.has(edgeKey(e))) continue;
      const nd = dist[u] + e.cost;
      if (nd < dist[e.to.id]) { dist[e.to.id] = nd; prev[e.to.id] = e; }
    }
  }
  if (!isFinite(dist[to.id])) return null;
  const path = [];
  for (let v = to.id; v !== from.id;) {
    const e = prev[v];
    path.push(e);
    v = e.from.id;
  }
  return path.reverse();
}

// Выполняет текущее ребро пути. 'ok' — в процессе, 'next' — ребро пройдено,
// 'done' — путь закончен, 'fail' — ребро не сработало (нужен перепланинг).
export function followPath(p, nav, time) {
  const body = p.body;
  const e = nav.path[nav.i];
  if (!e) return 'done';
  if (nav.et == null) nav.et = time;
  if (time - nav.et > 3500) { nav.reason = 'timeout:' + e.type; return 'fail'; }
  try { p.setCrouch(!!e.low); } catch (err) {}
  const cx = body.x + body.width / 2;
  const feet = body.bottom;
  const grounded = !!(body.blocked.down || body.touching.down);
  if (e.type === 'walk') {
    const dx = e.to.x - cx;
    if (grounded && Math.abs(dx) <= 4 && Math.abs(feet - e.to.y) <= 6) {
      p.stop();
      nav.i++; nav.phase = 0; nav.et = time;
      return nav.i >= nav.path.length ? 'done' : 'next';
    }
    if (Math.abs(dx) > 4) p.move(dx > 0 ? 1 : -1); else p.stop();
    return 'ok';
  }
  if (!nav.phase) {
    if (!grounded) return 'ok';
    const dx = e.from.x - cx;
    if (Math.abs(dx) > 3) { p.move(dx > 0 ? 1 : -1); return 'ok'; }
    if (e.type === 'jump') {
      p.jump();
      if (p.ai) p.ai._hopSkipClamp = time + 500;
    }
    const vx0 = (nav.altVx != null) ? nav.altVx : e.vx;
    body.setVelocityX(vx0);
    nav.phase = 1; nav.launch = time; nav.used = false; nav.et = time;
    // Одиночный прыжок (-470, высота ~122px) решает задачу, если подъём
    // не превышает ёмкость одиночного прыжка (v^2/2g ~ 122) с запасом.
    // Двойной применяем только для больших высот — он на физике уступает
    // одиночному и чаще срывается в полёте.
    const singleH = (JUMP1 * JUMP1) / (2 * GRAV);
    nav.wantDbl = !!(e.dbl) && (e.from.y - e.to.y) > singleH - 2;
    return 'ok';
  }
  let vxNow = e.vx;
  if (e.vert) vxNow = (body.velocity.y < 0 || (nav.wantDbl && !nav.used)) ? 0 : steer(cx, e.to.x);
  body.setVelocityX(vxNow);
  if (nav.wantDbl && !nav.used && !grounded && body.velocity.y >= -40) {
    p.jump();
    nav.used = true;
  }
  if (grounded && time - nav.launch > 120) {
    if (Math.abs(cx - e.to.x) <= HALF_W && Math.abs(feet - e.to.y) <= 8) {
      nav.i++; nav.phase = 0; nav.et = time;
      return nav.i >= nav.path.length ? 'done' : 'next';
    }
    if (time - nav.launch > 2500) {
      nav.reason = 'noland:' + e.type + (e.dbl ? '2' : '') + (e.vert ? 'v' : '');
      // kXXX: прыжки срываются — один retry с скоростью полёта, скорректированной
      // (меньше vx → дольше полёт → другая траектория). Двойной retry — бан.
      if ((e.type === 'jump') && !nav._retried) {
        nav._retried = true;
        nav.phase = 0;
        nav.et = time;
        nav.launch = time;
        nav.used = false;
        nav.altVx = (e.vx || 0) * 0.9;
        return 'ok';
      }
      return 'fail';
    }
  }
  return 'ok';
}
