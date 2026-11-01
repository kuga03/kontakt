import Player from '../entities/Player.js?v=382';
import { RIG_DEFAULTS, cloneRigConfig, getRigConfig, saveRigConfig, resetRigConfig, getSizeLock, setSizeLock, isSizeLocked } from '../data/rigConfig.js?v=169';
import { weaponImage, weaponsList } from '../data/weapons.js?v=170';
import { gameW, UX } from '../ui/layout.js?v=3';

// РЕДАКТОР ПЕРСОНАЖА (переписан с нуля, v3).
// Тот же функционал, что был: части, размеры, шарниры, крепления,
// зеркало, кости ног/рук, хват оружия, точка вылета, анимации.
// Отличия от старой версии (они и давали чёрный экран):
//   - ОДНА камера (main). Второй камеры и ручных cameraFilter больше нет.
//   - Интерфейс строится ПОСЛЕ превью персонажа.
// Никаких тяжёлых операций с текстурами тут нет — превью собирает Player.

const PARTS = [
  { key: 'torso', label: 'Футболка' },
  { key: 'head', label: 'Голова' },
  { key: 'cap', label: 'Головной убор' },
  { key: 'legs', label: 'Ноги' },
  { key: 'shoes', label: 'Обувь' },
  { key: 'arms', label: 'Руки + оружие' },
  { key: 'muzzle', label: 'Точка вылета пули' }
];

const HINGE_PARTS = ['torso', 'head', 'cap', 'arms', 'legs'];

const PARENT_OF = {
  head: 'torso',
  cap: 'head',
  arms: 'torso',
  legs: 'torso'
};

const MIRROR_PARTS = ['torso', 'head', 'cap', 'legs'];

const BTN = {
  fontSize: '14px',
  color: '#ffffff',
  backgroundColor: '#22224a',
  padding: { left: 8, right: 8, top: 4, bottom: 4 }
};

const BTN_ACTIVE = {
  fontSize: '14px',
  color: '#88ff88',
  backgroundColor: '#334455',
  padding: { left: 8, right: 8, top: 4, bottom: 4 }
};

export default class RigEditorScene extends Phaser.Scene {
  constructor() {
    super('RigEditorScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1c1c36');
    try { this.cameras.main.transparent = false; } catch (e) {}

    this.state = getRigConfig() || cloneRigConfig(RIG_DEFAULTS);
    this.selected = 'torso';
    this.muzzleMode = false;
    this.hingeMode = false;
    this.attachMode = false;
    this.mirrorMode = false;
    this.sideFacing = 1;
    this.forceWalkToggle = false;
    this.showGun = true;
    this.shoeSide = 'L';
    this.boneKey = 'thigh';
    this.hipSide = null;
    this.tanko = false;
    this.fitMode = false;
    this.fitHandle = 'top';
    this.animMode = null;
    this.ui = [];
    this.partButtons = {};

    // Зум колесом — вокруг персонажа.
    this.input.on('wheel', (pointer, objects, deltaX, deltaY) => {
      const cam = this.cameras.main;
      const z = Phaser.Math.Clamp(cam.zoom * (deltaY < 0 ? 1.1 : 1 / 1.1), 0.5, 4);
      this._zoomTo(z);
    });

    // Пол нужен превью для коллайдера — он первый. Стенд и маркеры —
    // ПОСЛЕ превью, вместе с интерфейсом.
    this.floor = this.add.rectangle(UX(this, 760), 610, 1500, 40, 0x8d96a6, 0.95).setDepth(-3);
    this.physics.add.existing(this.floor, true);

    this._buildPreview();
    this.markers = this.add.graphics().setDepth(30);
    this.stage = this.add.rectangle(UX(this, 700), 505, 880, 300, 0xb9c1d2, 0.4).setDepth(-4);
    this._buildPanel();
    this._buildStamps();
    this._refresh();

    this.input.on('pointermove', (p, over) => this._onMove(p, over));
    this.input.on('pointerdown', p => this._onClick(p));

    // T — малиновые ноги (проверка рендера спрайтов).
    this.input.keyboard.on('keydown-T', () => {
      window.__artDbg = !window.__artDbg;
      this._apply();
    });
    // P — пауза анимации превью.
    this.input.keyboard.on('keydown-P', () => {
      const l = this.preview && this.preview.legsRun;
      if (!l || !l.anims || !l.anims.isPlaying) return;
      l.anims.pause();
    });
    // R — ходьба на месте.
    this.input.keyboard.on('keydown-R', () => {
      this.forceWalkToggle = !this.forceWalkToggle;
      this._forcePreviewMode(this.preview);
      this._refresh();
    });
    // K — бег/шаг.
    this.input.keyboard.on('keydown-K', () => {
      const part = this.state.legs || (this.state.legs = {});
      part.run = !(part.run !== false);
      this._apply();
    });

    console.info('[RIG] editor v3 ready');
  }

  _zoom(step) {
    const cam = this.cameras.main;
    this._zoomTo(Phaser.Math.Clamp(cam.zoom + step, 0.5, 4));
  }

  _zoomTo(z) {
    const cam = this.cameras.main;
    const p = this.preview;
    if (p) {
      const cx = p.x;
      const cy = (p.torso ? p.torso.y : p.y) - 6;
      cam.centerOn(cx, cy);
    }
    cam.zoomTo(z, 140, 'Linear', true);
  }

  _btn(x, y, label, cb, active) {
    const b = this.add.text(x, y, label, active ? BTN_ACTIVE : BTN)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.ui.push(b);
    b.on('pointerover', () => b.setStyle(BTN_ACTIVE));
    b.on('pointerout', () => {
      const is = this.partButtons && this.partButtons[this.selected] === b;
      b.setStyle(is || active ? BTN_ACTIVE : BTN);
    });
    b.on('pointerdown', () => {
      this._suppressClick = true;
      this._ghost = null;
      if (cb) cb();
      this.time.delayedCall(15, () => { this._suppressClick = false; }, [], this);
    });
    return b;
  }

  _visToggle(b, on, offCb) {
    if (!b) return;
    if (on) {
      b.setVisible(true).setAlpha(1).setInteractive({ useHandCursor: true });
    } else {
      b.setVisible(false).setAlpha(0.2).disableInteractive();
      if (offCb) offCb();
    }
  }

