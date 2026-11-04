import { gameW } from '../../ui/layout.js?v=3';
import { gameState, saveGameState, addCoins } from '../../data/gameState.js?v=175';
import { getWeaponLabel } from '../../data/weapons.js?v=170';
import { weaponSkins, RARITY } from '../../data/skins.js?v=169';

import { isGenomeMaxed } from '../../data/genes.js?v=169';
import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

const HEAD_COLORS = [
  '#ffe0c8', '#ffc8a0', '#d49a6a', '#8b5a2b',
  '#4a2f18', '#c8e6ff', '#ffdce8', '#e8e8e8'
];

const BODY_COLORS = [
  '#44ccff', '#ff5555', '#55ff55', '#ffee55', '#ff55ff',
  '#ffaa44', '#aa44ff', '#00ccaa', '#888888', '#ffffff'
];

const EQUIP_SLOTS = [
  { x: 1030, y: 430, slot: 'primary', label: 'ОСНОВНОЕ' },
  { x: 1030, y: 498, slot: 'secondary', label: 'ВТОРОЕ' },
  { x: 1030, y: 566, slot: 'melee', label: 'БЛИЖНЕЕ' }
];

const COMPARE_SLOTS = [
  { x: 300, y: 565, slot: 0 },
  { x: 500, y: 565, slot: 1 }
];

export function _openContractModal() {
    if (this._contractModal) return;
    this._contractSel = [];
    const W = 560, H = 480;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    // Клик по фону и ESC тоже закрывают (приз уже начислен до показа —
    // потерять его закрытием нельзя).
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeContractModal());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0xffd24a, 1);
    const title = this.add.text(cx, cy - H / 2 + 24, 'КОНТРАКТ ОБМЕНА', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202);
    const status = this.add.text(cx, cy - H / 2 + 50, 'Выбери 5 скинов одной редкости', {
      fontSize: '13px', color: '#99aacc', align: 'center', lineSpacing: 2
    }).setOrigin(0.5, 0).setDepth(202);
    elems.push(overlay, bg, title, status);
    this._contractModal = { elems, status, cards: [], signBtn: null, grid: null, sortDir: -1, scrollY: 0 };

    // Сортировка по редкости (для контракта нужны 5 одной — так удобнее).
    const sortBtn = this.add.text(cx - W / 2 + 16, cy - H / 2 + 44, 'Редкость ↓', {
      fontSize: '12px', color: '#ffffff', backgroundColor: '#252560', padding: 5
    }).setOrigin(0, 0.5).setDepth(202);
    sortBtn.setInteractive({ useHandCursor: true });
    sortBtn.on('pointerdown', () => {
      const m2 = this._contractModal;
      if (!m2) return;
      m2.sortDir = (m2.sortDir || -1) > 0 ? -1 : 1;
      sortBtn.setText(m2.sortDir > 0 ? 'Редкость ↑' : 'Редкость ↓');
      this._buildContractGrid();
    });
    sortBtn.on('pointerover', () => sortBtn.setStyle({ color: '#ffff55' }));
    sortBtn.on('pointerout', () => sortBtn.setStyle({ color: '#ffffff' }));
    elems.push(sortBtn);

    this._buildContractGrid();

    // Колесо над списком — прокрутка (убираем при закрытии).
    const m = this._contractModal;
    m.wheelHandler = (pointer, over, dx, dy) => {
      const mm = this._contractModal;
      if (!mm || !mm.gridArea) return;
      const a = mm.gridArea;
      if (pointer.x < a.x || pointer.x > a.x + a.w || pointer.y < a.y || pointer.y > a.y + a.h) return;
      // Инверсия: колесо от себя — список вверх, на себя — вниз.
      mm.scrollY = Phaser.Math.Clamp(mm.scrollY + (dy > 0 ? -48 : 48), mm.scrollMin || 0, 0);
      this._applyContractScroll();
    };
    this.input.on('wheel', m.wheelHandler);

    const signBtn = this.add.text(cx - 150, cy + H / 2 - 44, 'ПОДПИСАТЬ', {
      fontSize: '16px', color: '#667788', backgroundColor: '#22223a', padding: 8
    }).setOrigin(0.5).setDepth(202);
    const cancelBtn = this.add.text(cx + 150, cy + H / 2 - 44, 'ОТМЕНА', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(signBtn, cancelBtn);
    this._contractModal.signBtn = signBtn;
    this._contractModal.cancelBtn = cancelBtn;
    cancelBtn.setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => this._closeContractModal());
    // ESC закрывает модалку (снимается в _closeContractModal).
    this._contractModal.escHandler = () => this._closeContractModal();
    this.input.keyboard.on('keydown-ESC', this._contractModal.escHandler);
    this._refreshContractSign();
  }

  // Сетка скинов модалки: сортировка по редкости + маска + прокрутка.
