// Генератор арены с флангами (k207): чистая функция без Phaser —
// тестируется в node (селф-тест сидов), в игре едет через getFreeMap.
// Замысел: зеркальная симметрия (честность) + 3 яруса в фиксированных
// полосах (низ 850 / мост ~690 / плато ~470 — те же, что ждут ИИ, STAT,
// _youPlace и goldenClimb) + автолейны ИЗ построенной геометрии
// (а не руками как CTF_LANES — рассинхрон невозможен: точка лежит ровно
// на построенной поверхности). Бюджеты прыжков: подъём ≤120, пролёт ≤140,
// ширины ≥140 — с запасом под медленных (Танк 170) и носильщиков (×0.8).
// При смене бюджетов — править RIZE/GAP/MINW ниже, лейны пересчитаются сами.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function rng32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RISE = 120; // предельный подъём хопа
const GAP = 140;  // предельный горизонтальный пролёт вверх/вбок
const MINW = 140; // минимальная ширина ступени

// Вид укрытия по геометрии, без rnd(): порядок случайных чисел раскладки не
// меняется, а один и тот же ящик-слот всегда получает один и тот же вид.
// Бочки — узкие и высокие, мешки — низкие и широкие, обломки — самые длинные.
function coverKind(cx, top, w, h) {
  const k = Math.abs(Math.round(cx) * 31 + Math.round(top) * 17 + Math.round(w) * 7 + Math.round(h)) % 3;
  if (w >= 120 && h >= 50 && k === 2) return 'map_wreck';
  if (w <= 90 && h >= 50 && k === 0) return 'map_barrel';
  return 'map_bags';
}

