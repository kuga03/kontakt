import { gameState, saveGameState, syncGameState, mostPlayedClass, getEquipment } from '../data/gameState.js';
import { classDefinitions } from '../data/weapons.js';
import { campaignLevels } from '../data/levels.js';
import { skillPoints } from '../data/skills.js';
import { genePoints } from '../data/genes.js';
import { completedAchievements } from '../data/achievements.js';
import { turfTick } from '../data/gang.js';
import { isWeekend, eventMutatorDef, nextWeekendStart, fmtCountdown } from '../data/mutators.js';
import Assault from '../entities/Assault.js';
import Tank from '../entities/Tank.js';
import Medic from '../entities/Medic.js';
import Sniper from '../entities/Sniper.js';
import { gameW, UX } from '../ui/layout.js';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

// Версия игры (бета, не выпущена).
export const GAME_VERSION = 'Beta v0.21';

// Баттл-пасс «Контракты» живёт в data/pass.js (40 ярусов × 2 ряда,
// сезон 30 дней, задания строго по порядку).
let passScrollX = 0;

// Открытая секция центра («single» — режимы, «online» — лобби онлайна).
let openSection = 'single';

import * as Contracts from './menu/contracts.js';
import * as Daily from './menu/daily.js';
import * as History from './menu/history.js';
import * as Showcase from './menu/showcase.js';
import * as Widgets from './menu/widgets.js';
import * as News from './menu/news.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this._showPreviewNext = 0;
    this._contractsStripNext = 0;
  }

  create() {
    syncGameState();
    const _cx = gameW(this) / 2;
    this.cameras.main.setBackgroundColor('#080a14');
    this._dailyModal = null;

    // Фоновая музыка меню: трек mus_menu играет по кругу.
    this._musStarted = false;
    const musPlaying = () => {
      try {
        if (!this.sound || !this.sound.getAllPlaying) return false;
        return this.sound.getAllPlaying().some(s => s && s.key === 'mus_menu' && s.isPlaying);
      } catch (e) { return false; }
    };
    const startMus = () => {
      try {
        if (this._musStarted || musPlaying()) return;
        if (this.sound.play('mus_menu', { loop: true, volume: 0.32 })) {
          this._musStarted = true;
          try { this.input.off('pointerdown', startMus); } catch (e) {}
        }
      } catch (e) { /* без звука игра не встанет */ }
    };
    try {
      if (this.sound) {
        if (!musPlaying()) this.sound.stopAll();
        startMus();
        this.input.on('pointerdown', startMus);
        if (this.sound.locked && Phaser.Sound && Phaser.Sound.Events) {
          this.sound.once(Phaser.Sound.Events.UNLOCKED, startMus);
        }
      }
    } catch (e) { /* noop */ }

    // Параллакс-фон
    this.bg = null;
    if (this.textures.exists('fon_menu')) {
      const src = this.textures.get('fon_menu').getSourceImage();
      const ratio = src.height / src.width;
      const bgW = Math.max(1280 * 1.15, gameW(this) + 64);
      const bgH = Math.round(bgW * ratio);
      this.bg = this.add.image(_cx, 720 - bgH / 2, 'fon_menu');
      this.bg.setDisplaySize(bgW, bgH);
      this.bg.setAlpha(0.35);
      this.bg.setDepth(-1);
    }

    // Верхняя статусная панель (монеты, опыт, уровень, профиль, настройки)
    this.createTopBar();

    // Логотип игры
    const logoG = this.add.graphics();
    logoG.fillStyle(0xd8a920, 0.9);
    logoG.fillRoundedRect(_cx - 90, 88, 180, 2, 1);
    logoG.fillCircle(_cx, 89, 4);

    this.add.text(_cx, 68, 'К О Н Т А К Т', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(_cx, 97, 'ТАКТИЧЕСКИЙ ШУТЕР', {
      fontSize: '10px',
      color: '#ffd24a',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hasPoints = skillPoints() > 0;
    const hasGenePoints = genePoints() > 0;
    if (hasGenePoints && !gameState.geneUnlocked) {
      gameState.geneUnlocked = true;
      saveGameState();
    }
    const genomeLocked = !gameState.geneUnlocked;
    const campaignTotal = campaignLevels.length;
    const campaignDone = gameState.campaignLevel > campaignTotal;
    const cheatUnlock = !!gameState.cheatAllUnlocked;
    const campaignLabel = campaignDone
      ? 'КАМПАНИЯ ✓'
      : `КАМПАНИЯ — УР. ${gameState.campaignLevel}`;

    const trialLocked = gameState.level < 2 && !cheatUnlock;
    const ffaLocked = gameState.level < 5 && !cheatUnlock;

    // Левое крыло: Арсенал
    const leftBtns = [
      { label: 'СНАРЯЖЕНИЕ', icon: 'cart', cb: () => this.scene.start('ShopScene') },
      { label: 'ИНВЕНТАРЬ', icon: 'backpack', cb: () => this.scene.start('InventoryScene') },
      { label: 'БОЕВАЯ ПОДГОТОВКА', icon: 'star', cb: () => this.scene.start('SkillsScene'), glow: hasPoints },
      { label: 'ГЕНОМ', icon: 'dna', cb: () => this.scene.start('GenomeScene'), glow: hasGenePoints, locked: genomeLocked },
      { label: 'КЕЙСЫ', icon: 'case', cb: () => this.scene.start('LootBoxScene') }
    ];

    // Центр: Режимы
    const centerSubs = [
      { label: campaignLabel, icon: 'flag', cb: () => this.scene.start('LobbyScene', { mode: 'CAMPAIGN' }) },
      { label: 'ВЫЖИВАНИЕ', icon: 'skull', cb: () => this.scene.start('GameScene', { mode: 'TRIAL' }), locked: trialLocked, lockMsg: trialLocked ? 'ур. 2' : null },
      { label: 'СВОБОДНАЯ ИГРА', icon: 'swords', cb: () => this.scene.start('LobbyScene', { mode: 'FFA' }), locked: ffaLocked, lockMsg: ffaLocked ? 'ур. 5' : null }
    ];

    const onlineSubs = [
      { label: 'РЕЙТИНГ', icon: 'medal' },
      { label: 'БЫСТРЫЙ БОЙ', icon: 'bolt' },
      { label: 'ВЫБРАТЬ МАТЧ', icon: 'list' }
    ];

    // Правое крыло: Штаб и Операции
    const evDef = eventMutatorDef();
    const evLocked = !cheatUnlock;

    const rightBtns = [
      {
        label: 'ИВЕНТ', icon: 'event', glow: false, pulse: false,
        locked: evLocked, lockMsg: evLocked ? 'СКОРО' : null,
        cb: () => {
          const cls = (gameState.lastClass && ['Assault', 'Tank', 'Medic', 'Sniper'].includes(gameState.lastClass)) ? gameState.lastClass : 'Assault';
          this.scene.start('GameScene', {
            mode: 'TDM', mutators: [evDef.id],
            selectedClass: cls, playerName: gameState.playerName,
            scoreLimit: gameState.scoreLimit
          });
        }
      },
      { label: 'ДРУЗЬЯ И КЛАН', icon: 'friends', locked: !cheatUnlock, lockMsg: cheatUnlock ? null : 'СКОРО', cb: () => this.scene.start('FriendsScene', { view: 'friends' }) },
      { label: 'РАЙОНЫ', icon: 'gang', locked: !campaignDone && !cheatUnlock, lockMsg: (campaignDone || cheatUnlock) ? null : 'Разблокирует после компании', cb: () => this.scene.start('GangScene') }
    ];
    try { turfTick(); } catch (e) {}

    // Координаты симметричной 3-блочной схемы
    const COL_LEFT = UX(this, 185);
    const COL_CENTER = _cx;
    const COL_RIGHT = UX(this, 1095);

    const PANEL_TOP = 118;
    const PANEL_W = 250;
    const PANEL_H = 494;

    // Панель левого крыла: «АРСЕНАЛ»
    this._panel(COL_LEFT, PANEL_TOP, PANEL_W, PANEL_H, 'АРСЕНАЛ');

    // Кнопки Арсенала
    const btnW = 222;
    const btnH = 44;
    const btnGap = 52;
    const START_BTN_Y = PANEL_TOP + 68;

    leftBtns.forEach((item, i) => {
      const by = START_BTN_Y + i * btnGap;
      const btn = this.createButton(COL_LEFT, by, item.label, item.cb, item.locked, item.lockMsg, btnW, btnH, 16, item.icon);
      if (item.glow && btn && btn._btnTxt) {
        btn._btnTxt.setColor('#ffdd44');
        if (btn._paintIcon) btn._paintIcon(0xffdd44);
        this.tweens.add({
          targets: btn,
          scale: { from: 1, to: 1.06 },
          yoyo: true,
          repeat: -1,
          duration: 900,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // Карточка экипировки под кнопками Арсенала
    const pCls = mostPlayedClass();
    const pCd = classDefinitions.find(v => v.id === pCls) || classDefinitions[0];
    const pEq = getEquipment(pCls);
    const gunName = (pEq && pEq.primary) || 'АК-47';

    const eqCardY = START_BTN_Y + 5 * btnGap + 14;
    const eqCard = this.add.graphics();
    eqCard.fillStyle(0x101526, 0.92);
    eqCard.fillRoundedRect(COL_LEFT - btnW / 2, eqCardY - 26, btnW, 52, 8);
    eqCard.lineStyle(1, 0x3a4868, 0.85);
    eqCard.strokeRoundedRect(COL_LEFT - btnW / 2, eqCardY - 26, btnW, 52, 8);

    this.add.text(COL_LEFT, eqCardY - 11, `${pCd.label.toUpperCase()} · ${gunName.toUpperCase()}`, {
      fontSize: '11px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(COL_LEFT, eqCardY + 11, 'БОЕКОМПЛЕКТ ГОТОВ К БОЮ', {
      fontSize: '10px', color: '#8fb8ff'
    }).setOrigin(0.5);

    // Панель правого крыла: «ШТАБ»
    this._panel(COL_RIGHT, PANEL_TOP, PANEL_W, PANEL_H, 'ШТАБ');

    // Кнопки Штаба
    rightBtns.forEach((item, i) => {
      const by = START_BTN_Y + i * btnGap;
      const btn = this.createButton(COL_RIGHT, by, item.label, item.cb, item.locked, item.lockMsg, btnW, btnH, 16, item.icon);
      if (item.glow && btn && btn._btnTxt) {
        btn._btnTxt.setColor('#ffdd44');
        if (btn._paintIcon) btn._paintIcon(0xffdd44);
      }
      if (item.pulse && btn && !item.locked) {
        this.tweens.add({
          targets: btn,
          scale: { from: 1, to: 1.05 },
          yoyo: true,
          repeat: -1,
          duration: 900,
          ease: 'Sine.easeInOut'
        });
      }
      if (item.overlayLockMsg && btn && item.locked) {
        const t = this.add.text(0, 0, item.overlayLockMsg, {
          fontSize: '13px',
          color: '#ffee88',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
          wordWrap: { width: btnW - 12 }
        }).setOrigin(0.5);
        btn.add(t);
        t.setDepth(100);
      }
    });

    // Карточка ежедневного подарка в правом крыле
    this.createDailyGift(COL_RIGHT, START_BTN_Y + 3 * btnGap + 18, 52);

    // Сводка клана и серии входа в правом крыле
    const clanCardY = START_BTN_Y + 4 * btnGap + 38;
    const clanCard = this.add.graphics();
    clanCard.fillStyle(0x101526, 0.92);
    clanCard.fillRoundedRect(COL_RIGHT - btnW / 2, clanCardY - 24, btnW, 50, 8);
    clanCard.lineStyle(1, 0x3a4868, 0.85);
    clanCard.strokeRoundedRect(COL_RIGHT - btnW / 2, clanCardY - 24, btnW, 50, 8);

    if (gameState.clan && gameState.clan.tag) {
      const clanLine1 = `КЛАН: [${gameState.clan.tag}] ${gameState.clan.name || ''}`;
      this.add.text(COL_RIGHT, clanCardY - 10, clanLine1, {
        fontSize: '11px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    this.add.text(COL_RIGHT, clanCardY + 10, `🔥 СЕРИЯ ВХОДОВ В ИГРУ: ${gameState.dailyStreak | 0} ДН.`, {
      fontSize: '10px', color: '#c4d4f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Центральная витрина героя на голографическом пьедестале
    this.createShowcase(COL_CENTER, 360, 280);

    // Центральный тактический хаб режимов «В БОЙ»
    this._openSection = openSection;
    this.buildCenterPanel({
      cx: COL_CENTER,
      top: 440,
      w: 460,
      singleSubs: centerSubs,
      onlineSubs: onlineSubs
    });

    // Контракты (Баттл-пасс) по нижнему краю по центру
    this.createContractsRow();

    // Мои уровни (Новости переехали в верхнюю панель на место Доната)
    try { this._donutLevels(UX(this, 1165), 648); } catch (e) {}

    // Тост достижений
    const unclaimed = completedAchievements().filter(a => !(gameState.achievements || []).includes(a.id));
    if (unclaimed.length) this._toastAchReady(unclaimed.length);

    // Версия игры
    this.add.text(UX(this, 16), 706, GAME_VERSION, {
      fontSize: '13px',
      color: '#667788'
    }).setOrigin(0, 1);
  }

  _panel(cx, top, w, h, title) { return Widgets._panel.call(this, cx, top, w, h, title); }
  dailyRewardFor(streak) { return Daily.dailyRewardFor.call(this, streak); }
  dailyMonthKey(now) { return Daily.dailyMonthKey.call(this, now); }
  dailyAvailable() { return Daily.dailyAvailable.call(this); }
  _dailyLabel() { return Daily._dailyLabel.call(this); }
  claimDaily() { return Daily.claimDaily.call(this); }
  _flyCoinsToTop(fromX, fromY, amount, done) { return Daily._flyCoinsToTop.call(this, fromX, fromY, amount, done); }
  _countUpCoins(amount, done) { return Daily._countUpCoins.call(this, amount, done); }
  createDailyGift(x, y, size) { return Daily.createDailyGift.call(this, x, y, size); }
  _openDailyModal() { return Daily._openDailyModal.call(this); }
  _openNewsModal() { return News._openNewsModal.call(this); }
  _closeNewsModal() { return News._closeNewsModal.call(this); }
  createShowcase(cx, w, badgeMaxW) { return Showcase.createShowcase.call(this, cx, w, badgeMaxW); }
  createTopBar() { return Showcase.createTopBar.call(this); }
  createHistoryIcon(x, y) { return History.createHistoryIcon.call(this, x, y); }
  _openHistoryModal() { return History._openHistoryModal.call(this); }
  _closeHistoryModal() { return History._closeHistoryModal.call(this); }
  _openMatchModal(m) { return History._openMatchModal.call(this, m); }
  _closeMatchModal() { return History._closeMatchModal.call(this); }
  createAchIcon(x, y) { return History.createAchIcon.call(this, x, y); }
  createContractsRow() { return Contracts.createContractsRow.call(this); }
  _refreshContractsGlow() { return Contracts._refreshContractsGlow.call(this); }
  _closeContracts() { return Contracts._closeContracts.call(this); }
  _openContracts() { return Contracts._openContracts.call(this); }
  _passCellArt(gr, ps, track, i, cx, rowY, CW, CH) { return Contracts._passCellArt.call(this, gr, ps, track, i, cx, rowY, CW, CH); }
  _passCellLive(strip, ps, track, i, cx, rowY, CW, CH, viewL, viewR) { return Contracts._passCellLive.call(this, strip, ps, track, i, cx, rowY, CW, CH, viewL, viewR); }
  _passMissionArt(gr, ps, i, cx, midY, CW, midH) { return Contracts._passMissionArt.call(this, gr, ps, i, cx, midY, CW, midH); }
  _passMissionLive(strip, ps, i, cx, midY, CW, midH) { return Contracts._passMissionLive.call(this, strip, ps, i, cx, midY, CW, midH); }
  _toastAchReady(n) { return Widgets._toastAchReady.call(this, n); }
  _openStatsModal() { return Widgets._openStatsModal.call(this); }
  _closeStatsModal() { return Widgets._closeStatsModal.call(this); }

  // Центральный тактический хаб развертывания («В БОЙ»)
  buildCenterPanel(o) {
    (this._centerElems || []).forEach(e => { try { e.destroy(); } catch (e2) {} });
    this._centerElems = [];
    const track = this._centerElems;
    const cx = o.cx;
    const top = o.top;
    const w = o.w;
    const h = 192;
    const open = this._openSection || 'single';

    // Фоновая панель центрального хаба
    const g = this.add.graphics();
    g.fillStyle(0x090c16, 0.94);
    g.fillRoundedRect(cx - w / 2, top, w, h, 12);
    g.lineStyle(1.5, 0x8a6a10, 0.85);
    g.strokeRoundedRect(cx - w / 2, top, w, h, 12);

    // Угловые золотые риски
    const cLen = 12;
    g.lineStyle(2, 0xd8a920, 0.9);
    g.lineBetween(cx - w / 2, top + cLen, cx - w / 2, top + 5);
    g.lineBetween(cx - w / 2 + 5, top, cx - w / 2 + cLen, top);
    g.lineBetween(cx + w / 2 - cLen, top, cx + w / 2 - 5, top);
    g.lineBetween(cx + w / 2, top + 5, cx + w / 2, top + cLen);
    track.push(g);

    // Вкладки режимов: [ ОДИНОЧНАЯ ИГРА ] | [ СЕТЕВАЯ ИГРА ]
    const tabY = top + 26;
    const tabW = Math.round(w / 2 - 14);
    const tabH = 42;

    const createTab = (tabId, label, tabX) => {
      const active = open === tabId;
      const isSingle = tabId === 'single';
      const tg = this.add.graphics();

      if (active) {
        // Активная вкладка: насыщенный тёмно-янтарный фон с золотой рамкой
        tg.fillStyle(0x1e1608, 0.98);
        tg.fillRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 8);
        // Верхний блик
        tg.fillStyle(0xffd24a, 0.1);
        tg.fillRoundedRect(tabX - tabW / 2 + 2, tabY - tabH / 2 + 2, tabW - 4, Math.floor(tabH / 2) - 2, { tl: 6, tr: 6, bl: 0, br: 0 });
        // Левая акцентная полоска
        tg.fillStyle(0xffd24a, 1);
        tg.fillRoundedRect(tabX - tabW / 2 + 3, tabY - tabH / 2 + 5, 3, tabH - 10, 1.5);
        // Рамка
        tg.lineStyle(1.8, 0xffd24a, 0.95);
        tg.strokeRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 8);
        // Золотая полоска снизу (индикатор активной вкладки)
        tg.fillStyle(0xffd24a, 1);
        tg.fillRoundedRect(tabX - tabW / 2 + 10, tabY + tabH / 2 - 3, tabW - 20, 3, 1.5);
        // Угловые засечки
        tg.lineStyle(2, 0xffea77, 1);
        const cL = 7;
        tg.lineBetween(tabX + tabW / 2 - cL, tabY + tabH / 2, tabX + tabW / 2 - 2, tabY + tabH / 2);
        tg.lineBetween(tabX + tabW / 2, tabY + tabH / 2 - cL, tabX + tabW / 2, tabY + tabH / 2 - 2);
      } else {
        // Неактивная вкладка: приглушённый фон
        tg.fillStyle(0x0e1120, 0.92);
        tg.fillRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 8);
        tg.lineStyle(1, 0x2a3550, 1);
        tg.strokeRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 8);
      }

      // --- Иконка ---
      const iconX = tabX - tabW / 2 + 22;
      const iconY = tabY;
      const ic = tg; // рисуем прямо в tg — нет children, нет проблем с bounds

      if (isSingle) {
        // Скрещённые мечи (compact, вписан в ~14×14px)
        const col = active ? 0xffe066 : 0x5a6e94;
        const hi  = active ? 0xfff4a0 : 0x8fb8ff;
        const acc = active ? 0xff6644 : 0x3a4a68;
        // Сечение лезвия — два треугольника крест-накрест
        const S = 7; // полуразмах
        ic.fillStyle(active ? 0xd0e8ff : 0x3a4e70, 1);
        ic.beginPath();
        ic.moveTo(iconX - S,     iconY - S);
        ic.lineTo(iconX - S + 2, iconY - S);
        ic.lineTo(iconX + S,     iconY + S);
        ic.lineTo(iconX + S - 2, iconY + S);
        ic.closePath(); ic.fillPath();
        ic.beginPath();
        ic.moveTo(iconX + S,     iconY - S);
        ic.lineTo(iconX + S - 2, iconY - S);
        ic.lineTo(iconX - S,     iconY + S);
        ic.lineTo(iconX - S + 2, iconY + S);
        ic.closePath(); ic.fillPath();
        // Блик на лезвиях
        ic.fillStyle(hi, active ? 0.6 : 0.25);
        ic.fillRect(iconX - S + 0.5, iconY - S + 0.5, 1, S * 2 - 1);
        ic.fillRect(iconX + S - 1.5, iconY - S + 0.5, 1, S * 2 - 1);
        // Гарды
        ic.lineStyle(active ? 2.2 : 1.6, col, 1);
        ic.lineBetween(iconX - S + 1, iconY - 2.5, iconX - 2.5, iconY - S + 1);
        ic.lineBetween(iconX + S - 1, iconY - 2.5, iconX + 2.5, iconY - S + 1);
        // Рукояти
        ic.lineStyle(active ? 2.4 : 1.8, acc, 1);
        ic.lineBetween(iconX - S - 1, iconY - S - 1, iconX - S + 3, iconY - S + 3);
        ic.lineBetween(iconX + S + 1, iconY - S - 1, iconX + S - 3, iconY - S + 3);
        // Центральная искра
        ic.fillStyle(hi, active ? 0.95 : 0.4);
        ic.fillCircle(iconX, iconY, active ? 2.2 : 1.4);
        ic.fillStyle(acc, active ? 0.9 : 0.3);
        ic.fillCircle(iconX, iconY, active ? 1.1 : 0.7);
      } else {
        // Глобус: окружность + меридиан + параллель + онлайн-точка
        const col = active ? 0xffe066 : 0x5a6e94;
        const hi  = active ? 0xfff4a0 : 0x8fb8ff;
        const acc = active ? 0x46ffb0 : 0x2a6a50;
        const R2  = 7;
        ic.fillStyle(active ? 0x0d2a44 : 0x0a1828, 1);
        ic.fillCircle(iconX, iconY, R2);
        ic.lineStyle(active ? 1.8 : 1.2, col, active ? 0.95 : 0.6);
        ic.strokeCircle(iconX, iconY, R2);
        // Вертикальный меридиан (эллипс)
        ic.lineStyle(active ? 1.3 : 1, col, active ? 0.7 : 0.4);
        ic.strokeEllipse(iconX, iconY, R2 * 0.85, R2 * 2);
        // Горизонтальная параллель (экватор)
        ic.lineBetween(iconX - R2, iconY, iconX + R2, iconY);
        // Верхняя параллель (дуга)
        ic.beginPath();
        ic.arc(iconX, iconY - 2.8, R2 - 0.5, 0.18 * Math.PI, 0.82 * Math.PI, false);
        ic.strokePath();
        // Онлайн-точка (правый верх)
        ic.fillStyle(acc, active ? 1 : 0.5);
        ic.fillCircle(iconX + 5.2, iconY - 5, 2);
        ic.fillStyle(hi, active ? 0.9 : 0.3);
        ic.fillCircle(iconX + 4.8, iconY - 5.4, 0.7);
      }

      // Метка
      const labelX = iconX + 14;
      const tt = this.add.text(labelX, tabY, label, {
        fontSize: active ? '13px' : '12px',
        color: active ? '#ffd24a' : '#6a7ea8',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      // Подгоняем текст под доступную ширину
      const maxLabelW = tabX + tabW / 2 - 8 - labelX;
      if (tt.displayWidth > maxLabelW && tt.displayWidth > 0) {
        tt.scaleX *= (maxLabelW / tt.displayWidth);
      }

      const hit = this.add.zone(tabX, tabY, tabW, tabH).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this._openSection = tabId;
        openSection = tabId;
        this.buildCenterPanel(o);
      });
      hit.on('pointerover', () => {
        if (!active) tt.setColor('#c8d8f8');
      });
      hit.on('pointerout', () => {
        if (!active) tt.setColor('#6a7ea8');
      });
      track.push(tg, tt, hit);
    };

    createTab('single', 'ОДИНОЧНАЯ ИГРА', cx - tabW / 2 - 3);
    createTab('online', 'СЕТЕВАЯ ИГРА',   cx + tabW / 2 + 3);

    const btnY1 = top + 74;
    const btnY2 = top + 134;

    if (open === 'single') {
      // Главная кнопка развертывания: Кампания
      const camp = o.singleSubs[0];
      const campBtn = this.createButton(cx, btnY1, camp.label, camp.cb, camp.locked, camp.lockMsg, w - 24, 44, 20, camp.icon);
      if (campBtn && campBtn._btnTxt) campBtn._btnTxt.setColor('#ffd24a');
      track.push(campBtn);

      // Второстепенные режимы: Выживание и Свободная игра
      const surv = o.singleSubs[1];
      const ffa = o.singleSubs[2];
      const subW = Math.round((w - 32) / 2);
      const survBtn = this.createButton(cx - subW / 2 - 4, btnY2, surv.label, surv.cb, surv.locked, surv.lockMsg, subW, 40, 16, surv.icon);
      const ffaBtn = this.createButton(cx + subW / 2 + 4, btnY2, ffa.label, ffa.cb, ffa.locked, ffa.lockMsg, subW, 40, 16, ffa.icon);
      track.push(survBtn, ffaBtn);
    } else {
      // Сетевая игра: Выбрать матч (живое лобби). Заблокировано до выхода сети;
      // открывается чит-кодом all2 (gameState.cheatAllUnlocked).
      const netLocked = !gameState.cheatAllUnlocked;
      const matchBtn = this.createButton(cx, btnY1, 'ВЫБРАТЬ МАТЧ (ЛОББИ)', netLocked ? null : () => this.scene.start('NetLobbyScene'), netLocked, netLocked ? 'Скоро' : null, w - 24, 44, 19, 'list');
      if (!netLocked && matchBtn && matchBtn._btnTxt) matchBtn._btnTxt.setColor('#ffd24a');
      track.push(matchBtn);

      const subW = Math.round((w - 32) / 2);
      const boltBtn = this.createButton(cx - subW / 2 - 4, btnY2, 'БЫСТРЫЙ БОЙ', null, true, 'скоро', subW, 40, 16, 'bolt');
      const rankBtn = this.createButton(cx + subW / 2 + 4, btnY2, 'РЕЙТИНГ', null, true, 'скоро', subW, 40, 16, 'medal');
      track.push(boltBtn, rankBtn);
    }
  }

  _drawBtnIcon(g, id, x, y, s, color) { return Widgets._drawBtnIcon.call(this, g, id, x, y, s, color); }
  _donutLevels(x, y) { return Widgets._donutLevels.call(this, x, y); }
  createButton(x, y, label, callback, locked, lockMsg, uniTw, uniTh, fontPx, icon, marker) { return Widgets.createButton.call(this, x, y, label, callback, locked, lockMsg, uniTw, uniTh, fontPx, icon, marker); }
  createGearButton(x, y) { return Widgets.createGearButton.call(this, x, y); }
  createFullscreenButton(x, y) { return Widgets.createFullscreenButton.call(this, x, y); }

  shutdown() {
    // Останавливаем все твины сцены — иначе при каждом заходе в меню
    // накапливаются бесконечные твины (glow/pulse) и тормозят рендер.
    try { this.tweens.killAll(); } catch (e) {}
    // Уничтожаем живой риг персонажа в витрине: это полноценный physics entity,
    // держать его в памяти между сценами незачем.
    try {
      if (this._showPreview) {
        this._showPreview.destroy();
        this._showPreview = null;
      }
    } catch (e) {}
    // Убираем колесо прокрутки контрактов.
    try {
      if (this._contractsWheel) {
        this.input.off('wheel', this._contractsWheel);
        this._contractsWheel = null;
      }
    } catch (e) {}
    // Сбрасываем RenderTexture-кэш иконок кнопок, чтобы не текли текстуры.
    try { Widgets._clearBtnIconCache(this); } catch (e) {}
  }

  update() {
    if (this._contractsOverlay && this._contractsStrip) {
      try {
        const dt = Math.min(0.05, (this.game.loop.delta || 16.7) / 1000);
        let tgt = this._contractsTarget;
        if (Math.abs(this._contractsVel) > 0.5) {
          tgt = Phaser.Math.Clamp(tgt + this._contractsVel, 0, this._contractsMax || 0);
          this._contractsTarget = tgt;
          this._contractsVel *= Math.pow(0.92, dt * 60);
        } else {
          this._contractsVel = 0;
        }
        const nx = passScrollX + (tgt - passScrollX) * Math.min(1, dt * 12);
        passScrollX = Math.abs(tgt - nx) < 0.5 ? tgt : nx;
        this._contractsStrip.x = this._contractsViewL - passScrollX;
        // Стриминг ленты контрактов: полный рендер дорогой — только ~15 Гц.
        const nowC = this.time.now | 0;
        if (!this._contractsStripNext || nowC >= this._contractsStripNext) {
          this._contractsStripNext = nowC + 66;
          try { if (this._renderContractsStrip) this._renderContractsStrip(); } catch (e) {}
        }
      } catch (e) {}
    }

    const sp = this._showPreview;
    if (sp && sp.active && !sp.dead) {
      try {
        const br = Math.sin((this.time.now / 1000) * Math.PI * 2 * 0.25);
        if (sp._breathY == null) sp._breathY = sp.y;
        if (sp.torso && sp._breathTsy == null) sp._breathTsy = sp.torso.scaleY;
        sp.y = sp._breathY + br * 1.5;
        if (sp.torso && sp._breathTsy) sp.torso.scaleY = sp._breathTsy * (1 + br * 0.02);
      } catch (e) {}
      // Полный пересчёт рига/ствола дорогой — в превью меню достаточно ~15 Гц.
      const now = this.time.now | 0;
      if (!this._showPreviewNext || now >= this._showPreviewNext) {
        this._showPreviewNext = now + 66;
        try {
          sp.updateBars();
          if (sp.updateGun) sp.updateGun();
          if (sp.healthBar && sp.healthBar.visible) sp.healthBar.setVisible(false);
          if (sp.armorBar && sp.armorBar.visible) sp.armorBar.setVisible(false);
          if (sp.nameText && sp.nameText.visible) sp.nameText.setVisible(false);
        } catch (e) {}
      }
    }

    if (!this.bg) return;
    const p = this.input.activePointer;
    // Пропускаем пересчёт, если мышь не сдвинулась значимо (>2px).
    const px = p.x, py = p.y;
    if (Math.abs(px - (this._bgLastPx || 0)) < 2 &&
        Math.abs(py - (this._bgLastPy || 0)) < 2) return;
    this._bgLastPx = px;
    this._bgLastPy = py;
    const nx = (px / this.cameras.main.width - 0.5) * 2;
    const ny = (py / this.cameras.main.height - 0.5) * 2;
    const maxX = 32;
    const maxY = 18;
    const tx = gameW(this) / 2 + nx * maxX;
    const ty = (720 - this.bg.displayHeight / 2) + ny * maxY;
    const dt = Math.min(0.06, (this.game.loop.delta || 16.7) / 1000);
    this.bg.x += (tx - this.bg.x) * Math.min(1, dt * 8);
    this.bg.y += (ty - this.bg.y) * Math.min(1, dt * 8);
  }
}