export function _buildContractGrid() {
    const m = this._contractModal;
    if (!m) return;
    const W = 560, H = 480;
    const cx = gameW(this) / 2, cy = 360;
    const cellW = 100, cellH = 60;
    const perRow = 4;
    const gx0 = cx - W / 2 + 30, gy0 = cy - H / 2 + 76;
    const viewH = (cy + H / 2 - 90) - gy0;

    // Чистим прошлую сетку (выбор _contractSel живёт дальше).
    (m.cards || []).forEach(c => { try { c.hit.destroy(); } catch (e) {} });
    m.cards = [];
    if (m.grid) { try { m.grid.destroy(); } catch (e) {} }
    if (m.maskG) { try { m.maskG.destroy(); } catch (e) {} }

    const ownedIds = new Set(gameState.weaponSkins || []);
    const owned = weaponSkins.filter(s => ownedIds.has(s.id));
    const dir = m.sortDir || -1;
    owned.sort((a, b) => dir > 0
      ? ((a.rarity ?? 1) - (b.rarity ?? 1)) || a.name.localeCompare(b.name)
      : ((b.rarity ?? 1) - (a.rarity ?? 1)) || a.name.localeCompare(b.name));

    const grid = this.add.container(0, 0).setDepth(202);
    m.elems.push(grid);
    m.grid = grid;

    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff);
    maskG.fillRect(gx0 - 6, gy0 - 6, perRow * (cellW + 10) + 12, viewH + 12);
    maskG.setVisible(false);
    m.elems.push(maskG);
    m.maskG = maskG;
    grid.setMask(maskG.createGeometryMask());
    m.gridArea = { x: gx0 - 6, y: gy0 - 6, w: perRow * (cellW + 10) + 12, h: viewH + 12 };

    owned.forEach((skin, i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      const x = gx0 + col * (cellW + 10), y = gy0 + row * (cellH + 8);
      const cardBg = this.add.graphics();
      const epithet = (skin.name.split('«')[1] || skin.name).replace('»', '').slice(0, 22);
      const paint = (on, hover) => {
        cardBg.clear();
        cardBg.fillStyle(on ? 0x554400 : 0x1a1a3c, 1);
        cardBg.fillRoundedRect(0, 0, cellW, cellH, 6);
        cardBg.lineStyle(on || hover ? 3 : 2, on ? 0xffd24a : hover ? 0xffee55 : (skin.rarityColor || '#888'));
        cardBg.strokeRoundedRect(0, 0, cellW, cellH, 6);
      };
      paint((this._contractSel || []).some(s => s.id === skin.id), false);
      const lb = this.add.text(6, 4, epithet, { fontSize: '9px', color: '#dddddd', wordWrap: { width: cellW - 12 } }).setOrigin(0, 0);
      const rn = this.add.text(6, cellH - 14, skin.rarityName || '', { fontSize: '9px', color: skin.rarityColor || '#888' }).setOrigin(0, 0);
      const holder = this.add.container(x, y, [cardBg, lb, rn]);
      const hit = this.add.rectangle(x + cellW / 2, y + cellH / 2, cellW, cellH, 0xffffff, 0.001).setDepth(203);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => paint(this._contractSel.some(s => s.id === skin.id), true));
      hit.on('pointerout', () => paint(this._contractSel.some(s => s.id === skin.id), false));
      hit.on('pointerdown', () => {
        const mm = this._contractModal;
        const sel = this._contractSel;
        const ix = sel.findIndex(s => s.id === skin.id);
        if (ix >= 0) sel.splice(ix, 1);
        else {
          if (sel.length >= 5) return;
          if (sel.length && (sel[0].rarity ?? 1) !== (skin.rarity ?? 1)) {
            if (mm) {
              mm.status.setText('Только одна редкость! Сними выбор кликом');
              mm.status.setColor('#ff8888');
            }
            return;
          }
          sel.push(skin);
        }
        const r = sel.length ? RARITY[sel[0].rarity ?? 1].name : '';
        if (mm) {
          mm.status.setText(sel.length ? `Выбрано ${sel.length}/5 · ${r}` : 'Выбери 5 скинов одной редкости');
          mm.status.setColor('#99aacc');
        }
        paint(sel.some(s => s.id === skin.id), false);
        this._refreshContractSign();
      });
      grid.add([holder]);
      m.elems.push(hit);
      m.cards.push({ skin, paint, hit, holder, baseY: y, cellH });
    });

    // Высота контента + пределы прокрутки (0 = верх).
    const rows = Math.ceil(Math.max(1, owned.length) / perRow);
    const contentH = rows * (cellH + 8);
    m.scrollMin = Math.min(0, (viewH + 12) - contentH - 12);
    m.scrollY = Phaser.Math.Clamp(m.scrollY || 0, m.scrollMin, 0);
    this._applyContractScroll();
  }

  // Применить прокрутку списка контракта: едет сетка, хитзоны следом,
  // за пределами видимости хитзоны гаснут (маска клики не режет).
