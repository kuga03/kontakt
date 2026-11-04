import { gameW, UX } from '../ui/layout.js?v=3';

import { classDefinitions } from '../data/weapons.js?v=170';

import Assault from '../entities/Assault.js?v=319';
import Tank from '../entities/Tank.js?v=319';
import Medic from '../entities/Medic.js?v=319';
import Sniper from '../entities/Sniper.js?v=320';

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

import * as ContractModal from './inventory/contractModal.js?v=3';
import * as EquipDnD from './inventory/equipDnD.js?v=3';
import * as SkinsTab from './inventory/skinsTab.js?v=3';
import * as WardrobeTab from './inventory/wardrobeTab.js?v=401';
import * as WeaponsTab from './inventory/weaponsTab.js?v=3';
export default class InventoryScene extends Phaser.Scene {
  constructor() {
    super('InventoryScene');
  }

  create(data) {
    const _cx = gameW(this) / 2;
    this.cameras.main.setBackgroundColor('#080914');

    // Глубина фона: атмосферный темный градиент
    try {
      const bgb = this.add.graphics();
      bgb.fillStyle(0x0f1224, 1);
      bgb.fillRect(0, 0, gameW(this), 240);
      bgb.fillStyle(0x0a0c1a, 1);
      bgb.fillRect(0, 240, gameW(this), 240);
      bgb.fillStyle(0x060710, 1);
      bgb.fillRect(0, 480, gameW(this), 240);
    } catch (e) {}

    this.selectedClass = 'Assault';
    // Прямой вход на вкладку.
    const startView = data && data.view;
    this.view = (startView === 'weapons' || startView === 'skins' ||
      startView === 'profile' || startView === 'misc')
      ? startView : 'weapons';
    this.cards = [];
    this.compareWeapons = [null, null];
    this.classColors = {};
    this._dynamicContainers = [];

    classDefinitions.forEach(cd => {
      this.classColors[cd.id] = cd.color;
    });

    this.add.text(_cx, 24, 'ИНВЕНТАРЬ', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Кнопка Назад в стиле меню Банды: скругление, блик, подсветка рамки
    const backX = UX(this, 70), backY = 28;
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
    });
    this.backBtn.on('pointerout', () => {
      renderBack(false);
      this.backBtn.setStyle({ color: '#ffffff' });
    });

    this.drawTooltip();
    this.bindDrag();

    // Колесо над списком скинов — прокрутка (иначе 29+ скинов не влезут).
    // Именованный хендлер + off при shutdown: иначе каждый рестарт сцены
    // вешает дубль и скролл дёргается вдвое.
    this._skinsWheel = (pointer, over, dx, dy) => {
      if (this.view !== 'skins' || !this._skinsPanel) return;
      const p = this._skinsPanel;
      if (pointer.x < p.x || pointer.x > p.x + p.w || pointer.y < p.y || pointer.y > p.y + p.h) return;
      this._skinsScroll = this._skinsScroll || { y: 0 };
      this._skinsScroll.y = Phaser.Math.Clamp(this._skinsScroll.y + (dy > 0 ? -48 : 48), this._skinsScroll.max || 0, 0);
      this._applySkinsScroll();
    };
    this.input.on('wheel', this._skinsWheel);
    // Колесо над счётчиком коллекции (правая панель скинов).
    this._skinCountWheel = (pointer, over, dx, dy) => {
      const st = this._skinCount;
      if (this.view !== 'skins' || !st || !st.c || !st.c.active) return;
      if (pointer.x < st.x || pointer.x > st.x + st.w || pointer.y < st.ry || pointer.y > st.ry + st.h) return;
      st.y = Phaser.Math.Clamp(st.y + (dy > 0 ? -48 : 48), st.max || 0, 0);
      try { st.c.y = st.y; } catch (e) {}
    };
    this.input.on('wheel', this._skinCountWheel);
    this.events.once('shutdown', () => {
      if (this._skinsWheel) this.input.off('wheel', this._skinsWheel);
      this._skinsWheel = null;
      if (this._skinCountWheel) this.input.off('wheel', this._skinCountWheel);
      this._skinCountWheel = null;
    });

