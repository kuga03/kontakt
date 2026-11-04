// navGraph.js — навигация и твёрдость геометрии (было в GameScene).
// Все функции принимают сцену первым аргументом. Внешние вызовы
// (EnemyAI/Player/Flag/Bomb/pickups через scene._inSolid и т.д.)
// работают как раньше — в сцене остались тонкие обёртки.
import { getRigConfig } from '../data/rigConfig.js';

export function buildNavGraph(scene) {
  const rects = [];
  try {
    const grab = (group) => {
      if (!group) return;
      group.getChildren().forEach(o => {
        const b = o.body;
        if (!b || !b.enable) return;
        if (!Number.isFinite(b.width) || !Number.isFinite(b.y)) return;
        // Стена центра (16px) обязана войти в граф: иначе нав ведёт
        // верхнее плато напрямик сквозь неё, а рантайм бьётся лбом
        // (bk-повторы в одних координатах, nav I стоит, lane не доходит).
        if (b.width < 10) return;
        rects.push({ x0: b.x, x1: b.x + b.width, y0: b.y, y1: b.y + b.height });
      });
    };
    grab(scene.platforms);
    grab(scene.covers);
  } catch (e) {}
  scene._navRects = rects;
  // Сетка твёрдости: клетка 30px, бокс расширен на 12 (полтела).
  const CS = 30;
  const MW = scene.mapWidth || 3000, MH = (scene.mapHeight || 900) + 60;
  const cols = Math.ceil(MW / CS) + 1, rows = Math.ceil(MH / CS) + 1;
  const grid = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const cy = (r + 0.5) * CS;
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * CS;
      for (let k = 0; k < rects.length; k++) {
        const rc = rects[k];
        if (cx > rc.x0 - 12 && cx < rc.x1 + 12 && cy > rc.y0 - 12 && cy < rc.y1 + 12) {
          grid[r * cols + c] = 1;
          break;
        }
      }
    }
  }
  scene._navGrid = { cs: CS, cols, rows, data: grid };
  const solidAt = (x, y, rad) => {
    const R = (typeof rad === 'number') ? rad : 13;
    const c0 = Math.max(0, Math.floor((x - R) / CS)), c1 = Math.min(cols - 1, Math.floor((x + R) / CS));
    const r0 = Math.max(0, Math.floor((y - R) / CS)), r1 = Math.min(rows - 1, Math.floor((y + R) / CS));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (grid[r * cols + c]) return true;
      }
    }
    return false;
  };
  scene._navSolidAt = solidAt;
  // Точное пересечение тела 26x56 (ноги feetY) со статикой.
  // Для bake — только точные боксы: сетка 30px + запас даёт ложные
  // срабатывания по границам клеток (платформа 410 целиком выпадала
  // из графа — боты не видели весь верхний ярус).
  const bodyHitExact = (px, feetY) => {
    const L = px - 13, R = px + 13, T = feetY - 56, B = feetY;
    for (let k = 0; k < rects.length; k++) {
      const rc = rects[k];
      if (L < rc.x1 && R > rc.x0 && T < rc.y1 && B > rc.y0) return true;
    }
    return false;
  };
  // Тот же тест, но возвращает бокс (нужен для скольжения).
  const bodyHitRect = (px, feetY) => {
    const L = px - 13, R = px + 13, T = feetY - 56, B = feetY;
    for (let k = 0; k < rects.length; k++) {
      const rc = rects[k];
      if (L < rc.x1 && R > rc.x0 && T < rc.y1 && B > rc.y0) return rc;
    }
    return null;
  };
  // Узлы стояния.
  const nodes = [];
  const surf = [];
  try {
    const grab2 = (group) => {
      if (!group) return;
      group.getChildren().forEach(o => {
        const b = o.body;
        if (!b || !b.enable) return;
        const w = b.width, top = b.y;
        if (!Number.isFinite(w) || !Number.isFinite(top) || w < 40) return;
        surf.push({ x0: b.x, x1: b.x + w, y: top });
      });
    };
    grab2(scene.platforms);
    grab2(scene.covers);
  } catch (e) {}
  surf.forEach(s => {
    const n = Math.max(1, Math.round((s.x1 - s.x0) / 40));
    for (let i = 0; i <= n; i++) {
      const x = s.x0 + (s.x1 - s.x0) * (i / n);
      // Точка стояния обязана быть свободной (тело 56px над верхом),
      // иначе узел внутри ящика ведёт в стену.
      if (bodyHitExact(x, s.y)) continue;
      nodes.push({ x, y: s.y, s });
    }
  });
  const links = nodes.map(() => []);
  const walkFree = (a, b) => {
    for (let t = 0; t <= 1.001; t += 0.5) {
      const mx = a.x + (b.x - a.x) * t;
      if (bodyHitExact(mx, a.y)) return false;
    }
    return true;
  };
  // Прямая симуляция прыжка: бот разбегается (240) и прыгает (-470,
  // g 900 — как в бою), у пика — второй прыжок (-420: боты теперь
  // умеют двойной как игрок, см. forceJump), смотрим ГДЕ он реально
  // приземлится и вяжем ребро к узлам рядом с посадкой. Точки отрыва —
  // 10 шт в каждую сторону вдоль своей поверхности (шаг 15: окно
  // удачного отрыва бывает уже 30). Посадка — касание верха бокса
  // сверху (падая), удар боком/головой — обрыв/скольжение.
  // Так находятся и короткие запрыгивания под потолком, и прыжки
  // через ящики, а невозможное (мост 698 -> плато 478, надо 220
  // при двойном ~210) ребра НЕ получает — A* идёт в обход через лесенки.
  // На что приземлились: верх бокса, на который опустились сверху.
  const landTopAt = (px, prevB, nowB) => {
    for (let k = 0; k < rects.length; k++) {
      const rc = rects[k];
      if (px + 10 > rc.x0 && px - 10 < rc.x1 &&
          prevB <= rc.y0 + 8 && nowB >= rc.y0) {
        return rc.y0;
      }
    }
    return null;
  };
  // Карта посадок: ключ "ix узла" -> Set соседей (собираем, потом в links).
  const landLinks = nodes.map(() => new Set());
  const MH2 = (scene.mapHeight || 900) + 60;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    // Направления отрыва: с разбега влево/вправо И с места (vx=0):
    // стоячий двойной — единственный способ залезть на плиту, висящую
    // ровно над головой (лесенка 730->604: разбег бьётся о низ плиты).
    const dirs = [1, -1, 0];
    for (let d = 0; d < dirs.length; d++) {
      const dir = dirs[d];
      const kMax = dir === 0 ? 1 : 10;
      for (let k = 0; k < kMax; k++) {
        const tx = a.x + dir * k * 15;
        if (tx < a.s.x0 + 6 || tx > a.s.x1 - 6) break;
        if (bodyHitExact(tx, a.y)) continue;
        // Полёт: до двойного — vx v0 (разбег или 0 с места), после —
        // v1 (игрок в воздухе доворачивает: стоячий прыжок + рывок
        // вбок после второго — единственный путь на нависающую плиту).
        const fly = (v0, v1) => {
          let px = tx, py = a.y, vy = -470;
          let vx = v0;
          let prevB = py, used2 = false, _sep = 0;
          const doDouble = () => { used2 = true; vy = -420; vx = v1; };
          for (let s = 0; s < 110; s++) {
            vy += 15;
            // Пик первого прыжка — второй прыжок (-420), как у бота в бою.
            if (!used2 && vy >= 0) doDouble();
            px += vx / 60; py += vy / 60;
            if (py > MH2 || Math.abs(px - a.x) > 560) break;
            const rc = bodyHitRect(px, py);
            if (rc) {
              // Удар головой на взлёте: если двойной ещё не потрачен —
              // жмём его СРАЗУ (ступень висит над головой, apex поздно).
              if (vy < 0 && !used2) { doDouble(); prevB = py; continue; }
              // Вжались без двойного (потрачен/пик): скользим наружу
              // как arcade вместо вечного висения — иначе 2px-углы
              // у краёв ступеней рвут траектории. Только первые касания:
              // в туннелях долгое скольжение уводит в никуда, там
              // честнее погаснуть и упасть, как раньше.
              if (vy <= 0) {
                // k460/k461 (ОТКАЧЕНО полностью). «Низкий уступ (<=90px) —
                // считать посадкой» чинит граф: `--navcheck 200,850,170,704`
                // даёт путь, `navcomp` сводит землю и верх в #0. И простой
                // падает (21.8% -> 19.8%, худшая серия 145с -> 63с).
                // НО игра становится хуже в обоих вариантах:
                //   • по всей карте (k460): капсы 19 -> 14, доставка 11/11 -> 9/11;
                //   • только зона базы x<420 (k461): капсы 19 -> 3, доставка 3/11,
                //     и маршрут вырождается в бред (5:200,850 -> 83:40,770 ->
                //     97:467,730 -> 89:159,730).
                // Вывод: граф трогать нельзя без переделки маршрутов/лейнов.
                const L = px - 13, R = px + 13, T = py - 56, B = py;
                const _m = Math.min(R - rc.x0, rc.x1 - L, B - rc.y0, rc.y1 - T);
                if (_m <= 20 && _sep < 3) {
                  _sep++;
                  if (_m === R - rc.x0) px = rc.x0 - 13;
                  else if (_m === rc.x1 - L) px = rc.x1 + 13;
                  // Вверх сквозь ЧУЖУЮ плиту — не скользим, а гасим рейс:
                  // иначе bake протаскивает ноги на 37px сквозь потолок
                  // и вяжет фейковое ребро (столб 630→470 в центре: рантайм
                  // там бьётся/душит дабл и cl=0 минутами, а A* ведёт всех
                  // напрямик вместо боковых лесенок). Своя плита (взлёт
                  // с неё) — как раньше, snap+продолжаем.
                  else if (_m === B - rc.y0) {
                    const _own = Math.abs(rc.y0 - a.y) < 2 &&
                      px > a.s.x0 - 30 && px < a.s.x1 + 30;
                    if (!_own) break;
                    py = rc.y0;
                  }
                  else py = rc.y1;
                  prevB = py;
                  continue;
                }
                vy = 0; prevB = py; continue;
              }
              const top = landTopAt(px, prevB, py);
              // Чистая посадка — ноги пришли ровно на крышу. Вверх выше
              // 210 не ведём (двойной ~220 впритирку: bake обещает,
              // а рантайм мажет на пиксель — мост 698->478=220 excluded).
              if (top != null && py - top < 26 && a.y - top <= 210) {
                for (let j = 0; j < nodes.length; j++) {
                  if (j === i) continue;
                  const n = nodes[j];
                  if (Math.abs(n.x - px) <= 48 && Math.abs(n.y - top) <= 24) {
                    landLinks[i].add(j);
                  }
                }
                break;
              }
              // Чиркнули бок ящика в падении — скользим вниз вдоль стены
              // (arcade гасит vx у стены), а не «садимся» на неё: иначе
              // спуск с ящика на землю никогда не находится.
              vx = 0;
              prevB = py;
              continue;
            }
            // Долгое падение мимо всего — дальше летим, счётчик шагов
            // ограничит. Падение глубже 620 от старта — не ведём.
            if (vy > 0 && py > a.y + 620) break;
            prevB = py;
          }
        };
        if (dir === 0) { fly(0, -240); fly(0, 240); fly(0, 0); }
        else fly(dir * 240, dir * 240);
      }
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = Math.abs(a.x - b.x);
      if (a.s === b.s && dx <= 80 && walkFree(a, b)) {
        links[i].push(j); links[j].push(i);
      }
    }
    landLinks[i].forEach(j => { links[i].push(j); });
  }
  return { nodes, links };
}

