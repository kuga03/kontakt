import Player from './Player.js?v=384';
import { classAbilities } from '../data/abilities.js?v=169';

export default class Assault extends Player {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, {
      ...config,
      maxHp: 100,
      maxArmor: 40,
      moveSpeed: 250,
      primary: config.primary || 'bad_ak47'
    });

    this.abilityName = 'Сумка с патронами';
    this.hasAbility = true;

    const ab = classAbilities.Assault;
    if (!ab || !ab.name) { console.warn('[Assault] no classAbilities.Assault'); }
    else {
      this.ultName = ab.name;
      this.ultDuration = ab.duration;
      this.ultUnlockLevel = ab.unlockLevel;
    }
  }

  activateAbility() {
    // _abilityTargetX ставит ИИ, когда делится с конкретным голодающим.
    const tx = (typeof this._abilityTargetX === 'number') ? this._abilityTargetX : null;
    this._abilityTargetX = null;
    this.throwAbility('ammo', 80, tx);
  }

  activateUltimate() {
    const w = this.weapon;
    if (!w) return;
    this._wasMelee = !!w.isMelee;
    this._ultWeapon = w;
    w.fireRateMult = 0.5;
    w.infiniteAmmo = true;
    this.damageTakenMult = 0.5;

    this._savedPartsTint = this._partsTint || 0xffffff;
    this._savedHeadTint = this.head ? this.head.fillColor : null;
    // Цели пульса: тело без лица + ноги отдельно (их — ярче).
    // Лицо краснеет от ярости как раньше — отдельно ниже.
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
    this._ultPhase = false;
    try {
      if (this.headImg) {
        const rec = this._glowRead(this.headImg);
        if (rec && !saved.has(this.headImg)) saved.set(this.headImg, rec);
      }
    } catch (e) {}
    // Раскалённый тинт один раз (без мигания): тело — оранжевое,
    // ноги — ярче, морда краснеет. Откат — штатным _clearAuraTint.
    const paintHot = () => {
      try {
        const glow = this._ultGlow || { body: [], legs: [] };
        glow.body.forEach(p => { try { this._glowPaint(p, 0xff6a33, 0xff6a33); } catch (e) {} });
        glow.legs.forEach(p => { try { this._glowPaint(p, 0xff9a66, 0xff9a66); } catch (e) {} });
        if (this.head && this.head.setFillStyle) this.head.setFillStyle(0xff3333, 1);
        if (this.headImg) this._glowPaint(this.headImg, 0xff3333, 0xff3333);
        if (this.capImg) this._glowPaint(this.capImg, 0xff6a33, 0xff6a33);
        if (this.torso) this._glowPaint(this.torso, 0xff6a33, 0xff6a33);
      } catch (e) {}
    };
    this._paintUltRed = paintHot;
    paintHot();
    this._ultKills = this.kills | 0;

    // Берсерк-визуал (ТЗ): ударная вспышка, жаркое марево следом,
    // разряды, пар, пульсация в такт стрельбе, выдох в конце.
    // Без postFX — спрайты/твины/графика. Чистится _clearUltFx.
    try {
      this._rageTex();
      this._ultFxParts = [];
      const track = (o) => { try { this._ultFxParts.push(o); } catch (e) {} return o; };
      // Старт: вспышка + кольцо ударной волны. Тряска — только своя
      // (чужие берсерки камеру не дёргают). В дыму (гост) — без салюта,
      // чтобы не светить позицию.
      if (!this._smokeHidden) {
        const flash = track(this.scene.add.image(this.x, this.y, '__rage_glow').setDepth(6).setTint(0xfff2cc).setAlpha(1));
        flash.setScale(0.5);
        this.scene.tweens.add({
          targets: flash, scaleX: 2.4, scaleY: 2.4, alpha: 0, duration: 220,
          onComplete: () => { try { flash.destroy(); } catch (e) {} }
        });
        const ring = track(this.scene.add.circle(this.x, this.y, 24, 0xffa04a, 0).setDepth(6));
        this.scene.tweens.add({
          targets: ring, scaleX: 5, scaleY: 5, alpha: 0.5, duration: 200,
          onComplete: () => { try { ring.destroy(); } catch (e) {} }
        });
        this.scene.tweens.add({ targets: ring, alpha: 0, duration: 500 });
      }
      try {
        if (this === this.scene.player) this.scene.cameras.main.shake(120, 0.004);
      } catch (e) {}
      // Жаркое марево следом + тлеющая земля под ногами.
      const glow = track(this.scene.add.image(this.x, this.y, '__rage_glow').setDepth(3).setTint(0xff5a22).setAlpha(0));
      glow.setScale(0.3);
      this.scene.tweens.add({ targets: glow, scaleX: 1.1, scaleY: 1.1, alpha: 0.34, duration: 500, ease: 'Cubic.Out' });
      this._ultGlowFx = glow;
      const scorch = track(this.scene.add.image(this.x, this.y + 26, '__rage_glow').setDepth(2).setTint(0xff3a12).setAlpha(0));
      scorch.setScale(0.3);
      this.scene.tweens.add({ targets: scorch, scaleX: 1.5, scaleY: 0.55, alpha: 0.4, duration: 500, ease: 'Cubic.Out' });
      this._ultScorch = scorch;
      // Разряды — одна графика, перерисовка по тику.
      const fx = track(this.scene.add.graphics().setDepth(6));
      this._ultFxG = fx;
      // Доведение за телом: update() у штурмовика не вызывается
      // (GameScene тикает только медиков), поэтому свой таймер 50мс.
      this._ultFollowT = this.scene.time.addEvent({
        delay: 50, repeat: -1,
        callback: () => {
          if (!this.active || this.dead) return;
          try {
            // Напряжение: дрожь ±2px поверх позиции.
            const jx = (Math.random() - 0.5) * 4, jy = (Math.random() - 0.5) * 4;
            if (this._ultGlowFx && this._ultGlowFx.active) this._ultGlowFx.setPosition(this.x + jx, this.y + jy);
            if (this._ultScorch && this._ultScorch.active) this._ultScorch.setPosition(this.x, this.y + 26);
          } catch (e) {}
        }
      });
    } catch (e) { /* визуал не роняет ульту */ }

    this._auraTick = this.scene.time.addEvent({
      delay: 220,
      repeat: -1,
      callback: () => {
        if (!this.active || this.dead) return;
        try {
          const now = this.scene.time.now;
          // В дыму (гост) марево не светим — твины не трогаем, только visible.
          const ghosted = !!this._smokeHidden;
          try {
            if (this._ultGlowFx && this._ultGlowFx.active) this._ultGlowFx.setVisible(!ghosted);
            if (this._ultScorch && this._ultScorch.active) this._ultScorch.setVisible(!ghosted);
          } catch (e) {}
          if (ghosted) return;
          // Пульсация в такт стрельбе: свежий выстрел — ярче и чаще.
          let hot = false;
          try {
            const w = this._ultWeapon || this.weapon;
            hot = (now - ((w && w.lastShotAt) || 0)) < 500;
          } catch (e) {}
          const base = hot ? 0.46 : 0.32;
          const amp = hot ? 0.14 : 0.08;
          const a = base + amp * Math.sin(now * (hot ? 0.02 : 0.011));
          try {
            if (this._ultGlowFx && this._ultGlowFx.active) {
              this._ultGlowFx.setAlpha(Math.max(0.12, a));
              const s = 1.1 * (1 + 0.05 * Math.sin(now * (hot ? 0.02 : 0.011)));
              this._ultGlowFx.setScale(s, s);
            }
            if (this._ultScorch && this._ultScorch.active) {
              this._ultScorch.setAlpha(Math.max(0.15, a + 0.06));
            }
          } catch (e) {}
          // Подпитка убийством: короткая белая вспышка.
          try {
            const k = this.kills | 0;
            if (k > (this._ultKills | 0)) {
              this._ultKills = k;
              const kf = this.scene.add.image(this.x, this.y, '__rage_glow').setDepth(6).setTint(0xffffff).setAlpha(0.8);
              kf.setScale(0.8);
              try { this._ultFxParts.push(kf); } catch (e) {}
              this.scene.tweens.add({
                targets: kf, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 180,
                onComplete: () => { try { kf.destroy(); } catch (e) {} }
              });
            }
          } catch (e) {}
          // Разряды вокруг тела + пар вверх.
          try {
            const g = this._ultFxG;
            if (g && g.active) {
              g.clear();
              const n = hot ? 4 : 2;
              for (let i = 0; i < n; i++) {
                const sa = Math.random() * Math.PI * 2;
                const sr = 22 + Math.random() * 26;
                const x1 = this.x + Math.cos(sa) * sr, y1 = this.y + Math.sin(sa) * sr * 0.8;
                const x2 = x1 + (Math.random() - 0.5) * 26, y2 = y1 + (Math.random() - 0.5) * 26;
                g.lineStyle(2, i % 2 ? 0xffe9a8 : 0xff7a2a, 0.9);
                g.lineBetween(x1, y1, x2, y2);
              }
            }
          } catch (e) {}
          if (Math.random() < 0.4) {
            try {
              const st = this.scene.add.image(
                this.x + Phaser.Math.Between(-18, 18), this.y + Phaser.Math.Between(-10, 20),
                '__rage_glow').setDepth(6).setTint(0xbbbbbb).setAlpha(0.3);
              try { this._ultFxParts.push(st); } catch (e) {}
              this.scene.tweens.add({
                targets: st, y: st.y - 46, alpha: 0, duration: 900,
                onComplete: () => { try { st.destroy(); } catch (e) {} }
              });
            } catch (e) {}
          }
        } catch (e) {}
      }
    });

    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} }
    this._ultTimer = this.scene.time.delayedCall(10000, () => {
      if (!this.scene) return;
      this._revertUltimate();
    });
  }

  // Мягкий спрайт жара: градиент (ядро → растворение). Печётся один раз.
  _rageTex() {
    try {
      if (this.scene.textures.exists('__rage_glow')) return;
      const S = 128;
      this.scene.textures.createCanvas('__rage_glow', S, S);
      const c = this.scene.textures.get('__rage_glow').getSourceImage().getContext('2d');
      const grd = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.45, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grd;
      c.fillRect(0, 0, S, S);
      this.scene.textures.get('__rage_glow').refresh();
    } catch (e) {}
  }

  _revertUltimate() {
    const w = this._ultWeapon || this.weapon;
    if (w) {
      w.fireRateMult = 1;
      // Нож и так бесконечный: откат не должен гасить infiniteAmmo у мили.
      w.infiniteAmmo = this._wasMelee ? true : false;
    }
    this.damageTakenMult = 1;
    this._clearAuraTint();
    // Выдох: серый пар вверх, ярость гаснет.
    try {
      this._rageTex();
      const ex = this.scene.add.image(this.x, this.y - 10, '__rage_glow').setDepth(6).setTint(0x999999).setAlpha(0.4);
      ex.setScale(0.7);
      this.scene.tweens.add({
        targets: ex, y: ex.y - 60, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 700,
        onComplete: () => { try { ex.destroy(); } catch (e) {} }
      });
    } catch (e) {}
    this._clearUltFx();
    if (this._auraTick) {
      try { this._auraTick.remove(); } catch (e) {}
      this._auraTick = null;
    }
    if (this._ultTimer) {
      this._ultTimer = null;
    }
    this._ultWeapon = null;
  }

  // Чистка берсерк-визуала (тинты — отдельно в _clearAuraTint).
  _clearUltFx() {
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
    this._ultGlowFx = null;
    this._ultScorch = null;
    this._ultFxG = null;
  }

  die(killer) {
    try { this._revertUltimate(); } catch (e) {
      if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e2) {} this._ultTimer = null; }
      if (this._auraTick) { try { this._auraTick.remove(); } catch (e2) {} this._auraTick = null; }
    }
    super.die(killer);
  }

  destroy(fromScene) {
    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} this._ultTimer = null; }
    if (this._auraTick) { try { this._auraTick.remove(); } catch (e) {} this._auraTick = null; }
    try { this._clearUltFx(); } catch (e) {}
    super.destroy(fromScene);
  }

  // Честный откат: вернуть тинты как были (у ботов — командные),
  // а не красить всех в цвета игрока.
  _clearAuraTint() {
    try {
      if (this._ultSavedTints) {
        this._ultSavedTints.forEach((rec, p) => {
          try { this._glowRestore(p, rec); } catch (e) {}
        });
        this._ultSavedTints = null;
      }
      if (this._savedHeadTint != null && this.head && this.head.setFillStyle) {
        this.head.setFillStyle(this._savedHeadTint, 1);
      }
    } catch (e) {}
    this._ultGlow = null;
    this._paintUltRed = null;
    this._ultPhase = false;
  }
}