  _buildPanel() {
    const colX = c => 60 + c * 118;
    const _cx = gameW(this) / 2;
    const rowY = r => 72 + r * 34;
    const short = { cap: 'Убор', legs: 'Ноги', arms: 'Руки/оружие', muzzle: 'Точка вылета' };

    const info = this.add.text(UX(this, 880), 58, '', {
      fontSize: '15px',
      color: '#ffffff',
      align: 'left',
      wordWrap: { width: 288 }
    }).setOrigin(0).setScrollFactor(0);
    this.info = info;
    this.ui.push(info);

    PARTS.forEach((part, i) => {
      const c = i < 4 ? 0 : 1;
      const b = this._btn(colX(c), rowY(i % 4), short[part.key] || part.label, () => {
        this.selected = part.key;
        this.muzzleMode = false;
        this.hingeMode = false;
        this.attachMode = false;
        this.fitMode = false;
        this.fitHandle = 'top';
        if (!MIRROR_PARTS.includes(part.key)) this.mirrorMode = false;
        this._refresh();
      });
      this.partButtons[part.key] = b;
    });

    this.sizeDownBtn = this._btn(colX(0), rowY(4), 'Размер −', () => this._adjust('s', -1));
    this.sizeUpBtn = this._btn(colX(1), rowY(4), 'Размер +', () => this._adjust('s', 1));
    this._btn(colX(2), rowY(4), 'Сброс', () => this._resetPart());
    this.growDownBtn = this._btn(colX(4), rowY(4), 'Рост −', () => this._grow(0.95));
    this.growUpBtn = this._btn(colX(4), rowY(5), 'Рост +', () => this._grow(1.05));
    // Замок размеров: текущий размер тела запоминается как стоковый эталон,
    // Размер/Рост у всего, кроме рук, прячутся. Руки крутятся всегда.
    this.lockToggle = this._btn(colX(4), rowY(9), 'Замок: выкл', () => {
      const locked = !(getSizeLock(this.state).locked);
      setSizeLock(this.state, locked);
      this._refresh();
    });
    this.shoeSideToggle = this._btn(colX(3), rowY(4), 'Стопа: левая', () => {
      this.shoeSide = this.shoeSide === 'L' ? 'R' : 'L';
      this._refresh();
    });

    this.xyBtns = [
      this._btn(colX(0), rowY(5), 'X −', () => this._adjust('ox', -1)),
      this._btn(colX(1), rowY(5), 'X +', () => this._adjust('ox', 1)),
      this._btn(colX(2), rowY(5), 'Y −', () => this._adjust('oy', -1)),
      this._btn(colX(3), rowY(5), 'Y +', () => this._adjust('oy', 1))
    ];

    this._btn(colX(0), rowY(6), 'Px −', () => this._adjust('px', -0.05));
    this._btn(colX(1), rowY(6), 'Px +', () => this._adjust('px', 0.05));
    this._btn(colX(2), rowY(6), 'Py −', () => this._adjust('py', -0.05));
    this._btn(colX(3), rowY(6), 'Py +', () => this._adjust('py', 0.05));

    const bobBtns = [
      this._btn(colX(0), rowY(10), 'Аним −', () => this._adjust('fps', -1)),
      this._btn(colX(1), rowY(10), 'Аним +', () => this._adjust('fps', 1)),
      this._btn(colX(2), rowY(10), 'Част −', () => this._adjust('bobFreq', -0.25)),
      this._btn(colX(3), rowY(10), 'Част +', () => this._adjust('bobFreq', 0.25)),
      this._btn(colX(0), rowY(11), 'Бок −', () => this._adjust('bobX', -0.5)),
      this._btn(colX(1), rowY(11), 'Бок +', () => this._adjust('bobX', 0.5)),
      this._btn(colX(2), rowY(11), 'Верт −', () => this._adjust('bobY', -0.5)),
      this._btn(colX(3), rowY(11), 'Верт +', () => this._adjust('bobY', 0.5))
    ];
    this.bobBtns = bobBtns;
    // Точечная доводка кистей (мировые X/Y, шаг 1px, отдельно под ствол):
    // задняя кисть — ряд 10, передняя — ряд 11. Видны только в разделе рук.
    this.nudgeBtns = [
      this._btn(colX(0), rowY(10), 'ЗX −', () => this._adjust('rearFX', -1)),
      this._btn(colX(1), rowY(10), 'ЗX +', () => this._adjust('rearFX', 1)),
      this._btn(colX(2), rowY(10), 'ЗY −', () => this._adjust('rearFY', -1)),
      this._btn(colX(3), rowY(10), 'ЗY +', () => this._adjust('rearFY', 1)),
      this._btn(colX(0), rowY(11), 'ПX −', () => this._adjust('frontFX', -1)),
      this._btn(colX(1), rowY(11), 'ПX +', () => this._adjust('frontFX', 1)),
      this._btn(colX(2), rowY(11), 'ПY −', () => this._adjust('frontFY', -1)),
      this._btn(colX(3), rowY(11), 'ПY +', () => this._adjust('frontFY', 1))
    ];

    const boneBtns = [
      this._btn(colX(0), rowY(12), 'Бедро −', () => this._adjust('thigh', -1)),
      this._btn(colX(1), rowY(12), 'Бедро +', () => this._adjust('thigh', 1)),
      this._btn(colX(2), rowY(12), 'Икра −', () => this._adjust('shin', -1)),
      this._btn(colX(3), rowY(12), 'Икра +', () => this._adjust('shin', 1)),
      this._btn(colX(0), rowY(13), 'Шаг −', () => this._adjust('swing', -0.02)),
      this._btn(colX(1), rowY(13), 'Шаг +', () => this._adjust('swing', 0.02)),
      this._btn(colX(2), rowY(13), 'Подъём −', () => this._adjust('lift', -0.03)),
      this._btn(colX(3), rowY(13), 'Подъём +', () => this._adjust('lift', 0.03)),
      this._btn(colX(0), rowY(14), 'Сгиб −', () => this._adjust('knee', -0.05)),
      this._btn(colX(1), rowY(14), 'Сгиб +', () => this._adjust('knee', 0.05)),
      this._btn(colX(2), rowY(14), 'Толщ.б −', () => this._adjust('thighW', -0.05)),
      this._btn(colX(3), rowY(14), 'Толщ.б +', () => this._adjust('thighW', 0.05)),
      this._btn(colX(0), rowY(15), 'Толщ.и −', () => this._adjust('shinW', -0.05)),
      this._btn(colX(1), rowY(15), 'Толщ.и +', () => this._adjust('shinW', 0.05)),
      this._btn(colX(2), rowY(15), 'Толщ.с −', () => this._adjust('footW', -0.05)),
      this._btn(colX(3), rowY(15), 'Толщ.с +', () => this._adjust('footW', 0.05)),
      this._btn(colX(0), rowY(12), 'Плечо −', () => this._adjust('upper', -1)),
      this._btn(colX(1), rowY(12), 'Плечо +', () => this._adjust('upper', 1)),
      this._btn(colX(2), rowY(12), 'Предпл −', () => this._adjust('fore', -1)),
      this._btn(colX(3), rowY(12), 'Предпл +', () => this._adjust('fore', 1)),
      this._btn(colX(0), rowY(13), 'Толщ.п −', () => this._adjust('upW', -0.1)),
      this._btn(colX(1), rowY(13), 'Толщ.п +', () => this._adjust('upW', 0.1)),
      this._btn(colX(2), rowY(13), 'Толщ.пр −', () => this._adjust('foreW', -0.1)),
      this._btn(colX(3), rowY(13), 'Толщ.пр +', () => this._adjust('foreW', 0.1)),
      this._btn(colX(0), rowY(14), 'Рук −', () => this._adjust('rearFrac', -0.05)),
      this._btn(colX(1), rowY(14), 'Рук +', () => this._adjust('rearFrac', 0.05)),
      this._btn(colX(2), rowY(14), 'Цев −', () => this._adjust('frontFrac', -0.05)),
      this._btn(colX(3), rowY(14), 'Цев +', () => this._adjust('frontFrac', 0.05)),
      this._btn(colX(0), rowY(15), 'СгибЗ −', () => this._adjust('elbowBendRear', -0.05)),
      this._btn(colX(1), rowY(15), 'СгибЗ +', () => this._adjust('elbowBendRear', 0.05)),
      this._btn(colX(2), rowY(15), 'СгибП −', () => this._adjust('elbowBendFront', -0.05)),
      this._btn(colX(3), rowY(15), 'СгибП +', () => this._adjust('elbowBendFront', 0.05)),
      this._btn(colX(0), rowY(16), 'РукY −', () => this._adjust('rearDrop', -1)),
      this._btn(colX(1), rowY(16), 'РукY +', () => this._adjust('rearDrop', 1)),
      this._btn(colX(2), rowY(16), 'ЦевY −', () => this._adjust('frontDrop', -1)),
      this._btn(colX(3), rowY(16), 'ЦевY +', () => this._adjust('frontDrop', 1)),
      this._btn(colX(0), rowY(18), 'Ствол −', () => this._adjust('gunScale', -0.1)),
      this._btn(colX(1), rowY(18), 'Ствол +', () => this._adjust('gunScale', 0.1)),
      // Переключатель оружия: проверить хват и точку вылета у КАЖДОГО ствола.
      // Настройки пишутся отдельно под каждое оружие и потом грузятся в матчах.
      this._btn(colX(2), rowY(18), 'Пушка ◀', () => this._cycleWeapon(-1)),
      this._btn(colX(3), rowY(18), 'Пушка ▶', () => this._cycleWeapon(1))
    ];
    this.boneBtns = boneBtns;
    // Сдвиг ствола: ряды 16–17, всегда видны в разделе рук
    // (в 19-м ряду их наполовину съедал край экрана).
    this.gunXBtns = [
      this._btn(colX(0), rowY(16), 'СтвX −', () => this._adjust('gunOX', -2)),
      this._btn(colX(1), rowY(16), 'СтвX +', () => this._adjust('gunOX', 2))
    ];
    this.gunYBtns = [
      this._btn(colX(0), rowY(17), 'СтвY −', () => this._adjust('gunOY', -2)),
      this._btn(colX(1), rowY(17), 'СтвY +', () => this._adjust('gunOY', 2))
    ];

    this.boneKeyBtns = [
      this._btn(colX(2), rowY(16), 'Пив: бедро', () => { this.boneKey = 'thigh'; this._refresh(); }),
      this._btn(colX(3), rowY(16), 'Пив: икра', () => { this.boneKey = 'shin'; this._refresh(); })
    ];
    this.hipBtns = [
      this._btn(colX(0), rowY(17), 'Сгиб.б −', () => this._adjust('hip', -0.05)),
      this._btn(colX(1), rowY(17), 'Сгиб.б +', () => this._adjust('hip', 0.05))
    ];
    this.tankoToggle = this._btn(colX(2), rowY(17), 'Тонко: выкл', () => {
      this.tanko = !this.tanko;
      this._refresh();
    });
    this.hipSideToggle = this._btn(colX(3), rowY(17), 'Креп: —', () => {
      this.hipSide = this.hipSide === 'left' ? 'right' : (this.hipSide === 'right' ? null : 'left');
      this._refresh();
    });
    this.autoFitBtn = this._btn(colX(4), rowY(17), 'Авто-подбор', () => {
      this._autoFitLegs();
    });
    this.fitToggle = this._btn(colX(1), rowY(16), 'Натяг', () => {
      this.fitMode = !this.fitMode;
      this.fitHandle = 'top';
      this.muzzleMode = false;
      this.hingeMode = false;
      this.attachMode = false;
      this._refresh();
    });

    this.muzzleToggle = this._btn(colX(0), rowY(7), 'Точка', () => {
      this.muzzleMode = !this.muzzleMode;
      this.hingeMode = false;
      this.attachMode = false;
      this.fitMode = false;
      this._refresh();
    });
    this.attachToggle = this._btn(colX(1), rowY(7), 'Крепление', () => {
      this.attachMode = !this.attachMode;
      this.muzzleMode = false;
      this.hingeMode = false;
      this.fitMode = false;
      this._refresh();
    });
    this.hingeToggle = this._btn(colX(2), rowY(7), 'Шарнир', () => {
      this.hingeMode = !this.hingeMode;
      this.muzzleMode = false;
      this.attachMode = false;
      this.fitMode = false;
      this._refresh();
    });
    this.mirrorToggle = this._btn(colX(3), rowY(7), 'Зеркало', () => {
      if (!MIRROR_PARTS.includes(this.selected)) return;
      this.mirrorMode = !this.mirrorMode;
      this.muzzleMode = false;
      this.hingeMode = false;
      this.attachMode = false;
      this.fitMode = false;
      this._refresh();
    });

    this.sideToggle = this._btn(colX(0), rowY(8), 'Вид: вправо', () => {
      this.sideFacing *= -1;
      this._refresh();
    });
    this._btn(colX(1), rowY(8), 'Зум −', () => this._zoom(-0.4));
    this._btn(colX(2), rowY(8), 'Зум +', () => this._zoom(0.4));
    this._btn(colX(3), rowY(8), 'Зум 1', () => {
      this._zoomTo(1);
    });
    this.rotBtn = this._btn(colX(4), rowY(8), 'Повор: 100%', () => {
      if (this.selected !== 'cap') return;
      const part = this.state.cap || (this.state.cap = {});
      const cur = part.rotF ?? RIG_DEFAULTS.cap.rotF ?? 1;
      part.rotF = cur === 1 ? 0.75 : cur === 0.75 ? 0.5 : 1;
      this._apply();
    });

    this._btn(colX(0), rowY(9), 'Сброс всего', () => {
      this.state = cloneRigConfig(RIG_DEFAULTS);
      resetRigConfig();
      try { setSizeLock(this.state, false); } catch (e) {}
      this._apply();
    });
    this._btn(colX(1), rowY(9), 'В меню', () => this.scene.start('MenuScene'));
    this.weaponToggle = this._btn(colX(2), rowY(9), 'Оружие: вкл', () => {
      this.showGun = !this.showGun;
      const p = this.preview;
      if (p) {
        p._gunAllowed = this.showGun;
        p._setGunVisible(true);
      }
      this._refresh();
    });
    this.bakedToggle = this._btn(colX(3), rowY(9), 'Обувь: слой', () => {
      const part = this.state.shoes || (this.state.shoes = {});
      part.baked = !part.baked;
      this._apply();
    });

    this.gaitToggle = this._btn(colX(0), rowY(16), 'Ноги: бег', () => {
      const part = this.state.legs || (this.state.legs = {});
      part.run = !(part.run !== false);
      this._apply();
    });

    this.animModeBtn = this._btn(colX(1), rowY(16), 'Аним: общая', () => {
      const modes = [null, 'walk', 'run', 'crouch'];
      const labels = ['Аним: общая', 'Аним: шаг', 'Аним: бег', 'Аним: присяд'];
      const idx = modes.indexOf(this.animMode);
      this.animMode = modes[(idx + 1) % modes.length];
      this.animModeBtn.setText(labels[(idx + 1) % labels.length]);
      this._forcePreviewMode(this.preview);
      this._refresh();
    });

    // Заголовок — в самом конце панели: все тексты после него уже созданы.
    const title = this.add.text(_cx, 24, 'РЕДАКТОР ПЕРСОНАЖА', {
      fontSize: '26px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0);
    this.ui.push(title);

    this.partThumbBg = this.add.rectangle(UX(this, 1240), 108, 108, 108, 0x111133, 1).setOrigin(0.5).setScrollFactor(0);
    this.partThumbLabel = this.add.text(UX(this, 1180), 46, 'Арт части', {
      fontSize: '13px',
      color: '#88bbff'
    }).setOrigin(0.5, 1).setScrollFactor(0);
    this.partThumb = this.add.image(UX(this, 1240), 108, 'chr_head').setOrigin(0.5).setScrollFactor(0).setVisible(false);
    this.ui.push(this.partThumbBg, this.partThumbLabel, this.partThumb);
  }

  _buildStamps() {
    this.frameStamp = this.add.text(UX(this, 16), 14, '', {
      fontSize: '12px',
      color: '#9ff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 }
    }).setScrollFactor(0).setVisible(false);
    this.walkStamp = this.add.text(UX(this, 16), 34, '', {
      fontSize: '12px',
      color: '#ffd27f',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 }
    }).setScrollFactor(0).setVisible(false);
    this.ui.push(this.frameStamp, this.walkStamp);
  }

  _applyThumb(key) {
    const thumb = this.partThumb;
    if (!thumb) return;
    const p = this.preview;
    let o = null;
    if (key === 'muzzle') o = null;
    else if (key === 'shoes') o = p && (p.shoeL || p._footL);
    else o = p && p.partObject(key);
    if (!o || !o.frame || !o.frame.texture) {
      thumb.setVisible(false);
      return;
    }
    const tKey = o.frame.texture.key;
    const fName = o.frame.name;
    if (fName && this.textures.exists(tKey) && this.textures.get(tKey).has(fName)) thumb.setTexture(tKey, fName);
    else thumb.setTexture(tKey);
    const sw = o.frame.width;
    const sh = o.frame.height;
    if (sw > 0 && sh > 0) thumb.setScale(90 / Math.max(sw, sh));
    thumb.setVisible(true);
  }

  _adjust(field, delta) {
    const key = this.selected;
    const part = this.state[key] || (this.state[key] = {});
    const def = RIG_DEFAULTS[key] || {};
    let animPart = part;
    if (key === 'legs' && this.animMode) {
      if (!part._animModes || typeof part._animModes !== 'object') part._animModes = {};
      if (!part._animModes[this.animMode] || typeof part._animModes[this.animMode] !== 'object') {
        part._animModes[this.animMode] = {};
      }
      animPart = part._animModes[this.animMode];
    }
    if (key === 'muzzle') {
      if (field === 's' || field === 'px' || field === 'py') return;
      const wName = this.editedWeapon || null;
      const cur = field === 'ox' ? (part.x ?? def.x ?? 0) : (part.y ?? def.y ?? 0);
      const nx = Math.max(-600, Math.min(600, cur + delta));
      if (wName) {
        const wh = (this.state.weaponHands = this.state.weaponHands || {});
        const cfg = (wh[wName] = wh[wName] || {});
        const mz = (cfg.muzzle = { ...(cfg.muzzle || part) });
        if (field === 'ox') mz.x = nx; else mz.y = nx;
      } else {
        part[field === 'ox' ? 'x' : 'y'] = nx;
      }
      this._apply();
      return;
    }
    if (this.mirrorMode && MIRROR_PARTS.includes(key) && (field === 'ox' || field === 'oy')) {
      field = field === 'ox' ? 'mx' : 'my';
    }
    if (field === 's') {
      // Замок: размер тела заморожен на стоке, руки свободны.
      if (isSizeLocked(key)) return;
      part.s = Math.max(4, Math.min(120, (part.s ?? def.s ?? 20) + delta));
    } else if (field === 'mx' || field === 'my') {
      const base = part[field]
        ?? (field === 'mx' ? (def.mx ?? part.ox ?? def.ox ?? 0) : (def.my ?? part.oy ?? def.oy ?? 0));
      part[field] = Math.max(-600, Math.min(600, base + delta));
    } else if (field === 'ox' || field === 'oy') {
      if (key === 'legs' && this.hipSide) {
        const hk = this.hipSide === 'left' ? 'R' : 'L';
        const hf = 'hip' + hk + (field === 'ox' ? 'x' : 'y');
        part[hf] = Math.max(-60, Math.min(60, (part[hf] ?? def[hf] ?? 0) + delta));
      } else if (key === 'shoes') {
        const sideKey = (this.shoeSide === 'R' ? 'r' : 'l') + (field === 'ox' ? 'x' : 'y');
        part[sideKey] = Math.max(-60, Math.min(60, (part[sideKey] ?? def[sideKey] ?? 0) + delta));
      } else {
        part[field] = Math.max(-600, Math.min(600, (part[field] ?? def[field] ?? 0) + delta));
      }
    } else if (field === 'px' || field === 'py') {
      if (key === 'legs') {
        // Пивот кости: пределов нет — шарнир можно увести куда угодно.
        const bK = this.boneKey === 'shin' ? 'shin' : 'thigh';
        const sideKey = bK + (field === 'px' ? 'Px' : 'Py');
        const img = this.preview && this.preview['_' + bK + 'L'];
        const cur = img ? img[field === 'px' ? 'originX' : 'originY'] : 0.5;
        part[sideKey] = +((cur + delta).toFixed(3));
      } else if (key === 'shoes') {
        const pKey = this.shoeSide === 'R' ? 'r' : 'l';
        const sideKey = pKey + (field === 'px' ? 'Px' : 'Py');
        part[sideKey] = (part[sideKey] ?? def[sideKey] ?? 0.5) + delta;
      } else {
        part[field] = (part[field] ?? def[field] ?? 0.5) + delta;
      }
    } else if (field === 'fps') {
      // Параметры анимации — без пределов (движок внизу сам зажимает
      // только то, что ломало бы физику: темп, размах, подъём, развал).
      if (key !== 'legs') return;
      animPart.fps = (animPart.fps ?? def.fps ?? 14) + delta;
    } else if (field === 'bobFreq') {
      if (key !== 'legs') return;
      animPart.bobFreq = (animPart.bobFreq ?? def.bobFreq ?? 1) + delta;
    } else if (field === 'bobX' || field === 'bobY') {
      if (key !== 'legs') return;
      animPart[field] = (animPart[field] ?? def[field] ?? 0) + delta;
    } else if (field === 'thigh' || field === 'shin') {
      if (key !== 'legs') return;
      if (isSizeLocked(key)) return;
      part[field] = Math.max(3, Math.min(60, (part[field] ?? def[field] ?? 13) + delta));
    } else if (field === 'swing') {
      if (key !== 'legs') return;
      animPart.swing = (animPart.swing ?? def.swing ?? 0.28) + delta;
    } else if (field === 'lift') {
      if (key !== 'legs') return;
      animPart.lift = (animPart.lift ?? def.lift ?? 0.4) + delta;
    } else if (field === 'knee') {
      if (key !== 'legs') return;
      animPart.knee = (animPart.knee ?? def.knee ?? 0.15) + delta;
    } else if (field === 'hip') {
      if (key !== 'legs') return;
      animPart.hip = (animPart.hip ?? def.hip ?? 0.5) + delta;
    } else if (field === 'upper' || field === 'fore') {
      if (key !== 'arms') return;
      const lim = field === 'upper' ? [6, 26] : [4, 22];
      part[field] = Math.max(lim[0], Math.min(lim[1], (part[field] ?? def[field] ?? 12) + delta));
    } else if (field === 'thighW' || field === 'shinW' || field === 'footW') {
      if (key !== 'legs') return;
      part[field] = Math.max(0.2, Math.min(1.6, (part[field] ?? def[field] ?? 0.45) + delta));
    } else if (field === 'upW' || field === 'foreW') {
      if (key !== 'arms') return;
      part[field] = Math.max(0.15, Math.min(1.5, (part[field] ?? def[field] ?? 0.22) + delta));
    } else if (field === 'elbowL' || field === 'elbowR') {
      if (key !== 'arms') return;
      part[field] = Math.max(0.05, Math.min(0.95, +((part[field] ?? def[field] ?? 0.36) + delta).toFixed(3)));
    } else if (field === 'elbowBendRear' || field === 'elbowBendFront') {
      // Угол сгиба локтя (рад, 0 = как считает IK). Задняя и передняя
      // руки — раздельно. Пределов нет, кисти остаются на оружии.
      if (key !== 'arms') return;
      part[field] = +(((part[field] ?? part.elbowBend ?? 0) + delta).toFixed(3));
    } else if (field === 'dist') {
      part.dist = Math.max(0, Math.min(120, (part.dist ?? def.dist ?? 0) + delta));
    } else if (field === 'rearFrac' || field === 'frontFrac') {
      if (key !== 'arms') return;
      const dW = (RIG_DEFAULTS.weaponHands && RIG_DEFAULTS.weaponHands.default) || {};
      const base = field === 'rearFrac' ? (dW.rearFrac ?? 0.86) : (dW.frontFrac ?? 0.92);
      const whName = this.editedWeapon || 'default';
      const wh = (this.state.weaponHands = this.state.weaponHands || {});
      const cfg = (wh[whName] = wh[whName] || {});
      cfg[field] = Math.max(0.2, Math.min(2.5, (cfg[field] ?? base) + delta));
    } else if (field === 'rearFX' || field === 'rearFY' || field === 'frontFX' || field === 'frontFY') {
      // Доводка кисти (px ВДОЛЬ/ПОПЕРЁК ствола, шаг задаёт кнопка).
      // Едет вместе с оружием при любом прицеле/развороте. Пределов нет.
      // Старые мировые значения (если крутил раньше) — стартовая точка.
      if (key !== 'arms') return;
      const legacy = { rearFX: 'rearPX', rearFY: 'rearPY', frontFX: 'frontPX', frontFY: 'frontPY' }[field];
      const whName5 = this.editedWeapon || 'default';
      const wh5 = (this.state.weaponHands = this.state.weaponHands || {});
      const cfg5 = (wh5[whName5] = wh5[whName5] || {});
      cfg5[field] = (cfg5[field] ?? cfg5[legacy] ?? 0) + delta;
      if (legacy && legacy in cfg5) delete cfg5[legacy];
    } else if (field === 'rearDrop' || field === 'frontDrop') {
      // Свес кистей — без пределов (можно и выше ствола, и далеко вниз).
      if (key !== 'arms') return;
      const dW2 = (RIG_DEFAULTS.weaponHands && RIG_DEFAULTS.weaponHands.default) || {};
      const base2 = field === 'rearDrop' ? (dW2.rearDrop ?? 3) : (dW2.frontDrop ?? 4);
      const whName2 = this.editedWeapon || 'default';
      const wh2 = (this.state.weaponHands = this.state.weaponHands || {});
      const cfg2 = (wh2[whName2] = wh2[whName2] || {});
      cfg2[field] = (cfg2[field] ?? base2) + delta;
    } else if (field === 'gunScale') {
      if (key !== 'arms') return;
      const whName3 = this.editedWeapon || 'default';
      const wh3 = (this.state.weaponHands = this.state.weaponHands || {});
      const cfg3 = (wh3[whName3] = wh3[whName3] || {});
      cfg3.gunScale = Math.max(0.5, Math.min(2.5, +((cfg3.gunScale ?? 1) + delta).toFixed(2)));
    } else if (field === 'gunOX' || field === 'gunOY') {
      if (key !== 'arms') return;
      const whName4 = this.editedWeapon || 'default';
      const wh4 = (this.state.weaponHands = this.state.weaponHands || {});
      const cfg4 = (wh4[whName4] = wh4[whName4] || {});
      cfg4[field] = Math.max(-60, Math.min(60, Math.round((cfg4[field] ?? 0) + delta)));
    }
    if (
      key === 'legs' &&
      (field === 'fps' || field === 'bobFreq' || field === 'bobX' || field === 'bobY' ||
        field === 'swing' || field === 'lift' || field === 'knee' || field === 'hip')
    ) {
      this.forceWalkToggle = true;
    }
    this._apply();
  }

  _grow(f) {
    // При замке Рост отключён целиком (он тянет и тело тоже).
    try {
      if (getSizeLock(this.state).locked) return;
    } catch (e) {}
    const jobs = [
      ['torso', ['s'], 14, 40],
      ['head', ['s'], 10, 30],
      ['cap', ['s'], 6, 18],
      ['legs', ['s'], 12, 50],
      ['legs', ['thigh', 'shin'], 6, 30],
      ['shoes', ['s'], 4, 20],
      ['arms', ['s'], 12, 50],
      ['arms', ['upper'], 6, 26],
      ['arms', ['fore'], 4, 22]
    ];
    jobs.forEach(([key, fields, lo, hi]) => {
      const part = this.state[key] || (this.state[key] = {});
      const def = RIG_DEFAULTS[key] || {};
      fields.forEach(fd => {
        const eff = part[fd] ?? def[fd] ?? ((fd === 'thigh' || fd === 'shin') ? 13 : lo);
        let next = Math.round(eff * f);
        if (next === eff) next = eff + (f >= 1 ? 1 : -1);
        part[fd] = Math.max(lo, Math.min(hi, next));
      });
    });
    this._apply();
  }

  _resetPart() {
    const key = this.selected;
    if (key === 'muzzle') {
      this.state.muzzle = { ...(RIG_DEFAULTS.muzzle || { x: 55, y: 0 }) };
    } else {
      this.state[key] = cloneRigConfig(RIG_DEFAULTS)[key];
    }
    // Любой сброс снимает замок (начинаем с чистого листа).
    try { setSizeLock(this.state, false); } catch (e) {}
    this._apply();
  }

  // Переключить оружие в руках превью (по списку всего оружия).
  // Хват, свес, размер, сдвиг и точка вылета настраиваются ОТДЕЛЬНО
  // под каждый ствол и сохраняются в weaponHands (живут в матчах).
  _cycleWeapon(dir) {
    const p = this.preview;
    if (!p || !Array.isArray(weaponsList) || !weaponsList.length) return;
    const list = weaponsList.map(w => w.name);
    const cur = p.weapon && p.weapon.name;
    let i = list.indexOf(cur);
    if (i < 0) i = dir > 0 ? -1 : 0;
    i = (i + dir + list.length) % list.length;
    const name = list[i];
    let idx = (p.inventory || []).findIndex(w => w && w.name === name);
    if (idx < 0) {
      p.addWeapon(name);
      idx = p.inventory.length - 1;
    }
    if (typeof p.selectWeapon === 'function') p.selectWeapon(idx);
    else p.activeWeaponIndex = idx;
    p._lastGunName = null;
    this._previewWeapon = name;
    this._refresh();
  }

  _autoFitLegs() {
    const D = RIG_DEFAULTS;
    const base = Math.max(14, Math.min(40,
      (this.state.torso && this.state.torso.s) ?? D.torso.s ?? 22));
    this.state.torso = { s: base, px: 0.5, py: 0.9, ox: 0, oy: 0 };
    this.state.head = {
      s: Math.max(10, Math.min(30, Math.round(base * 0.73))),
      px: 0.5, py: 0.93, paX: 0.5, paY: 0.08, ox: 0, oy: 0
    };
    this.state.cap = {
      s: Math.max(6, Math.min(18, Math.round(base * 0.35))),
      px: 0.5, py: 0.15, paX: 0.5, paY: 0.05, rotF: 1, ox: 0, oy: 0
    };
    const legH = Math.max(12, Math.min(50, Math.round(base * 1.18)));
    const half = Math.round(legH * 0.5);
    const hipHx = Math.max(3, Math.round(base * (158 / 290) * 0.22));
    this.state.legs = {
      s: legH, ox: 0, oy: 0, paX: 0.5, paY: 1,
      skeleton: true, run: true, legSet: 'auto',
      thigh: half, shin: legH - half,
      thighW: D.legs.thighW, shinW: D.legs.shinW, footW: D.legs.footW,
      swing: D.legs.swing, lift: D.legs.lift, knee: D.legs.knee, hip: D.legs.hip,
      fps: D.legs.fps, bobFreq: D.legs.bobFreq, bobX: D.legs.bobX, bobY: D.legs.bobY,
      hipLx: hipHx, hipRx: -hipHx, hipLy: 0, hipRy: 0,
      kneeL: 0.5, kneeR: 0.5
    };
    this.state.shoes = {
      s: Math.max(5, Math.min(14, Math.round(base * 0.28))),
      px: 0.5, py: 0.5, ox: 0, oy: 0,
      lx: 0, ly: 0, rx: 0, ry: 0,
 lPx: 0.38, lPy: 0.2, rPx: 0.38, rPy: 0.2,
      dist: 18, baked: false
    };
    const armS = Math.max(12, Math.min(50, Math.round(base * 1.18)));
    this.state.arms = {
      s: armS,
      upper: Math.round(armS * 0.62), fore: Math.round(armS * 0.46),
      px: 0.12, py: 0.45, paX: 0.5, paY: 0.14, ox: 0, oy: 0,
      upW: D.arms.upW, foreW: D.arms.foreW,
      elbowL: D.arms.elbowL, elbowR: D.arms.elbowR
    };
    try {
      this.state.weaponHands = {};
      this.state.muzzle = { ...(D.muzzle || { x: 60, y: -3 }) };
    } catch (e) { /* noop */ }
    this._apply();
    try {
      const p = this.preview;
      const duF = p && p._armUpFront && p._armUpFront._armDist;
      const dfF = p && p._armForeFront && p._armForeFront._armDist;
      const duR = p && p._armUpRear && p._armUpRear._armDist;
      const dfR = p && p._armForeRear && p._armForeRear._armDist;
      const du = (duF > 0 && duR > 0) ? (duF + duR) / 2 : (duF > 0 ? duF : duR);
      const df = (dfF > 0 && dfR > 0) ? (dfF + dfR) / 2 : (dfF > 0 ? dfF : dfR);
      const arms = this.state.arms;
      if (du > 0 && df > 0) {
        const T = Math.max(10, Math.min(48, arms.upper + arms.fore));
        arms.upper = Phaser.Math.Clamp(Math.round(T * du / (du + df)), 6, 26);
        arms.fore = Phaser.Math.Clamp(T - arms.upper, 4, 22);
        this._apply();
      }
    } catch (e) { /* оставили 0.62/0.46 */ }
    try {
      const arms = this.state.arms;
      const wName = this.editedWeapon || (this.preview && this.preview.weapon && this.preview.weapon.name) || 'AK-47';
      let fx = 0.6;
      try {
        const G = (window.__gunGrips || {})[weaponImage(wName)];
        if (G && G.fx != null) fx = G.fx;
        else if (G && G.rx != null) fx = G.rx;
      } catch (e) {}
      const L = Math.max(10, (arms.upper || 16) + (arms.fore || 12));
      const charK = Phaser.Math.Clamp(base / 22, 0.7, 2.2);
      if (fx - 0.15 >= 0.25) {
        const Wt = (0.85 * L - 4) / (fx - 0.15);
        const gs = Phaser.Math.Clamp(Wt / (44 * charK), 0.5, 2.5);
        const wh = (this.state.weaponHands = this.state.weaponHands || {});
        [wName, 'AK-47', 'bad_ak47'].forEach(k => {
          if (!k) return;
          const cfg = (wh[k] = wh[k] || {});
          cfg.gunScale = +gs.toFixed(2);
        });
        this._apply();
      }
    } catch (e) { /* noop */ }
    console.info('[RIG] авто-подбор: base=' + base);
  }

  _apply() {
    saveRigConfig(this.state);
    this._buildPreview();
    this._refresh();
  }

  _refresh() {
    for (const k in this.partButtons) {
      this.partButtons[k].setStyle(BTN);
    }
    if (this.partButtons[this.selected]) this.partButtons[this.selected].setStyle(BTN_ACTIVE);

    const vis = {
      muzzle: this.selected === 'muzzle',
      shoes: this.selected === 'shoes',
      legs: this.selected === 'legs',
      arms: this.selected === 'arms',
      cap: this.selected === 'cap',
      mirror: MIRROR_PARTS.includes(this.selected),
      hinge: HINGE_PARTS.includes(this.selected),
      attach: !!PARENT_OF[this.selected]
    };
    const pWeap = this.preview && this.preview.weapon && this.preview.weapon.name;
    if (pWeap) {
      this.editedWeapon = pWeap;
      this._previewWeapon = pWeap;
    }
    this._visToggle(this.muzzleToggle, vis.muzzle, () => { if (this.muzzleMode) this.muzzleMode = false; });
    if (this.muzzleToggle) {
      this.muzzleToggle.setText(this.muzzleMode ? 'Точка *' : 'Точка');
      this.muzzleToggle.setStyle(this.muzzleMode ? BTN_ACTIVE : BTN);
    }
    this._visToggle(this.hingeToggle, vis.hinge, () => { if (this.hingeMode) this.hingeMode = false; });
    if (this.hingeToggle) {
      this.hingeToggle.setText(this.hingeMode ? 'Шарнир *' : 'Шарнир');
      this.hingeToggle.setStyle(this.hingeMode ? BTN_ACTIVE : BTN);
    }
    this._visToggle(this.attachToggle, vis.attach, () => { if (this.attachMode) this.attachMode = false; });
    if (this.attachToggle) {
      this.attachToggle.setText(this.attachMode ? 'Крепление *' : 'Крепление');
      this.attachToggle.setStyle(this.attachMode ? BTN_ACTIVE : BTN);
    }
    if (this.mirrorToggle) {
      const on = this.mirrorMode && vis.mirror;
      this.mirrorToggle.setText(on ? 'Зеркало *' : 'Зеркало');
      this.mirrorToggle.setStyle(on ? BTN_ACTIVE : BTN);
      this._visToggle(this.mirrorToggle, vis.mirror, () => { if (this.mirrorMode) this.mirrorMode = false; });
    }
    if (this.mirrorToggle && this.mirrorMode && !MIRROR_PARTS.includes(this.selected)) {
      this.mirrorMode = false;
    }
    if (this.sideToggle) {
      this.sideToggle.setText(this.sideFacing > 0 ? 'Вид: вправо' : 'Вид: влево');
    }
    if (this.walkStamp) {
      this.walkStamp.setText(this.forceWalkToggle ? 'Ходьба: ВКЛ  (R — выкл)' : 'Ходьба: выкл  (R — вкл)');
    }
    if (this.rotBtn) {
      const capRot = (this.state.cap && this.state.cap.rotF) ?? RIG_DEFAULTS.cap.rotF ?? 1;
      this.rotBtn.setText('Повор: ' + Math.round(capRot * 100) + '%');
      this._visToggle(this.rotBtn, vis.cap);
    }
    if (this.bakedToggle) {
      const baked = !!(this.state.shoes && this.state.shoes.baked);
      this.bakedToggle.setText(baked ? 'Обувь: в арте' : 'Обувь: слой');
      this.bakedToggle.setStyle(baked ? BTN_ACTIVE : BTN);
      this._visToggle(this.bakedToggle, vis.shoes);
    }
    if (this.weaponToggle) {
      this.weaponToggle.setText(this.showGun ? 'Оружие: вкл' : 'Оружие: выкл');
      this.weaponToggle.setStyle(this.showGun ? BTN : BTN_ACTIVE);
      if (this.preview) {
        this.preview._gunAllowed = this.showGun;
        this.preview._setGunVisible(true);
      }
    }
    if (this.gaitToggle) {
      const run = !!(this.state.legs && this.state.legs.run !== false);
      this.gaitToggle.setText(run ? 'Ноги: бег' : 'Ноги: шаг');
      this.gaitToggle.setStyle(run ? BTN_ACTIVE : BTN);
      this._visToggle(this.gaitToggle, vis.legs);
    }
    if (this.animModeBtn) {
      // Кнопка режима анимации — только для ног (раньше висела поверх
      // кнопок рук в 16-м ряду).
      this._visToggle(this.animModeBtn, vis.legs);
    }
    if (this.shoeSideToggle) {
      this.shoeSideToggle.setText('Стопа: ' + (this.shoeSide === 'L' ? 'левая' : 'правая'));
      this._visToggle(this.shoeSideToggle, vis.shoes);
    }
    if (this.boneKeyBtns) {
      this.boneKeyBtns.forEach((b, i) => {
        const on = i === (this.boneKey === 'shin' ? 1 : 0);
        b.setStyle(on ? BTN_ACTIVE : BTN);
        this._visToggle(b, vis.legs);
      });
    }
    if (this.fitToggle) {
      this.fitToggle.setText(this.fitMode ? 'Натяг *' : 'Натяг');
      this.fitToggle.setStyle(this.fitMode ? BTN_ACTIVE : BTN);
      this._visToggle(this.fitToggle, vis.legs, () => { if (this.fitMode) this.fitMode = false; });
    }
    if (this.fitMode && this.selected === 'legs') {
      if (this.preview && this.preview._legsFull) {
        const pv = this.state.legs || {};
        const kL = typeof pv.kneeL === 'number' ? pv.kneeL.toFixed(2) : '0.50';
        const kR = typeof pv.kneeR === 'number' ? pv.kneeR.toFixed(2) : '0.50';
        this.info.setText(`СРЕЗ КОЛЕНА (одна PNG на ногу)\nклик по ноге — где у арта КОЛЕНО\n\nлевая: ${kL}   правая: ${kR}`);
        this._layTexts();
        return;
      }
      const kind = this.boneKey === 'shin' ? 'shin' : 'thigh';
      const lName = this.boneKey === 'shin' ? 'икра' : 'бедро';
      const pv = this.state.legs || {};
      const top = typeof pv[kind + 'Py'] === 'number' ? pv[kind + 'Py'].toFixed(2) : 'авто';
      const bot = typeof pv[kind + 'Bot'] === 'number' ? pv[kind + 'Bot'].toFixed(2) : '—';
      this.info.setText(`Натяжка арта на скелет (${lName})\n1-й клик — ВЕРХ арта (сустав)\n2-й клик — НИЗ арта\n\nверх: ${top}   низ: ${bot}`);
      this._layTexts();
      return;
    }
    if (this.preview) {
      this.preview.aimAt(this.sideFacing > 0 ? 860 : 520, this.preview.y - 5);
    }
    const key = this.selected;
    const partObj = this.state[key] || {};
    this._applyThumb(key);
    const def = RIG_DEFAULTS[key] || {};
    const label = (PARTS.find(p => p.key === key) || {}).label || key;
    const parentLabel = { torso: 'таз', head: 'голову', arms: 'торс' }[PARENT_OF[key]] || '—';

    if (this.muzzleMode) {
      const wName = this.editedWeapon || null;
      const wCfg = wName && this.state.weaponHands && this.state.weaponHands[wName];
      const m = (wCfg && wCfg.muzzle) || this.state.muzzle || RIG_DEFAULTS.muzzle;
      this.info.setText(`Точка вылета${wName ? ' · ' + wName : ''}\nX: ${m.x}   Y: ${m.y}\n\nкликни в превью туда, откуда должны\nвылетать пули, или двигай кнопками X/Y`);
      this._layTexts();
      return;
    }
    if (this.attachMode) {
      if (PARENT_OF[key]) {
        const pax = partObj.paX ?? def.paX ?? 0.5;
        const pay = partObj.paY ?? def.paY ?? 1;
        this.info.setText(`Крепление «${label}»\nPaX: ${pax.toFixed(2)}   PaY: ${pay.toFixed(2)}\n\nкликни по ${parentLabel} в превью,\nчтобы указать точку крепления`);
      } else {
        this.info.setText(`Крепление\n\nдля «${label}» крепление\nне используется`);
      }
      this._layTexts();
      return;
    }
    if (this.hingeMode) {
      if (HINGE_PARTS.includes(key)) {
        const px = partObj.px ?? def.px ?? 0.5;
        const py = partObj.py ?? def.py ?? 0.5;
        this.info.setText(`Шарнир (${label})\nPx: ${px.toFixed(2)}   Py: ${py.toFixed(2)}\n\nкликни по части в превью туда,\nгде у неё ось вращения`);
      } else {
        this.info.setText(`Шарнир\n\nдля «${label}» шарнир\nне используется`);
      }
      this._layTexts();
      return;
    }
    if (key === 'muzzle') {
      const wName2 = this.editedWeapon || null;
      const wCfg2 = wName2 && this.state.weaponHands && this.state.weaponHands[wName2];
      const m = (wCfg2 && wCfg2.muzzle) || this.state.muzzle || RIG_DEFAULTS.muzzle;
      this.info.setText(`Точка вылета${wName2 ? ' · ' + wName2 : ''}\nX: ${m.x}   Y: ${m.y}\n\nдвигается кнопками X −/+ и Y −/+, или кликом в режиме «Точка»`);
      this._layTexts();
      return;
    }

    const s = partObj.s ?? def.s ?? '?';
    const ox = partObj.ox ?? def.ox ?? 0;
    const oy = partObj.oy ?? def.oy ?? 0;
    const px = partObj.px ?? def.px ?? 0.5;
    const py = partObj.py ?? def.py ?? 0.5;
    const pax = partObj.paX ?? def.paX;
    const pay = partObj.paY ?? def.paY;
    let extra = `\nPivot: ${px.toFixed(2)}  ${py.toFixed(2)}`;
    if (PARENT_OF[key]) {
      extra += `\nКрепление: ${(pax ?? 0.5).toFixed(2)} ${(pay ?? 1).toFixed(2)}`;
    }
    if (MIRROR_PARTS.includes(key)) {
      const mx = partObj.mx ?? def.mx ?? ox;
      const my = partObj.my ?? def.my ?? oy;
      extra += `\nВлево X: ${Math.round(mx)}   Y: ${Math.round(my)}`;
    }
    if (key === 'cap') {
      const rf = partObj.rotF ?? def.rotF ?? 1;
      extra += `\nПоворот: ${Math.round(rf * 100)}%`;
    }
    if (key === 'legs') {
      const am = this.animMode && partObj._animModes && partObj._animModes[this.animMode];
      const vp = (base, override) => override != null ? override : base;
      const fps = vp(partObj.fps ?? def.fps ?? 14, am?.fps);
      const bf = vp(partObj.bobFreq ?? def.bobFreq ?? 1, am?.bobFreq);
      const bx = vp(partObj.bobX ?? def.bobX ?? 0, am?.bobX);
      const by = vp(partObj.bobY ?? def.bobY ?? 0, am?.bobY);
      const th = partObj.thigh ?? def.thigh ?? 13;
      const sh = partObj.shin ?? def.shin ?? 13;
      const sw = vp(partObj.swing ?? def.swing ?? 0.28, am?.swing);
      const lf = vp(partObj.lift ?? def.lift ?? 0.4, am?.lift);
      const kn = vp(partObj.knee ?? def.knee ?? 0.15, am?.knee);
      const hp = vp(partObj.hip ?? def.hip ?? 0.5, am?.hip);
      const thW = partObj.thighW ?? def.thighW ?? 1;
      const shW = partObj.shinW ?? def.shinW ?? 0.65;
      const ftW = partObj.footW ?? def.footW ?? 1;
      const rn = partObj.run !== false;
      extra += `\nПоходка: ${rn ? 'БЕГ' : 'шаг'} (K)`;
      extra += `\nБедро: ${th}   Икра: ${sh}\nШаг: ${Math.round(sw * 100)}%  Подъём: ${Math.round(lf * 100)}%  Сгиб: ${kn.toFixed(2)}`;
      extra += `\nАним: ${fps} fps  Част: ${bf}  Бок: ${bx}  Верт: ${by}`;
      extra += `\nТолщина: ${thW.toFixed(2)} / ${shW.toFixed(2)} / ${ftW.toFixed(2)}`;
      extra += `\nРазмах бедра: ×${hp.toFixed(2)}`;
    }
    if (key === 'arms') {
      const up = (partObj.upper ?? def.upper ?? 16);
      const fo = (partObj.fore ?? def.fore ?? 12);
      const upW = partObj.upW ?? def.upW ?? 0.28;
      const foW = partObj.foreW ?? def.foreW ?? 0.22;
      const eBR = partObj.elbowBendRear ?? partObj.elbowBend ?? 0;
      const eBF = partObj.elbowBendFront ?? partObj.elbowBend ?? 0;
      extra += `\nПлечо: ${up}   Предплечье: ${fo}`;
      extra += `\nТолщина: ${upW.toFixed(2)} / ${foW.toFixed(2)}`;
      extra += `\nСгиб локтя: зад ${(+eBR).toFixed(2)} / пер ${(+eBF).toFixed(2)}`;
      const eL = typeof partObj.elbowL === 'number' ? partObj.elbowL.toFixed(2) : '0.36';
      const eR = typeof partObj.elbowR === 'number' ? partObj.elbowR.toFixed(2) : '0.36';
      extra += `\nСрез локтя: зад ${eR}  пер ${eL}`;
      const wName = this.editedWeapon || 'default';
      const wCfg = (this.state.weaponHands && this.state.weaponHands[wName]) || {};
      // Живые цели кистей (px от плеча) — уже с привязкой к стволу.
      let rDpx = null, fDpx = null, rD = null, fD = null, gripSrc = null;
      try {
        if (this.preview && typeof this.preview._weaponHands === 'function') {
          const resolved = this.preview._weaponHands(this.preview._partCfg('arms'));
          rDpx = resolved.rearD; fDpx = resolved.frontD;
          rD = resolved.rearDrop; fD = resolved.frontDrop;
          gripSrc = resolved.src;
        }
      } catch (e) { /* noop */ }
      extra += `\nОружие: ${wName}`;
      if (rDpx != null) {
        extra += `\nРукоятка: ${rDpx.toFixed(0)}px  Цевьё: ${fDpx.toFixed(0)}px`;
        extra += `\nСвес кистей: зад ${(+rD).toFixed(1)}  пер ${(+fD).toFixed(1)}`;
      }
      let gripNote = 'таблица (точек нет)';
      if (gripSrc === 'dots') {
        gripNote = 'по КРАСНЫМ ТОЧКАМ';
      } else {
        try {
          const wkey = (this.preview && this.preview._lastGripKey) || '';
          const dbg = (window.__gunDotDbg || {})[wkey];
          if (dbg) gripNote = `таблица (${wkey}: красных px ${dbg.reds}, принято ${dbg.kept})`;
        } catch (e) { /* noop */ }
      }
      extra += `\nХват: ${gripNote}`;
      const gox = wCfg.gunOX ?? 0;
      const goy = wCfg.gunOY ?? 0;
      const gsc = wCfg.gunScale ?? 1;
      extra += `\nСтвол: ×${(+gsc).toFixed(2)}  сдвиг X:${gox} Y:${goy}`;
      const nR = [wCfg.rearFX ?? wCfg.rearPX ?? 0, wCfg.rearFY ?? wCfg.rearPY ?? 0];
      const nF = [wCfg.frontFX ?? wCfg.frontPX ?? 0, wCfg.frontFY ?? wCfg.frontPY ?? 0];
      extra += `\nДоводка: зад (${nR[0]},${nR[1]}) пер (${nF[0]},${nF[1]})`;
    }
    if (this.xyBtns) {
      const prefix = (key === 'legs')
        ? (this.hipSide === 'left' ? 'Лев ' : (this.hipSide === 'right' ? 'Прав ' : ''))
        : '';
      const xyLabels = ['X −', 'X +', 'Y −', 'Y +'];
      this.xyBtns.forEach((b, i) => {
        b.setText(prefix + xyLabels[i]);
        b.setAlpha(1).setInteractive({ useHandCursor: true });
      });
    }
    if (this.bobBtns) {
      this.bobBtns.forEach(b => { this._visToggle(b, key === 'legs' && this.tanko); });
    }
    if (this.nudgeBtns) {
      this.nudgeBtns.forEach(b => { this._visToggle(b, key === 'arms'); });
    }
    if (this.hipBtns) {
      this.hipBtns.forEach(b => { this._visToggle(b, key === 'legs'); });
    }
    if (this.tankoToggle) {
      this.tankoToggle.setText(this.tanko ? 'Тонко: вкл' : 'Тонко: выкл');
      this.tankoToggle.setStyle(this.tanko ? BTN_ACTIVE : BTN);
      this._visToggle(this.tankoToggle, key === 'legs' || key === 'arms');
    }
    // Замок: Размер виден только свободным частям (руки — всегда),
    // Рост — только без замка.
    try {
      const lockedAll = getSizeLock(this.state).locked;
      const locked = isSizeLocked(key);
      if (this.lockToggle) {
        this.lockToggle.setText(lockedAll ? 'Замок: вкл' : 'Замок: выкл');
        this.lockToggle.setStyle(lockedAll ? BTN_ACTIVE : BTN);
      }
      this._visToggle(this.sizeDownBtn, !locked);
      this._visToggle(this.sizeUpBtn, !locked);
      this._visToggle(this.growDownBtn, !lockedAll);
      this._visToggle(this.growUpBtn, !lockedAll);
    } catch (e) {}
    if (this.gunXBtns) {
      this.gunXBtns.forEach(b => { this._visToggle(b, key === 'arms'); });
    }
    if (this.gunYBtns) {
      this.gunYBtns.forEach(b => { this._visToggle(b, key === 'arms'); });
    }
    if (this.hipSideToggle) {
      this.hipSideToggle.setText(
        this.hipSide === 'right' ? 'Креп: прав.' : (this.hipSide === 'left' ? 'Креп: лев.' : 'Креп: —')
      );
      this.hipSideToggle.setStyle(this.hipSide ? BTN_ACTIVE : BTN);
      this._visToggle(this.hipSideToggle, key === 'legs', () => { if (this.hipSide) this.hipSide = null; });
    }
    if (this.autoFitBtn) {
      this._visToggle(this.autoFitBtn, key === 'legs' || key === 'torso' || key === 'arms');
    }
    if (this.boneBtns) {
      this.boneBtns.forEach((b, i) => {
        const legsBone = i < 16;
        let on = legsBone ? (key === 'legs') : (key === 'arms');
        if (on && !this.tanko && (legsBone ? i >= 10 : (i >= 20 && i <= 27))) on = false;
        this._visToggle(b, on);
      });
    }
    const xy = (key === 'arms' || key === 'shoes') ? '' : `X: ${Math.round(ox)}   Y: ${Math.round(oy)}`;
    let gap = '';
    if (key === 'shoes') {
      gap = `\nЛевая: X ${Math.round(partObj.lx ?? 0)}   Y ${Math.round(partObj.ly ?? 0)}` +
        `\nПравая: X ${Math.round(partObj.rx ?? 0)}   Y ${Math.round(partObj.ry ?? 0)}`;
    }
    this.info.setText(`${label}\nРазмер: ${s}px\n${xy}${gap}${extra}`);
    this._layTexts();
  }

  _layTexts() {
    if (!this.info) return;
    this.info.setPosition(880, 58);
  }

  _forcePreviewMode(p) {
    if (!p) return;
    const m = this.animMode;
    p._animOverride = m;
    p._runOverride = m ? (m === 'run') : null;
    if (m) {
      p.forceWalk = true;
      if (typeof p.setCrouch === 'function') p.setCrouch(m === 'crouch');
    } else {
      p.forceWalk = this.forceWalkToggle;
      if (typeof p.setCrouch === 'function') p.setCrouch(false);
    }
  }

  _buildPreview() {
    if (this.preview) {
      try { this.preview.destroy(true); } catch (e) {}
      this.preview = null;
    }
    if (this.tag) { try { this.tag.destroy(); } catch (e) {} this.tag = null; }

    let p = null;
    try {
      p = new Player(this, 700, 520, { name: '   ', isAI: false });
    } catch (err) {
      console.error('[RIG] preview build failed:', err);
      this.tag = this.add.text(UX(this, 700), 400, 'Не вышло собрать превью:\n' + String((err && err.message) || err), {
        fontSize: '16px',
        color: '#ff8888',
        align: 'center',
        wordWrap: { width: 500 }
      }).setOrigin(0.5).setScrollFactor(0);
      this.ui.push(this.tag);
      return;
    }
    p._editorGrounded = true;
    if (p.body) {
      p.body.setAllowGravity(false);
      p.setVelocity(0, 0);
    }
    this.physics.add.collider(p, this.floor);
    p.healthBar.setVisible(false);
    p.armorBar.setVisible(false);
    p.nameText.setVisible(false);
    p.aimAt(860, 470);
    this.preview = p;
    p.forceWalk = false;
    if (typeof p.setCrouch === 'function') p.setCrouch(false);
    p.updateBars();
    let soleBot = -Infinity;
    [p._footL, p._footR].forEach(f => {
      if (!f) return;
      soleBot = Math.max(soleBot, p.legsRun.y + f.y + (1 - f.originY) * f.displayHeight);
    });
    if (isFinite(soleBot)) {
      p.y += 590 - soleBot;
      if (p.body) p.body.reset(700, p.y);
      p.updateBars();
    }
    this._forcePreviewMode(p);
    if (this.textures.exists('ak47')) {
      p.addWeapon('AK-47');
      p.activeWeaponIndex = p.inventory.length - 1;
      p._lastGunName = null;
    }
    // Не сбрасывать выбранный ствол при перестройке превью: иначе после
    // каждого клика редактор прыгал на АК-47. Держим то, что выбрано.
    const keepW = this._previewWeapon || this.editedWeapon;
    if (keepW) {
      let idx = (p.inventory || []).findIndex(w => w && w.name === keepW);
      if (idx < 0) {
        p.addWeapon(keepW);
        idx = p.inventory.length - 1;
      }
      if (idx >= 0) {
        if (typeof p.selectWeapon === 'function') p.selectWeapon(idx);
        else p.activeWeaponIndex = idx;
        p._lastGunName = null;
      }
    }
    this.cameras.main.centerOn(p.x, (p.torso ? p.torso.y : p.y) - 6);
  }

  _drawMarkers() {
    const g = this.markers;
    if (!g) return;
    g.clear();
    const p = this.preview;
    if (!p) return;

    if (p.legsRun) {
      const L = p.legsRun;
      g.lineStyle(2, 0x00ffff, 1);
      g.strokeRect(
        L.x - L.displayOriginX,
        L.y - L.displayOriginY,
        L.displayWidth,
        L.displayHeight
      );
      g.fillStyle(0x00ffff, 1);
      g.fillRect(L.x - 2, L.y - 2, 4, 4);
    }

    if (p.torso) {
      const T = p.torso;
      g.lineStyle(2, 0x44ff88, 1);
      g.strokeRect(T.x - T.displayOriginX, T.y - T.displayOriginY, T.displayWidth, T.displayHeight);
    }
    if (p.legsRun && (this.selected === 'legs' || this.attachMode || this.hingeMode)) {
      const hip = p._anchorFor('legs');
      g.lineStyle(2, 0xffdd00, 1);
      g.lineBetween(hip.x - 6, hip.y, hip.x + 6, hip.y);
      g.lineBetween(hip.x, hip.y - 6, hip.x, hip.y + 6);
    }

    if (!p.armGun) return;
    const a = p.aimAngle();
    const m = p.muzzleWorld(a);
    g.fillStyle(0x00ff66, 1);
    g.fillCircle(p.armGun.x, p.armGun.y, 3);
    if (m) {
      g.lineStyle(2, 0x00ff66, 1);
      g.strokeCircle(m.x, m.y, 7);
      g.fillStyle(0x00ff66, 1);
      g.fillCircle(m.x, m.y, 2.5);
      g.lineStyle(1, 0x00ff66, 0.45);
      g.beginPath();
      g.moveTo(p.armGun.x, p.armGun.y);
      g.lineTo(m.x, m.y);
      g.strokePath();
    }
    if (this.muzzleMode && this._ghost) {
      g.lineStyle(2, 0xffdd00, 1);
      g.strokeCircle(this._ghost.x, this._ghost.y, 7);
    }
    if (this.attachMode) {
      if (PARENT_OF[this.selected]) {
        const aw = this.attachTarget();
        if (aw) {
          g.lineStyle(2, 0x00ff66, 1);
          g.fillStyle(0x00ff66, 1);
          g.lineBetween(aw.x - 5, aw.y, aw.x + 5, aw.y);
          g.lineBetween(aw.x, aw.y - 5, aw.x, aw.y + 5);
        }
      }
      if (this._ghost) {
        g.lineStyle(2, 0xffdd00, 0.9);
        g.strokeCircle(this._ghost.x, this._ghost.y, 7);
      }
    }
    if (this.hingeMode) {
      const pos = this._hingePart();
      if (pos) {
        g.lineStyle(2, 0x00ff66, 1);
        g.fillStyle(0x00ff66, 1);
        g.lineBetween(pos.x - 5, pos.y, pos.x + 5, pos.y);
        g.lineBetween(pos.x, pos.y - 5, pos.x, pos.y + 5);
      }
      if (this._ghost) {
        g.lineStyle(2, 0xffdd00, 0.9);
        g.strokeCircle(this._ghost.x, this._ghost.y, 7);
      }
    }
    if (this.fitMode && this._ghost) {
      g.lineStyle(2, 0xffdd00, 0.9);
      g.strokeCircle(this._ghost.x, this._ghost.y, 7);
    }
  }

  attachTarget() {
    if (!this.preview || !PARENT_OF[this.selected]) return null;
    return this.preview.attachWorld(this.selected);
  }

  _hingePart() {
    const key = this.selected;
    if (!this.preview) return null;
    if (key === 'torso' && this.preview.torso) return this.preview.torso;
    if (key === 'head' && this.preview.headImg) return this.preview.headImg;
    if (key === 'cap' && this.preview.capImg) return this.preview.capImg;
    if (key === 'arms' && this.preview.armGun) return this.preview.armGun;
    if (key === 'legs' && this.preview.legsRun) return this.preview.legsRun;
    return null;
  }

  _onMove(pointer, over) {
    if (!this.preview) return;
    if (over && over.length) {
      this._ghost = null;
      return;
    }
    // Камера одна — pointer.worldX/worldY уже мировые координаты.
    const wx = pointer.worldX;
    const wy = pointer.worldY;
    if (this.muzzleMode || this.attachMode || this.hingeMode || this.fitMode) {
      this.input.setDefaultCursor('crosshair');
      this._ghost = { x: wx, y: wy };
    } else {
      this.input.setDefaultCursor('default');
      const ax = this.sideFacing < 0 ? 2 * this.preview.x - wx : wx;
      this.preview.aimAt(ax, wy);
      this._ghost = null;
    }
  }

  _onClick(pointer) {
    if (this._suppressClick) return;
    if (!this.preview) return;
    const wx = pointer.worldX;
    const wy = pointer.worldY;
    if (this.attachMode) {
      const key = this.selected;
      if (!PARENT_OF[key]) {
        this._ghost = null;
        return;
      }
      const loc = this.preview.partLocalOn(key, wx, wy);
      const part = this.state[key] || (this.state[key] = {});
      part.paX = Phaser.Math.Clamp(+loc.u.toFixed(2), 0, 1);
      part.paY = Phaser.Math.Clamp(+loc.v.toFixed(2), 0, 1);
      this._apply();
      return;
    }
    if (this.hingeMode) {
      const key = this.selected;
      if (!HINGE_PARTS.includes(key)) {
        this._ghost = null;
        return;
      }
      const pos = this._hingePart();
      if (!pos) {
        this._ghost = null;
        return;
      }
      const texKey = key === 'legs' ? 'chr_legs_run' : 'chr_' + key;
      if (!this.textures.exists(texKey)) {
        this._ghost = null;
        return;
      }
      const dims = this.preview._renderDims(texKey, key);
      const part = this.state[key] || (this.state[key] = {});
      const def = RIG_DEFAULTS[key] || {};
      const c = Math.cos(pos.rotation);
      const s = Math.sin(pos.rotation);
      const dx = (wx - pos.x) * c + (wy - pos.y) * s;
      const dy = -(wx - pos.x) * s + (wy - pos.y) * c;
      const curPx = part.px ?? def.px ?? 0.5;
      const curPy = part.py ?? def.py ?? 0.5;
      const nx = curPx + (pos.scaleX < 0 ? -dx : dx) / (dims.w || 1);
      const ny = curPy + dy / (dims.h || 1);
      part.px = Phaser.Math.Clamp(+nx.toFixed(2), 0, 1);
      part.py = Phaser.Math.Clamp(+ny.toFixed(2), 0, 1);
      this._apply();
      return;
    }
    if (this.fitMode && this.selected === 'legs') {
      if (this.preview._legsFull) {
        const p = this.preview;
        const pics = [p._thighL, p._thighR].filter(Boolean);
        if (!pics.length) { this._ghost = null; return; }
        let img = pics[0];
        if (pics.length > 1) {
          let bd = Infinity;
          for (const im of pics) {
            const dd = Phaser.Math.Distance.Between(wx, wy, im.x, im.y);
            if (dd < bd) { bd = dd; img = im; }
          }
        }
        const sideKey = img === p._thighR ? 'R' : 'L';
        const part = this.state.legs || (this.state.legs = {});
        const kneeField = 'knee' + sideKey;
        const cur = typeof part[kneeField] === 'number'
          ? part[kneeField]
          : ((RIG_DEFAULTS.legs && RIG_DEFAULTS.legs[kneeField]) || 0.5);
        const H = img.displayHeight || 1;
        const iy = (wy - img.y);
        const vThigh = img.originY + iy / H;
        let next;
        if (vThigh >= -0.25 && vThigh <= 1.25) {
          next = Math.max(0.2, Math.min(0.8, cur * Math.max(0, vThigh)));
        } else {
          const shin = p['_shin' + sideKey];
          if (!shin) { this._ghost = null; return; }
          const H2 = shin.displayHeight || 1;
          const iy2 = (wy - shin.y);
          const vShin = shin.originY + iy2 / H2;
          if (vShin < -0.25 || vShin > 1.25) { this._ghost = null; return; }
          next = Math.max(0.2, Math.min(0.8, cur + (1 - cur) * Math.max(0, vShin)));
        }
        part[kneeField] = +next.toFixed(3);
        this._ghost = null;
        this._apply();
        return;
      }
      const kind = this.boneKey === 'shin' ? 'shin' : 'thigh';
      const imgs = [
        this.preview['_' + kind + 'L'],
        this.preview['_' + kind + 'R']
      ].filter(Boolean);
      if (!imgs.length) { this._ghost = null; return; }
      let img = imgs[0];
      if (imgs.length > 1) {
        let bd = Infinity;
        for (const im of imgs) {
          const dd = Phaser.Math.Distance.Between(wx, wy, im.x, im.y);
          if (dd < bd) { bd = dd; img = im; }
        }
      }
      const c = Math.cos(img.rotation);
      const s = Math.sin(img.rotation);
      const dx = wx - img.x;
      const dy = wy - img.y;
      const ix = dx * c + dy * s;
      const iy = -dx * s + dy * c;
      const W = img.displayWidth || 1;
      const H = img.displayHeight || 1;
      const u = img.originX + (img.scaleX < 0 ? -ix : ix) / W;
      const v = img.originY + iy / H;
      if (u < -0.25 || u > 1.25 || v < -0.25 || v > 1.25) { this._ghost = null; return; }
      const vc = Phaser.Math.Clamp(v, 0.03, 0.97);
      const part = this.state.legs || (this.state.legs = {});
      const besKey = kind + 'Bot';
      if (this.fitHandle === 'top') {
        part[kind + 'Py'] = +vc.toFixed(3);
        part[besKey] = Math.min(0.99, +(vc + 0.12).toFixed(3));
        this.fitHandle = 'bot';
      } else {
        part[kind + 'Py'] = Math.min(+vc.toFixed(3), part[kind + 'Py'] ?? 0.4);
        part[besKey] = Math.max(+vc.toFixed(3), (part[kind + 'Py'] ?? 0.4) + 0.03);
        this.fitHandle = 'top';
      }
      this._ghost = null;
      this._apply();
      return;
    }
    if (!this.muzzleMode || !this.preview.armGun) return;
    const p = this.preview;
    const a = p.aimAngle();
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const dx = wx - p.armGun.x;
    const dy = wy - p.armGun.y;
    const lx = Math.max(-300, Math.min(300, Math.round(dx * cs + dy * sn)));
    let ly = Math.max(-300, Math.min(300, Math.round(-dx * sn + dy * cs)));
    if (p.armGun.scaleX < 0) ly = -ly;
    if (this.editedWeapon) {
      const whs = (this.state.weaponHands = this.state.weaponHands || {});
      const cfg = (whs[this.editedWeapon] = whs[this.editedWeapon] || {});
      cfg.muzzle = { x: lx, y: ly };
    } else {
      this.state.muzzle = { x: lx, y: ly };
    }
    this._ghost = null;
    this._apply();
  }

  update() {
    if (!this.preview) return;
    try {
      this.preview.updateBars();
      if (this.preview.updateGun) this.preview.updateGun();
      this._drawMarkers();
    } catch (e) { /* превью не должно ронять сцену */ }
    if (this.frameStamp && this.preview.legsRun) {
      let txt = null;
      if (this.preview._legsSkeleton) {
        const p = this.preview;
        const phi = p._walkPhase ?? 0;
        txt = 'скелет ног | фаза: ' + (Number.isFinite(phi) ? phi.toFixed(2) : '?') +
          ' | thigh/shin: ' + (p._legThigh ?? 0) + '/' + (p._legShin ?? 0) +
          (p.forceWalk ? ' | ХОДИТ НА МЕСТЕ' : '') + ' | R — шаг на месте';
      }
      if (txt != null && txt !== this._frameStampLast) {
        this._frameStampLast = txt;
        this.frameStamp.setText(txt);
      }
    }
  }
}
