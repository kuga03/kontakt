import { gameState, saveGameState, syncGameState } from '../data/gameState.js?v=175';

import { campaignLevels } from '../data/levels.js?v=172';
import { skillPoints } from '../data/skills.js?v=169';
import { genePoints } from '../data/genes.js?v=169';

import { completedAchievements } from '../data/achievements.js?v=170';

import { turfTick } from '../data/gang.js?v=7';
import { isWeekend, eventMutatorDef, nextWeekendStart, fmtCountdown } from '../data/mutators.js?v=2';
import Assault from '../entities/Assault.js?v=319';
import Tank from '../entities/Tank.js?v=319';
import Medic from '../entities/Medic.js?v=319';
import Sniper from '../entities/Sniper.js?v=320';
import { gameW, UX } from '../ui/layout.js?v=3';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

// Версия игры (бета, не выпущена).
export const GAME_VERSION = 'Beta v0.21';

// Баттл-пасс «Контракты» живёт в data/pass.js (40 ярусов × 2 ряда,
// сезон 30 дней, задания строго по порядку).
// Здесь — только позиция ленты (переживает переоткрытия окна).
let passScrollX = 0;

// Открытая секция центра («single» — режимы, «online» — мок онлайна).
// Модульная переменная — переживает перестройки колонки без рестарта сцены.
let openSection = 'single';

// Подписи режимов для истории боёв.

// Авторские PNG-значки для кнопок (id иконки → ключ текстуры).
// Нет файла — рисуется вектор из _drawBtnIcon.
const BTN_ICON_PNG = {
  cart: 'значок магазин',
  backpack: 'значок инвентарь',
  star: 'значок дерево навыков',
  dna: 'значок геном',
  case: 'значок кейсы',
  list: 'значок выбрать матч',
  friends: 'значок друзья',
  swords: 'значок свободная игра',
  globe: 'значок онлайн',
  flag: 'значок компания',
  skull: 'значок испытание',
  medal: 'значок рейтинг',
  bolt: 'значок быстрая игра',
  single: 'значок одиночная игра'
};

