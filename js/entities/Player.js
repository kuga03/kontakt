import { classDefinitions } from '../data/weapons.js?v=170';
import { getEquipment, getCharacterColors, getEquippedHead, getEquippedTorso } from '../data/gameState.js?v=171';
import { fragMax, smokeMax } from '../data/skills.js?v=169';
import { getRigConfig } from '../data/rigConfig.js?v=169';
import * as Damage from './player/damage.js?v=318';
import * as Shoot from './player/shoot.js?v=175';
import * as Move from './player/move.js?v=170';
import * as Abilities from './player/abilities.js?v=169';
import * as Hud from './player/hud.js?v=394';
import * as Guns from './player/guns.js?v=175';
import * as Aim from './player/aim.js?v=169';
import * as Rig from './player/rig.js?v=394';

// ГЕОМЕТРИЧЕСКИЙ персонаж: вместо собранных PNG-скелетов тело рисуется
// кодом (круг-голова с глазами, торс-эллипс, руки/ноги-палки, кисти и
// обувь другим цветом). Магазин потом перекрасит/заменит внешность.
// true = PNG-арты персонажа игнорируются везде (игра + редактор рига).
const GEO_HUMAN = true;

// Кожа ботов — случайная из палитры (иначе все бегают с лицом игрока).
// Сетевые чужаки (gear.body владельца) и игрок — без изменений.
const BOT_SKIN = [0xffe0c8, 0xf0c8a0, 0xd8a066, 0xa06844, 0x77502e, 0x4e3421];

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, 'player');

    this.scene = scene;
    this.team = config.team || 'blue';
    this.playerName = config.name || 'Player';
    this.isAI = Boolean(config.isAI);

    this.maxHp = config.maxHp || 100;
    this.hp = this.maxHp;
    this.maxArmor = config.maxArmor || 50;
    this.armor = this.maxArmor;
    this.moveSpeed = config.moveSpeed || 230;

    this.inventory = [];
    this.activeWeaponIndex = 0;
    this.dead = false;
    this.lastAbilityAt = 0;
    this.abilityCooldown = 15000;
    this.jumps = 0;
    this.maxJumps = 2;
    this.crouching = false;

    this.damageMult = 1;
    this.damageTakenMult = 1;
    this.spreadMult = 1;
    this.rangeMult = 1;
    this.healMult = 1;
    this.headshotMult = 1;
    this.passiveRegen = 0;
    this.reloadMult = 1;
    this.moveSpeedPct = 0;
    this.ammoMult = 1;
    this._healFrac = 0;

    this.applyPassives();

    // Гранаты: людям — по прокачке (0 без навыка), ботам — базовый
    // комплект 1+1 на жизнь (у них нет дерева, сток честный — тратят свой).
    this.fragGrenades = this.isAI ? 1 : fragMax();
    this.smokeGrenades = this.isAI ? 1 : smokeMax();

    // анимация броска гранаты: -1 = нет броска, иначе время (мс) от начала замаха
    this._throwT = -1;
    this._recoilT = 0;
    this._recoilDur = 120;
    // Взмах ближнего боя: время до конца удара, направление чередуется.
    this._swingT = 0;
    this._swingDur = 280;
    this._swingDir = 1;
    this._throwDur = 420;
    this._throwWind = 0.38;
    this._throwRaise = 2.4;
    this._throwType = null;
    this._throwAimX = 0;
    this._throwAimY = 0;

    this.ultActive = false;
    this.ultEndsAt = 0;
    this.ultCharge = 0;
    this.ultMaxCharge = 10;
    this.ultDuration = 10000;
    this.ultName = null;
    this.ultUnlockLevel = 1;

    this.aimX = x + 50;
    this.aimY = y;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setSize(30, 56);
    this.body.setOffset(1, 4);
    // Потолок скорости: долгое падение разгоняет тело и оно туннелит
    // сквозь тонкие платформы/грунт (спавн «в текстуре»). Прыжок -470
    // и выталкивание -800 под капом 800 — не режем.
    try { this.body.setMaxVelocity(600, 800); } catch (e) {}

    this.healthBar = scene.add.graphics().setVisible(false);
    this.armorBar = scene.add.graphics().setVisible(false);
    // Значок класса слева от ника (создаём лениво в updateBars —
    // текстуры cls_* пекутся сценой уже после бойцов).
    this.nameBadge = null;
    // Значок низкого боезапаса (слева от полосок, см. updateBars).
    this._ammoMark = scene.add.graphics().setVisible(false);
    this.nameText = scene.add.text(0, 0, this.playerName, {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5, 1);

    this.gun = scene.add.graphics();
    // Оружие ПОД кистями (4.2): перчатки лежат поверх рукоятки/цевья и
    // обхватывают их, а не прячутся под стволом («парение»/обрубки).
    this.gun.setDepth(4.2);
    this._drawGun();

    // полноценный ассет оружия вместо «палки»
    this.gunImg = null;
    this._gunImgKey = null;
    this._gunAllowed = true;

    this.art = this._detectArt();
    this._rcfg = getRigConfig();
    // Хитбокс под масштаб персонажа из рига (п.25).
    try {
      this._applyHitbox();
    } catch (e) {}
    this._allParts = [];
    this._tintParts = [];
    // Боты — рандомная внешность (убор + обувь из всего гардероба),
    // а не копия игрока. Футболка красится командой снаружи (синий/красный).
    // Сетевой чужак (config.gear) — внешность владельца, а не рандом.
    this._botGear = null;
    this._netForeign = !!(config.gear && typeof config.gear === 'object');
    try {
      const g = config.gear;
      if (g && typeof g === 'object') {
        const str = (v) => (typeof v === 'string' && v.length <= 40) ? v : null;
        this._botGear = { cap: str(g.cap), shoe: str(g.shoe), torso: str(g.torso), pants: str(g.pants) };
        if (!this._botGear.cap && !this._botGear.shoe && !this._botGear.torso && !this._botGear.pants) {
          this._botGear = null;
        }
      }
    } catch (e) { this._botGear = null; }
    if (!this._botGear && this.isAI && !this._netForeign) {
      try {
      const caps = ['__geo_cap_Assault', '__geo_cap_Tank', '__geo_cap_Medic', '__geo_cap_Sniper',
        'военный_шлем', 'камуфляжный_шлем', 'бескозырка',
        'маска_ночная', 'фуражка_парадная', 'шляпа_закона',
        'берет_десанта', 'берет_стрелка', 'маска_сапёра', 'каска_пожарная', 'бандана_атлета'];
      const shoes = ['__geo_shoe', 'полуберцы', 'ботинки_усиленные', 'берцы_камуфляж',
        'берцы_ночные', 'туфли_офицера', 'сапоги_шерифа',
        'берцы_десанта', 'боты_стрелка', 'сапоги_сапёра', 'боты_пожарные', 'кроссы_олимпийка'];
      const torsos = ['__geo_torso', 'торс_тельняшка', 'торс_разгрузка', 'торс_камуфляж',
        'торс_ночной', 'китель_офицера', 'куртка_шерифа',
        'торс_десанта', 'торс_стрелка', 'торс_сапёра', 'торс_пожарного', 'торс_олимпийка'];
      const pants = [null, 'штаны_камуфляж', 'штаны_чёрные', 'штаны_белые',
        'штаны_ночные', 'галифе_офицера', 'джинсы_шерифа',
        'штаны_десанта', 'штаны_стрелка', 'штаны_сапёра', 'штаны_пожарные', 'штаны_атлета'];
        const pick = (arr) => arr[(Math.random() * arr.length) | 0];
        this._botGear = { cap: pick(caps), shoe: pick(shoes), torso: pick(torsos), pants: pick(pants) };
      } catch (e) { this._botGear = null; }
    }

    const torsoCfg = this._partCfg('torso');
    if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
      // Геометрический торс: эллипс-«футболка» из своей текстуры
      // (красится цветом тела через тинт, как раньше).
      // Купленный торс из магазина — вместо базового (тот же размер).
      this._ensureGeoTextures(scene);
      let torsoKey = '__geo_torso';
      try {
        if (this._botGear && this._botGear.torso && scene.textures.exists(this._botGear.torso)) {
          torsoKey = this._botGear.torso;
        } else if (!this._netForeign) {
          const eqT = (typeof getEquippedTorso === 'function') ? getEquippedTorso((this.constructor && this.constructor.name) || undefined) : null;
          if (eqT && scene.textures.exists(eqT)) torsoKey = eqT;
        }
      } catch (e) {}
      this.torso = scene.add.image(this.x, this.y, torsoKey)
        .setOrigin(torsoCfg.px, torsoCfg.py)
        .setDepth(4);
      try {
        const _th = scene.textures.get('__geo_torso').getSourceImage().height || 36;
        this._geoTorsoH = _th;
        const _ts = (torsoCfg.s || 22) / _th;
        this.torso.setScale(_ts, _ts);
      } catch (e) { this._geoTorsoH = 36; }
      this._tintParts.push(this.torso);
      this._allParts.push(this.torso);
    } else {
      this.torso = scene.add.image(this.x, this.y, this._artTex('chr_torso'))
        .setOrigin(torsoCfg.px, torsoCfg.py)
        .setDepth(4);
      const torsoScale = this._artScale('chr_torso', 'torso');
      if (torsoScale) this.torso.setScale(torsoScale, torsoScale);
      if (!this.art.torso) this._tintParts.push(this.torso);
      this._allParts.push(this.torso);
    }

    if (this.scene.textures.exists('chr_legs_run')) {
      this._buildLegsRun();
    }

    this._buildArmsSkeleton();
    // GEO: рукава красятся цветом тела вместе с футболкой.
    if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
      [this._armUpRear, this._armUpFront].forEach(img => {
        if (img && !img._boneRect && !img._hiddenBySlice) this._tintParts.push(img);
      });
    }
    this.gun.setVisible(true);
    this.setAlpha(0);

    const charColors = getCharacterColors();
    // Сетевой чужак: кожа владельца (иначе все чужие с лицом хоста).
    try {
      const gb = config.gear && config.gear.body;
      if (Number.isFinite(gb) && gb >= 0 && gb <= 0xffffff) charColors.head = gb;
      else if (this.isAI) charColors.head = BOT_SKIN[(Math.random() * BOT_SKIN.length) | 0];
    } catch (e) {}
    const _geoHeadR = (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN)
      ? Math.max(6, (this._partCfg('head').s || 16) * 0.5)
      : 11;
    const _shadeSkin = (k) => {
      try {
        const h = (Number(charColors.head) >>> 0) || 0xe6b98c;
        const r = Math.min(255, Math.round(((h >> 16) & 255) * k));
        const g = Math.min(255, Math.round(((h >> 8) & 255) * k));
        const b = Math.min(255, Math.round((h & 255) * k));
        return (r << 16) | (g << 8) | b;
      } catch (e) { return 0x8a6042; }
    };
    const _skinStroke = _shadeSkin(0.52);
    this.head = scene.add.circle(this.x, this.y - 44, _geoHeadR, charColors.head, 1);
    this.head.setStrokeStyle(1.5, _skinStroke).setDepth(5);
    scene.physics.add.existing(this.head);
    this.head.body.setAllowGravity(false);
    this.head.body.setImmovable(true);
    // Хит-круг головы — с запасом +2 к визуалу: пуля 1700px/s проходит
    // ~28px/кадр и на дискретном оверлапе проскакивала мимо маленького
    // круга сидящего (диаметр 14 < шага). Запас закрывает туннелинг,
    // свип-тест в GameScene ловит остальное.
    this.head.body.setCircle(Math.max(7, _geoHeadR + 1));
    this.head.setData('isHead', true);
    this._geoHeadR = _geoHeadR;
    // База для previewScale (превью в меню): радиус и s головы на момент создания.
    this._geoHeadR0 = _geoHeadR;
    try { this._geoHeadS0 = this._partCfg('head').s || 16; } catch (e) { this._geoHeadS0 = 16; }
    // Геометрическое лицо: два глаза (белок + зрачок, смотрят по взгляду)
    // и простая кепка. Позиции обновляются в updateBars() за головой.
    this._geoFace = [];
    if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
      this._ensureGeoTextures(scene);
      const _earC = _shadeSkin(0.8);
      // Анатомическая шея (соединяет голову с воротником торса без зазора).
      this._neckVis = scene.add.ellipse(
        this.x, this.y - 38,
        Math.max(5.5, _geoHeadR * 0.72),
        Math.max(4.5, _geoHeadR * 0.58),
        _earC, 1
      );
      this._neckVis.setStrokeStyle(1, _skinStroke, 0.85).setDepth(4.85);
      this._geoFace.push(this._neckVis);
      this._allParts.push(this._neckVis);
      // Миндалевидный разрез глаз (вместо выпученных кружков) с верхним веком и радужкой.
      const _mkSclera = (w, h) => {
        const e = scene.add.ellipse(this.x, this.y - 44, w, h, 0xf2f4f7, 1);
        e.setStrokeStyle(0.7, 0x261810, 0.8).setDepth(5.2);
        this._geoFace.push(e);
        this._allParts.push(e);
        return e;
      };
      const _mkPupil = (r, color) => {
        const e = scene.add.circle(this.x, this.y - 44, r, color, 1);
        e.setDepth(5.22);
        this._geoFace.push(e);
        this._allParts.push(e);
        return e;
      };
      this._eyeWB = _mkSclera(Math.max(3.6, _geoHeadR * 0.42), Math.max(2.1, _geoHeadR * 0.24));
      this._eyeWF = _mkSclera(Math.max(4.4, _geoHeadR * 0.51), Math.max(2.5, _geoHeadR * 0.27));
      this._eyePB = _mkPupil(Math.max(1.25, _geoHeadR * 0.145), 0x182028);
      this._eyePF = _mkPupil(Math.max(1.55, _geoHeadR * 0.175), 0x182028);
      // Детали лица (глазницы/веки/скула/тени/стрижка) поверх головы.
      try {
        if (scene.textures.exists('__geo_face_ov')) {
          const ovTex = scene.textures.get('__geo_face_ov').getSourceImage();
          this._faceOv = scene.add.image(this.x, this.y - 44, '__geo_face_ov');
          this._faceOv.setDepth(5.1);
          this._faceOv.setScale((_geoHeadR * 2) / (ovTex.width || 20));
          this._geoFace.push(this._faceOv);
          this._allParts.push(this._faceOv);
        }
      } catch (e) {}
      // Брови, ухо (овальная раковина сзади), спинка носа (спереди) и сжатые губы.
      const _mkFace = (mk, color) => {
        const o = mk();
        o.setFillStyle(color, 1);
        o.setDepth(5.2);
        this._geoFace.push(o);
        this._allParts.push(o);
        return o;
      };
      {
        this._browF = _mkFace(() => scene.add.rectangle(this.x, this.y - 44, Math.max(3.2, _geoHeadR * 0.48), Math.max(1.1, _geoHeadR * 0.11)), 0x332218);
        this._browB = _mkFace(() => scene.add.rectangle(this.x, this.y - 44, Math.max(2.4, _geoHeadR * 0.36), Math.max(0.95, _geoHeadR * 0.095)), 0x332218);
        this._ear = _mkFace(() => scene.add.ellipse(this.x, this.y - 44, Math.max(2.2, _geoHeadR * 0.25), Math.max(3.4, _geoHeadR * 0.38)), _earC);
        try { this._ear.setStrokeStyle(0.9, _skinStroke, 0.85); } catch (e) {}
        this._nose = _mkFace(() => scene.add.ellipse(this.x, this.y - 44, Math.max(1.8, _geoHeadR * 0.20), Math.max(2.6, _geoHeadR * 0.28)), _earC);
      }
      this._mouth = _mkFace(() => scene.add.ellipse(this.x, this.y - 44, Math.max(3.6, _geoHeadR * 0.46), Math.max(1.3, _geoHeadR * 0.14), 0x5a2822), 0x5a2822);
      try { this._mouth.setStrokeStyle(0.8, 0x2a100c, 0.9); } catch (e) {}
      // Убор сидит низом на макушке (магазинные — origin 0.5/1,
      // классовые — 0.5/0.85).
      const _cls = (this.constructor && this.constructor.name) || 'Player';
      const _baseCap = (_cls === 'Tank' || _cls === 'Medic' || _cls === 'Sniper' || _cls === 'Assault')
        ? '__geo_cap_' + _cls
        : '__geo_cap';
      let _capKey = _baseCap;
      try {
        if (this._botGear && this._botGear.cap && scene.textures.exists(this._botGear.cap)) {
          _capKey = this._botGear.cap;
        } else if (!this._netForeign) {
          const _eqH = getEquippedHead((this.constructor && this.constructor.name) || undefined);
          if (_eqH && scene.textures.exists(_eqH)) _capKey = _eqH;
        }
      } catch (e) {}
      this._geoCapKey = _capKey;
      this.capImg = scene.add.image(this.x, this.y - 44, _capKey)
        .setDepth(5.3);
      if (_capKey.startsWith('__geo_cap')) this.capImg.setOrigin(0.5, 0.85);
      else this.capImg.setOrigin(0.5, 1);
      try {
        const _ch = scene.textures.get(_capKey).getSourceImage().height || 14;
        this._geoCapH = _ch;
        const _cs = Math.max(0.7, (this._partCfg('cap').s || 11) / _ch);
        this.capImg.setScale(_cs, _cs);
      } catch (e) { this._geoCapH = 14; }
      this._allParts.push(this.capImg);
    }

    const headC = this._partCfg('head');
    const capC = this._partCfg('cap');
    if (this.headImg) {
      this.head.setPosition(this.x + headC.ox, this.y + headC.oy);
    }
    if (this.art.head) {
      this.head.setVisible(false);
      this.headImg = scene.add.image(0, 0, this._artTex('chr_head'))
        .setOrigin(headC.px, headC.py)
        .setDepth(5);
      const headScale = this._artScale('chr_head', 'head');
      if (headScale) this.headImg.setScale(headScale, headScale);
      this._headH = this._targetH('head') || 0;
      this._allParts.push(this.headImg);
      if (this.art.cap) {
        const capScale = this._artScale('chr_cap', 'cap');
        this._capH = this._targetH('cap') || 0;
        this.capImg = scene.add.image(0, 0, this._artTex('chr_cap'))
          .setOrigin(capC.px, capC.py)
          .setDepth(5);
        if (capScale) this.capImg.setScale(capScale, capScale);
        this._allParts.push(this.capImg);
      }
    }

    if (!this.isAI) {
      this.refreshBodyColor();
    }

    this.neck = scene.add.circle(this.x, this.y - 32, 8, 0x000000, 0);
    this.neck.setDepth(5);
    scene.physics.add.existing(this.neck);
    this.neck.body.setAllowGravity(false);
    this.neck.body.setImmovable(true);
    this.neck.body.setCircle(8);

    // Тень-блоб под ногами: видна только на земле. Персонаж визуально
    // стоит на поверхности, а не висит в воздухе.
    try {
      this._shadow = scene.add.ellipse(this.x, this.y, 30, 9, 0x000000, 0.32);
      this._shadow.setDepth(1);
      this._shadow.setVisible(false);
    } catch (e) {
      this._shadow = null;
    }

    this.healthBar.setDepth(6);
    this.armorBar.setDepth(6);
    this.nameText.setDepth(7);

    // noDefaults — честное превью без снаряжения (выбор класса в лобби):
    // без флага пустым рукам выдаются штатные стволы и нож.
    const noDef = Boolean(config.noDefaults);
    if (this.isAI) {
      this.addWeapon(config.primary || 'bad_ak47');
      this.addWeapon(config.secondary || 'Makarov');
      // Боту тоже нож-запаска: без него при 0/0 он вечно щёлкает вхолостую.
      this.addWeapon('Knife');
    } else {
      const equipment = getEquipment(this.constructor.name) || {};
      if (equipment.primary) this.addWeapon(equipment.primary);
      if (equipment.secondary) this.addWeapon(equipment.secondary);
    }

    const inTutorial = Boolean(
      this.scene && this.scene.mode === 'CAMPAIGN' &&
      this.scene.campaignLevel && this.scene.campaignLevel.tutorial
    );
    if (!this.isAI && !inTutorial && !noDef && this.inventory.length === 0) {
      let defPrimary = 'bad_ak47';
      let defSecondary = 'Makarov';
      const defs = classDefinitions.find(cd => cd.id === this.constructor.name);
      if (defs) {
        defPrimary = defs.defaultPrimary || 'bad_ak47';
        defSecondary = defs.defaultSecondary || 'Makarov';
      }
      this.addWeapon(defPrimary);
      this.addWeapon(defSecondary);
    }
    if (!this.isAI && !noDef) {
      // Ближнее оружие из снаряжения (п.17): кейсовые катана/мачете вместо
      // ножа; иначе всегда нож.
      const eq2 = getEquipment(this.constructor.name) || {};
      if (eq2.melee && eq2.melee !== 'Knife') this.addWeapon(eq2.melee);
      else this.addWeapon('Knife');
    }
  }
  addWeapon(name) {
    return Guns.addWeapon(this, name);
  }

  applyPassives() {
    return Guns.applyPassives(this);
  }

  get weapon() {
    return this.inventory[this.activeWeaponIndex];
  }

  selectWeapon(index) {
    return Guns.selectWeapon(this, index);
  }

  // Выбор слота клавишами 1/2/3: 0 — основное, 1 — второе, 2 — холодное.
  // По категории, а не по индексу: подобранный пистолет встаёт в конец
  // инвентаря (за нож), а клавиша обязана давать второе оружие.
  // Совпадает со статичными слотами HUD (см. GameScene).
  selectWeaponSlot(slot) {
    return Guns.selectWeaponSlot(this, slot);
  }

  // Экипировать разрешённое носильщику (второе → нож). Вызывается при подборе.
  _armCarrierWeapon() {
    return Guns.armCarrierWeapon(this);
  }

  // Пусто в руках (0/0) — ищем ствол с патронами, иначе ближний бой.
  // Возвращаем индекс или -1. Выстрела в этом тике нет — только смена.
  _autoSwitchWeapon() {
    return Guns.autoSwitchWeapon(this);
  }

  jump() {
    return Move.jump(this);
  }

  move(direction) {
    return Move.move(this, direction);
  }

  stop() {
    return Move.stop(this);
  }

  refreshBodyColor() {
    if (this.isAI) return;
    this.setTint(getCharacterColors().body);
  }

  setTint(color) {
    super.setTint(color);
    this._partsTint = color;
    (this._tintParts || []).forEach(p => p && p.setTint(color));
    return this;
  }

  // Цели пульсации ульты: тело — всё красящееся, кроме лица/глаз
  // (им броня и ярость ни к чему), ноги с обувью — отдельным списком,
  // их подчёркиваем ярче, иначе на тёмных штанах пульса не видно.
  // Контейнеры (руки/ноги) setTint игнорят — спускаемся к детям.
  // GEO-кости — прямоугольники без setTint: их красим через setFillStyle.
  // Шею не трогаем никогда (невидимая, alpha 0 — засветим).
  _ultGlowTargets() {
    const body = [];
    const legObjs = [];
    const skip = new Set();
    try {
      if (this.head) skip.add(this.head);
      if (this.headImg) skip.add(this.headImg);
      if (this.neck) skip.add(this.neck);
      (this._geoFace || []).forEach(o => { if (o) skip.add(o); });
      [this._thighL, this._thighR, this._shinL, this._shinR,
       this._footL, this._footR, this.shoeL, this.shoeR].forEach(o => {
        if (o) skip.add(o);
      });
    } catch (e) {}
    const walk = (o) => {
      if (!o || skip.has(o)) return;
      try {
        if (typeof o.getChildren === 'function') {
          o.getChildren().forEach(walk);
          return;
        }
      } catch (e) {}
      try {
        if (this._glowPaintable(o)) body.push(o);
      } catch (e) {}
    };
    try { (this._allParts || []).forEach(walk); } catch (e) {}
    try { [this.capImg, this.torso].forEach(walk); } catch (e) {}
    try {
      [this._thighL, this._thighR, this._shinL, this._shinR,
       this._footL, this._footR, this.shoeL, this.shoeR].forEach(o => {
        try {
          if (o && this._glowPaintable(o)) legObjs.push(o);
        } catch (e) {}
      });
    } catch (e) {}
    return { body, legs: legObjs };
  }

  // Красится ли объект пульсом: картинка (setTint) или фигура (setFillStyle).
  _glowPaintable(o) {
    try {
      if (!o) return false;
      if (typeof o.setTint === 'function') return true;
      if (typeof o.setFillStyle === 'function' &&
          o.fillColor !== undefined && o.fillColor !== null) return true;
    } catch (e) {}
    return false;
  }

  // Слепок цвета для отката: { f: true — фигура, иначе картинка }.
  _glowRead(p) {
    try {
      if (p && typeof p.setTint === 'function') {
        return { f: false, v: (p.tintTopLeft ?? p.tintBottomLeft ?? 0xffffff) };
      }
      if (p && typeof p.setFillStyle === 'function' &&
          p.fillColor !== undefined && p.fillColor !== null) {
        return { f: true, v: p.fillColor };
      }
    } catch (e) {}
    return null;
  }

  // Покрасить (tintC — картинкам, shapeC — фигурам).
  _glowPaint(p, tintC, shapeC) {
    try {
      if (!p) return;
      if (typeof p.setTint === 'function') p.setTint(tintC);
      else if (typeof p.setFillStyle === 'function' &&
        p.fillColor !== undefined && p.fillColor !== null) p.setFillStyle(shapeC, 1);
    } catch (e) {}
  }

  // Откатить по слепку из _glowRead.
  _glowRestore(p, rec) {
    try {
      if (!p || !rec) return;
      if (rec.f) {
        if (typeof p.setFillStyle === 'function') p.setFillStyle(rec.v, 1);
      } else if (typeof p.setTint === 'function') {
        p.setTint(rec.v);
      }
    } catch (e) {}
  }

  setVisible(value) {
    super.setVisible(value);
    // Скрытые срезами кисти (_hiddenBySlice) не показываем никогда: перчатка
    // уже нарисована в срезе предплечья, бокс-дубликат не нужен.
    (this._allParts || []).forEach(p => p && p.setVisible(p._hiddenBySlice ? false : value));
    if (this.head) this.head.setVisible(this.art && this.art.head ? false : value);
    if (this.neck) this.neck.setVisible(value);
    this._setGunVisible(value);
    return this;
  }

  _setGunVisible(value) {
    const v = value && this._gunAllowed !== false;
    if (this.gun) this.gun.setVisible(v);
    if (this.gunImg) this.gunImg.setVisible(v);
  }

  _detectArt() {
    return Rig.detectArt(this);
  }

  _ensureGeoTextures(scene) {
    return Rig.ensureGeoTextures(this, scene);
  }

  _bakeOneGear(tm, make, key, w, h, draw) {
    return Rig.bakeOneGear(this, tm, make, key, w, h, draw);
  }

  _bakeGear(tm, make) {
    return Rig.bakeGear(this, tm, make);
  }

  _partCfg(name) {
    return Rig.partCfg(this, name);
  }

  _artTex(key) {
    return Rig.artTex(this, key);
  }

  _srcH(key) {
    try {
      const src = this.scene.textures.get(key).getSourceImage();
      if (src && src.height) return src.height;
    } catch (e) { /* noop */ }
    return 0;
  }

  _renderDims(key, cfgName) {
    return Rig.renderDims(this, key, cfgName);
  }

  _artScale(key, cfgName) {
    return Rig.artScale(this, key, cfgName);
  }

  _targetH(cfgName) {
    return Rig.targetH(this, cfgName);
  }

  _buildLegsRun() {
    return Rig.buildLegsRun(this);
  }

  _ankleOff(texKey, w, h, startY = 0, pivotX = 0.5) {
    return Rig.ankleOff(this, texKey, w, h, startY, pivotX);
  }

  _ankleAlign(boneKey) {
    return Rig.ankleAlign(this, boneKey);
  }

  rebuildLegsAnim() {
    return Rig.rebuildLegsAnim(this);
  }

  _srcW(key) {
    try {
      const t = this.scene.textures.get(key);
      const s = t.getSourceImage();
      return (s && s.width) || 1;
    } catch (e) {
      return 1;
    }
  }

  _buildArmsSkeleton() {
    return Rig.buildArmsSkeleton(this);
  }

  _weaponHands(ac) {
    return Rig.weaponHands(this, ac);
  }

  _recoilKick() {
    return Rig.recoilKick(this);
  }

  _poseArm(sx, sy, tx, ty, side, ac) {
    return Rig.poseArm(this, sx, sy, tx, ty, side, ac);
  }

  _pointOn(img, cfg, u, v) {
    return Rig.pointOn(this, img, cfg, u, v);
  }

  _anchorFor(childKey) {
    return Rig.anchorFor(this, childKey);
  }

  partLocalOn(childKey, wx, wy) {
    return Rig.partLocalOn(this, childKey, wx, wy);
  }

  partObject(key) {
    return Rig.partObject(this, key);
  }

  _updateParts() {
    return Rig.updateParts(this);
  }

  attachWorld(key) {
    return Rig.attachWorld(this, key);
  }

  _followHeadPuppet() {
    return Rig.followHeadPuppet(this);
  }

  muzzleWorld(angle) {
    return Shoot.muzzleWorld(this, angle);
  }

  aimAngle() {
    return Aim.aimAngle(this);
  }

  // Влезает ли стоящее тело (56k): столбец 3×2 точки. Нет сцены — влезает.
  // Прицел/LOS ботов берут голову/грудь отсюда же — в приседе голова
  // НИЖЕ (иначе бот целит в пустое место над макушкой стоячего).
  headYOffset() {
    return Aim.headYOffset(this);
  }
  bodyYOffset() {
    return Aim.bodyYOffset(this);
  }
  // Влезает ли стоящее тело: точный AABB-тест стоящего бокса
  // (30k x 56k, низ = текущий низ тела) против статики.
  // Раньше — 6 точек через _inSolid/сетку 30px с раздутием +12:
  // рядом с платформой сетка давала ложный «потолок» и игрок
  // навсегда оставался сидеть там, где место встать есть.
  // extra — запас над макушкой (для вставания в прыжке).
  canStand(extra = 0) {
    return Move.canStand(this, extra);
  }

  // Безопасно присесть: если после смены хитбокса центр внутри солида —
  // откат (иначе ресайз тела внутри геометрии = вечный клин).
  safeCrouch() {
    return Move.safeCrouch(this);
  }
  setCrouch(crouching, exact) {
    return Move.setCrouch(this, crouching, !!exact);
  }

  // Масштаб хитбокса из размеров рига: сумма высот торс+ноги+голова
  // относительно дефолта (22+26+16=64).
  _rigHitboxK() {
    return Move.rigHitboxK(this);
  }

  // k467 ЗАПЛАТКА УДАЛЕНА (2026-10-22). Раньше здесь было выталкивание тела
  // из статики: лечило следствие и давало заметный толчок при приседе у ящика.
  // По директиве ТЗ «не костыли, а причины» (docs/ctf-bots.md) убрано.
  // ДОЛГ: причина входа в ящик. Что известно по логу [pen] (кадр ВХОДА):
  //   • вход начинается с 2-4px горизонтального зацепа в ВОЗДУХЕ (присед),
  //     затем перекрытие растёт до 28px — Arcade не разделяет даже 2px;
  //   • коллайдеры укрытий зарегистрированы (spawns.js:114 для игрока,
  //     spawns.js:188-189 для ботов) — дело не в регистрации;
  //   • кандидат на проверку: clampFighterMotion (navGraph.js) для vy>0
  //     берёт пол только если `ob.y` в [B-1, B+travel]; если тело уже
  //     просело ниже верха ящика, ящик перестаёт считаться полом и тело
  //     проваливается внутрь. Нужен трейс колбэка коллайдера, чтобы
  //     подтвердить/опровергнуть.

  // k463: РЕАЛЬНАЯ ширина нарисованного персонажа (кэш по стойке) — по ней
  // ставится ширина тела: 30*k давало 49px при видимых 24px.
  _rigWidthNow() {
    const key = this.crouching ? 'c' : 's';
    const cache = this._rigWC || (this._rigWC = {});
    if (cache[key] != null) return cache[key];
    let L = Infinity, R = -Infinity;
    try {
      const parts = [this.head, this.neck, this.torso, this.legs, this.legsRun,
        this.armGun, this.armFront, this.headImg, this.capImg, this.shoeL, this.shoeR];
      for (const o of parts) {
        if (!o || o.active === false) continue;
        const dw = o.displayWidth || 0;
        if (!dw) continue;
        const ox = (o.originX == null) ? 0.5 : o.originX;
        L = Math.min(L, o.x - dw * ox);
        R = Math.max(R, o.x + dw * (1 - ox));
      }
    } catch (e) {}
    if (L === Infinity || (R - L) < 8) return null;
    cache[key] = R - L;
    return cache[key];
  }

  // Высота — как раньше (56k/38k, низ на месте). Ширина — по ригу.
  // Offset по X считаем ОТ ФАКТИЧЕСКОГО положения тела: левый край кадра
  // в мире = bodyL - offset.x (offset→мир 1:1, проверено замером). Формулы
  // через displayWidth/origin давали промах 11px — кадр у этого спрайта
  // не центрирован относительно origin.
  _applyHitbox() {
    const b = this.body;
    if (!b) return;
    const k = this._rigHitboxK();
    const crouch = !!this.crouching;
    const hh = (crouch ? 38 : 56) * k;
    const rigW = this._rigWidthNow();
    const baseW = 30 * k;
    const ww = (rigW && rigW > 8) ? Math.min(baseW, rigW + 3) : baseW;
    const offOld = (b.offset && Number.isFinite(b.offset.x)) ? b.offset.x : 0;
    // k470: доводка X — только при реальной смене ширины (не от 1px разницы
    // в измерении рига при приседе: из-за неё центр тела прыгал на 5px).
    const _wChanged = (this._hbW == null) || Math.abs(this._hbW - ww) > 2.5;
    this._hbW = ww;
    // k474 (ОТКАЧЕНО): «держать низ/центр при смене стойки» — аналитический
    // offset и updateFromGameObject дали ХУЖЕ (клип 111 → 740 → 180 против 82).
    // Причина: отображение offset → мир в Phaser не 1:1 с кадром спрайта,
    // формулы без замера коэффициента врут. Долг: замерить коэффициент
    // (сдвиг offset на +10 → сдвиг мира в px) и считать по нему.
    b.setSize(ww, hh, false);
    b.setOffset(offOld, (crouch ? 22 : 4) * k);
    // k476: ЗАМЕР СДЕЛАН, СИНХРОНИЗАЦИЯ ОТКАЧЕНА (2026-10-22).
    // Коэффициент offset→мир измерен (tools/headless/probe_crouch.mjs):
    // Δoffset.y=+10 → Δbody.y=+10, 1:1, но применяется лишь на следующем
    // Body.preUpdate. В кадре смены стойки низ тела «уезжает» на 18k≈29.5px
    // (ровно это ловит [pen] в 12 записях/матч).
    // НО принудительный updateFromGameObject здесь ухудшил физику:
    // clip 48 → 867 тиков, позы «присед внутри ящика» с нулевой скоростью
    // (Arcade: _dx=_dy=0 → embedded → разделение не выполняется). Причина:
    // postUpdate двигает СПРАЙТ дельтой, поэтому ручной пересчёт позиции
    // тела из спрайта внутри кадра меняет фазу «тело↔спрайт».
    // Значит причина клипа — не только мёртвое окно; ищем вход в статику.
    if (_wChanged) this._hbFit = 60;
  }

  aimAt(x, y) {
    return Aim.aimAt(this, x, y);
  }

  // Какая сторона «впереди»: переворот происходит только ЖЁСТКО за пределами полосы
  // (deadzone ±24px вокруг центра тела), и запоминается. Иначе прицел, ползущий по
  // плечу/телу, дёргал бы персонажа и автомат туда-сюда через линию центра.
  _getSide() {
    return Aim.getSide(this);
  }

  // Цель прицела, прижатая ВПЕРЁД от точки sx/sy. Когда прицел «на себе» или за
  // спиной (мёртвая зона _getSide), руки/ствол не выворачиваются назад: направляем
  // их вперёд, сохраняя вертикальную составляющую (смотрю вниз/вверх — туда же,
  // но не назад). Используется для рук, автомата и наклонов.
  _clampedAim(sx, sy) {
    return Aim.clampedAim(this, sx, sy);
  }

  // Наклон головы/торса к прицелу (по прижатой вперёд цели): база угла — floor 26px,
  // мёртвая зона ±0.35 рад (пока прицел почти на уровне глаз — не наклоняемся),
  // плавная реакция до ±1.
  _leanFactor(dy, bx) {
    return Aim.leanFactor(this, dy, bx);
  }

  // Размер оружия из редактора (п.23–24): per-weapon gunScale из рига,
  // 1 = как раньше. Хранится в localStorage — живёт без редактора.

  // Масштаб персонажа для пушки: ствол растёт вместе с телом
  // (torso.s 22 = дефолт). Иначе большой персонаж держит игрушечный автомат.
  _charGunK() {
    return Aim.charGunK(this);
  }

  // Полный масштаб ствола: ручная настройка × размер персонажа.
  _gunFullScale(name) {
    return Aim.gunFullScale(this, name);
  }

  previewScale(k) {
    return Rig.previewScale(this, k);
  }

  // Прямой сдвиг ствола из редактора (СтвX вдоль ствола, СтвY поперёк),
  // per-weapon. Даёт подвинуть пушку руками, а не только руки под пушку.
  _gunOffset(name) {
    return Aim.gunOffset(this, name);
  }

  _drawGun() {
    return Shoot.drawGun(this);
  }

  // Фаза анимации перезарядки (0..1 по РЕАЛЬНОМУ прогрессу:
  // reloadTime оружия × reloadMult скиллов). Возвращает наклон ствола,
  // тряску и экскурс передней руки к магазину — ствол (updateGun) и руки
  // (_poseArm) берут значения из одного места и не расходятся.
  // null — не перезаряжаемся (руки/ствол как обычно).
  _reloadAnim() {
    return Shoot.reloadAnim(this);
  }

  updateGun() {
    return Shoot.updateGun(this);
  }

  shoot(time, targetX, targetY) {
    return Shoot.shoot(this, time, targetX, targetY);
  }

  // Один залп: звук (опционально), вспышка, гильза, пули с разбросом.

  // Хвост очереди: оставшиеся патроны — без гейта темпа (очередь уже
  // оплачена первым нажатием), каждый жрёт патрон из магазина.
  // Смерть, смена ствола или пустой магазин очередь обрывают.

  // Мировой угол доворота рук и ствола за взмахом (0 — покой).
  // Кривая: замах назад (0–30%), рубящий пронос (30–65%), возврат.
  // Направление чередуется каждый удар (вверх-вниз / вниз-вверх).
  _swingRot() {
    return Shoot.swingRot(this);
  }

  useAbility(time) {
    return Abilities.useAbility(this, time);
  }

  // Финальная проверка точки кита ПОСЛЕ спавна (escapeGeometry мог
  // утащить наверх): недостижим ни мне, ни союзнику рядом с посадкой —
  // вернуть к моим ногам. Окна — как у _findTaker (Pickup).
  // why — ветка ('aim'/'drop'), для диагностики в консоли.

  throwAbility(type, dist = 80, targetX = null) {
    return Abilities.throwAbility(this, type, dist, targetX);
  }

  useUltimate(time) {
    return Abilities.useUltimate(this, time);
  }

  addUltCharge(amount) {
    return Abilities.addUltCharge(this, amount);
  }

  activateUltimate() {}

  // zone: 'head' | 'body' | 'legs'. Голова x2 (кроме взрывов),
  // ноги x0.7, тело x1. Взрывы ('frag'/'RPG') зональность игнорят.
  receiveDamage(amount, attacker, src, zone) {
    return Damage.receiveDamage(this, amount, attacker, src, zone);
  }

  throwGrenade(type, aimX, aimY) {
    return Shoot.throwGrenade(this, type, aimX, aimY);
  }

  // продвижение анимации броска; на релизе (после замаха) спавнится граната
  _updateThrowAnim() {
    return Shoot.updateThrowAnim(this);
  }

  heal(amount, src) {
    return Damage.heal(this, amount, src);
  }

  // Зелёный плюсик над тем, кому прибавилось ХП (реже 250мс, чтобы аура
  // 0.04/кадр не спамила).

  restoreArmor(amount) {
    return Damage.restoreArmor(this, amount);
  }

  die(killer) {
    return Damage.die(this, killer);
  }

  // Эффект смерти по зоне добивания: голова — золотой фонтан вверх
  // + надпись, тело — широкая красная вспышка, ноги — пыль и мало крови.
  // Поверх общего burst (вспышка+кольцо+осколки) в die().

  _setPartsVisible(v) {
    return Rig.setPartsVisible(this, v);
  }

  // Щит спавна 1с (k206/k208): взводит revive() и старт матча (см. GameScene).
  // БЕЗ визуала на базе: база спрайта всегда невидима (alpha 0, риг —
  // отдельные части), любой tween alpha её засвечивает командным
  // прямоугольником позади модели. Молчаливый щит; индикатор — только
  // отдельным кольцом (по запросу), не альфой тела.
  _applySpawnProt() {
    return Damage.applySpawnProt(this);
  }

  revive(x, y) {
    return Damage.revive(this, x, y);
  }

  // Мало патронов (<20% всего боезапаса текущего ствола)?
  // Мили и бесконечные (ульта штурмовика) — мимо.

  updateBars() {
    return Hud.updateBars(this);
  }

  _smokeParts() {
    return Rig.smokeParts(this);
  }

  destroy(fromScene) {
    try {
      (this.inventory || []).forEach(w => { if (w && w.cancelReload) w.cancelReload(); });
    } catch (e) {}
    if (this._shadow) {
      try { this._shadow.destroy(); } catch (e) {}
      this._shadow = null;
    }
    if (this.aura) {
      this.aura.destroy();
    }
    if (this._ultTimer) {
      try { this._ultTimer.remove(); } catch (e) {}
      this._ultTimer = null;
    }
    if (this._ultTick) {
      try { this._ultTick.remove(); } catch (e) {}
      this._ultTick = null;
    }
    if (this._ultEndTimer) {
      try { this._ultEndTimer.remove(); } catch (e) {}
      this._ultEndTimer = null;
    }
    if (this._ultRingT) {
      try { this._ultRingT.remove(); } catch (e) {}
    }
    if (this._ultRing) {
      try { this._ultRing.destroy(); } catch (e) {}
    }
    if (this._auraTick) {
      try { this._auraTick.remove(); } catch (e) {}
    }
    if (this._ultActiveTimer) {
      try { this._ultActiveTimer.remove(); } catch (e) {}
      this._ultActiveTimer = null;
    }
    if (this.gun) {
      this.gun.destroy();
    }
    if (this.gunImg) {
      this.gunImg.destroy();
    }
    this.healthBar.destroy();
    this.armorBar.destroy();
    if (this._ammoMark) { try { this._ammoMark.destroy(); } catch (e) {} this._ammoMark = null; }
    this.nameText.destroy();
    if (this.nameBadge) { try { this.nameBadge.destroy(); } catch (e) {} this.nameBadge = null; }
    this.head.destroy();
    this.neck.destroy();
    if (this.torso) this.torso.destroy();
    if (this.legs) this.legs.destroy();
    if (this.legsRun) this.legsRun.destroy();
    if (this.armGun) this.armGun.destroy();
    if (this.armFront) this.armFront.destroy();
    if (this.headImg) this.headImg.destroy();
    if (this.capImg) this.capImg.destroy();
    if (this._geoFace) {
      try { this._geoFace.forEach(e => { if (e) e.destroy(); }); } catch (e) {}
      this._geoFace = null;
    }
    this._faceOv = null; this._neckVis = null; this._eyeWF = null; this._eyePF = null; this._eyeWB = null; this._eyePB = null;
    this._browF = null; this._browB = null; this._ear = null; this._nose = null; this._mouth = null;
    if (this.shoeL) this.shoeL.destroy();
    if (this.shoeR) this.shoeR.destroy();
    super.destroy(fromScene);
  }
}

// Печка уборов/обуви для сцен без персонажей (магазин): методы печки
// состояния не используют, дёргаем их напрямую через прототип.
export function bakeGearTextures(scene) {
  try {
    if (!scene || !scene.textures || !scene.make) return;
    const self = { _bakeOneGear: Player.prototype._bakeOneGear };
    Player.prototype._bakeGear.call(self, scene.textures, scene.make);
  } catch (e) { /* без вещей — как было */ }
}
