import { playShellClick, playReloadSequence, clearReloadSfx } from '../data/shellClick.js?v=171';

export default class Weapon {
  constructor(config) {
    config = config || {};
    this.name = config.name;
    this.category = config.category;
    this.damage = Number(config.damage) || 10;
    this.fireRate = Number(config.fireRate) || 600;
    this.range = config.range;
    this.ammoType = config.ammoType;
    this.magazineSize = Math.max(0, Number(config.magazineSize) || 0);
    this.reloadTime = Number(config.reloadTime) || 1000;
    this.spreadDeg = config.spreadDeg != null ? config.spreadDeg : 2.0;
    this.isMelee = config.category === 'melee';
    // Трубка без отъёмного магазина (помпы, обрез, винчестер, M1918,
    // револьвер, RPG): патроны заряжаются поштучно, заряженное НЕ
    // выбрасывается, выстрел прерывает дозарядку (как у дробовиков).
    this.noMag = !!config.noMag && !this.isMelee;
    // Дробь: число дробинок в конусе + урон/разброс каждой.
    // Без этих полей все дробовики били одиночными!
    this.pellets = config.pellets || 1;
    this.pelletDamage = config.pelletDamage || null;
    this.pelletSpreadDeg = config.pelletSpreadDeg ?? null;

    this.magazine = this.magazineSize;
    this.reserveAmmo = Number(config.reserveAmmo) || 0;
    this._initMagazine = this.magazineSize;
    this._initReserve = this.reserveAmmo;
    // Очередь: сколько патронов уходит за один спуск (1 — обычный огонь).
    // Пауза между пулями — из длительности звука выстрела (см. Player),
    // принудительно — burstGapMs. Темп спуска (fireRate) при очереди —
    // пауза между очередями, а не между пулями.
    this.burst = Math.max(1, Math.floor(config.burst) || 1);
    this.burstGapMs = Number(config.burstGapMs) || 0;
    this.lastShotAt = 0;
    this.reloading = false;
    this.fireRateMult = 1;
    this.reloadMult = 1;
    this.infiniteAmmo = this.isMelee;
    this._reloadToken = null;
  }

  canShoot(time) {
    return (
      !this.reloading &&
      (this.infiniteAmmo || this.magazine > 0) &&
      time >= this.lastShotAt + this.fireRate * this.fireRateMult
    );
  }

  // Сток запаса — 2 полных магазина (выдаёт addWeapon, см. Player).
  // Ближний бой бесконечный — ему лимит не нужен.
  maxReserve() {
    if (this.isMelee) return 0;
    return Math.max(0, (this.magazineSize | 0) * 2);
  }

  shoot(time) {
    if (!this.canShoot(time)) {
      return false;
    }

    this.lastShotAt = time;
    if (!this.infiniteAmmo) {
      this.magazine -= 1;
    }
    return true;
  }