import * as Contracts from './menu/contracts.js';
import * as Daily from './menu/daily.js';
import * as History from './menu/history.js';
import * as Showcase from './menu/showcase.js';
import * as Widgets from './menu/widgets.js';
import * as News from './menu/news.js?v=378';
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    syncGameState();
    const _cx = gameW(this) / 2;
    this.cameras.main.setBackgroundColor('#0a0a2a');
    // Флаг модалки сбрасываем: рестарт переиспользует инстанс сцены,
    // иначе после сбора подарка окно больше не открывается.
    this._dailyModal = null;

    // Музыка меню (глушим боевую). Не дёргаем трек, если он уже играет
    // (переходы меню→меню): иначе каждый раз старт с начала.
    // Автоплей до первого клика запрещён политикой браузера: стартуем сразу
    // (если контекст уже открыт) И повторяем по первому клику + по UNLOCKED.
    this._musStarted = false;
    const musPlaying = () => {
      try {
        return this.sound.sounds.some(s => s.key === 'mus_menu' && s.isPlaying);
      } catch (e) {
        return false;
      }
    };
    const startMus = () => {
      try {
        if (this._musStarted || musPlaying()) return;
        if (!this.cache.audio.exists('mus_menu')) return;
        if (this.sound.locked) return;
        // Успех — только если play реально стартовал (при musicVol=0 патч
        // возвращает null: флажок не взводим, иначе музыка не стартует
        // даже после прибавки громкости — слушатель уже сгорел).
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
        // Гарантия после анлока контекста: наш клик мог прийти раньше.
        if (this.sound.locked && Phaser.Sound && Phaser.Sound.Events) {
          this.sound.once(Phaser.Sound.Events.UNLOCKED, startMus);
        }
      }
    } catch (e) { /* noop */ }

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

    this.add.text(_cx, 72, 'КОНТАКТ', {
      fontSize: '44px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Тонкая ячейка сверху: слева деньги + шкала опыта, справа настройки.
    this.createTopBar();

    const hasPoints = skillPoints() > 0;
    const hasGenePoints = genePoints() > 0;
    // Геном открывается первым очком (п.29): флаг в сейве, дальше всегда.
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

    const leftBtns = [
      { label: 'СНАРЯЖЕНИЕ', icon: 'cart', cb: () => this.scene.start('ShopScene') },
      { label: 'ИНВЕНТАРЬ', icon: 'backpack', cb: () => this.scene.start('InventoryScene') },
      { label: 'БОЕВАЯ ПОДГОТОВКА', icon: 'star', cb: () => this.scene.start('SkillsScene'), glow: hasPoints },
      { label: 'ГЕНОМ', icon: 'dna', cb: () => this.scene.start('GenomeScene'), glow: hasGenePoints, locked: genomeLocked },
      { label: 'КЕЙСЫ', icon: 'case', cb: () => this.scene.start('LootBoxScene') }
    ];
    // Левая колонка ужата (5 кнопок): равномерный масштаб 0.85 —
    // арт не плющится, всё влезает до ряда контрактов.
    // «Модернизация» переехала вкладкой в «Снаряжение» (ShopScene, таб upgrade).

    const centerSubs = [
      { label: campaignLabel, icon: 'flag', cb: () => this.scene.start('LobbyScene', { mode: 'CAMPAIGN' }) },
      { label: 'ИСПЫТАНИЕ', icon: 'skull', cb: () => this.scene.start('GameScene', { mode: 'TRIAL' }), locked: trialLocked, lockMsg: 'ур. 2' },
      { label: 'СВОБОДНАЯ ИГРА', icon: 'swords', cb: () => this.scene.start('LobbyScene', { mode: 'FFA' }), locked: ffaLocked, lockMsg: 'ур. 3' }
    ];

    // Мок онлайна (только отрисовка, без реализации): серые кнопки.
    const onlineSubs = [
      { label: 'РЕЙТИНГ', icon: 'medal' },
      { label: 'БЫСТРЫЙ БОЙ', icon: 'bolt' },
      { label: 'ВЫБРАТЬ МАТЧ', icon: 'list' }
    ];

    // Ивент выходных (п.14.2): живёт в правой колонке на месте «Персонажа».
    // В выходные — активен (бой TDM с мутатором ивента), иначе — обратный отсчёт.
    const evDef = eventMutatorDef();
    const evWeekend = isWeekend();
    const evLocked = gameState.level < 3 || !evWeekend;
    const evLabel = evWeekend
      ? `ИВЕНТ: ${evDef.name.toUpperCase()}`
      : `${evDef.name.toUpperCase()} · ${fmtCountdown((nextWeekendStart() || new Date()).getTime() - Date.now())}`;
    const rightBtns = [
      { label: 'ПЕРСОНАЖ', icon: 'person', cb: () => this.scene.start('RigEditorScene') },
      {
        label: evLabel, icon: 'event', glow: evWeekend && gameState.level >= 3, pulse: evWeekend && gameState.level >= 3,
        // Текст блокировки только про уровень; «ждём пятницу» убрали —
        // замок и так читается (владелец).
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
      { label: 'ДРУЗЬЯ', icon: 'friends', cb: () => this.scene.start('FriendsScene', { view: 'friends' }) },
      { label: 'БАНДА', icon: 'gang', cb: () => this.scene.start('GangScene') }
    ];
    // Тик войны банд — по дате входа (как ежедневка, п.14.6).
    try { turfTick(); } catch (e) {}

    // Колонки — внутри 1280-блока: на широком Андроиде блок центрируется UX.
    const COL_LEFT = UX(this, 175);
    const COL_CENTER = UX(this, 560);
    const COL_RIGHT = UX(this, 1090);
    // Кнопки в 1.5 раза больше (п.35): шрифт 21, плашка по пропорциям арта,
    // надпись всегда внутри. Единый размер — по самой длинной надписи.
    const BTN_FONT = 21;
    let uniTw = 0;
    [...leftBtns, ...rightBtns,
      'ОДИНОЧНАЯ ИГРА', 'ОНЛАЙН', 'КАМПАНИЯ',
      // Длинная надпись кампании тоже в замере: иначе панель уже неё
      // и текст жмётся до 12px против 21px у остальных.
      'КАМПАНИЯ — УР. 99', 'КАМПАНИЯ (ПРОЙДЕНА)',
      ...centerSubs.filter(s => !s.label.startsWith('КАМПАНИЯ')).map(s => s.label),
      ...onlineSubs.map(s => s.label)
    ].forEach(label => {
      const probe = this.add.text(0, 0, label, { fontSize: BTN_FONT + 'px' });
      uniTw = Math.max(uniTw, probe.displayWidth);
      probe.destroy();
    });
    uniTw += 56;
    // Кап ширины кнопок: длинные надписи иначе раздувают плашки —
    // колонки вылезают за экран и под недельный ряд. Лишнее ужимается
    // шрифтом в кнопке (цикл в createButton).
    uniTw = Math.min(uniTw, 300);
    // Пропорции fon_btn (1258×346); без картинки — высота по тексту.
    let uniTh = 30;
    if (this.textures.exists('fon_btn')) {
      const fsrc = this.textures.get('fon_btn').getSourceImage();
      const fr = ((fsrc && fsrc.width) || 1258) / Math.max(1, (fsrc && fsrc.height) || 346);
      uniTh = uniTw / fr;
    }
    const START_Y = 195;
    const GAP = uniTh + 10;
    const PANEL_TOP = START_Y - GAP / 2 - 42;
    // Кламп ширины: при широком шрифте панели не налезают на витрину.
    const panelW = Math.min(uniTw + 36, 360);

    // Панели-рамки под колонки (меню v2): Арсенал / В бой / Профиль.
    // Высота с запасом: низ = последняя кнопка + GAP/2 + 12 поля.
    // Центр («В БОЙ») строится отдельно: секции Одиночная/Онлайн.
    // Левая колонка: 5 кнопок ужаты ×0.85 (арт в пропорциях).
    const leftTw = Math.round(uniTw * 0.85);
    const leftTh = Math.round(uniTh * 0.85);
    const leftGap = leftTh + 10;
    const leftFont = 19;
    const leftH = 5 * leftGap + 40;
    // Низ профиля не упирается в ряд контрактов (низ 630): кламп.
    const rightPanelH = Math.min(4 * GAP + 54 + 128, 618 - PANEL_TOP);
    this._panel(COL_LEFT, PANEL_TOP, panelW, leftH, 'АРСЕНАЛ');
    this._panel(COL_RIGHT, PANEL_TOP, panelW, rightPanelH, 'ПРОФИЛЬ');
    this._openSection = openSection;
    this.buildCenterPanel({
      cx: COL_CENTER, top: PANEL_TOP, w: panelW,
      startY: START_Y, gap: GAP, uniTw, uniTh, font: BTN_FONT,
      singleSubs: centerSubs, onlineSubs
    });

    // Кнопки Арсенала приподняты на 12px: после ухода 6-й кнопки
    // низ панели пустовал, а низ последней кнопки цеплял край рамки.
    const LEFT_Y = START_Y - 12;
    leftBtns.forEach((item, i) => {
      const btn = this.createButton(COL_LEFT, LEFT_Y + i * leftGap, item.label, item.cb, item.locked, item.lockMsg, leftTw, leftTh, leftFont, item.icon);
      // Есть очки навыков — кнопка медленно пульсирует золотым.
      if (item.glow && btn && btn._btnTxt) {
        btn._btnTxt.setColor('#ffdd44');
        if (btn._paintIcon) btn._paintIcon(0xffdd44);
        this.tweens.add({
          targets: btn,
          scale: { from: 1, to: 1.07 },
          yoyo: true,
          repeat: -1,
          duration: 900,
          ease: 'Sine.easeInOut'
        });
      }
    });

    rightBtns.forEach((item, i) => {
      const btn = this.createButton(COL_RIGHT, START_Y + i * GAP, item.label, item.cb, item.locked, item.lockMsg, uniTw, uniTh, BTN_FONT, item.icon);
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
    // «Мои уровни» — маленький пончик в правом нижнем углу.
    try { this._donutLevels(gameW(this) - 65, 656); } catch (e) {}

    // Мини-статистика из профиля убрана — остался только подарок дня.
    const rightBottom = PANEL_TOP + rightPanelH;
    this.add.text(COL_RIGHT, rightBottom - 62, 'ПОДАРОК ДНЯ', {
      fontSize: '12px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.createDailyGift(COL_RIGHT, rightBottom - 30, 44);

    // Новости — кнопка под правой панелью (в свободной зоне над контрактами).
    this.createButton(UX(this, 1090), 656, 'НОВОСТИ', () => this._openNewsModal(), false, null, null, null, 16);

    // Витрина героя: строго в зазоре между панелями (стал шире).
    {
      const centerR = COL_CENTER + panelW / 2;
      const rightL = COL_RIGHT - panelW / 2;
      const avail = rightL - centerR - 24;
      const showW = Math.max(130, Math.min(220, avail));
    // Бюджет ширины бейджа рейтинга: почти впритык между панелями
    // (поля по 3px). Без него растущий после матчей рейтинг налезал на соседей.
    const badgeMaxW = Math.max(80, rightL - 3 - (centerR + 3));
      this.createShowcase(centerR + 12 + showW / 2, showW, badgeMaxW);
    }

    // Контракт недели — ряд карточек по нижнему краю экрана.
    this.createContractsRow();

    // Незабранные награды: кнопка светится + тост (выдача — только по кнопке).
    const unclaimed = completedAchievements().filter(a => !(gameState.achievements || []).includes(a.id));
    if (unclaimed.length) this._toastAchReady(unclaimed.length);

    // Версия (бета).
    this.add.text(UX(this, 14), 706, GAME_VERSION, {
      fontSize: '13px',
      color: '#667788'
    }).setOrigin(0, 1);
  }

  // Рамка панели с заголовком. Возвращает низ панели.
  // Фон — авторский PNG (растянут под размер), иначе плоская заливка.
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
  buildCenterPanel(o) {
    (this._centerElems || []).forEach(e => { try { e.destroy(); } catch (e2) {} });
    this._centerElems = [];
    const track = this._centerElems;
    const subH = Math.round(o.uniTh * 0.8);
    const subGap = subH + 8;
    const open = this._openSection;

    const rows = [{ kind: 'header', id: 'single', label: 'ОДИНОЧНАЯ ИГРА', marker: open === 'single' ? '▾' : '▸' }];
    if (open === 'single') o.singleSubs.forEach(s => rows.push({ kind: 'sub', ...s }));
    rows.push({ kind: 'header', id: 'online', label: 'ОНЛАЙН', marker: open === 'online' ? '▾' : '▸' });
    // ВЫБРАТЬ МАТЧ — живой (сетевое лобби LAN: гости и создание игры), остальное пока моки.
    if (open === 'online') o.onlineSubs.forEach(s => {
      if (s.label === 'ВЫБРАТЬ МАТЧ') {
        rows.push({ kind: 'sub', ...s, cb: () => this.scene.start('NetLobbyScene'), locked: false });
      } else {
        rows.push({ kind: 'mock', ...s });
      }
    });

    // Мок-кнопки без сносок: ряд плотный (subH+4), фон короче сам —
    // высота считается по рядам ниже.
    const rowH = r => (r.kind === 'header' ? o.gap : r.kind === 'mock' ? subH + 4 : subGap);
    let h = 48;
    rows.forEach(r => { h += rowH(r); });
    h += 14;

    const g = this.add.graphics();
    if (this.textures.exists('фон для блоков меню')) {
      const img = this.add.image(o.cx, o.top + h / 2, 'фон для блоков меню');
      img.setDisplaySize(o.w, h);
      img.setAlpha(0.7);
      track.push(img);
    } else {
      g.fillStyle(0x12122e, 0.92);
      g.fillRoundedRect(o.cx - o.w / 2, o.top, o.w, h, 12);
    }
    g.lineStyle(2, 0x3a3a6a, 1);
    g.strokeRoundedRect(o.cx - o.w / 2, o.top, o.w, h, 12);
    const title = this.add.text(o.cx, o.top + 20, 'В БОЙ', {
      fontSize: '18px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5);
    track.push(g, title);

    let y = o.top + 48;
    rows.forEach(r => {
      const rh = rowH(r);
      if (r.kind === 'header') {
        const btn = this.createButton(o.cx, y + o.gap / 2, r.label, () => {
          this._openSection = (this._openSection === r.id ? null : r.id);
          openSection = this._openSection;
          this.buildCenterPanel(o);
        }, false, null, o.uniTw, o.uniTh, o.font, r.id === 'single' ? 'single' : 'globe', r.marker);
        track.push(btn);
      } else if (r.kind === 'sub') {
        const btn = this.createButton(o.cx, y + subGap / 2, r.label, r.cb, r.locked, r.lockMsg, o.uniTw, subH, 18, r.icon);
        track.push(btn);
      } else {
        const btn = this.createButton(o.cx, y + rh / 2, r.label, null, true, 'скоро', o.uniTw, subH, 18, r.icon);
        track.push(btn);
      }
      y += rh;
    });
    return o.top + h;
  }

  // Векторные иконки-якоря кнопок (s — полуразмер). Один цвет, без заливок
  // тяжелее линий/точек — читаются и мелко.
  // Если автор завёз PNG («значок ...») — рисуется он, вектор — фолбэк.
  _drawBtnIcon(g, id, x, y, s, color) { return Widgets._drawBtnIcon.call(this, g, id, x, y, s, color); }
  _donutLevels(x, y) { return Widgets._donutLevels.call(this, x, y); }
  createButton(x, y, label, callback, locked, lockMsg, uniTw, uniTh, fontPx, icon, marker) { return Widgets.createButton.call(this, x, y, label, callback, locked, lockMsg, uniTw, uniTh, fontPx, icon, marker); }
  createGearButton(x, y) { return Widgets.createGearButton.call(this, x, y); }
  createFullscreenButton(x, y) { return Widgets.createFullscreenButton.call(this, x, y); }
  update() {
    // Плавный скролл контрактов: дотяжка ленты к цели + затухание инерции.
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
        // Виртуализация: достроить ячейки, въехавшие в кадр.
        try { if (this._renderContractsStrip) this._renderContractsStrip(); } catch (e) {}
      } catch (e) {}
    }
    // Живое превью витрины: поза держится, служебное скрыто, шапка на голове.
    const sp = this._showPreview;
    if (sp && sp.active && !sp.dead) {
      try {
        sp.updateBars();
        if (sp.updateGun) sp.updateGun();
        sp.healthBar.setVisible(false);
        sp.armorBar.setVisible(false);
        sp.nameText.setVisible(false);
      } catch (e) { /* превью не роняет меню */ }
      // Дыхание витрины: грудь ±2%, фигура ±1.5px (~15 вдохов/мин).
      // Поза каждый кадр пересчитывается из координат — рассинхрона нет.
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