export function _applyContractScroll() {
    const m = this._contractModal;
    if (!m || !m.grid) return;
    m.grid.y = m.scrollY || 0;
    const a = m.gridArea;
    (m.cards || []).forEach(c => {
      if (!c.hit) return;
      c.hit.y = c.baseY + c.cellH / 2 + (m.scrollY || 0);
      const inView = a
        ? (c.hit.y + c.cellH / 2 >= a.y && c.hit.y - c.cellH / 2 <= a.y + a.h)
        : true;
      if (c.hit.input) c.hit.input.enabled = inView;
    });
  }

export function _refreshContractSign() {
    const m = this._contractModal;
    if (!m || !m.signBtn) return;
    const sel = this._contractSel || [];
    const full = sel.length === 5;
    // Дерево генома в максимуме: 5 легендарных жечь нельзя — кнопка
    // неактивна сразу, а не после анимации (скины не должны сгорать вхолостую).
    let maxedBlock = false;
    try {
      maxedBlock = full && (sel[0].rarity ?? 1) >= 4 && isGenomeMaxed();
    } catch (e) {}
    const ok = full && !maxedBlock;
    m.signBtn.setColor(ok ? '#ffffff' : '#667788');
    m.signBtn.setStyle({ backgroundColor: ok ? '#2a5a2a' : '#22223a' });
    if (m.status) {
      if (maxedBlock) {
        m.status.setColor('#ff8888');
        m.status.setText('Дерево генома прокачано полностью — обмен невозможен');
      } else if (full) {
        m.status.setColor('#99aacc');
        m.status.setText('Выбери 5 скинов одной редкости');
      } else {
        // Счётчик выбора (иначе залиша залипший хинт после снятия скина).
        const r = sel.length ? RARITY[sel[0].rarity ?? 1].name : '';
        m.status.setColor('#99aacc');
        m.status.setText(sel.length ? `Выбрано ${sel.length}/5 · ${r}` : 'Выбери 5 скинов одной редкости');
      }
    }
    if (ok && !m.signBtn.input) {
      m.signBtn.setInteractive({ useHandCursor: true });
      m.signBtn.on('pointerdown', () => this._signContractAnimated());
    } else if (!ok && m.signBtn.input) {
      m.signBtn.disableInteractive();
    }
  }

export function _closeContractModal() {
    const m = this._contractModal;
    if (!m) return;
    if (m.wheelHandler) {
      try { this.input.off('wheel', m.wheelHandler); } catch (e) {}
    }
    if (m.escHandler) {
      try { this.input.keyboard.off('keydown-ESC', m.escHandler); } catch (e) {}
    }
    m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    if (m.grid) try { m.grid.destroy(); } catch (e) {}
    (m.cards || []).forEach(c => { try { c.hit.destroy(); } catch (e) {} });
    this._contractModal = null;
  }

  // Детальный счёт матча переехал в главное меню (MenuScene2._openMatchModal):
  // история боёв открывается отдельным окном только оттуда.

  // Обмен фрагментов: 3 штуки = +10000 монет и +1 очко генома.
  // Тратит те же фрагменты, что нужны финалу 30-го дня, — двойного
  // получения нет (фрагменты даются только по воскресеньям).
