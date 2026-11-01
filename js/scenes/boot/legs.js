import { GENERATED } from './config.js';
export function makeLegsWalkSheet() {
    const key = 'chr_legs_walk';
    const def = GENERATED[key];
    if (!def || def.kind !== 'chrWalkFrames') return;
    const frames = def.frames;
    const imgs = [];
    for (let i = 0; i < frames; i++) {
      const fk = key + '_' + i;
      const t = this.textures.exists(fk) ? this.textures.get(fk) : null;
      const img = t ? t.getSourceImage() : null;
      if (!img || !img.width || !img.height) return; // не все кадры есть — фолбэк
      imgs.push(img);
    }
    const fw = Math.max(...imgs.map(im => im.width));
    const fh = Math.max(...imgs.map(im => im.height));
    if (fw < 4 || fh < 4) return;
    if (this.textures.exists(key)) return;
    this.textures.createCanvas(key, fw * frames, fh);
    const ctx = this.textures.get(key).getSourceImage().getContext('2d');
    // кадры выравниваем по низу и центру ячейки (ширины могут чуть отличаться)
    imgs.forEach((im, i) => {
      ctx.drawImage(im, i * fw + (fw - im.width) / 2, fh - im.height);
    });
    const tex2 = this.textures.get(key);
    for (let i = 0; i < frames; i++) {
      tex2.add('W' + i, 0, i * fw, 0, fw, fh);
    }
    tex2.refresh();
    window.__legsFrameCount = frames;
    window.__chrCrops = window.__chrCrops || {};
    window.__chrCrops[key] = { w: fw, h: fh, ox: 0, oy: 0 };
    window.__realTextures = window.__realTextures || new Set();
    window.__realTextures.add(key);
    window.__legsGhostClean = false;
    window.__rebuildLegsWalk = (clean) => {
      window.__legsGhostClean = !!clean;
    };
    console.info('[ART] legs walk built from frames:', fw + 'x' + fh, 'x' + frames, '=>',
      key, '(sheet ' + (fw * frames) + 'x' + fh + ')');
  }

export function _detectSheetLayout(W, H, n, colsHint, rowsHint) {
    if (colsHint && rowsHint) {
      const fw = W / colsHint;
      const fh = H / rowsHint;
      if (colsHint * rowsHint === n && Math.floor(fw) === fw && Math.floor(fh) === fh && fw >= 4 && fh >= 4) {
        return { cols: colsHint, rows: rowsHint, fw, fh };
      }
    }
    const found = [];
    for (let rows = 1; rows <= n; rows++) {
      if (n % rows !== 0) continue;
      const cols = n / rows;
      const fw = W / cols;
      const fh = H / rows;
      if (Math.floor(fw) === fw && Math.floor(fh) === fh && fw >= 4 && fh >= 4) {
        found.push({ cols, rows, fw, fh });
      }
    }
    // приоритет: одна строка (обычный случай), затем больше колонок
    found.sort((a, b) => (a.rows - b.rows) || (b.cols - a.cols));
    return found[0] || null;
  }

export function makeLegsRunFrames() {
    const key = 'chr_legs_run';
    this._realLegs = false;
    const def = GENERATED[key];
    if (!def || def.kind !== 'chrRunFrames') return;
    const frames = def.frames;
    const imgs = [];
    for (let i = 0; i < frames; i++) {
      const fk = key + '_' + i;
      const t = this.textures.exists(fk) ? this.textures.get(fk) : null;
      const img = t ? t.getSourceImage() : null;
      if (!img || !img.width || !img.height) return; // не все кадры есть — фолбэк
      imgs.push(img);
    }
    const fw = Math.max(...imgs.map(im => im.width));
    const fh = Math.max(...imgs.map(im => im.height));
    if (fw < 4 || fh < 4) return;
    this.textures.createCanvas(key, fw * frames, fh);
    const ctx = this.textures.get(key).getSourceImage().getContext('2d');
    // кадры выравниваем по низу и центру ячейки (ширины могут чуть отличаться)
    imgs.forEach((im, i) => {
      ctx.drawImage(im, i * fw + (fw - im.width) / 2, fh - im.height);
    });
    imgs.forEach((_, i) => this.textures.remove(key + '_' + i));
    this._realLegs = true;
    window.__realTextures = window.__realTextures || new Set();
    window.__realTextures.add(key);
    console.info('[ART] legs run built from frames:', fw + 'x' + fh, 'x' + frames, '=>', key);
  }

  // Спрайтшит бега: 6 кадров одной строкой. Нарезаем кадры 'L0'..'L5'
  // и запоминаем размер кадра для масштабирования части «Ноги».
