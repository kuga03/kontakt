import { gameW, UX } from '../ui/layout.js';
import { gameState, hasWeapon, unlockWeapon, saveGameState, syncGameState, hasHead, getEquippedHead, hasShoes, getEquippedShoes, hasTorso, getEquippedTorso, hasPants, getEquippedPants } from '../data/gameState.js';
import {
  weaponsList,
  classDefinitions,
  weaponByClass,
  secondaryWeapons,
  weaponImage,
  weaponIcon,
  getWeaponLabel,
  classOfWeapon,
  classOpenLevel,
  isClassUnlocked
} from '../data/weapons.js';

// slot: куда надевается ('head' — на голову, 'shoes' — на ноги).
// cat: столбец вкладки ВНЕШНОСТЬ ('hair' — Волосы, 'hat' — Уборы,
// 'shoes' — Обувь; позже сюда же 'torso' — Торс и 'pants' — Штаны).
// Каталог живёт в data/wardrobe.js (им же пользуется кейс «Гардероб»).
import { GEAR_ITEMS } from '../data/wardrobe.js';

import {
  getWeaponLevel, nextUpgradeCost, isUpgradeable,
  upgradeWeapon, UPGRADE_MAX, UPGRADE_BONUS
} from '../data/upgrades.js';

// Подписи следующего уровня для карточек (коротко, как в UpgradeScene).
const UP_NEXT_SHORT = ['перезаряд −6%', 'магазин +20%', 'разброс −15%', 'дальность +10%', 'перезаряд −6%'];
const HEAD_ITEMS = GEAR_ITEMS;

