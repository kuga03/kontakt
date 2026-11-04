// navMesh.js — граф перемещений для ботов: ходьба, прыжок, двойной прыжок, спрыгивание.
// Узел — точка на верхе опоры: центр тела по X и ноги по Y. Ребро добавляется
// только если симуляция полёта по физике игрока (гравитация 900, прыжок -470,
// двойной -420, бег 250) реально приводит тело на узел. Коллизии — точные AABB
// по platforms/covers. Граф строится лениво один раз на сцену (и отдельно для
// высоких тел — Танк/Медик).

const GRAV = 900, JUMP1 = -470, JUMP2 = -420, RUN = 250;
const HALF_W = 15, STEP = 30, DT = 1 / 120, MAX_T = 2.2;
const H_SMALL = 62, H_TALL = 92, H_CROUCH = 44;

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
export function sim(loc, x, y, vx, vy, H, bx, by, dbl, vert, hopSkip = false) {
  let used = false;
  let air = vy < 0;
  const n = Math.round(MAX_T / DT);
  let hopSkipFrames = hopSkip ? Math.round(0.4 / DT) : 0;
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
    
    // Если включен hopSkip (cover-jump), игнорируем препятствия по горизонтали
    // в течение первых 400мс прыжка, как это делает физика (navGraph.clampFighterMotion).
    let isHit = hits(loc, nx, ny, H);
    if (isHit && hopSkipFrames > 0) {
       // Проверяем, было бы столкновение, если бы мы двигались только по вертикали.
       if (!hits(loc, x, ny, H)) {
         isHit = false; // Игнорируем горизонтальное столкновение
       }
    }
    
    if (isHit) {
      if (vy > 0 && hits(loc, x, ny, H)) return landed(x, y, bx, by);
      return false;
    }

    // Ранние отсечения: тело уже провалилось ниже целевой опоры или улетело дальше цели
    if (ny > by + 10 && vy > 0 && (used || !dbl)) return false;
    if (!vert) {
      if (vx > 0 && nx > bx + HALF_W + 5) return false;
      if (vx < 0 && nx < bx - HALF_W - 5) return false;
    }

    x = nx; y = ny;
    if (hopSkipFrames > 0) hopSkipFrames--;
  }
  return false;
}

