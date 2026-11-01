import { UX } from '../../ui/layout.js?v=3';
import { gameState, getEquipment } from '../../data/gameState.js?v=171';
import { weaponsList, classDefinitions, weaponByClass, secondaryWeapons, getWeaponLabel, weaponImage, isClassUnlocked, classOpenLevel } from '../../data/weapons.js?v=170';

import { getWeaponLevel, isUpgradeable } from '../../data/upgrades.js?v=2';

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

    tabs.forEach(tab => {
      const active = this.view === tab.id;
      const btn = this.add.text(tab.x, 70, tab.label, {
        fontSize: '15px',
        color: active ? '#111111' : '#ffffff',
        backgroundColor: active ? '#ffee55' : '#252570',
        padding: 5,
        fixedWidth: 130,
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
        if (this.view !== tab.id) btn.setStyle({ color: '#ffff55' });
      });
      btn.on('pointerout', () => {
        if (this.view !== tab.id) btn.setStyle({ color: '#ffffff' });
      });

      this.viewTabs.push(btn);
    });
  }

export function drawClassTabs() {
    if (this.view !== 'weapons') return;
    const c = this.add.container(0, 0).setDepth(10);
    this._dynamicContainers.push(c);

    // Фиксированные слоты (панель 15–785): длинные подписи с уровнями
    // больше не налезают друг на друга. Подложки контрастные к панели
    // (#151538): иначе сливаются с фоном.
    classDefinitions.forEach((cd, i) => {
      const x = UX(this, 130 + i * 180);
      const selected = cd.id === this.selectedClass;
      const unlocked = isClassUnlocked(cd.id, gameState.level);
      const tabLabel = unlocked ? cd.label : `${cd.label} (ур. ${classOpenLevel(cd.id)})`;

      const tab = this.add.text(x, 150, tabLabel, {
        fontSize: '16px',
        color: selected ? '#ffff55' : unlocked ? '#ffffff' : '#667788',
        backgroundColor: selected ? '#2a2a5a' : unlocked ? '#2e2e72' : '#14142c',
        padding: 8,
        fixedWidth: 168,
        align: 'center'
      }).setOrigin(0.5);
      c.add(tab);

      tab.setInteractive({ useHandCursor: unlocked });
      tab.on('pointerdown', () => {
        if (!isClassUnlocked(cd.id, gameState.level)) return;
        this.selectedClass = cd.id;
        this.redraw();
      });
      tab.on('pointerover', () => tab.setStyle({ color: '#ffff55' }));
      tab.on('pointerout', () => {
        tab.setStyle({ color: cd.id === this.selectedClass ? '#ffff55' : (isClassUnlocked(cd.id, gameState.level) ? '#ffffff' : '#667788') });
      });
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
    this.panelGfx.fillStyle(0x151538, 1);
    this.panelGfx.fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
    this.panelGfx.lineStyle(2, 0x444488);
    this.panelGfx.strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
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
    // Свечение заточки (п.14.4): +4 золотая рамка, +5 ярче и толще.
    const glow = (ulevel | 0) >= 5 ? 3 : ((ulevel | 0) >= 4 ? 2 : 0);
    if (equipped) {
      bg.fillStyle(hover ? 0x554400 : 0x443300, 0.95);
    } else {
      bg.fillStyle(0x1a1a4a, 0.9);
    }
    bg.fillRoundedRect(0, 0, w, h, 8);
    if (glow) {
      bg.lineStyle(glow, glow >= 3 ? 0xffe97a : 0xffd24a);
    } else if (equipped) {
      bg.lineStyle(hover ? 2 : 1, hover ? 0xffee55 : 0xaa8800);
    } else {
      bg.lineStyle(hover ? 2 : 1, hover ? 0xffee55 : 0x4466aa);
    }
    bg.strokeRoundedRect(0, 0, w, h, 8);
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