export function genFlankArena(opts) {
  const o = opts || {};
  const seed = ((o.seed == null ? Math.floor(Math.random() * 0xFFFFFFFF) : o.seed) >>> 0);
  const rnd = rng32(seed);
  const R = (a, b) => a + rnd() * (b - a);
  const mode = o.mode || 'CTF';
  const W = o.width || 3800, H = o.height || 900;
  const GT = H - 50; // верх земли 850
  const objects = [];
  const S = (x) => objects.push(x);
  const RI = (v) => Math.round(v);
  // Платформа задаётся верхом (как ноги бота): y-центр = top + h/2.
  const plat = (cx, top, w, h) => {
    h = h || 16;
    S({ type: 'platform', x: RI(cx), y: RI(top + h / 2), w: RI(w), h: h });
    return { x0: cx - w / 2, x1: cx + w / 2, top: top };
  };
  const cover = (cx, top, w, h, tex) => {
    S({ type: 'cover', x: RI(cx), y: RI(top + h / 2), w: RI(w), h: h, texKey: tex || coverKind(cx, top, w, h) });
    return { x0: cx - w / 2, x1: cx + w / 2, top: top };
  };

  // Земля во всю ширину. Тема — случайно (иначе генератор всегда город):
  // палитры, платформы, панорама и декор подхватывают её по ключу.
  const THEMES = [
    { theme: 'zavod', ground: 'gr_beton' },
    { theme: 'pustinya', ground: 'gr_sand' },
    { theme: 'pechera', ground: 'gr_stones' },
    { theme: 'wasteland', ground: 'gr_scorch' },
    // Темы кампании: иначе genFlankArena с незнакомой темой молча уходил
    // в случайную и клал не тот грунт (кампания задаёт тему уровня).
    { theme: 'ulica', ground: 'gr_scorch' },
    { theme: 'krisha', ground: 'gr_beton' },
    { theme: 'pustoch', ground: 'gr_grass' },
    { theme: 'peshera', ground: 'gr_stones' }
  ];
  const th = (o.theme && THEMES.find(t => t.theme === o.theme)) || THEMES[(Math.random() * THEMES.length) | 0];
  S({ type: 'ground', x: W / 2, y: GT + 25, w: W, h: 50, texKey: th.ground });

  // Лесенки: запад строим, восток — зеркало (симметрия точная).
  const p1 = { cx: 390 + R(-30, 30), w: 540, top: 730 };
  const p1b = { cx: 680 + R(-15, 15), w: 140, top: 730 };
  const p2 = { cx: 760 + R(-20, 20), w: 200, top: 620 };
  const p3 = { cx: 880 + R(-15, 15), w: 160, top: 520 };
  plat(p1.cx, p1.top, p1.w); plat(p1b.cx, p1b.top, p1b.w);
  plat(p2.cx, p2.top, p2.w); plat(p3.cx, p3.top, p3.w);
  const M = (v) => W - v; // зеркало координаты
  plat(M(p1.cx), p1.top, p1.w); plat(M(p1b.cx), p1b.top, p1b.w);
  plat(M(p2.cx), p2.top, p2.w); plat(M(p3.cx), p3.top, p3.w);
  const p2x1 = p2.cx + p2.w / 2;

  // Мост: край не дальше пролёта от лесенки (иначе не запрыгнуть).
  const bx0 = clamp(1000 + R(-30, 30), 900, p2x1 + GAP);
  const bx1 = W - bx0;
  plat((bx0 + bx1) / 2, 690, bx1 - bx0);

  // Плато: край внахлёст со ступенью p3 (подъём 50 шагом).
  const mark = objects.length;
  const px0 = clamp(900 + R(-20, 20), 860, (p3.cx + p3.w / 2) - 40);
  const px1 = W - px0;
  plat((px0 + px1) / 2, 470, px1 - px0, 16);

  // Ящики на плато: пара + крышки. Зазоры до краёв плато ≥180 — есть где
  // разбежаться и обойти. Высота 60–80: берётся одиночным (~122).
  const boxW = 240 + R(-20, 20), boxH = 70;
  // Крышки не должны свисать с плато: на узких картах (кампания 2400)
  // фиксированные 0.368W уводили ящик за край плато — лейн-точка
  // оказывалась в воздухе. Центр — в пределах плиты, зеркало точное.
  const b1cx = clamp(W * 0.368 + R(-30, 30), px0 + boxW / 2 + 24, W / 2 - 60);
  const b2cx = W - b1cx;
  cover(b1cx, 470 - boxH, boxW, boxH);
  cover(b2cx, 470 - boxH, boxW, boxH);
  cover(b1cx, 470 - boxH - 40, 140, 40);
  cover(b2cx, 470 - boxH - 40, 140, 40);
  const b1 = { x0: b1cx - boxW / 2, x1: b1cx + boxW / 2, top: 470 - boxH };
  const b2 = { x0: b2cx - boxW / 2, x1: b2cx + boxW / 2, top: 470 - boxH };

  // Вариант 1 «Ущелье»: плато разорвано просветом 160 по центру. Середину
  // соединяет ступень-кубе на мосту (верх 570): с моста на неё 120, со ступени
  // на плато 100 — все подъёмы и зазоры в бюджетах. Старые плато и ящики
  // на нём убираем (выделены от mark), ставим свои.
  let variant = (seed >>> 5) % 3;
  if (variant === 2 && W < 2800) variant = 0;
  let gorgeHi = null;
  if (variant === 1) {
    objects.splice(mark);
    const gx = W / 2;
    const gpx0 = clamp(900 + R(-20, 20), 860, (p3.cx + p3.w / 2) - 40);
    const gpx1 = W - gpx0;
    const wL = { cx: (gpx0 + gx - 80) / 2, w: gx - 80 - gpx0 };
    const eR = { cx: (gx + 80 + gpx1) / 2, w: gpx1 - gx - 80 };
    plat(wL.cx, 470, wL.w, 16);
    plat(eR.cx, 470, eR.w, 16);
    cover(wL.cx, 400, 120, 70);
    cover(W - wL.cx, 400, 120, 70);
    cover(gx, 570, 120, 120);
    gorgeHi = [[500, GT], [p1b.cx, 730], [p2.cx, 620], [p3.cx, 520],
      [gx - 120, 470], [gx, 570], [gx + 120, 470],
      [M(p3.cx), 520], [M(p2.cx), 620], [M(p1b.cx), 730], [W - 350, GT]];
  }
  if (variant === 2) {
    objects.splice(mark);
    const gx = W / 2;
    const gpx0 = clamp(900 + R(-20, 20), 860, (p3.cx + p3.w / 2) - 40);
    const tIn = gx - 220;
    const tcx = (gpx0 + tIn) / 2, tw = tIn - gpx0;
    plat(tcx, 470, tw, 16);
    plat(W - tcx, 470, tw, 16);
    cover(tcx, 400, 120, 70);
    cover(W - tcx, 400, 120, 70);
    cover(gx, 570, 240, 120);
    gorgeHi = [[500, GT], [p1b.cx, 730], [p2.cx, 620], [p3.cx, 520],
      [tIn - 40, 470], [gx, 570], [W - tIn + 40, 470],
      [M(p3.cx), 520], [M(p2.cx), 620], [M(p1b.cx), 730], [W - 350, GT]];
  }

  // Ящики внизу: 2 пары (запад + зеркало = 4 как на Фортах), прыгаемые
  // (h≤70), вне баз (x≥350). Размеры — один раз на пару.
  [0.22, 0.395].forEach((f) => {
    const cx = W * (f + R(-0.008, 0.008));
    const w = 70 + R(0, 20), h = 60;
    cover(cx, GT - h, w, h);
    cover(W - cx, GT - h, w, h);
  });
  // Ящики на мосту: пара, верх 630. Та же пара — те же размеры.
  {
    const cx = W * (0.368 + R(-0.006, 0.006));
    cover(cx, 690 - 60, 80, 60);
    cover(W - cx, 690 - 60, 80, 60);
  }

  // Спавны и флаги (как ctf.json): базы у краёв, небо над ними чисто.
  const spawn = (t, x, y) => S({ type: 'spawn', spawnType: t, x: RI(x), y: RI(y), w: 26, h: 26 });
  spawn('player', 420, 680);
  for (let i = 0; i < 8; i++) {
    spawn('team', 320 + i * 100, 680);
    spawn('enemy', W - 320 - i * 100, 680);
  }
  spawn('flagBlue', 170, 692);
  spawn('flagRed', W - 170, 692);
  // Подборы вдоль карты.
  spawn('medkit', W / 2, GT - 70);
  spawn('ammo', 700, GT - 70); spawn('ammo', W - 700, GT - 70);
  // Парами одного типа — иначе у зеркала не сойдётся тип.
  spawn('frag', W * 0.4, GT - 70); spawn('frag', W * 0.6, GT - 70);
  spawn('smoke', W * 0.45, GT - 70); spawn('smoke', W * 0.55, GT - 70);

  // Автолейны (ноги) ИЗ построенных поверхностей (расcинхрон невозможен:
  // точка лежит ровно на построенной поверхности). Синие — запад→восток,
  // красные — зеркало в обратном порядке.
  // Низ — долями ширины (а не фикс-иксами под 3800: BOMB уже 3200).
  const gLow = [0.237, 0.395, 0.5, 0.605, 0.763].map((f) => [W * f, GT]);
  const midB = [[500, GT], [p1b.cx, 730], [p2.cx, 620], [bx0 + 120, 690],
    [W / 2, 690], [bx1 - 120, 690], [bx1 + 150, GT]];
  const gapW = clamp((px0 + b1.x0) / 2, px0 + 20, px1 - 20);
  const gapE = clamp((b2.x1 + px1) / 2, px0 + 20, px1 - 20);
  const gapC = clamp((b1.x1 + b2.x0) / 2, px0 + 20, px1 - 20);
  const hiB = [[500, GT], [p1b.cx, 730], [p2.cx, 620], [p3.cx, 520],
    [gapW, 470], [b1cx, b1.top], [gapC, 470], [b2cx, b2.top], [gapE, 470],
    [Math.max(px0 + 60, px1 - 140), 470], [M(p3.cx), 520], [M(p2.cx), 620], [M(p1b.cx), 730], [W - 350, GT]];
  // Красные идут восток→запад: зеркало каждой точки БЕЗ реверса
  // (реверс ставил старт на запад — red/mid[1] давал rise 160).
  const mir = (ch) => ch.map((n) => [W - n[0], n[1]]);
  const lanes = {
    blue: { low: gLow.map((n) => n.slice()), mid: midB.map((n) => n.slice()), high: (gorgeHi || hiB).map((n) => n.slice()) },
    red: { low: mir(gLow), mid: mir(midB), high: mir(gorgeHi || hiB) }
  };

  return {
    id: 'gen_' + seed.toString(36),
    name: 'Случайная арена ' + seed.toString(36),
    width: W, height: H, mode: mode, theme: th.theme,
    mapVer: 1, seed: seed,
    objects: objects,
    _lanes: lanes
  };
}