// Твёрдость точки вылета: дуло нельзя закинуть за платформу —
// отрезок плечо→дуло упирается в первую статику на пути и точка
// возвращается на свою сторону (минус зазор). Пуля всегда стартует
// с чистого места, сквозняков из-за торчащего ствола нет.
export function clampMuzzle(scene, x1, y1, x2, y2) {
  try {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (!(len2 > 0)) return { x: x2, y: y2 };
    let bestT = 1;
    const testRect = (L, R, T, B) => {
      // Слэб-тест луча: входной t отрезка [0,1] в бокс.
      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-9) {
        if (x1 < L || x1 > R) return;
      } else {
        let t1 = (L - x1) / dx, t2 = (R - x1) / dx;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return;
      }
      if (Math.abs(dy) < 1e-9) {
        if (y1 < T || y1 > B) return;
      } else {
        let t1 = (T - y1) / dy, t2 = (B - y1) / dy;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return;
      }
      if (tmin > 0.001 && tmin < bestT) bestT = tmin;
    };
    [scene.platforms, scene.covers].forEach(group => {
      if (!group) return;
      const list = group.getChildren();
      for (let i = 0; i < list.length; i++) {
        const b = list[i].body;
        if (!b || !b.enable) continue;
        if (b.x + b.width < Math.min(x1, x2) || b.x > Math.max(x1, x2) ||
            b.y + b.height < Math.min(y1, y2) || b.y > Math.max(y1, y2)) continue;
        testRect(b.x, b.x + b.width, b.y, b.y + b.height);
      }
    });
    if (bestT < 1) {
      // Зазор назад, чтобы дуло не сидело впритык в стене.
      const t = Math.max(0, bestT - 4 / Math.sqrt(len2));
      return { x: x1 + dx * t, y: y1 + dy * t };
    }
    return { x: x2, y: y2 };
  } catch (e) {
    return { x: x2, y: y2 };
  }
}

