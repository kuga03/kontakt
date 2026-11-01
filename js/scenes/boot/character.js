
export function prepareCharacters() {
    window.__realTextures = new Set();
    window.__chrCrops = window.__chrCrops || {};

    // Одна PNG на обе ноги: клонируем под второй ключ ДО обрезки, чтобы
    // у каждой ноги были свои кадры среза и свои kneeL/kneeR.
    this._cloneFullLeg();

    let cachedCrops = null;
    try {
      cachedCrops = JSON.parse(localStorage.getItem('chrCrops_v1') || 'null');
    } catch (e) {}

    const KEYS = ['chr_torso', 'chr_head', 'chr_cap', 'chr_shoes', 'chr_arms',
      'chr_arm_up', 'chr_arm_fore', 'chr_arm_fore_l', 'chr_arm_fore_r',
      'chr_hand', 'chr_hand_l', 'chr_hand_r',
      'chr_pants_leg_l', 'chr_pants_leg_r',
      'jeans_left', 'jeans_right',
      'olive_pants', 'olive_pants_l', 'olive_pants_r'];

    let cropsChanged = false;

    KEYS.forEach(key => {
      if (!this.textures.exists(key)) return;
      let srcImg;
      try {
        srcImg = this.textures.get(key).getSourceImage();
      } catch (e) {
        return;
      }
      if (!srcImg) return;
      const loaded = this._loadedPngKeys && this._loadedPngKeys.has(key);
      const isCanvas = srcImg instanceof HTMLCanvasElement;
      if (!loaded && isCanvas) return;
      window.__realTextures.add(key);

      if (key === 'chr_torso') {
        const cacheKey = key + '_color_v1';
        let cachedColor = null;
        try { cachedColor = localStorage.getItem(cacheKey); } catch (e) {}
        if (cachedColor) {
          window.__chrTorsoColor = parseInt(cachedColor, 10);
        } else {
          const c = this.averageShoulderColor(srcImg, key);
          if (c) {
            window.__chrTorsoColor = c;
            try { localStorage.setItem(cacheKey, String(c)); } catch (e) {}
          }
        }
      }

      const cropCacheKey = key + '_' + srcImg.width + 'x' + srcImg.height;
      if (cachedCrops && cachedCrops[cropCacheKey]) {
        window.__chrCrops[key] = cachedCrops[cropCacheKey];
        if (!this.textures.exists(key + '_crop')) {
          this.cropCharacterTexture(key);
        }
      } else {
        const crop = this.cropCharacterTexture(key);
        if (crop) {
          const data = { w: crop.w, h: crop.h, ox: crop.ox, oy: crop.oy };
          window.__chrCrops[key] = data;
          cropsChanged = true;
          try {
            const all = cachedCrops || {};
            all[cropCacheKey] = data;
            localStorage.setItem('chrCrops_v1', JSON.stringify(all));
          } catch (e) {}
        } else {
          console.warn('[ART] crop failed:', key);
        }
      }
    });

    if (this._realLegs && this.textures.exists('chr_legs_run')) {
      window.__realTextures.add('chr_legs_run');
    }
    if (this.textures.exists('chr_legs_walk')) {
      window.__realTextures.add('chr_legs_walk');
    }
    // Одной строкой (не сворачиваемым массивом): сразу видно, чего не хватает.
    // Норма: chr_torso, chr_head, chr_cap, chr_shoes, chr_arm_fore_l,
    // chr_arm_fore_r, chr_pants_leg_l, chr_pants_leg_r, jeans_left, jeans_right.
    const _rt = [...window.__realTextures].filter(k => k.startsWith('chr') || k.startsWith('jeans'));
    console.info('[ART] real textures (' + _rt.length + '): ' + _rt.join(', '));
    console.info('[ART] crops (' + Object.keys(window.__chrCrops).length + '): ' + Object.keys(window.__chrCrops).join(', '));
  }

  // Отдельные кадры бега сшиваем в один лист chr_legs_run,
  // дальше с ним работает обычная нарезка L0..L5.
export function _cloneFullLeg() {
    try {
      if (!this.textures.exists('olive_pants')) return;
      if (this.textures.exists('olive_pants_l')) return;
      if (this.textures.exists('olive_pants_r')) return;
      const src = this.textures.get('olive_pants').getSourceImage();
      if (!src || !src.width || !src.height) return;
      const t = this.textures.createCanvas('olive_pants_r', src.width, src.height);
      if (!t || !t.context) {
        this.textures.remove('olive_pants_r');
        return;
      }
      t.context.drawImage(src, 0, 0);
      t.refresh();
      this._loadedPngKeys.add('olive_pants_r');
      console.info('[ART] olive_pants → olive_pants_r (одна PNG на обе ноги)');
    } catch (e) {
      console.warn('[ART] clone full leg failed:', e);
    }
  }

export function averageShoulderColor(src, key) {
    const cw = src.width;
    const ch = src.height;
    if (!cw || !ch) return null;
    const scan = this.textures.createCanvas(key + '_scan', cw, ch);
    const tctx = scan.context;
    tctx.clearRect(0, 0, cw, ch);
    tctx.drawImage(src, 0, 0);
    let data;
    try {
      data = tctx.getImageData(0, 0, cw, ch).data;
    } catch (e) {
      scan.destroy();
      return null;
    }
    let r = 0, g = 0, b = 0, cnt = 0;
    const limitY = Math.floor(ch * 0.35);
    for (let y = 0; y < limitY; y++) {
      for (let x = 0; x < cw; x++) {
        const i = (y * cw + x) * 4;
        if (data[i + 3] < 24) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        cnt++;
      }
    }
    scan.destroy();
    if (!cnt) return null;
    return ((Math.round(r / cnt) & 255) << 16) | ((Math.round(g / cnt) & 255) << 8) | (Math.round(b / cnt) & 255);
  }

export function cropCharacterTexture(key) {
    const src = this.textures.get(key).getSourceImage();
    if (!src || !src.width || !src.height) return null;
    const cw = src.width;
    const ch = src.height;

    const scanName = key + '_scan';
    const tmp = this.textures.createCanvas(scanName, cw, ch);
    const tctx = tmp.context;
    tctx.clearRect(0, 0, cw, ch);
    tctx.drawImage(src, 0, 0);

    let data;
    try {
      data = tctx.getImageData(0, 0, cw, ch).data;
    } catch (e) {
      tmp.destroy();
      return null;
    }

    let minX = cw, minY = ch, maxX = -1, maxY = -1, sx = 0, sy = 0, cnt = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (data[(y * cw + x) * 4 + 3] < 12) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sx += x;
        sy += y;
        cnt++;
      }
    }
    tmp.destroy();
    if (maxX < 0 || cnt === 0) return null;

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const tex = this.textures.createCanvas(key + '_crop', w, h);
    const ctx = tex.context;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(src, minX, minY, w, h, 0, 0, w, h);
    tex.refresh();

    return {
      w,
      h,
      ox: sx / cnt - minX,
      oy: sy / cnt - minY
    };
  }

  // Рисованные укрытия/заграждения (стиль игры, чётко под хитбокс):
  // бочка, железные/стальные стены, колючка, рабица, ежи. PNG-файлы больше
  // не грузятся (см. списки выше) — всегда печём кодом в статическую текстуру.
  // Возвращает true, если нарисовано.