// Валидатор для селф-теста (и редактора): симметрия, бюджеты хопов по лейнам,
// посадка точек на поверхности, чистые базы. Возвращает [] = чисто.
export function validateArena(g) {
  const errs = [];
  try {
    const W = g.width, objs = g.objects || [];
    const key = (o) => (o.spawnType ? 'sp:' + o.spawnType : o.type) + '|' + (o.w || 0) + 'x' + (o.h || 0);
    // Симметрия: каждому объекту — зеркало (допуск 2px, спавны/флаги —
    // зеркало по типу: team<->enemy, flagBlue<->flagRed, player сам).
    const pool = objs.slice();
    const takeMir = (o) => {
      const wantX = W - o.x;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        if (Math.abs(c.x - wantX) > 2) continue;
        if (Math.abs((c.y || 0) - (o.y || 0)) > 2) continue;
        if ((c.w || 0) !== (o.w || 0) || (c.h || 0) !== (o.h || 0)) continue;
        let ok = false;
        if (c.type === o.type && (c.spawnType || null) === (o.spawnType || null)) ok = true;
        if (o.spawnType === 'team' && c.spawnType === 'enemy') ok = true;
        if (o.spawnType === 'enemy' && c.spawnType === 'team') ok = true;
        if (o.spawnType === 'flagBlue' && c.spawnType === 'flagRed') ok = true;
        if (o.spawnType === 'flagRed' && c.spawnType === 'flagBlue') ok = true;
        if (ok) { pool.splice(i, 1); return true; }
      }
      return false;
    };
    objs.forEach((o) => {
      if (o.spawnType === 'player') return; // игрок один, зеркала нет
      if (!takeMir(o)) errs.push('no-mirror ' + key(o) + ' @' + Math.round(o.x));
    });
    // Поверхности (верх + пролёт) для проверки посадки точек.
    const surfs = [];
    objs.forEach((o) => {
      if (o.spawnType) return;
      if (o.type === 'ground') { surfs.push({ x0: o.x - o.w / 2, x1: o.x + o.w / 2, top: o.y - o.h / 2 }); return; }
      if (o.type === 'platform' || o.type === 'cover') {
        surfs.push({ x0: o.x - o.w / 2, x1: o.x + o.w / 2, top: o.y - o.h / 2 });
      }
    });
    const surfAt = (x, y) => {
      for (const s of surfs) {
        if (x >= s.x0 - 2 && x <= s.x1 + 2 && Math.abs(y - s.top) <= 6) return s;
      }
      return null;
    };
    // Лейны: каждая точка на поверхности; хоп вверх ≤RISE; пролёт ≤GAP.
    ['blue', 'red'].forEach((tm) => {
      ['low', 'mid', 'high'].forEach((ln) => {
        const ch = ((g._lanes || {})[tm] || {})[ln] || [];
        if (!ch.length) { errs.push(tm + '/' + ln + ' empty'); return; }
        let prev = null, prevS = null;
        ch.forEach((n, i) => {
          const s = surfAt(n[0], n[1]);
          if (!s) { errs.push(tm + '/' + ln + '[' + i + '] airborne ' + Math.round(n[0]) + ',' + Math.round(n[1])); return; }
          if (prev) {
            const rise = prev[1] - n[1];
            if (rise > RISE + 1) errs.push(tm + '/' + ln + '[' + i + '] rise ' + Math.round(rise));
            if (n[1] < prev[1]) {
              const gapm = Math.max(0, Math.max(s.x0 - prevS.x1, prevS.x0 - s.x1));
              if (gapm > GAP + 1) errs.push(tm + '/' + ln + '[' + i + '] gap ' + Math.round(gapm));
            }
            if ((s.x1 - s.x0) < MINW - 60 && i > 0 && i < ch.length - 1) {
              // Узкие допустимы только как ящики-ступени на плато (220+)?
              // Крышки 140 — ок, коробки 220+ — ок. Порог мягкий.
            }
          }
          prev = n; prevS = s;
        });
      });
    });
    // Базы чистые: в x<350 и x>W-350 нет поверхностей с верхом 600–850
    // (кроме земли) — подход к флагу/спавну не перекрыт.
    objs.forEach((o) => {
      if (o.spawnType || o.type === 'ground') return;
      const inBase = o.x < 350 || o.x > W - 350;
      if (!inBase) return;
      const top = o.y - (o.h || 0) / 2;
      if (top > 600 && top <= 850) errs.push('base-blocked ' + key(o) + ' @' + Math.round(o.x));
    });
  } catch (e) { errs.push('validator-crash ' + (e && e.message)); }
  return errs;
}