// вообще не входило в статику (ни на пиксель) — ни вверх в потолок,
// ни вниз сквозь пол, ни боком в стену. Вызывается каждый кадр после
// решений ИИ/ввода, до физшага. После этого пересечений нет:
// стрелять можно всегда, ноги под землю не уходят, вис на кромке
// невозможен физически. Дешёвый AABB-рейкаст, без аллокаций в кадре.
export function clampFighterMotion(scene, p, dt) {
  try {
    const b = p.body;
    if (!b || p.dead || !p.active) return;
    const dts = Math.max(1e-4, Math.min(0.05, dt || 0.016));
    const L = b.x, R = b.x + b.width, T = b.y, B = b.y + b.height;
    const vy = b.velocity.y;
    if (vy < -1) {
      // Вверх: ближайший потолок (низ солида) над головой в пути.
      const travel = -vy * dts + 2;
      let ceil = -Infinity;
      const plats = scene.platforms ? scene.platforms.getChildren() : [];
      const covs = scene.covers ? scene.covers.getChildren() : [];
      for (let i = 0; i < plats.length; i++) {
        const ob = plats[i].body;
        if (!ob || !ob.enable) continue;
        if (ob.x + ob.width <= L || ob.x >= R) continue;
        const obb = ob.y + ob.height;
        if (obb <= T - travel || obb > T + 1) continue;
        if (obb > ceil) ceil = obb;
      }
      for (let i = 0; i < covs.length; i++) {
        const ob = covs[i].body;
        if (!ob || !ob.enable) continue;
        if (ob.x + ob.width <= L || ob.x >= R) continue;
        const obb = ob.y + ob.height;
        if (obb <= T - travel || obb > T + 1) continue;
        if (obb > ceil) ceil = obb;
      }
      if (ceil > -Infinity) b.setVelocityY(-Math.max(0, T - ceil - 1) / dts);
    } else if (vy > 1) {
      // Вниз: ближайший пол под ногами в пути.
      const travel = vy * dts + 2;
      let floor = Infinity;
      const plats = scene.platforms ? scene.platforms.getChildren() : [];
      const covs = scene.covers ? scene.covers.getChildren() : [];
      for (let i = 0; i < plats.length; i++) {
        const ob = plats[i].body;
        if (!ob || !ob.enable) continue;
        if (ob.x + ob.width <= L || ob.x >= R) continue;
        if (ob.y < B - 1 || ob.y > B + travel) continue;
        if (ob.y < floor) floor = ob.y;
      }
      for (let i = 0; i < covs.length; i++) {
        const ob = covs[i].body;
        if (!ob || !ob.enable) continue;
        if (ob.x + ob.width <= L || ob.x >= R) continue;
        if (ob.y < B - 1 || ob.y > B + travel) continue;
        if (ob.y < floor) floor = ob.y;
      }
      if (floor < Infinity) b.setVelocityY(Math.max(0, floor - 1 - B) / dts);
    }
    // Горизонталь: ближайшая стена по ходу в пути.
    const vx = b.velocity.x;
    // k640: короткий хоп с разбегом (cover-jump) — на 400мс не гасим
    // горизонталь, иначе хоп вертикальный и бот не перелетает ящик.
    const _hopSkip = !!(p.ai && p.ai._hopSkipClamp && (scene.time && scene.time.now) < p.ai._hopSkipClamp);
    if ((vx > 1 || vx < -1) && !_hopSkip) {
      const travel = Math.abs(vx) * dts + 2;
      const plats = scene.platforms ? scene.platforms.getChildren() : [];
      const covs = scene.covers ? scene.covers.getChildren() : [];
      if (vx > 0) {
        let wall = Infinity;
        for (let gi = 0; gi < 2; gi++) {
          const list = gi ? covs : plats;
          for (let i = 0; i < list.length; i++) {
            const ob = list[i].body;
            if (!ob || !ob.enable) continue;
            if (ob.y + ob.height <= T + 2 || ob.y >= B - 2) continue;
            if (ob.x < R - 1 || ob.x > R + travel) continue;
            if (ob.x < wall) wall = ob.x;
          }
        }
        if (wall < Infinity) b.setVelocityX(Math.max(0, wall - 1 - R) / dts);
      } else {
        let wall = -Infinity;
        for (let gi = 0; gi < 2; gi++) {
          const list = gi ? covs : plats;
          for (let i = 0; i < list.length; i++) {
            const ob = list[i].body;
            if (!ob || !ob.enable) continue;
            if (ob.y + ob.height <= T + 2 || ob.y >= B - 2) continue;
            const orr = ob.x + ob.width;
            if (orr > L + 1 || orr < L - travel) continue;
            if (orr > wall) wall = orr;
          }
        }
        if (wall > -Infinity) b.setVelocityX(-Math.max(0, L - 1 - wall) / dts);
      }
    }
  } catch (e) {}
}

