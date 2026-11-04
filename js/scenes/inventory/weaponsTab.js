import { UX } from '../../ui/layout.js';
import { gameState, getEquipment } from '../../data/gameState.js';
import { weaponsList, classDefinitions, weaponByClass, secondaryWeapons, getWeaponLabel, weaponImage, isClassUnlocked, classOpenLevel } from '../../data/weapons.js';

import { getWeaponLevel, isUpgradeable } from '../../data/upgrades.js';

import Assault from '../../entities/Assault.js';
import Tank from '../../entities/Tank.js';
import Medic from '../../entities/Medic.js';
import Sniper from '../../entities/Sniper.js';

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

export function getWeaponData(name) {
    return weaponsList.find(w => w.name === name);
  }

export function isWeaponEquipped(name) {
    const eq = getEquipment(this.selectedClass);
    return eq.primary === name || eq.secondary === name || eq.melee === name;
  }

export function drawViewTabs(parent) {
    this.viewTabs = [];
    const tabs = [
      { id: 'weapons', label: 'ОРУЖИЕ', x: 140 },
      { id: 'skins', label: 'СКИНЫ', x: 400 },
      { id: 'profile', label: 'ГАРДЕРОБ', x: 660 },
      { id: 'misc', label: 'ДРУГОЕ', x: 920 }
    ];

    const tw = 140, th = 34, tr = 8;
    const ty = 70;

    tabs.forEach(tab => {
      const active = this.view === tab.id;
      const fr = this.add.graphics().setDepth(9);
      if (parent) parent.add(fr);

      const renderTab = (hot) => {
        fr.clear();
        if (active) {
          fr.fillStyle(0x282214, 0.98);
          fr.fillRoundedRect(tab.x - tw / 2, ty - th / 2, tw, th, tr);
          fr.fillStyle(0xffffff, 0.12);
          fr.fillRoundedRect(tab.x - tw / 2, ty - th / 2, tw, 5, { tl: tr, tr: tr, bl: 0, br: 0 });
          fr.lineStyle(1.5, 0xffd24a, 1);
          fr.strokeRoundedRect(tab.x - tw / 2, ty - th / 2, tw, th, tr);
        } else {
          fr.fillStyle(hot ? 0x181c2c : 0x111422, 0.92);
          fr.fillRoundedRect(tab.x - tw / 2, ty - th / 2, tw, th, tr);
          fr.fillStyle(0xffffff, hot ? 0.08 : 0.03);
          fr.fillRoundedRect(tab.x - tw / 2, ty - th / 2, tw, 5, { tl: tr, tr: tr, bl: 0, br: 0 });
          fr.lineStyle(1, hot ? 0x4a5a80 : 0x242a3e, 1);
          fr.strokeRoundedRect(tab.x - tw / 2, ty - th / 2, tw, th, tr);
        }
      };
      renderTab(false);

      const btn = this.add.text(tab.x, ty, tab.label, {
        fontSize: '14px',
        color: active ? '#ffd24a' : '#8899bb',
        fontStyle: active ? 'bold' : 'normal',
        fixedWidth: tw,
        padding: { top: 7, bottom: 7 },
        align: 'center'
      }).setOrigin(0.5).setDepth(10);
      if (parent) parent.add(btn);

      btn.viewId = tab.id;
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        if (this.view === tab.id) return;
        this.view = tab.id;
        this.redraw();
      });
      btn.on('pointerover', () => {
        if (this.view !== tab.id) {
          renderTab(true);
          btn.setStyle({ color: '#ffffff' });
        }
      });
      btn.on('pointerout', () => {
        if (this.view !== tab.id) {
          renderTab(false);
          btn.setStyle({ color: '#8899bb' });
        }
      });

      this.viewTabs.push(btn);
    });
  }

