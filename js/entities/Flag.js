export default class Flag extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, team) {
    // Арт по команде (у игрока всегда синие — ally/foe совпадают).
    // Золотой флаг внезапной смерти — нейтральный арт с золотым тинтом.
    // Нет арта — запасной спрайт.
    let texKey = team === 'blue' ? 'flag_ally'
      : team === 'red' ? 'flag_foe' : 'flag_neutral';
    if (!scene.textures.exists(texKey)) {
      texKey = scene.textures.exists('flag_neutral') ? 'flag_neutral' : 'grenade';
    }
    super(scene, x, y, texKey);

    this.scene = scene;
    this.team = team;
    this.baseX = x;
    this.baseY = y;
    this.carrier = null;
    // Кулдаун подбора после сброса (как у бомбы _noPickupUntil): сброшенный
    // на F флаг не хватается обратно в ту же секунду — надо отойти/кинуть.
    this._noPickupUntil = 0;
    // Флаг на древке: ~30x64, +20% → 36x77 (лежит в древке).
    try { this.setDisplaySize(36, 77); } catch (e) {}
    if (team === 'gold') {
      try { this.setTint(0xffd24a); } catch (e) {}
    }
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Компактное физическое тело у основания древка (ширина 24px, высота 32px в мировых координатах):
    // достаточная толщина, чтобы гарантированно не проваливаться сквозь 16px платформы
    // и швы между блоками при падении.
    try {
      const fw = (this.frame && this.frame.width) || 36;
      const fh = (this.frame && this.frame.height) || 77;
      const sx = this.scaleX || 1, sy = this.scaleY || 1;
      const bw = Math.min(fw, Math.max(16, 24 / sx));
      const bh = Math.min(fh, Math.max(20, 32 / sy));
      this.body.setSize(bw, bh);
      this.body.setOffset((fw - bw) / 2, fh - bh - 2);
    } catch (e) { try { this.body.setSize(this.width, this.height); } catch (e2) {} }
    // Потерянный флаг падает на землю: минимальный отскок (без заклиниваний в потолках),
    // быстрое гашение горизонтальной скорости.
    try { this.body.setBounce(0.05); } catch (e) {}
    try { this.body.setDragX(350); } catch (e) {}
    try { this.body.setCollideWorldBounds(true); } catch (e) {}
    this.body.setAllowGravity(false);

    // Если флаг застрял внутри солида при спавне — сдвигаем его на поверхность
    try {
      if (this.body) this.body.updateFromGameObject();
      const cx = this.body ? this.body.x + this.body.width / 2 : this.x;
      const cy = this.body ? this.body.y + this.body.height / 2 : this.y;
      const isSolid = typeof scene._inSolidExact === 'function'
        ? scene._inSolidExact(cx, cy, 0)
        : (typeof scene._inSolid === 'function' ? scene._inSolid(cx, cy, -2) : false);
      if (isSolid) {
        const spot = this._escapeBody(cx, cy, true);
        if (spot) {
          this.setPosition(this.x + (spot.x - cx), this.y + (spot.y - cy));
          if (this.body) this.body.updateFromGameObject();
        }
      }
    } catch (e) {}
  }

  pickUp(player) {
    if (!player || player.dead || !player.active) return;
    if (!this.carrier && player.team !== this.team) {
      this.carrier = player;
      // Синхронный флаг для ИИ в ТЕКУЩЕМ кадре (AI запускается ДО _updateFlags).
      try { player.isCarrier = true; } catch (e) {}
      // Флаг носителя флага — отдельный маркер от бомбы.
      try { player.isFlagCarrier = true; } catch (e) {}
      // В руках не падает.
      try { this.body.setAllowGravity(false); } catch (e) {}
      try { this.body.setVelocity(0, 0); } catch (e) {}
      // Флаг не влияет на скорость носильщика
      try { } catch (e) {}
    }
  }

  drop() {
    if (!this.carrier) {
      return;
    }

    try { this.carrier.isCarrier = false; this.carrier.isFlagCarrier = false; } catch (e) {}
    this.carrier = null;

    // Включаем тело и гравитацию — потерянный флаг падает на землю
    try { if (!this.body.enable) this.body.enable = true; } catch (e) {}
    try { this.body.setAllowGravity(true); } catch (e) {}
    try { this.body.setVelocity(0, 0); } catch (e) {}
    try { this.droppedAt = this.scene ? this.scene.time.now : 0; } catch (e) {}
    // Секунда без подбора (как у бомбы): иначе сброс на F подбирается
    // обратно мгновенно, не отходя.
    try { this._noPickupUntil = (this.scene ? this.scene.time.now : 0) + 1000; } catch (e) {}

    // Если основание флага при сбросе попало в плиту или стену — выталкиваем на поверхность
    try {
      if (this.scene && this.body) {
        this.body.updateFromGameObject();
        const cx = this.body.x + this.body.width / 2;
        const cy = this.body.y + this.body.height / 2;
        const isSolid = typeof this.scene._inSolidExact === 'function'
          ? this.scene._inSolidExact(cx, cy, 0)
          : (typeof this.scene._inSolid === 'function' ? this.scene._inSolid(cx, cy, -2) : false);

        if (isSolid) {
          const spot = this._escapeBody(cx, cy, true);
          if (spot) {
            this.setPosition(this.x + (spot.x - cx), this.y + (spot.y - cy));
            this.body.updateFromGameObject();
            this.body.setVelocity(0, 0);
          }
        }
      }
    } catch (e) {}
  }

  // Ищем свободную точку для тела флага при попадании в геометрию.
  // 1. ВВЕРХ (на поверхность платформы/пола) с шагом 4..44px — флаг при падении
  //    касается верхней грани платформы. Выход вверх возвращает его ровно на поверхность,
  //    не давая провалиться сквозь тонкие (16px) плиты.
  // 2. В стороны (если застрял в вертикальном укрытии или ящике).
  // 3. Вниз (только если сверху глухой потолок).
  _escapeBody(cx, cy, allowUp = true) {
    const scene = this.scene;
    const isSolid = (x, y) => {
      try {
        if (typeof scene._inSolidExact === 'function') return scene._inSolidExact(x, y, 0);
        if (typeof scene._inSolid === 'function') return scene._inSolid(x, y, -2);
        return false;
      } catch (e) { return false; }
    };
    if (!isSolid(cx, cy)) return { x: cx, y: cy };

    // 1. ВВЕРХ на поверхность платформы/пола (малые шаги)
    if (allowUp) {
      for (const dy of [-4, -8, -12, -16, -20, -28, -36, -44]) {
        if (!isSolid(cx, cy + dy)) return { x: cx, y: cy + dy };
      }
    }

    // 2. В стороны (вертикальные укрытия/ящики)
    for (const dx of [-16, 16, -32, 32, -48, 48, -64, 64]) {
      for (const dy of [0, -8, -16, 8]) {
        if (!isSolid(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
      }
    }

    // 3. Вниз (если сверху потолок)
    for (const dy of [12, 24, 36, 48]) {
      if (!isSolid(cx, cy + dy)) return { x: cx, y: cy + dy };
    }

    return null;
  }

  returnToBase() {
    try {
      if (this.carrier) {
        this.carrier.isCarrier = false;
        this.carrier.isFlagCarrier = false;
      }
    } catch (e) {}
    this.carrier = null;
    try { if (!this.body.enable) this.body.enable = true; } catch (e) {}
    try { this.body.setAllowGravity(false); } catch (e) {}
    try { this.body.setVelocity(0, 0); } catch (e) {}
    this.setPosition(this.baseX, this.baseY);
    // Сбрасываем таймер броска: иначе автовозврат по 22с смотрит
    // на старый droppedAt и может сработать сразу после возврата.
    try { this.droppedAt = this.scene ? this.scene.time.now : 0; } catch (e) {}
    // Точка базы внутри геометрии — вытолкнуть наверх: иначе коллайдер
    // вышвырнет флаг и начнётся цикл «возврат-касание-возврат».
    try {
      if (this.scene && typeof this.scene._escapeSolid === 'function' &&
          typeof this.scene._inSolid === 'function' &&
          this.scene._inSolid(this.baseX, this.baseY, 10)) {
        const p = this.scene._escapeSolid(this.baseX, this.baseY, 10);
        this.setPosition(p.x, p.y);
      }
    } catch (e) {}
    try { if (this.body) this.body.updateFromGameObject(); } catch (e2) {}
  }

  update() {
    if (this.carrier && this.carrier.dead) {
      try { this.drop(); } catch (e) { this.carrier = null; }
      return;
    }
    if (this.carrier && !this.carrier.dead) {
      try { this.body.setAllowGravity(false); } catch (e) {}
      // На время носки тело выключаем: иначе физика каждый кадр
      // выталкивает флаг из стен рядом с носильщиком — он «улетает»
      // в сторону независимо от разворота. Включаем обратно в drop().
      try { if (this.body.enable) this.body.enable = false; } catch (e) {}
      // Всегда за спиной впритык: сторона — от ВИЗУАЛЬНОГО разворота
      // (_getSide с мёртвой зоной ±24 — по нему же смотрят тело/руки/ствол).
      // flipX без зоны щёлкает раньше/позже тела — флаг оказывался спереди.
      // Целим ДРЕВКОМ, а не центром кадра: в арте (265px) шест у правого
      // края (~x252), при показе 36px это +16 от центра. Без поправки шест
      // улетал на 30px вбок и читался как «флаг не за спиной».
      let dir = 1;
      try {
        const c0 = this.carrier;
        if (c0 && typeof c0._getSide === 'function') {
          dir = c0._getSide() || 1;
        } else if (c0 && typeof c0.flipX === 'boolean') {
          dir = c0.flipX ? -1 : 1;
        } else if (c0 && typeof c0.aimX === 'number' && typeof c0.x === 'number') {
          dir = c0.aimX >= c0.x ? 1 : -1;
        }
      } catch (e) {}
      const POLE_DX = 16;
      this.setPosition(this.carrier.x - dir * 14 - POLE_DX, this.carrier.y - 38);
      // В дыму носильщик гаснет — флаг гаснет вместе с ним.
      // ВАЖНО: читаем _smokeHidden, а НЕ carrier.alpha — базовый спрайт
      // бойца всегда alpha 0 (тело — отдельные картинки), поэтому флаг
      // был невидим ВСЁ время носки.
      try {
        const a = this.carrier._smokeHidden ? 0 : 1;
        if (this.alpha !== a) this.alpha = a;
      } catch (e) {}
    } else if (!this.carrier) {
      try { if (this.alpha !== 1) this.alpha = 1; } catch (e) {}
      // Флаг в свободном состоянии не должен висеть в пропасти под картой или застревать в платформе.
      // Если тело застряло — выталкиваем на ближайшую поверхность;
      // если улетел в бездну ниже карты — возвращаем на базу.
      if (this._flagStuck()) {
        try {
          const mh = this.scene ? (this.scene.mapHeight || 3000) : 3000;
          if (this.y > mh - 40) {
            this.returnToBase();
          } else {
            const cx = this.body ? this.body.x + this.body.width / 2 : this.x;
            const cy = this.body ? this.body.y + this.body.height / 2 : this.y;
            const spot = this._escapeBody(cx, cy, true);
            if (spot) {
              this.setPosition(this.x + (spot.x - cx), this.y + (spot.y - cy));
              if (this.body) {
                this.body.updateFromGameObject();
                this.body.setVelocity(0, 0);
              }
            } else {
              this.returnToBase();
            }
          }
        } catch (e) { this.carrier = null; }
      }
    }
  }

  // Флаг свободен, но его тело глубоко застряло в солиде или провалилось в бездну под картой.
  _flagStuck() {
    const scene = this.scene;
    try {
      if (!this.body || this.body.enable === false) return false;
      const mh = scene.mapHeight || 3000;
      if (this.y > mh - 40) return true;
      const cx = this.body.x + this.body.width / 2;
      const cy = this.body.y + this.body.height / 2;
      if (typeof scene._inSolidExact === 'function') {
        return scene._inSolidExact(cx, cy, 0);
      }
      if (typeof scene._inSolid === 'function') {
        return scene._inSolid(cx, cy, -2);
      }
      return false;
    } catch (e) { return false; }
  }
}