export function inSolid(scene, tx, ty, r = 10) {
  // Горячий путь через сетку bake (O(1)): только r>=0 (касание).
  // Отрицательный r — глубина ВНЕДРЕНИЯ (защита от застревания:
  // -8 центр реально внутри, -2 голова внутри). Сетка с запасом так
  // не умеет: R=2 считал бы «касание» застреванием и телепортировал
  // бойца вверх ВНУТРЬ платформы — так и клинит. Их — точным путём.
  if (typeof r === 'number' && r < 0) {
    const hitNeg = group => {
      if (!group) return false;
      for (const o of group.getChildren()) {
        const b = o.body;
        if (!b || !b.enable) continue;
        const hw = b.width / 2, hh = b.height / 2;
        if (
          Math.abs(tx - (b.x + hw)) < hw + r &&
          Math.abs(ty - (b.y + hh)) < hh + r
        ) {
          return true;
        }
      }
      return false;
    };
    return hitNeg(scene.covers) || hitNeg(scene.platforms);
  }
  try {
    const g = scene._navGrid;
    if (g && g.data && typeof r === 'number' && r <= 16) {
      const R = r;
      const c0 = Math.max(0, Math.floor((tx - R) / g.cs)), c1 = Math.min(g.cols - 1, Math.floor((tx + R) / g.cs));
      const r0 = Math.max(0, Math.floor((ty - R) / g.cs)), r1 = Math.min(g.rows - 1, Math.floor((ty + R) / g.cs));
      for (let rr = r0; rr <= r1; rr++) {
        for (let cc = c0; cc <= c1; cc++) {
          if (g.data[rr * g.cols + cc]) return true;
        }
      }
      return false;
    }
  } catch (e) {}
  const hit = group => {
    if (!group) return false;
    for (const o of group.getChildren()) {
      const b = o.body;
      if (!b || !b.enable) continue;
      const hw = b.width / 2, hh = b.height / 2;
      if (
        Math.abs(tx - (b.x + hw)) < hw + r &&
        Math.abs(ty - (b.y + hh)) < hh + r
      ) {
        return true;
      }
    }
    return false;
  };
  return hit(scene.covers) || hit(scene.platforms);
}

