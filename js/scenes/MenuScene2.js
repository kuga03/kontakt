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

    this.add.text(_cx, 97, 'ТАКТИЧЕСКИЙ ОНЛАЙН-ШУТЕР', {
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
    const campaignLabel = gameState.campaignLevel > campaignTotal
      ? 'КАМПАНИЯ ✓'
      : `КАМПАНИЯ — УР. ${gameState.campaignLevel}`;

    const trialLocked = gameState.level < 2;
    const ffaLocked = gameState.level < 3;

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
      { label: 'ВЫЖИВАНИЕ', icon: 'skull', cb: () => this.scene.start('GameScene', { mode: 'TRIAL' }), locked: trialLocked, lockMsg: 'ур. 2' },
      { label: 'СВОБОДНАЯ ИГРА', icon: 'swords', cb: () => this.scene.start('LobbyScene', { mode: 'FFA' }), locked: ffaLocked, lockMsg: 'ур. 3' }
    ];

    const onlineSubs = [
      { label: 'РЕЙТИНГ', icon: 'medal' },
      { label: 'БЫСТРЫЙ БОЙ', icon: 'bolt' },
      { label: 'ВЫБРАТЬ МАТЧ', icon: 'list' }
    ];

    // Правое крыло: Штаб и Операции
    const evDef = eventMutatorDef();
    const evWeekend = isWeekend();
    const evLocked = gameState.level < 3 || !evWeekend;
    const evLabel = evWeekend
      ? `ИВЕНТ: ${evDef.name.toUpperCase()}`
      : `${evDef.name.toUpperCase()} · ${fmtCountdown((nextWeekendStart() || new Date()).getTime() - Date.now())}`;

    const rightBtns = [
      {
        label: evLabel, icon: 'event', glow: evWeekend && gameState.level >= 3, pulse: evWeekend && gameState.level >= 3,
        locked: evLocked, lockMsg: gameState.level < 3 ? 'ур. 3' : null,
        cb: () => {
          const cls = (gameState.lastClass && ['Assault', 'Tank', 'Medic', 'Sniper'].includes(gameState.lastClass)) ? gameState.lastClass : 'Assault';
          this.scene.start('GameScene', {
            mode: 'TDM', mutators: [evDef.id],
            selectedClass: cls, playerName: gameState.playerName,
            scoreLimit: gameState.scoreLimit
          });
        }
      },
      { label: 'ДРУЗЬЯ И КЛАН', icon: 'friends', cb: () => this.scene.start('FriendsScene', { view: 'friends' }) },
      { label: 'ВОЙНА БАНД', icon: 'gang', cb: () => this.scene.start('GangScene') }
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
    const btnH = 46;
    const btnGap = 58;
    const START_BTN_Y = PANEL_TOP + 56;

    leftBtns.forEach((item, i) => {
      const by = START_BTN_Y + i * btnGap;
      const btn = this.createButton(COL_LEFT, by, item.label, item.cb, item.locked, item.lockMsg, btnW, btnH, 17, item.icon);
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

    const eqCardY = START_BTN_Y + 5 * btnGap + 10;
    const eqCard = this.add.graphics();
    eqCard.fillStyle(0x101526, 0.92);
    eqCard.fillRoundedRect(COL_LEFT - btnW / 2, eqCardY - 26, btnW, 54, 8);
    eqCard.lineStyle(1, 0x3a4868, 0.85);
    eqCard.strokeRoundedRect(COL_LEFT - btnW / 2, eqCardY - 26, btnW, 54, 8);

    this.add.text(COL_LEFT, eqCardY - 12, `${pCd.label.toUpperCase()} · ${gunName.toUpperCase()}`, {
      fontSize: '11px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(COL_LEFT, eqCardY + 10, 'БОЕКОМПЛЕКТ ГОТОВ К БОЮ', {
      fontSize: '10px', color: '#8fb8ff'
    }).setOrigin(0.5);

    // Панель правого крыла: «ШТАБ»
    this._panel(COL_RIGHT, PANEL_TOP, PANEL_W, PANEL_H, 'ШТАБ');

    // Кнопки Штаба
    rightBtns.forEach((item, i) => {
      const by = START_BTN_Y + i * btnGap;
      const btn = this.createButton(COL_RIGHT, by, item.label, item.cb, item.locked, item.lockMsg, btnW, btnH, 17, item.icon);
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
    });

    // Карточка ежедневного подарка в правом крыле
    this.createDailyGift(COL_RIGHT, START_BTN_Y + 3 * btnGap + 18, 52);

    // Сводка клана и серии в правом крыле
    const clanCardY = START_BTN_Y + 4 * btnGap + 36;
    const clanCard = this.add.graphics();
    clanCard.fillStyle(0x101526, 0.92);
    clanCard.fillRoundedRect(COL_RIGHT - btnW / 2, clanCardY - 24, btnW, 50, 8);
    clanCard.lineStyle(1, 0x3a4868, 0.85);
    clanCard.strokeRoundedRect(COL_RIGHT - btnW / 2, clanCardY - 24, btnW, 50, 8);

    const clanLine1 = (gameState.clan && gameState.clan.tag)
      ? `КЛАН: [${gameState.clan.tag}] ${gameState.clan.name || ''}`
      : 'КЛАН: БЕЗ КЛАНА';
    this.add.text(COL_RIGHT, clanCardY - 10, clanLine1, {
      fontSize: '11px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(COL_RIGHT, clanCardY + 10, `СЕРИЯ ДНЕЙ: ${gameState.dailyStreak | 0} ДН.`, {
      fontSize: '10px', color: '#c4d4f8'
    }).setOrigin(0.5);

    // Центральная витрина героя на голографическом пьедестале
    this.createShowcase(COL_CENTER, 360, 280);

    // Центральный тактический хаб режимов «В БОЙ»
    this._openSection = openSection;
    this.buildCenterPanel({
      cx: COL_CENTER,
      top: 432,
      w: 460,
      singleSubs: centerSubs,
      onlineSubs: onlineSubs
    });

    // Контракты (Баттл-пасс) по нижнему краю по центру
    this.createContractsRow();

    // Кнопки под правым крылом: Новости и Мои Уровни
    this.createButton(UX(this, 1035), 656, 'НОВОСТИ', () => this._openNewsModal(), false, null, 116, 36, 14);
    try { this._donutLevels(UX(this, 1165), 656); } catch (e) {}

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
    const h = 182;
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
    const tabY = top + 24;
    const tabW = Math.round(w / 2 - 14);
    const tabH = 32;

    const createTab = (tabId, label, tabX) => {
      const active = open === tabId;
      const tg = this.add.graphics();
      tg.fillStyle(active ? 0x221a08 : 0x121628, 0.95);
      tg.fillRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 6);
      tg.lineStyle(active ? 1.5 : 1, active ? 0xffd24a : 0x2e3852, 1);
      tg.strokeRoundedRect(tabX - tabW / 2, tabY - tabH / 2, tabW, tabH, 6);
      if (active) {
        tg.fillStyle(0xd8a920, 1);
        tg.fillRoundedRect(tabX - tabW / 2 + 8, tabY + tabH / 2 - 2, tabW - 16, 2, 1);
      }
      const tt = this.add.text(tabX, tabY, label, {
        fontSize: '12px', color: active ? '#ffd24a' : '#8899bb', fontStyle: 'bold'
      }).setOrigin(0.5);
      const hit = this.add.zone(tabX, tabY, tabW, tabH).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this._openSection = tabId;
        openSection = tabId;
        this.buildCenterPanel(o);
      });
      hit.on('pointerover', () => {
        if (!active) tt.setColor('#ffffff');
      });
      hit.on('pointerout', () => {
        if (!active) tt.setColor('#8899bb');
      });
      track.push(tg, tt, hit);
    };

    createTab('single', '⚔ ОДИНОЧНАЯ ИГРА', cx - tabW / 2 - 3);
    createTab('online', '🌐 СЕТЕВАЯ ИГРА', cx + tabW / 2 + 3);

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
      // Сетевая игра: Выбрать матч (живое лобби)
      const matchBtn = this.createButton(cx, btnY1, 'ВЫБРАТЬ МАТЧ (ЛОББИ)', () => this.scene.start('NetLobbyScene'), false, null, w - 24, 44, 19, 'list');
      if (matchBtn && matchBtn._btnTxt) matchBtn._btnTxt.setColor('#ffd24a');
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
        try { if (this._renderContractsStrip) this._renderContractsStrip(); } catch (e) {}
      } catch (e) {}
    }

    const sp = this._showPreview;
    if (sp && sp.active && !sp.dead) {
      try {
        sp.updateBars();
        if (sp.updateGun) sp.updateGun();
        sp.healthBar.setVisible(false);
        sp.armorBar.setVisible(false);
        sp.nameText.setVisible(false);
      } catch (e) {}
      try {
        const br = Math.sin((this.time.now / 1000) * Math.PI * 2 * 0.25);
        if (sp._breathY == null) sp._breathY = sp.y;
        if (sp.torso && sp._breathTsy == null) sp._breathTsy = sp.torso.scaleY;
        sp.y = sp._breathY + br * 1.5;
        if (sp.torso && sp._breathTsy) sp.torso.scaleY = sp._breathTsy * (1 + br * 0.02);
      } catch (e) {}
    }

    if (!this.bg) return;
    const p = this.input.activePointer;
    const nx = (p.x / this.cameras.main.width - 0.5) * 2;
    const ny = (p.y / this.cameras.main.height - 0.5) * 2;
    const maxX = 32;
    const maxY = 18;
    this.bg.x = gameW(this) / 2 + nx * maxX;
    this.bg.y = (720 - this.bg.displayHeight / 2) + ny * maxY;
  }
}