  reload(onComplete, scene) {
    if (
      this.reloading ||
      this.infiniteAmmo ||
      this.magazine >= this.magazineSize ||
      this.reserveAmmo <= 0
    ) {
      return;
    }

    this.reloading = true;
    // Ручной перезапуск (R / пустой магазин) гасит флаг прерывания
    // выстрелом: дальше заряжаемся штатно до конца или до нового выстрела.
    this._tubeInterrupted = false;
    const token = {};
    this._reloadToken = token;
    // Трубка: заряжаем поштучно, остаток в стволе сохраняется.
    if (this.noMag) {
      this._reloadTube(onComplete, scene, token);
      return;
    }
    const delay = this.reloadTime * this.reloadMult;
    const sc = scene || this._scene;
    if (sc && sc.time && typeof sc.time.delayedCall === 'function') {
      this._scene = sc;
    }

    // Таймер храним, чтобы cancelReload мог его убить: иначе перезарядка
    // переживает рестарт сцены и мутирует выброшенный объект.
    this._clearReloadTimer();
    // Звук перезарядки магазина: staged-последовательность
    // (см. shellClick) — масштабируется тем же delay, гасится
    // отменой вместе с таймером. Позиция — от владельца.
    try {
      const ow0 = this._owner;
      const sc0 = this._scene;
      const px0 = ow0 && Number.isFinite(ow0.x) ? ow0.x : (sc0 && sc0.player && sc0.player.x);
      const py0 = ow0 && Number.isFinite(ow0.y) ? ow0.y : (sc0 && sc0.player && sc0.player.y);
      this._reloadSfx = playReloadSequence(sc0, this.name, px0, py0, delay);
    } catch (e) {
      this._reloadSfx = null;
    }
    const finish = () => {
      this._reloadTimer = null;
      this._reloadEndsAt = 0;
      if (this._reloadToken !== token) return;

      // Тактическая перезарядка: остаток в магазине СГОРАЕТ (как в CS) —
      // вставляется полный магазин из запаса, недобитое не возвращается.
      const loaded = Math.min(this.magazineSize, this.reserveAmmo);

      this.magazine = loaded;
      this.reserveAmmo -= loaded;
      this.reloading = false;

      if (onComplete) {
        onComplete();
      }
    };
    if (this._scene && this._scene.time && typeof this._scene.time.delayedCall === 'function') {
      try {
        this._reloadEndsAt = this._scene.time.now + delay;
      } catch (e) {
        this._reloadEndsAt = Date.now() + delay;
      }
      this._reloadTimer = this._scene.time.delayedCall(delay, finish);
    } else {
      this._reloadEndsAt = Date.now() + delay;
      this._reloadTimer = setTimeout(finish, delay);
    }
  }

  // Поштучная зарядка трубки: каждый патрон занимает
  // reloadTime / magazineSize, т.е. полная зарядка пустой трубки длится
  // ровно столько же, сколько старая тактическая перезарядка — ДПМ не
  // меняется. Недозаряженное добивается быстрее (только недостающие),
  // заряженное не сгорает. Прерывается выстрелом (см. Player.shoot).
  _reloadTube(onComplete, scene, token) {
    const sc = scene || this._scene;
    if (sc && sc.time && typeof sc.time.delayedCall === 'function') {
      this._scene = sc;
    }
    const need = Math.min(this.magazineSize - this.magazine, this.reserveAmmo);
    if (need <= 0) {
      this.reloading = false;
      this._reloadToken = null;
      return;
    }
    const shellTime = (this.reloadTime * this.reloadMult) / Math.max(1, this.magazineSize);
    this._tubeLeft = need;
    this._tubeOnComplete = (typeof onComplete === 'function') ? onComplete : null;
    this._clearReloadTimer();
    this._tubeTick(token, shellTime);
  }

  _tubeTick(token, shellTime) {
    if (this._reloadToken !== token) return;
    try {
      this._reloadEndsAt = this._now() + Math.max(1, (this._tubeLeft || 0)) * shellTime;
    } catch (e) {
      this._reloadEndsAt = 0;
    }
    this._reloadTimer = this._delay(shellTime, () => {
      this._reloadTimer = null;
      if (this._reloadToken !== token) return;
      if (this.reserveAmmo > 0 && this.magazine < this.magazineSize) {
        this.magazine += 1;
        this.reserveAmmo -= 1;
        // Клац заряженного патрона (у каждого ствола свой, см. shellClick).
        // Позиция — от владельца, чужие трубки тише по дистанции.
        try {
          const ow = this._owner;
          const sc = this._scene;
          const px = ow && Number.isFinite(ow.x) ? ow.x : (sc && sc.player && sc.player.x);
          const py = ow && Number.isFinite(ow.y) ? ow.y : (sc && sc.player && sc.player.y);
          playShellClick(sc, this.name, px, py);
        } catch (e) {}
      }
      this._tubeLeft = Math.max(0, (this._tubeLeft || 1) - 1);
      const done = this._tubeLeft <= 0 || this.reserveAmmo <= 0 || this.magazine >= this.magazineSize;
      if (done) {
        this._tubeLeft = 0;
        this._reloadEndsAt = 0;
        this.reloading = false;
        const cb = this._tubeOnComplete;
        this._tubeOnComplete = null;
        if (cb) cb();
      } else {
        this._tubeTick(token, shellTime);
      }
    });
  }

