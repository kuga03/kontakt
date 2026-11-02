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

    // Если флаг застрял внутри солида (часто на платформах при сбросе/спавне) —
    // сдвигаем его чуть выше, чтобы не проваливался в текстуру.
    try {
      if (this.scene && typeof this.scene._inSolid === 'function' && this.scene._inSolid(this.x, this.y, 6)) {
        const spot = this._escapeBody(this.x, this.y, true);
        if (spot) {
          this.setPosition(spot.x, spot.y);
          if (this.body) this.body.reset(spot.x, spot.y);
        }
      }
    } catch (e) {}
    this.body.setAllowGravity(false);
    // Маленькое тело у основания древка, а НЕ весь кадр (265x566):
    // большое тело цепляло платформы/землю в радиусе 100+px, физика
    // каждый шаг вышвыривала флаг с базы, стоявший рядом защитник
    // своей команды касался его — возврат срабатывал заново:
    // бесконечный спам «ФЛАГ ВОЗВРАЩЁН НА БАЗУ» (4-й уровень).
    // Подбор/возврат идут по дистанции (40x90), не по телу.
    try {
      const fw = (this.frame && this.frame.width) || 36;
      const fh = (this.frame && this.frame.height) || 77;
      const bw = Math.max(20, fw * 0.25), bh = Math.max(20, fh * 0.22);
      this.body.setSize(bw, bh);
      this.body.setOffset((fw - bw) / 2, fh - bh - 2);
    } catch (e) { try { this.body.setSize(this.width, this.height); } catch (e2) {} }
    // Потерянный флаг падает на землю: отскок + трение + границы мира.
    // Коллайдеры с платформами/ящиками вешает сцена (createModeObjects).
    try { this.body.setBounce(0.3); } catch (e) {}
    try { this.body.setDragX(300); } catch (e) {}
    try { this.body.setCollideWorldBounds(true); } catch (e) {}
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

    // Выталкиваем по РЕАЛЬНОМУ телу флага (маленький бокс у основания древка),
    // а НЕ по центру носильщика. Центр игрока у стены попадает в раздутую
    // клетку сетки твёрдости, и escapeSolid (ходит только ВВЕРХ) уводил флаг
    // наверх — он оказывался на платформе над головой вместо того, чтобы
    // лечь у ног. После броска на F флаг «подбрасывался» у стене и улетал
    // туда же. Флаг падает там, где был за спиной, в своё реальное тело.
    try { if (this.body) { this.body.enable = true; this.body.reset(this.x, this.y); } } catch (e) {}
    try {
      if (this.scene && this.body && typeof this.scene._inSolid === 'function') {
        const cx = this.body.x + this.body.width / 2;
        const cy = this.body.y + this.body.height / 2;
        if (this.scene._inSolid(cx, cy, 6)) {
          const spot = this._escapeBody(cx, cy, false);
          if (spot) {
            // Двигаем флаг так, чтобы свободной стала именно точка его тела.
            this.setPosition(this.x + (spot.x - cx), this.y + (spot.y - cy));
            try { this.body.reset(this.x, this.y); } catch (e2) {}
          } else {
            // Свободного места рядом нет — на базу, иначе флаг залипнет в текстуре.
            this.returnToBase();
            try { this._noPickupUntil = this.scene.time.now + 1000; } catch (e3) {}
            return;
          }
        }
      }
    } catch (e) {}
    try { this.carrier.isCarrier = false; this.carrier.isFlagCarrier = false; } catch (e) {}
    this.carrier = null;
    // Потерянный флаг падает на землю, а не висит в воздухе.
    // Тело включаем обратно (на носке было выключено от выталкиваний).
    try { if (!this.body.enable) this.body.enable = true; } catch (e) {}
    try { this.body.setAllowGravity(true); } catch (e) {}
    try { this.body.setVelocity(0, 0); } catch (e) {}
    try { this.droppedAt = this.scene ? this.scene.time.now : 0; } catch (e) {}
    // Секунда без подбора (как у бомбы): иначе сброс на F подбирается
    // обратно мгновенно, не отходя.
    try { this._noPickupUntil = (this.scene ? this.scene.time.now : 0) + 1000; } catch (e) {}
  }

  // Ищем свободную точку для тела флага. k464: порядок — ВНИЗ, затем бока,
  // затем ВВЕРХ не выше 54px (малый подъём, чтобы выйти из плиты, на которой
  // стоим). Раньше начиналось с «вверх до 216px» — флаг, выпавший под
  // платформой, перекидывался на неё («кинул вверх — перелетел через плиту»).
  // Перенос флага к ногам при сбросе пробовал — дал стоянки по 200с, откачен.
  _escapeBody(cx, cy, allowUp = true) {
    const scene = this.scene;
    const free = (x, y) => {
      try { return !scene._inSolid(x, y, 6); } catch (e) { return false; }
    };
    if (free(cx, cy)) return { x: cx, y: cy };
    for (let dy = 18; dy <= 216; dy += 18) {
      if (free(cx, cy + dy)) return { x: cx, y: cy + dy };
    }
    for (const dx of [-30, 30, -60, 60, -90, 90, -120, 120, -160, 160]) {
      for (const dy of [0, 18, 36]) {
        if (free(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
      }
    }
    if (!allowUp) return null;
    for (let dy = -18; dy >= -54; dy -= 18) {
      if (free(cx, cy + dy)) return { x: cx, y: cy + dy };
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
    // baseX/baseY не двигаем (это дом флага), правим только позу.
    try {
      if (this.scene && typeof this.scene._escapeSolid === 'function' &&
          typeof this.scene._inSolid === 'function' &&
          this.scene._inSolid(this.baseX, this.baseY, 10)) {
        const p = this.scene._escapeSolid(this.baseX, this.baseY, 10);
        this.setPosition(p.x, p.y);
      }
    } catch (e) {}
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
      // kXXX: флаг в свободном состоянии не должен висеть в пропасти,
      // падать сквозь геометрию или застревать у ящика — оттуда подбрать
      // его невозможно. Срочно перемещаем на свободную точку рядом
      // (откуда флаг достижим); если свободной точки рядом нет —
      // возвращаем на базу.
      if (this._flagStuck()) {
        try {
          const cx = this.body ? this.body.x + this.body.width / 2 : this.x;
          const cy = this.body ? this.body.y + this.body.height / 2 : this.y;
          const spot = this._escapeBody(cx, cy, false);
          if (spot) {
            this.setPosition(this.x + (spot.x - cx), this.y + (spot.y - cy));
            try { if (this.body) this.body.reset(this.x, this.y); } catch (e2) {}
          } else {
            this.returnToBase();
          }
        } catch (e) { this.carrier = null; }
      }
    }
  }

  // Флаг свободен, но его позиция недостижима для подбора: внутри солида,
  // ниже уровня мира (пропасть после броска/падения) — «застрял».
  // Возвращает true — нужно срочно переместить флаг.
  _flagStuck() {
    const scene = this.scene;
    try {
      if (!this.body || this.body.enable === false) return false;
      if (typeof scene._inSolid === 'function' && scene._inSolid(this.x, this.y, 8)) return true;
      const mh = scene.mapHeight || 3000;
      if (this.y > mh - 40) return true;
      return false;
    } catch (e) { return false; }
  }
}
