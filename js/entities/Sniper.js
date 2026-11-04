import Player from './Player.js';
import { classAbilities } from '../data/abilities.js';

export default class Sniper extends Player {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, {
      ...config,
      maxHp: 80,
      maxArmor: 20,
      moveSpeed: 190,
      primary: config.primary || 'Winchester'
    });

    this.abilityName = 'Нет способности';
    this.hasAbility = false;

    const ab = classAbilities.Sniper;
    if (!ab || !ab.name) { console.warn('[Sniper] no classAbilities.Sniper'); return; }
    this.ultName = ab.name;
    this.ultDuration = ab.duration;
    this.ultUnlockLevel = ab.unlockLevel;
  }

  activateUltimate() {
    this.damageMult = 2;
    this.spreadMult = 0.2;

    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} }
    this._ultTimer = this.scene.time.delayedCall(10000, () => {
      if (!this.scene) return;
      this.damageMult = this._diffDmgMult || 1;
      this.spreadMult = 1;
      this._ultTimer = null;
    });
  }

  die(killer) {
    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} this._ultTimer = null; }
    super.die(killer);
  }

  destroy(fromScene) {
    if (this._ultTimer) { try { this._ultTimer.remove(); } catch (e) {} this._ultTimer = null; }
    super.destroy(fromScene);
  }
}