// Точная проверка «точка в солиде» (k213): прямой AABB по телам, БЕЗ сетки
// bake (ячейки 30px + запас 12px: точка в 30px от плиты уже «внутри»).
// Только для вопроса «цель зарыта целиком» (оба замера): сеточная версия
// давала невидимость сидящему ПОД плитой с головой у неё (эксплойт «сижу
// на ящике под мостом — меня нет»). Физика/спавны — как были, по сетке.
export function inSolidExact(scene, tx, ty, pad) {
  try {
    const p = (typeof pad === 'number') ? pad : 2;
    // k631: список тел статики кэшируем на сцену. Раньше каждый вызов
    // собирал массив групп и каждый раз дергал getChildren() — а зовут эту
    // проверку на каждого видимого врага, у каждого бота, каждый такт ИИ
    // (замер: ~6% кадра). Тела статичны; при изменении их числа кэш
    // пересобирается (динамические объекты режимов добавляются после старта).
    const covers = scene.covers;
    const plats = scene.platforms;
    const n = (covers ? covers.getLength() : 0) + (plats ? plats.getLength() : 0);
    let list = scene._solidExactList;
    if (!list || scene._solidExactN !== n) {
      list = [];
      const push = (grp) => {
        if (!grp) return;
        const kids = grp.getChildren();
        for (let i = 0; i < kids.length; i++) {
          const b = kids[i] && kids[i].body;
          if (b && b.enable) list.push(b);
        }
      };
      push(covers);
      push(plats);
      scene._solidExactList = list;
      scene._solidExactN = n;
    }
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.enable) continue;
      if (Math.abs(tx - (b.x + b.width / 2)) < b.width / 2 + p &&
          Math.abs(ty - (b.y + b.height / 2)) < b.height / 2 + p) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// k631: вызов точной проверки без аллокации bound-функции на каждый вызов.
// Раньше в пяти горячих местах ИИ делали `scene._inSolidExact.bind(scene)`
// каждый такт у каждого бота — только на `bind` уходило ~4% сэмплов профиля.
// Здесь зовём метод сцены напрямую (this = scene), фолбэк — сеточная версия.
export function solidExactAt(scene, x, y, pad) {
  try {
    if (!scene) return false;
    const f = scene._inSolidExact;
    if (typeof f === 'function') return f.call(scene, x, y, pad);
    const g = scene._inSolid;
    if (typeof g === 'function') return g.call(scene, x, y, pad);
  } catch (e) {}
  return false;
}

// Выталкиваем точку из солида вверх (до ~216px). Не вышло — отдаём
// как есть: дальше сработает автовозврат флага по таймеру.
// БЕЗ запаса сверх выхода: +16 протаскивал сквозь тонкие плиты (8px),
// и бойцы/пули оказывались внутри геометрии — «стрельба сквозь».
export function escapeSolid(scene, x, y, r) {
  let ny = y, guard = 0;
  const rad = (typeof r === 'number') ? r : 10;
  while (inSolid(scene, x, ny, rad) && guard < 12) {
    ny -= 18;
    guard++;
  }
  return { x, y: ny };
}

// Точка спавна: ищем землю СВЕРХУ ВНИЗ от неба (первый солид под x) —
// работает на любой карте, а не только где грунт ровно на mapHeight-50.
// Старая логика «от низа вверх» спавнила внутри высокого/неровного
// грунта. Возвращаем центр тела с запасом над поверхностью.
export function findGroundY(scene, x) {
  try {
    const MH = scene.mapHeight || 900;
    // Ищем НИЖНЮЮ опору (землю), а не первую крышу/мост сверху:
    // запоминаем последний верх солида, иначе респаун на навесе.
    let y = 60;
    let lastTop = null;
    let wasOut = true;
    while (y <= MH + 120) {
      const inside = inSolid(scene, x, y, 6);
      if (inside && wasOut) lastTop = y;
      wasOut = !inside;
      y += 12;
    }
    if (lastTop != null) return lastTop - 84;
    const p = escapeSolid(scene, x, MH - 50 - 40, 30);
    // Запас вверх: вытолкнутая точка может сидеть впритык (тело 56+)
    // — поднимаем ещё на полтела, падение на старте безвредно.
    return p.y - 24;
  } catch (e) {
    return 560;
  }
}

// Точка спавна на земле (верх грунта минус полтела), вытолкнутая
// из геометрии вверх. Матч начинается стоя, а не падением с неба.
export function groundSpawnY(scene, x) {
  try {
    return findGroundY(scene, x);
  } catch (e) {
    return 560;
  }
}

// Масштаб хитбокса из рига — как Player._rigHitboxK (тот же глобал).
export function spawnRigK(scene) {
  try {
    // k631: масштаб хитбокса не меняется в течение матча, а зовут его на
    // каждого спавна/респавна (282 раза за 5 с). getRigConfig читает
    // localStorage и парсит JSON — 32 мс на эти вызовы. Кэш на сцену.
    if (scene && scene._rigKCache > 0) return scene._rigKCache;
    const rc = (typeof getRigConfig === 'function') ? getRigConfig() : null;
    const t = (rc.torso && rc.torso.s) || 22;
    const l = (rc.legs && rc.legs.s) || 26;
    const h = (rc.head && rc.head.s) || 16;
    const P = (typeof Phaser !== 'undefined') ? Phaser : null;
    const v = (t + l + h) / 64;
    let out;
    if (P && P.Math && P.Math.Clamp) out = P.Math.Clamp(v, 0.6, 2.2);
    else out = Math.max(0.6, Math.min(2.2, v));
    try { if (scene) scene._rigKCache = out; } catch (e) {}
    return out;
  } catch (e) { return 1; }
}

// Тело 30k×56k с низом на feetY влезает в статику (касание 1px — можно).
export function bodyFree(scene, cx, feetY, k) {
  try {
    const L = cx - 15 * k, R = cx + 15 * k;
    const T = feetY - 56 * k, B = feetY - 2;
    const groups = [scene.platforms, scene.covers];
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];
      if (!grp) continue;
      const kids = grp.getChildren();
      for (let i = 0; i < kids.length; i++) {
        const ob = kids[i] && kids[i].body;
        if (!ob || !ob.enable) continue;
        if (L < ob.x + ob.width - 1 && R > ob.x + 1 &&
            T < ob.y + ob.height - 1 && B > ob.y + 1) {
          if (B <= ob.y + 8 && T < ob.y) continue; // свой пол
          return false;
        }
      }
    }
    return true;
  } catch (e) { return true; }
}