export function drawClassTabs() {
    if (this.view !== 'weapons') return;
    const c = this.add.container(0, 0).setDepth(10);
    this._dynamicContainers.push(c);

    const CLASS_PALETTE = {
      Assault: 0x3888f0,
      Tank: 0xd47820,
      Medic: 0x2eb868,
      Sniper: 0x9e4fd8
    };

    const cw = 168, ch = 34, cr = 7;
    const cy = 150;

    classDefinitions.forEach((cd, i) => {
      const x = UX(this, 130 + i * 180);
      const selected = cd.id === this.selectedClass;
      const unlocked = isClassUnlocked(cd.id, gameState.level);
      const tabLabel = unlocked ? cd.label : `${cd.label} (ур. ${classOpenLevel(cd.id)})`;
      const clr = CLASS_PALETTE[cd.id] || 0x4466aa;

      const fr = this.add.graphics();
      c.add(fr);

      const renderClassTab = (hot) => {
        fr.clear();
        if (!unlocked) {
          fr.fillStyle(0x0c0e18, 0.6);
          fr.fillRoundedRect(x - cw / 2, cy - ch / 2, cw, ch, cr);
          fr.lineStyle(1, 0x1e2230, 0.7);
          fr.strokeRoundedRect(x - cw / 2, cy - ch / 2, cw, ch, cr);
        } else if (selected) {
          fr.fillStyle(0x181c2e, 0.95);
          fr.fillRoundedRect(x - cw / 2, cy - ch / 2, cw, ch, cr);
          fr.fillStyle(0xffffff, 0.1);
          fr.fillRoundedRect(x - cw / 2, cy - ch / 2, cw, 5, { tl: cr, tr: cr, bl: 0, br: 0 });
          fr.lineStyle(2, clr, 1);
          fr.strokeRoundedRect(x - cw / 2, cy - ch / 2, cw, ch, cr);
        } else {
          fr.fillStyle(hot ? 0x181c2c : 0x111422, 0.9);
          fr.fillRoundedRect(x - cw / 2, cy - ch / 2, cw, ch, cr);
          fr.fillStyle(0xffffff, hot ? 0.08 : 0.03);
          fr.fillRoundedRect(x - cw / 2, cy - ch / 2, cw, 5, { tl: cr, tr: cr, bl: 0, br: 0 });
          fr.lineStyle(1, hot ? clr : 0x242a3e, hot ? 0.9 : 0.6);
          fr.strokeRoundedRect(x - cw / 2, cy - ch / 2, cw, ch, cr);
        }
      };
      renderClassTab(false);

      const tab = this.add.text(x, cy, tabLabel, {
        fontSize: '14px',
        color: selected ? '#ffffff' : (unlocked ? '#99aacc' : '#556677'),
        fontStyle: selected ? 'bold' : 'normal',
        fixedWidth: cw,
        padding: { top: 7, bottom: 7 },
        align: 'center'
      }).setOrigin(0.5);
      c.add(tab);

      if (unlocked) {
        tab.setInteractive({ useHandCursor: true });
        tab.on('pointerdown', () => {
          if (!isClassUnlocked(cd.id, gameState.level)) return;
          this.selectedClass = cd.id;
          this.redraw();
        });
        tab.on('pointerover', () => {
          if (cd.id !== this.selectedClass) {
            renderClassTab(true);
            tab.setStyle({ color: '#ffffff' });
          }
        });
        tab.on('pointerout', () => {
          if (cd.id !== this.selectedClass) {
            renderClassTab(false);
            tab.setStyle({ color: '#99aacc' });
          }
        });
      }
    });
  }

export function ownedWeaponsForClass() {
    // Основное = оружие класса + общее (ПП/РПГ), второе — пистолеты.
    const primaryNames = [...(weaponByClass[this.selectedClass] || []), ...(weaponByClass.Common || [])];
    const primary = [...new Set(primaryNames)]
      .filter(n => gameState.unlockedWeapons.includes(n))
      .map(n => this.getWeaponData(n))
      .filter(Boolean);
    const secondary = secondaryWeapons
      .filter(n => gameState.unlockedWeapons.includes(n))
      .map(n => this.getWeaponData(n))
      .filter(Boolean);
    // Ближнее оружие (п.17): нож + кейсовые катана/мачете — ячейки как у
    // основного/второго.
    const melee = ['Knife', 'катана', 'мачете']
      .filter(n => gameState.unlockedWeapons.includes(n) || n === 'Knife')
      .map(n => this.getWeaponData(n))
      .filter(Boolean);
    return { primary, secondary, melee };
  }

