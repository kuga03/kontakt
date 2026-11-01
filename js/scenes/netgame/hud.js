import { gameState, expRequired } from '../../data/gameState.js?v=171';
import { NET_BUILD } from '../../net/arena.js?v=169';
import { getCrosshair, drawCrosshairFigure } from '../../data/crosshair.js?v=169';
import { weaponIcon, weaponImage, weaponHudScale, getWeaponLabel, weaponHasMag, classBadgeKey } from '../../data/weapons.js?v=170';
import { getClassAbility, ultUnlocked } from '../../data/abilities.js?v=169';
import { getRank } from '../../data/ranks.js?v=169';

import { getShowFps } from '../SettingsScene.js?v=176';

import Assault from '../../entities/Assault.js?v=380';
import Tank from '../../entities/Tank.js?v=380';
import Medic from '../../entities/Medic.js?v=380';
import Sniper from '../../entities/Sniper.js?v=380';

import { gameW, OX, BASE_CX } from '../../ui/layout.js?v=3';

const CLASSES = { Assault, Tank, Medic, Sniper };

// Значки вместо букв в шапках статов (дубль хелпера из ui/hud.js —
// сцена hud не импортирует). Нет арта — буква как раньше.
const STAT_ICONS = { 'Ф': 'icon_stat_frags', 'С': 'icon_stat_deaths', 'ФЛ': 'icon_stat_flag', 'УРОН': 'icon_stat_damage', 'ПИНГ': 'icon_stat_ping', 'КПД': 'icon_stat_kpd' };

// Метка версии САМОЙ сцены боя (вторая цифра в маркере): доказывает,
// что загрузился именно этот файл, а не закэшированный. Бампить вместе с ?v=...
const NETG_BUILD = 94;

