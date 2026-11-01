import { gameW } from '../../ui/layout.js?v=3';
import { gameState } from '../../data/gameState.js?v=171';
import { weaponsList, getWeaponLabel } from '../../data/weapons.js?v=170';
import { weaponSkins, RARITY } from '../../data/skins.js?v=169';

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
  { x: 1030, y: 395, slot: 'primary', label: 'ОСНОВНОЕ' },
  { x: 1030, y: 463, slot: 'secondary', label: 'ВТОРОЕ' },
  { x: 1030, y: 531, slot: 'melee', label: 'БЛИЖНЕЕ' }
];

const COMPARE_SLOTS = [
  { x: 300, y: 565, slot: 0 },
  { x: 500, y: 565, slot: 1 }
];

export function drawSkinsPanel(panel, parent) {
    const padX = 14;
    const startX = panel.x + padX;

    const skinsTitle = this.add.text(startX, panel.y + 42, 'СКИНЫ ОРУЖИЯ', {
      fontSize: '15px',
      color: '#99aacc'
    }).setOrigin(0, 0.5);
    if (parent) parent.add(skinsTitle);

    // Фильтры (п.31): «Пушка» — выпадающий список (только пушки со скинами),
    // редкость/сорт — с динамическим шагом, чтобы не налезать друг на друга.
    this.skinFilter = this.skinFilter || { weapon: 'all', rarity: 'all', sort: 'weapon' };
    const flt = this.skinFilter;
    const ownedWeapons = [...new Set((gameState.weaponSkins || []).map(id => {
      const s = weaponSkins.find(v => v.id === id);
      return s ? s.weapon : null;
    }).filter(Boolean))];
    const wLabel = flt.weapon === 'all' ? 'Все пушки' : getWeaponLabel(flt.weapon);
    const rLabel = flt.rarity === 'all' ? 'Все редкости' : (RARITY[flt.rarity] || {}).name || '?';
    const sLabel = flt.sort === 'weapon' ? 'По оружию' : flt.sort === 'new' ? 'Сначала новые' : 'По редкости';
    const mkFilterBtn = (x, text, cb) => {
      const b = this.add.text(x, panel.y + 62, text, {
        fontSize: '11px', color: '#ffffff', backgroundColor: '#252560', padding: 5
      }).setOrigin(0, 0.5);
      b.setInteractive({ useHandCursor: true });
      b.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); cb(b); });
      b.on('pointerover', () => b.setStyle({ color: '#ffff55' }));
      b.on('pointerout', () => b.setStyle({ color: '#ffffff' }));
      if (parent) parent.add(b);
      return b;
    };
    this._closeSkinDropdown = () => {
      (this._skinDropItems || []).forEach(o => { try { o.destroy(); } catch (e) {} });
      this._skinDropItems = [];
    };
    const openDropdown = (anchorBtn, opts, cur, onPick) => {
      this._closeSkinDropdown();
      const bx = anchorBtn.x;
      const by = anchorBtn.y + 14;
      opts.forEach((opt, i) => {
        const t = this.add.text(bx, by + i * 24, (opt === cur ? '✓ ' : '   ') + opt.label, {
          fontSize: '11px', color: opt.value === cur ? '#ffff55' : '#ffffff',
          backgroundColor: '#2a2a5e', padding: 4, fixedWidth: 170
        }).setOrigin(0, 0).setDepth(80);
        t.setInteractive({ useHandCursor: true });
        t.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); onPick(opt.value); this._closeSkinDropdown(); this.redraw(); });
        t.on('pointerover', () => t.setStyle({ color: '#ffff55' }));
        t.on('pointerout', () => t.setStyle({ color: '#ffffff' }));
        if (parent) parent.add(t);
        this._skinDropItems.push(t);
      });
    };
    const wBtn = mkFilterBtn(startX, `Пушка: ${wLabel} ▾`, (btn) => {
      openDropdown(btn,
        [{ value: 'all', label: 'Все пушки' },
         ...ownedWeapons.map(w => ({ value: w, label: getWeaponLabel(w) }))],
        flt.weapon, v => { flt.weapon = v; });
    });
    // Остальные кнопки — правее с запасом по ширине текста (п.31).
    const rBtn = mkFilterBtn(startX + wBtn.displayWidth + 12, `Редкость: ${rLabel}`, () => {
      const opts = ['all', 0, 1, 2, 3, 4];
      flt.rarity = opts[(opts.indexOf(flt.rarity) + 1) % opts.length];
      this.redraw();
    });
    mkFilterBtn(startX + wBtn.displayWidth + rBtn.displayWidth + 24, `Сорт: ${sLabel}`, () => {
      const opts = ['weapon', 'new', 'rarity'];
      flt.sort = opts[(opts.indexOf(flt.sort) + 1) % opts.length];
      this.redraw();
    });

    const ownedIds = new Set(gameState.weaponSkins || []);
    let owned = weaponSkins.filter(s => ownedIds.has(s.id));
    if (flt.weapon !== 'all') owned = owned.filter(s => s.weapon === flt.weapon);
    if (flt.rarity !== 'all') owned = owned.filter(s => (s.rarity ?? 1) === flt.rarity);
    const dates = gameState.weaponSkinDates || {};
    if (flt.sort === 'new') {
      owned = owned.slice().sort((a, b) => (dates[b.id] || 0) - (dates[a.id] || 0));
    } else if (flt.sort === 'rarity') {
      owned = owned.slice().sort((a, b) => ((b.rarity ?? 1) - (a.rarity ?? 1)) || a.name.localeCompare(b.name));
    }

    // Зона списка (под фильтрами) с маской + колесом. Внизу — контракты.
    const listY0 = panel.y + 84;
    const contractH = 96;
    const listH = panel.h - (listY0 - panel.y) - contractH - 8;
    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff);
    maskG.fillRect(panel.x, listY0, panel.w, listH);
    maskG.setVisible(false);
    if (parent) parent.add(maskG);

    const container = this.add.container(0, 0);
    container.setMask(maskG.createGeometryMask());
    if (parent) parent.add(container);

    // Строки по оружию (без отдельных заголовков-строк: подпись inline).
    // В сортировках new/rarity — плоская сетка 3 в ряд.
    const cellW = 110;
    const cellH = 72;
    const perRow = 3;
    let y = listY0 + 4;
    const drawRow = (weaponName, skins) => {
      let x = startX;
      if (flt.sort === 'weapon' && weaponName) {
        const tag = this.add.text(x, y + cellH / 2, getWeaponLabel(weaponName), {
          fontSize: '11px', color: '#ddbb66', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        container.add(tag);
        x += 76;
      }
      skins.forEach(skin => {
        const card = this.createSkinCard(x, y, skin, cellW);
        container.add(card);
        x += cellW + 6;
      });
      y += cellH + 8;
    };
    if (!owned.length) {
      const noSkins = this.add.text(startX, y, 'Пусто (фильтры?).\nОткрывайте кейсы в меню.', {
        fontSize: '14px',
        color: '#556677',
        align: 'left'
      });
      container.add(noSkins);
    } else if (flt.sort === 'weapon') {
      const order = weaponsList.map(w => w.name).filter(nm => owned.some(s => s.weapon === nm));
      owned.forEach(s => {
        if (!order.includes(s.weapon)) order.push(s.weapon);
      });
      let row = [];
      let curW = null;
      const flush = () => {
        if (row.length) drawRow(curW, row);
        row = [];
      };
      owned.slice().sort((a, b) => order.indexOf(a.weapon) - order.indexOf(b.weapon)).forEach(skin => {
        if (curW !== skin.weapon) {
          flush();
          curW = skin.weapon;
        }
        row.push(skin);
        if (row.length >= perRow) flush();
      });
      flush();
    } else {
      for (let i = 0; i < owned.length; i += perRow) {
        drawRow(null, owned.slice(i, i + perRow));
      }
    }
    const contentH = y - listY0;
    this._skinsScroll = this._skinsScroll || { y: 0 };
    this._skinsScroll.max = Math.min(0, listH - contentH - 4);
    this._skinsScroll.y = Phaser.Math.Clamp(this._skinsScroll.y, this._skinsScroll.max, 0);
    this._skinsPanel = { x: panel.x, y: listY0, w: panel.w, h: listH, container };
    this._applySkinsScroll();

    // Контракты (п.37): кнопка «Подписать контракт» → окно выбора →
    // «Подписать» → анимация слияния → новый скин.
    const cy = panel.y + panel.h - contractH + 8;
    const cTitle = this.add.text(startX, cy, 'КОНТРАКТ ОБМЕНА', {
      fontSize: '13px', color: '#ffdd88', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    if (parent) parent.add(cTitle);
    const cStatus = this.add.text(startX, cy + 22,
      '5 скинов одной редкости → скин выше (5 легендарных → очко генома)', {
        fontSize: '11px', color: '#99aacc'
      }).setOrigin(0, 0.5);
    if (parent) parent.add(cStatus);
    const cBtn = this.add.text(startX, cy + 52, 'ПОДПИСАТЬ КОНТРАКТ', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#5a4a1a',
      padding: 7
    }).setOrigin(0, 0.5);
    if (parent) parent.add(cBtn);
    cBtn.setInteractive({ useHandCursor: true });
    cBtn.on('pointerdown', () => this._openContractModal());
    cBtn.on('pointerover', () => cBtn.setStyle({ color: '#ffff55' }));
    cBtn.on('pointerout', () => cBtn.setStyle({ color: '#ffffff' }));
    // История — в том же ряду справа, не под кнопкой (налезала).
    const hBtn = this.add.text(startX + 225, cy + 52, 'ИСТОРИЯ ОБМЕНОВ', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#252560',
      padding: 6
    }).setOrigin(0, 0.5);
    if (parent) parent.add(hBtn);
    hBtn.setInteractive({ useHandCursor: true });
    hBtn.on('pointerdown', () => this._openHistoryModal());
    hBtn.on('pointerover', () => hBtn.setStyle({ color: '#ffff55' }));
    hBtn.on('pointerout', () => hBtn.setStyle({ color: '#ffffff' }));
    this._contractStatus = cStatus;
  }

  // Модалка контракта: выбор 5 скинов одной редкости + анимация слияния.
export function _openHistoryModal() {
    if (this._historyModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const W = 560, H = 440;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0x8fb8ff, 1);
    const title = this.add.text(cx, cy - H / 2 + 22, 'ИСТОРИЯ ОБМЕНОВ', {
      fontSize: '20px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202);
    elems.push(overlay, bg, title);
    this._historyModal = { elems };

    const list = gameState.contractHistory || [];
    if (!list.length) {
      const t = this.add.text(cx, cy, 'Пока пусто — подпиши первый контракт.', {
        fontSize: '14px', color: '#667788'
      }).setOrigin(0.5).setDepth(202);
      elems.push(t);
    } else {
      const lx = cx - W / 2 + 24, ly0 = cy - H / 2 + 56;
      const rowH = 66;
      const viewH = H - 56 - 70;
      const maskG = this.add.graphics();
      maskG.fillStyle(0xffffff);
      maskG.fillRect(lx, ly0, W - 48, viewH);
      maskG.setVisible(false);
      elems.push(maskG);
      const box = this.add.container(0, 0).setDepth(202);
      box.setMask(maskG.createGeometryMask());
      elems.push(box);
      const hovers = [];
      // Строка: дата + 5 ячеек отданных → общая стрелка → ячейка приза.
      const cw = 62, ch = 40, gap = 5;
      const gw = 5 * cw + 4 * gap;
      const skinByName = (nm) => weaponSkins.find(s => s.name === nm) || null;
      const miniCell = (parent, px, py, w, h, name, borderCss, titleCss) => {
        const ci = /^#[0-9a-fA-F]{6}$/.test(borderCss || '') ? parseInt(borderCss.slice(1), 16) : 0x888888;
        const bg2 = this.add.graphics();
        bg2.fillStyle(0x1a1a3c, 1);
        bg2.fillRoundedRect(0, 0, w, h, 5);
        bg2.lineStyle(2, ci, 1);
        bg2.strokeRoundedRect(0, 0, w, h, 5);
        const epithet = ((name || '').split('«')[1] || name || '').replace('»', '');
        const lb = this.add.text(4, 3, epithet, {
          fontSize: '8px', color: titleCss || '#dddddd', align: 'center',
          wordWrap: { width: w - 8 }
        }).setOrigin(0, 0);
        const holder = this.add.container(px, py, [bg2, lb]);
        parent.add(holder);
        return holder;
      };
      list.forEach((h, i) => {
        const y = ly0 + 4 + i * rowH;
        const d = new Date(h.t || Date.now());
        const ds = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const dt = this.add.text(lx, y, ds, {
          fontSize: '10px', color: '#667788'
        }).setOrigin(0, 0);
        box.add(dt);
        const cellY = y + 14;
        const gave = (h.gave || []).slice(0, 5);
        gave.forEach((nm, k) => {
          const sk = skinByName(nm);
          const holder = miniCell(box, lx + k * (cw + gap), cellY, cw, ch, nm,
            sk ? sk.rarityColor : '#888899', '#dddddd');
          // Ховер — полное имя скина.
          if (sk) {
            const hz = this.add.rectangle(lx + k * (cw + gap) + cw / 2, cellY + ch / 2, cw, ch, 0xffffff, 0.001).setDepth(203);
            hz.setInteractive({ useHandCursor: true });
            hz.on('pointerover', () => {
              this.showSkinTooltip(sk);
              this.tooltipBg.setDepth(210);
              this.tooltipTitle.setDepth(211);
              this.tooltipText.setDepth(211);
            });
            hz.on('pointerout', () => {
              this.hideTooltip();
              this.tooltipBg.setDepth(100);
              this.tooltipTitle.setDepth(101);
              this.tooltipText.setDepth(101);
            });
            box.add(hz);
            holder._hz = hz;
            hovers.push({ hz, baseY: cellY + ch / 2, h: ch });
          }
        });
        const ax = lx + gw + 6;
        const arrow = this.add.text(ax, cellY + ch / 2, '→', {
          fontSize: '20px', color: '#ffd24a', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        box.add(arrow);
        const gotSkin = skinByName(h.got);
        const rw = 118;
        const rx = ax + 26;
        if (gotSkin) {
          miniCell(box, rx, cellY, rw, ch, h.got, gotSkin.rarityColor, gotSkin.rarityColor);
        } else {
          miniCell(box, rx, cellY, rw, ch, h.got, '#ffd24a', '#ffd24a');
        }
      });
      const mm = this._historyModal;
      mm.box = box;
      mm.area = { x: lx, y: ly0, w: W - 48, h: viewH };
      mm.scrollY = 0;
      mm.scrollMin = Math.min(0, viewH - (list.length * rowH + 8));
      const applyHoverView = () => {
        const a = mm.area;
        (hovers || []).forEach(o => {
          if (!o.hz || !o.hz.input) return;
          const yy = o.baseY + (mm.scrollY || 0);
          o.hz.input.enabled = (yy + o.h / 2 >= a.y && yy - o.h / 2 <= a.y + a.h);
        });
      };
      mm.wheelHandler = (pointer, over, dx, dy) => {
        const q = this._historyModal;
        if (!q || !q.area) return;
        const a = q.area;
        if (pointer.x < a.x || pointer.x > a.x + a.w || pointer.y < a.y || pointer.y > a.y + a.h) return;
        q.scrollY = Phaser.Math.Clamp(q.scrollY + (dy > 0 ? -40 : 40), q.scrollMin || 0, 0);
        if (q.box) q.box.y = q.scrollY;
        const qq = this._historyModal;
        if (qq) {
          (hovers || []).forEach(o => {
            if (!o.hz || !o.hz.input) return;
            const yy = o.baseY + (qq.scrollY || 0);
            o.hz.input.enabled = (yy + o.h / 2 >= a.y && yy - o.h / 2 <= a.y + a.h);
          });
        }
      };
      this.input.on('wheel', mm.wheelHandler);
      applyHoverView();
    }

    const closeBtn = this.add.text(cx, cy + H / 2 - 30, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(closeBtn);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeHistoryModal());
    const close = () => this._closeHistoryModal();
    overlay.setInteractive();
    overlay.on('pointerdown', close);
  }

export function _closeHistoryModal() {
    const m = this._historyModal;
    if (!m) return;
    if (m.wheelHandler) {
      try { this.input.off('wheel', m.wheelHandler); } catch (e) {}
    }
    m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    if (m.box) { try { m.box.destroy(); } catch (e) {} }
    this._historyModal = null;
  }

export function _applySkinsScroll() {
    if (this._skinsPanel && this._skinsPanel.container) {
      this._skinsPanel.container.y = this._skinsScroll ? this._skinsScroll.y : 0;
    }
  }

  // Ряд классов в гардеробе: у каждого свой наряд. Те же правила,
  // что во вкладке оружия: фиксированные слоты, закрытые с уровнем.
export function createSkinCard(cx, cy, skin, cellW) {
    const W = cellW || 110;
    // Название обязано влезать (п.12): ячейка выше, шрифт меньше, 3 строки.
    const H = 64;
    const rarityColor = skin.rarityColor || '#5bc0ff';
    const epithet = (skin.name.split('«')[1] || skin.name).replace('»', '');
    const sel = (this._contractSel || []).some(s => s.id === skin.id);
    const bg = this.add.graphics();
    const paint = (hover) => {
      bg.clear();
      bg.fillStyle(sel ? 0x554400 : 0x1a1a3c, 1);
      bg.fillRoundedRect(cx, cy, W, H, 6);
      bg.lineStyle(sel || hover ? 3 : 2, sel ? 0xffd24a : hover ? 0xffee55 : rarityColor);
      bg.strokeRoundedRect(cx, cy, W, H, 6);
    };
    paint(false);
    const label = this.add.text(cx + 6, cy + 4, epithet, {
      fontSize: '9px',
      color: sel ? '#ffd24a' : '#dddddd',
      wordWrap: { width: W - 12 }
    }).setOrigin(0, 0);
    // Обрезаем до 3 строк, чтобы не вылезало из ячейки.
    while (label.displayHeight > 34 && label.text.length > 4) {
      label.setText(label.text.slice(0, -2));
    }
    const rName = this.add.text(cx + 6, cy + H - 14, skin.rarityName || '', {
      fontSize: '9px',
      color: skin.rarityColor || '#888899'
    }).setOrigin(0, 0);

    const hit = this.add.rectangle(cx + W / 2, cy + H / 2, W, H, 0xffffff, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      paint(true);
      this.showSkinTooltip(skin);
    });
    hit.on('pointerout', () => {
      paint(false);
      this.hideTooltip();
    });
    hit.on('pointerdown', () => {
      // Выбор — только в окне контракта (п.37). Здесь клик подсвечивает.
      this.showSkinTooltip(skin);
    });

    this.cards.push(hit);
    // Возвращаем контейнер-группу (для добавления в скролл-контейнер).
    const holder = this.add.container(0, 0, [bg, label, rName, hit]);
    holder._parts = [bg, label, rName, hit];
    return holder;
  }

  // Клик по скину = выбор в контракт (макс 5, строго одна редкость).
export function showSkinTooltip(skin) {
    if (!this.tooltipBg) return;

    this.tooltipTitle.setFontSize(16);
    this.tooltipTitle.setText(skin.name);
    // Подсказка честная: выбрать можно только в окне контракта.
    const contractOpen = !!this._contractModal;
    this.tooltipText.setText([
      `Оружие: ${getWeaponLabel(skin.weapon)}`,
      `Редкость: ${skin.rarityName || '?'}`,
      `Цвет: #${String(skin.color || '').replace('#', '')}`,
      contractOpen ? 'Клик — выбрать в контракт' : 'Выбор — в окне контракта обмена'
    ].join('\n'));

    // Бокс — по факту текста, а не фикс 260px: длинные имена/пушки
    // вылезали за края. Заголовок при нужде ужмём шрифтом.
    if (this.tooltipTitle.displayWidth > 320) this.tooltipTitle.setFontSize(14);
    const w = Math.ceil(Math.min(340, Math.max(200, Math.max(this.tooltipTitle.displayWidth, this.tooltipText.displayWidth) + 24)));
    const h = Math.ceil(20 + 26 + this.tooltipText.displayHeight + 10);

    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x000000, 0.85);
    this.tooltipBg.fillRoundedRect(0, 0, w, h, 8);
    this.tooltipBg.lineStyle(1, 0xaa8844);
    this.tooltipBg.strokeRoundedRect(0, 0, w, h, 8);

    this.tooltipTitle.setPosition(10, 8);
    this.tooltipText.setPosition(10, 34);

    const { px, py } = this._clampTip(w, h);

    this.tooltipBg.setPosition(px, py);
    this.tooltipTitle.setPosition(px + 10, py + 8);
    this.tooltipText.setPosition(px + 10, py + 34);
    this.tooltipBg.setVisible(true);
    this.tooltipTitle.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  // Живое превью класса: настоящий Player из редактора (риг + снаряжение).
  // Пушка — только надетая в ячейках: голый класс безоружен (noDefaults),
  // иначе конструктор выдаёт штатные стволы и все выглядят вооружёнными.
