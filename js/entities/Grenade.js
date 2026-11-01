export default class Grenade extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angle, type, owner) {
    // Цвет запечён в арт (generatePickupArt) — тинт убран, иначе в полёте
    // граната была зеленее, чем та же иконка в HUD.
    const texKey = type === 'frag' ? 'frag_granade' : 'smoke_granade';
    super(scene, x, y, scene.textures.exists(texKey) ? texKey : 'grenade');
    this.setScale(0.35);

    this.grenadeType = type;
    this.owner = owner;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.enable = false;

    this.setDepth(4);

    const speed = type === 'frag' ? 680 : 570;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 300;
    // Луна (п.14.2): гравитация гранат ×0.5 — летят дальше.
    try {
      this.gravity = (scene && Array.isArray(scene.mutators) && scene.mutators.includes('moon')) ? 460 : 920;
    } catch (e) { this.gravity = 920; }
    this.bounce = 0.45;
    this.onGround = false;
    // Кувырок вместо полёта носом по вектору (старый setRotation(atan2)
    // держал портретный PNG почти вертикально весь полёт).
    // Направление — от броска, темп 5–8 рад/с.
    const sdir = (this.vx || 0) >= 0 ? 1 : -1;
    this.spin = -sdir * (5 + Math.random() * 3);
    this.setRotation(Math.random() * Math.PI * 2);
    this.escapeGeometry();
    this.startX = this.x;
    this.maxTravel = 720;
    this._last = scene.time.now;
    this.bornAt = scene.time.now;

    this.fuseAt = scene.time.now + (type === 'frag' ? 1100 : 850);
    // Дымовуха: абсолютный таймаут (fuse+2с) — не лёг/не порвался,
    // рвём в текущей точке (см. update). frag не трогаем.
    this._smokeHardAt = type === 'smoke' ? this.fuseAt + 2000 : 0;
  }

  update(time) {
    if (this.dead || !this.active) return;
    try {
      const sc = this.scene;
      if (sc && (sc.isPaused || sc.gameOver)) return;
    } catch (e) {}

    if (this.body) {
      if (this.body.enable) {
        this.body.enable = false;
      }
    }

    const rawDt = Math.max(0, time - this._last);
    const dt = Math.min(100, rawDt) / 1000;
    this._last = time;

    const grdBefore = this.onGround;

    if (!this.onGround) {
      this.vy += this.gravity * dt;
    } else {
      // Качение по полу: было 22 (вставала как вкопанная за ~5 кадров).
      this.vx *= Math.max(0, 1 - 8 * dt);
      this.vy *= Math.max(0, 1 - 8 * dt);
    }

    if (Math.abs(this.x - this.startX) > this.maxTravel && Math.abs(this.vx) > 40) {
      this.vx *= 0.5;
    }

    const wasAir = !this.onGround;
    const frameStartY = this.y;

    const maxStep = 10;
    const chunks = Math.max(
      1,
      Math.ceil(
        Math.max(Math.abs(this.vx * dt), Math.abs(this.vy * dt)) / maxStep
      )
    );
    const sdt = dt / chunks;
    const vxBefore = this.vx;

    for (let i = 0; i < chunks; i++) {
      if (this.dead || !this.active) break;
      this.x += this.vx * sdt;
      this.y += this.vy * sdt;
      this.resolveChunk(sdt, frameStartY, wasAir);
      this.hitPlayers();
    }

    // Вращение: в полёте кувырок, на земле качение (vx/r), на покое —
    // доводка лёжа набок (арт портретный: 0 = стоит, ±90° = лежит).
    if (!this.onGround) {
      this.rotation += (this.spin || 0) * dt;
    } else if (Math.abs(this.vx) > 25) {
      this.rotation += (this.vx / 7) * dt;
    } else {
      const half = Math.PI / 2;
      const target = Math.round((this.rotation - half) / Math.PI) * Math.PI + half;
      let d = target - this.rotation;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.rotation += d * Math.min(1, 12 * dt);
    }
    // Удар о стену (смена знака vx) — кувырок меняет направление и гаснет.
    if (Math.sign(this.vx) !== Math.sign(vxBefore) && Math.abs(vxBefore) > 60) {
      this.spin = -(this.spin || 0) * 0.5;
    }
    // Приземление гасит кувырок.
    if (!grdBefore && this.onGround) {
      this.spin = (this.spin || 0) * 0.25;
    }

    this.floorLock();
    this.setPosition(this.x, this.y);

    if (
      this.x < 0 ||
      this.x > this.scene.mapWidth ||
      this.y > this.scene.mapHeight + 100
    ) {
      this.destroy();
      return;
    }

    if (time >= this.fuseAt) {
      if (this.grenadeType === 'frag') {
        this.scene.explodeGrenade(this, this.owner);
      } else if (this._resting()) {
        // Дымовая рвётся по таймеру, только лёжа на горизонтали:
        // в полёте/на стене ждём приземления (таймер уже истёк).
        this.scene.emitSmoke(this);
      }
    }
    // Вечная дымовуха: за fuse+2с так и не лёг — рвём в текущей точке.
    // Гард active/dead: обычный путь выше уже мог порвать в этом тике.
    if (this.grenadeType === 'smoke' && this.active && !this.dead &&
        this._smokeHardAt && time >= this._smokeHardAt) {
      this.scene.emitSmoke(this);
    }
  }

  // Лежит ли на горизонтальной опоре: onGround ставится только посадкой
  // сверху (или полом), стена/потолок его не дают. Плюс почти покой —
  // катящуюся на скорости не рвём, ждём остановки.
  _resting() {
    try {
      if (!this.onGround) return false;
      return Math.abs(this.vx || 0) < 80 && Math.abs(this.vy || 0) < 80;
    } catch (e) { return true; }
  }

  floorLock() {
    const groundTop = this.scene.mapHeight - 50;

    if (this.x + 7 > 0 && this.x - 7 < this.scene.mapWidth &&
        this.y + 7 >= groundTop - 1) {
      this.y = groundTop - 7;
      this.vy = 0;
      this.onGround = true;
    }
  }

  escapeGeometry() {
    const rects = [];
    this.collectRects(rects);

    for (let iter = 0; iter < 10; iter++) {
      let overlapped = false;

      for (const rect of rects) {
        if (
          this.x + 7 > rect.L && this.x - 7 < rect.R &&
          this.y + 7 > rect.T && this.y - 7 < rect.B
        ) {
          overlapped = true;

          const penL = this.x + 7 - rect.L;
          const penR = rect.R - (this.x - 7);
          const penT = this.y + 7 - rect.T;
          const penB = rect.B - (this.y - 7);

          // Бросок в упор в потолок над головой: выталкиваем вертикально,
          // а не в ближний торец (иначе граната «улетает в конец платформы»).
          const vertical = Math.abs(this.vy) > Math.abs(this.vx) * 1.5;
          const m = vertical ? Math.min(penT, penB) : Math.min(penL, penR, penT, penB);
          if (m === penL) this.x = rect.L - 7;
          else if (m === penR) this.x = rect.R + 7;
          else if (m === penT) this.y = rect.T - 7;
          else this.y = rect.B + 7;
          break;
        }
      }

      if (!overlapped) break;
    }
  }

  collectRects(out) {
    const push = group => {
      if (!group) return;
      group.getChildren().forEach(o => {
        const b = o.body;
        if (!b || !b.enable) return;
        out.push({
          L: b.x,
          R: b.x + b.width,
          T: b.y,
          B: b.y + b.height
        });
      });
    };
    push(this.scene.platforms);
    push(this.scene.covers);
  }

  // Отскок от бойцов (своих и чужих): граната бьётся о персонажей,
  // а не пролетает сквозь. Урона касанием нет — только взрыв по таймеру.
  // Тело мягкое: отскок слабее, чем от стен (0.18 против 0.45) —
  // иначе граната улетает обратно как от батута. Слабые тычки гасим
  // в ноль — граната падает вниз, а не дёргается.
  // Кинувшего игнорируем первые 200мс (старт из рук).
  hitPlayers() {
    try {
      const list = (this.scene && this.scene.players) || [];
      if (!list.length) return;
      const r = 7;
      const pb = 0.18;
      const now = this.scene.time.now;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p || p.dead || !p.active || !p.body) continue;
        if (p === this.owner && now - (this.bornAt || 0) < 200) continue;
        const b = p.body;
        const L = b.x, R = b.x + b.width, T = b.y, B = b.y + b.height;
        const nx = Math.max(L, Math.min(this.x, R));
        const ny = Math.max(T, Math.min(this.y, B));
        const dx = this.x - nx, dy = this.y - ny;
        if (dx * dx + dy * dy > r * r) continue;
        // Выталкиваем по минимальной оси и мягко отражаем скорость.
        const penL = (this.x + r) - L, penR = R - (this.x - r);
        const penT = (this.y + r) - T, penB = B - (this.y - r);
        const m = Math.min(penL, penR, penT, penB);
        if (m === penL) { this.x = L - r; this.vx = -Math.abs(this.vx) * pb; }
        else if (m === penR) { this.x = R + r; this.vx = Math.abs(this.vx) * pb; }
        else if (m === penT) { this.y = T - r; this.vy = -Math.abs(this.vy) * pb; this.onGround = false; }
        else { this.y = B + r; this.vy = Math.abs(this.vy) * pb; this.onGround = false; }
        if (Math.abs(this.vx) < 60) this.vx = 0;
        if (Math.abs(this.vy) < 60) this.vy = 0;
      }
    } catch (e) {}
  }

  resolveChunk(sdt, frameStartY, wasAir) {
    const r = 7;
    const rects = [];
    this.collectRects(rects);
    if (!rects.length) return;

    const prevX = this.x - this.vx * sdt;
    const prevY = this.y - this.vy * sdt;

    rects.forEach(rect => {
      // ВСЕ платформы твёрдые, включая тонкие (8–16): иначе граната
      // пролетает ярус насквозь на скорости (баг «бросок через платформу»
      // из приседа). Пропускаем только мусорные осколки <4px.
      if (rect.B - rect.T < 4) return;

      if (
        this.onGround &&
        this.y + r >= rect.T - 2 && this.y + r <= rect.T + 6 &&
        this.x + r > rect.L && this.x - r < rect.R
      ) {
        return;
      }

      const verticalIn = this.y + r > rect.T && this.y - r < rect.B;
      if (!verticalIn) return;

      const frameBottomPre = frameStartY + r;
      const bottomPre = this.y + r;

      if (this.vy > 0 && frameBottomPre <= rect.T + 3 && bottomPre >= rect.T - 1) {
        return;
      }

      if (this.vx > 0 && prevX - r <= rect.L && this.x - r >= rect.L) {
        this.x = rect.L - r;
        this.vx = -Math.abs(this.vx) * this.bounce;
      } else if (this.vx < 0 && prevX + r >= rect.R && this.x + r <= rect.R) {
        this.x = rect.R + r;
        this.vx = Math.abs(this.vx) * this.bounce;
      } else if (
        // Внутрь пролёта с боковым дрейфом: выносим к ближнему краю,
        // НО только не на взлёте (vy<0) — летящую вверх иначе швыряет
        // в конец платформы вместо отскока от потолка.
        this.vy >= 0 &&
        this.x - r >= rect.L &&
        this.x + r <= rect.R &&
        Math.abs(this.vx) > 0.01
      ) {
        const center = (rect.L + rect.R) / 2;
        if (this.x < center) {
          this.x = rect.L - r;
          this.vx = -Math.abs(this.vx) * this.bounce;
        } else {
          this.x = rect.R + r;
          this.vx = Math.abs(this.vx) * this.bounce;
        }
      }
    });

    const frameBottom = frameStartY + r;
    let landedTop = -Infinity;
    let ceilB = Infinity;

    rects.forEach(rect => {
      const horizontalIn =
        (this.x + r > rect.L && this.x - r < rect.R) ||
        (prevX + r > rect.L && prevX - r < rect.R);
      if (!horizontalIn) return;

      if (this.vy >= 0) {
        const bottom = this.y + r;

        if (frameBottom <= rect.T + 2 && bottom >= rect.T - 1) {
          if (rect.T > landedTop) landedTop = rect.T;
        }
      } else if (this.vy < 0) {
        const top = this.y - r;
        const prevTop = prevY - r;
        const frameStartTop = frameStartY - r;

        if (prevTop >= rect.B && top <= rect.B &&
            frameStartTop > rect.B) {
          if (rect.B < ceilB) ceilB = rect.B;
        }
      }
    });

    if (landedTop > -Infinity) {
      this.y = landedTop - r;
      // Жёсткая посадка — отскок от пола (было: втыкалась в ноль вместе
      // с горизонтальной скоростью). Мягкая — лечь и катиться.
      if (wasAir && this.vy > 260) {
        this.vy = -this.vy * this.bounce;
        this.onGround = false;
      } else {
        this.vy = 0;
        this.onGround = true;
        if (wasAir) this.vx *= 0.5;
      }
    } else if (ceilB < Infinity) {
      this.y = ceilB + r;
      this.vy = 0;
      this.onGround = false;
    } else if (this.onGround) {
      this.onGround = false;
    }
  }
}