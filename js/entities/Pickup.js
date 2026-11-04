import { unlockWeapon } from '../data/gameState.js';
import { getWeaponLabel, weaponImage } from '../data/weapons.js';
import { fragMax, smokeMax } from '../data/skills.js';

const PICKUP_CONFIG = {
  ammo:    { color: 0x8a5a2a, label: '+Патроны',  heal: 0, armor: 0, ammoAmount: 30, outline: 0x8a5a2a },
  medkit:  { color: 0x33cc55, label: '+Здоровье', heal: 40, armor: 0, ammoAmount: 0, outline: 0x33ff66 },
  armor:   { color: 0x5588ff, label: '+Броня',    heal: 0, armor: 30, ammoAmount: 0, outline: 0x4499ff },
  frag:    { color: 0x88aa22, label: '+Осколочная', heal: 0, armor: 0, ammoAmount: 0 },
  smoke:   { color: 0x9a9a9a, label: '+Дымовая',   heal: 0, armor: 0, ammoAmount: 0 }
};

export default class Pickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type, weaponName) {
    super(scene, x, y, 'pickup');
    this.weaponName = weaponName || null;
    let cfg = PICKUP_CONFIG[type];
    if (type === 'weapon') {
      cfg = {
        color: 0xffd700,
        label: `+${getWeaponLabel(weaponName) || 'Оружие'}`,
        heal: 0,
        armor: 0,
        ammoAmount: 30
      };
    }
    cfg = cfg || PICKUP_CONFIG.ammo;

    this.pickupType = type;
    this.cfg = cfg;
    this.born = scene.time.now;

    const lifetime = (type === 'medkit' || type === 'ammo' || type === 'armor')
      ? 30000
      : 15000;
    this.expires = scene.time.now + lifetime;
    this.blinkable = lifetime === 30000;

    this.setTint(cfg.color);

    // Кит — поверх персонажей (тела на 4–4.7): стоящий на ките боец
    // его не перекрывает. Кольцо команды — метка на земле: поверх земли
    // (земля на 2), но под китом (кит на 5). Было на 1 — земля его хоронила.
    this.setDepth(5);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Кит ПАДАЕТ на опору (как бомба): чуть высокий спавн сам ложится
    // на поверхность, а не висит в воздухе вне зоны подбора. Коллайдеры
    // с платформами/ящиками вешает spawnPickup.
    this.body.setAllowGravity(true);
    this.body.setImmovable(true);
    try { this.body.setCollideWorldBounds(true); } catch (e) {}
    this.setSize(24, 24);

