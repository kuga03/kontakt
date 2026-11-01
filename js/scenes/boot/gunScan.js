import { GENERATED } from './config.js';
export function _scanGunDots() {
    window.__gunGrips = {};
    window.__gunDotDbg = {};
    const SKIP = new Set(['player', 'enemy', 'bullet', 'grenade', 'platform', 'cover',
      'wall', 'ground', 'pickup', 'tile', 'medkit', 'ammo_kit', 'armor_kit', 'frag_granade',
      'smoke_granade', 'bullet_RPG', 'wslot', 'wslot_active']);
    let found = 0;
    // Оружейные PNG, грузящиеся ВНЕ GENERATED (своим load.image): сканер по
    // Object.keys(GENERATED) их не видел и точки игнорировал.
    // Benelli M4: в файле 2 точки (0.319/0.652), а хвата в игре не было.
    const EXTRA_GUNS = ['Benelli_M4'];
    [...new Set([...Object.keys(GENERATED), ...EXTRA_GUNS])].forEach(key => {
      try {
        if (SKIP.has(key)) return;
        if (key.startsWith('chr_') || key.startsWith('icon_') || key.startsWith('fon_')) return;
        if (key === 'jeans_left' || key === 'jeans_right') return;
        const def = GENERATED[key] || { kind: 'rect', w: 40 };
        if (!def || def.kind !== 'rect' || (def.w || 0) < 24) return;
        if (!this.textures.exists(key)) return;
        // только настоящие PNG (не canvas-заглушки), иначе краснеть нечему
        if (!(this._loadedPngKeys && this._loadedPngKeys.has(key))) return;
        const tex = this.textures.get(key);
        const src = tex.getSourceImage();
        const W = (src && src.width) || 0;
        const H = (src && src.height) || 0;
        if (!W || !H) return;
        const tmp = document.createElement('canvas');
        tmp.width = W;
        tmp.height = H;
        const tctx = tmp.getContext('2d', { willReadFrequently: true });
        if (!tctx) return;
        tctx.drawImage(src, 0, 0);
        let data;
        try {
          data = tctx.getImageData(0, 0, W, H).data;
        } catch (e) {
          return;
        }
        const reds = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            // Красное с допуском: чистый #FF0000, мягкая кисть (254,0,0),
            // полупрозрачное. Доминирование красного обязательное
            // (r-g и r-b >= 150): ржавчина/коричневый не проходят.
            if (r >= 200 && (r - g) >= 150 && (r - b) >= 150 && a > 100) {
              reds.push({ x, y });
            }
          }
        }
        window.__gunDotDbg[key] = { reds: reds.length, kept: 0 };
        if (reds.length < 2 || reds.length > 400) return;
        // Компоненты связности (соседство по Чебышеву <= 3): точки художника
        // бывают из 2px или рваные (АК: задняя метка — три куска с зазорами).
        // Принимаем компоненты 2+ px; размах — до 12px по ТОНКОЙ оси и до 40px
        // по длинной (передняя метка АК — вертикальный мазок 9×32, его старый
        // квадрат 12×12 отбраковывал и обе руки вставали на заднюю метку).
        // Одиночные specks ржавчины и размазня мимо.
        const comps = [];
        const used = new Array(reds.length).fill(false);
        for (let s = 0; s < reds.length; s++) {
          if (used[s]) continue;
          const comp = [];
          const stack = [s];
          used[s] = true;
          while (stack.length) {
            const i = stack.pop();
            comp.push(reds[i]);
            for (let j = 0; j < reds.length; j++) {
              if (used[j]) continue;
              if (Math.max(Math.abs(reds[i].x - reds[j].x), Math.abs(reds[i].y - reds[j].y)) <= 3) {
                used[j] = true;
                stack.push(j);
              }
            }
          }
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          let sx = 0, sy = 0;
          comp.forEach(p => {
            if (p.x < x0) x0 = p.x;
            if (p.x > x1) x1 = p.x;
            if (p.y < y0) y0 = p.y;
            if (p.y > y1) y1 = p.y;
            sx += p.x; sy += p.y;
          });
          const sw = x1 - x0, sh = y1 - y0;
          if (comp.length >= 2 && Math.min(sw, sh) <= 12 && Math.max(sw, sh) <= 40) {
            comps.push({ pts: comp, cx: sx / comp.length, cy: sy / comp.length });
          }
        }
        comps.sort((a, b) => a.cx - b.cx);
        window.__gunDotDbg[key] = { reds: reds.length, kept: comps.length };
        if (!comps.length) return;
        // Задняя метка — левая плюс всё в пределах 10% ширины от неё (рваная
        // метка АК — три куска рядом): объединяем взвешенно, иначе задняя и
        // передняя руки обе встают на соседние куски одной метки.
        // Передняя — первая метка минимум на 10% ширины правее задней; нет
        // такой (одна метка — обе кисти на задней). Пропорции арта не смотрим:
        // у вертикальных клинков две точки вдоль рукояти — хват двуручный.
        const GAP = W * 0.1;
        const rearSet = comps.filter(c => c.cx <= comps[0].cx + GAP);
        let rN = 0, rX = 0, rY = 0;
        rearSet.forEach(c => { rN += c.pts.length; rX += c.cx * c.pts.length; rY += c.cy * c.pts.length; });
        const rear = { x: rX / rN / W, y: rY / rN / H };
        // Одноручное = когда вторая метка НЕ найдена (а не по пропорциям арта):
        // у вертикальных клинков две точки вдоль рукояти — хват двуручный.
        const fg = comps.find(c => c.cx >= rX / rN + GAP);
        const fore = fg ? { x: fg.cx / W, y: fg.cy / H } : null;
        const groups = fg ? [...rearSet, fg] : rearSet;
        window.__gunGrips[key] = { rx: rear.x, ry: rear.y, fx: fore ? fore.x : null, fy: fore ? fore.y : null, W, H };
        // Стираем ТОЛЬКО точки (пиксели принятых групп): остальной арт
        // (ржавчина и т.п.) не трогаем. Затем кладём чистый canvas под тем же ключом.
        tctx.save();
        tctx.globalCompositeOperation = 'destination-out';
        groups.forEach(grp => (grp.pts || grp).forEach(p => tctx.fillRect(p.x - 1, p.y - 1, 3, 3)));
        tctx.restore();
        this.textures.remove(key);
        const clean = this.textures.createCanvas(key, W, H);
        if (clean && clean.context) {
          clean.context.drawImage(tmp, 0, 0);
          clean.refresh();
        }
        found++;
        console.info('[ART] точки хвата:', key,
          'зад ' + rear.x.toFixed(2) + '/' + rear.y.toFixed(2) +
          (fore ? ' пер ' + fore.x.toFixed(2) + '/' + fore.y.toFixed(2) : ' (одна)'));
      } catch (e) { /* одно оружие не сломает загрузку */ }
    });
    if (found) console.info('[ART] точек хвата всего: ' + found);
  }

  // Кончик ствола по альфе PNG: самый правый непрозрачный столбец = дульный срез,
  // средний Y последних ~3 столбцов = высота ствола. Стволы на всех PNG смотрят
  // вправо. Хранится в долях арта (window.__gunTips[texKey] = {tx,ty,W,H}) —
  // Player пересчитывает в мировые пиксели показа (origin 0.15, ширина 44*scale),
  // поэтому точка вылета всегда сидит ровно на срезе, а не в 20px перед ним
  // (как было с табличными 57px при показе 44px). Запускать ПОСЛЕ _scanGunDots —
  // сканируем уже чистую текстуру без красных точек.
