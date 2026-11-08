import { gameW, UX } from '../ui/layout.js';
import { resetProgress, resetCampaign, addCoins, addExperience, saveGameState, syncGameState, gameState, renamePlayer, unlockHead, unlockShoes, unlockTorso, unlockPants } from '../data/gameState.js';
import { campaignLevels } from '../data/levels.js';
import { GEAR_ITEMS } from '../data/wardrobe.js';
import { musicVol, sfxVol, volLabel, refreshLiveVolumes } from '../data/audio.js';
import {
  getCrosshair, setCrosshair, crossLabel, crossDotLabel, crossArmsLabel,
  CROSS_COLORS, CROSS_SHAPES, crossDefaults,
  nextCrossColor, nextCrossShape, nextCrossSize, nextCrossThick,
  nextCrossArms, nextCrossDot,
  drawCrosshairFigure
} from '../data/crosshair.js';
import {
  getSettings, getKeyCode, keyName, keyCodeName, KEY_ACTIONS, QUALITY_OPTIONS,
  CONTROL_SCHEMES, getControlScheme, setControlScheme,
  getVibration, setVibration, getCamShake, setCamShake,
  getQuality, setQuality, resetKeys, saveSettings
} from '../data/gameSettings.js';

// Короткие звуки для превью громкости (кнопки +/−): берём случайный,
// чтобы было понятно, насколько громко/тихо.
const SFX_PREVIEW_KEYS = [
  'sfx_buy', 'sfx_hover', 'sfx_boom', 'sfx_boom_smoke', 'sfx_boom_rpg',
  'sfx_throw', 'sfx_swing_katana', 'sfx_swing_machete',
  'sfx_flagours', 'sfx_flagfoe', 'sfx_flag_ally', 'sfx_flag_foe', 'sfx_step'
];

const RES_OPTIONS = [
  { id: '1280', label: '1280×720', w: 1280, h: 720 },
  { id: '1600', label: '1600×900', w: 1600, h: 900 },
  { id: '1920', label: '1920×1080', w: 1920, h: 1080 },
  { id: 'fit', label: 'Заполнить экран' }
];

const RES_KEY = 'screenRes';

const FPS_OPTIONS = [
  { id: '30', label: '30 FPS' },
  { id: '60', label: '60 FPS' },
  { id: '0', label: 'Без ограничения' }
];

const FPS_KEY = 'fpsCap';

const SHOWFPS_KEY = 'showFps';

export function getShowFps() {
  try {
    // Дефолт автора: FPS виден. Пустой ключ (первый запуск/сброс) = вкл.
    const v = localStorage.getItem(SHOWFPS_KEY);
    return v == null ? true : v === '1';
  } catch (e) {
    return true;
  }
}

function saveShowFps(on) {
  try {
    localStorage.setItem(SHOWFPS_KEY, on ? '1' : '0');
  } catch (e) { /* noop */ }
}

export function getScreenRes() {
  try {
    return localStorage.getItem(RES_KEY) || '1920';
  } catch (e) {
    return '1920';
  }
}

function saveScreenRes(id) {
  try {
    localStorage.setItem(RES_KEY, id);
  } catch (e) { /* noop */ }
}

export function getFpsCap() {
  try {
    return localStorage.getItem(FPS_KEY) || '0';
  } catch (e) {
    return '0';
  }
}

function saveFpsCap(id) {
  try {
    localStorage.setItem(FPS_KEY, id);
  } catch (e) { /* noop */ }
}

const VSYNC_KEY = 'vsync';

export function getVsync() {
  try {
    // По умолчанию включена: ровные 60 без разрывов кадра.
    const v = localStorage.getItem(VSYNC_KEY);
    return v == null ? true : v === '1';
  } catch (e) {
    return true;
  }
}