export function drawLeftPanel() {
    const panel = { x: 15, y: 105, w: 770, h: 570 };
    const c = this.add.container(0, 0);
    this._dynamicContainers.push(c);

    this.panelGfx = this.add.graphics();
    this.panelGfx.fillStyle(0x0f1220, 0.98);
    this.panelGfx.fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
    this.panelGfx.lineStyle(1, 0xffffff, 0.08);
    this.panelGfx.lineBetween(panel.x + 14, panel.y + 2, panel.x + panel.w - 14, panel.y + 2);
    this.panelGfx.lineStyle(2, 0x060812, 1);
    this.panelGfx.strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
    this.panelGfx.lineStyle(1, 0x252d42, 1);
    this.panelGfx.strokeRoundedRect(panel.x + 2, panel.y + 2, panel.w - 4, panel.h - 4, 8);
    this.panelGfx.fillStyle(0x667799, 0.7);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      this.panelGfx.fillCircle(panel.x + (sx < 0 ? 10 : panel.w - 10), panel.y + (sy < 0 ? 10 : panel.h - 10), 2);
    });
    c.add(this.panelGfx);

    this.drawViewTabs(c);

    if (this.view === 'skins') {
      this.drawSkinsPanel(panel, c);
      return;
    }

    if (this.view === 'profile') {
      this.drawProfilePanel(panel, c);
      return;
    }

    if (this.view === 'misc') {
      this.drawMiscPanel(panel, c);
      return;
    }

    const { primary, secondary, melee } = this.ownedWeaponsForClass();
    const sections = [
      { label: 'ОСНОВНОЕ ОРУЖИЕ', items: primary },
      { label: 'ВТОРОЕ ОРУЖИЕ', items: secondary },
      { label: 'БЛИЖНЕЕ ОРУЖИЕ', items: melee }
    ];
    const cols = 6;
    const cardW = 118;
    const cardH = 64;
    const gapX = 8;
    const gapY = 8;
    const startX = panel.x + 12;

    // Сетка ниже: ряд классов (y150) лежит поверх панели.
    let y = panel.y + 88;

    sections.forEach(section => {
      const lbl = this.add.text(startX, y + 10, section.label, {
        fontSize: '13px',
        color: '#99aacc'
      }).setOrigin(0, 0.5);
      c.add(lbl);
      y += 26;

      if (section.items.length === 0) {
        const empty = this.add.text(startX, y, 'Нет доступного оружия', {
          fontSize: '14px',
          color: '#556677'
        }).setOrigin(0, 0);
        c.add(empty);
        y += 30;
        return;
      }

      section.items.forEach((weapon, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const cx = startX + col * (cardW + gapX);
        const cy = y + row * (cardH + gapY);

        this.createWeaponCard(cx, cy, weapon, cardW, cardH, c);
      });

      y += Math.ceil(section.items.length / cols) * (cardH + gapY);
    });

    this.drawCompareSlots(panel, c);
  }

  // Фон ячейки как в магазине: скруглённый Graphics + состояния.
  // equipped — золото, обычная — navy, наведение — жёлтая рамка 2px.
export function _drawCardBg(bg, w, h, equipped, hover, ulevel) {
    bg.clear();
    const glow = (ulevel | 0) >= 5 ? 3 : ((ulevel | 0) >= 4 ? 2 : 0);
    const r = 8;
    if (equipped) {
      bg.fillStyle(hover ? 0x362c14 : 0x27200e, 0.98);
      bg.fillRoundedRect(0, 0, w, h, r);
      bg.fillStyle(0xffffff, hover ? 0.14 : 0.07);
      bg.fillRoundedRect(0, 0, w, 5, { tl: r, tr: r, bl: 0, br: 0 });
      bg.lineStyle(hover ? 2 : 1.5, hover ? 0xffff88 : (glow >= 3 ? 0xffe97a : 0xffd24a));
      bg.strokeRoundedRect(0, 0, w, h, r);
    } else {
      bg.fillStyle(hover ? 0x1b2034 : 0x131625, 0.95);
      bg.fillRoundedRect(0, 0, w, h, r);
      bg.fillStyle(0xffffff, hover ? 0.08 : 0.03);
      bg.fillRoundedRect(0, 0, w, 5, { tl: r, tr: r, bl: 0, br: 0 });
      if (glow) {
        bg.lineStyle(glow, glow >= 3 ? 0xffe97a : 0xffd24a);
      } else {
        bg.lineStyle(hover ? 1.5 : 1, hover ? 0x66aaff : 0x283046);
      }
      bg.strokeRoundedRect(0, 0, w, h, r);
    }
  }