export function _scanGunTips() {
    window.__gunTips = {};
    const SKIP = new Set(['player', 'enemy', 'bullet', 'grenade', 'platform', 'cover',
      'wall', 'ground', 'pickup', 'tile', 'medkit', 'ammo_kit', 'armor_kit', 'frag_granade',
      'smoke_granade', 'bullet_RPG', 'wslot', 'wslot_active']);
    let found = 0;
    // Тот же EXTRA_GUNS, что в _scanGunDots: кончик ствола тоже нужен
    // для оружия вне GENERATED (иначе точка вылета — табличная).
    const EXTRA_GUNS_T = ['Benelli_M4'];
    [...new Set([...Object.keys(GENERATED), ...EXTRA_GUNS_T])].forEach(key => {
      try {
        if (SKIP.has(key)) return;
        if (key.startsWith('chr_') || key.startsWith('icon_') || key.startsWith('fon_')) return;
        if (key === 'jeans_left' || key === 'jeans_right') return;
        const def = GENERATED[key] || { kind: 'rect', w: 40 };
        if (!def || def.kind !== 'rect' || (def.w || 0) < 24) return;
        if (!this.textures.exists(key)) return;
        if (!(this._loadedPngKeys && this._loadedPngKeys.has(key))) return;
        const tex = this.textures.get(key);
        const src = tex.getSourceImage();
        const W = (src && src.width) || 0;
        const H = (src && src.height) || 0;
        if (!W || !H) return;
        const tmp = document.createElement('canvas');
        tmp.width = W;
        tmp.height = H;
        const tctx = tmp.getContext('2d', { willReadFrequently: true });
        if (!tctx) return;
        tctx.drawImage(src, 0, 0);
        let data;
        try {
          data = tctx.getImageData(0, 0, W, H).data;
        } catch (e) {
          return;
        }
        // Вертикальный арт (клинок стоймя): кончик — верхняя точка,
        // иначе — самый правый столбец (дульный срез).
        if (H > W * 1.2) {
          let minY = -1;
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              if (data[(y * W + x) * 4 + 3] >= 24) { minY = y; break; }
            }
            if (minY >= 0) break;
          }
          if (minY < 0 || minY > H * 0.5) return;
          let sumX = 0;
          let n = 0;
          for (let y = minY; y <= Math.min(H - 1, minY + 2); y++) {
            for (let x = 0; x < W; x++) {
              if (data[(y * W + x) * 4 + 3] >= 24) { sumX += x; n++; }
            }
          }
          if (!n) return;
          window.__gunTips[key] = { tx: (sumX / n + 0.5) / W, ty: (minY + 0.5) / H, W, H };
          found++;
          return;
        }
        let maxX = -1;
        for (let y = 0; y < H; y++) {
          for (let x = W - 1; x >= 0; x--) {
            if (data[(y * W + x) * 4 + 3] >= 24) {
              if (x > maxX) maxX = x;
              break;
            }
          }
        }
        if (maxX < W * 0.5) return;
        let sumY = 0;
        let n = 0;
        for (let y = 0; y < H; y++) {
          for (let x = Math.max(0, maxX - 2); x <= maxX; x++) {
            if (data[(y * W + x) * 4 + 3] >= 24) {
              sumY += y;
              n++;
            }
          }
        }
        if (!n) return;
        window.__gunTips[key] = { tx: (maxX + 0.5) / W, ty: (sumY / n + 0.5) / H, W, H };
        found++;
      } catch (e) { /* одно оружие не сломает загрузку */ }
    });
    if (found) console.info('[ART] кончиков стволов всего: ' + found);
  }

  // Пара цельных ног: левая + правая PNG. Если есть только правая —
  // клонируем её под оба ключа (независимые срезы). Кадры LEG_TOP/BOT
  // у каждой ноги свои. Клон — canvas, помечаем настоящим,
  // чтобы prepareCharacters его обрезал, а не выкинул как заглушку.