    this.outline = null;
    this.label = null;
    // Живость: фаза пульсации (у каждого своя) + кольцо команды.
    this.bobPhase = Math.random() * Math.PI * 2;
    this.teamRing = null;
    this._shadow = null;
    this._pulseBase = 1;
    this._outlineBase = 1.25;
    // Канал подбора 2.5с: кто стоит, прогресс, последнее обновление.
    this._chan = 0;
    this._chanWho = null;
    this._chanLast = 0;
    this.chanGfx = null;
    // Настоящие PNG вместо процедурных ящиков (есть файлы — картинка).
    // Все подборы крупные: бокс 39px (×1.5 от базовых 26).
    // Гранаты тоже из PNG (frag_granade/smoke_granade), оружие — из PNG
    // ствола (weaponImage), а не золотая заглушка-коробка.
    let artKey = type === 'ammo' ? 'ammo_kit' : type === 'medkit' ? 'medkit'
      : type === 'armor' ? 'armor_kit'
      : type === 'frag' ? 'frag_granade' : type === 'smoke' ? 'smoke_granade' : null;
    if (type === 'weapon') {
      try {
        const wk = (typeof weaponImage === 'function' && weaponName) ? weaponImage(weaponName) : null;
        artKey = (wk && scene.textures.exists(wk)) ? wk : null;
      } catch (e) { artKey = null; }
    }
    const artBox = 32;
    let artShown = false;
    if (artKey && scene.textures.exists(artKey)) {
      try {
        const src = scene.textures.get(artKey).getSourceImage();
        if (src && src.width && src.height) {
          const sc = Math.min(artBox / src.width, artBox / src.height);
          this.setTexture(artKey);
          this.setScale(sc);
          this._pulseBase = sc;
          this.setVisible(true);
          this.clearTint();
          // Хитбокс — под ОТОБРАЖЁННЫЙ арт (85% с учётом усадки в бокс):
          // раньше брался от исходных пикселей, и у высоких PNG
          // (граната 50×85) тело было вдвое больше картинки.
          try {
            this.body.setSize(Math.max(8, src.width * 0.85 * sc), Math.max(8, src.height * 0.85 * sc));
          } catch (e) {}
          artShown = true;
          // Тень отдельно (не в арте): гранаты крутятся в полёте, а тут лежат.
          if (type === 'frag' || type === 'smoke') {
            try {
              this._shadow = scene.add.ellipse(x, y + 17, 30, 8, 0x000000, 0.3);
              this._shadow.setDepth(4);
            } catch (e) { this._shadow = null; }
          }
        }
      } catch (e) { /* фолбэк ниже */ }
    }
    if (!artShown && type === 'ammo') {
      this.setVisible(false);
      this.outline = scene.add.graphics();
      this._drawAmmoCrate(this.outline);
      this.outline.setPosition(x, y);
      this.outline.setDepth(5);
    } else if (!artShown && type === 'medkit') {
      this.setVisible(false);
      this.outline = scene.add.graphics();
      this._drawMedKit(this.outline);
      this.outline.setPosition(x, y);
      this.outline.setDepth(5);
    } else if (type === 'armor' && !artShown) {
      // Без PNG — полупрозрачный ящик (раньше рисовался даже поверх арта
      // и душил его alpha 0.22).
      this.outline = scene.add.graphics();
      this.outline.lineStyle(2, cfg.outline, 1);
      this.outline.strokeRect(-12, -12, 24, 24);
      this.outline.setPosition(x, y);
      this.outline.setDepth(5);
      this.setTint(0xffffff);
      this.setAlpha(0.22);
    } else if (!artShown) {
      // Гранаты/оружие без арта: рисованная иконка БЕЗ надписей —
      // плавающие подписи убраны везде по просьбе автора.
      this.setVisible(false);
      this.outline = scene.add.graphics();
      if (type === 'frag') this._drawFragBall(this.outline);
      else if (type === 'smoke') this._drawSmokeBall(this.outline);
      else this._drawWeaponBox(this.outline);
      this.outline.setPosition(x, y);
      this.outline.setDepth(5);
    }
    // NOTE: ветка с artShown=true больше не падает в подписи (баг: надпись
    // '+Здоровье'/' +Патроны' рисовалась поверх картинки).
    // Рисованные иконки ×1.25 (все centred в нуле — масштаб чистый).
    if (this.outline) this.outline.setScale(1.25);
  }

  // Кольцо команды под китом: синее/красное — чей расходник.
  // Нейтральные (карта/кампания/дроп со смерти) — без кольца.
  // Слой: поверх земли (2), но под китом (5) — видно всегда, кит не застит.
  setTeamRing(team) {
    try {
      this.team = team;
      if (this.teamRing) {
        try { this.teamRing.destroy(); } catch (e) {}
        this.teamRing = null;
      }
      const col = team === 'blue' ? 0x4488ff : team === 'red' ? 0xff5555 : null;
      if (col == null || !this.scene || !this.scene.add) return;
      const g = this.scene.add.graphics();
      g.fillStyle(col, 0.5);
      g.fillEllipse(0, 0, 32, 10);
      g.lineStyle(1.5, col, 0.9);
      g.strokeEllipse(0, 0, 32, 10);
      g.setDepth(2.5);
      g.setPosition(this.x, this.y + 16);
      this.teamRing = g;
    } catch (e) {}
  }

  _drawFragBall(g) {
    g.fillStyle(0x88aa22, 1);
    g.fillCircle(0, 0, 11);
    g.fillStyle(0xaacc44, 1);
    g.fillCircle(-3, -3, 4);
    g.lineStyle(2, 0x556611, 1);
    g.strokeCircle(0, 0, 11);
    g.fillStyle(0x666666, 1);
    g.fillRect(-2, -16, 4, 6);
  }

  _drawSmokeBall(g) {
    g.fillStyle(0x9a9a9a, 1);
    g.fillCircle(0, 0, 11);
    g.fillStyle(0xbbbbbb, 1);
    g.fillCircle(-3, -3, 4);
    g.lineStyle(2, 0x666666, 1);
    g.strokeCircle(0, 0, 11);
    g.fillStyle(0x666666, 1);
    g.fillRect(-2, -16, 4, 6);
  }

  _drawWeaponBox(g) {
    g.fillStyle(0x8a6a1a, 1);
    g.fillRoundedRect(-13, -10, 26, 20, 4);
    g.lineStyle(2, 0xffd700, 1);
    g.strokeRoundedRect(-13, -10, 26, 20, 4);
    g.fillStyle(0xffd700, 1);
    g.fillTriangle(-6, -4, 6, -4, 0, 6);
  }

  _drawAmmoCrate(g) {
    g.fillStyle(0x8a5a2a, 1);
    g.fillRoundedRect(-12, -12, 24, 24, 3);
    g.lineStyle(1, 0x5c3a1a, 1);
    g.strokeRoundedRect(-12, -12, 24, 24, 3);
    g.lineBetween(-12, -2, 12, -2);
    g.fillStyle(0xddaa22, 1);
    g.fillRect(-5, -8, 3, 5);
    g.fillRect(-1, -8, 3, 5);
    g.fillRect(3, -8, 3, 5);
    g.fillStyle(0xcc9911, 1);
    g.fillRect(-5, 2, 10, 4);
    g.lineStyle(1, 0x5c3a1a, 0.6);
    g.lineBetween(0, -12, 0, -2);
  }

  _drawMedKit(g) {
    g.fillStyle(0xeeeeee, 1);
    g.fillRoundedRect(-12, -12, 24, 24, 4);
    g.lineStyle(1.5, 0xcccccc, 1);
    g.strokeRoundedRect(-12, -12, 24, 24, 4);
    g.fillStyle(0xff3333, 1);
    g.fillRect(-2, -8, 4, 16);
    g.fillRect(-8, -2, 16, 4);
  }

  update(now) {
    if (this.outline) {
      this.outline.setPosition(this.x, this.y);
    }
    if (this._shadow) {
      this._shadow.setPosition(this.x, this.y + 17);
    }
    const left = this.expires - now;
    if (left <= 0) {
      if (this.active) this.destroy();
      return;
    }
    if (this.blinkable && left <= 4000) {
      const on = Math.floor(now / 100) % 2 === 0;
      this.setVisible(on);
      if (this.outline) this.outline.setVisible(on);
      if (this._shadow) this._shadow.setVisible(on);
      if (this.teamRing) this.teamRing.setVisible(on);
    } else if (!this.visible) {
      this.setVisible(true);
      if (this.outline) this.outline.setVisible(true);
      if (this._shadow) this._shadow.setVisible(true);
      if (this.teamRing) this.teamRing.setVisible(true);
    }
    // Живость вместо «кирпича»: лёгкая пульсация масштаба + кольцо
    // команды дышит и едет за китом. Позицию тела не трогаем (статика).
    try {
      const s = 1 + 0.04 * Math.sin(now * 0.005 + (this.bobPhase || 0));
      if (this._pulseBase) this.setScale(this._pulseBase * s);
      if (this.outline && this._outlineBase) this.outline.setScale(this._outlineBase * s);
      if (this.teamRing) {
        this.teamRing.setPosition(this.x, this.y + 16);
        this.teamRing.setAlpha(0.35 + 0.25 * (0.5 + 0.5 * Math.sin(now * 0.005 + (this.bobPhase || 0))));
      }
    } catch (e) {}
    this._updateChannel(now);
  }

  // Канал 2.5с: стоишь на ките — полоска растёт, заполнилась — забрал.
  // Ушёл — быстро гаснет. Полный (ХП полное) — держим полную и ждём.
  _updateChannel(now) {
    try {
      const dt = Math.min(100, Math.max(0, now - (this._chanLast || now)));
      this._chanLast = now;
      const taker = this._findTaker();
      if (!taker) {
        // Память канала: прежний берущий ещё рядом (сел, кадр физики
        // дёрнул хитбокс) — прогресс СТОИТ, а не тает. Ушёл далеко —
        // таем как раньше. Иначе присед на грани окна обнулял почти
        // собранный кит за полсекунды.
        if (!this._nearLoose(this._chanWho)) {
          this._chanWho = null;
          this._chan = Math.max(0, (this._chan || 0) - dt / 500);
        }
      } else if (this._chanWho !== taker) {
        this._chanWho = taker;
        this._chan = 0;
      } else {
        this._chan = Math.min(1, (this._chan || 0) + dt / 2500);
      }
      this._drawChan();
      // Полный (ХП/броня полные, кап гранат) — applyTo честно отказывает:
      // кит не сгорает, ждём послабления. Полоска серая (см. _drawChan).
      let waiting = false;
      if ((this._chan || 0) >= 1 && taker) {
        // Сетевой кит: добро даёт сервер (kitok), иначе дубли у всех.
        // Полный не просим (canTake): ждём с серой полоской как в одиночке,
        // место появится — запросим. Ждём kitok до 2с, потом считаем
        // проигранным и убираем молча.
        if (typeof this.onWantTake === 'function') {
          try {
            if (typeof this.canTake === 'function' && !this.canTake(taker)) {
              waiting = true;
            } else if (!this._wantSent) {
              this._wantSent = true;
              this._wantTaker = taker;
              try {
                this._wantAt = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
              } catch (e) {
                this._wantAt = Date.now();
              }
              try { this.onWantTake(this); } catch (e) {}
            }
          } catch (e) {}
          let nowMs = 0;
          try {
            nowMs = (this.scene && this.scene.time) ? this.scene.time.now : Date.now();
          } catch (e) {
            nowMs = Date.now();
          }
          // Таймаут — только отправленному запросу (без отправки _wantAt=0
          // и кит снеся бы сразу, даже полный).
          if (this._wantSent && nowMs - (this._wantAt || 0) > 2000) {
            try {
              if (this.scene && this.scene.pickups) this.scene.pickups.remove(this);
            } catch (e) {}
            this.destroy();
            return;
          }
          waiting = true;
        } else if (this.applyTo(taker)) {
          try {
            if (this.scene && this.scene.pickups) this.scene.pickups.remove(this);
          } catch (e) {}
          this.destroy();
          return;
        } else {
          waiting = true;
        }
      }
      this._waiting = waiting;
    } catch (e) {}
  }

  // Чистая проверка «влезет ли» без выдачи (для сетевого запроса:
  // полный кит не просим у сервера, а ждём с серой полоской как в одиночке).
  // Офлайн-логику не меняет (новый метод, старые пути те же).
  canTake(player) {
    try {
      if (!player || player.dead || !player.active) return false;
      // Мутатор «Ножи» (п.14.2): подбор стволов запрещён (аптечки/броня/патроны — можно).
      try {
        if (this.pickupType === 'weapon' && this.scene && Array.isArray(this.scene.mutators) && this.scene.mutators.includes('knives')) return false;
      } catch (e) {}
      if (this.pickupType === 'medkit') return player.hp < player.maxHp;
      if (this.pickupType === 'armor') return player.armor < player.maxArmor;
      if (this.pickupType === 'ammo') {
        const guns = (player.inventory || []).filter(w => !w.isMelee);
        if (guns.length === 0) return false;
        const maxOf = (g) => {
          try {
            if (g && typeof g.maxReserve === 'function') return g.maxReserve();
          } catch (e) {}
          return ((g && g.magazineSize) || 0) * 2;
        };
        let space = 0;
        try {
          guns.forEach(g => {
            space += Math.max(0, maxOf(g) - ((g && g.reserveAmmo) || 0));
          });
        } catch (e) {}
        return space > 0;
      }
      if (this.pickupType === 'frag') {
        const capF = player.isAI ? 2 : fragMax();
        if ((player.fragGrenades || 0) >= capF && !this.tutorial) return false;
        return true;
      }
      if (this.pickupType === 'smoke') {
        const capS = player.isAI ? 2 : smokeMax();
        return (player.smokeGrenades || 0) < capS;
      }
      return true;
    } catch (e) {}
    return false;
  }

  // Сервер разрешил забрать сетевой кит: выдаём ждавшему и убираем.
  grantTake() {
    try {
      const t = this._wantTaker;
      if (t && !t.dead && t.active) {
        try { this.applyTo(t); } catch (e) {}
      }
      try {
        if (this.scene && this.scene.pickups) this.scene.pickups.remove(this);
      } catch (e) {}
      this.destroy();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Кто сейчас стоит на ките: живой, своей команды.
  // Зона — по размеру тела (как старый физ-оверлап) + от ступней, а не от
  // центра: в приседе тело короче, а ноги на месте — кит у ног берётся.
  // k399: первый не вытесняется вторым — пока стоит, он и берущий
  // (раньше _findTaker отдавал первого по списку игроков, смена берущего
  // обнуляла канал: подошедший вторым воровал/гасил чужой прогресс).
  // Ушёл первый — добирает стоящий (сброс ниже), чужой команде нейтральный
  // кит отдаётся так же: кто первый встал, того и канал.
  _findTaker() {
    try {
      const _w = this._chanWho;
      if (_w && !_w.dead && _w.active && !(this.team && this.team !== _w.team)) {
        const _pb = _w.body;
        const _hw = (_pb ? _pb.width / 2 : 15) + 18;
        const _feet = _pb && Number.isFinite(_pb.bottom) ? _pb.bottom : _w.y + 28;
        const _dyf = this.y - _feet;
        if (Math.abs(_w.x - this.x) <= _hw && _dyf >= -75 && _dyf <= 25) return _w;
      }
    } catch (e) {}
    try {
      const sc = this.scene;
      const list = (sc && sc.players) || [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p || p.dead || !p.active) continue;
        if (this.team && this.team !== p.team) continue;
        const pb = p.body;
        const hw = (pb ? pb.width / 2 : 15) + 18;
        const feet = pb && Number.isFinite(pb.bottom) ? pb.bottom : p.y + 28;
        const dyf = this.y - feet;
        if (Math.abs(p.x - this.x) > hw || dyf < -75 || dyf > 25) continue;
        return p;
      }
    } catch (e) {}
    return null;
  }

  // Прежний берущий ещё рядом (расширенное окно): присед, дёрг физики —
  // канал стоит. Пусто/труп/чужой/далеко — false, идёт обычное таяние.
  _nearLoose(who) {
    try {
      if (!who || who.dead || !who.active) return false;
      if (this.team && this.team !== who.team) return false;
      const pb = who.body;
      const hw = (pb ? pb.width / 2 : 15) + 18 + 30;
      const feet = pb && Number.isFinite(pb.bottom) ? pb.bottom : who.y + 28;
      const dyf = this.y - feet;
      if (Math.abs(who.x - this.x) > hw || dyf < -100 || dyf > 55) return false;
      return true;
    } catch (e) { return false; }
  }

  // Полоска канала над китом цветом типа: аптечка — зелёная,
  // патроны — коричневая, броня — синяя. Ждёт послабления
  // (полный) — серая полная: кит цел, заберётся сам при уроне.
  _drawChan() {
    try {
      if (!this.chanGfx) {
        this.chanGfx = this.scene.add.graphics().setDepth(5.1);
      }
      const g = this.chanGfx;
      g.clear();
      const pr = this._chan || 0;
      if (pr <= 0) {
        g.setVisible(false);
        return;
      }
      g.setVisible(true);
      const W = 36, H = 5, bx = this.x - W / 2, by = this.y - 28;
      g.fillStyle(0x0a0a2a, 0.85);
      g.fillRect(bx - 1, by - 1, W + 2, H + 2);
      g.fillStyle(this._waiting ? 0x777788 : this._chanColor(), 1);
      g.fillRect(bx, by, Math.max(0, W * Math.min(1, pr)), H);
    } catch (e) {}
  }

  _chanColor() {
    switch (this.pickupType) {
      case 'medkit': return 0x33ff66;
      case 'ammo': return 0x9a6a2a;
      case 'armor': return 0x5588ff;
      case 'frag': return 0x88aa22;
      case 'smoke': return 0xbbbbbb;
      case 'weapon': return 0xffd700;
      default: return 0xffffff;
    }
  }

  applyTo(player) {
    // Мутатор «Ножи»: ствол с земли не выдаём даже при прямом вызове.
    try {
      if (this.pickupType === 'weapon' && this.scene && Array.isArray(this.scene.mutators) && this.scene.mutators.includes('knives')) return false;
    } catch (e) {}
    if (this.pickupType === 'medkit' && player.hp >= player.maxHp) {
      return false;
    }
    if (this.pickupType === 'armor' && player.armor >= player.maxArmor) {
      return false;
    }

    if (this.pickupType === 'ammo') {
      // Сумка с патронами (п.11): 1 магазин основному + 2 магазина второму,
      // а не +30 всем подряд. Основное = больший magazineSize.
      const guns = (player.inventory || []).filter(w => !w.isMelee);
      // Только нож — подбор не исчезает впустую, ждёт следующего.
      if (guns.length === 0) return false;
      // Все запасы полные — кит не сгорает впустую, ждёт траты
      // (как аптечка при полном ХП).
      const maxOf = (g) => {
        try {
          if (g && typeof g.maxReserve === 'function') return g.maxReserve();
        } catch (e) {}
        return ((g && g.magazineSize) || 0) * 2;
      };
      let space = 0;
      try {
        guns.forEach(g => {
          space += Math.max(0, maxOf(g) - ((g && g.reserveAmmo) || 0));
        });
      } catch (e) {}
      if (space <= 0) return false;
      const sorted = guns.slice().sort((a, b) => (b.magazineSize || 0) - (a.magazineSize || 0));
      const primary = sorted[0];
      const secondary = sorted[1] || null;
      if (primary) primary.reserveAmmo += (primary.magazineSize || 0) * 1;
      if (secondary) secondary.reserveAmmo += (secondary.magazineSize || 0) * 2;
      else if (primary) primary.reserveAmmo += (primary.magazineSize || 0) * 1;
      // Больше стока (2 магазина) не поднять — лишнее сгорает.
      // Скилл на размер магазина учтён: кап считается от живого размера.
      try {
        guns.forEach(g => {
          if (g && !g.isMelee && typeof g.maxReserve === 'function') {
            g.reserveAmmo = Math.min(g.maxReserve(), Math.max(0, g.reserveAmmo | 0));
          }
        });
      } catch (e) {}
      // Автоперезарядка: держал пустой ствол — сразу заряжаем его;
      // стоял с ножом при пустых стволах — возвращаемся на огнестрел.
      try {
        const w = player.weapon;
        if (w && !w.isMelee && (w.magazine | 0) <= 0 && (w.reserveAmmo | 0) > 0 && !w.reloading) {
          w.reload();
        } else if (w && w.isMelee) {
          const back = guns.find(g => ((g.magazine | 0) + (g.reserveAmmo | 0)) > 0);
          if (back) {
            const bi = (player.inventory || []).indexOf(back);
            if (bi >= 0) player.selectWeapon(bi);
          }
        }
      } catch (e) {}
    } else if (this.pickupType === 'medkit') {
      player.heal(this.cfg.heal);
    } else if (this.pickupType === 'armor') {
      player.restoreArmor(this.cfg.armor);
    } else if (this.pickupType === 'frag') {
      // На капе — не сгорает, остаётся лежать. Кап: по прокачке (людям),
      // ботам — 2 (добирают в бою через _seekGrenade).
      // Учебная граната (туториал, навыка может не быть вовсе) — всегда
      // +1 поверх капа, иначе шаг «подбери гранату» невыполним в принципе.
      const capF = player.isAI ? 2 : fragMax();
      if ((player.fragGrenades || 0) >= capF && !this.tutorial) return false;
      player.fragGrenades = Math.max(0, (player.fragGrenades || 0)) + 1;
    } else if (this.pickupType === 'smoke') {
      const capS = player.isAI ? 2 : smokeMax();
      if ((player.smokeGrenades || 0) >= capS) return false;
      player.smokeGrenades = Math.min(capS, Math.max(0, (player.smokeGrenades || 0)) + 1);
    } else if (this.pickupType === 'weapon') {
      const owned = player.inventory.some(w => w.name === this.weaponName);
      if (!owned) {
        // Инвентарь не резиновый: сверх лимита — только патроны к своим.
        if ((player.inventory || []).length >= 6) {
          player.inventory.forEach(w => {
            if (!w.isMelee) w.reserveAmmo += 30;
          });
          // Больше стока (2 магазина) не поднять — лишнее сгорает.
          try {
            player.inventory.forEach(w => {
              if (w && !w.isMelee && typeof w.maxReserve === 'function') {
                w.reserveAmmo = Math.min(w.maxReserve(), Math.max(0, w.reserveAmmo | 0));
              }
            });
          } catch (e) {}
        } else {
          player.addWeapon(this.weaponName);
          // Бот поднял ствол — в профиль игрока не разблокируем.
          if (!player.isAI && !player._demoPuppet) unlockWeapon(this.weaponName);
        }
      } else {
        player.inventory.forEach(w => {
          if (w.name === this.weaponName) {
            w.reserveAmmo += this.cfg.ammoAmount;
          }
        });
      }
    }
    // Звук подбора: аптечка / патроны / броня (остальные типы — без звука).
    // Только при успешном подборе (все ранние return false — мимо).
    try {
      const sc = this.scene;
      const key = this.pickupType === 'medkit' ? 'sfx_pickup_medkit'
        : this.pickupType === 'ammo' ? 'sfx_pickup_ammo'
        : this.pickupType === 'armor' ? 'sfx_pickup_armor' : null;
      if (key && sc && !sc.sound.locked && sc.cache.audio.exists(key)) {
        // Броня — в 1.5 раза громче остальных подборов (тихий сэмпл).
        const base = this.pickupType === 'armor' ? 0.75 : 0.5;
        let vol = base;
        try {
          if (typeof sc._sfxVolAt === 'function') vol = sc._sfxVolAt(this.x, this.y, base);
        } catch (e) {}
        sc.sound.play(key, { volume: vol });
      }
    } catch (e) {}
    return true;
  }

  destroy(fromScene) {
    // Снимаем свои коллайдеры (вешает spawnPickup: платформы + ящики):
    // иначе мир физики распухает всю сессию.
    try {
      if (this._col && this.scene && this.scene.physics && this.scene.physics.world) {
        this.scene.physics.world.removeCollider(this._col);
      }
    } catch (e) {}
    this._col = null;
    try {
      if (this._col2 && this.scene && this.scene.physics && this.scene.physics.world) {
        this.scene.physics.world.removeCollider(this._col2);
      }
    } catch (e) {}
    this._col2 = null;
    if (this.label) {
      this.label.destroy();
      this.label = null;
    }
    if (this.teamRing) {
      try { this.teamRing.destroy(); } catch (e) {}
      this.teamRing = null;
    }
    if (this.chanGfx) {
      try { this.chanGfx.destroy(); } catch (e) {}
      this.chanGfx = null;
    }
    if (this.outline) {
      this.outline.destroy();
      this.outline = null;
    }
    if (this._shadow) {
      try { this._shadow.destroy(); } catch (e) {}
      this._shadow = null;
    }
    super.destroy(fromScene);
  }
}
