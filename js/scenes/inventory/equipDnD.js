import { gameW, UX } from '../../ui/layout.js?v=3';
import { getEquipment, setEquippedWeapon } from '../../data/gameState.js?v=175';
import { secondaryWeapons, getWeaponLabel } from '../../data/weapons.js?v=170';

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

export function drawEquipSlots(panel, parent) {
    const eq = getEquipment(this.selectedClass);
    this.equipSlotRects = [];

    const eqLabel = this.add.text(panel.x + panel.w / 2, panel.y + 250, 'СНАРЯЖЕНИЕ', {
      fontSize: '16px', color: '#99aacc'
    }).setOrigin(0.5);
    if (parent) parent.add(eqLabel);

    EQUIP_SLOTS.forEach(slot => {
      const name = eq[slot.slot];
      // Заточка надетого (п.14.4): +N в имя, золото на +4/+, клик — в модалку.
      let ulevel = 0;
      try { ulevel = (name && isUpgradeable(name)) ? getWeaponLevel(name) : 0; } catch (e) {}

      const rect = { x: slot.x - 85, y: slot.y - 22, w: 170, h: 44 };
      const slotGfx = this.add.graphics();
      slotGfx.fillStyle(0x0d0d2a, 1);
      slotGfx.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
      slotGfx.lineStyle(ulevel >= 4 ? 3 : 2, ulevel >= 4 ? (ulevel >= 5 ? 0xffe97a : 0xffd24a) : (name ? 0x88aa44 : 0x445577));
      slotGfx.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
      if (parent) parent.add(slotGfx);
      this.equipSlotRects.push({ g: slotGfx, rect, slot });

      let slotName = name ? getWeaponLabel(name) : '—';
      try { if (name && ulevel > 0) slotName += ` +${ulevel}`; } catch (e) {}
      const nameText = this.add.text(slot.x, slot.y, slotName, {
        fontSize: '17px',
        color: !name ? '#667788' : (ulevel >= 4 ? '#ffd24a' : '#ffff55'),
        padding: 6
      }).setOrigin(0.5).setDepth(1);
      // Длинное имя + суффикс не должны залезать на «снять»: ужимаем шрифт.
      try {
        let nfs = 17;
        while (nameText.displayWidth > 150 && nfs > 12) { nfs -= 1; nameText.setFontSize(nfs); }
      } catch (e) {}
      if (parent) parent.add(nameText);
      // Клик по имени надетого — в Модернизацию (вкладка «Снаряжения», п.14.4).
      if (name) {
        try {
          nameText.setInteractive({ useHandCursor: true });
          nameText.on('pointerover', () => nameText.setStyle({ color: '#ffffff' }));
          nameText.on('pointerout', () => nameText.setStyle({ color: ulevel >= 4 ? '#ffd24a' : '#ffff55' }));
          nameText.on('pointerdown', () => this.scene.start('ShopScene', { tab: 'upgrade' }));
        } catch (e) {}
      }

      const slotLabel = this.add.text(slot.x - 90, slot.y, slot.label, {
        fontSize: '12px', color: '#99aacc'
      }).setOrigin(1, 0.5);
      if (parent) parent.add(slotLabel);

      const removeBtn = this.add.text(slot.x + 95, slot.y, 'снять', {
        fontSize: '13px',
        color: name ? '#ffe0a0' : '#445566',
        backgroundColor: name ? '#553322' : '#222a33',
        padding: 4
      }).setOrigin(0.5).setDepth(1);
      if (parent) parent.add(removeBtn);

      removeBtn.setInteractive({ useHandCursor: name != null });
      removeBtn.on('pointerdown', () => {
        if (!name) return;
        setEquippedWeapon(this.selectedClass, slot.slot, null);
        this.redraw();
      });
      removeBtn.on('pointerover', () => removeBtn.setStyle({ color: '#ffffff' }));
      removeBtn.on('pointerout', () => removeBtn.setStyle({ color: name ? '#ffe0a0' : '#445566' }));
    });
  }