export function createWeaponCard(cx, cy, weapon, cardW, cardH, parent) {
    const equipped = this.isWeaponEquipped(weapon.name);
    // Уровень заточки — в рамку (свечение) и подпись.
    let ulevel = 0;
    try { ulevel = isUpgradeable(weapon.name) ? getWeaponLevel(weapon.name) : 0; } catch (e) {}
    // Слой внешности (неинтерактивный) + отдельная хитзона на всю ячейку
    // с запасом 3px за края: ховер ловится и на границах/рамке, а не только
    // по центру. Пушка — крупно сверху, название — снизу по центру.
    const layer = this.add.container(cx, cy);
    layer.setDepth(10);
    if (parent) parent.add(layer);

    const bg = this.add.graphics();
    this._drawCardBg(bg, cardW, cardH, equipped, false, ulevel);
    layer.add(bg);

    const iconKey = weaponImage(weapon.name);
    if (this.textures.exists(iconKey)) {
      const icon = this.add.image(cardW / 2, 26, iconKey);
      // Без сплющивания: в бокс 100×36 в верхней части ячейки.
      // Размер — строго из исходника (icon.width в момент создания может
      // быть нулевым — тогда формула давала масштаб 36 и катана на весь экран).
      try {
        const src = this.textures.get(iconKey).getSourceImage();
        const sw = (src && src.width) || 0, sh = (src && src.height) || 0;
        let sc = 1;
        if (sw > 0 && sh > 0) sc = Math.min(100 / sw, 36 / sh);
        icon.setScale(Phaser.Math.Clamp(sc, 0.1, 3));
      } catch (e) {
        icon.setScale(1);
      }
      // Страховка по факту: что бы ни вышло — в бокс 110×44, без поворота.
      try {
        icon.setRotation(0);
        if (icon.displayWidth > cardW - 8 || icon.displayHeight > 44) {
          const k2 = Math.min((cardW - 8) / icon.displayWidth, 44 / icon.displayHeight);
          icon.setScale(icon.scaleX * k2);
        }
      } catch (e) {}
      layer.add(icon);
    }

    let fs = 12;
    let cardLabel = getWeaponLabel(weapon.name);
    try { if (ulevel > 0) cardLabel += ` +${ulevel}`; } catch (e) {}
    const baseColor = ulevel >= 4 ? '#ffd24a' : (equipped ? '#aa8800' : '#dddddd');
    const label = this.add.text(cardW / 2, cardH - 11, cardLabel, {
      fontSize: fs + 'px',
      color: baseColor
    }).setOrigin(0.5);
    while (label.displayWidth > cardW - 8 && fs > 9) {
      fs -= 1;
      label.setFontSize(fs);
    }
    layer.add(label);

    const hit = this.add.rectangle(cx + cardW / 2, cy + cardH / 2, cardW + 6, cardH + 6, 0xffffff, 0.001);
    hit.setDepth(11);
    if (parent) parent.add(hit);
    hit.weaponName = weapon.name;
    hit.homeX = cx + cardW / 2;
    hit.homeY = cy + cardH / 2;
    hit.homeLX = cx;
    hit.homeLY = cy;
    hit.isEquipped = equipped;
    hit.cardW = cardW;
    hit.cardH = cardH;
    hit._layer = layer;
    hit._bg = bg;
    hit._label = label;
    hit._weapon = weapon;
    hit._ulevel = ulevel;
    hit._baseColor = baseColor;
    hit.setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(hit);
    hit.on('pointerover', () => {
      label.setColor('#ffff55');
      this._drawCardBg(bg, cardW, cardH, hit.isEquipped, true, hit._ulevel);
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.2 });
        }
      } catch (e) { /* noop */ }
      this.showTooltipFor(weapon);
    });
    hit.on('pointerout', () => {
      label.setColor(hit._baseColor || (hit.isEquipped ? '#aa8800' : '#dddddd'));
      this._drawCardBg(bg, cardW, cardH, hit.isEquipped, false, hit._ulevel);
      this.hideTooltip();
    });

    this.cards.push(hit);
  }