// Верх опоры под точкой: сканируем вниз (ступенька/земля/полка).
export function groundFeetY(scene, cx, fromY) {
  try {
    for (let yy = fromY - 40; yy <= fromY + 340; yy += 8) {
      if (inSolid(scene, cx, yy, 4)) return yy - 4;
    }
  } catch (e) {}
  return null;
}

// Спавн без ловушек: тело влезает, под ногами опора и хотя бы
// в одну сторону проход 150px (иначе это карман — ищем рядом).
// Лечит «спавн под платформой флага» на Фортах: щели 40px клинили
// игрока, а ботов вышвыривал анти-стак. Возвращает {x, y} (центр).
export function validateSpawn(scene, x, y) {
  try {
    const W = scene.mapWidth || 3000;
    const k = spawnRigK(scene);
    const okAt = (cx) => {
      if (cx < 80 || cx > W - 80) return null;
      const gy = groundFeetY(scene, cx, y);
      if (gy == null) return null;
      if (!bodyFree(scene, cx, gy, k)) return null;
      for (const dir of [-1, 1]) {
        let steps = 0;
        for (const d of [70, 120, 170]) {
          const nx = cx + dir * d;
          if (nx < 60 || nx > W - 60) break;
          // Опора рядом: не выше 160 над ногами, падение — любое
          // в пределах 230 (спрыгнул с края — тоже выход).
          const ngy = groundFeetY(scene, nx, gy - 60);
          if (ngy == null || ngy < gy - 160 || ngy > gy + 230) break;
          if (!bodyFree(scene, nx, ngy, k)) break;
          steps++;
        }
        // +12 поверх опоры: стоим с запасом, а не впритык (было 2px):
        // иначе округление/первый физшаг клинит тело в край платформы
        // и физика давит его ВНИЗ — под крышу в карман. Падение на 12
        // безвредно, опора та же.
        if (steps >= 3) return { x: Math.round(cx), y: Math.round(gy - 30 * k - 12) };
      }
      return null;
    };
    const first = okAt(x);
    if (first) return first;
    // (Возвращаем ПРОВЕРЕННУЮ точку gy-30k, а не исходную {x,y}:
    // исходная y могла лежать внутри геометрии — респаун 766 цепляет
    // низ крыши на 8px, а физика давит такое тело ВНИЗ, под крышу
    // в карман. Старый код при том же x возвращал исходную точку.)
    for (let s = 1; s <= 12; s++) {
      for (const dir of [1, -1]) {
        const r = okAt(x + dir * s * 50);
        if (r) return r;
      }
    }
    return { x, y };
  } catch (e) { return { x, y }; }
}