  _delay(ms, fn) {
    const sc = this._scene;
    if (sc && sc.time && typeof sc.time.delayedCall === 'function') {
      try { return sc.time.delayedCall(ms, fn); } catch (e) {}
    }
    return setTimeout(fn, ms);
  }

  _clearReloadTimer(keepSfx) {
    const t = this._reloadTimer;
    this._reloadTimer = null;
    if (t) {
      try {
        if (typeof t.remove === 'function') t.remove();
        else clearTimeout(t);
      } catch (e) {
        try { clearTimeout(t); } catch (e2) {}
      }
    }
    // Звуковые таймеры гасим вместе с логикой (смена ствола/отмена),
    // но на паузе оставляем: scene-таймеры фризятся вместе с таймером
    // перезарядки и продолжают сами (см. pauseReload/resumeReload).
    if (keepSfx !== true) {
      try { clearReloadSfx(this._reloadSfx); } catch (e) {}
      this._reloadSfx = null;
    }
  }

  _now() {
    try {
      if (this._scene && this._scene.time && typeof this._scene.time.now === 'number') {
        return this._scene.time.now;
      }
    } catch (e) {}
    return Date.now();
  }

  cancelReload() {
    this._clearReloadTimer();
    this._reloadEndsAt = 0;
    this._reloadRemain = 0;
    this._reloadToken = null;
    // Трубка: уже заряженные патроны остаются (не сгорают).
    this._tubeLeft = 0;
    this._tubeOnComplete = null;
    this.reloading = false;
  }

  // Пауза игры: замораживаем перезарядку (реальное время иначе дотикает).
  // Звук оставляем на таймерах сцены — они фризятся вместе с логикой.
  pauseReload() {
    if (!this.reloading || !this._reloadTimer) return;
    this._reloadRemain = Math.max(0, (this._reloadEndsAt || 0) - this._now());
    this._clearReloadTimer(true);
  }

  resumeReload() {
    if (!this.reloading || this._reloadTimer || !(this._reloadRemain > 0)) return;
    // Трубка: продолжаем поштучную цепочку, а не тактический сброс
    // (иначе пауза сжигала бы заряженное).
    if (this.noMag && (this._tubeLeft | 0) > 0) {
      const token = this._reloadToken;
      const shellTime = (this.reloadTime * this.reloadMult) / Math.max(1, this.magazineSize);
      this._reloadRemain = 0;
      this._tubeTick(token, shellTime);
      return;
    }
    const token = this._reloadToken;
    const ms = this._reloadRemain;
    this._reloadRemain = 0;
    const finish = () => {
      this._reloadTimer = null;
      this._reloadEndsAt = 0;
      if (this._reloadToken !== token) return;
      // Тот же тактический сброс остатка, что в reload() выше.
      const loaded = Math.min(this.magazineSize, this.reserveAmmo);
      this.magazine = loaded;
      this.reserveAmmo -= loaded;
      this.reloading = false;
    };
    if (this._scene && this._scene.time && typeof this._scene.time.delayedCall === 'function') {
      try {
        this._reloadEndsAt = this._scene.time.now + ms;
      } catch (e) {
        this._reloadEndsAt = Date.now() + ms;
      }
      this._reloadTimer = this._scene.time.delayedCall(ms, finish);
    } else {
      this._reloadEndsAt = Date.now() + ms;
      this._reloadTimer = setTimeout(finish, ms);
    }
  }

  resetAmmo() {
    this.cancelReload();
    this.magazine = this._initMagazine;
    this.reserveAmmo = this._initReserve;
  }

}