export function drawCompareSlots(panel, parent) {
    this.compareSlotRects = [];

    const sy = 545;

    const compareLabel = this.add.text(panel.x + panel.w / 2, sy - 20, 'СРАВНЕНИЕ ОРУЖИЯ — перетащи карточки в слоты:', {
      fontSize: '14px', color: '#99aacc'
    }).setOrigin(0.5);
    if (parent) parent.add(compareLabel);

    COMPARE_SLOTS.forEach((slot) => {
      const rect = { x: slot.x - 55, y: slot.y - 20, w: 110, h: 40 };
      const g = this.add.graphics();
      g.fillStyle(0x0d0d2a, 1);
      g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
      g.lineStyle(2, 0x4466aa);
      g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
      if (parent) parent.add(g);
      this.compareSlotRects.push({ g, rect, slot });

      const slotText = this.add.text(slot.x, slot.y, '—', {
        fontSize: '16px', color: '#667799'
      }).setOrigin(0.5).setDepth(1);
      if (parent) parent.add(slotText);

      const slotNum = this.add.text(slot.x, slot.y + 28, `Слот ${slot.slot + 1}`, {
        fontSize: '11px', color: '#556699'
      }).setOrigin(0.5);
      if (parent) parent.add(slotNum);
    });
  }

export function nearestCompareSlot(x, y, maxDist) {
    let best = null;
    let bestDist = Infinity;
    COMPARE_SLOTS.forEach((slot, i) => {
      const d = Math.hypot(x - slot.x, y - slot.y);
      if (d < bestDist && d <= maxDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  }

export function nearestEquipSlot(x, y, maxDist) {
    let best = null;
    let bestDist = Infinity;
    EQUIP_SLOTS.forEach(slot => {
      const d = Math.hypot(x - slot.x, y - slot.y);
      if (d < bestDist && d <= maxDist) {
        best = slot;
        bestDist = d;
      }
    });
    return best;
  }

export function drawTooltip() {
    this.tooltipBg = this.add.graphics();
    this.tooltipTitle = this.add.text(0, 0, '', { fontSize: '16px', color: '#ffee88' });
    this.tooltipText = this.add.text(0, 0, '', {
      fontSize: '13px', color: '#e0e0e0', lineSpacing: 4,
      // Перенос длинных строк: иначе текст вылезает за бокс
      // (скины с длинными именами/названиями пушек).
      wordWrap: { width: 300 }
    });
    this.tooltipBg.setDepth(100);
    this.tooltipTitle.setDepth(101);
    this.tooltipText.setDepth(101);
    this.tooltipBg.setScrollFactor(0);
    this.tooltipTitle.setScrollFactor(0);
    this.tooltipText.setScrollFactor(0);
    this.hideTooltip();
  }

  // Кламп тултипа по экрану 1280×720 (как в магазине): у нижнего края
  // всплывает над курсором, у правого — левее.
export function _clampTip(w, h) {
    let px = this.input.activePointer.worldX + 12;
    let py = this.input.activePointer.worldY + 12;
    if (px + w > gameW(this) - 8) px = this.input.activePointer.worldX - 12 - w;
    if (py + h > 712) py = this.input.activePointer.worldY - 12 - h;
    if (px < 8) px = 8;
    if (py < 8) py = 8;
    return { px, py };
  }

export function showTooltipFor(weapon) {
    if (!weapon) return;

    const isMelee = weapon.category === 'melee';
    const rate = Math.round(60000 / weapon.fireRate);
    // Ближний бой: только урон и удары в минуту.
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
    // Заточка видна уровнем, качается в «Модернизации» (п.14.4).
    try {
      if (!isMelee && isUpgradeable(weapon.name)) {
        lines.push(`Заточка +${getWeaponLevel(weapon.name)} — качать в «Модернизации»`);
      }
    } catch (e) {}

    this.tooltipTitle.setText(getWeaponLabel(weapon.name));
    this.tooltipText.setText(lines.join('\n'));

    const w = 230;
    const h = 20 + 26 + lines.length * 18;

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

export function hideTooltip() {
    this.tooltipBg.setVisible(false);
    this.tooltipTitle.setVisible(false);
    this.tooltipText.setVisible(false);
  }

export function bindDrag() {
    this.compareSlotRects = this.compareSlotRects || [];
    this.equipSlotRects = this.equipSlotRects || [];

    this.input.on('dragstart', (pointer, card) => {
      this.dragCard = card;
      // Статы не должны висеть во время и после переноса (п.18).
      this.hideTooltip();
      // Слой карточки — наверх сцены: внутри левой панели он едет
      // ПОД правой (контейнеры рисуются друг под другом целиком).
      // Координаты те же (панели в нулях без масштаба).
      try {
        const lay = card._layer;
        if (lay && lay.parentContainer) {
          card._homeParent = lay.parentContainer;
          lay.parentContainer.remove(lay);
          this.add.existing(lay);
          lay.setDepth(150);
        }
      } catch (e) {}
      this.updateDropHighlights(card.x, card.y);
    });

    this.input.on('drag', (pointer, card, dragX, dragY) => {
      card.x = dragX;
      card.y = dragY;
      // Визуальный слой едет за хитзоной.
      if (card._layer) card._layer.setPosition(dragX - (card.cardW ?? 118) / 2, dragY - (card.cardH ?? 56) / 2);
      if (this.dragCard === card || this.dragCard == null) {
        this.updateDropHighlights(dragX, dragY);
      }
    });

    this.input.on('dragend', (pointer, card) => {
      this.dragCard = null;
      this.clearDropHighlights();
      // После сброса в ячейку тултип не показываем (п.18) — только по ховеру.
      this.hideTooltip();
      // Вернуть слой домой (поднимали на dragstart): дальше возможный
      // redraw сам его приберёт, висяка на сцене не останется.
      try {
        const lay = card._layer;
        if (lay && card._homeParent) {
          try {
            card._homeParent.add(lay);
            lay.setDepth(10);
          } catch (e2) {
            try { lay.destroy(); } catch (e3) {}
          }
        }
        card._homeParent = null;
      } catch (e) {}

      const equipZone = { x: 795, y: 350, w: 475, h: 230 };
      const inEquipZone =
        card.x >= equipZone.x - 20 &&
        card.x <= equipZone.x + equipZone.w + 20 &&
        card.y >= equipZone.y - 20 &&
        card.y <= equipZone.y + equipZone.h + 20;

      const compareIdx = this.nearestCompareSlot(card.x, card.y, 110);
      const equipSlot = this.nearestEquipSlot(card.x, card.y, 90);

      card.x = card.homeX;
      card.y = card.homeY;
      if (card._layer) card._layer.setPosition(card.homeLX, card.homeLY);

      if (inEquipZone && equipSlot) {
        // Слот принимает только свой тип (LAR — второе, хоть и винтовка).
        const cat = this.getWeaponData(card.weaponName)?.category;
        const need = equipSlot.slot;
        const isSec = secondaryWeapons.includes(card.weaponName);
        const ok = isSec ? need === 'secondary' : cat === 'melee' ? need === 'melee' : need === 'primary';
        if (!ok) {
          this._denyEquipSlot(need);
          return;
        }
        setEquippedWeapon(this.selectedClass, need, card.weaponName);
        this.redraw();
        return;
      }

      if (inEquipZone) {
        const cat = this.getWeaponData(card.weaponName)?.category;
        const fallback = (secondaryWeapons.includes(card.weaponName)) ? 'secondary' : cat === 'melee' ? 'melee' : 'primary';
        setEquippedWeapon(this.selectedClass, fallback, card.weaponName);
        this.hideTooltip();
        this.redraw();
        return;
      }

      if (compareIdx !== null) {
        this.compareWeapons[compareIdx] = this.getWeaponData(card.weaponName);
        this.showCompareStats();
      }

      card.isEquipped = this.isWeaponEquipped(card.weaponName);
      if (card._bg) {
        this._drawCardBg(card._bg, card.cardW ?? 118, card.cardH ?? 56, card.isEquipped, false);
      }
      if (card._label) {
        card._label.setColor(card.isEquipped ? '#aa8800' : '#dddddd');
      }
    });
  }

  // Отказ слоту: красная вспышка + подсказка какой тип сюда можно.
export function _denyEquipSlot(need) {
    const names = { primary: 'ОСНОВНОЕ', secondary: 'ВТОРОЕ', melee: 'БЛИЖНЕЕ' };
    const idx = EQUIP_SLOTS.findIndex(s => s.slot === need);
    const rec = (this.equipSlotRects || [])[idx];
    if (rec) {
      this.redrawSlot(rec, 0xff4444);
      this.time.delayedCall(600, () => this.clearDropHighlights());
    }
    const s = EQUIP_SLOTS[idx];
    if (s) {
      const t = this.add.text(s.x, s.y - 36, `Сюда — только: ${names[need] || need}`, {
        fontSize: '12px', color: '#ff8888', backgroundColor: '#111133', padding: 4
      }).setOrigin(0.5).setDepth(60);
      this.time.delayedCall(1300, () => { try { t.destroy(); } catch (e) {} });
    }
  }

export function updateDropHighlights(x, y) {
    const compareIdx = this.nearestCompareSlot(x, y, 110);
    const equipIdx = this.nearestEquipSlotIndex(x, y, 90);

    this.compareSlotRects.forEach((item, i) => {
      this.redrawSlot(item, i === compareIdx ? 0x88cc55 : 0x4466aa);
    });

    this.equipSlotRects.forEach((item, i) => {
      this.redrawSlot(item, i === equipIdx ? 0x88cc55 : 0x445577);
    });
  }

export function clearDropHighlights() {
    if (this.compareSlotRects) {
      this.compareSlotRects.forEach(item => this.redrawSlot(item, 0x4466aa));
    }
    if (this.equipSlotRects) {
      this.equipSlotRects.forEach(item => this.redrawSlot(item, 0x445577));
    }
  }

export function redrawSlot(item, color) {
    const rect = item.rect;
    item.g.clear();
    item.g.fillStyle(0x0d0d2a, 1);
    item.g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
    item.g.lineStyle(item.highlighted ? 3 : 2, color);
    item.g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
    item.highlighted = color === 0x88cc55;
  }

export function nearestEquipSlotIndex(x, y, maxDist) {
    let best = null;
    let bestDist = Infinity;
    EQUIP_SLOTS.forEach((slot, i) => {
      const d = Math.hypot(x - slot.x, y - slot.y);
      if (d < bestDist && d <= maxDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  }

export function showCompareStats() {
    if (this.compareStatsCards) {
      this.compareStatsCards.forEach(c => c.destroy());
      this.compareStatsCards = null;
    }

    const [a, b] = this.compareWeapons;
    if (!a && !b) return;

    this.compareStatsCards = [];
    const push = (o) => this.compareStatsCards.push(o);

    const yTitle = 590;
    const xStart = UX(this, 60);
    const xMax = UX(this, 770);
    const cols = ['Название', 'Урон', 'Темп/мин', 'Магазин', 'Дальность', 'Точность'];

    const valRows = [a, b].map(weapon => {
      if (!weapon) return null;
      const rate = Math.round(60000 / weapon.fireRate);
      const spread = weapon.spreadDeg != null ? weapon.spreadDeg : 2.0;
      const accuracy = Math.max(1, Math.round(100 - spread * 22));
      // Ближнее: только урон и удары, остальное прочерки.
      return weapon.category === 'melee'
        ? [getWeaponLabel(weapon.name), String(weapon.damage), String(rate), '—', '—', '—']
        : [getWeaponLabel(weapon.name), String(weapon.damage), String(rate),
           String(weapon.magazineSize), String(weapon.range), `${accuracy}%`];
    });

    // Замер реальных ширин заголовков и значений: колонки больше
    // не налезают друг на друга при любых названиях пушек.
    const meas = (s, px) => {
      const t = this.add.text(-300, -300, String(s), { fontSize: px + 'px' });
      const w = t.displayWidth;
      t.destroy();
      return w;
    };
    const colW = cols.map((label, ci) => {
      let w = meas(label, 12);
      valRows.forEach(r => { if (r) w = Math.max(w, meas(r[ci], 13)); });
      return Math.ceil(w) + 20;
    });
    // Не вылезаем за край панели: при переполнении жмём колонку названий.
    const totalW = () => colW.reduce((x, y) => x + y, 0);
    if (xStart + totalW() > xMax) {
      colW[0] = Math.max(80, colW[0] - (xStart + totalW() - xMax));
    }
    const colX = [];
    let cxx = xStart;
    colW.forEach(w => { colX.push(cxx); cxx += w; });

    cols.forEach((label, ci) => {
      push(this.add.text(colX[ci], yTitle + 10, label, {
        fontSize: '12px', color: '#99aacc'
      }).setOrigin(0, 0).setDepth(5));
    });

    valRows.forEach((values, ri) => {
      if (!values) return;
      values.forEach((val, vi) => {
        let s = String(val);
        // Название длиннее колонки — обрезаем с многоточием, а не лезем в соседнюю.
        if (vi === 0 && meas(s, 13) > colW[0] - 20) {
          while (s.length > 4 && meas(s + '…', 13) > colW[0] - 20) s = s.slice(0, -1);
          s += '…';
        }
        push(this.add.text(colX[vi], yTitle + 30 + ri * 22, s, {
          fontSize: '13px',
          color: ri === 0 ? '#ffffaa' : '#aaffaa'
        }).setOrigin(0, 0).setDepth(5));
      });
    });
  }