export function groundHeightAt(scene, x) {
  const cl = scene.campaignLevel;
  return cl ? cl.height - 25 : 700;
}

// Точки спавна по горизонтали с разносом ≥260px (было в GameScene.pickSpawns).
export function pickSpawns(scene, count) {
  const low = Math.round(scene.mapWidth * 0.22);
  const high = Math.round(scene.mapWidth * 0.78);
  const xs = [];
  let attempts = 0;
  while (xs.length < count && attempts < 600) {
    attempts++;
    const x = Phaser.Math.Between(low, high);
    if (xs.every(xi => Math.abs(xi - x) >= 260)) {
      xs.push(x);
    }
  }
  const fallbackStep = Math.max(1, (high - low) / count);
  while (xs.length < count) {
    xs.push(low + xs.length * fallbackStep);
  }
  return xs.map(x => ({ x, y: 560 }));
}

// Плоские rects для losMath. Геометрия статична на весь матч
// (платформы/укрытия создаются до боя; динамические объекты режимов —
// один раз), поэтому кэшируем массивы по сцене. Раньше каждый вызов
// LOS/выстрела/гранаты собирал заново 20–100 объектов, а боты зовут
// LOS несколько раз за такт — это давало заметный GC и CPU.
function _losCount(scene) {
  try {
    const p = scene.platforms ? scene.platforms.getLength() : 0;
    const c = scene.covers ? scene.covers.getLength() : 0;
    return p + c;
  } catch (e) { return -1; }
}

