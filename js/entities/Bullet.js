export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angle, damage, owner, range = 700) {
    super(scene, x, y, 'bullet');

    this.damage = damage;
    this.owner = owner;
    this.range = range;
    this.speed = 1700;
    this.distanceTravelled = 0;
    this._cols = [];

    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Пули летят ПОД оружием (4.2), но над телами.
    this.setDepth(4.1);

    this.setActive(true);
    this.setVisible(true);
    this.setCircle(3);
    this.setRotation(angle);
    this.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    if (this.body) {
      this.body.setAllowGravity(false);
      this.body.setImmovable(true);
    }
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    if (!this.active || !this.body) {
      return;
    }
    // На паузе/после конца матча пуля не «стареет»: иначе висящая в полёте
    // тихо исчезает, пока мир стоит.
    try {
      const sc = this.scene;
      if (sc && (sc.isPaused || sc.gameOver)) return;
    } catch (e) {}

    // k456 (ОТКАЧЕНО): считать дальность по фактическому смещению
    // (hypothesis: delta кадровый ≠ шаг физики). В headless правка дала
    // регресс (капсы 9->3, выстрелов вдвое больше) — гипотеза не
    // подтверждена, поведение пуль возвращено к speed*delta.
    this.distanceTravelled += this.speed * delta / 1000;

    const bounds = this.scene.physics.world.bounds;

    if (
      this.distanceTravelled >= this.range ||
      this.x < bounds.x - 50 ||
      this.x > bounds.x + bounds.width + 50 ||
      this.y < bounds.y - 50 ||
      this.y > bounds.y + bounds.height + 50
    ) {
      // k456: причина смерти пули (только счётчики, поведение не меняется).
      // bdRangeNear — пуля выработала дальность, НЕ долетев, при враге в 120px:
      // ровно симптом «пули уничтожаются раньше, чем долетают».
      try {
        const sc = this.scene;
        if (sc && sc._sawCounts) {
          if (this.distanceTravelled >= this.range) {
            sc._sawCounts.bdRange = (sc._sawCounts.bdRange || 0) + 1;
            let near = false;
            for (const t of (sc.players || [])) {
              if (!t || t === this.owner || t.dead || t.active === false) continue;
              if (t.team === (this.owner && this.owner.team)) continue;
              if (Math.hypot(t.x - this.x, t.y - this.y) < 120) { near = true; break; }
            }
            if (near) sc._sawCounts.bdRangeNear = (sc._sawCounts.bdRangeNear || 0) + 1;
            // Решающий тест: ближайший враг в 300px И угол между полётом и
            // направлением на него < 15° — пуля летела В него и всё равно
            // выработала дальность. Это и есть «не долетела».
            try {
              const bv = this.body && this.body.velocity;
              const bang = bv ? Math.atan2(bv.y, bv.x) : null;
              if (bang != null) {
                let bd2 = 1e9, pick = null;
                for (const t of (sc.players || [])) {
                  if (!t || t === this.owner || t.dead || t.active === false) continue;
                  if (t.team === (this.owner && this.owner.team)) continue;
                  const dd = Math.hypot(t.x - this.x, t.y - this.y);
                  if (dd < bd2) { bd2 = dd; pick = t; }
                }
                if (pick && bd2 < 300) {
                  const ta = Math.atan2(pick.y - this.y, pick.x - this.x);
                  let dif = Math.abs(bang - ta);
                  while (dif > Math.PI) dif = Math.abs(dif - Math.PI * 2);
                  if (dif < 15 * Math.PI / 180) sc._sawCounts.bdRangeAimed = (sc._sawCounts.bdRangeAimed || 0) + 1;
                }
              }
            } catch (eA) {}
          } else sc._sawCounts.bdBounds = (sc._sawCounts.bdBounds || 0) + 1;
        }
      } catch (e) {}
      this.deactivate();
    }
  }

  deactivate() {
    // Пула нет — отлетевшая пуля уничтожается полностью (иначе невидимки
    // копятся в display list весь матч).
    this.destroy();
  }

  // Коллайдеры пули движок сам не чистит: снимаем вручную, иначе каждый
  // выстрел навсегда оставляет ~3×N записей в мире физики и FPS умирает.
  _dropColliders() {
    try {
      const w = this.scene && this.scene.physics && this.scene.physics.world;
      if (this._cols && w) {
        this._cols.forEach(c => {
          try {
            w.removeCollider(c);
          } catch (e) { /* noop */ }
        });
      }
    } catch (e) { /* noop */ }
    this._cols = null;
  }

  destroy() {
    this._dropColliders();
    super.destroy();
  }
}
