export default class Bomb extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, ownerTeam) {
    // Арт по владельцу: своя/вражеская бомба разного цвета.
    // Нет арта — запасной спрайт (старый оранжевый эллипс убран).
    const artKey = ownerTeam === 'blue' ? 'bomb_ally' : 'bomb_foe';
    const texKey = scene.textures.exists(artKey) ? artKey
      : (scene.textures.exists('bomb_neutral') ? 'bomb_neutral' : 'grenade');
    super(scene, x, y, texKey);

    this.scene = scene;
    this.ownerTeam = ownerTeam;
    this.carrier = null;
    this.installed = false;
    this.baseX = x;
    this.baseY = y;
    // Своя бомба: берёт только своя команда (и с пьедестала, и с земли).
    // Чужую взять нельзя — её можно только обезвредить (стоять рядом 5с).
    this.home = true;
    this.droppedAt = 0;
    // Прогресс обезвреживания врагом (0..5000мс). Сбрасывается при
    // подборе/возврате (см. pickUp/drop/returnToBase).
    this._defuse = 0;
    // Кулдаун автоподбора после сброса (1с): сбросил — не подбирается
    // мгновенно обратно. На ручной подбор (E) не действует.
    this._noPickupUntil = 0;

    // Заряд на спине носильщика: ~52×25 (аспект арта 775:365).
    try { this.setDisplaySize(52, 25); } catch (e) {}
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    // Маленькое тело по центру заряда, а не весь кадр (кадр ~775x365):
    // большое цепляло дальнюю геометрию и физика швыряла бомбу
    // (та же болезнь, что давала спам возвратов флага в CTF).
    try {
      const fw = (this.frame && this.frame.width) || 52;
      const fh = (this.frame && this.frame.height) || 25;
      const bw = Math.max(16, fw * 0.3), bh = Math.max(12, fh * 0.5);
      this.body.setSize(bw, bh);
      this.body.setOffset((fw - bw) / 2, (fh - bh) / 2);
    } catch (e) { try { this.body.setSize(this.width, this.height); } catch (e2) {} }
    // Лежащая бомба падает на землю: отскок + трение + границы мира.
    // Коллайдеры с платформами/ящиками вешает сцена (createModeObjects).
    try { this.body.setBounce(0.35); } catch (e) {}
    try { this.body.setDragX(400); } catch (e) {}
    try { this.body.setCollideWorldBounds(true); } catch (e) {}
  }

  pickUp(player) {
    if (!player || player.dead || !player.active) return;
    if (this.carrier) return;
    // Только своя команда (по ТЗ: каждая несёт свою бомбу).
    // Враг лежащую чужую не подбирает — он её обезвреживает.
    if (player.team !== this.ownerTeam) return;
    this.carrier = player;
    this.home = false;
    this._defuse = 0;
    this._noPickupUntil = 0;
    // В руках не падает.
    try { this.body.setAllowGravity(false); } catch (e) {}
    try { this.body.setVelocity(0, 0); } catch (e) {}
    try { if (this._defMark) { this._defMark.destroy(); this._defMark = null; } } catch (e) {}
    player.isCarrier = true;
    if (player._armCarrierWeapon) player._armCarrierWeapon();
  }

  // Бывший носильщик — обратно на основной ствол (на время носки
  // ему положены только второе оружие и нож): иначе вся команда
  // после первого же подбора бегает с пистолетами.
  _restorePrimary(c) {
    try {
      if (!c) return;
      const inv = c.inventory || [];
      const pi = inv.findIndex(w => w && w.category === 'primary');
      if (pi >= 0 && c.activeWeaponIndex !== pi && typeof c.selectWeapon === 'function') {
        c.selectWeapon(pi);
      }
    } catch (e) {}
  }

  drop() {
    const c = this.carrier;
    if (!c) {
      return;
    }
    try { c.isCarrier = false; } catch (e) {}
    this._restorePrimary(c);

    let dx = c.x, dy = c.y;
    try {
      if (this.scene && typeof this.scene._escapeSolid === 'function') {
        const p = this.scene._escapeSolid(dx, dy);
        dx = p.x; dy = p.y;
      }
    } catch (e) {}
    this.setPosition(dx, dy);
    try { c._plant = {}; } catch (e) {}
    this.carrier = null;
    this._defuse = 0;
    // Сброшенная падает на землю (гравитация + коллайдеры сцены),
    // автоподбор — через 1с (сразу только руками через E).
    try { this.body.setAllowGravity(true); } catch (e) {}
    try { this.body.setVelocity(0, 0); } catch (e) {}
    try { this.droppedAt = this.scene ? this.scene.time.now : 0; } catch (e) {}
    try { this._noPickupUntil = (this.scene ? this.scene.time.now : 0) + 1000; } catch (e) {}
  }

  returnToBase() {
    try {
      if (this.carrier) this.carrier.isCarrier = false;
    } catch (e) {}
    try {
      if (this.carrier) this.carrier._plant = {};
    } catch (e) {}
    this._restorePrimary(this.carrier);
    this.carrier = null;
    this.installed = false;
    this.home = true;
    this._defuse = 0;
    this._noPickupUntil = 0;
    try { if (this._defMark) { this._defMark.destroy(); this._defMark = null; } } catch (e) {}
    // Дома лежит на пьедестале, не падает.
    try { this.body.setAllowGravity(false); } catch (e) {}
    try { this.body.setVelocity(0, 0); } catch (e) {}
    this.setPosition(this.baseX, this.baseY);
    try { this.droppedAt = this.scene ? this.scene.time.now : 0; } catch (e) {}
  }

  update() {
    if (this.carrier && this.carrier.dead) {
      try { this.drop(); } catch (e) { this.carrier = null; }
      return;
    }
    if (this.carrier && !this.carrier.dead) {
      const c = this.carrier;
      // Заряд на спине: сзади по направлению взгляда, чуть выше пояса.
      let dir = 1;
      try {
        if (typeof c.flipX === 'boolean') dir = c.flipX ? -1 : 1;
        else if (typeof c.aimX === 'number' && typeof c.x === 'number') {
          dir = c.aimX >= c.x ? 1 : -1;
        }
      } catch (e) {}
      this.setPosition(c.x - dir * 16, c.y - 12);
      // В дыму носильщик гаснет — бомба гаснет вместе с ним.
      // ВАЖНО: читаем _smokeHidden, а НЕ c.alpha — базовый спрайт
      // бойца всегда alpha 0, иначе бомба невидима всю носку.
      try {
        const a = c._smokeHidden ? 0 : 1;
        if (this.alpha !== a) this.alpha = a;
      } catch (e) {}
    } else if (!this.carrier) {
      try { if (this.alpha !== 1) this.alpha = 1; } catch (e) {}
    }
  }
}