export function losFlat(scene) {
  try {
    const n = _losCount(scene);
    if (scene._losFlatCache && scene._losFlatN === n) return scene._losFlatCache;
    const out = [];
    const pushGroup = (grp) => {
      if (!grp || !grp.getChildren) return;
      const kids = grp.getChildren();
      for (let i = 0; i < kids.length; i++) {
        const b = kids[i] && kids[i].body;
        if (!b || b.enable === false) continue;
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
        if (!Number.isFinite(b.width) || !Number.isFinite(b.height)) continue;
        out.push({ L: b.x, R: b.x + b.width, T: b.y, B: b.y + b.height });
      }
    };
    pushGroup(scene.platforms);
    pushGroup(scene.covers);
    scene._losFlatCache = out;
    scene._losFlatN = n;
    return out;
  } catch (e) { return []; }
}

export function losFlatSplit(scene) {
  try {
    const n = _losCount(scene);
    if (scene._losSplitCache && scene._losSplitN === n) return scene._losSplitCache;
    const mk = (grp) => {
      const out = [];
      if (!grp || !grp.getChildren) return out;
      const kids = grp.getChildren();
      for (let i = 0; i < kids.length; i++) {
        const b = kids[i] && kids[i].body;
        if (!b || b.enable === false) continue;
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
        if (!Number.isFinite(b.width) || !Number.isFinite(b.height)) continue;
        out.push({ L: b.x, R: b.x + b.width, T: b.y, B: b.y + b.height });
      }
      return out;
    };
    const res = { plats: mk(scene.platforms), covers: mk(scene.covers) };
    scene._losSplitCache = res;
    scene._losSplitN = n;
    return res;
  } catch (e) { return { plats: [], covers: [] }; }
}