function build(scene, H) {
  const HL = H_CROUCH;
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
    // Гарантированно добавляем узлы на обоих краях поверхности (r.x0 + HALF_W и r.x1 - HALF_W),
    // чтобы для широких препятствий вроде машин/ящиков бот мог запрыгнуть на край и спрыгнуть с края.
    for (const edgeX of [Math.round(r.x0 + HALF_W), Math.round(r.x1 - HALF_W)]) {
      if (edgeX < HALF_W || edgeX > mapW - HALF_W) continue;
      const y = r.y0;
      if (hits(rects, edgeX, y, H) && hits(rects, edgeX, y, HL)) continue;
      const k = edgeX + ':' + Math.round(y);
      if (byKey.has(k)) continue;
      const n = { id: nodes.length, x: edgeX, y, edges: [] };
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
  // Пространственная сетка корзин (200px) для быстрого отбора узлов
  const BUCKET = 200;
  const grid = new Map();
  for (const nd of nodes) {
    const bx = Math.floor(nd.x / BUCKET);
    if (!grid.has(bx)) grid.set(bx, []);
    grid.get(bx).push(nd);
  }

  for (const a of nodes) {
    const loc = rects.filter(r => r.x1 > a.x - 340 && r.x0 < a.x + 340 && r.y1 > a.y - 260 && r.y0 < a.y + 440);
    const minBx = Math.floor((a.x - 280) / BUCKET);
    const maxBx = Math.floor((a.x + 280) / BUCKET);
    for (let gbx = minBx; gbx <= maxBx; gbx++) {
      const bucket = grid.get(gbx);
      if (!bucket) continue;
      for (const b of bucket) {
        if (b === a) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > 280 || dy < -230 || dy > 420) continue;
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
          const minT1 = Math.max(0.3, Math.ceil((Math.abs(dx) / RUN) / 0.05) * 0.05);
          for (let T = minT1; T <= 2.2 && !single; T += 0.05) {
            const vx = dx / T;
            if (Math.abs(vx) > RUN) continue;
            if (sim(loc, a.x, a.y, vx, JUMP1, H, b.x, b.y, false, false, true)) {
              a.edges.push({ from: a, to: b, type: 'jump', vx, dbl: false, cost: 2 + T });
              single = true;
            }
          }
          if (single) continue;
          if (sim(loc, a.x, a.y, 0, JUMP1, H, b.x, b.y, false, true, true)) {
            a.edges.push({ from: a, to: b, type: 'jump', vx: 0, dbl: false, vert: true, cost: 2.5 });
            continue;
          }
          if (sim(loc, a.x, a.y, 0, JUMP1, H, b.x, b.y, true, true, true)) {
            a.edges.push({ from: a, to: b, type: 'jump', vx: 0, dbl: true, vert: true, cost: 3.5 });
            continue;
          }
          const minT2 = Math.max(0.4, Math.ceil((Math.abs(dx) / RUN) / 0.05) * 0.05);
          for (let T = minT2; T <= 2.2; T += 0.05) {
            const vx = dx / T;
            if (Math.abs(vx) > RUN) continue;
            if (sim(loc, a.x, a.y, vx, JUMP1, H, b.x, b.y, true, false, true)) {
              a.edges.push({ from: a, to: b, type: 'jump', vx, dbl: true, cost: 3 + T });
              break;
            }
          }
          if (HL < H && !a.edges.some(e => e.to === b && e.type === 'jump')) {
            for (let T = minT1; T <= 2.2; T += 0.05) {
              const vx = dx / T;
              if (Math.abs(vx) > RUN) continue;
              // Передаем hopSkip = true (11-й аргумент: loc, x, y, vx, vy, H, bx, by, dbl, vert, hopSkip)
              if (sim(loc, a.x, a.y, vx, JUMP1, HL, b.x, b.y, false, false, true)) {
                a.edges.push({ from: a, to: b, type: 'jump', vx, dbl: false, low: true, cost: 3 + T });
                break;
              }
            }
          }
          continue;
        }
        if (dy < 4) continue;
        const minTF = Math.max(0.2, Math.ceil((Math.abs(dx) / RUN) / 0.05) * 0.05);
        for (let T = minTF; T <= 1.3; T += 0.05) {
          const vx = dx / T;
          if (Math.abs(vx) > RUN) continue;
          if (sim(loc, a.x, a.y, vx, 0, H, b.x, b.y, false)) {
            a.edges.push({ from: a, to: b, type: 'fall', vx, dbl: false, cost: 1 + T });
            break;
          }
        }
        if (HL < H && !a.edges.some(e => e.to === b && e.type === 'fall')) {
          for (let T = minTF; T <= 1.3; T += 0.05) {
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

// Бинарная куча (Min-Heap) и переиспользуемые типизированные буферы для A* поиска путей (без аллокаций).
class PathMinHeap {
  constructor(capacity = 256) {
    this.ids = new Int32Array(capacity);
    this.keys = new Float32Array(capacity);
    this.size = 0;
  }
  push(id, key) {
    if (this.size >= this.ids.length) {
      const nids = new Int32Array(this.ids.length * 2);
      const nkeys = new Float32Array(this.keys.length * 2);
      nids.set(this.ids);
      nkeys.set(this.keys);
      this.ids = nids;
      this.keys = nkeys;
    }
    let i = this.size++;
    this.ids[i] = id;
    this.keys[i] = key;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[i] < this.keys[p]) {
        const tid = this.ids[i], tk = this.keys[i];
        this.ids[i] = this.ids[p]; this.keys[i] = this.keys[p];
        this.ids[p] = tid; this.keys[p] = tk;
        i = p;
      } else break;
    }
  }
  pop() {
    if (this.size === 0) return -1;
    const topId = this.ids[0];
    const last = --this.size;
    if (last > 0) {
      this.ids[0] = this.ids[last];
      this.keys[0] = this.keys[last];
      let i = 0;
      while (true) {
        let best = i;
        const l = (i << 1) + 1, r = l + 1;
        if (l < this.size && this.keys[l] < this.keys[best]) best = l;
        if (r < this.size && this.keys[r] < this.keys[best]) best = r;
        if (best !== i) {
          const tid = this.ids[i], tk = this.keys[i];
          this.ids[i] = this.ids[best]; this.keys[i] = this.keys[best];
          this.ids[best] = tid; this.keys[best] = tk;
          i = best;
        } else break;
      }
    }
    return topId;
  }
}

let _aStarN = 0;
let _gScore = null;
let _prev = null;
let _done = null;
const _heap = new PathMinHeap(256);

// A* по рёбрам графа с очередью с приоритетом и нулевыми аллокациями в кадре.
// banned — Set ключей рёбер (edgeKey), которые сейчас нельзя использовать.
// options — { isBombCarrier: boolean, crowdNodes: Set<nodeId> }
export function findPath(graph, from, to, banned, options = null) {
  if (!from || !to) return null;
  if (from.id === to.id) return [];
  const N = graph.nodes.length;
  if (_aStarN < N) {
    _aStarN = N;
    _gScore = new Float32Array(N);
    _prev = new Array(N);
    _done = new Uint8Array(N);
  }
  _gScore.fill(Infinity);
  _prev.fill(null);
  _done.fill(0);
  _heap.size = 0;

  const isBombCarrier = !!(options && options.isBombCarrier);
  const crowdNodes = options && options.crowdNodes;

  _gScore[from.id] = 0;
  const toX = to.x, toY = to.y;
  const h0 = Math.hypot(from.x - toX, from.y - toY) / 140;
  _heap.push(from.id, h0);

  while (_heap.size > 0) {
    const u = _heap.pop();
    if (u === to.id) break;
    if (_done[u]) continue;
    _done[u] = 1;

    const uDist = _gScore[u];
    const edges = graph.nodes[u].edges;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (banned && banned.has(edgeKey(e))) continue;
      // Носитель бомбы не может запрыгивать высоко (штраф импульса прыжка cm=0.8)
      if (isBombCarrier && e.type === 'jump') {
        if (e.dbl || (e.from.y - e.to.y) > 78) continue;
      }
      const v = e.to.id;
      if (_done[v]) continue;

      let edgeCost = e.cost;
      // Штраф за скопление союзников — перенаправляет последующих ботов на свободные фланги
      if (crowdNodes && crowdNodes.has(v)) {
        edgeCost += 2.0;
      }

      const tentG = uDist + edgeCost;
      if (tentG < _gScore[v]) {
        _gScore[v] = tentG;
        _prev[v] = e;
        const toNode = e.to;
        const h = Math.hypot(toNode.x - toX, toNode.y - toY) / 140;
        _heap.push(v, tentG + h);
      }
    }
  }

  if (!isFinite(_gScore[to.id])) return null;
  const path = [];
  for (let v = to.id; v !== from.id;) {
    const e = _prev[v];
    if (!e) return null;
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
    if (grounded && Math.abs(dx) <= 6 && Math.abs(feet - e.to.y) <= 6) {
      nav.i++; nav.phase = 0; nav.et = time;
      const nextEdge = nav.path[nav.i];
      // Плавный бег: останавливаемся только если путь завершён или следующее ребро не продолжает бег в ту же сторону
      if (!nextEdge || nextEdge.type !== 'walk' || Math.sign(nextEdge.to.x - e.to.x) !== Math.sign(dx)) {
        p.stop();
      }
      try { if (p.crouching && !nextEdge?.low) p.setCrouch(false); } catch (err) {}
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
      try { if (p.crouching && !nav.path[nav.i]?.low) p.setCrouch(false); } catch (err) {}
      return nav.i >= nav.path.length ? 'done' : 'next';
    }
    // Быстрый детект неудачной посадки: если бот уже приземлился (через 350мс), но далеко от цели
    const dtLaunch = time - nav.launch;
    const landedWrong = dtLaunch > 350 && (Math.abs(feet - e.to.y) > 16 || Math.abs(cx - e.to.x) > HALF_W * 2.5);
    if (landedWrong || dtLaunch > 2500) {
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