    this.drawClassTabs();
    this.time.delayedCall(0, () => {
      this.drawLeftPanel();
      this.time.delayedCall(0, () => {
        this.drawPlayerPanel();
      });
    });
  }

  getWeaponData(name) { return WeaponsTab.getWeaponData.call(this, name); }
  isWeaponEquipped(name) { return WeaponsTab.isWeaponEquipped.call(this, name); }
  drawViewTabs(parent) { return WeaponsTab.drawViewTabs.call(this, parent); }
  drawClassTabs() { return WeaponsTab.drawClassTabs.call(this); }
  ownedWeaponsForClass() { return WeaponsTab.ownedWeaponsForClass.call(this); }
  drawLeftPanel() { return WeaponsTab.drawLeftPanel.call(this); }
  _drawCardBg(bg, w, h, equipped, hover, ulevel) { return WeaponsTab._drawCardBg.call(this, bg, w, h, equipped, hover, ulevel); }
  createWeaponCard(cx, cy, weapon, cardW, cardH, parent) { return WeaponsTab.createWeaponCard.call(this, cx, cy, weapon, cardW, cardH, parent); }
  drawSkinsPanel(panel, parent) { return SkinsTab.drawSkinsPanel.call(this, panel, parent); }
  _openContractModal() { return ContractModal._openContractModal.call(this); }
  _buildContractGrid() { return ContractModal._buildContractGrid.call(this); }
  _applyContractScroll() { return ContractModal._applyContractScroll.call(this); }
  _refreshContractSign() { return ContractModal._refreshContractSign.call(this); }
  _closeContractModal() { return ContractModal._closeContractModal.call(this); }
  _openFragModal() { return ContractModal._openFragModal.call(this); }
  _closeFragModal() { return ContractModal._closeFragModal.call(this); }
  _contractLegendaryOk(sel) { return ContractModal._contractLegendaryOk.call(this, sel); }
  _signContractAnimated() { return ContractModal._signContractAnimated.call(this); }
  _contractMergeFlash(m, sel) { return ContractModal._contractMergeFlash.call(this, m, sel); }
  _applyContractResult(sel) { return ContractModal._applyContractResult.call(this, sel); }
  _showContractPrize(res) { return ContractModal._showContractPrize.call(this, res); }
  _openHistoryModal() { return SkinsTab._openHistoryModal.call(this); }
  _closeHistoryModal() { return SkinsTab._closeHistoryModal.call(this); }
  _applySkinsScroll() { return SkinsTab._applySkinsScroll.call(this); }
  drawWardrobeClassTabs(panel, parent) { return WardrobeTab.drawWardrobeClassTabs.call(this, panel, parent); }
  drawProfilePanel(panel, parent) { return WardrobeTab.drawProfilePanel.call(this, panel, parent); }
  _gearOwnedMeta(meta) { return WardrobeTab._gearOwnedMeta.call(this, meta); }
  _setPartsLine(s) { return WardrobeTab._setPartsLine.call(this, s); }
  drawGearRow(panel, parent, title, items, equippedTex, titleY, rowY, onPick, perRow) { return WardrobeTab.drawGearRow.call(this, panel, parent, title, items, equippedTex, titleY, rowY, onPick, perRow); }
  drawSwatches(panel, title, colors, activeHex, part, titleY, rowY, parent, size) { return WardrobeTab.drawSwatches.call(this, panel, title, colors, activeHex, part, titleY, rowY, parent, size); }
  createSkinCard(cx, cy, skin, cellW) { return SkinsTab.createSkinCard.call(this, cx, cy, skin, cellW); }
  _toggleContractSkin(skin) { return ContractModal._toggleContractSkin.call(this, skin); }
  _doContract() { return ContractModal._doContract.call(this); }
  showSkinTooltip(skin) { return SkinsTab.showSkinTooltip.call(this, skin); }
  _spawnPreview(classId, x, y, aimLeft, scale) { return WardrobeTab._spawnPreview.call(this, classId, x, y, aimLeft, scale); }
  update() {
    const p = this._preview;
    if (p && p.active && !p.dead) {
      try {
        p.updateBars();
        if (p.updateGun) p.updateGun();
        p.healthBar.setVisible(false);
        p.armorBar.setVisible(false);
        p.nameText.setVisible(false);
      } catch (e) { /* превью не роняет сцену */ }
    }
  }

  // Вкладка «Другое»: пока здесь живут фрагменты главной награды ежедневки.
  // Четыре ячейки как у оружия (разноцветные фигурки), клик — окно обмена.
  drawMiscPanel(panel, parent) { return WardrobeTab.drawMiscPanel.call(this, panel, parent); }
  drawPlayerPanel() { return WardrobeTab.drawPlayerPanel.call(this); }
  _openAbilitiesModal() { return WardrobeTab._openAbilitiesModal.call(this); }
  drawEquipSlots(panel, parent) { return EquipDnD.drawEquipSlots.call(this, panel, parent); }
  drawCompareSlots(panel, parent) { return EquipDnD.drawCompareSlots.call(this, panel, parent); }
  nearestCompareSlot(x, y, maxDist) { return EquipDnD.nearestCompareSlot.call(this, x, y, maxDist); }
  nearestEquipSlot(x, y, maxDist) { return EquipDnD.nearestEquipSlot.call(this, x, y, maxDist); }
  drawTooltip() { return EquipDnD.drawTooltip.call(this); }
  _clampTip(w, h) { return EquipDnD._clampTip.call(this, w, h); }
  showTooltipFor(weapon) { return EquipDnD.showTooltipFor.call(this, weapon); }
  hideTooltip() { return EquipDnD.hideTooltip.call(this); }
  bindDrag() { return EquipDnD.bindDrag.call(this); }
  _denyEquipSlot(need) { return EquipDnD._denyEquipSlot.call(this, need); }
  updateDropHighlights(x, y) { return EquipDnD.updateDropHighlights.call(this, x, y); }
  clearDropHighlights() { return EquipDnD.clearDropHighlights.call(this); }
  redrawSlot(item, color) { return EquipDnD.redrawSlot.call(this, item, color); }
  nearestEquipSlotIndex(x, y, maxDist) { return EquipDnD.nearestEquipSlotIndex.call(this, x, y, maxDist); }
  showCompareStats() { return EquipDnD.showCompareStats.call(this); }
  _destroyDynamic() {
    if (this._closeSkinDropdown) this._closeSkinDropdown();
    if (this._preview) {
      try { this._preview.destroy(); } catch (e) {}
      this._preview = null;
    }
    this._dynamicContainers.forEach(c => {
      if (c && c.destroy) c.destroy();
    });
    this._dynamicContainers = [];
    this.cards = [];
    this.equipSlotRects = [];
    this.compareSlotRects = [];
    this.playerPanelGfx = null;
    if (this.compareStatsCards) {
      this.compareStatsCards.forEach(c => c.destroy());
      this.compareStatsCards = null;
    }
  }

  redraw() {
    this._destroyDynamic();
    this.drawClassTabs();
    this.drawLeftPanel();
    this.drawPlayerPanel();
    if (this.view === 'weapons') {
      this.showCompareStats();
    }
  }
}
