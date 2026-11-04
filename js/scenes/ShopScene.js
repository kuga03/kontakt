import { gameW, UX } from '../ui/layout.js?v=3';
import { gameState, hasWeapon, unlockWeapon, saveGameState, hasHead, getEquippedHead, hasShoes, getEquippedShoes, hasTorso, getEquippedTorso, hasPants, getEquippedPants } from '../data/gameState.js?v=175';
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
} from '../data/weapons.js?v=170';

// slot: куда надевается ('head' — на голову, 'shoes' — на ноги).
// cat: столбец вкладки ВНЕШНОСТЬ ('hair' — Волосы, 'hat' — Уборы,
// 'shoes' — Обувь; позже сюда же 'torso' — Торс и 'pants' — Штаны).
// Каталог живёт в data/wardrobe.js (им же пользуется кейс «Гардероб»).
import { GEAR_ITEMS } from '../data/wardrobe.js?v=172';

import {
  getWeaponLevel, nextUpgradeCost, isUpgradeable,
  upgradeWeapon, UPGRADE_MAX, UPGRADE_BONUS
} from '../data/upgrades.js?v=2';

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
    const _cx = gameW(this) / 2;
    this.cameras.main.setBackgroundColor('#0a0a2a');
    this.activeButton = null;
    this.shopItems = [];
    this.headCells = [];
    this.grenadeRows = [];
    this.sectionLabels = [];
    // Сюда приходят на модернизацию из инвентаря (tab: 'upgrade').
    // Донат живёт отдельным экраном DonateScene (пончик из меню).
    const _initTab = data && data.tab;
    this.tab = (_initTab === 'upgrade') ? 'upgrade' : 'weapons';

    this.add.text(_cx, 25, 'СНАРЯЖЕНИЕ', {
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Баланс со значком стопки долларов вместо надписи «Монеты».
    // Сдвинут вправо — слева вверху теперь кнопка «Назад».
    this.coinIcon = this.add.image(UX(this, 140), 40, 'icon_coins').setOrigin(0, 0.5);
    if (this.textures.exists('icon_coins')) {
      this.coinIcon.setDisplaySize(24, 18);
    }
    this.coinsText = this.add.text(UX(this, 170), 30, '', {
      fontSize: '20px',
      color: '#ffee88'
    });

    this.drawTabs();
    this.drawTooltip();
    this.redrawTab();

    this.backBtn = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#553333',
      padding: 8
    }).setOrigin(0.5).setDepth(50);

    this.backBtn.setInteractive({ useHandCursor: true });
    this.backBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
    this.backBtn.on('pointerover', () => this.backBtn.setStyle({ color: '#ffff55' }));
    this.backBtn.on('pointerout', () => this.backBtn.setStyle({ color: '#ffffff' }));

    this.refresh();
  }

  drawTabs() {
    this.tabBtns = [];
    // Центры разнесены ±110 от 640: «ОРУЖИЕ» (~100px) и «МОДЕРНИЗАЦИЯ»
    // (~190px) не налезают друг на друга и на кнопку «Назад».
    // Вкладки — внутри 1280-блока (центр по UX на широком Андроиде).
    const tabs = [
      { id: 'weapons', label: 'ОРУЖИЕ', x: UX(this, 530) },
      { id: 'upgrade', label: 'МОДЕРНИЗАЦИЯ', x: UX(this, 750) }
    ];

    tabs.forEach(t => {
      const btn = this.add.text(t.x, 65, t.label, {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: this.tab === t.id ? '#334466' : '#222244',
        padding: 8
      }).setOrigin(0.5).setDepth(50);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.tab = t.id;
        this.redrawTab();
      });
      btn.on('pointerover', () => {
        if (this.tab !== t.id) btn.setStyle({ color: '#ffff55' });
      });
      btn.on('pointerout', () => {
        if (this.tab !== t.id) btn.setStyle({ color: '#ffffff' });
      });
      this.tabBtns.push({ btn, id: t.id });
    });
  }

  redrawTab() {
    this.tabBtns.forEach(({ btn, id }) => {
      btn.setStyle({
        color: this.tab === id ? '#ffff55' : '#ffffff',
        backgroundColor: this.tab === id ? '#334466' : '#222244'
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
      // Вкладки «внешность» больше нет (и «гранат» тоже) —
      // страховка от битого состояния.
      this.tab = 'weapons';
      this.buildColumns();
    }
    // Цены/состояния ячеек выставляются только здесь: иначе до первой покупки
    // все priceText пустые.
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

    // 6 колонок на 1280: ячейки ужаты 220→190, зазоры 10.
    const COL_X = [40, 240, 440, 640, 840, 1040];
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

      // Подпись класса. Сохраняем в sectionLabels, иначе переживает смену
      // вкладки и висит над «Гранатами»/«Внешностью».
      const colLabel = this.add.text(x, TOP - 18, column.label, {
        fontSize: '15px',
        color: '#88ccff'
      }).setOrigin(0, 0.5);
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
      cont.add(this.add.text(_cx, 360, 'Пока нечего точить — купи первый ствол во вкладке «Оружие».', {
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
    const sub = price == null ? 'МАКС' : `+${lv + 1}: ${UP_NEXT_SHORT[lv]} · ${price}`;
    const pr = this.add.text(cx, labelY + 20, sub, {
      fontSize: '11px', color: price == null ? '#88dd88' : ((gameState.coins | 0) >= price ? '#ffee88' : '#ff8888'), align: 'center',
      wordWrap: { width: cw - 12 }
    }).setOrigin(0.5);
    cont.add(pr);
    const hit = this.add.rectangle(cx, cy, cw, ch, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => nm.setStyle({ color: '#ffff55' }));
    hit.on('pointerout', () => nm.setStyle({ color: lv >= 4 ? '#ffd24a' : '#ffffff' }));
    hit.on('pointerdown', () => this._openUpgradeModal(w.name));
    cont.add(hit);
  }

  _openUpgradeModal(name) {
    try { this._closeUpgradeModal(); } catch (e) {}
    try { if (!isUpgradeable(name)) return; } catch (e) { return; }
    const lv = getWeaponLevel(name);
    const price = nextUpgradeCost(name);
    const label = getWeaponLabel(name);
    const cx = gameW(this) / 2, cy = 360, W = 560, H = 380;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(300);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeUpgradeModal());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(301)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);
    elems.push(this.add.text(cx, cy - H / 2 + 28, `УЛУЧШЕНИЕ · ${label}`, {
      fontSize: '19px', color: '#ffdd88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));

    UPGRADE_BONUS.forEach((b, i) => {
      const done = i < lv, next = i === lv;
      const mark = done ? '✓' : (next ? '→' : '·');
      elems.push(this.add.text(cx, cy - H / 2 + 88 + i * 24, `${mark} +${i + 1}: ${b}`, {
        fontSize: '14px',
        color: done ? '#557755' : (next ? '#ffd24a' : '#667788'),
        fontStyle: next ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(302));
    });
    const priceY = cy - H / 2 + 88 + 5 * 24 + 10;
    elems.push(this.add.text(cx, priceY, price == null ? 'МАКСИМУМ — дальше некуда' : `Цена: ${price} монет (у тебя ${gameState.coins | 0})`, {
      fontSize: '15px', color: price == null ? '#88dd88' : ((gameState.coins | 0) >= price ? '#ffee88' : '#ff8888'), fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));
    const okBtn = this.add.text(cx - 120, cy + H / 2 - 42, price == null ? 'МАКС' : `УЛУЧШИТЬ · ${price}`, {
      fontSize: '15px', color: price == null ? '#667788' : '#ffffff',
      backgroundColor: price == null ? '#22223a' : '#2a5a2a', padding: 8
    }).setOrigin(0.5).setDepth(302);
    elems.push(okBtn);
    if (price != null) {
      okBtn.setInteractive({ useHandCursor: true });
      okBtn.on('pointerover', () => okBtn.setStyle({ color: '#ffff55' }));
      okBtn.on('pointerout', () => okBtn.setStyle({ color: '#ffffff' }));
      okBtn.on('pointerdown', () => {
        const r = upgradeWeapon(name);
        if (!r.ok) return;
        this._sfxBuy();
        try { this._closeUpgradeModal(); } catch (e) {}
        // Остаёмся на той же вкладке (без scene.restart — он сбрасывал таб).
        try { this.redrawTab(); } catch (e) {}
      });
    }
    const closeBtn = this.add.text(cx + 120, cy + H / 2 - 42, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(302);
    elems.push(closeBtn);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeUpgradeModal());
    this._upModal = elems;
  }

  _closeUpgradeModal() {
    try {
      const m = this._upModal;
      this._upModal = null;
      if (m) m.forEach(o => { try { o.destroy(); } catch (e) {} });
    } catch (e) {}
  }

  // Ячейка с реальным PNG оружия выше, чтобы арт влез без искажений
  cellHeight(weapon, iconH, gunH) {
    const imgKey = weaponImage(weapon.name);
    const hasGunImg = imgKey && imgKey !== weaponIcon(weapon.name) && this.textures.exists(imgKey);
    return hasGunImg ? gunH : iconH;
  }

  drawCellBg(bg, w, h, state) {
    bg.clear();
    if (state === 'owned') {
      bg.fillStyle(0x224422, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(2, 0x44aa44);
      bg.strokeRoundedRect(0, 0, w, h, 8);
    } else if (state === 'locked') {
      bg.fillStyle(0x333333, 0.45);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(1, 0x555555);
      bg.strokeRoundedRect(0, 0, w, h, 8);
    } else {
      bg.fillStyle(0x1a1a4a, 0.9);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(1, 0x4466aa);
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
            this.sound.play('sfx_hover', { volume: 0.2 });
          }
        } catch (e) { /* noop */ }
        bg.clear();
        this.drawCellBg(bg, w, h, live);
        bg.lineStyle(2, 0xffee55);
        bg.strokeRoundedRect(0, 0, w, h, 8);
      });
      hitZone.on('pointerout', () => {
        this.hideTooltip();
        const live = this.cellState(weapon);
        bg.clear();
        this.drawCellBg(bg, w, h, live);
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
  _denyToast(text) {
    try {
      if (this._denyTxt) {
        try { this._denyTxt.destroy(); } catch (e) {}
        this._denyTxt = null;
      }
      const _cx = gameW(this) / 2;
      const t = this.add.text(_cx, 690, text, {
        fontSize: '16px', fontStyle: 'bold', color: '#ff8888',
        backgroundColor: '#111133dd', padding: 8
      }).setOrigin(0.5).setDepth(100);
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
    this.tooltipBg.fillStyle(0x000000, 0.85);
    this.tooltipBg.fillRoundedRect(0, 0, w, h, 8);
    this.tooltipBg.lineStyle(1, 0xaa8844);
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