export function makeLegsSheet() {
    window.__chrCrops = window.__chrCrops || {};
    const key = 'chr_legs_run';
    const def = GENERATED[key];
    if (!this.textures.exists(key)) return;
    const tex = this.textures.get(key);
    const src = tex.getSourceImage();
    const frameCount = def.frames;
    let fw = src && src.width ? Math.floor(src.width / frameCount) : 0;
    let fh = src ? src.height : 0;
    if (!src || fw < 4 || fh < 4 || fw * frameCount > src.width + fw) {
      // лист не нарезается (например, ширины кадров дробные) — собираем заготовку
      this.textures.remove(key);
      this.generateRunSheet(key, def);
      return this.makeLegsSheet();
    }
    for (let i = 0; i < frameCount; i++) {
      tex.add('L' + i, 0, i * fw, 0, fw, fh);
    }
    tex.refresh();
    window.__chrCrops[key] = { w: fw, h: fh, ox: 0, oy: 0 };
    console.info('[ART] legs sheet frames:', fw + 'x' + fh, 'x' + frameCount, 'real=' + !!this._realLegs);
  }

  // Красные точки хвата на оружии: художник ставит на PNG красное
  // (кисть/заливка 3×3 минимум): левая точка = задняя рукоятка, правая =
  // цевьё/передняя. Допуск по цвету (не только чистый #FF0000 — сойдёт и
  // мягкая кисть), но группа обязана быть КОМПАКТНОЙ (<=12px): ржавчина
  // и красные мелочи арта размазаны и отбрасываются.
  // Одна точка = обе кисти на ней (пистолеты). Позиции запоминаем в долях арта
  // (window.__gunGrips[texKey] = {rx,ry,fx,fy,W,H}), сами точки стираем —
  // в игре их не видно. Без точек — табличный хват из rigConfig.
  // PNG оружия грузятся обычными image-текстурами (без getContext), поэтому
  // сканируем через временный canvas, а стёртую версию кладём обратно
  // canvas-текстурой с тем же ключом (до первого использования — безопасно).
  // Диагностика: window.__gunDotDbg[key] = {reds, kept} — видно в редакторе.
export function generateChrPart(key, part, w, h) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    if (part === 'shoes') {
      g.fillRoundedRect(0, 0, 14, 7, 3);
    } else if (part === 'head') {
      g.fillCircle(10, 11, 8);
      g.fillCircle(4, 9, 2.5);
      g.fillCircle(16, 9, 2.5);
    } else if (part === 'cap') {
      g.fillRoundedRect(1, 0, 20, 5, 2);
      g.fillRect(1, 3, 20, 3);
    } else if (part === 'torso') {
      // Профиль вправо (манекен/фолбэк): спина тёмная слева, грудь вперёд.
      g.fillStyle(0xdde7ee, 1);
      g.fillEllipse(w * 0.3, h * 0.5, w * 0.26, h * 0.76);
      g.fillStyle(0xf2f4f8, 1);
      g.fillEllipse(w * 0.47, h * 0.5, w * 0.55, h * 0.87);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(w * 0.6, h * 0.47, w * 0.3, h * 0.6);
      g.fillStyle(0x2b2b4f, 0.9);
      g.fillCircle(w * 0.6, h * 0.72, 1.4);
    } else if (part === 'arms') {
      g.fillRoundedRect(1, 2, 7, 24, 3);
    }
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // Фолбэк для листа бега: обеих ног нет — рисуем 6 простых кадров бега
export function generateRunSheet(key, def) {
    const fw = def.w;
    const fh = def.h;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const hipY = Math.floor(fh * 0.35);
    for (let i = 0; i < def.frames; i++) {
      const x = i * fw;
      const ph = Math.sin((i / def.frames) * Math.PI * 2);
      const hipX = x + Math.floor(fw * 0.5) - 2;
      g.lineStyle(4, 0xffffff, 1);
      // левая нога
      g.beginPath();
      g.moveTo(hipX, hipY);
      g.lineTo(hipX - 3 + ph * 6, fh - 4);
      g.strokePath();
      // правая нога (противофаза)
      g.beginPath();
      g.moveTo(hipX + 6, hipY);
      g.lineTo(hipX + 7 - ph * 6, fh - 4);
      g.strokePath();
      // ступни
      g.fillStyle(0x9aa7b3, 1);
      g.fillRect(hipX - 7 + ph * 6 - 1, fh - 6, 7, 4);
      g.fillRect(hipX + 2 - ph * 6, fh - 6, 7, 4);
    }
    g.generateTexture(key, def.frames * fw, fh);
    g.destroy();
  }
