import { gameW, UX } from '../ui/layout.js?v=3';
import { resetProgress, resetCampaign, addCoins, addExperience, saveGameState, gameState, renamePlayer, unlockHead, unlockShoes, unlockTorso, unlockPants } from '../data/gameState.js?v=175';
import { campaignLevels } from '../data/levels.js?v=172';
import { GEAR_ITEMS } from '../data/wardrobe.js?v=172';
import { musicVol, sfxVol, volLabel, refreshLiveVolumes } from '../data/audio.js?v=170';
import {
  getCrosshair, setCrosshair, crossLabel, crossDotLabel, crossArmsLabel,
  CROSS_COLORS, CROSS_SHAPES, crossDefaults,
  nextCrossColor, nextCrossShape, nextCrossSize, nextCrossThick,
  nextCrossArms, nextCrossDot,
  drawCrosshairFigure
} from '../data/crosshair.js?v=169';
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
    const _cx = gameW(this) / 2;
    this.cameras.main.setBackgroundColor('#0a0a2a');
    this.resetPending = false;
    // Хранилище разовых слушателей для снятия в shutdown.
    this._dropOutsideHandlers = [];
    this._keyModal = null;
    this._selectModal = null;

    this.bg = null;
    if (this.textures.exists('fon_menu')) {
      const src = this.textures.get('fon_menu').getSourceImage();
      const ratio = src.height / src.width;
      const bgW = gameW(this) * 1.15;
      const bgH = Math.round(bgW * ratio);
      this.bg = this.add.image(_cx, 720 - bgH / 2, 'fon_menu');
      this.bg.setDisplaySize(bgW, bgH);
      this.bg.setAlpha(0.25);
      this.bg.setDepth(-1);
    }

    this.add.text(_cx, 64, 'НАСТРОЙКИ', {
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Сетка: четыре панели сверху (Экран / Звук+Игрок / Прицел / Эффекты)
    // + нижний футёр (читы и сбросы). Панели рисуем первыми — контролы лягут
    // поверх. Координаты внутри 1280-блока, на широком Андроиде — через UX.
    const panel = (x, y, w, h) => {
      const g = this.add.graphics();
      g.fillStyle(0x14142e, 0.92);
      g.fillRoundedRect(x, y, w, h, 12);
      g.lineStyle(2, 0x3a3a6a, 1);
      g.strokeRoundedRect(x, y, w, h, 12);
    };
    const header = (x, y, t) => this.add.text(x, y, t, {
      fontSize: '19px',
      color: '#8fb8ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const PANEL_TOP = 100;
    const PANEL_BOT = 455;
    const PANEL_H = PANEL_BOT - PANEL_TOP;
    const CX1 = 170, CX2 = 510, CX3 = 840, CX4 = 1115;
    panel(UX(this, 40), PANEL_TOP, 260, PANEL_H);     // Экран
    panel(UX(this, 330), PANEL_TOP, 360, PANEL_H);    // Звук + игрок
    panel(UX(this, 720), PANEL_TOP, 240, PANEL_H);    // Прицел
    panel(UX(this, 990), PANEL_TOP, 250, PANEL_H);    // Эффекты
    panel(UX(this, 40), 483, 440, 221);               // Футёр слева: ИГРА
    panel(UX(this, 500), 483, 740, 221);              // Футёр справа: УПРАВЛЕНИЕ
    header(UX(this, CX1), 122, 'ЭКРАН');
    header(UX(this, CX2), 122, 'ЗВУК');
    header(UX(this, CX2), 332, 'ИГРОК');
    header(UX(this, CX3), 122, 'ПРИЦЕЛ');
    header(UX(this, CX4), 122, 'ЭФФЕКТЫ');
    header(UX(this, 260), 505, 'ИГРА');
    header(UX(this, 870), 505, 'УПРАВЛЕНИЕ');

    // Маленькая иконка i: шансы выпадения в кейсах.
    this._infoIcon = this.add.container(UX(this, 800), 66);
    const _ig = this.add.graphics();
    _ig.lineStyle(2, 0x8fb8ff, 1);
    _ig.strokeCircle(0, 0, 13);
    this._infoIcon.add(_ig);
    this._infoIcon.add(this.add.text(0, 0, 'i', {
      fontSize: '18px', color: '#8fb8ff', fontStyle: 'italic bold'
    }).setOrigin(0.5));
    this._infoIcon.setSize(34, 34);
    this._infoIcon.setInteractive({ useHandCursor: true });
    this._infoIcon.on('pointerdown', () => this._openRatesInfo());

    // --- Панель ЭКРАН: разрешение, кадры, синхронизация, FPS. ---
    const active = getScreenRes();
    this._selectButton(UX(this, CX1), 185, 'Разрешение экрана', RES_OPTIONS, active, (id) => {
      if (id === active) return;
      saveScreenRes(id);
      window.location.reload();
    });

    const fpsActive = getFpsCap();
    this._selectButton(UX(this, CX1), 265, 'Частота кадров', FPS_OPTIONS, fpsActive, (id) => {
      if (id === fpsActive) return;
      saveFpsCap(id);
      window.location.reload();
    });

    // Вертикальная синхронизация: lock цикла на 60. Применяется перезагрузкой.
    this._toggle(UX(this, CX1), 310, 'Синхронизация', getVsync, saveVsync, true);
    // Показ FPS в углу экрана (в матчах): без перезагрузки.
    this._toggle(UX(this, CX1), 350, 'Показ FPS', getShowFps, saveShowFps, false);
    // Замер FPS под нагрузкой (проверка настроек графики).
    this.createButton(UX(this, CX1), 400, 'ТЕСТ FPS', () => this.scene.start('BenchmarkScene'), 20);

    // --- Панель ЗВУК: музыка и звуки, шаг 10%, 0 = Выкл. ---
    this._volumeStepper(UX(this, CX2), 190, 'Музыка', 'musicVol');
    this._volumeStepper(UX(this, CX2), 280, 'Звуки', 'sfxVol');

    // --- Панель ИГРОК: ник + управление. ---
    {
      this._nickText = this.add.text(UX(this, CX2), 358, '', {
        fontSize: '20px', color: '#ffee88'
      }).setOrigin(0.5);
      const paintNick = () => {
        this._nickText.setText(`Ник: ${gameState.playerName}`);
        const nl = (gameState.playerName || '').length;
        this._nickText.setFontSize(nl <= 8 ? 20 : nl <= 12 ? 17 : 14);
      };
      paintNick();
      const nb = this.add.text(UX(this, CX2), 392, 'Изменить', {
        fontSize: '15px', color: '#ffffff', backgroundColor: '#443377', padding: 6
      }).setOrigin(0.5);
      nb.setInteractive({ useHandCursor: true });
      nb.on('pointerdown', () => {
        const value = window.prompt('Введите ник (до 16 символов):', gameState.playerName);
        if (value != null && value.trim()) {
          renamePlayer(value.trim().slice(0, 16));
          paintNick();
        }
      });
      nb.on('pointerover', () => nb.setStyle({ color: '#ffff55' }));
      nb.on('pointerout', () => nb.setStyle({ color: '#ffffff' }));
    }
    // Переназначение клавиш — в модалку (список действий).
    // Раскладка клавиш переехала в футёр «УПРАВЛЕНИЕ» (справа).

    // --- Панель ПРИЦЕЛ: живой предпросмотр + настройки. ---
    {
      const CX = UX(this, CX3);
      this._crossPrevX = CX;
      const crossPainters = [];
      const crossReset = this.add.text(UX(this, CX3 + 85), 122, 'Сброс', {
        fontSize: '12px', color: '#99aacc', backgroundColor: '#252560',
        padding: { left: 8, right: 8, top: 3, bottom: 3 }
      }).setOrigin(0.5);
      const pvBg = this.add.graphics();
      pvBg.fillStyle(0x0d0d2a, 1);
      pvBg.fillRoundedRect(CX - 75, 150, 150, 78, 8);
      pvBg.lineStyle(1, 0x4466aa, 1);
      pvBg.strokeRoundedRect(CX - 75, 150, 150, 78, 8);
      this._crossPrev = this.add.graphics();
      const paintCrossPreview = () => {
        try {
          const c = getCrosshair();
          const g = this._crossPrev;
          g.clear();
          g.setPosition(CX, 189);
          drawCrosshairFigure(g, c, c.size);
        } catch (e) {}
      };
      paintCrossPreview();
      this._paintCrossPreview = paintCrossPreview;
      const mkCross = (y, paint, next) => {
        const b = this.add.text(CX, y, '', {
          fontSize: '15px', color: '#ffffff', backgroundColor: '#252560',
          padding: { left: 12, right: 12, top: 5, bottom: 5 },
          fixedWidth: 210, align: 'center'
        }).setOrigin(0.5);
        paint(b);
        crossPainters.push(() => paint(b));
        b.setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => { next(); paint(b); paintCrossPreview(); });
        b.on('pointerover', () => b.setStyle({ color: '#ffff55' }));
        b.on('pointerout', () => b.setStyle({ color: '#ffffff' }));
      };
      mkCross(250, b => { b.setText(`Вид: ${crossLabel(getCrosshair().shape, CROSS_SHAPES)} ▸`); }, nextCrossShape);
      mkCross(280, b => { b.setText(`Цвет: ${crossLabel(getCrosshair().color, CROSS_COLORS)} ▸`); }, nextCrossColor);
      mkCross(310, b => { b.setText(`Размер: ${getCrosshair().size} ▸`); }, nextCrossSize);
      mkCross(340, b => { b.setText(`Толщина: ${getCrosshair().thick} ▸`); }, nextCrossThick);
      mkCross(370, b => { b.setText(`Лапки: ${crossArmsLabel(getCrosshair().arms)} ▸`); }, nextCrossArms);
      mkCross(400, b => { b.setText(`Точка: ${crossDotLabel(getCrosshair().dot)} ▸`); }, nextCrossDot);
      mkCross(430, b => { b.setText(`Прицел: ${getCrosshair().dynamic ? 'динам.' : 'статич.'} ▸`); }, () => setCrosshair({ dynamic: !getCrosshair().dynamic }));
      crossReset.setInteractive({ useHandCursor: true });
      crossReset.on('pointerdown', () => {
        setCrosshair(crossDefaults());
        crossPainters.forEach(p => { try { p(); } catch (e) {} });
        paintCrossPreview();
      });
      crossReset.on('pointerover', () => crossReset.setStyle({ color: '#ffff55' }));
      crossReset.on('pointerout', () => crossReset.setStyle({ color: '#99aacc' }));
    }

    // --- Панель ЭФФЕКТЫ: качество графики, тряска камеры, вибрация. ---
    const qActive = getQuality();
    this._selectButton(UX(this, CX4), 185, 'Качество графики', QUALITY_OPTIONS, qActive, (id) => {
      if (id === qActive) return;
      setQuality(id);
      window.location.reload();
    });
    this._toggle(UX(this, CX4), 235, 'Тряска камеры', getCamShake, setCamShake, false);
    this._toggle(UX(this, CX4), 275, 'Вибрация', getVibration, setVibration, false);
    // Схема управления и сброс клавиш переехали в футёр «УПРАВЛЕНИЕ».

    // --- Футёр «ИГРА» (слева): чит-код и сбросы. ---
    this.add.text(UX(this, 130), 548, 'Чит-код', {
      fontSize: '18px', color: '#aabbff'
    }).setOrigin(0.5);

    this.cheatMsg = this.add.text(UX(this, 260), 592, '', {
      fontSize: '13px', color: '#ffee88', wordWrap: { width: 380 }, align: 'center'
    }).setOrigin(0.5);

    this.cheatArming = false;
    this.cheatBuffer = '';
    this.createButton(UX(this, 330), 548, 'Ввести чит-код', () => {
      this.cheatArming = true;
      this.cheatBuffer = '';
      this.cheatMsg.setColor('#ffee88');
      this.cheatMsg.setText('Вводи код с клавиатуры, Enter — готово');
    }, 16, { left: 16, right: 16, top: 8, bottom: 8 });

    this.createButton(UX(this, 155), 650, 'Сбросить кампанию', () => {
      if (!this.campResetPending) {
        this.campResetPending = true;
        this.campResetBtn.setText('Точно? Жми ещё раз');
        this.campResetBtn.setStyle({ color: '#ff5555', backgroundColor: '#553322' });
        return;
      }
      resetCampaign();
      this.scene.start('MenuScene');
    }, 14, { left: 12, right: 12, top: 8, bottom: 8 });

    this.createButton(UX(this, 365), 650, 'Сбросить прогресс', () => {
      if (!this.resetPending) {
        this.resetPending = true;
        this.resetBtn.setText('Точно? Жми ещё раз');
        this.resetBtn.setStyle({ color: '#ff5555', backgroundColor: '#553322' });
        return;
      }
      resetProgress();
      this.scene.start('MenuScene');
    }, 14, { left: 12, right: 12, top: 8, bottom: 8 });

    // --- Футёр «УПРАВЛЕНИЕ» (справа): схема управления, раскладка и сброс клавиш в один ряд. ---
    const schemeActive = getControlScheme();
    this._selectButton(UX(this, 650), 600, 'Схема управления', CONTROL_SCHEMES, schemeActive, (id) => {
      if (id === schemeActive) return;
      setControlScheme(id);
    });

    this.createButton(UX(this, 885), 600, 'РАСКЛАДКА КЛАВИШ', () => this._openKeyModal(), 17, {
      left: 16, right: 16, top: 9, bottom: 9
    });

    this.createButton(UX(this, 1115), 600, 'Сброс клавиш', () => {
      resetKeys();
      this._toast('Клавиши сброшены');
      if (this._keyModal) this._keyModal.repaint();
    }, 17, {
      left: 16, right: 16, top: 9, bottom: 9
    });

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

    this.createButton(UX(this, 90), 40, '← Назад', () => {
      this.scene.start('MenuScene');
    });

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

  // Тумблер «вкл/выкл». reload=true — применить перезагрузкой страницы.
  _toggle(x, y, label, get, set, reload) {
    const b = this.add.text(x, y, '', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#252560',
      padding: { left: 18, right: 18, top: 7, bottom: 7 }
    }).setOrigin(0.5);
    const paint = () => b.setText(`${label}: ${get() ? 'вкл' : 'выкл'}`);
    paint();
    b.setInteractive({ useHandCursor: true });
    b.on('pointerdown', () => {
      set(!get());
      paint();
      if (reload) window.location.reload();
    });
    b.on('pointerover', () => b.setStyle({ color: '#ffff55' }));
    b.on('pointerout', () => b.setStyle({ color: '#ffffff' }));
    return b;
  }

  // Короткий тост в центре экрана (для «Клавиши сброшены» и т.п.).
  _toast(text) {
    if (this._toastObj) { try { this._toastObj.destroy(); } catch (e) {} }
    const t = this.add.text(gameW(this) / 2, 250, text, {
      fontSize: '18px', color: '#ffee88', backgroundColor: '#111133cc', padding: 8
    }).setOrigin(0.5).setDepth(250);
    this._toastObj = t;
    this.tweens.add({
      targets: t, alpha: 0, duration: 600, delay: 1600,
      onComplete: () => { try { if (this._toastObj === t) this._toastObj = null; t.destroy(); } catch (e) {} }
    });
  }

  // Модалка переназначения клавиш: два столбца по 5 действий.
  _openKeyModal() {
    if (this._keyModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const W = 900, H = 560;
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(300);
    overlay.setInteractive();
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(301)
      .setStrokeStyle(2, 0x8fb8ff, 1);
    elems.push(overlay, bg);
    elems.push(this.add.text(cx, 110, 'УПРАВЛЕНИЕ', {
      fontSize: '24px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));
    elems.push(this.add.text(cx, 148, 'Нажми на клавишу, чтобы переназначить · Esc — отмена', {
      fontSize: '13px', color: '#99aacc'
    }).setOrigin(0.5).setDepth(302));

    const rowY = [190, 250, 310, 370, 430];
    const labelX = [240, 700];
    const btnX = [560, 1000];
    const keyBtns = [];
    KEY_ACTIONS.forEach((a, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i % 5;
      const y = rowY[row];
      elems.push(this.add.text(labelX[col], y, a.label, {
        fontSize: '15px', color: '#ffffff'
      }).setOrigin(0, 0.5).setDepth(302));
      const b = this.add.text(btnX[col], y, '', {
        fontSize: '15px', color: '#ffee88', backgroundColor: '#252560',
        padding: { left: 12, right: 12, top: 6, bottom: 6 }, fixedWidth: 130, align: 'center'
      }).setOrigin(0.5).setDepth(302);
      elems.push(b);
      const paint = () => { b.setText(keyName(getKeyCode(a.id))); };
      paint();
      keyBtns.push({ action: a.id, b, paint });
      b.setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => this._captureKey(keyBtns, a.id));
      b.on('pointerover', () => { if (!b._listening) b.setStyle({ color: '#ffff55' }); });
      b.on('pointerout', () => { if (!b._listening) b.setStyle({ color: '#ffee88' }); });
    });

    const resetBtn = this.add.text(cx, 490, 'СБРОСИТЬ ВСЕ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#443377', padding: 8
    }).setOrigin(0.5).setDepth(302);
    elems.push(resetBtn);
    resetBtn.setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => {
      resetKeys();
      keyBtns.forEach(k => { try { k.paint(); } catch (e) {} });
    });
    resetBtn.on('pointerover', () => resetBtn.setStyle({ color: '#ffff55' }));
    resetBtn.on('pointerout', () => resetBtn.setStyle({ color: '#ffffff' }));

    const closeBtn = this.add.text(cx, 545, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(302);
    elems.push(closeBtn);

    const close = () => {
      // Снять незавершённый захват клавиши, иначе он сработает позже.
      try {
        if (this._keyCaptureHandler) this.input.keyboard.off('keydown', this._keyCaptureHandler);
      } catch (e) {}
      this._keyCaptureHandler = null;
      elems.forEach(o => { try { o.destroy(); } catch (e) {} });
      this._keyModal = null;
    };
    closeBtn.on('pointerdown', close);
    overlay.on('pointerdown', close);
    this._keyModal = {
      repaint: () => keyBtns.forEach(k => { try { k.paint(); } catch (e) {} }),
      close
    };
  }

  // Захват следующей нажатой клавиши для действия.
  _captureKey(keyBtns, action) {
    // Предыдущий незавершённый захват — снять (кликнули другую клавишу).
    try {
      if (this._keyCaptureHandler) this.input.keyboard.off('keydown', this._keyCaptureHandler);
    } catch (e) {}
    this._keyCaptureHandler = null;
    keyBtns.forEach(k => {
      if (k.action === action) {
        k.b._listening = true;
        k.b.setText('...');
        k.b.setStyle({ color: '#ffff55' });
      } else if (k.b._listening) {
        k.b._listening = false;
        k.paint();
        k.b.setStyle({ color: '#ffee88' });
      }
    });
    const done = () => {
      this._keyCaptureHandler = null;
      keyBtns.forEach(k => {
        k.b._listening = false;
        try { k.paint(); } catch (e) {}
        k.b.setStyle({ color: '#ffee88' });
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
    this.add.text(cx, y - 34, label, {
      fontSize: '19px', color: '#aabbff'
    }).setOrigin(0.5);
    const val = this.add.text(cx, y, '', {
      fontSize: '24px', color: '#ffee88', fontStyle: 'bold',
      fixedWidth: 110, align: 'center'
    }).setOrigin(0.5);
    const getV = () => (key === 'musicVol' ? musicVol() : sfxVol());
    const paint = () => val.setText(volLabel(getV()));
    paint();
    const mk = (x, t, d) => {
      const b = this.add.text(x, y, t, {
        fontSize: '26px', color: '#ffffff', backgroundColor: '#252560',
        padding: { left: 22, right: 22, top: 4, bottom: 4 }
      }).setOrigin(0.5);
      b.setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => {
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
      b.on('pointerover', () => b.setStyle({ color: '#ffff55' }));
      b.on('pointerout', () => b.setStyle({ color: '#ffffff' }));
    };
    mk(cx - 95, '−', -0.1);
    mk(cx + 95, '+', +0.1);
  }

  // Инфо-панель шансов кейсов.
  _openRatesInfo() {
    if (this._ratesModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    const bg = this.add.rectangle(cx, cy, 420, 360, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0x8fb8ff, 1);
    elems.push(overlay, bg);
    const title = this.add.text(cx, cy - 140, 'ШАНСЫ КЕЙСОВ', {
      fontSize: '22px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202);
    elems.push(title);
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
      const y = cy - 96 + i * 32;
      elems.push(this.add.text(cx - 170, y, r[0], {
        fontSize: '16px', color: '#dddddd'
      }).setOrigin(0, 0.5).setDepth(202));
      elems.push(this.add.text(cx + 170, y, r[1], {
        fontSize: '16px', color: r[2], fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(202));
    });
    const closeBtn = this.add.text(cx, cy + 130, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(closeBtn);
    elems.push(this.add.text(cx, cy + 160, 'У кейса скинов: легендарное 8%, эпическое 10%', {
      fontSize: '12px', color: '#ffd24a'
    }).setOrigin(0.5).setDepth(202));
    closeBtn.setInteractive({ useHandCursor: true });
    const close = () => {
      elems.forEach(o => { try { o.destroy(); } catch (e) {} });
      this._ratesModal = null;
    };
    closeBtn.on('pointerdown', close);
    overlay.setInteractive();
    overlay.on('pointerdown', close);
    this._ratesModal = { elems, close };
  }

  // Кнопка-селектор: подпись сверху, значение кнопкой. Список — в модалке,
  // поэтому раскрытие НИКОГДА не налезает на соседние контролы.
  _selectButton(x, y, label, options, currentId, onSelect) {
    this.add.text(x, y - 32, label, {
      fontSize: '16px', color: '#aabbff'
    }).setOrigin(0.5);
    const b = this.add.text(x, y, '', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#252560',
      padding: { left: 14, right: 14, top: 7, bottom: 7 }
    }).setOrigin(0.5);
    const paint = () => {
      const o = options.find(v => v.id === currentId) || options[0];
      b.setText(`${o.label}  ▾`);
    };
    paint();
    b.setInteractive({ useHandCursor: true });
    b.on('pointerdown', () => {
      this._openSelectModal(label, options, currentId, (id) => {
        currentId = id;
        paint();
        onSelect(id);
      });
    });
    b.on('pointerover', () => b.setStyle({ color: '#ffff55' }));
    b.on('pointerout', () => b.setStyle({ color: '#ffffff' }));
    return b;
  }

  // Модалка выбора из списка (разрешение/кадры/качество). Центр экрана,
  // поверх всего — ничего не перекрывает постоянно.
  _openSelectModal(title, options, currentId, onSelect) {
    if (this._selectModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(280);
    overlay.setInteractive();
    const W = 360, H = 110 + options.length * 46;
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(281)
      .setStrokeStyle(2, 0x8fb8ff, 1);
    elems.push(overlay, bg);
    elems.push(this.add.text(cx, cy - H / 2 + 24, title, {
      fontSize: '20px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(282));
    options.forEach((o, i) => {
      const y = cy - H / 2 + 24 + 30 + i * 46;
      const row = this.add.text(cx, y, '', {
        fontSize: '18px', color: '#ffffff', backgroundColor: '#1f1f4a',
        padding: { left: 18, right: 18, top: 7, bottom: 7 }
      }).setOrigin(0.5).setDepth(282);
      row.setText((o.id === currentId ? '✓ ' : '') + o.label);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setStyle({ color: '#ffff55' }));
      row.on('pointerout', () => row.setStyle({ color: '#ffffff' }));
      row.on('pointerdown', () => { close(); onSelect(o.id); });
      elems.push(row);
    });
    const close = () => {
      elems.forEach(e => { try { e.destroy(); } catch (e) {} });
      this._selectModal = null;
    };
    overlay.on('pointerdown', close);
    this._selectModal = { close };
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

  createButton(x, y, label, callback, fontSize, padding) {
    const pad = padding || {
      left: 20,
      right: 20,
      top: 10,
      bottom: 10
    };
    const button = this.add.text(x, y, label, {
      fontSize: (fontSize || 22) + 'px',
      color: '#ffffff',
      backgroundColor: '#252560',
      padding: pad
    }).setOrigin(0.5);

    button.setInteractive({ useHandCursor: true });

    if (label.indexOf('Сбросить прогресс') === 0) {
      this.resetBtn = button;
    } else if (label.indexOf('Сбросить кампанию') === 0) {
      this.campResetBtn = button;
    }

    button.on('pointerdown', callback);
    button.on('pointerover', () => button.setStyle({ color: '#ffff55' }));
    button.on('pointerout', () => {
      if (this.resetPending && button === this.resetBtn) {
        button.setStyle({ color: '#ff5555', backgroundColor: '#553322' });
      } else if (this.campResetPending && button === this.campResetBtn) {
        button.setStyle({ color: '#ff5555', backgroundColor: '#553322' });
      } else {
        button.setStyle({ color: '#ffffff' });
      }
    });
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
            g.setPosition(this._crossPrevX || 840, 189);
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