// Столбцы вкладки ВНЕШНОСТЬ по категориям.
const APPEAR_CATS = [
  { id: 'hair', title: 'Волосы' },
  { id: 'hat', title: 'Уборы' },
  { id: 'shoes', title: 'Обувь' },
  { id: 'torso', title: 'Торс' },
  { id: 'pants', title: 'Штаны' }
];

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create(data) {
    syncGameState();
    const _cx = gameW(this) / 2;
    this.activeButton = null;
    this.shopItems = [];
    this.headCells = [];
    this.grenadeRows = [];
    this.sectionLabels = [];
    // Сюда приходят на модернизацию из инвентаря (tab: 'upgrade').
    // Донат живёт отдельным экраном DonateScene (пончик из меню).
    const _initTab = data && data.tab;
    this.tab = (_initTab === 'upgrade') ? 'upgrade' : 'weapons';

    this._initBackground();
    this._initHeader();

    this.drawTabs();
    this.drawTooltip();
    this.redrawTab();

    // ESC для возврата в меню
    try {
      this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));
    } catch (e) {}

    this.refresh();
  }

  // Трёхступенчатый градиент фона как во всех обновлённых сценах
  _initBackground() {
    const W = gameW(this);
    this.cameras.main.setBackgroundColor('#080916');

    const bgb = this.add.graphics().setDepth(-10);
    bgb.fillStyle(0x0f1226, 1);
    bgb.fillRect(0, 0, W, 240);
    bgb.fillStyle(0x090b1c, 1);
    bgb.fillRect(0, 240, W, 240);
    bgb.fillStyle(0x050610, 1);
    bgb.fillRect(0, 480, W, 240);

    bgb.lineStyle(1, 0xffd24a, 0.22);
    bgb.lineBetween(0, 56, W, 56);
    bgb.lineBetween(0, 692, W, 692);
  }

  _initHeader() {
    const _cx = gameW(this) / 2;

    this.add.text(_cx, 22, 'СНАРЯЖЕНИЕ', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(50);

    // Золотая черта с ромбом под заголовком
    const fl = this.add.graphics().setDepth(50);
    fl.lineStyle(2, 0xffd24a, 0.8);
    fl.lineBetween(_cx - 150, 42, _cx + 150, 42);
    fl.fillStyle(0xffd24a, 0.9);
    const dd = 5;
    fl.fillPoints([
      new Phaser.Geom.Point(_cx, 42 - dd), new Phaser.Geom.Point(_cx + dd, 42),
      new Phaser.Geom.Point(_cx, 42 + dd), new Phaser.Geom.Point(_cx - dd, 42)
    ], true);

    // Кнопка Назад в стиле меню Банды/Инвентаря
    const backX = UX(this, 70), backY = 27;
    const backW = 104, backH = 34;
    const backFr = this.add.graphics().setDepth(59);

    const renderBack = (hot) => {
      backFr.clear();
      backFr.fillStyle(0x3a1e24, 1);
      backFr.fillRoundedRect(backX - backW / 2, backY - backH / 2, backW, backH, 8);
      backFr.fillStyle(0xffffff, hot ? 0.15 : 0.08);
      backFr.fillRoundedRect(backX - backW / 2, backY - backH / 2, backW, 5, { tl: 8, tr: 8, bl: 0, br: 0 });
      backFr.lineStyle(hot ? 2 : 1.5, hot ? 0xffff88 : 0x9e4a5a, 1);
      backFr.strokeRoundedRect(backX - backW / 2, backY - backH / 2, backW, backH, 8);
    };
    renderBack(false);

    this.backBtn = this.add.text(backX, backY, '← Назад', {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      fixedWidth: backW,
      padding: { top: 7, bottom: 7 },
      align: 'center'
    }).setOrigin(0.5).setDepth(60);

    this.backBtn.setInteractive({ useHandCursor: true });
    this.backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    this.backBtn.on('pointerover', () => {
      renderBack(true);
      this.backBtn.setStyle({ color: '#ffff55' });
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.2 });
        }
      } catch (e) {}
    });
    this.backBtn.on('pointerout', () => {
      renderBack(false);
      this.backBtn.setStyle({ color: '#ffffff' });
    });

    // Плашка баланса монет (UX сдвинута вправо)
    const coinPillX = UX(this, 195);
    const coinPillY = 27;
    const coinPillW = 126;
    const coinPillH = 32;

    const coinBg = this.add.graphics().setDepth(50);
    coinBg.fillStyle(0x101326, 0.95);
    coinBg.fillRoundedRect(coinPillX - coinPillW / 2, coinPillY - coinPillH / 2, coinPillW, coinPillH, 8);
    coinBg.lineStyle(1.5, 0xffd24a, 0.7);
    coinBg.strokeRoundedRect(coinPillX - coinPillW / 2, coinPillY - coinPillH / 2, coinPillW, coinPillH, 8);

    this.coinIcon = this.add.image(coinPillX - coinPillW / 2 + 18, coinPillY, 'icon_coins').setOrigin(0.5).setDepth(51);
    if (this.textures.exists('icon_coins')) {
      this.coinIcon.setDisplaySize(20, 16);
    }
    this.coinsText = this.add.text(coinPillX - coinPillW / 2 + 34, coinPillY, '', {
      fontSize: '15px',
      color: '#ffee88',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(51);
  }

  drawTabs() {
    this.tabBtns = [];
    const _cx = gameW(this) / 2;
    const tabs = [
      { id: 'weapons', label: 'ОРУЖИЕ', x: _cx - 105, w: 170 },
      { id: 'upgrade', label: 'МОДЕРНИЗАЦИЯ', x: _cx + 105, w: 200 }
    ];

    tabs.forEach(t => {
      const tabFr = this.add.graphics().setDepth(50);
      const h = 34;

      const renderTab = (active, hot) => {
        tabFr.clear();
        tabFr.fillStyle(active ? 0x2e2510 : hot ? 0x1d2238 : 0x111425, 0.95);
        tabFr.fillRoundedRect(t.x - t.w / 2, 74 - h / 2, t.w, h, 8);
        tabFr.fillStyle(0xffffff, active ? 0.12 : hot ? 0.08 : 0.04);
        tabFr.fillRoundedRect(t.x - t.w / 2, 74 - h / 2, t.w, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
        tabFr.lineStyle(active ? 2 : 1.5, active ? 0xffd24a : hot ? 0x6688cc : 0x2a3550, 1);
        tabFr.strokeRoundedRect(t.x - t.w / 2, 74 - h / 2, t.w, h, 8);
      };

      const btn = this.add.text(t.x, 74, t.label, {
        fontSize: '14px',
        color: this.tab === t.id ? '#ffd24a' : '#a0b0c8',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(51);

      renderTab(this.tab === t.id, false);

      const hit = this.add.rectangle(t.x, 74, t.w, h, 0xffffff, 0)
        .setOrigin(0.5)
        .setDepth(52)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerdown', () => {
        if (this.tab !== t.id) {
          try {
            if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
              this.sound.play('sfx_hover', { volume: 0.25 });
            }
          } catch (e) {}
          this.tab = t.id;
          this.redrawTab();
        }
      });

      hit.on('pointerover', () => {
        if (this.tab !== t.id) {
          renderTab(false, true);
          btn.setStyle({ color: '#ffffff' });
          try {
            if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
              this.sound.play('sfx_hover', { volume: 0.15 });
            }
          } catch (e) {}
        }
      });

      hit.on('pointerout', () => {
        if (this.tab !== t.id) {
          renderTab(false, false);
          btn.setStyle({ color: '#a0b0c8' });
        }
      });

      this.tabBtns.push({ btn, id: t.id, renderTab });
    });
  }

  redrawTab() {
    this.tabBtns.forEach(({ btn, id, renderTab }) => {
      const active = (this.tab === id);
      renderTab(active, false);
      btn.setStyle({
        color: active ? '#ffd24a' : '#a0b0c8'
      });
    });

    this.clearTabContent();
    // Тултип от прошлой вкладки (статы оружия) не должен висеть над новой.
    this.hideTooltip();

    if (this.tab === 'weapons') {
      this.buildColumns();
    } else if (this.tab === 'upgrade') {
      this.buildUpgrade();
    } else {
      this.tab = 'weapons';
      this.buildColumns();
    }
    this.refresh();
  }

  clearTabContent() {
    this.shopItems.forEach(c => {
      if (c.container) c.container.destroy();
    });
    this.shopItems = [];
    this.grenadeRows.forEach(r => {
      if (r.hitZone) r.hitZone.destroy();
    });
    this.grenadeRows = [];
    this.headCells.forEach(c => {
      if (c.hitZone) c.hitZone.destroy();
      if (c.container) c.container.destroy();
    });
    this.headCells = [];
    this.sectionLabels.forEach(l => l.destroy());
    this.sectionLabels = [];
    if (this._shopMaskGfx) {
      this._shopMaskGfx.forEach(g => g.destroy());
      this._shopMaskGfx = [];
    }
    if (this.columnContainers) {
      this.columnContainers.forEach(c => c.destroy());
      this.columnContainers = [];
    }
    this.columnScrolls = [];
    // Контент вкладки модернизации (стена + карточки + модалка).
    try { if (this._upModal) this._closeUpgradeModal(); } catch (e) {}
    if (this._upCont) {
      try { this._upCont.destroy(true); } catch (e) { try { this._upCont.destroy(); } catch (e2) {} }
      this._upCont = null;
    }
    this._upModal = null;
  }

  buildColumns() {
    // Порядок колонок по типам (меню v2): винтовки, дробовики, пулемёты,
    // снайперки, общее, второе оружие.
    const ORDER = ['Assault', 'Medic', 'Tank', 'Sniper', 'Common'];
    const columns = ORDER.map(id => {
      const cd = classDefinitions.find(v => v.id === id);
      const items = (weaponByClass[id] || [])
        .map(name => weaponsList.find(w => w.name === name))
        .filter(w => w && w.category === 'primary');
      return { label: cd ? cd.label : 'ОБЩЕЕ', items };
    });

    // Вторички — строго лесенкой уровней (слабое сверху, Deagle
    // последним): сортировка по unlockLevel, а не порядком массива.
    const secondaries = secondaryWeapons
      .map(name => weaponsList.find(w => w.name === name))
      .filter(w => w && w.category === 'secondary')
      .sort((a, b) => (a.unlockLevel || 1) - (b.unlockLevel || 1));
    columns.push({ label: 'ВТОРОЕ ОРУЖИЕ', items: secondaries });

    // 6 колонок: ячейки ужаты 220→190, зазоры 10.
    // Центрирование по ширине экрана (равные отступы слева и справа).
    const startX = Math.round((gameW(this) - 1190) / 2);
    const COL_X = [0, 1, 2, 3, 4, 5].map(i => startX + i * 200);
    const TOP = 120;
    const BOTTOM = 680;
    const CELL_W = 190;
    const ICON_CELL_H = 40;
    const GUN_CELL_H = 58;
    const GAP = 4;

    this.columnScrolls = new Array(COL_X.length).fill(0);
    this.columnContainers = [];
    this._shopMaskGfx = [];
    // Старый wheel-хендлер снимаем: иначе их копится по одному за каждый
    // заход во вкладку и скролл дёргается (п.3 — чистка хвостов вкладки).
    if (this._wheelHandler) this.input.off('wheel', this._wheelHandler);

    columns.forEach((column, ci) => {
      const x = COL_X[ci];

      // Подпись класса в виде стильного бейджа
      const colHeaderBg = this.add.graphics();
      colHeaderBg.fillStyle(0x101426, 0.9);
      colHeaderBg.fillRoundedRect(x, TOP - 26, CELL_W, 20, 5);
      colHeaderBg.lineStyle(1, 0x2e3b56, 0.8);
      colHeaderBg.strokeRoundedRect(x, TOP - 26, CELL_W, 20, 5);
      this.sectionLabels.push(colHeaderBg);

      const colLabel = this.add.text(x + CELL_W / 2, TOP - 16, column.label, {
        fontSize: '11px',
        color: '#ffd24a',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0.5);
      this.sectionLabels.push(colLabel);

      const maskG = this.add.graphics();
      maskG.fillStyle(0xffffff);
      maskG.fillRect(x - 2, TOP, CELL_W + 4, BOTTOM - TOP);
      maskG.setVisible(false);
      this._shopMaskGfx.push(maskG);

      const colContainer = this.add.container(0, 0);
      colContainer.setMask(maskG.createGeometryMask());

      // Порядок колонки — как задан в weaponByClass (слабое сверху).
      const sorted = column.items.slice();

      let y = TOP;
      sorted.forEach(weapon => {
        const h = this.cellHeight(weapon, ICON_CELL_H, GUN_CELL_H);
        this.createShopCell(x, y, weapon, CELL_W, h, colContainer);
        y += h + GAP;
      });

      colContainer._totalH = y - TOP;
      colContainer._maxScroll = Math.max(0, colContainer._totalH - (BOTTOM - TOP));
      colContainer._colIdx = ci;
      this.columnContainers.push(colContainer);
    });

    this.input.on('wheel', this._wheelHandler = (pointer, _go, _dx, dy) => {
      if (this.tab !== 'weapons') return;
      for (let ci = 0; ci < COL_X.length; ci++) {
        const cx = COL_X[ci];
        if (pointer.x >= cx && pointer.x <= cx + CELL_W && pointer.y >= TOP && pointer.y <= BOTTOM) {
          const cont = this.columnContainers[ci];
          if (!cont || cont._maxScroll <= 0) return;
          this.columnScrolls[ci] = Phaser.Math.Clamp(
            this.columnScrolls[ci] + dy * 0.5,
            0, cont._maxScroll
          );
          cont.y = -this.columnScrolls[ci];
          break;
        }
      }
    });
  }

  // --- Вкладка «МОДЕРНИЗАЦИЯ» (бывшая UpgradeScene, ТЗ п.14.4) ---
  // Ряды по классам (порядок внутри — магазинный, слабый → сильный),
  // в шапке ряда — счётчик заточки («ШТУРМОВИК · +12/+30»).
  // От магазина отличается подачей: там колонки без шапок, тут ряды
  // с плашками классов + полоска цвета класса на карточке.
  // Лента прокручивается колесом при переполнении (полная коллекция —
  // 6 рядов, в 575px не влезает; типичные 10–15 стволов — без скролла).
  buildUpgrade() {
    const _cx = gameW(this) / 2;
    // Чужой wheel-хендлер снимаем (как в остальных вкладках).
    if (this._wheelHandler) this.input.off('wheel', this._wheelHandler);
    this.columnContainers = [];
    const cont = this.add.container(0, 0);
    this._upCont = cont;

    // Группы в порядке магазинных колонок + второе оружие отдельно.
    // Внутри группы — порядок weaponByClass (как в магазине).
    let ownedSet = null;
    try { ownedSet = new Set(gameState.unlockedWeapons || []); } catch (e) { ownedSet = new Set(); }
    const groups = [];
    ['Assault', 'Medic', 'Tank', 'Sniper', 'Common'].forEach(cid => {
      const names = (weaponByClass[cid] || []).filter(nm => ownedSet.has(nm) && isUpgradeable(nm));
      if (names.length) groups.push({ id: cid, names });
    });
    const secs = secondaryWeapons
      .map(nm => weaponsList.find(w => w && w.name === nm))
      .filter(w => w && ownedSet.has(w.name) && isUpgradeable(w.name))
      .sort((a, b) => (a.unlockLevel || 1) - (b.unlockLevel || 1));
    if (secs.length) groups.push({ id: '__sec__', names: secs.map(w => w.name) });
    if (!groups.length) {
      cont.add(this.add.text(_cx, 360, 'Пока нет пушек для улучшения', {
        fontSize: '16px', color: '#667788'
      }).setOrigin(0.5));
      return;
    }
    // Раскладка (замер): ряд = шапка 26 + линии карточек 80/8 + хвост 10.
    const cols = 5, cw = 200, ch = 80, gapX = 12, gapY = 8;
    const x0 = (gameW(this) - (cols * cw + (cols - 1) * gapX)) / 2 + cw / 2;
    const rowX = x0 - cw / 2;
    const TOP = 125, BOTTOM = 700;
    // Первый проход — чистая арифметика (стене нужна итоговая высота,
    // а стена рисуется ПОД карточками).
    const rows = [];
    let yy = TOP + 8;
    groups.forEach(gr => {
      rows.push({ gr, y: yy });
      yy += 26 + Math.ceil(gr.names.length / cols) * (ch + gapY) + 10;
    });
    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff);
    maskG.fillRect(0, TOP, gameW(this), BOTTOM - TOP);
    maskG.setVisible(false);
    // Гард: при прямом заходе на таб (из инвентаря) buildColumns
    // не вызывался и массив масок ещё не создан (чистка — по if'у
    // в clearTabContent).
    this._shopMaskGfx = this._shopMaskGfx || [];
    this._shopMaskGfx.push(maskG);
    const scroll = this.add.container(0, 0);
    scroll.setMask(maskG.createGeometryMask());
    cont.add(scroll);
    // Стена позади всего контента (без лампы — в скролле её срезало бы
    // маской; свет даёт статичный подзаголовок выше).
    this._upWall(scroll, rowX, TOP, cols * cw + (cols - 1) * gapX, yy - TOP, false);
    // Второй проход — шапки и карточки.
    rows.forEach(({ gr, y }) => {
      const label = this._upGroupLabel(gr.id);
      const color = this._upGroupColor(gr.id);
      let total = 0;
      try { gr.names.forEach(nm => { total += getWeaponLevel(nm); }); } catch (e) {}
      scroll.add(this.add.rectangle(rowX + 6, y + 8, 12, 12, color));
      scroll.add(this.add.text(rowX + 22, y, `${label} · +${total}/${gr.names.length * UPGRADE_MAX}`, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0, 0));
      gr.names.forEach((nm, i) => {
        const w = weaponsList.find(v => v && v.name === nm);
        if (!w) return;
        const col = i % cols, row = Math.floor(i / cols);
        this._upCard(scroll, x0 + col * (cw + gapX), y + 26 + row * (ch + gapY) + ch / 2, w, cw, ch, color);
      });
    });
    const maxScroll = Math.max(0, (yy - TOP) - (BOTTOM - TOP));
    let sv = 0;
    this.input.on('wheel', this._wheelHandler = (pointer, _go, _dx, dy) => {
      if (this.tab !== 'upgrade') return;
      if (pointer.y < TOP || pointer.y > BOTTOM) return;
      if (maxScroll <= 0) return;
      sv = Phaser.Math.Clamp(sv + dy * 0.5, 0, maxScroll);
      scroll.y = -sv;
    });
  }

  _upGroupLabel(id) {
    if (id === '__sec__') return 'ВТОРОЕ ОРУЖИЕ';
    if (id === 'Common') return 'ОБЩЕЕ';
    try {
      const cd = classDefinitions.find(v => v.id === id);
      if (cd) return cd.label.toUpperCase();
    } catch (e) {}
    return id;
  }

  _upGroupColor(id) {
    if (id === '__sec__') return 0xc9a86a;
    if (id === 'Common') return 0x99aacc;
    try {
      const cd = classDefinitions.find(v => v.id === id);
      if (cd && Number.isFinite(cd.color)) return cd.color;
    } catch (e) {}
    return 0x99aacc;
  }

  // Стена оружейки: перфопанель (+ лампа опционально). Перфорация —
  // статикой через TileSprite (1 draw call), а не ~2000 fillCircle
  // в живом Graphics: живой перестраивал геометрию каждый кадр и ронял FPS.
  _upWall(cont, x, y, w, h, withLamp) {
    const g = this.add.graphics();
    g.fillStyle(0x14161f, 1);
    g.fillRoundedRect(x - 14, y - 14, w + 28, h + 28, 10);
    g.lineStyle(2, 0x2a2f45, 1);
    g.strokeRoundedRect(x - 14, y - 14, w + 28, h + 28, 10);
    cont.add(g);
    try {
      if (!this.textures.exists('__perf_dot')) {
        const t = this.make.graphics({ x: 0, y: 0 }, false);
        t.fillStyle(0x000000, 0.35);
        t.fillCircle(8, 8, 1.6);
        t.fillCircle(24, 8, 1.6);
        t.fillCircle(8, 24, 1.6);
        t.fillCircle(24, 24, 1.6);
        t.generateTexture('__perf_dot', 32, 32);
        t.destroy();
      }
      cont.add(this.add.tileSprite(x + w / 2, y + h / 2, w, h, '__perf_dot'));
    } catch (e) { /* стена без перфорации — вкладку не роняет */ }
    if (!withLamp) return;
    const lamp = this.add.graphics();
    lamp.fillStyle(0xfff2cc, 0.95);
    lamp.fillRoundedRect(x + w / 2 - 130, y - 34, 260, 7, 3);
    lamp.fillStyle(0xfff2cc, 0.06);
    lamp.fillRect(x - 14, y - 26, w + 28, 90);
    cont.add(lamp);
  }

  // Ствол на креплениях + латунная табличка (как было в UpgradeScene).
  // Полоска цвета класса слева — маркер ряда (в магазине её нет).
  _upCard(cont, cx, cy, w, cw, ch, clsColor) {
    let lv = 0;
    try { lv = getWeaponLevel(w.name); } catch (e) {}
    const price = nextUpgradeCost(w.name);
    const g = this.add.graphics();
    g.fillStyle(0x0d0f18, 0.88);
    g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 8);
    if (lv >= 4) g.lineStyle(lv >= 5 ? 3 : 2, lv >= 5 ? 0xffe97a : 0xffd24a);
    else g.lineStyle(1, 0x333a55);
    g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 8);
    try {
      g.fillStyle(Number.isFinite(clsColor) ? clsColor : 0x99aacc, 1);
      g.fillRect(cx - cw / 2, cy - ch / 2 + 6, 5, ch - 12);
    } catch (e) {}
    g.fillStyle(0x05060c, 1);
    g.fillRect(cx - 62, cy - 22, 7, 12);
    g.fillRect(cx + 55, cy - 22, 7, 12);
    cont.add(g);
    let hasImg = false;
    try {
      const key = weaponImage(w.name);
      if (key && key !== weaponIcon(w.name) && this.textures.exists(key)) {
        const img = this.add.image(cx, cy - 14, key);
        const src = this.textures.get(key).getSourceImage();
        if (src && src.width && src.height) {
          img.setScale(Math.min(176 / src.width, 34 / src.height));
        } else {
          img.setDisplaySize(176, 30);
        }
        try {
          if (img.displayWidth > cw - 12 || img.displayHeight > 40) {
            const k = Math.min((cw - 12) / img.displayWidth, 40 / img.displayHeight);
            img.setScale(img.scaleX * k);
          }
        } catch (e) {}
        cont.add(img);
        hasImg = true;
      }
    } catch (e) {}
    const labelY = hasImg ? cy + 8 : cy - 14;
    const nm = this.add.text(cx, labelY, `${getWeaponLabel(w.name)}${lv > 0 ? ` +${lv}` : ''}`, {
      fontSize: '13px', color: lv >= 4 ? '#ffd24a' : '#ffffff', fontStyle: 'bold', align: 'center',
      backgroundColor: '#2a2416', padding: 3,
      wordWrap: { width: cw - 12 }
    }).setOrigin(0.5);
    cont.add(nm);

    if (price == null || lv >= 5) {
      const pr = this.add.text(cx, labelY + 19, 'МАКС', {
        fontSize: '11px', color: '#88dd88', fontStyle: 'bold', align: 'center'
      }).setOrigin(0.5);
      cont.add(pr);
    } else {
      // 5 кружочков: изначально пустые, при каждом уровне 1 закрашивается
      const dg = this.add.graphics();
      const dotR = 3.5;
      const step = 13;
      const startX = cx - (4 * step) / 2;
      const dotY = labelY + 19;
      for (let i = 0; i < 5; i++) {
        const dotX = startX + i * step;
        if (i < lv) {
          // Закрашенный кружок (прокачан)
          dg.fillStyle(0xffd24a, 1);
          dg.fillCircle(dotX, dotY, dotR);
          dg.lineStyle(1, 0xfff088, 1);
          dg.strokeCircle(dotX, dotY, dotR);
          dg.fillStyle(0xffffff, 0.7);
          dg.fillCircle(dotX - 1, dotY - 1, 1);
        } else {
          // Пустой кружок
          dg.fillStyle(0x151c28, 0.6);
          dg.fillCircle(dotX, dotY, dotR);
          dg.lineStyle(1.2, 0x4a5577, 1);
          dg.strokeCircle(dotX, dotY, dotR);
        }
      }
      cont.add(dg);
    }
    const hit = this.add.rectangle(cx, cy, cw, ch, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => nm.setStyle({ color: '#ffff55' }));
    hit.on('pointerout', () => nm.setStyle({ color: lv >= 4 ? '#ffd24a' : '#ffffff' }));
    hit.on('pointerdown', () => this._openUpgradeModal(w.name));
    cont.add(hit);
  }

  _openUpgradeModal(name, justUpgraded = false) {
    try { this._closeUpgradeModal(); } catch (e) {}
    try { if (!isUpgradeable(name)) return; } catch (e) { return; }
    const lv = getWeaponLevel(name);
    const price = nextUpgradeCost(name);
    const label = getWeaponLabel(name);
    const cx = gameW(this) / 2, cy = 360, W = 490, H = 290;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(300);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeUpgradeModal());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(301)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);
    elems.push(this.add.text(cx, cy - H / 2 + 22, `УЛУЧШЕНИЕ · ${label}`, {
      fontSize: '18px', color: '#ffdd88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));

    const isMax = price == null;
    const plateW = 430;
    const plateH = 25;
    const plateGap = 5;
    const plateStartY = cy - H / 2 + 46;

    UPGRADE_BONUS.forEach((b, i) => {
      const done = i < lv, next = i === lv;
      const mark = done ? '✓' : (next ? '→' : '·');
      const isJustCompleted = justUpgraded && i === lv - 1;
      const py = plateStartY + plateH / 2 + i * (plateH + plateGap);

      // Аккуратная плашка строки улучшения
      const pl = this.add.graphics().setDepth(302);
      elems.push(pl);

      const r = 6;
      if (done) {
        pl.fillStyle(0x132619, 0.7);
        pl.fillRoundedRect(cx - plateW / 2, py - plateH / 2, plateW, plateH, r);
        pl.lineStyle(1, 0x2e663e, 0.85);
        pl.strokeRoundedRect(cx - plateW / 2, py - plateH / 2, plateW, plateH, r);
      } else if (next) {
        pl.fillStyle(0x282010, 0.9);
        pl.fillRoundedRect(cx - plateW / 2, py - plateH / 2, plateW, plateH, r);
        pl.fillStyle(0xffffff, 0.08);
        pl.fillRoundedRect(cx - plateW / 2, py - plateH / 2, plateW, 5, { tl: r, tr: r, bl: 0, br: 0 });
        pl.lineStyle(1.5, 0xffd24a, 1);
        pl.strokeRoundedRect(cx - plateW / 2, py - plateH / 2, plateW, plateH, r);
      } else {
        pl.fillStyle(0x101322, 0.5);
        pl.fillRoundedRect(cx - plateW / 2, py - plateH / 2, plateW, plateH, r);
        pl.lineStyle(1, 0x222638, 0.6);
        pl.strokeRoundedRect(cx - plateW / 2, py - plateH / 2, plateW, plateH, r);
      }

      const txt = this.add.text(cx, py, `${mark} +${i + 1}: ${b}`, {
        fontSize: '13px',
        color: isJustCompleted ? '#ffffff' : (done ? '#77cc88' : (next ? '#ffd24a' : '#667788')),
        fontStyle: (next || isJustCompleted) ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(303);
      elems.push(txt);

      if (isJustCompleted) {
        txt.setScale(1.2);
        this.tweens.add({
          targets: txt,
          scaleX: 1,
          scaleY: 1,
          duration: 350,
          ease: 'Back.Out',
          onComplete: () => {
            try { txt.setStyle({ color: '#77cc88' }); } catch (e) {}
          }
        });
      }
    });

    if (isMax) {
      elems.push(this.add.text(cx, cy + H / 2 - 76, 'МАКСИМУМ', {
        fontSize: '13px', color: '#88dd88', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(302));
    }

    const canAfford = !isMax && (Number(gameState.coins) || 0) >= price;
    const by = cy + H / 2 - 42;
    const bh = 42;

    if (justUpgraded) {
      const targetY = plateStartY + plateH / 2 + Math.max(0, lv - 1) * (plateH + plateGap);
      this._playUpgradeEffect(cx, targetY, isMax, elems);
      this.tweens.add({
        targets: bg,
        scaleX: 1.018,
        scaleY: 1.018,
        duration: 90,
        yoyo: true,
        ease: 'Quad.Out'
      });
    }

    const probeOk = this.add.text(0, 0, isMax ? 'МАКСИМУМ' : `УЛУЧШИТЬ · ${price}`, {
      fontSize: '15px', fontStyle: 'bold'
    });
    const okTextW = Math.ceil(probeOk.displayWidth);
    probeOk.destroy();

    const okContentW = isMax ? okTextW : (okTextW + 8 + 20);
    const okW = isMax ? Math.max(150, okTextW + 36) : Math.max(200, Math.round(okContentW + 36));

    const probeClose = this.add.text(0, 0, 'ЗАКРЫТЬ', {
      fontSize: '15px', fontStyle: 'bold'
    });
    const closeTextW = Math.ceil(probeClose.displayWidth);
    probeClose.destroy();
    const closeW = Math.max(140, Math.round(closeTextW + 40));

    const btnGap = 24;
    const totalBtnW = okW + btnGap + closeW;
    const okX = Math.round(cx - totalBtnW / 2 + okW / 2);
    const closeX = Math.round(cx - totalBtnW / 2 + okW + btnGap + closeW / 2);

    // Кнопка УЛУЧШИТЬ в стиле меню БАНДЫ: скругление 8px, верхний блик,
    // аккуратная рамка со свечением при ховере, иконка монет после числа.
    const okFr = this.add.graphics().setDepth(302);
    elems.push(okFr);

    const okBgc = isMax ? 0x1c1c30 : (canAfford ? 0x1e4a24 : 0x2d1f1f);
    const okBrc = isMax ? 0x3a3a55 : (canAfford ? 0x35d07f : 0x884444);
    const okCol = isMax ? '#667788' : (canAfford ? '#ffffff' : '#ffaaaa');

    const paintOk = (hot) => {
      try {
        okFr.clear();
        okFr.fillStyle(okBgc, 1);
        okFr.fillRoundedRect(okX - okW / 2, by - bh / 2, okW, bh, 8);
        okFr.fillStyle(0xffffff, hot ? 0.14 : 0.07);
        okFr.fillRoundedRect(okX - okW / 2, by - bh / 2, okW, 6, { tl: 8, tr: 8, bl: 0, br: 0 });
        okFr.lineStyle(hot ? 2.5 : 1.5, hot ? (canAfford ? 0xffff88 : 0xff7777) : okBrc, 1);
        okFr.strokeRoundedRect(okX - okW / 2, by - bh / 2, okW, bh, 8);
      } catch (e) {}
    };
    paintOk(false);

    let okTxt = null;
    let okCoin = null;
    if (isMax) {
      okTxt = this.add.text(okX, by, 'МАКСИМУМ', {
        fontSize: '15px', color: okCol, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(303);
      elems.push(okTxt);
    } else {
      const okStartX = Math.round(okX - okContentW / 2);
      okTxt = this.add.text(okStartX, by, `УЛУЧШИТЬ · ${price}`, {
        fontSize: '15px', color: okCol, fontStyle: 'bold'
      }).setOrigin(0, 0.5).setDepth(303);
      elems.push(okTxt);

      okCoin = this.add.image(okStartX + okTextW + 8, by, 'icon_coins')
        .setOrigin(0, 0.5)
        .setDisplaySize(20, 15)
        .setDepth(303);
      if (!canAfford) okCoin.setTint(0xff8888);
      elems.push(okCoin);
    }

    if (!isMax) {
      const okHit = this.add.rectangle(okX, by, okW, bh, 0xffffff, 0)
        .setDepth(304)
        .setInteractive({ useHandCursor: true });
      elems.push(okHit);

      okHit.on('pointerover', () => {
        paintOk(true);
        if (okTxt) okTxt.setStyle({ color: canAfford ? '#ffff55' : '#ffcccc' });
      });
      okHit.on('pointerout', () => {
        paintOk(false);
        if (okTxt) okTxt.setStyle({ color: okCol });
      });
      okHit.on('pointerdown', () => {
        if (!canAfford) {
          this._denyToast(`Не хватает монет: нужно ${price}`, 400);
          return;
        }
        const r = upgradeWeapon(name);
        if (!r.ok) return;
        this._sfxBuy();
        try { this.redrawTab(); } catch (e) {}
        this._openUpgradeModal(name, true);
      });
    }

    // Кнопка ЗАКРЫТЬ в стиле меню БАНДЫ: тёмно-красный фон, кант, ховер
    const closeFr = this.add.graphics().setDepth(302);
    elems.push(closeFr);

    const closeBgc = 0x4a1e1e;
    const closeBrc = 0xd05555;
    const closeCol = '#ffffff';

    const paintClose = (hot) => {
      try {
        closeFr.clear();
        closeFr.fillStyle(closeBgc, 1);
        closeFr.fillRoundedRect(closeX - closeW / 2, by - bh / 2, closeW, bh, 8);
        closeFr.fillStyle(0xffffff, hot ? 0.14 : 0.07);
        closeFr.fillRoundedRect(closeX - closeW / 2, by - bh / 2, closeW, 6, { tl: 8, tr: 8, bl: 0, br: 0 });
        closeFr.lineStyle(hot ? 2.5 : 1.5, hot ? 0xffff88 : closeBrc, 1);
        closeFr.strokeRoundedRect(closeX - closeW / 2, by - bh / 2, closeW, bh, 8);
      } catch (e) {}
    };
    paintClose(false);

    const closeTxt = this.add.text(closeX, by, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: closeCol, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303);
    elems.push(closeTxt);

    const closeHit = this.add.rectangle(closeX, by, closeW, bh, 0xffffff, 0)
      .setDepth(304)
      .setInteractive({ useHandCursor: true });
    elems.push(closeHit);

    closeHit.on('pointerover', () => {
      paintClose(true);
      closeTxt.setStyle({ color: '#ffff55' });
    });
    closeHit.on('pointerout', () => {
      paintClose(false);
      closeTxt.setStyle({ color: closeCol });
    });
    closeHit.on('pointerdown', () => this._closeUpgradeModal());
    this._upModal = elems;
  }

  _closeUpgradeModal() {
    try {
      const m = this._upModal;
      this._upModal = null;
      if (m) m.forEach(o => { try { o.destroy(); } catch (e) {} });
    } catch (e) {}
  }

  // Эффект улучшения: золотая ударная волна, сноп искр и всплывающая плашка
  _playUpgradeEffect(cx, targetY, isMax, elems) {
    try {
      // 1. Расширяющееся золотое кольцо-ударная волна
      const ring = this.add.circle(cx, targetY, 18, 0x35d07f, 0).setDepth(310);
      ring.setStrokeStyle(3, 0xffd24a, 1);
      if (elems) elems.push(ring);
      this.tweens.add({
        targets: ring,
        scale: 4.8,
        alpha: 0,
        duration: 520,
        ease: 'Quad.Out',
        onComplete: () => { try { ring.destroy(); } catch (e) {} }
      });

      // 2. Вспышка золотых и изумрудных искр во все стороны
      const pCount = isMax ? 26 : 20;
      for (let i = 0; i < pCount; i++) {
        const ang = (Math.PI * 2 * i) / pCount + (Math.random() - 0.5) * 0.35;
        const dist = 38 + Math.random() * (isMax ? 85 : 60);
        const r = 2.2 + Math.random() * 2.4;
        const col = (i % 3 === 0) ? 0xffffff : (i % 3 === 1 ? 0xffd24a : 0x35d07f);
        const p = this.add.circle(cx, targetY, r, col, 1).setDepth(311);
        if (elems) elems.push(p);
        this.tweens.add({
          targets: p,
          x: cx + Math.cos(ang) * dist,
          y: targetY + Math.sin(ang) * dist * 0.75,
          alpha: 0,
          scale: 0.1,
          duration: 380 + Math.random() * 260,
          ease: 'Cubic.Out',
          onComplete: () => { try { p.destroy(); } catch (e) {} }
        });
      }

      // 3. Всплывающая плашка с поздравлением
      const label = isMax ? 'МАКСИМАЛЬНЫЙ УРОВЕНЬ! ★' : '+1 УРОВЕНЬ! ★';
      const pop = this.add.text(cx, targetY, label, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: isMax ? '#ffd24a' : '#99ffaa'
      }).setOrigin(0.5).setDepth(312);
      pop.setStroke('#111124', 4);
      pop.setScale(0.7);
      if (elems) elems.push(pop);
      this.tweens.add({
        targets: pop,
        y: targetY - 32,
        scale: 1.15,
        alpha: 0,
        duration: 750,
        ease: 'Back.Out',
        onComplete: () => { try { pop.destroy(); } catch (e) {} }
      });
    } catch (e) { /* эффект не роняет окно */ }
  }

  // Ячейка с реальным PNG оружия выше, чтобы арт влез без искажений
  cellHeight(weapon, iconH, gunH) {
    const imgKey = weaponImage(weapon.name);
    const hasGunImg = imgKey && imgKey !== weaponIcon(weapon.name) && this.textures.exists(imgKey);
    return hasGunImg ? gunH : iconH;
  }

  drawCellBg(bg, w, h, state, hover = false) {
    bg.clear();
    if (state === 'owned') {
      bg.fillStyle(hover ? 0x184224 : 0x112d19, 0.94);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.fillStyle(0xffffff, 0.08);
      bg.fillRoundedRect(0, 0, w, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
      bg.lineStyle(hover ? 2 : 1.5, hover ? 0x66ff88 : 0x33aa55, 1);
      bg.strokeRoundedRect(0, 0, w, h, 8);
    } else if (state === 'locked') {
      bg.fillStyle(0x10121d, 0.8);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(1, 0x252a3c, 0.9);
      bg.strokeRoundedRect(0, 0, w, h, 8);
    } else {
      bg.fillStyle(hover ? 0x1e2646 : 0x12162a, 0.94);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.fillStyle(0xffffff, hover ? 0.12 : 0.05);
      bg.fillRoundedRect(0, 0, w, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
      bg.lineStyle(hover ? 2 : 1.5, hover ? 0xffd24a : 0x3b4a70, 1);
      bg.strokeRoundedRect(0, 0, w, h, 8);
    }
  }

  cellState(weapon) {
    if (hasWeapon(weapon.name)) return 'owned';
    if (gameState.level < weapon.unlockLevel) return 'locked';
    return 'normal';
  }

  createShopCell(x, y, weapon, w, h, parentContainer) {
    const state = this.cellState(weapon);
    const container = this.add.container(x, y);
    container.setDepth(5);

    const bg = this.add.graphics();
    this.drawCellBg(bg, w, h, state);
    container.add(bg);

    const imgKey = weaponImage(weapon.name);
    const hasGunImg = imgKey && imgKey !== weaponIcon(weapon.name) && this.textures.exists(imgKey);
    let nameText;

    if (hasGunImg) {
      const img = this.add.image(w / 2, h / 2 - 8, imgKey);
      const src = this.textures.get(imgKey).getSourceImage();
      if (src && src.width && src.height) {
        const scale = Math.min((w - 20) / src.width, (h - 16) / src.height);
        img.setScale(scale);
      } else {
        img.setDisplaySize(w - 20, 28);
      }
      container.add(img);
      nameText = this.add.text(w / 2, h - 9, getWeaponLabel(weapon.name), {
        fontSize: '12px',
        color: state === 'owned' ? '#88dd88' : state === 'locked' ? '#8899aa' : '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add(nameText);
    } else {
      container.add(this.add.image(24, h / 2, imgKey).setDisplaySize(42, 16));
      nameText = this.add.text(52, 2, getWeaponLabel(weapon.name), {
        fontSize: '12px',
        color: state === 'owned' ? '#88dd88' : state === 'locked' ? '#8899aa' : '#ffffff',
        fontStyle: 'bold'
      });
      container.add(nameText);
    }

    const priceText = this.add.text(hasGunImg ? w - 8 : 52, hasGunImg ? 6 : 20,
      state === 'owned' ? '✓' : `${weapon.price}`,
      {
        fontSize: '11px',
        color: state === 'owned' ? '#88dd88' : state === 'locked' ? '#667788' : '#ffee88'
      });
    if (hasGunImg) priceText.setOrigin(1, 0);
    container.add(priceText);

    // Значок стопки долларов рядом с ценой (вместо слова «монет»).
    const priceIcon = this.add.image(0, 0, 'icon_coins');
    priceIcon.setDisplaySize(13, 10);
    container.add(priceIcon);

    let lockText = null;
    if (state === 'locked') {
      lockText = this.add.text(w - 8, h / 2, `🔒 ур.${weapon.unlockLevel}`, {
        fontSize: '15px',
        color: '#ccdddd'
      }).setOrigin(1, 0.5);
      container.add(lockText);
    }

    // Ховер и тултип — у ВСЕХ ячеек, включая купленные и закрытые.
    // Хитзона ВНУТРИ контейнера (иначе переживает смену вкладки и в других
    // вкладках висят невидимые покупаемые ячейки). Клик покупает только
    // доступное: buy() сам отбивает остальное.
    {
      const hitZone = this.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0);
      container.add(hitZone);

      hitZone.on('pointerover', () => {
        this.showTooltipFor(weapon);
        const live = this.cellState(weapon);
        try {
          if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
            this.sound.play('sfx_hover', { volume: 0.15 });
          }
        } catch (e) { /* noop */ }
        this.drawCellBg(bg, w, h, live, true);
      });
      hitZone.on('pointerout', () => {
        this.hideTooltip();
        const live = this.cellState(weapon);
        this.drawCellBg(bg, w, h, live, false);
      });

      hitZone.setInteractive({ useHandCursor: state === 'normal' });
      hitZone.on('pointerdown', () => {
        this.buy(weapon);
      });
    }

    this.shopItems.push({ weapon, container, bg, nameText, priceText, priceIcon, lockText, h, w });
    if (parentContainer) parentContainer.add(container);
    this._syncCellCoin(this.shopItems[this.shopItems.length - 1]);
  }

  // Цена цифрой + значок монет рядом. У ячеек с картинкой цена прижата вправо —
  // значок слева от неё; у иконок — справа от текста. Куплено — значка нет.
  _syncCellCoin(cell) {
    if (!cell || !cell.priceIcon || !cell.priceText || !cell.weapon) return;
    const owned = hasWeapon(cell.weapon.name);
    cell.priceIcon.setVisible(!owned);
    if (owned) return;
    cell.priceText.setText(`${cell.weapon.price}`);
    if (cell.priceText.originX === 1) {
      cell.priceIcon.setOrigin(1, 0.5);
      cell.priceIcon.setPosition(
        cell.priceText.x - cell.priceText.displayWidth - 5,
        cell.priceText.y + 8
      );
    } else {
      cell.priceIcon.setOrigin(0, 0.5);
      cell.priceIcon.setPosition(
        cell.priceText.x + cell.priceText.displayWidth + 5,
        cell.priceText.y + 7
      );
    }
  }

  // Слот вещи: голова, ноги, торс или штаны.
  _appearOwned(item) {
    if (item.slot === 'shoes') return hasShoes(item.tex);
    if (item.slot === 'torso') return hasTorso(item.tex);
    if (item.slot === 'pants') return hasPants(item.tex);
    return hasHead(item.tex);
  }

  // Внешность надевается на последний выбранный класс (у каждого класса
  // свой наряд — см. вкладку ГАРДЕРОБ в инвентаре; купленное общее).
  _appearCls() {
    try {
      const c = (typeof gameState !== 'undefined' && gameState.lastClass) || 'Assault';
      if (['Assault', 'Tank', 'Medic', 'Sniper'].includes(c)) return c;
    } catch (e) {}
    return 'Assault';
  }

  _appearEquipped(item) {
    const wc = this._appearCls();
    if (item.slot === 'shoes') return getEquippedShoes(wc) === item.tex;
    if (item.slot === 'torso') return getEquippedTorso(wc) === item.tex;
    if (item.slot === 'pants') return getEquippedPants(wc) === item.tex;
    return getEquippedHead(wc) === item.tex;
  }

  // Тултип внешности — как статы оружия: что это и что будет по клику.

  // Значок монет слева от цены в ячейке внешности (текст центрирован).
  _syncHeadCoin(cell) {
    if (!cell || !cell.priceIcon || !cell.priceText) return;
    const isPrice = /^\d+$/.test(cell.priceText.text);
    cell.priceIcon.setVisible(isPrice);
    if (!isPrice) return;
    cell.priceIcon.setPosition(
      cell.priceText.x - cell.priceText.displayWidth / 2 - 4,
      cell.priceText.y
    );
  }

  refreshHeadCell(cell) {
    const { item, bg } = cell;
    const owned = this._appearOwned(item);
    const equipped = this._appearEquipped(item);
    const locked = false /* уровень не нужен: одежда из кейса */;

    bg.clear();
    if (equipped) bg.fillStyle(0x224422, 0.9);
    else if (owned) bg.fillStyle(0x1a3a2a, 0.9);
    else if (locked) bg.fillStyle(0x333333, 0.45);
    else bg.fillStyle(0x1a1a4a, 0.9);
    bg.fillRoundedRect(0, 0, cell.cellW, cell.cellH, 6);
    if (equipped) bg.lineStyle(2, 0x44cc44);
    else bg.lineStyle(1, locked ? 0x555555 : 0x4466aa);
    bg.strokeRoundedRect(0, 0, cell.cellW, cell.cellH, 6);
  }

  buy(weapon) {
    if (this.tab !== 'weapons') return;
    if (hasWeapon(weapon.name)) {
      return;
    }

    // Молчаливый отказ вводил в заблуждение («открыто, но не купить»):
    // объясняем причину тостом.
    // Прицел по классу: ствол закрытого класса не купить раньше класса
    // (лесенки и так совпадают, но старые сейвы/данные — страхуем).
    // Вторички общие — только уровень.
    const wcls = classOfWeapon(weapon.name);
    if (wcls && wcls !== 'Common' && !isClassUnlocked(wcls, gameState.level)) {
      const lbl = (classDefinitions.find(c => c.id === wcls) || {}).label || wcls;
      this._denyToast(`Класс «${lbl}» откроется на ур. ${classOpenLevel(wcls)}`);
      return;
    }
    if (gameState.level < weapon.unlockLevel) {
      this._denyToast(`Откроется на уровне ${weapon.unlockLevel}`);
      return;
    }
    if (gameState.coins < weapon.price) {
      this._denyToast(`Не хватает монет: нужно ${weapon.price}`);
      return;
    }

    gameState.coins -= weapon.price;
    unlockWeapon(weapon.name);
    saveGameState();
    this._sfxBuy();
    this.refresh();
    this.hideTooltip();
  }

  // Короткий отказ-тост по центру низа (клик по недоступному).
  _denyToast(text, depth = 100) {
    try {
      if (this._denyTxt) {
        try { this._denyTxt.destroy(); } catch (e) {}
        this._denyTxt = null;
      }
      const _cx = gameW(this) / 2;
      const t = this.add.text(_cx, 690, text, {
        fontSize: '16px', fontStyle: 'bold', color: '#ff8888',
        backgroundColor: '#111133dd', padding: 8
      }).setOrigin(0.5).setDepth(depth);
      this._denyTxt = t;
      this.tweens.add({
        targets: t, alpha: 0, y: 670, duration: 1500,
        onComplete: () => {
          try {
            if (this._denyTxt === t) {
              t.destroy();
              this._denyTxt = null;
            }
          } catch (e) {}
        }
      });
    } catch (e) { /* тост не роняет магазин */ }
  }

  // Звук любой покупки в магазине (п.2): сначала sfx_buy из кэша,
  // запасной вариант — прямой Audio по файлу (если ключ не загрузился).
  _sfxBuy() {
    try {
      if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
        this.sound.play('sfx_buy', { volume: 0.6 });
        return;
      }
    } catch (e) { /* пробуем фолбэк */ }
    try {
      const a = new Audio('assets/sounds/Звук покупки.mp3');
      a.volume = 0.6;
      a.play().catch(() => {});
    } catch (e) { /* noop */ }
  }

  // Значок монет после цены loose-текста (гранаты): x — за правым краем.

  refresh() {
    this.coinsText.setText(`${gameState.coins}`);

    this.shopItems.forEach(cell => {
      const state = this.cellState(cell.weapon);
      this.drawCellBg(cell.bg, cell.w || 190, cell.h, state);

      cell.nameText.setText(getWeaponLabel(cell.weapon.name));
      cell.nameText.setColor(state === 'owned' ? '#88dd88' : state === 'locked' ? '#8899aa' : '#ffffff');

      cell.priceText.setText(state === 'owned' ? 'КУПЛЕНО ✓' : `${cell.weapon.price}`);
      cell.priceText.setColor(state === 'owned' ? '#88dd88' : state === 'locked' ? '#667788' : '#ffee88');
      this._syncCellCoin(cell);

      if (cell.lockText) {
        cell.lockText.setVisible(state === 'locked');
        cell.lockText.setText(`🔒 ур.${cell.weapon.unlockLevel}`);
      }
    });

    // Рядов гранат больше нет (вкладка «Гранаты» удалена из магазина).

    if (this.headCells) {
      this.headCells.forEach(cell => {
        this.refreshHeadCell(cell);
        const owned = this._appearOwned(cell.item);
        const equipped = this._appearEquipped(cell.item);
        const locked = false /* уровень не нужен: одежда из кейса */;

        cell.lbl.setColor(owned ? '#88dd88' : locked ? '#8899aa' : '#ffffff');

        if (equipped) {
          cell.priceText.setText('Надето');
          cell.priceText.setColor('#88dd88');
        } else if (owned) {
          cell.priceText.setText('Надеть');
          cell.priceText.setColor('#ffee88');
        } else if (locked) {
          cell.priceText.setText(`🔒 ур.${cell.item.unlockLevel}`);
          cell.priceText.setColor('#667788');
        } else {
          cell.priceText.setText('Из кейса');
          cell.priceText.setColor('#66d9e8');
        }
        // Значок монет слева от цены-цифры; в остальных состояниях скрыт.
        this._syncHeadCoin(cell);
      });
    }
  }

  drawTooltip() {
    this.tooltipBg = this.add.graphics();
    this.tooltipTitle = this.add.text(0, 0, '', { fontSize: '16px', color: '#ffee88' });
    this.tooltipText = this.add.text(0, 0, '', {
      fontSize: '13px', color: '#e0e0e0', lineSpacing: 4
    });
    this.tooltipBg.setDepth(100);
    this.tooltipTitle.setDepth(101);
    this.tooltipText.setDepth(101);
    this.tooltipBg.setScrollFactor(0);
    this.tooltipTitle.setScrollFactor(0);
    this.tooltipText.setScrollFactor(0);
    this.hideTooltip();
  }

  showTooltipFor(weapon) {
    // Тултип оружия — только во вкладке оружия (п.3): в гранатах/внешности
    // зависшие хитзоны не должны показывать статы и давать покупать.
    if (this.tab !== 'weapons' || !weapon) return;

    const isMelee = weapon.category === 'melee';
    const rate = Math.round(60000 / weapon.fireRate);
    // Ближний бой: только урон и удары в минуту (скорострельности нет).
    const lines = isMelee
      ? [
        `Урон: ${weapon.damage}`,
        `Ударов в минуту: ${rate}`
      ]
      : (() => {
        const spread = weapon.spreadDeg != null ? weapon.spreadDeg : 2.0;
        const accuracy = Math.max(1, Math.round(100 - spread * 22));
        return [
          `Урон: ${weapon.damage}`,
          `Темп: ${rate} выстр/мин`,
          `Магазин: ${weapon.magazineSize}`,
          `Запас: ${weapon.reserveAmmo}`,
          `Дальность: ${weapon.range}`,
          `Точность: ${accuracy}%`,
          `Перезарядка: ${(weapon.reloadTime / 1000).toFixed(1)} с`,
          `Патрон: ${weapon.ammoType}`
        ];
      })();

    if (!hasWeapon(weapon.name)) {
      lines.push(`Цена: ${weapon.price} монет`, `Открывается на ур.${weapon.unlockLevel}`);
    }

    this.tooltipTitle.setText(getWeaponLabel(weapon.name));
    this.tooltipText.setText(lines.join('\n'));

    const w = 230;
    const h = 20 + 26 + lines.length * 18;

    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x0e1124, 0.96);
    this.tooltipBg.fillRoundedRect(0, 0, w, h, 8);
    this.tooltipBg.lineStyle(1.5, 0xffd24a, 0.9);
    this.tooltipBg.strokeRoundedRect(0, 0, w, h, 8);

    // Кламп по экрану 1280×720: у нижнего ряда тултип всплывает НАД курсором,
    // справа — левее курсора. Раньше уходил за край.
    let px = this.input.activePointer.worldX + 12;
    let py = this.input.activePointer.worldY + 12;
    if (px + w > gameW(this) - 8) px = this.input.activePointer.worldX - 12 - w;
    if (py + h > 712) py = this.input.activePointer.worldY - 12 - h;
    if (px < 8) px = 8;
    if (py < 8) py = 8;

    this.tooltipBg.setPosition(px, py);
    this.tooltipTitle.setPosition(px + 10, py + 8);
    this.tooltipText.setPosition(px + 10, py + 34);
    this.tooltipBg.setVisible(true);
    this.tooltipTitle.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  hideTooltip() {
    if (!this.tooltipBg) return;
    this.tooltipBg.setVisible(false);
    this.tooltipTitle.setVisible(false);
    this.tooltipText.setVisible(false);
  }
}