export function _openFragModal() {
    if (this._fragModal) return;
    const cx = gameW(this) / 2, cy = 360, W = 480, H = 340;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeFragModal());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);
    const frags = gameState.dailyFrags | 0;
    elems.push(this.add.text(cx, cy - H / 2 + 26, 'ОБМЕН ФРАГМЕНТОВ', {
      fontSize: '19px', color: '#ffdd88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));
    elems.push(this.add.text(cx, cy - H / 2 + 58, `У тебя: ${frags}/3`, {
      fontSize: '15px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(202));
    elems.push(this.add.text(cx, cy - H / 2 + 108,
      '3 фрагмента = +10000 монет и +1 очко генома.\nФрагменты даются по воскресеньям стрика ежедневки.', {
        fontSize: '13px', color: '#99aacc', align: 'center'
      }).setOrigin(0.5, 0).setDepth(202));
    const can = frags >= 3;
    const exBtn = this.add.text(cx - 110, cy + H / 2 - 40, 'ОБМЕНЯТЬ 3', {
      fontSize: '15px', color: can ? '#ffffff' : '#667788',
      backgroundColor: can ? '#2a5a2a' : '#22223a', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(exBtn);
    if (can) {
      exBtn.setInteractive({ useHandCursor: true });
      exBtn.on('pointerdown', () => {
        if ((gameState.dailyFrags | 0) < 3 || this._fragExchanging) return;
        this._fragExchanging = true;
        try { exBtn.disableInteractive(); } catch (e) {}
        gameState.dailyFrags = (gameState.dailyFrags | 0) - 3;
        addCoins(10000);
        gameState.genePoints = (gameState.genePoints | 0) + 1;
        gameState.geneUnlocked = true;
        saveGameState();
        // Эффект обмена: вспышка + вылетающие награды, потом закрыть.
        // Раньше окно просто хлопало — было непонятно, что произошло.
        try {
          if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
            this.sound.play('sfx_buy', { volume: 0.5 });
          }
        } catch (e) {}
        try {
          const flash = this.add.rectangle(cx, cy, W, H, 0xffe9a0, 0).setDepth(203);
          this.tweens.add({
            targets: flash, alpha: { from: 0.55, to: 0 }, duration: 600,
            onComplete: () => { try { flash.destroy(); } catch (e) {} }
          });
          const t1 = this.add.text(cx, cy - 20, '+10000 монет', {
            fontSize: '22px', color: '#ffee88', fontStyle: 'bold'
          }).setOrigin(0.5).setDepth(203);
          const t2 = this.add.text(cx, cy + 14, '+1 очко генома', {
            fontSize: '18px', color: '#7dff9a', fontStyle: 'bold'
          }).setOrigin(0.5).setDepth(203);
          [t1, t2].forEach((t, k) => {
            this.tweens.add({
              targets: t, y: t.y - 46, alpha: 0, duration: 1200, delay: 150 + k * 150,
              onComplete: () => { try { t.destroy(); } catch (e) {} }
            });
          });
          elems.push(flash, t1, t2);
        } catch (e) {}
        this.time.delayedCall(1400, () => {
          this._fragExchanging = false;
          try {
            if (this.scene.isActive()) {
              this._closeFragModal();
              this.redraw();
            }
          } catch (e) {}
        });
      });
    }
    const closeBtn = this.add.text(cx + 110, cy + H / 2 - 40, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(closeBtn);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeFragModal());
    this._fragModal = { elems, escHandler: null };
    this._fragModal.escHandler = () => this._closeFragModal();
    this.input.keyboard.on('keydown-ESC', this._fragModal.escHandler);
  }

export function _closeFragModal() {
    const m = this._fragModal;
    this._fragExchanging = false;
    if (!m) return;
    if (m.escHandler) {
      try { this.input.keyboard.off('keydown-ESC', m.escHandler); } catch (e) {}
    }
    m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    this._fragModal = null;
  }

  // Подписание: скины слетаются в центр, вспышка, новый скин (п.37).
  // Легендарный обмен (5 эпиков → легендарный): ограничений по
  // происхождению больше нет — эпики падают только из кейса Скинов,
  // проверять нечего. Штампы skinOrigin оставлены для истории.
export function _contractLegendaryOk(sel) {
    return true;
  }

export function _signContractAnimated() {
    const m = this._contractModal;
    const sel = this._contractSel || [];
    if (!m || sel.length !== 5) return;
    const r0 = sel[0].rarity ?? 1;
    // Страховка: дерево в максимуме — легендарные не сжигаем.
    try {
      if (r0 >= 4 && isGenomeMaxed()) {
        m.status.setColor('#ff8888');
        m.status.setText('Дерево генома прокачано полностью — обмен невозможен');
        this._refreshContractSign();
        return;
      }
    } catch (e) {}
    const cx = gameW(this) / 2, cy = 360;
    m.cards.forEach(c => { try { c.hit.disableInteractive(); } catch (e) {} });
    if (m.signBtn) try { m.signBtn.disableInteractive(); } catch (e) {}
    m.status.setText('Контракт подписывается...');
    // Выбранные карточки — в центр.
    const picked = m.cards.filter(c => sel.some(s => s.id === c.skin.id));
    picked.forEach((c, i) => {
      this.tweens.add({
        targets: c.paint, x: 0, duration: 1
      });
    });
    const dots = picked.map((c, i) => {
      const d = this.add.circle(cx + (i - 2) * 90, 420, 16, 0xffd24a, 1).setDepth(210);
      m.elems.push(d);
      this.tweens.add({
        targets: d, x: cx, y: cy, duration: 700, delay: i * 80, ease: 'Cubic.In',
        onComplete: () => {
          if (i === picked.length - 1) this._contractMergeFlash(m, sel);
        }
      });
      return d;
    });
    this._contractDots = dots;
  }

export function _contractMergeFlash(m, sel) {
    const cx = gameW(this) / 2, cy = 360;
    (this._contractDots || []).forEach(d => { try { d.destroy(); } catch (e) {} });
    const flash = this.add.circle(cx, cy, 20, 0xffffff, 0.95).setDepth(211);
    m.elems.push(flash);
    this.tweens.add({
      targets: flash, radius: 120, alpha: 0, duration: 500,
        onComplete: () => {
          const res = this._applyContractResult(sel);
          // Счётчик и список позади модалки — сразу свежие (модалка живёт
          // отдельно от динамических панелей, redraw её не трогает).
          try { this.redraw(); } catch (e) {}
          this._showContractPrize(res);
        }
    });
  }

  // Собственно обмен. Возвращает {win, gene} + пишет историю обменов.
export function _applyContractResult(sel) {
    const r = sel[0].rarity ?? 1;
    sel.forEach(s => {
      const ix = gameState.weaponSkins.indexOf(s.id);
      if (ix >= 0) gameState.weaponSkins.splice(ix, 1);
      if (gameState.weaponSkinDates) delete gameState.weaponSkinDates[s.id];
    });
    let win = null;
    let gene = false;
    if (r >= 4) {
      // Дерево в максимуме — очко некуда тратить: скины возвращаем,
      // историю пишем как отказ (молча жечь легендарные нельзя).
      let maxed = false;
      try { maxed = isGenomeMaxed(); } catch (e) {}
      if (maxed) {
        sel.forEach(s => {
          if (!gameState.weaponSkins.includes(s.id)) gameState.weaponSkins.push(s.id);
        });
        try {
          gameState.contractHistory = gameState.contractHistory || [];
          gameState.contractHistory.unshift({
            t: Date.now(),
            gave: sel.map(s => s.name),
            got: 'отказ: дерево генома полное'
          });
          if (gameState.contractHistory.length > 50) gameState.contractHistory.length = 50;
        } catch (e) {}
        saveGameState();
        return { win: null, gene: false, maxed: true };
      }
      gameState.genePoints = (gameState.genePoints | 0) + 1;
      gameState.geneUnlocked = true;
      gene = true;
    } else {
      const ownedAfter = new Set(gameState.weaponSkins);
      const sameW = weaponSkins.filter(s =>
        (s.rarity ?? 1) === r + 1 && !ownedAfter.has(s.id) &&
        sel.some(v => v.weapon === s.weapon)
      );
      const anyW = weaponSkins.filter(s =>
        (s.rarity ?? 1) === r + 1 && !ownedAfter.has(s.id)
      );
      const pool = sameW.length ? sameW : anyW;
      if (!pool.length) {
        sel.forEach(s => {
          if (!gameState.weaponSkins.includes(s.id)) gameState.weaponSkins.push(s.id);
        });
      } else {
        win = pool[Math.floor(Math.random() * pool.length)];
        gameState.weaponSkins.push(win.id);
        gameState.weaponSkinDates = gameState.weaponSkinDates || {};
        gameState.weaponSkinDates[win.id] = Date.now();
        // Скин из обмена — происхождение 'contract': на легендарный через
        // него не отмыться, нужны прямые дропы из кейса Скинов.
        try {
          gameState.skinOrigin = gameState.skinOrigin || {};
          gameState.skinOrigin[win.id] = 'contract';
        } catch (e) {}
      }
    }
    // История: что отдал и что получил (без подписи «исполнен»).
    try {
      gameState.contractHistory = gameState.contractHistory || [];
      gameState.contractHistory.unshift({
        t: Date.now(),
        gave: sel.map(s => s.name),
        got: gene ? '+1 очко генома' : (win ? win.name : 'возврат скинов')
      });
      if (gameState.contractHistory.length > 50) gameState.contractHistory.length = 50;
    } catch (e) {}
    saveGameState();
    return { win, gene };
  }

  // Приз по центру модалки как в кейсах: рамка редкости + имя + забрать.
export function _showContractPrize(res) {
    const m = this._contractModal;
    if (!m) return;
    const cx = gameW(this) / 2, cy = 360;
    if (m.grid) { try { m.grid.destroy(); } catch (e) {} m.grid = null; }
    (m.cards || []).forEach(c => { try { c.hit.destroy(); } catch (e) {} });
    m.cards = [];
    if (m.signBtn) { try { m.signBtn.destroy(); } catch (e) {} m.signBtn = null; }
    if (m.cancelBtn) { try { m.cancelBtn.destroy(); } catch (e) {} m.cancelBtn = null; }
    m.status.setText('');
    const parts = [];

    if (res.gene) {
      const t = this.add.text(cx, cy - 10, '+1 ОЧКО ГЕНОМА', {
        fontSize: '26px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(202);
      const t2 = this.add.text(cx, cy + 26, '(меню → Геном)', {
        fontSize: '14px', color: '#99aacc'
      }).setOrigin(0.5).setDepth(202);
      parts.push(t, t2);
    } else if (res.maxed) {
      const t = this.add.text(cx, cy - 10, 'ДЕРЕВО ГЕНОМА ПОЛНОЕ', {
        fontSize: '22px', color: '#ff8888', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(202);
      const t2 = this.add.text(cx, cy + 26, 'скины возвращены', {
        fontSize: '14px', color: '#99aacc'
      }).setOrigin(0.5).setDepth(202);
      parts.push(t, t2);
    } else if (res.win) {
      const skin = res.win;
      const rc = String(skin.rarityColor || '#5bc0ff');
      const ci = /^#[0-9a-fA-F]{6}$/.test(rc) ? parseInt(rc.slice(1), 16) : 0x5bc0ff;
      const css = '#' + ci.toString(16).padStart(6, '0');
      const dark = Phaser.Display.Color.IntegerToColor(ci);
      dark.brighten(-55);
      const W = 300, H = 150;
      const bg = this.add.graphics().setDepth(202);
      bg.fillStyle(dark.color, 1);
      bg.fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 10);
      bg.lineStyle(6, ci, 1);
      bg.strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 10);
      const tag = this.add.text(cx, cy - H / 2 + 16, 'НОВЫЙ СКИН', {
        fontSize: '12px', color: '#99aacc', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(203);
      const nm = this.add.text(cx, cy + 4, skin.name, {
        fontSize: '17px', color: css, fontStyle: 'bold', align: 'center',
        wordWrap: { width: W - 24 }
      }).setOrigin(0.5).setDepth(203);
      // Длинное имя не должно доползать до кнопок: ужимаем по факту.
      let nfs = 17;
      while (nm.displayHeight > 56 && nfs > 13) {
        nfs--;
        nm.setFontSize(nfs);
      }
      const wp = this.add.text(cx, cy + H / 2 - 16, getWeaponLabel(skin.weapon), {
        fontSize: '12px', color: '#99aacc'
      }).setOrigin(0.5).setDepth(203);
      parts.push(bg, tag, nm, wp);
    } else {
      const t = this.add.text(cx, cy, 'Скины возвращены', {
        fontSize: '18px', color: '#99aacc'
      }).setOrigin(0.5).setDepth(202);
      parts.push(t);
    }

    const ok = this.add.text(cx + 110, cy + 140, 'ЗАБРАТЬ', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#2a5a2a', padding: 8
    }).setOrigin(0.5).setDepth(202);
    ok.setInteractive({ useHandCursor: true });
    ok.on('pointerdown', () => {
      this._contractSel = [];
      this._closeContractModal();
      this.redraw();
    });
    ok.on('pointerover', () => ok.setStyle({ color: '#ffff55' }));
    ok.on('pointerout', () => ok.setStyle({ color: '#ffffff' }));
    parts.push(ok);

    // Подписать ещё: то же окно, свежий выбор.
    const again = this.add.text(cx - 110, cy + 140, 'ПОДПИСАТЬ ЕЩЁ', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#5a4a1a', padding: 8
    }).setOrigin(0.5).setDepth(202);
    again.setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => {
      this._closeContractModal();
      // Панели позади модалки иначе остаются со старым счётом
      // («Скинов собрано: 12» при реальных 8 после обмена).
      this.redraw();
      this._openContractModal();
    });
    again.on('pointerover', () => again.setStyle({ color: '#ffff55' }));
    again.on('pointerout', () => again.setStyle({ color: '#ffffff' }));
    parts.push(again);
    parts.forEach(o => m.elems.push(o));
  }

  // История обменов: что отдал → что получил.
export function _toggleContractSkin(skin) {
    this._contractSel = this._contractSel || [];
    const sel = this._contractSel;
    const ix = sel.findIndex(s => s.id === skin.id);
    if (ix >= 0) {
      sel.splice(ix, 1);
    } else {
      if (sel.length >= 5) return;
      if (sel.length && (sel[0].rarity ?? 1) !== (skin.rarity ?? 1)) {
        if (this._contractStatus) {
          this._contractStatus.setColor('#ff8888');
          this._contractStatus.setText('Только одна редкость! Сними выбор кликом');
        }
        return;
      }
      sel.push(skin);
    }
    this.redraw();
  }

  // Обмен контракта: 5 одной редкости → случайный следующей (предпочитаем
  // то же оружие); 5 легендарных → +1 очко генома.
export function _doContract() {
    const sel = this._contractSel || [];
    if (sel.length !== 5) return;
    const r = sel[0].rarity ?? 1;
    const ownedIds = new Set(gameState.weaponSkins || []);
    sel.forEach(s => {
      const ix = gameState.weaponSkins.indexOf(s.id);
      if (ix >= 0) gameState.weaponSkins.splice(ix, 1);
      if (gameState.weaponSkinDates) delete gameState.weaponSkinDates[s.id];
    });
    let msg;
    if (r >= 4) {
      let maxed = false;
      try { maxed = isGenomeMaxed(); } catch (e) {}
      if (maxed) {
        msg = 'Дерево генома прокачано полностью — скины возвращены';
        sel.forEach(s => {
          if (!gameState.weaponSkins.includes(s.id)) gameState.weaponSkins.push(s.id);
        });
      } else {
        gameState.genePoints = (gameState.genePoints | 0) + 1;
        msg = '+1 очко генома! (меню → Геном)';
      }
    } else {
      const ownedAfter = new Set(gameState.weaponSkins);
      const sameW = weaponSkins.filter(s =>
        (s.rarity ?? 1) === r + 1 && !ownedAfter.has(s.id) &&
        sel.some(v => v.weapon === s.weapon)
      );
      const anyW = weaponSkins.filter(s =>
        (s.rarity ?? 1) === r + 1 && !ownedAfter.has(s.id)
      );
      const pool = sameW.length ? sameW : anyW;
      if (!pool.length) {
        msg = 'Всё следующей редкости уже есть — скины возвращены';
        sel.forEach(s => {
          if (!gameState.weaponSkins.includes(s.id)) gameState.weaponSkins.push(s.id);
        });
      } else {
        const win = pool[Math.floor(Math.random() * pool.length)];
        gameState.weaponSkins.push(win.id);
        gameState.weaponSkinDates = gameState.weaponSkinDates || {};
        gameState.weaponSkinDates[win.id] = Date.now();
        msg = `Выпал: ${win.name}`;
      }
    }
    saveGameState();
    this._contractSel = [];
    this._contractMsg = msg;
    this.redraw();
  }
