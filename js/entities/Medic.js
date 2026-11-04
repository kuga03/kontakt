import Player from './Player.js';
import { classAbilities } from '../data/abilities.js';

export default class Medic extends Player {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, {
      ...config,
      maxHp: 90,
      maxArmor: 30,
      moveSpeed: 245,
      primary: config.primary || 'UZI'
    });

    this.abilityName = 'Аптечка';
    this.hasAbility = true;

    const ab = classAbilities.Medic;
    if (!ab || !ab.name) { console.warn('[Medic] no classAbilities.Medic'); }
    else {
      this.ultName = ab.name;
      this.ultDuration = ab.duration;
      this.ultUnlockLevel = ab.unlockLevel;
    }
  }

  activateAbility() {
    this.throwAbility('medkit');
  }

  activateUltimate() {
    if (this._ultTick) { try { this._ultTick.remove(); } catch (e) {} this._ultTick = null; }
    const tick = this.scene.time.addEvent({
      delay: 400,
      repeat: 19,
      callback: () => {
        if (!this.scene || this.scene.isPaused) {
          return;
        }
        const nearby = this.scene.players.filter(p => (
          !p.dead &&
          p.team === this.team &&
          Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y) <= 200
        ));
        nearby.forEach(p => p.heal(6, this));
      }
    });
    this._ultTick = tick;
    // Живая аура (ТЗ): купол из мягких слоёв, волны, подъёмные частицы,
    // нити к союзникам. Механика та же (R=200, тики выше); чистится _clearUltFx.
    // Без postFX — только спрайты/твины (слабые ПК не просаживаются).
    try {
      const R = 200;
      this._clearUltFx();
      this._auraTex();
      this._ultFxParts = [];
      const track = (o) => { try { this._ultFxParts.push(o); } catch (e) {} return o; };
      // Старт: яркая вспышка + резкое разворачивание купола.
      // В дыму (гост) — без салюта, чтобы не светить позицию.
      if (!this._smokeHidden) {
        const flash = track(this.scene.add.image(this.x, this.y - 20, '__medic_aura').setDepth(16).setTint(0xf4fff4).setAlpha(0.9));
        flash.setScale(0.3);
        this.scene.tweens.add({
          targets: flash, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 450,
          onComplete: () => { try { flash.destroy(); } catch (e) {} }
        });
      }
      // Слои купола: ядро / тело / дымка. Дышат с разным периодом.
      this._ultLayers = [];
      const mkLayer = (r, tint, alpha, period) => {
        const img = track(this.scene.add.image(this.x, this.y, '__medic_aura').setDepth(14).setTint(tint).setAlpha(0));
        const growTo = (r * 2) / 128;
        img.setScale(0.2);
        this.scene.tweens.add({
          targets: img, scaleX: growTo, scaleY: growTo * 0.92, alpha,
          duration: 700, ease: 'Cubic.Out'
        });
        this.scene.tweens.add({
          targets: img, delay: 700,
          scaleX: growTo * 1.07, scaleY: growTo * 0.98, duration: period,
          ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });
        this._ultLayers.push(img);
        return img;
      };
      mkLayer(95, 0xf2fff2, 0.55, 2400);
      mkLayer(200, 0x7dffb0, 0.32, 3100);
      mkLayer(200, 0x4ad8c8, 0.16, 3800);
      // Тик картинки: кольцо радиуса + волны + нити + моте.
      const zone = this.scene.add.graphics().setDepth(15);
      this._ultRing = zone;
      track(zone);
      let tickN = 0;
      this._ultRingT = this.scene.time.addEvent({
        delay: 200,
        repeat: -1,
        callback: () => {
          if (!this.active || !this._ultRing || !this._ultRing.active || this.dead) return;
          try {
            tickN++;
            // В дыму (гост) купол не светим — твины не трогаем, только visible.
            const ghosted = !!this._smokeHidden;
            try {
              (this._ultLayers || []).forEach(img => {
                try { if (img && img.active) img.setVisible(!ghosted); } catch (e) {}
              });
              if (this._ultRing && this._ultRing.active) this._ultRing.setVisible(!ghosted);
            } catch (e) {}
            if (ghosted) return;
            const now = this.scene.time.now;
            const g = this._ultRing;
            g.clear();
            // Чёткой границы нет (по ТЗ край растворяется): только нити.
            // Радиус читается по слоям купола и волнам.
            // Волна от центра к краям (каждый 5-й тик).
            if (tickN % 5 === 0) {
              const wv = track(this.scene.add.circle(this.x, this.y, 20, 0x9dffb8, 0).setDepth(15));
              this.scene.tweens.add({
                targets: wv, scaleX: R / 20, scaleY: R / 20, alpha: 0.35,
                duration: 350, ease: 'Cubic.Out'
              });
              // Волна гаснет, расширяясь (старт после разворота — иначе
              // два твина дерутся за альфу с первого кадра).
              this.scene.tweens.add({
                targets: wv, delay: 350, alpha: 0, duration: 1000,
                onComplete: () => { try { wv.destroy(); } catch (e) {} }
              });
            }
            // Союзники в радиусе: нити + моте («оживают»).
            let mates = [];
            try {
              mates = this.scene.players.filter(q => (
                q && q !== this && !q.dead && q.team === this.team &&
                Phaser.Math.Distance.Between(this.x, this.y, q.x, q.y) <= R
              )).slice(0, 4);
            } catch (e) {}
            const ta = 0.25 + 0.15 * Math.sin(now * 0.006);
            mates.forEach(q => {
              try {
                g.lineStyle(1.5, 0xd8ffe8, ta);
                g.lineBetween(this.x, this.y - 20, q.x, q.y - 20);
                if (Math.random() < 0.3) this._auraMote(q.x, q.y - 40, track);
              } catch (e) {}
            });
            // Подъёмные частицы ядра.
            for (let k = 0; k < 2; k++) {
              this._auraMote(
                this.x + Phaser.Math.Between(-70, 70),
                this.y + Phaser.Math.Between(-10, 30), track);
            }
          } catch (e) {}
        }
      });
      if (this._ultEndTimer) { try { this._ultEndTimer.remove(); } catch (e) {} }
      this._ultEndTimer = this.scene.time.delayedCall(8300, () => {
        this._fadeUltFx();
      });
    } catch (e) { /* зона не роняет игру */ }
  }

  // Мягкий спрайт ауры: градиент (ядро → растворение). Печётся один раз.
  _auraTex() {
    try {
      if (this.scene.textures.exists('__medic_aura')) return;
      const S = 128;
      this.scene.textures.createCanvas('__medic_aura', S, S);
      const c = this.scene.textures.get('__medic_aura').getSourceImage().getContext('2d');
      const grd = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.45, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grd;
      c.fillRect(0, 0, S, S);
      this.scene.textures.get('__medic_aura').refresh();
    } catch (e) {}
  }

  // Подъёмная частица: светлая точка/искра вверх с затуханием.
  _auraMote(x, y, track) {
    try {
      const tints = [0xeaffea, 0xffe9a8, 0x9dffb8];
      const sp = this.scene.add.circle(x, y, 2, tints[Math.floor(Math.random() * tints.length)], 0.8).setDepth(16);
      if (track) track(sp);
      this.scene.tweens.add({
        targets: sp, y: y - (40 + Math.random() * 30), alpha: 0,
        duration: 800 + Math.random() * 300,
        onComplete: () => { try { sp.destroy(); } catch (e) {} }
      });
    } catch (e) {}
  }

  // Финал: свет меркнет (слои гаснут), потом чистка.
  _fadeUltFx() {
    try {
      if (this._ultRingT) { try { this._ultRingT.remove(); } catch (e) {} this._ultRingT = null; }
      const layers = this._ultLayers || [];
      layers.forEach(img => { try { this.scene.tweens.killTweensOf(img); } catch (e) {} });
      this.scene.tweens.add({
        targets: layers.filter(img => img && img.active), alpha: 0, duration: 500,
        onComplete: () => { try { this._clearUltFx(); } catch (e) {} }
      });
      this.scene.time.delayedCall(700, () => { try { this._clearUltFx(); } catch (e) {} });
    } catch (e) { try { this._clearUltFx(); } catch (e2) {} }
  }

  _clearUltFx() {
    if (this._ultRingT) {
      try { this._ultRingT.remove(); } catch (e) {}
      this._ultRingT = null;
    }
    try {
      (this._ultFxParts || []).forEach(o => {
        try { this.scene.tweens.killTweensOf(o); } catch (e) {}
        try { if (o && o.active !== false) o.destroy(); } catch (e) {}
      });
    } catch (e) {}
    this._ultFxParts = [];
    this._ultLayers = [];
    if (this._ultRing) {
      try { this._ultRing.destroy(); } catch (e) {}
      this._ultRing = null;
    }
    if (this._ultEndTimer) {
      this._ultEndTimer = null;
    }
  }

  _cancelUltimate() {
    if (this._ultTick) { try { this._ultTick.remove(); } catch (e) {} this._ultTick = null; }
    if (this._ultEndTimer) { try { this._ultEndTimer.remove(); } catch (e) {} this._ultEndTimer = null; }
    this._clearUltFx();
  }

  die(killer) {
    this._cancelUltimate();
    super.die(killer);
  }

  destroy(fromScene) {
    this._cancelUltimate();
    super.destroy(fromScene);
  }

  update() {
    // Мёртвый медик не лечит (аура гаснет вместе с ним).
    if (this.dead) return;
    // Пассивного хила близости нет: лечат только аптечка (способность)
    // и полевой госпиталь (ульта). Раньше тут тикал heal(0.2) в радиусе 100.
    // Слои купола догоняют медика (30% дистанции за апдейт).
    try {
      if (this._ultLayers) {
        for (const img of this._ultLayers) {
          try {
            if (img && img.active) {
              img.x += (this.x - img.x) * 0.3;
              img.y += (this.y - img.y) * 0.3;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
}