function saveVsync(on) {
  try {
    localStorage.setItem(VSYNC_KEY, on ? '1' : '0');
  } catch (e) { /* noop */ }
}

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    syncGameState();
    const _cx = gameW(this) / 2;
    this.resetPending = false;
    this.campResetPending = false;
    // Хранилище разовых слушателей для снятия в shutdown.
    this._dropOutsideHandlers = [];
    this._keyModal = null;
    this._selectModal = null;
    this._ratesModal = null;
    this._actionButtons = [];

    this._initBackground();
    this._initHeader(_cx);

    // Сетка панелей: 4 сверху + 2 снизу. Координаты внутри 1280-блока,
    // на широком экране — через UX. Панели рисуем первыми, контролы — поверх.
    const PANEL_TOP = 98;
    const PANEL_BOT = 458;
    const PANEL_H = PANEL_BOT - PANEL_TOP;
    const CX1 = 170, CX2 = 510, CX3 = 840, CX4 = 1115;

    this._panel(UX(this, 40), PANEL_TOP, 260, PANEL_H, 'ЭКРАН', 0x2a5aaa);
    this._panel(UX(this, 330), PANEL_TOP, 360, PANEL_H, 'ЗВУК И ИГРОК', 0x1f6a3d);
    this._panel(UX(this, 720), PANEL_TOP, 240, PANEL_H, 'ПРИЦЕЛ', 0x7a3a8a);
    this._panel(UX(this, 990), PANEL_TOP, 250, PANEL_H, 'ЭФФЕКТЫ', 0xa07a1a);
    this._panel(UX(this, 40), 486, 440, 218, 'ИГРА', 0x8a3a3a);
    this._panel(UX(this, 500), 486, 740, 218, 'УПРАВЛЕНИЕ', 0x2a6a6a);

    // Маленькая иконка i: шансы выпадения в кейсах.
    this._infoIcon = this.add.container(UX(this, 820), 66).setDepth(5);
    const _ig = this.add.graphics();
    _ig.fillStyle(0x101526, 0.95);
    _ig.fillCircle(0, 0, 14);
    _ig.lineStyle(1.5, 0x8fb8ff, 1);
    _ig.strokeCircle(0, 0, 14);
    this._infoIcon.add(_ig);
    this._infoIcon.add(this.add.text(0, 0, 'i', {
      fontSize: '17px', color: '#8fb8ff', fontStyle: 'italic bold'
    }).setOrigin(0.5));
    this._infoIcon.setSize(34, 34);
    this._infoIcon.setInteractive({ useHandCursor: true });
    this._infoIcon.on('pointerover', () => _ig.setAlpha(0.85));
    this._infoIcon.on('pointerout', () => _ig.setAlpha(1));
    this._infoIcon.on('pointerdown', () => this._openRatesInfo());

    // --- Панель ЭКРАН: разрешение, кадры, синхронизация, FPS. ---
    const active = getScreenRes();
    this._selectButton(UX(this, CX1), 188, 'Разрешение экрана', RES_OPTIONS, active, (id) => {
      if (id === active) return;
      saveScreenRes(id);
      window.location.reload();
    }, 210);

    const fpsActive = getFpsCap();
    this._selectButton(UX(this, CX1), 262, 'Частота кадров', FPS_OPTIONS, fpsActive, (id) => {
      if (id === fpsActive) return;
      saveFpsCap(id);
      window.location.reload();
    }, 210);

    // Вертикальная синхронизация: lock цикла на 60. Применяется перезагрузкой.
    this._toggle(UX(this, CX1), 324, 'Синхронизация', getVsync, saveVsync, true, 210);
    // Показ FPS в углу экрана (в матчах): без перезагрузки.
    this._toggle(UX(this, CX1), 366, 'Показ FPS', getShowFps, saveShowFps, false, 210);
    // Замер FPS под нагрузкой (проверка настроек графики).
    this._actionButton(UX(this, CX1), 416, 'ТЕСТ FPS', () => this.scene.start('BenchmarkScene'), 15, 210, 0x1f6a3d);

    // --- Панель ЗВУК И ИГРОК: музыка и звуки, шаг 10%, 0 = Выкл. ---
    this._panelSubhead(UX(this, CX2), 142, 'ЗВУК');
    this._volumeStepper(UX(this, CX2), 196, 'Музыка', 'musicVol');
    this._volumeStepper(UX(this, CX2), 282, 'Звуки', 'sfxVol');

    this._panelSubhead(UX(this, CX2), 338, 'ИГРОК');
    {
      this._nickText = this.add.text(UX(this, CX2), 368, '', {
        fontSize: '19px', color: '#ffee88', fontStyle: 'bold'
      }).setOrigin(0.5);
      const paintNick = () => {
        const name = String(gameState.playerName || 'Игрок');
        this._nickText.setText(`Ник: ${name}`);
        const nl = name.length;
        this._nickText.setFontSize(nl <= 8 ? 19 : nl <= 12 ? 16 : 14);
      };
      paintNick();
      this._actionButton(UX(this, CX2), 408, 'Изменить ник', () => {
        const value = window.prompt('Введите ник (до 16 символов):', gameState.playerName);
        if (value != null && value.trim()) {
          renamePlayer(value.trim().slice(0, 16));
          paintNick();
        }
      }, 14, 170, 0x443377);
    }

    // --- Панель ПРИЦЕЛ: живой предпросмотр + настройки. ---
    {
      const CX = UX(this, CX3);
      this._crossPrevX = CX;
      const crossPainters = [];

      // Кнопка сброса в шапке панели (правый верх)
      const resetX = UX(this, 720 + 240 - 34);
      const resetY = PANEL_TOP + 17;
      const crG = this.add.graphics();
      const drawCr = (hot) => {
        crG.clear();
        crG.fillStyle(hot ? 0x3a2a50 : 0x1a1a36, 0.95);
        crG.fillRoundedRect(resetX - 22, resetY - 10, 44, 20, 5);
        crG.lineStyle(1, hot ? 0xb080ff : 0x6a5a8a, 1);
        crG.strokeRoundedRect(resetX - 22, resetY - 10, 44, 20, 5);
      };
      drawCr(false);
      const crTxt = this.add.text(resetX, resetY, 'Сброс', {
        fontSize: '11px', color: '#b8a8d8', fontStyle: 'bold'
      }).setOrigin(0.5);
      const crZone = this.add.zone(resetX, resetY, 44, 20).setInteractive({ useHandCursor: true });
      crZone.on('pointerover', () => { drawCr(true); crTxt.setStyle({ color: '#ffffff' }); });
      crZone.on('pointerout', () => { drawCr(false); crTxt.setStyle({ color: '#b8a8d8' }); });

      const pvBg = this.add.graphics();
      pvBg.fillGradientStyle(0x0d0d2a, 0x0d0d2a, 0x070714, 0x070714, 1);
      pvBg.fillRoundedRect(CX - 78, 148, 156, 84, 8);
      pvBg.lineStyle(1.5, 0x4466aa, 0.9);
      pvBg.strokeRoundedRect(CX - 78, 148, 156, 84, 8);
      pvBg.lineStyle(1, 0xffffff, 0.08);
      pvBg.lineBetween(CX - 70, 150, CX + 70, 150);
      // Прицельная сетка в превью
      pvBg.lineStyle(1, 0x4466aa, 0.18);
      pvBg.lineBetween(CX - 70, 190, CX + 70, 190);
      pvBg.lineBetween(CX, 154, CX, 226);

      this._crossPrev = this.add.graphics();
      const paintCrossPreview = () => {
        try {
          const c = getCrosshair();
          const g = this._crossPrev;
          g.clear();
          g.setPosition(CX, 190);
          drawCrosshairFigure(g, c, c.size);
        } catch (e) {}
      };
      paintCrossPreview();
      this._paintCrossPreview = paintCrossPreview;

      const mkCross = (y, paint, next) => {
        this._optionRow(CX, y, paint, next, 210, crossPainters);
      };
      mkCross(252, b => { b.setText(`Вид: ${crossLabel(getCrosshair().shape, CROSS_SHAPES)} ▸`); }, nextCrossShape);
      mkCross(284, b => { b.setText(`Цвет: ${crossLabel(getCrosshair().color, CROSS_COLORS)} ▸`); }, nextCrossColor);
      mkCross(316, b => { b.setText(`Размер: ${getCrosshair().size} ▸`); }, nextCrossSize);
      mkCross(348, b => { b.setText(`Толщина: ${getCrosshair().thick} ▸`); }, nextCrossThick);
      mkCross(380, b => { b.setText(`Лапки: ${crossArmsLabel(getCrosshair().arms)} ▸`); }, nextCrossArms);
      mkCross(412, b => { b.setText(`Точка: ${crossDotLabel(getCrosshair().dot)} ▸`); }, nextCrossDot);
      mkCross(444, b => { b.setText(`Прицел: ${getCrosshair().dynamic ? 'динам.' : 'статич.'} ▸`); }, () => setCrosshair({ dynamic: !getCrosshair().dynamic }));

      crZone.on('pointerdown', () => {
        setCrosshair(crossDefaults());
        crossPainters.forEach(p => { try { p(); } catch (e) {} });
        paintCrossPreview();
      });
    }

    // --- Панель ЭФФЕКТЫ: качество графики, тряска камеры, вибрация. ---
    const qActive = getQuality();
    this._selectButton(UX(this, CX4), 188, 'Качество графики', QUALITY_OPTIONS, qActive, (id) => {
      if (id === qActive) return;
      setQuality(id);
      window.location.reload();
    }, 220);
    this._toggle(UX(this, CX4), 264, 'Тряска камеры', getCamShake, setCamShake, false, 220);
    this._toggle(UX(this, CX4), 308, 'Вибрация', getVibration, setVibration, false, 220);

    // --- Футёр «ИГРА» (слева): чит-код и сбросы. ---
    this.add.text(UX(this, 130), 526, 'Чит-код', {
      fontSize: '16px', color: '#aabbff'
    }).setOrigin(0.5);

    this.cheatMsg = this.add.text(UX(this, 260), 570, '', {
      fontSize: '12px', color: '#ffee88', wordWrap: { width: 390 }, align: 'center'
    }).setOrigin(0.5);

    this.cheatArming = false;
    this.cheatBuffer = '';
    this._actionButton(UX(this, 330), 526, 'Ввести чит-код', () => {
      this.cheatArming = true;
      this.cheatBuffer = '';
      this.cheatMsg.setColor('#ffee88');
      this.cheatMsg.setText('Вводи код с клавиатуры, Enter — готово');
    }, 14, 160, 0x443377);

    this._actionButton(UX(this, 155), 640, 'Сбросить кампанию', () => {
      if (!this.campResetPending) {
        this.campResetPending = true;
        if (this.campResetBtn && this.campResetBtn._txt) this.campResetBtn._txt.setText('Точно? Ещё раз');
        if (this.campResetBtn && this.campResetBtn._paint) this.campResetBtn._paint(true, 0x8a3a3a);
        return;
      }
      resetCampaign();
      this.scene.start('MenuScene');
    }, 13, 180, 0x5a3a2a);
    this.campResetBtn = this._actionButtons[this._actionButtons.length - 1];

    this._actionButton(UX(this, 365), 640, 'Сбросить прогресс', () => {
      if (!this.resetPending) {
        this.resetPending = true;
        if (this.resetBtn && this.resetBtn._txt) this.resetBtn._txt.setText('Точно? Ещё раз');
        if (this.resetBtn && this.resetBtn._paint) this.resetBtn._paint(true, 0x8a3a3a);
        return;
      }
      resetProgress();
      this.scene.start('MenuScene');
    }, 13, 180, 0x5a2a2a);
    this.resetBtn = this._actionButtons[this._actionButtons.length - 1];

    // --- Футёр «УПРАВЛЕНИЕ» (справа): схема, раскладка и сброс клавиш в ряд. ---
    const schemeActive = getControlScheme();
    this._selectButton(UX(this, 650), 595, 'Схема управления', CONTROL_SCHEMES, schemeActive, (id) => {
      if (id === schemeActive) return;
      setControlScheme(id);
    }, 220);

    this._actionButton(UX(this, 885), 595, 'РАСКЛАДКА КЛАВИШ', () => this._openKeyModal(), 14, 210, 0x2a4a7a);

    this._actionButton(UX(this, 1115), 595, 'Сброс клавиш', () => {
      resetKeys();
      this._toast('Клавиши сброшены');
      if (this._keyModal) this._keyModal.repaint();
    }, 14, 170, 0x553333);

    this._cheatKeyHandler = (event) => {
      if (!this.cheatArming) return;
      if (event.key === 'Enter') {
        const code = this.cheatBuffer.trim().toLowerCase();
        this.cheatArming = false;
        this.cheatBuffer = '';
        if (code === 'all') {
          addCoins(500000);
          addExperience(500000);
          gameState.genePoints = (gameState.genePoints | 0) + 20;
          gameState.geneUnlocked = true;
          try {
            (GEAR_ITEMS || []).forEach(g => {
              if (!g || !g.tex) return;
              if (g.slot === 'shoes') unlockShoes(g.tex);
              else if (g.slot === 'torso') unlockTorso(g.tex);
              else if (g.slot === 'pants') unlockPants(g.tex);
              else unlockHead(g.tex);
            });
          } catch (e) {}
          saveGameState();
          this.cheatMsg.setColor('#88ff88');
          this.cheatMsg.setText('Всё выдано: монеты, опыт, геном и одежда!');
        } else if (code === 'all2') {
          gameState.cheatAllUnlocked = true;
          saveGameState();
          this.cheatMsg.setColor('#88ff88');
          this.cheatMsg.setText('Все кнопки разблокированы!');
        } else if (/^l\d{1,2}$/.test(code)) {
          const total = campaignLevels.length;
          const n = parseInt(code.slice(1), 10);
          if (total > 0 && n >= 1 && n <= total) {
            gameState.campaignLevel = n;
            saveGameState();
            this.cheatMsg.setColor('#88ff88');
            this.cheatMsg.setText(`Кампания: уровень ${n} — жми Кампанию в меню!`);
          } else {
            this.cheatMsg.setColor('#ff8888');
            this.cheatMsg.setText(`Такого уровня нет (есть 1–${total})`);
          }
        } else {
          this.cheatMsg.setColor('#ff8888');
          this.cheatMsg.setText('Неверный код');
        }
        return;
      }
      if (event.key === 'Escape') {
        this.cheatArming = false;
        this.cheatBuffer = '';
        this.cheatMsg.setText('');
        return;
      }
      if (event.key && event.key.length === 1 && this.cheatBuffer.length < 12) {
        this.cheatBuffer += event.key;
        this.cheatMsg.setColor('#ffee88');
        this.cheatMsg.setText('Код: ' + this.cheatBuffer);
      }
    };
    this.input.keyboard.on('keydown', this._cheatKeyHandler);

    // Кнопка «Назад» в стиле других сцен
    this._createBackButton(UX(this, 70), 28);

    this.createFullscreenButton(UX(this, 1220), 40);

    // Чистка висячих слушателей при выходе (иначе дубли на ре-энтере).
    this.events.once('shutdown', () => {
      try {
        if (this._cheatKeyHandler) this.input.keyboard.off('keydown', this._cheatKeyHandler);
        else this.input.keyboard.off('keydown');
      } catch (e) {}
      try {
        (this._dropOutsideHandlers || []).forEach(h => this.input.off('pointerdown', h));
      } catch (e) {}
      try { this._dropOutsideHandlers = []; } catch (e) {}
      try {
        if (this._fsEnterHandler) this.scale.off('enterfullscreen', this._fsEnterHandler);
        else this.scale.off('enterfullscreen');
      } catch (e) {}
      try {
        if (this._fsLeaveHandler) this.scale.off('leavefullscreen', this._fsLeaveHandler);
        else this.scale.off('leavefullscreen');
      } catch (e) {}
    });
  }

  _initBackground() {
    const W = gameW(this);
    this.cameras.main.setBackgroundColor('#080916');

    // Глубина фона: три слоя (как в инвентаре/кейсах)
    const bgb = this.add.graphics().setDepth(-10);
    bgb.fillStyle(0x0f1226, 1);
    bgb.fillRect(0, 0, W, 240);
    bgb.fillStyle(0x090b1c, 1);
    bgb.fillRect(0, 240, W, 240);
    bgb.fillStyle(0x050610, 1);
    bgb.fillRect(0, 480, W, 240);

    this.bg = null;
    if (this.textures.exists('fon_menu')) {
      const src = this.textures.get('fon_menu').getSourceImage();
      const ratio = src.height / src.width;
      const bgW = W * 1.15;
      const bgH = Math.round(bgW * ratio);
      this.bg = this.add.image(W / 2, 720 - bgH / 2, 'fon_menu');
      this.bg.setDisplaySize(bgW, bgH);
      this.bg.setAlpha(0.18);
      this.bg.setDepth(-1);
    }

    // Мягкая виньетка/акцентные линии
    bgb.lineStyle(1, 0xffd24a, 0.18);
    bgb.lineBetween(0, 56, W, 56);
    bgb.lineBetween(0, 708, W, 708);
  }

  _initHeader(cx) {
    this.add.text(cx, 24, 'НАСТРОЙКИ', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    // Золотая черта с ромбом под заголовком
    const fl = this.add.graphics().setDepth(5);
    fl.lineStyle(2, 0xffd24a, 0.8);
    fl.lineBetween(cx - 120, 46, cx + 120, 46);
    fl.fillStyle(0xffd24a, 0.9);
    const dd = 5;
    fl.fillPoints([
      new Phaser.Geom.Point(cx, 46 - dd), new Phaser.Geom.Point(cx + dd, 46),
      new Phaser.Geom.Point(cx, 46 + dd), new Phaser.Geom.Point(cx - dd, 46)
    ], true);
  }

  _createBackButton(x, y) {
    const backW = 104, backH = 34;
    const backFr = this.add.graphics().setDepth(59);
    const renderBack = (hot) => {
      backFr.clear();
      backFr.fillStyle(0x3a1e24, 1);
      backFr.fillRoundedRect(x - backW / 2, y - backH / 2, backW, backH, 8);
      backFr.fillStyle(0xffffff, hot ? 0.15 : 0.08);
      backFr.fillRoundedRect(x - backW / 2, y - backH / 2, backW, 5, { tl: 8, tr: 8, bl: 0, br: 0 });
      backFr.lineStyle(hot ? 2 : 1.5, hot ? 0xffff88 : 0x9e4a5a, 1);
      backFr.strokeRoundedRect(x - backW / 2, y - backH / 2, backW, backH, 8);
    };
    renderBack(false);

    const back = this.add.text(x, y, '← Назад', {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      fixedWidth: backW,
      padding: { top: 7, bottom: 7 },
      align: 'center'
    }).setOrigin(0.5).setDepth(60);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    back.on('pointerover', () => {
      renderBack(true);
      back.setStyle({ color: '#ffff55' });
      try { if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) this.sound.play('sfx_hover', { volume: 0.2 }); } catch (e) {}
    });
    back.on('pointerout', () => {
      renderBack(false);
      back.setStyle({ color: '#ffffff' });
    });
  }

  // Премиум-панель: градиент, акцентная шапка, двойная рамка, заклёпки.
  _panel(x, top, w, h, title, accent) {
    const g = this.add.graphics();
    const ac = accent != null ? accent : 0x3a3a6a;
    try {
      g.fillGradientStyle(0x1a1a36, 0x1a1a36, 0x0e0e24, 0x0e0e24, 1);
      g.fillRoundedRect(x, top, w, h, 12);
    } catch (e) {
      g.fillStyle(0x12122a, 0.95);
      g.fillRoundedRect(x, top, w, h, 12);
    }
    // Шапка: акцентная полоса
    try {
      g.fillStyle(ac, 0.85);
      g.fillRoundedRect(x + 3, top + 3, w - 6, 30, { tl: 9, tr: 9, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 0.1);
      g.fillRoundedRect(x + 3, top + 3, w - 6, 4, { tl: 9, tr: 9, bl: 0, br: 0 });
    } catch (e) {}
    g.lineStyle(2, 0x0a0a1a, 1);
    g.strokeRoundedRect(x, top, w, h, 12);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(x + 3, top + 3, w - 6, h - 6, 9);
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(x + 14, top + 3, x + w - 14, top + 3);
    // Заклёпки по углам
    try {
      g.fillStyle(0x8a8aa8, 1);
      [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]].forEach(([dx, dy]) => {
        g.fillCircle(x + dx, top + dy, 2.5);
      });
    } catch (e) {}
    this.add.text(x + w / 2, top + 17, title, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  _panelSubhead(cx, y, label) {
    this.add.text(cx, y, label, {
      fontSize: '12px', color: '#7fa8d8', fontStyle: 'bold'
    }).setOrigin(0.5);
    const g = this.add.graphics();
    g.lineStyle(1, 0x3a5a8a, 0.5);
    g.lineBetween(cx - 140, y + 10, cx + 140, y + 10);
  }

  // Кнопка-опция в панели прицела (компактный ряд)
  _optionRow(cx, y, paint, next, w, painters) {
    const h = 26;
    const cont = this.add.container(cx, y);
    const bg = this.add.graphics();
    const txt = this.add.text(0, 0, '', {
      fontSize: '13px', color: '#e8f0ff'
    }).setOrigin(0.5);
    const draw = (hot) => {
      bg.clear();
      bg.fillStyle(hot ? 0x22264a : 0x161836, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      bg.lineStyle(1, hot ? 0x8a7aff : 0x3a3a6a, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
      txt.setStyle({ color: hot ? '#ffffaa' : '#e8f0ff' });
    };
    draw(false);
    paint(txt);
    painters.push(() => paint(txt));
    cont.add([bg, txt]);
    cont.setSize(w, h);
    cont.setInteractive({ useHandCursor: true });
    cont.on('pointerover', () => draw(true));
    cont.on('pointerout', () => draw(false));
    cont.on('pointerdown', () => {
      next();
      paint(txt);
      if (typeof this._paintCrossPreview === 'function') this._paintCrossPreview();
    });
  }

  // Тумблер «вкл/выкл». reload=true — применить перезагрузкой страницы.
  _toggle(x, y, label, get, set, reload, w = 210) {
    const h = 30;
    const cont = this.add.container(x, y);
    const bg = this.add.graphics();
    const txt = this.add.text(0, 0, '', {
      fontSize: '14px', color: '#ffffff'
    }).setOrigin(0.5);
    const paint = (hot) => {
      const on = !!get();
      bg.clear();
      bg.fillStyle(hot ? 0x22264a : 0x161836, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
      bg.lineStyle(1.2, hot ? 0x7aa8ff : 0x3a3a6a, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
      // Индикатор состояния
      const ix = w / 2 - 22;
      bg.fillStyle(on ? 0x35d07f : 0x555577, 1);
      bg.fillCircle(ix, 0, 6);
      if (on) { bg.fillStyle(0xffffff, 0.4); bg.fillCircle(ix - 1.5, -1.5, 2); }
      txt.setText(`${label}: ${on ? 'вкл' : 'выкл'}`);
      txt.setStyle({ color: hot ? '#ffffaa' : '#ffffff' });
      // Сдвиг текста влево, чтобы не наезжал на индикатор
      txt.setX(-8);
      if (txt.displayWidth > w - 46 && txt.displayWidth > 0) txt.setScale(Math.min(1, (w - 46) / txt.displayWidth));
      else txt.setScale(1);
    };
    paint(false);
    cont.add([bg, txt]);
    cont.setSize(w, h);
    cont.setInteractive({ useHandCursor: true });
    cont.on('pointerover', () => paint(true));
    cont.on('pointerout', () => paint(false));
    cont.on('pointerdown', () => {
      set(!get());
      paint(false);
      if (reload) window.location.reload();
    });
    return cont;
  }

  // Короткий тост в центре экрана (для «Клавиши сброшены» и т.п.).
  _toast(text) {
    if (this._toastObj) { try { this._toastObj.destroy(); } catch (e) {} }
    const cont = this.add.container(gameW(this) / 2, 250).setDepth(250);
    const bg = this.add.graphics();
    const txt = this.add.text(0, 0, text, {
      fontSize: '17px', color: '#ffee88', fontStyle: 'bold'
    }).setOrigin(0.5);
    const tw = txt.displayWidth + 28, th = 34;
    bg.fillStyle(0x111133, 0.95);
    bg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 8);
    bg.lineStyle(1.5, 0xffd24a, 0.6);
    bg.strokeRoundedRect(-tw / 2, -th / 2, tw, th, 8);
    cont.add([bg, txt]);
    this._toastObj = cont;
    this.tweens.add({
      targets: cont, alpha: 0, duration: 600, delay: 1600,
      onComplete: () => { try { if (this._toastObj === cont) this._toastObj = null; cont.destroy(); } catch (e) {} }
    });
  }

  // Модалка переназначения клавиш: два столбца по 5 действий.
  _openKeyModal() {
    if (this._keyModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const W = 900, H = 560;
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.72).setDepth(300);
    overlay.setInteractive();
    const panel = this.add.graphics().setDepth(301);
    panel.fillGradientStyle(0x1a1a36, 0x1a1a36, 0x0e0e24, 0x0e0e24, 1);
    panel.fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 12);
    panel.fillStyle(0x2a6a6a, 0.85);
    panel.fillRoundedRect(cx - W / 2 + 3, cy - H / 2 + 3, W - 6, 36, { tl: 9, tr: 9, bl: 0, br: 0 });
    panel.lineStyle(2, 0x0a0a1a, 1);
    panel.strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 12);
    panel.lineStyle(1, 0xffffff, 0.12);
    panel.strokeRoundedRect(cx - W / 2 + 3, cy - H / 2 + 3, W - 6, H - 6, 9);
    elems.push(overlay, panel);
    elems.push(this.add.text(cx, cy - H / 2 + 20, 'УПРАВЛЕНИЕ', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));
    elems.push(this.add.text(cx, cy - H / 2 + 54, 'Нажми на клавишу, чтобы переназначить · Esc — отмена', {
      fontSize: '13px', color: '#99aacc'
    }).setOrigin(0.5).setDepth(302));

    const rowY = [cy - 170, cy - 110, cy - 50, cy + 10, cy + 70];
    const labelX = [cx - 400, cx + 60];
    const btnX = [cx - 80, cx + 360];
    const keyBtns = [];
    KEY_ACTIONS.forEach((a, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i % 5;
      const y = rowY[row];
      elems.push(this.add.text(labelX[col], y, a.label, {
        fontSize: '15px', color: '#ffffff'
      }).setOrigin(0, 0.5).setDepth(302));
      const b = this._modalKeyBtn(btnX[col], y, 130);
      elems.push(b.cont, b.txt, b.bg);
      const paint = () => { b.txt.setText(keyName(getKeyCode(a.id))); b.paint(false); };
      paint();
      keyBtns.push({ action: a.id, b, paint });
      b.cont.on('pointerdown', () => this._captureKey(keyBtns, a.id));
      b.cont.on('pointerover', () => { if (!b._listening) b.paint(true); });
      b.cont.on('pointerout', () => { if (!b._listening) b.paint(false); });
    });

    const resetB = this._modalActionBtn(cx, cy + 150, 'СБРОСИТЬ ВСЕ', 0x443377, 160);
    elems.push(resetB.cont, resetB.txt, resetB.bg);
    resetB.cont.on('pointerdown', () => {
      resetKeys();
      keyBtns.forEach(k => { try { k.paint(); } catch (e) {} });
    });

    const closeB = this._modalActionBtn(cx, cy + 210, 'ЗАКРЫТЬ', 0x553333, 140);
    elems.push(closeB.cont, closeB.txt, closeB.bg);

    const close = () => {
      try {
        if (this._keyCaptureHandler) this.input.keyboard.off('keydown', this._keyCaptureHandler);
      } catch (e) {}
      this._keyCaptureHandler = null;
      elems.forEach(o => { try { o.destroy(); } catch (e) {} });
      this._keyModal = null;
    };
    closeB.cont.on('pointerdown', close);
    overlay.on('pointerdown', close);
    this._keyModal = {
      repaint: () => keyBtns.forEach(k => { try { k.paint(); } catch (e) {} }),
      close
    };
  }

  _modalKeyBtn(x, y, w) {
    const h = 30;
    const bg = this.add.graphics().setDepth(302);
    const txt = this.add.text(x, y, '', {
      fontSize: '14px', color: '#ffee88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303);
    const cont = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(303);
    const paint = (hot, listening) => {
      bg.clear();
      bg.fillStyle(listening ? 0x3a3a10 : (hot ? 0x22264a : 0x161836), 0.95);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      bg.lineStyle(1.2, listening ? 0xffff55 : (hot ? 0x8fb8ff : 0x3a3a6a), 1);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      txt.setStyle({ color: listening ? '#ffff55' : (hot ? '#ffffff' : '#ffee88') });
    };
    paint(false);
    return { cont, txt, bg, paint, _listening: false, set listening(v) { this._listening = v; paint(false, v); }, get listening() { return this._listening; } };
  }

  _modalActionBtn(x, y, label, color, w) {
    const h = 34;
    const bg = this.add.graphics().setDepth(302);
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303);
    const cont = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(303);
    const paint = (hot) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      bg.fillStyle(0xffffff, hot ? 0.14 : 0.06);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, 5, { tl: 8, tr: 8, bl: 0, br: 0 });
      bg.lineStyle(hot ? 2 : 1.5, hot ? 0xffff88 : 0xffffff, hot ? 1 : 0.2);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      txt.setStyle({ color: hot ? '#ffff88' : '#ffffff' });
    };
    paint(false);
    cont.on('pointerover', () => paint(true));
    cont.on('pointerout', () => paint(false));
    return { cont, txt, bg, paint };
  }

  // Захват следующей нажатой клавиши для действия.
  _captureKey(keyBtns, action) {
    try {
      if (this._keyCaptureHandler) this.input.keyboard.off('keydown', this._keyCaptureHandler);
    } catch (e) {}
    this._keyCaptureHandler = null;
    keyBtns.forEach(k => {
      if (k.action === action) {
        k.b.listening = true;
        k.b.txt.setText('...');
      } else if (k.b.listening) {
        k.b.listening = false;
        k.paint();
      }
    });
    const done = () => {
      this._keyCaptureHandler = null;
      keyBtns.forEach(k => {
        k.b.listening = false;
        try { k.paint(); } catch (e) {}
      });
    };
    const handler = (event) => {
      try { this.input.keyboard.off('keydown', handler); } catch (e) {}
      try { event.preventDefault(); } catch (e) {}
      if (event.key === 'Escape') { done(); return; }
      const code = event.keyCode;
      if (!code) { done(); return; }
      const cur = getSettings();
      const raw = keyCodeName(code) || keyName(code);
      saveSettings({ keys: { ...cur.keys, [action]: raw } });
      done();
    };
    this._keyCaptureHandler = handler;
    this.input.keyboard.once('keydown', handler);
  }

  // Степпер громкости: подпись + «− значение +», шаг 10%.
  _volumeStepper(cx, y, label, key) {
    this.add.text(cx, y - 30, label, {
      fontSize: '16px', color: '#c8d8f0'
    }).setOrigin(0.5);
    const valBg = this.add.graphics();
    valBg.fillStyle(0x0d0d24, 0.9);
    valBg.fillRoundedRect(cx - 52, y - 14, 104, 28, 6);
    valBg.lineStyle(1, 0x3a3a6a, 1);
    valBg.strokeRoundedRect(cx - 52, y - 14, 104, 28, 6);
    const val = this.add.text(cx, y, '', {
      fontSize: '19px', color: '#ffee88', fontStyle: 'bold',
      fixedWidth: 100, align: 'center'
    }).setOrigin(0.5);
    const getV = () => (key === 'musicVol' ? musicVol() : sfxVol());
    const paint = () => val.setText(volLabel(getV()));
    paint();
    const mk = (x, t, d) => {
      const bw = 40, bh = 28;
      const bg = this.add.graphics();
      const txt = this.add.text(x, y, t, {
        fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      const zone = this.add.zone(x, y, bw, bh).setInteractive({ useHandCursor: true });
      const draw = (hot) => {
        bg.clear();
        bg.fillStyle(hot ? 0x2a3a7a : 0x1a1a3a, 1);
        bg.fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 7);
        bg.lineStyle(1.2, hot ? 0x8fb8ff : 0x3a4a7a, 1);
        bg.strokeRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 7);
        txt.setStyle({ color: hot ? '#ffff88' : '#ffffff' });
      };
      draw(false);
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', () => {
        const nv = Math.min(1, Math.max(0, Math.round((getV() + d) * 10) / 10));
        gameState[key] = nv;
        saveGameState();
        paint();
        refreshLiveVolumes(this.sound);
        if (key === 'musicVol') {
          try {
            if (nv > 0 && this.cache.audio.exists('mus_menu') && !this.sound.locked) {
              const playing = this.sound.sounds.some(s => s && s.isPlaying && String(s.key || '').startsWith('mus_'));
              if (!playing) this.sound.play('mus_menu', { loop: true, volume: 0.32 });
            }
          } catch (e) {}
        } else if (key === 'sfxVol' && nv > 0) {
          try {
            if (!this.sound.locked) {
              const avail = SFX_PREVIEW_KEYS.filter(k => this.cache.audio.exists(k));
              if (avail.length) {
                const pick = avail[Math.floor(Math.random() * avail.length)];
                this.sound.play(pick, { volume: 1 });
              }
            }
          } catch (e) {}
        }
      });
    };
    mk(cx - 92, '−', -0.1);
    mk(cx + 92, '+', +0.1);
  }

  // Инфо-панель шансов кейсов.
  _openRatesInfo() {
    if (this._ratesModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const W = 440, H = 380;
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.72).setDepth(200);
    const panel = this.add.graphics().setDepth(201);
    panel.fillGradientStyle(0x1a1a36, 0x1a1a36, 0x0e0e24, 0x0e0e24, 1);
    panel.fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 12);
    panel.fillStyle(0x2a5aaa, 0.85);
    panel.fillRoundedRect(cx - W / 2 + 3, cy - H / 2 + 3, W - 6, 36, { tl: 9, tr: 9, bl: 0, br: 0 });
    panel.lineStyle(2, 0x0a0a1a, 1);
    panel.strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 12);
    panel.lineStyle(1, 0xffffff, 0.12);
    panel.strokeRoundedRect(cx - W / 2 + 3, cy - H / 2 + 3, W - 6, H - 6, 9);
    elems.push(overlay, panel);
    elems.push(this.add.text(cx, cy - H / 2 + 20, 'ШАНСЫ КЕЙСОВ', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));
    const rows = [
      ['Легендарное', '1%', '#ffd24a'],
      ['Эпическое', '5%', '#b44dff'],
      ['Редкое', '10%', '#35d07f'],
      ['Обычное', '12%', '#3b9dff'],
      ['Ширпотреб', '18%', '#9aa0a8'],
      ['Деньги больше цены', '20%', '#7dffa0'],
      ['Деньги меньше цены', '34%', '#99aacc']
    ];
    rows.forEach((r, i) => {
      const y = cy - 108 + i * 34;
      // Плашка строки
      const rg = this.add.graphics().setDepth(202);
      if (i % 2 === 0) rg.fillStyle(0xffffff, 0.03);
      else rg.fillStyle(0x000000, 0);
      rg.fillRoundedRect(cx - 190, y - 13, 380, 26, 4);
      elems.push(rg);
      elems.push(this.add.text(cx - 175, y, r[0], {
        fontSize: '15px', color: '#dddddd'
      }).setOrigin(0, 0.5).setDepth(203));
      elems.push(this.add.text(cx + 175, y, r[1], {
        fontSize: '15px', color: r[2], fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(203));
    });
    elems.push(this.add.text(cx, cy + 140, 'У кейса скинов: легендарное 8%, эпическое 10%', {
      fontSize: '12px', color: '#ffd24a'
    }).setOrigin(0.5).setDepth(202));
    const closeB = this._modalActionBtn(cx, cy + H / 2 - 28, 'ЗАКРЫТЬ', 0x553333, 140);
    // поднять на нужный depth
    closeB.bg.setDepth(202); closeB.txt.setDepth(203); closeB.cont.setDepth(203);
    elems.push(closeB.cont, closeB.txt, closeB.bg);
    const close = () => {
      elems.forEach(o => { try { o.destroy(); } catch (e) {} });
      this._ratesModal = null;
    };
    closeB.cont.on('pointerdown', close);
    overlay.setInteractive();
    overlay.on('pointerdown', close);
    this._ratesModal = { elems, close };
  }

  // Кнопка-селектор: подпись сверху, значение кнопкой. Список — в модалке.
  _selectButton(x, y, label, options, currentId, onSelect, w = 210) {
    this.add.text(x, y - 30, label, {
      fontSize: '14px', color: '#aabbff'
    }).setOrigin(0.5);
    const h = 30;
    const cont = this.add.container(x, y);
    const bg = this.add.graphics();
    const txt = this.add.text(0, 0, '', {
      fontSize: '14px', color: '#ffffff'
    }).setOrigin(0.5);
    const paint = (hot) => {
      const o = options.find(v => v.id === currentId) || options[0];
      const text = `${o.label}  ▾`;
      txt.setText(text);
      if (txt.displayWidth > w - 24 && txt.displayWidth > 0) txt.setScale(Math.min(1, (w - 24) / txt.displayWidth));
      else txt.setScale(1);
      bg.clear();
      bg.fillStyle(hot ? 0x22264a : 0x161836, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
      bg.lineStyle(1.2, hot ? 0x7aa8ff : 0x3a3a6a, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
      txt.setStyle({ color: hot ? '#ffffaa' : '#ffffff' });
    };
    paint(false);
    cont.add([bg, txt]);
    cont.setSize(w, h);
    cont.setInteractive({ useHandCursor: true });
    cont.on('pointerover', () => paint(true));
    cont.on('pointerout', () => paint(false));
    cont.on('pointerdown', () => {
      this._openSelectModal(label, options, currentId, (id) => {
        currentId = id;
        paint(false);
        onSelect(id);
      });
    });
    return cont;
  }

  // Модалка выбора из списка (разрешение/кадры/качество).
  _openSelectModal(title, options, currentId, onSelect) {
    if (this._selectModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const W = 380, H = 110 + options.length * 48;
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.72).setDepth(280);
    overlay.setInteractive();
    const panel = this.add.graphics().setDepth(281);
    panel.fillGradientStyle(0x1a1a36, 0x1a1a36, 0x0e0e24, 0x0e0e24, 1);
    panel.fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 12);
    panel.fillStyle(0x2a5aaa, 0.85);
    panel.fillRoundedRect(cx - W / 2 + 3, cy - H / 2 + 3, W - 6, 36, { tl: 9, tr: 9, bl: 0, br: 0 });
    panel.lineStyle(2, 0x0a0a1a, 1);
    panel.strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 12);
    panel.lineStyle(1, 0xffffff, 0.12);
    panel.strokeRoundedRect(cx - W / 2 + 3, cy - H / 2 + 3, W - 6, H - 6, 9);
    elems.push(overlay, panel);
    elems.push(this.add.text(cx, cy - H / 2 + 20, title, {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(282));
    options.forEach((o, i) => {
      const y = cy - H / 2 + 24 + 34 + i * 48;
      const rw = W - 40, rh = 36;
      const rbg = this.add.graphics().setDepth(282);
      const rtxt = this.add.text(cx, y, (o.id === currentId ? '✓ ' : '') + o.label, {
        fontSize: '16px', color: '#ffffff'
      }).setOrigin(0.5).setDepth(283);
      const rzone = this.add.zone(cx, y, rw, rh).setInteractive({ useHandCursor: true }).setDepth(283);
      const drawR = (hot) => {
        rbg.clear();
        rbg.fillStyle(hot ? 0x2a3a7a : 0x161836, 0.95);
        rbg.fillRoundedRect(cx - rw / 2, y - rh / 2, rw, rh, 7);
        rbg.lineStyle(1, hot ? 0x8fb8ff : 0x3a3a6a, 1);
        rbg.strokeRoundedRect(cx - rw / 2, y - rh / 2, rw, rh, 7);
        rtxt.setStyle({ color: hot ? '#ffff88' : '#ffffff' });
      };
      drawR(false);
      rzone.on('pointerover', () => drawR(true));
      rzone.on('pointerout', () => drawR(false));
      rzone.on('pointerdown', () => { close(); onSelect(o.id); });
      elems.push(rbg, rtxt, rzone);
    });
    const close = () => {
      elems.forEach(e => { try { e.destroy(); } catch (e) {} });
      this._selectModal = null;
    };
    overlay.on('pointerdown', close);
    this._selectModal = { close };
  }

  // Универсальная красивая кнопка-действие (рамка, блик, ховер).
  _actionButton(x, y, label, callback, fontSize = 15, w = 180, accent = 0x252560) {
    const h = Math.max(30, Math.round(fontSize * 2.1));
    const cont = this.add.container(x, y);
    const bg = this.add.graphics();
    const txt = this.add.text(0, 0, label, {
      fontSize: fontSize + 'px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    // Подгоняем текст по ширине
    if (txt.displayWidth > w - 20 && txt.displayWidth > 0) {
      txt.setScale(Math.min(1, (w - 20) / txt.displayWidth));
    }
    const paint = (hot, forceAccent) => {
      const ac = forceAccent != null ? forceAccent : accent;
      bg.clear();
      bg.fillStyle(ac, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.fillStyle(0xffffff, hot ? 0.16 : 0.07);
      bg.fillRoundedRect(-w / 2, -h / 2, w, 5, { tl: 8, tr: 8, bl: 0, br: 0 });
      bg.lineStyle(hot ? 2 : 1.5, hot ? 0xffff88 : 0xffffff, hot ? 1 : 0.18);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      txt.setStyle({ color: hot ? '#ffff88' : '#ffffff' });
    };
    paint(false);
    cont.add([bg, txt]);
    cont.setSize(w, h);
    cont.setInteractive({ useHandCursor: true });
    cont.on('pointerover', () => paint(true));
    cont.on('pointerout', () => {
      // Сохраняем состояние "точно?" для кнопок сброса
      if (this.resetPending && cont === this.resetBtn) paint(true, 0x8a3a3a);
      else if (this.campResetPending && cont === this.campResetBtn) paint(true, 0x8a3a3a);
      else paint(false);
    });
    cont.on('pointerdown', callback);
    cont._txt = txt;
    cont._paint = paint;
    this._actionButtons.push(cont);
    return cont;
  }

  createFullscreenButton(x, y) {
    const chip = this.add.rectangle(x, y, 60, 44, 0x222255, 1).setInteractive({ useHandCursor: true });
    const g = this.add.graphics();
    let hover = false;

    const drawArrow = (x1, y1, x2, y2) => {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const h = 6;
      g.lineBetween(x1, y1, x2, y2);
      g.lineBetween(x2, y2, x2 + Math.cos(ang + Math.PI - 0.5) * h, y2 + Math.sin(ang + Math.PI - 0.5) * h);
      g.lineBetween(x2, y2, x2 + Math.cos(ang + Math.PI + 0.5) * h, y2 + Math.sin(ang + Math.PI + 0.5) * h);
    };
    const draw = (full) => {
      g.clear();
      g.lineStyle(3, hover ? 0xffff55 : 0xffffff, 1);
      g.strokeRoundedRect(x - 13, y - 13, 26, 26, 3);
      const o = 15;
      if (full) {
        drawArrow(x - o, y - o, x - 7, y - 7);
        drawArrow(x + o, y - o, x + 7, y - 7);
        drawArrow(x - o, y + o, x - 7, y + 7);
        drawArrow(x + o, y + o, x + 7, y + 7);
      } else {
        drawArrow(x - 7, y - 7, x - o, y - o);
        drawArrow(x + 7, y - 7, x + o, y - o);
        drawArrow(x - 7, y + 7, x - o, y + o);
        drawArrow(x + 7, y + 7, x + o, y + o);
      }
    };

    chip.on('pointerover', () => {
      hover = true;
      chip.setFillStyle(0x2a2a7a, 1);
      draw(this.scale.isFullscreen);
    });
    chip.on('pointerout', () => {
      hover = false;
      chip.setFillStyle(0x222255, 1);
      draw(this.scale.isFullscreen);
    });
    chip.on('pointerdown', () => {
      try {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
      } catch (e) { /* noop */ }
    });
    this._fsEnterHandler = () => draw(true);
    this._fsLeaveHandler = () => draw(false);
    this.scale.on('enterfullscreen', this._fsEnterHandler);
    this.scale.on('leavefullscreen', this._fsLeaveHandler);
    draw(false);
  }

  // Совместимость со старым API (используется внутри сцены, но лучше держать).
  createButton(x, y, label, callback, fontSize, padding) {
    return this._actionButton(x, y, label, callback, fontSize || 15, 220, 0x252560);
  }

  update(time, delta) {
    if (!this.bg) return;
    // Дыхание предпросмотра прицела: только в настройках и только
    // в динамическом режиме (в бою динамика едет от разброса, без синуса).
    try {
      if (this._crossPrev) {
        const c = getCrosshair();
        if (c.dynamic) {
          const ph = Math.floor(time / 130);
          if (ph !== this._crossPrevPhase) {
            this._crossPrevPhase = ph;
            const g = this._crossPrev;
            g.clear();
            g.setPosition(this._crossPrevX || 840, 190);
            drawCrosshairFigure(g, c, Math.max(3, c.size + Math.sin(time * 0.004) * 1.5));
          }
        } else if (this._crossPrevPhase !== -2) {
          this._crossPrevPhase = -2;
          if (typeof this._paintCrossPreview === 'function') this._paintCrossPreview();
        }
      }
    } catch (e) {}
    // Delta-нормализация параллакса: сглаживание к цели зависит
    // от времени, а не от кадров (иначе скорость разная на 30/120 FPS).
    const _dt = (typeof delta === 'number' && delta > 0) ? delta : 16.666;
    const k = Math.min(1, _dt / 16.666);
    const lk = 1 - Math.pow(1 - 0.15, k);
    const p = this.input.activePointer;
    const nx = (p.x / this.cameras.main.width - 0.5) * 2;
    const ny = (p.y / this.cameras.main.height - 0.5) * 2;
    const tx = gameW(this) / 2 + nx * 32;
    const ty = (720 - this.bg.displayHeight / 2) + ny * 18;
    this.bg.x += (tx - this.bg.x) * lk;
    this.bg.y += (ty - this.bg.y) * lk;
  }
}
