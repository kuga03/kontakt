import Player from './Player.js';
import { classAbilities } from '../data/abilities.js';

export default class Tank extends Player {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, {
      ...config,
      maxHp: 150,
      maxArmor: 100,
      moveSpeed: 170,
      primary: config.primary || 'M249'
    });

    this.hp = this.maxHp;
    this.armor = this.maxArmor;
    this.abilityName = 'Броня';
    this.hasAbility = true;

    const ab = classAbilities.Tank;
    if (!ab || !ab.name) { console.warn('[Tank] no classAbilities.Tank'); }
    else {
      this.ultName = ab.name;
      this.ultDuration = ab.duration;
      this.ultUnlockLevel = ab.unlockLevel;
    }
    this._baseMoveSpeed = this.moveSpeed;
  }

  activateAbility() {
    this.throwAbility('armor');
  }

  activateUltimate() {
    this.damageTakenMult = 0.3;
    this.damageMult = 1.25;
    this.moveSpeed = Math.round(this._baseMoveSpeed * 1.4);

    // Эффект «СТАЛЬ»: ровное холодное свечение брони + купол-шиммер,
    // волны от шагов, закалка при уроне. Без мигания — монолит светится
    // спокойно и уверенно. Лицо не трогаем, ноги ярче всех.
    // Тинты запоминаем как есть (у ботов — цвет команды) и возвращаем
    // в _clearUltFx, а не красим в цвета игрока.
    try {
      const sc = this.scene;
      this._clearUltFx();
      // Цели: тело без лица + ноги отдельно (их — ярче всех).
      const tg = this._ultGlowTargets();
      this._ultGlow = tg;
      const saved = new Map();
      [...tg.body, ...tg.legs].forEach(p => {
        try {
          if (p && !saved.has(p)) {
            const rec = this._glowRead(p);
            if (rec) saved.set(p, rec);
          }
        } catch (e) {}
      });
      this._ultSavedTints = saved;
      const paintSteel = () => {
        try {
          const glow = this._ultGlow || { body: [], legs: [] };
          glow.body.forEach(p => { try { this._glowPaint(p, 0xcfe0ff, 0xcfe0ff); } catch (e) {} });
          glow.legs.forEach(p => { try { this._glowPaint(p, 0xffffff, 0xffffff); } catch (e) {} });
        } catch (e) {}
      };
      paintSteel();
      this._ultFxParts = [];
      const track = (o) => { try { this._ultFxParts.push(o); } catch (e) {} return o; };
      this._steelTex();
      // Старт: глухой удар — вспышка, волна по земле, встряска (своя).
      // В дыму (гост) — без салюта, чтобы не светить позицию.
      if (!this._smokeHidden) {
        const flash = track(sc.add.image(this.x, this.y - 10, '__steel_glow').setDepth(15).setTint(0xf4f8ff).setAlpha(0.9));
        flash.setScale(0.4);
        sc.tweens.add({
          targets: flash, scaleX: 2.4, scaleY: 2.4, alpha: 0, duration: 350,
          onComplete: () => { try { flash.destroy(); } catch (e) {} }
        });
        const ring = track(sc.add.circle(this.x, this.y + 20, 16, 0xcfdcff, 0).setDepth(15));
        try { ring.setStrokeStyle(4, 0xcfdcff, 0.85); } catch (e) {}
        sc.tweens.add({
          targets: ring, scaleX: 7, scaleY: 7, alpha: 0, duration: 600, ease: 'Cubic.Out',
          onComplete: () => { try { ring.destroy(); } catch (e) {} }
        });
      }
      try {
        if (this === sc.player) sc.cameras.main.shake(140, 0.005);
      } catch (e) {}
      // Купол-марево следом: холодное, дышит медленно и едва заметно.
      const shell = track(sc.add.image(this.x, this.y, '__steel_glow').setDepth(3).setTint(0xbcd2f0).setAlpha(0));
      shell.setScale(0.3);
      sc.tweens.add({ targets: shell, scaleX: 1.35, scaleY: 1.35, alpha: 0.3, duration: 600, ease: 'Cubic.Out' });
      sc.tweens.add({
        targets: shell, delay: 600, scaleX: 1.44, scaleY: 1.44,
        duration: 4000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
      });
      this._ultShell = shell;
      this._ultHp = this.hp;
      this._ultPx = this.x;
      this._ultPy = this.y;
      this._ultStepAt = 0;
      // Доведение купола за телом (50мс): update тикает только медиков.
      this._ultFollowT = sc.time.addEvent({
        delay: 50, repeat: -1,
        callback: () => {
          if (!this.active || this.dead) return;
          try {
            if (this._ultShell && this._ultShell.active) this._ultShell.setPosition(this.x, this.y);
          } catch (e) {}
        }
      });
      this._auraTick = sc.time.addEvent({
        delay: 260,
        repeat: -1,
        callback: () => {
          if (!this.active || this.dead) return;
          try {
            const now = sc.time.now;
            // В дыму (гост) купол не светим — твины не трогаем, только visible.
            const ghosted = !!this._smokeHidden;
            try {
              if (this._ultShell && this._ultShell.active) this._ultShell.setVisible(!ghosted);
            } catch (e) {}
            if (ghosted) return;
            // Закалка: свежая рана — короткая белая вспышка-кольцо
            // («удар по камню»), броня будто затвердевает.
            try {
              const hp = this.hp | 0;
              if (hp < (this._ultHp | 0)) {
                this._ultHp = hp;
                const hk = track(sc.add.circle(this.x, this.y - 10, 14, 0xffffff, 0.7).setDepth(15));
                sc.tweens.add({
                  targets: hk, scaleX: 3.4, scaleY: 3.4, alpha: 0, duration: 300,
                  onComplete: () => { try { hk.destroy(); } catch (e) {} }
                });
              }
            } catch (e) {}
            // Шаги гиганта: сдвинулся — волна по земле + пыль с холодом.
            // Чем быстрее идёт, тем гуще вихрь.
            try {
              const dx = this.x - (this._ultPx || this.x), dy = this.y - (this._ultPy || this.y);
              const step = Math.hypot(dx, dy);
              this._ultPx = this.x;
              this._ultPy = this.y;
              if (step > 14 && now - (this._ultStepAt || 0) > 550) {
                this._ultStepAt = now;
                const wr = track(sc.add.circle(this.x, this.y + 24, 12, 0x9fb8d8, 0).setDepth(6));
                try { wr.setStrokeStyle(3, 0x9fb8d8, 0.7); } catch (e) {}
                sc.tweens.add({
                  targets: wr, scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 700, ease: 'Cubic.Out',
                  onComplete: () => { try { wr.destroy(); } catch (e) {} }
                });
                const dusty = Math.min(3, 1 + Math.floor(step / 40));
                for (let i = 0; i < dusty; i++) {
                  const m = track(sc.add.image(
                    this.x + Phaser.Math.Between(-30, 30), this.y + Phaser.Math.Between(10, 30),
                    '__steel_glow').setDepth(6).setTint(0xcfd8e8).setAlpha(0.35));
                  m.setScale(0.15 + Math.random() * 0.15);
                  sc.tweens.add({
                    targets: m,
                    x: '+=' + Phaser.Math.Between(-30, 30), y: '-=' + Phaser.Math.Between(20, 50),
                    alpha: 0, duration: 800 + Math.random() * 400,
                    onComplete: () => { try { m.destroy(); } catch (e) {} }
                  });
                }
              }
            } catch (e) {}
          } catch (e) {}
        }
      });
    } catch (e) { /* эффект не роняет ульту */ }

    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} }
    this._ultTimer = this.scene.time.delayedCall(8000, () => {
      if (!this.scene) return;
      this.damageTakenMult = 1;
      this.damageMult = this._diffDmgMult || 1;
      this.moveSpeed = this._baseMoveSpeed;
      this._ultTimer = null;
      // Финал плавный: броня «сходит» — купол тает, потом чистка.
      try {
        if (this._auraTick) { try { this._auraTick.remove(); } catch (e) {} this._auraTick = null; }
        const sh = this._ultShell;
        if (sh) { try { this.scene.tweens.killTweensOf(sh); } catch (e) {} }
        this.scene.tweens.add({
          targets: (sh && sh.active) ? sh : [],
          alpha: 0, duration: 500,
          onComplete: () => { try { this._clearUltFx(); } catch (e) {} }
        });
        this.scene.time.delayedCall(650, () => { try { this._clearUltFx(); } catch (e) {} });
      } catch (e) { try { this._clearUltFx(); } catch (e2) {} }
    });
  }

  // Мягкий спрайт стали: градиент. Печётся один раз.
  _steelTex() {
    try {
      if (this.scene.textures.exists('__steel_glow')) return;
      const S = 128;
      this.scene.textures.createCanvas('__steel_glow', S, S);
      const c = this.scene.textures.get('__steel_glow').getSourceImage().getContext('2d');
      const grd = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grd;
      c.fillRect(0, 0, S, S);
      this.scene.textures.get('__steel_glow').refresh();
    } catch (e) {}
  }

  // Снять эффект и вернуть тинты как были (командные у ботов).
  _clearUltFx() {
    if (this._auraTick) {
      try { this._auraTick.remove(); } catch (e) {}
      this._auraTick = null;
    }
    if (this._ultFollowT) {
      try { this._ultFollowT.remove(); } catch (e) {}
      this._ultFollowT = null;
    }
    try {
      (this._ultFxParts || []).forEach(o => {
        try { this.scene.tweens.killTweensOf(o); } catch (e) {}
        try { if (o && o.active !== false) o.destroy(); } catch (e) {}
      });
    } catch (e) {}
    this._ultFxParts = [];
    this._ultShell = null;
    try {
      if (this._ultSavedTints) {
        this._ultSavedTints.forEach((rec, p) => {
          try { this._glowRestore(p, rec); } catch (e) {}
        });
        this._ultSavedTints = null;
      }
    } catch (e) {}
    this._ultGlow = null;
    this._ultPhase = false;
  }

  die(killer) {
    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} this._ultTimer = null; }
    try { this.moveSpeed = this._baseMoveSpeed; } catch (e) {}
    try { this._clearUltFx(); } catch (e) {}
    super.die(killer);
  }

  destroy(fromScene) {
    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} this._ultTimer = null; }
    try { this._clearUltFx(); } catch (e) {}
    super.destroy(fromScene);
  }
}