// Сетевой бой (фаза 3а): движение и присутствие.
// Свой боец — полная физика и стрельба (урон марионеткам — в фазе 3б).
// Чужие — марионетки на снапшотах 15Гц + интерполяция.
// Вход — по started из NetLobbyScene: { net, room, mode, players, myId }.
export function _buildCombatHud() {
    try {
      this._hudFixed = this._hudFixed || [];
      // anchor: undefined/'C' — с блоком, 'R' — к правому краю, 'L' — к левому.
      this.addHudElement = (obj, sx, sy, anchor) => {
        this._hudFixed.push({ obj, sx, sy, anchor });
        return obj;
      };
      this._hudBarW = 438;
      const barX0 = 462, barX1 = 900, barW = barX1 - barX0, barCx = (barX0 + barX1) / 2;
      this.hpBarBg = this.addHudElement(
        this.add.rectangle(barCx, 659, barW, 24, 0x222244, 0.95).setScrollFactor(0).setDepth(95), barCx, 659);
      this.hpBarFill = this.addHudElement(
        this.add.rectangle(barX0 + 3, 659, barW - 6, 20, 0x55ff55, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96), barX0 + 3, 659);
      this.hpBarText = this.addHudElement(
        this.add.text(barCx, 659, '', { fontSize: '16px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#00000088', padding: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(97), barCx, 659);
      this.armorBarBg = this.addHudElement(
        this.add.rectangle(barCx, 677, barW, 16, 0x222244, 0.95).setScrollFactor(0).setDepth(95), barCx, 677);
      this.armorBarFill = this.addHudElement(
        this.add.rectangle(barX0 + 3, 677, barW - 6, 12, 0x55aaff, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96), barX0 + 3, 677);
      this.armorBarText = this.addHudElement(
        this.add.text(barCx, 677, '', { fontSize: '13px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#00000088', padding: 1 }).setOrigin(0.5).setScrollFactor(0).setDepth(97), barCx, 677);

      const abilityX = 1070, abilityY = 690;
      this.hudAbilityPt = { x: abilityX, y: abilityY };
      this.abilityCircleBg = this.add.graphics().setScrollFactor(0).setDepth(96);
      this.abilityCircleText = this.addHudElement(
        this.add.text(abilityX, abilityY, '—', { fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(98), abilityX, abilityY);
      this.ultHud = this.addHudElement(
        this.add.text(abilityX, abilityY - 68, '', { fontSize: '14px', fontStyle: 'bold', color: '#cccccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(98), abilityX, abilityY - 68);
      this.abilityLabel = this.addHudElement(
        this.add.text(abilityX + 32, abilityY, '', { fontSize: '13px', color: '#ffeeaa', lineSpacing: 3 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(97), abilityX + 32, abilityY);

      // Табло TAB: контейнер строк (цвет ника = цвет команды).
      this.scoreboard = this.addHudElement(
        this.add.container(640, 360).setScrollFactor(0).setDepth(101), 640, 360);
      this.scoreboard.setVisible(false);

      this.reloadIcon = this.add.graphics().setScrollFactor(0).setDepth(98);
      this.crosshair = this.add.graphics().setScrollFactor(0).setDepth(120);
      this.crosshairR = 8;

      this.fpsTxt = null;
      try {
        if (typeof getShowFps === 'function' && getShowFps()) {
          this.fpsTxt = this.addHudElement(
            this.add.text(20, 14, '', { fontSize: '16px', fontStyle: 'bold', color: '#9fff9f', backgroundColor: '#00000088', padding: 4 }).setOrigin(0, 0).setScrollFactor(0).setDepth(130), 20, 14);
        }
      } catch (e) { this.fpsTxt = null; }

      this.expBarBg = this.addHudElement(
        this.add.rectangle(0, 712, 620, 18, 0x222244, 0.95).setOrigin(0, 0.5).setScrollFactor(0).setDepth(95), 350, 712);
      this.expBarFill = this.addHudElement(
        this.add.rectangle(0, 712, 0, 14, 0xffee55, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96), 352, 712);
      this.expRankText = this.addHudElement(
        this.add.text(640, 712, '', { fontSize: '13px', fontStyle: 'bold', color: '#ffeeaa', backgroundColor: '#00000040', padding: { left: 8, right: 8, top: 1, bottom: 1 } }).setOrigin(0.5).setScrollFactor(0).setDepth(99), 640, 712);
      this.expRelText = this.addHudElement(
        this.add.text(985, 712, '', { fontSize: '11px', color: '#8899aa' }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(97), 985, 712);

      // Слоты оружия как в одиночке: иконка PNG + подпись + патроны,
      // у выбранного — светящийся контур.
      this.weaponSlots = [];
      this.weaponSlotHits = [];
      this.weaponSlotTexts = [];
      const iconFallback = this.textures.exists('icon_rifle') ? 'icon_rifle'
        : (this.textures.exists('wslot') ? 'wslot' : null);
      for (let i = 0; i < 3; i++) {
        const sx = [78, 226, 374][i];
        const sy = 650;
        const boxW = i === 0 ? 148 : 140;
        const boxH = 96;
        const iconW = i === 0 ? 112 : 75;
        const iconH = i === 0 ? 52 : 39;
        const lo = 44;
        const ao = i === 0 ? 56 : 50;
        const sel = this.addHudElement(this.add.graphics().setScrollFactor(0).setDepth(95), sx, sy);
        const hit = this.addHudElement(
          this.add.rectangle(sx, sy, boxW + 8, boxH + 76, 0xffffff, 0.001).setScrollFactor(0).setDepth(94), sx, sy);
        const icon = iconFallback
          ? this.addHudElement(this.add.image(sx, sy, iconFallback).setScrollFactor(0).setDepth(96), sx, sy)
          : null;
        if (icon) icon.setScale(0.6);
        const label = this.addHudElement(
          this.add.text(sx, sy - lo, '', { fontSize: '12px', fontStyle: 'bold', color: '#cccccc', backgroundColor: '#0d0d22cc', padding: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(96), sx, sy - lo);
        const ammoText = this.addHudElement(
          this.add.text(sx, sy + ao - 10, '', { fontSize: '13px', fontStyle: 'bold', color: '#dddddd', backgroundColor: '#0d0d22cc', padding: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(96), sx, sy + ao - 10);
        // Пипсы магазинов запаса как в одиночке: число — патроны в магазине,
        // запас — двумя пипсами (полный/початый/пустой). У трубки скрыты.
        const mags = this.addHudElement(
          this.add.graphics().setScrollFactor(0).setDepth(96), sx, sy + ao - 10);
        this.weaponSlots.push({ sel, selActive: null, sx, sy, boxW, boxH, iconW, iconH });
        this.weaponSlotHits.push(hit);
        this.weaponSlotTexts.push({ icon, label, ammoText, mags });
      }

      // Ячейки гранат как в одиночке: wslot + иконка + клавиша + счёт, клик кидает.
      this.grenSlots = [];
      [
        { type: 'frag', key: 'G', gx: 936 },
        { type: 'smoke', key: 'H', gx: 1004 }
      ].forEach(gd => {
        const gy = 660;
        const bg = this.addHudElement(
          this.add.image(gd.gx, gy, 'wslot').setScrollFactor(0).setDepth(95), gd.gx, gy);
        try { bg.setScale(Math.min(64 / bg.width, 56 / bg.height)); } catch (e) {}
        const texKey = (gd.type === 'frag' ? 'frag_granade' : 'smoke_granade');
        const iconKey = this.textures.exists(texKey) ? texKey
          : (this.textures.exists('grenade') ? 'grenade' : null);
        let gicon = null;
        if (iconKey) {
          gicon = this.addHudElement(
            this.add.image(gd.gx, gy, iconKey).setScrollFactor(0).setDepth(96), gd.gx, gy);
          try { gicon.setScale(Math.min(40 / gicon.width, 36 / gicon.height)); } catch (e) {}
        }
        const keyTxt = this.addHudElement(
          this.add.text(gd.gx - 24, gy - 20, gd.key, { fontSize: '11px', fontStyle: 'bold', color: '#aaffaa', backgroundColor: '#0d0d22cc', padding: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(97), gd.gx - 24, gy - 20);
        const cntTxt = this.addHudElement(
          this.add.text(gd.gx + 20, gy + 16, '0', { fontSize: '12px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0d0d22cc', padding: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(97), gd.gx + 20, gy + 16);
        const hit = this.addHudElement(
          this.add.rectangle(gd.gx, gy, 68, 60, 0xffffff, 0.001).setScrollFactor(0).setDepth(94), gd.gx, gy);
        try {
          hit.setInteractive({ useHandCursor: true });
          hit.on('pointerdown', () => {
            if (this._dead || !this.player || this.player.dead) return;
            const wp = this._aimWorld();
            this.player.throwGrenade(gd.type, wp.x, wp.y);
          });
        } catch (e) {}
        this.grenSlots.push({ type: gd.type, bg, icon: gicon, count: cntTxt, gx: gd.gx, gy });
      });

      this.hpDisp = this.player ? this.player.hp : 100;
      this.armorDisp = this.player ? this.player.armor : 50;
      this.expDisp = gameState.experience;
      this.abilityDisp = 0;
    } catch (e) {}
  }

  // Весь боевой HUD фиксирован на экране независимо от зума камеры
  // (как в одиночке): scrollFactor(0) фиксирует прокрутку, но НЕ зум.
export function updateHudTransform() {
    try {
      const z = (this.cameras.main.zoom || 1);
      // Адаптив: центр — реальная середина (на 16:9 = 640, как было).
      const cx = gameW(this) / 2, cy = 360;
      const ox = OX(this);
      (this._hudFixed || []).forEach(item => {
        const o = item.obj;
        if (!o || !o.active) return;
        const ax = item.anchor === 'R' ? ox : (item.anchor === 'L' ? -ox : 0);
        try { o.setPosition(cx + (item.sx - BASE_CX) / z + ax, cy + (item.sy - cy) / z); } catch (e) {}
        try {
          if (o.scaleX !== undefined && o.scaleY !== undefined && !o._hudIcon) {
            if (item.baseSx === undefined) { item.baseSx = o.scaleX; item.baseSy = o.scaleY; }
            o.setScale(item.baseSx / z, item.baseSy / z);
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

export function drawAbilityCircle(ready01) {
    try {
      const r = 22;
      const g = this.abilityCircleBg;
      if (!g) return;
      g.clear();
      g.fillStyle(this.player.hasAbility ? 0x333355 : 0x222233, 1);
      g.fillCircle(0, 0, r);
      if (this.player.hasAbility) {
        const pct = Phaser.Math.Clamp(ready01, 0, 1);
        g.fillStyle(0x2266cc, 1);
        g.slice(0, 0, r, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * pct), false);
      }
      g.lineStyle(2, 0x7799cc);
      g.strokeCircle(0, 0, r);
      const z = this.cameras.main.zoom || 1;
      g.setPosition(gameW(this) / 2 + (this.hudAbilityPt.x - BASE_CX) / z, 360 + (this.hudAbilityPt.y - 360) / z);
      g.setScale(1 / z);
    } catch (e) {}
  }

export function drawReloadIcon() {
    try {
      const g = this.reloadIcon;
      if (!g) return;
      g.clear();
      if (!this.player || !this.player.weapon || !this.player.weapon.reloading || this.player.dead) return;
      // Круг по центру слота, где лежит активный ствол.
      let cx = 78, cy = 650;
      try {
        const invList = this.player.inventory || [];
        const activeW = invList[this.player.activeWeaponIndex] || null;
        const idx = (this._slotOrder || []).indexOf(activeW);
        if (idx >= 0 && this.weaponSlots[idx]) { cx = this.weaponSlots[idx].sx; cy = this.weaponSlots[idx].sy; }
      } catch (e) {}
      const r = 30;
      const a = (this.time.now / 500) % (Math.PI * 2);
      g.lineStyle(3, 0xffcc66, 1);
      g.beginPath();
      g.arc(0, 0, r, a, a + Math.PI * 1.7, false);
      g.strokePath();
      const tipAngle = a + Math.PI * 1.7;
      const tipX = Math.cos(tipAngle) * r;
      const tipY = Math.sin(tipAngle) * r;
      g.fillStyle(0xffcc66, 1);
      g.fillTriangle(tipX, tipY,
        tipX + Math.cos(tipAngle - Math.PI / 2) * 7, tipY + Math.sin(tipAngle - Math.PI / 2) * 7,
        tipX + Math.cos(tipAngle + Math.PI / 2) * 7, tipY + Math.sin(tipAngle + Math.PI / 2) * 7);
      const z = this.cameras.main.zoom || 1;
      g.setPosition(gameW(this) / 2 + (cx - BASE_CX) / z, 360 + (cy - 360) / z);
      g.setScale(1 / z);
    } catch (e) {}
  }

export function _updateCombatHud(time) {
    try {
      const p = this.player;
      if (!p) return;
      const lerp12 = 0.2;
      const hpTarget = Phaser.Math.Clamp(p.hp, 0, p.maxHp || 100);
      this.hpDisp += (hpTarget - this.hpDisp) * lerp12;
      const hp01 = Phaser.Math.Clamp(this.hpDisp / Math.max(1, p.maxHp || 100), 0, 1);
      if (this.hpBarFill) {
        this.hpBarFill.width = ((this._hudBarW || 438) - 6) * hp01;
        this.hpBarFill.setFillStyle(hp01 > 0.3 ? 0x55ff55 : 0xff4444, 1);
      }
      if (this.hpBarText) this.hpBarText.setText(`${Math.round(this.hpDisp)}`);
      const armorMax = Math.max(1, p.maxArmor || 50);
      const armorTarget = Phaser.Math.Clamp(p.armor, 0, p.maxArmor || 50);
      this.armorDisp += (armorTarget - this.armorDisp) * lerp12;
      const armor01 = Phaser.Math.Clamp(this.armorDisp / armorMax, 0, 1);
      if (this.armorBarFill) this.armorBarFill.width = ((this._hudBarW || 438) - 6) * armor01;
      if (this.armorBarText) this.armorBarText.setText(`${Math.round(this.armorDisp)}`);

      const abilityElapsed = (time || 0) - (p.lastAbilityAt || 0);
      const abilityTarget = Phaser.Math.Clamp(abilityElapsed / (p.abilityCooldown || 15000), 0, 1);
      this.abilityDisp += (abilityTarget - this.abilityDisp) * 0.3;
      this.drawAbilityCircle(this.abilityDisp);
      if (this.abilityLabel) this.abilityLabel.setText(p.abilityName || '—');
      if (this.abilityCircleText) {
        if (p.hasAbility) {
          const leftMs = (p.lastAbilityAt || 0) + (p.abilityCooldown || 15000) - (time || 0);
          if (leftMs > 0) {
            this.abilityCircleText.setText((leftMs / 1000).toFixed(1));
            this.abilityCircleText.setColor('#ffffff');
          } else {
            this.abilityCircleText.setText('E');
            this.abilityCircleText.setColor('#aaffaa');
          }
        } else {
          this.abilityCircleText.setText('—');
          this.abilityCircleText.setColor('#667788');
        }
      }

      try {
        (this.grenSlots || []).forEach(gs => {
          const n = gs.type === 'frag' ? p.fragGrenades : p.smokeGrenades;
          if (gs.count) {
            gs.count.setText(String(n | 0));
            gs.count.setColor((n | 0) > 0 ? '#ffffff' : '#776666');
          }
          if (gs.icon) {
            gs.icon.setTint((n | 0) > 0 ? 0xffffff : 0x555555);
            gs.icon.setAlpha((n | 0) > 0 ? 1 : 0.6);
          }
        });
      } catch (e) {}

      try {
        const ultAb = getClassAbility(p.constructor.name);
        if (ultAb) {
          if (!ultUnlocked(ultAb.id)) {
            this.ultHud.setText(`X:${ultAb.name} — ур.${ultAb.unlockLevel}`);
            this.ultHud.setColor('#888888');
          } else if (p.ultActive) {
            const left = Math.max(0, (p.ultEndsAt || 0) - (time || 0));
            this.ultHud.setText(`X:${ultAb.name} ${Math.ceil(left / 1000)}с`);
            this.ultHud.setColor('#ffddaa');
          } else if ((p.ultCharge | 0) < (p.ultMaxCharge | 0)) {
            this.ultHud.setText(`X:${ultAb.name} — килы ${p.ultCharge | 0}/${p.ultMaxCharge | 0}`);
            this.ultHud.setColor('#cccccc');
          } else {
            this.ultHud.setText(`X:${ultAb.name} — ГОТОВО`);
            this.ultHud.setColor('#aaffaa');
          }
        } else if (this.ultHud) {
          this.ultHud.setText('');
        }
      } catch (e) {}

      try {
        const expNeed = expRequired(gameState.level);
        const expTarget = Phaser.Math.Clamp(gameState.experience, 0, expNeed);
        this.expDisp += (expTarget - this.expDisp) * lerp12;
        if (this.expBarFill) this.expBarFill.width = 616 * Math.min(1, this.expDisp / expNeed);
        if (this.expRankText) this.expRankText.setText(`${getRank(gameState.level)}  ·  ур. ${gameState.level}`);
        if (this.expRelText) this.expRelText.setText(`${gameState.experience}/${expNeed} оп.`);
      } catch (e) {}

      // Слоты статичны по категориям (основное/второе/холодное) — как в одиночке.
      const invList = p.inventory || [];
      const activeW = invList[p.activeWeaponIndex] || null;
      const byCat = (pred) => invList.find(w => w && pred(w)) || null;
      const ordered = [
        byCat(w => w.category === 'primary' && !w.isMelee),
        byCat(w => w.category === 'secondary'),
        byCat(w => w.isMelee || w.category === 'melee')
      ];
      this._slotOrder = ordered;
      ordered.forEach((w, i) => {
        if (!this.weaponSlots[i]) return;
        const slot = this.weaponSlots[i];
        const txt = this.weaponSlotTexts[i];
        if (!w) {
          if (slot.sel) slot.sel.setVisible(false);
          slot.selActive = null;
          if (this.weaponSlotHits[i]) this.weaponSlotHits[i].setVisible(false);
          if (txt.icon) txt.icon.setVisible(false);
          if (txt.label) txt.label.setVisible(false);
          if (txt.ammoText) txt.ammoText.setVisible(false);
          if (txt.mags) txt.mags.setVisible(false);
          return;
        }
        const active = activeW === w;
        const sel = slot.sel;
        if (this.weaponSlotHits[i]) this.weaponSlotHits[i].setVisible(true);
        if (slot.selActive !== active) {
          slot.selActive = active;
          try {
            sel.clear();
            if (active) {
              const ow = slot.iconW + 22, oh = slot.iconH + 26;
              sel.lineStyle(3, 0xffee55, 1);
              sel.strokeRoundedRect(slot.sx - ow / 2, slot.sy - oh / 2, ow, oh, 10);
            }
          } catch (e) {}
        }
        sel.setVisible(true);
        const _hz = this.cameras.main.zoom || 1;
        const icon = txt.icon;
        if (icon) {
          icon.setVisible(true);
          const imgKey = (this.textures.exists(weaponImage(w.name)) && weaponImage(w.name)) || weaponIcon(w.name);
          try {
            if (this.textures.exists(imgKey)) icon.setTexture(imgKey);
          } catch (e) {}
          const meleeK = w.isMelee ? 1.3 : 1;
          const _hdx = w.isMelee ? -12 : 0;
          try {
            icon.setScale(Math.min(slot.iconW / icon.width, slot.iconH / icon.height) * weaponHudScale(w.name) / _hz * meleeK);
            icon._hudIcon = true;
            icon.setPosition(gameW(this) / 2 + (slot.sx + _hdx - BASE_CX) / _hz, 360 + (slot.sy - 360) / _hz);
          } catch (e) {}
          try { icon.setTint(0xffffff); } catch (e) {}
        }
        txt.label.setVisible(true);
        txt.label.setText(getWeaponLabel(w.name));
        txt.label.setColor(active ? '#ffff55' : '#cccccc');
        const ammoTxt = txt.ammoText;
        const mags = txt.mags;
        // Как в одиночке: магазинное — число в магазине + запас пипсами,
        // трубка (помпы/RPG) — дробью. Нож — без патронов.
        const hasMag = !w.isMelee && weaponHasMag(w.name);
        if (w.isMelee) {
          ammoTxt.setVisible(false);
          if (mags) mags.setVisible(false);
        } else if (hasMag) {
          ammoTxt.setVisible(true);
          ammoTxt.setText(`${w.magazine}`);
          if (w.magazine <= 0) {
            ammoTxt.setColor('#ff4444');
          } else if (w.reloading) {
            ammoTxt.setColor('#ff8844');
          } else {
            ammoTxt.setColor(active ? '#ffffff' : '#dddddd');
          }
          if (mags) {
            mags.setVisible(true);
            try {
              const size = Math.max(1, w.magazineSize | 0);
              const res = Math.max(0, w.reserveAmmo | 0);
              mags.clear();
              for (let k = 0; k < 2; k++) {
                const px = 20 + k * 15, py = -3.5;
                mags.lineStyle(1, 0x444466, 1);
                mags.strokeRect(px, py, 12, 7);
                if (res >= (k + 1) * size) {
                  mags.fillStyle(0xffcc44, 1);
                  mags.fillRect(px + 1, py + 1, 10, 5);
                } else if (res > k * size) {
                  // Початый магазин — тускло.
                  mags.fillStyle(0x775522, 1);
                  mags.fillRect(px + 1, py + 1, 10, 5);
                }
              }
            } catch (e) {}
          }
        } else {
          ammoTxt.setVisible(true);
          ammoTxt.setText(`${w.magazine}/${w.reserveAmmo}`);
          if (w.magazine <= 0) {
            ammoTxt.setColor('#ff4444');
          } else if (w.reloading) {
            ammoTxt.setColor('#ff8844');
          } else {
            ammoTxt.setColor(active ? '#ffffff' : '#dddddd');
          }
          if (mags) mags.setVisible(false);
        }
      });
    } catch (e) {}
  }

export function drawCrosshair() {
    try {
      const g = this.crosshair;
      if (!g) return;
      const z = this.cameras.main.zoom || 1;
      const pointer = this.input.activePointer;
      g.clear();
      if (!this.player || this.player.dead || this._dead) return;
      g.setPosition(gameW(this) / 2 + (pointer.x - gameW(this) / 2) / z, 360 + (pointer.y - 360) / z);
      g.setScale(1 / z);
      const weapon = this.player.weapon;
      const cross = getCrosshair();
      let targetR;
      if (!cross.dynamic) targetR = cross.size;
      else if (!weapon) targetR = cross.size * 1.5;
      else {
        const sm = this.player.spreadMult || 1;
        let spread = (weapon.spreadDeg || 2) * sm;
        try {
          if (Math.abs((this.player.body && this.player.body.velocity.x) || 0) > 10) spread *= 1.5;
          if (this.player.body && !this.player.body.blocked.down && !(this.player.body.touching && this.player.body.touching.down)) spread *= 3;
        } catch (e) {}
        const minS = (weapon.spreadDeg || 2) * sm, maxS = (weapon.spreadDeg || 2) * 4.5 * sm;
        const t = maxS > minS ? Phaser.Math.Clamp((spread - minS) / (maxS - minS), 0, 1) : 0;
        targetR = cross.size * 0.625 + t * cross.size * 1.875;
      }
      if (this.crosshairR == null) this.crosshairR = 8;
      this.crosshairR += (targetR - this.crosshairR) * 0.12;
      drawCrosshairFigure(g, cross, this.crosshairR);
    } catch (e) {}
  }

export function _layoutScoreRow() {
    try {
      if (!this._scoreRowOn || !this.scoreBlue) return;
      const gap = 14;
      const z = this.cameras.main.zoom || 1;
      const _cx = gameW(this) / 2;
      const dw = o => (o && o.displayWidth ? o.displayWidth * z : 0);
      const bw = dw(this.scoreBlue);
      const mw = dw(this.scoreMid);
      const rw = dw(this.scoreRed);
      const bbw = this.scoreBadgeB ? dw(this.scoreBadgeB) : 0;
      const rbw = this.scoreBadgeR ? dw(this.scoreBadgeR) : 0;
      const bbg = this.scoreBadgeB ? gap : 0;
      const rbg = this.scoreBadgeR ? gap : 0;
      const total = bbw + bbg + bw + gap + mw + gap + rw + rbg + rbw;
      const x0 = _cx - total / 2;
      const place = (item, sx) => {
        if (!item) return;
        item.sx = sx;
        if (item.obj && item.obj.active) {
          try { item.obj.setPosition(_cx + (sx - _cx) / z, 360 + (10 - 360) / z); } catch (e) {}
        }
      };
      let x = x0;
      if (this._scoreBadgeBItem) { place(this._scoreBadgeBItem, x + bbw / 2); x += bbw + bbg; }
      place(this._scoreBlueItem, x); x += bw + gap;
      place(this._scoreMidItem, x + mw / 2); x += mw + gap;
      place(this._scoreRedItem, x); x += rw + rbg;
      if (this._scoreBadgeRItem) place(this._scoreBadgeRItem, x + rbw / 2);
    } catch (e) {}
  }

  // Строки таблицы: реестр матча + счёт сервера.
  // Возвращает { rows, left, right } — строки { id, name, color, cls, stats }.
  // Раскладка — как в одиночке (_renderTeamsBoard): слева моя команда,
  // справа противник; сортировка — по урону; колонки Ф/С[/ФЛ]/УРОН.
export function _netRows() {
    try {
      const isCTF = this.mode === 'CTF';
      const kills = {};
      const dealt = {};
      const deaths = {};
      const flags = {};
      (this._board || []).forEach(r => {
        try {
          kills[r.id] = r.kills | 0; dealt[r.id] = r.dm | 0;
          deaths[r.id] = r.d | 0; flags[r.id] = r.fl | 0;
        } catch (e) {}
      });
      const seen = new Set();
      const rows = [];
      const colorOf = (id, team) => {
        if (id === this.myId) return '#ffe066';
        if (this._ffa) return '#ff8888';
        if (team === 'blue') return '#7db8ff';
        if (team === 'red') return '#ff8888';
        return '#ffffff';
      };
      const pushRow = (id, fb) => {
        if (id == null || seen.has(id)) return;
        seen.add(id);
        const reg = this._matchInfo(id) || {};
        const team = reg.team === 'red' ? 'red' : 'blue';
        // КПД — та же механика вклада (фраги/урон/флаги; остального
        // сервер не раздаёт — там нули, как в сортировке одиночки).
        const kpd = ((kills[id] | 0) * 30) + Math.floor((dealt[id] | 0) / 25) + ((flags[id] | 0) * 100);
        const stat = isCTF
          ? [(kills[id] | 0), (deaths[id] | 0), (flags[id] | 0), (dealt[id] | 0), kpd]
          : [(kills[id] | 0), (deaths[id] | 0), (dealt[id] | 0), kpd];
        rows.push({
          id,
          name: String(reg.name || (fb && fb.name) || 'Игрок').slice(0, 16),
          color: colorOf(id, team),
          cls: reg.cls || (fb && fb.cls) || null,
          bot: !!((reg && reg.bot) || (fb && fb.bot)),
          team,
          stats: stat,
          dmg: (dealt[id] | 0)
        });
      };
      try { this._matchTeams.forEach((v, id) => pushRow(id, v)); } catch (e) {}
      try { (this.net.players || []).forEach(pl => pushRow(pl.id, pl)); } catch (e) {}
      try { (this._board || []).forEach(b => pushRow(b.id, b)); } catch (e) {}
      pushRow(this.myId, { name: (this.net.myName || gameState.playerName || 'Игрок') });
      const byDmg = (a, b) => (b.dmg || 0) - (a.dmg || 0);
      let left, right;
      if (this._ffa) {
        // Как в одиночке: слева я (ВЫ), справа остальные (ПРОТИВНИК).
        left = rows.filter(r => r.id === this.myId);
        right = rows.filter(r => r.id !== this.myId).sort(byDmg);
      } else {
        left = rows.filter(r => r.team === this.myTeam).sort(byDmg);
        right = rows.filter(r => r.team !== this.myTeam).sort(byDmg);
      }
      return { rows, left, right };
    } catch (e) {}
    return null;
  }

  // TAB-табло один в один как в одиночке (_renderTeamsBoard): слева моя
  // команда, справа противник; у каждого киллы/смерти[/флаги]/урон
  // отдельными колонками; сверху щит команды и её счёт; сортировка — по урону.
export function _renderNetBoard() {
    try {
      if (!this.scoreboard) return;
      const isCTF = this.mode === 'CTF';
      // Свой пинг известен, чужой — «—» (сервер пинги не раздаёт).
      const myPing = (this.net && this.net.lastPingMs != null) ? `${this.net.lastPingMs}мс` : '—';
      const data = this._netRows();
      if (!data) return;
      const { left, right } = data;
      // Колонки как в одиночке + ПИНГ последней (фича онлайна, в одиночке её нет).
      const statCols = isCTF ? ['Ф', 'С', 'ФЛ', 'УРОН', 'КПД', 'ПИНГ'] : ['Ф', 'С', 'УРОН', 'КПД', 'ПИНГ'];
      const teamScore = (team) => team === 'blue' ? (this._teamScore.blue | 0) : (this._teamScore.red | 0);
      const teamTitle = (team) => {
        if (this._ffa) return team === this.myTeam ? 'ВЫ' : 'ПРОТИВНИК';
        return team === 'blue' ? `СИНИЕ (${teamScore('blue')})` : `КРАСНЫЕ (${teamScore('red')})`;
      };
      const teamBadge = (team) => {
        if (this._ffa) return null;
        const key = team === 'blue' ? 'badge_blue' : 'badge_red';
        return this.textures.exists(key) ? key : null;
      };
      // Цвет заголовка — строго по команде (СИНИЕ голубые, КРАСНЫЕ красные),
      // а не «своя всегда голубая» (играя за красных обе шапки были синими).
      const teamColor = (team) => team === 'blue' ? '#6db4ff'
        : team === 'red' ? '#ff6666' : '#ff9d9d';
      const leftTeam = this.myTeam || 'blue';
      const rightTeam = this._ffa ? 'red' : (leftTeam === 'blue' ? 'red' : 'blue');
      const colL = [{ name: null, title: teamTitle(this._ffa ? this.myTeam : leftTeam), color: this._ffa ? '#6db4ff' : teamColor(leftTeam), badge: teamBadge(leftTeam), score: teamScore(leftTeam) },
        ...left.map(r => ({ id: r.id, name: r.name, color: r.color, stats: r.stats, cls: r.cls, bot: r.bot }))];
      const colR = [{ name: null, title: teamTitle(rightTeam), color: teamColor(rightTeam), badge: teamBadge(rightTeam), score: teamScore(rightTeam) },
        ...right.map(r => ({ id: r.id, name: r.name, color: r.color, stats: r.stats, cls: r.cls, bot: r.bot }))];
      const sig = JSON.stringify([colL, colR, statCols]);
      if (sig === this._netBoardSig && this.scoreboard.length) return;
      this._netBoardSig = sig;
      this.scoreboard.removeAll(true);
      const rowH = 24;
      const colW = 300;
      const n = Math.max(colL.length, colR.length);
      // Заголовок со щитом выше (+44): щит 37 + счёт под ним.
      const H = n * rowH + 52 + ((colL[0].badge || colR[0].badge) ? 44 : 0);
      const bg = this.add.rectangle(0, 0, colW * 2 + 40, H, 0x0a0a1e, 0.93);
      this.scoreboard.add(bg);
      const drawCol = (cx, rows) => {
        let y = -H / 2 + 10;
        rows.forEach((r) => {
          if (r.name == null) {
            if (r.badge) {
              // Щит вместо слова «СИНИЕ/КРАСНЫЕ», счёт команды — под ним.
              const im = this.add.image(cx, y + 2, r.badge).setOrigin(0.5, 0);
              im.setDisplaySize(30, 37);
              this.scoreboard.add(im);
              const t = this.add.text(cx, y + 42, `${r.score | 0}`, {
                fontSize: '17px', color: r.color, fontStyle: 'bold'
              }).setOrigin(0.5, 0);
              this.scoreboard.add(t);
            } else {
              const t = this.add.text(cx, y + 2, r.title, {
                fontSize: '17px', color: r.color, fontStyle: 'bold'
              }).setOrigin(0.5, 0);
              this.scoreboard.add(t);
            }
            const RX = cx + colW / 2 - 8;
            const edges = isCTF ? [RX - 200, RX - 160, RX - 130, RX - 80, RX - 40, RX] : [RX - 170, RX - 130, RX - 80, RX - 40, RX];
            // Шапка под щитом и счётом (было y+24 — прямо по щиту, «Ф» налезала на бейдж).
            const headY = y + (r.badge ? 64 : 24);
            statCols.forEach((cn, ci) => {
              const ik = STAT_ICONS[cn];
              if (ik && this.textures.exists(ik)) {
                const dx = ik === 'icon_stat_flag' ? 6 : 0;
                const im = this.add.image(edges[ci] + dx, headY + 3, ik).setOrigin(1, 1);
                im.setDisplaySize(21, 21);
                this.scoreboard.add(im);
              } else {
                const s = this.add.text(edges[ci], headY, cn, {
                  fontSize: '11px', color: '#667788'
                }).setOrigin(1, 0);
                this.scoreboard.add(s);
              }
            });
            y += rowH + 20 + (r.badge ? 44 : 0);
          } else {
            const badge = (typeof classBadgeKey === 'function') ? classBadgeKey(r.cls) : null;
            const shift = (badge && this.textures.exists(badge)) ? 22 : 0;
            if (shift) {
              const im = this.add.image(cx - colW / 2 + 8 + 9, y + 10, badge);
              this.scoreboard.add(im);
            }
            const RX = cx + colW / 2 - 8;
            const edges = isCTF ? [RX - 200, RX - 160, RX - 130, RX - 80, RX - 40, RX] : [RX - 170, RX - 130, RX - 80, RX - 40, RX];
            const nameMaxR = edges[0] - 34;
            let nick = String(r.name || '') + (r.bot ? ' (БОТ)' : '');
            const t = this.add.text(cx - colW / 2 + 8 + shift, y, nick, {
              fontSize: '15px', color: r.color, fontStyle: 'bold'
            }).setOrigin(0, 0);
            let guard = 0;
            const nameX = cx - colW / 2 + 8 + shift;
            while (t.displayWidth > Math.max(30, nameMaxR - nameX) && nick.length > 4 && guard < 24) {
              nick = nick.slice(0, -1);
              t.setText(nick + '…');
              guard++;
            }
            this.scoreboard.add(t);
            (r.stats || []).forEach((v, ci) => {
              const s = this.add.text(edges[ci], y, String(v), {
                fontSize: '14px', color: '#dddddd'
              }).setOrigin(1, 0);
              this.scoreboard.add(s);
            });
            // ПИНГ — только свой известен (сервер чужие не раздаёт).
            try {
              const ps = this.add.text(RX, y, (r.id === this.myId) ? myPing : '—', {
                fontSize: '14px', color: '#8899aa'
              }).setOrigin(1, 0);
              this.scoreboard.add(ps);
            } catch (e) {}
            y += rowH;
          }
        });
      };
      drawCol(-1 * (colW / 2 + 10), colL);
      drawCol(colW / 2 + 10, colR);
    } catch (e) {}
  }

export function _onOver(m) {
    if (!m) return;
    try {
      // Матч окончен: тик ростера может чистить протухших ботов.
      this._matchOver = true;
      const isDraw = m.winner === 'draw';
      let won = false;
      if (!isDraw) {
        if (this._ffa) won = (m.winner === this.myId);
        else won = (m.winner === this.myTeam);
      }
      const score = this._ffa
        ? ((m.board || []).map(r => `${r.name} ${r.kills}`).join('   ') || '')
        : `${m.blue | 0} : ${m.red | 0}`;
      // Стоп игры: камера в исходную (зум 1 — оверлей ровно на весь экран,
      // кнопки в нормальном размере), свой боец стоит, кастомный прицел
      // прячем, системный курсор возвращаем (кнопку должно быть видно).
      try {
        this.cameras.main.stopFollow();
        this.cameras.main.setZoom(1);
      } catch (e) {}
      try { if (this.player) this.player.stop(); } catch (e) {}
      try { if (this.crosshair) this.crosshair.clear(); } catch (e) {}
      try { this.input.setDefaultCursor('default'); } catch (e) {}
      // Адаптив: оверлей на всю ширину, тексты по центру (на 16:9 как было).
      const _ocx = gameW(this) / 2;
      const overlay = this.add.rectangle(_ocx, 360, gameW(this), 720, 0x000000, 0.72).setScrollFactor(0).setDepth(300);
      const title = this.add.text(_ocx, 120, isDraw ? 'НИЧЬЯ' : (won ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'), {
        fontSize: '44px', fontStyle: 'bold', color: isDraw ? '#ffd24a' : (won ? '#88dd88' : '#ff6666')
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      const sub = this.add.text(_ocx, 175, score, {
        fontSize: '20px', color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      const btn = this.add.text(_ocx, 640, 'В КОМНАТУ', {
        fontSize: '20px', color: '#ffffff', backgroundColor: '#252560', padding: 12
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      btn.setInteractive({ useHandCursor: true });
      const toRoom = () => {
        try {
          if (this.scene.isActive('NetGameScene')) this.scene.start('NetLobbyScene', { net: this.net });
        } catch (e) {}
      };
      btn.on('pointerdown', () => toRoom());
      this._overElems = [overlay, title, sub, btn];
      // Лидерборд как в свободной игре: команды колонками, фраги у каждого.
      try {
        const boardObjs = this._buildOverBoard(m);
        if (boardObjs && boardObjs.length) this._overElems = this._overElems.concat(boardObjs);
      } catch (e) {}
      // Авторум в комнату через 15с (по кнопке — сразу, таймер сцены умрёт сам).
      try {
        let left15 = 15;
        try { btn.setText(`В КОМНАТУ (${left15})`); } catch (e) {}
        this.time.addEvent({ delay: 1000, repeat: 15, callback: () => {
          try {
            if (!this.scene.isActive('NetGameScene')) return;
            left15 -= 1;
            if (left15 <= 0) { toRoom(); return; }
            try { if (btn.active) btn.setText(`В КОМНАТУ (${left15})`); } catch (e) {}
          } catch (e) {}
        } });
      } catch (e) {}
    } catch (e) {}
  }

  // Итоговая таблица конца матча: те же колонки, что TAB (Ф/С[/ФЛ]/УРОН).
export function _buildOverBoard(m) {
    const out = [];
    try {
      if (m && Array.isArray(m.board)) {
        this._board = m.board;
      }
      const isCTF = this.mode === 'CTF';
      const data = this._netRows();
      if (!data) return out;
      const { left, right } = data;
      const statCols = isCTF ? ['Ф', 'С', 'ФЛ', 'УРОН', 'КПД', 'ПИНГ'] : ['Ф', 'С', 'УРОН', 'КПД', 'ПИНГ'];
      const teamScore = (team) => this._ffa ? '' : (team === 'blue' ? (this._teamScore.blue | 0) : (this._teamScore.red | 0));
      const teamTitle = (team) => {
        if (this._ffa) return team === this.myTeam ? 'ВЫ' : 'ПРОТИВНИК';
        return team === 'blue' ? `СИНИЕ (${teamScore('blue')})` : `КРАСНЫЕ (${teamScore('red')})`;
      };
      const leftTeam = this.myTeam || 'blue';
      const rightTeam = this._ffa ? 'red' : (leftTeam === 'blue' ? 'red' : 'blue');
      const colOf = (list) => list.map(r => ({ id: r.id, name: r.name, color: r.color, stats: r.stats, cls: r.cls, bot: r.bot }));
      const leftTitle = teamTitle(this._ffa ? this.myTeam : leftTeam);
      const rightTitle = this._ffa ? teamTitle(rightTeam) : teamTitle(rightTeam);
      const rowH = 24, colW = 300;
      const n = Math.max(left.length, right.length, 1);
      const H = Math.min(380, (n + 1) * rowH + 52);
      const W = colW * 2 + 40;
      const cy = 400;
      // Адаптив: вся таблица относительно центра экрана (на 16:9 как было).
      const _bx = gameW(this) / 2;
      const bg = this.add.rectangle(_bx, cy, W, H, 0x0a0a1e, 0.93).setScrollFactor(0).setDepth(301);
      out.push(bg);
      const drawCol = (cx, list, title, color) => {
        let y = cy - H / 2 + 12;
        const t = this.add.text(cx, y, title || '', {
          fontSize: '17px', color: color || '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(302);
        out.push(t);
        const RX = cx + colW / 2 - 8;
        // Шаг колонок 40+: 5-значный урон (13k) иначе налезает на соседнюю.
        const edges = isCTF ? [RX - 200, RX - 160, RX - 130, RX - 80, RX - 40, RX] : [RX - 170, RX - 130, RX - 80, RX - 40, RX];
        statCols.forEach((cn, ci) => {
          const ik = STAT_ICONS[cn];
          if (ik && this.textures.exists(ik)) {
            const dx = ik === 'icon_stat_flag' ? 6 : 0;
            const him = this.add.image(edges[ci] + dx, y + 27, ik).setOrigin(1, 1);
            him.setScrollFactor(0).setDepth(302);
            him.setDisplaySize(21, 21);
            out.push(him);
          } else {
            const h = this.add.text(edges[ci], y + 24, cn, { fontSize: '11px', color: '#667788' }).setOrigin(1, 0);
            h.setScrollFactor(0).setDepth(302);
            out.push(h);
          }
        });
        y += rowH + 20;
        const maxRows = Math.max(0, Math.floor((cy + H / 2 - 12 - y) / rowH));
        list.slice(0, Math.max(1, maxRows)).forEach(r => {
          const badge = (typeof classBadgeKey === 'function') ? classBadgeKey(r.cls) : null;
          const shift = (badge && this.textures.exists(badge)) ? 22 : 0;
          if (shift) {
            const im = this.add.image(cx - colW / 2 + 8 + 9, y + 10, badge).setScrollFactor(0).setDepth(302);
            out.push(im);
          }
          let nick = String(r.name || '') + (r.bot ? ' (БОТ)' : '');
          const nt = this.add.text(cx - colW / 2 + 8 + shift, y, nick, {
            fontSize: '15px', color: r.color, fontStyle: 'bold'
          }).setOrigin(0, 0).setScrollFactor(0).setDepth(302);
          let guard = 0;
          const nameX = cx - colW / 2 + 8 + shift;
          while (nt.displayWidth > Math.max(30, edges[0] - 34 - nameX) && nick.length > 4 && guard < 24) {
            nick = nick.slice(0, -1);
            nt.setText(nick + '…');
            guard++;
          }
          out.push(nt);
          (r.stats || []).forEach((v, ci) => {
            const s = this.add.text(edges[ci], y, String(v), { fontSize: '14px', color: '#dddddd' }).setOrigin(1, 0).setScrollFactor(0).setDepth(302);
            out.push(s);
          });
          try {
            const myPing2 = (this.net && this.net.lastPingMs != null) ? `${this.net.lastPingMs}мс` : '—';
            const ps = this.add.text(RX, y, (r.id === this.myId) ? myPing2 : '—', { fontSize: '14px', color: '#8899aa' }).setOrigin(1, 0).setScrollFactor(0).setDepth(302);
            out.push(ps);
          } catch (e) {}
          y += rowH;
        });
      };
      // Цвет заголовка — строго по команде (СИНИЕ голубые, КРАСНЫЕ красные).
      const colorOf = (team) => team === 'blue' ? '#6db4ff'
        : team === 'red' ? '#ff6666' : '#ff9d9d';
      drawCol(_bx - (colW / 2 + 10), colOf(left), leftTitle, colorOf(this._ffa ? this.myTeam : leftTeam));
      drawCol(_bx + (colW / 2 + 10), colOf(right), rightTitle, colorOf(rightTeam));
    } catch (e) {}
    return out;
  }

  // Визуал объективов (фаза 3в): буквы точек, флаги, бомбы.
  // Состояние приходит по obj, рисуем каждый кадр из него.
export function _updateHudBackground(time, p) {
    // После конца матча зум заморожен на 1 (_onOver): иначе доводка
    // уводит его обратно и оверлей 1280x720 не накрывает края экрана.
    try {
      if (!this._matchOver) {
        const target = this.getDesiredZoom((p.weapon && p.weapon.range) || 700);
        const cur = this.cameras.main.zoom || 1;
        if (Math.abs(cur - target) > 0.001) this.cameras.main.setZoom(Phaser.Math.Linear(cur, target, 0.05));
      } else if ((this.cameras.main.zoom || 1) !== 1) {
        this.cameras.main.setZoom(1);
      }
    } catch (e) {}
    try {
      if (this.keys.tab && this.keys.tab.isDown) {
        this._renderNetBoard();
        if (this.scoreboard) this.scoreboard.setVisible(true);
      } else if (this.scoreboard) {
        this.scoreboard.setVisible(false);
      }
    } catch (e) {}
    // Ряд счёта центрируем каждый кадр (ширины едут от цифр).
    try { this._layoutScoreRow(); } catch (e) {}

    // --- Гранаты и киты живут своим апдейтом ---
    try {
      this.grenades.getChildren().forEach(g => {
        try { if (g.update) g.update(time); } catch (e) {}
      });
      this.pickups.getChildren().forEach(pk => {
        try { if (pk.update) pk.update(time); } catch (e) {}
      });
    } catch (e) {}

    // Счётчик FPS как в одиночке (включается в настройках), 2 раза в секунду.
    try {
      if (this.fpsTxt && time - (this._fpsAt || 0) > 500) {
        this._fpsAt = time;
        const fps = Math.round((this.game.loop && this.game.loop.actualFps) || 0);
        this.fpsTxt.setText(`${fps} FPS`);
      }
    } catch (e) {}

    if (time - (this._hudAt || 0) > 1000) {
      this._hudAt = time;
      try {
        this.net.send({ t: 'ping', n: Date.now() });
      } catch (e) {}
      // Без try дальше всё встанет (табло/объективы/трассеры) — ростер
      // каждую секунду не должен ронять кадр.
      try { this._syncRoster(); } catch (e) {}
      // Диагностика рассинхрона кукол: d = серверный ty минус живой f.y
      // первого бота (норма: +10..+40 — сервер держит ступни y+28, а тело k~1.6;
      // около 0 или отрицательный — куклу прибило к серверной точке).
      try {
        let dTxt = '';
        for (const [id, rec] of this._puppets) {
          if (id < 0 && rec && rec.f && rec.f.active) {
            dTxt = ' d' + (Math.round((rec.ty || 0) - (rec.f.y || 0)) >= 0 ? '+' : '') + Math.round((rec.ty || 0) - (rec.f.y || 0));
            break;
          }
        }
        if (this._netBuildTxt && this._netBuildTxt.active) {
          this._netBuildTxt.setText('NET v' + NET_BUILD + ' g' + NETG_BUILD + dTxt);
        }
      } catch (e) {}
      // Таймер: с лимитом — обратный отсчёт до дедлайна сервера,
      // без лимита — счётчик вперёд с начала матча.
      try {
        if (this._timeText) {
          if (this._endsAt > 0) {
            const left = Math.max(0, Math.ceil((this._endsAt - Date.now()) / 1000));
            const mm = String(Math.floor(left / 60)).padStart(2, '0');
            const ss = String(left % 60).padStart(2, '0');
            this._timeText.setText(`${mm}:${ss}`);
            try { this._timeText.setColor(left <= 30 ? '#ff6666' : '#ffffff'); } catch (e) {}
          } else {
            const s = Math.max(0, Math.floor(((time || 0) - (this._matchT0 || 0)) / 1000));
            const mm = String(Math.floor(s / 60)).padStart(2, '0');
            const ss = String(s % 60).padStart(2, '0');
            this._timeText.setText(`${mm}:${ss}`);
          }
        }
      } catch (e) {}
    }

    // Объективы каждый кадр из последнего obj.
    try { this._drawObj(); } catch (e) {}
    // Дым прячет чужих каждый кадр.
    try { this._updateSmokeGhosts(); } catch (e) {}
    // Трассеры пуль — каждый кадр, живым и мёртвым (как в одиночке).
    try { this.drawTracers(); } catch (e) {}
  }
