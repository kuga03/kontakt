import { gameState, saveGameState, syncGameState, getEquipment } from '../data/gameState.js';
import { getBotDifficulty, nextBotDifficulty, botDifficulties } from '../data/difficulty.js';
import { campaignLevels } from '../data/levels.js';
import { classDefinitions, isClassUnlocked, classOpenLevel, getWeaponLabel } from '../data/weapons.js';
import Assault from '../entities/Assault.js';
import Tank from '../entities/Tank.js';
import Medic from '../entities/Medic.js';
import Sniper from '../entities/Sniper.js';
import { gameW, UX } from '../ui/layout.js';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

const LOBBY_MODE_KEY = 'lobbyMode';
function getLobbyMode() {
  try {
    const v = localStorage.getItem(LOBBY_MODE_KEY);
    return ['FFA', 'TDM', 'CTF', 'BOMB', 'KOTH'].includes(v) ? v : 'TDM';
  } catch (e) { return 'TDM'; }
}
function saveLobbyMode(id) {
  try { localStorage.setItem(LOBBY_MODE_KEY, id); } catch (e) {}
}

// Mode display data
const MODE_META = {
  FFA:      { label: 'КАЖДЫЙ ЗА СЕБЯ', short: 'FFA',  color: 0xff6b35, icon: 'skull' },
  TDM:      { label: 'КОМАНДНЫЙ БОЙ',  short: 'TDM',  color: 0x44aaff, icon: 'swords' },
  CTF:      { label: 'ЗАХВАТ ФЛАГА',   short: 'CTF',  color: 0xffdd44, icon: 'flag' },
  BOMB:     { label: 'БОМБА',          short: 'BOMB', color: 0xff4444, icon: 'bolt' },
  KOTH:     { label: 'ЗАХВАТ ТОЧЕК',   short: 'КТОЧ', color: 0x44ff99, icon: 'star' },
  CAMPAIGN: { label: 'КАМПАНИЯ',       short: 'CAMP', color: 0xffd24a, icon: 'flag' }
};

// Class role descriptions
const CLASS_DESC = {
  Assault: 'Штурм · универсальный боец',
  Tank:    'Танк · броня и подавление',
  Medic:   'Медик · поддержка и лечение',
  Sniper:  'Снайпер · дальняя дистанция'
};

export default class LobbyScene extends Phaser.Scene {
  constructor() { super('LobbyScene'); }

  // ─────────────────────────────────────────────────────────────────────────
  //  ENTRY
  // ─────────────────────────────────────────────────────────────────────────
  create(data = {}) {
    syncGameState();
    const W = gameW(this);
    const cx = W / 2;

    this.mode          = data.mode || getLobbyMode();
    this.contractId    = data.contractId || null;
    this.selectedClass = data.selectedClass || gameState.lastClass || 'Assault';
    if (!isClassUnlocked(this.selectedClass, gameState.level)) this.selectedClass = 'Assault';

    const campLv = Math.max(1, Math.floor(Number(gameState.campaignLevel) || 1));
    this.levelIndex = data.levelIndex ?? Math.max(0, Math.min(campaignLevels.length - 1, campLv - 1));
    this._previews = [];

    const isCampaign = this.mode === 'CAMPAIGN';

    // ── background ──────────────────────────────────────────────────────────
    this._buildBackground(W);

    // ── parallax fon_menu ───────────────────────────────────────────────────
    this.bg = null;
    if (this.textures.exists('fon_menu')) {
      const src = this.textures.get('fon_menu').getSourceImage();
      const ratio = src.height / src.width;
      const bgW = Math.max(W * 1.12, 1460);
      const bgH = Math.round(bgW * ratio);
      this.bg = this.add.image(cx, 720 - bgH / 2, 'fon_menu')
        .setDisplaySize(bgW, bgH).setAlpha(0.18).setDepth(-1);
    }

    // ── header bar ──────────────────────────────────────────────────────────
    this._buildHeader(W, cx, isCampaign);

    // ── main layout ─────────────────────────────────────────────────────────
    if (isCampaign) {
      this._buildCampaignLayout(W, cx);
    } else {
      this._buildFreeLayout(W, cx);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BACKGROUND
  // ─────────────────────────────────────────────────────────────────────────
  _buildBackground(W) {
    this.cameras.main.setBackgroundColor('#07091a');
    const bg = this.add.graphics().setDepth(-2);
    // Three-band vertical gradient (matches other scenes)
    bg.fillStyle(0x0d1028, 1); bg.fillRect(0,   0, W, 240);
    bg.fillStyle(0x090b1e, 1); bg.fillRect(0, 240, W, 240);
    bg.fillStyle(0x050814, 1); bg.fillRect(0, 480, W, 240);
    // Subtle diagonal scan-line tint (tactical atmosphere)
    bg.lineStyle(1, 0x1a2048, 0.35);
    for (let y = 0; y < 720; y += 28) bg.lineBetween(0, y, W, y);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HEADER
  // ─────────────────────────────────────────────────────────────────────────
  _buildHeader(W, cx, isCampaign) {
    const H = 54;

    // Header panel
    const hg = this.add.graphics().setDepth(10);
    hg.fillStyle(0x080b1c, 0.97);
    hg.fillRect(0, 0, W, H);
    hg.lineStyle(1, 0xffd24a, 0.3);
    hg.lineBetween(0, H, W, H);
    // Thin gold top edge
    hg.lineStyle(2, 0xd8a920, 0.6);
    hg.lineBetween(0, 0, W, 0);

    // Back button
    this._buildBackBtn(UX(this, 72), 28);

    // Title
    const mMeta = MODE_META[this.mode] || MODE_META.TDM;
    const titleLabel = isCampaign ? 'КАМПАНИЯ' : 'ЛОББИ';
    this.add.text(cx, 18, titleLabel, {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    // Mode badge (right of title)
    const badgeText = isCampaign
      ? `УРОВЕНЬ ${campaignLevels[this.levelIndex]?.id ?? '—'}`
      : mMeta.label;
    const bdg = this.add.graphics().setDepth(11);
    const bdgTxt = this.add.text(cx, 38, badgeText, {
      fontSize: '11px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12);
    const bW = bdgTxt.displayWidth + 20, bH = 16;
    bdg.fillStyle(mMeta.color, 0.18);
    bdg.fillRoundedRect(cx - bW / 2, 38 - bH / 2, bW, bH, 4);
    bdg.lineStyle(1, mMeta.color, 0.6);
    bdg.strokeRoundedRect(cx - bW / 2, 38 - bH / 2, bW, bH, 4);

    // Player info (right side)
    const lvlText = `УР. ${gameState.level | 0}`;
    const coinText = `${gameState.coins | 0}`;
    this._buildPill(UX(this, W - 220), 27, `👤 ${String(gameState.playerName || 'Игрок').slice(0,14)}`, 0x111628, 0x4da6ff);
    this._buildPill(UX(this, W - 100), 27, `⭐ ${lvlText}`, 0x111628, 0xffd24a);

    // Gold divider line
    const div = this.add.graphics().setDepth(10);
    div.lineStyle(1.5, 0xffd24a, 0.5);
    div.lineBetween(cx - 200, H - 1, cx + 200, H - 1);
    // Diamond
    const dd = 4;
    div.fillStyle(0xffd24a, 0.8);
    div.fillPoints([
      new Phaser.Geom.Point(cx, H - 1 - dd),
      new Phaser.Geom.Point(cx + dd, H - 1),
      new Phaser.Geom.Point(cx, H - 1 + dd),
      new Phaser.Geom.Point(cx - dd, H - 1)
    ], true);
  }

  _buildBackBtn(x, y) {
    const W = 108, H = 34;
    const g = this.add.graphics().setDepth(15);
    const render = (hot) => {
      g.clear();
      g.fillStyle(0x3a1e24, 1);
      g.fillRoundedRect(x - W / 2, y - H / 2, W, H, 8);
      g.fillStyle(0xffffff, hot ? 0.15 : 0.07);
      g.fillRoundedRect(x - W / 2, y - H / 2, W, 5, { tl: 8, tr: 8, bl: 0, br: 0 });
      g.lineStyle(hot ? 2 : 1.5, hot ? 0xffff88 : 0x9e4a5a, 1);
      g.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 8);
    };
    render(false);
    const t = this.add.text(x, y, '← НАЗАД', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5).setDepth(16);
    const zone = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true }).setDepth(17);
    zone.on('pointerover',  () => { render(true);  t.setColor('#ffff55'); this._sfxHover(); });
    zone.on('pointerout',   () => { render(false); t.setColor('#ffffff'); });
    zone.on('pointerdown',  () => this.scene.start('MenuScene'));
  }

  _buildPill(x, y, label, fillHex, borderHex) {
    const t = this.add.text(x, y, label, {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12);
    const g = this.add.graphics().setDepth(11);
    const W = t.displayWidth + 18, H = 22;
    g.fillStyle(fillHex, 0.9);
    g.fillRoundedRect(x - W / 2, y - H / 2, W, H, 6);
    g.lineStyle(1.2, borderHex, 0.7);
    g.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 6);
    // Reorder so text is above bg
    t.setDepth(13);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CAMPAIGN LAYOUT
  // ─────────────────────────────────────────────────────────────────────────
  _buildCampaignLayout(W, cx) {
    const cl = campaignLevels[this.levelIndex] || campaignLevels[0];
    const PANEL_TOP = 66;
    const SIDE_W = 290;
    const MID_W  = W - SIDE_W * 2 - 32;
    const PANEL_H = 580;
    const LEFT_X  = UX(this, 160);
    const RIGHT_X = UX(this, 1120);

    // ── left panel: mission brief ──────────────────────────────────────────
    this._drawPanel(LEFT_X, PANEL_TOP, SIDE_W, PANEL_H, 'ЗАДАНИЕ');
    this._buildMissionPanel(LEFT_X, PANEL_TOP, SIDE_W, PANEL_H, cl);

    // ── center panel: class selection + hero preview ───────────────────────
    this._drawPanel(cx, PANEL_TOP, MID_W, PANEL_H, 'БОЕЦ');
    this._buildClassPanel(cx, PANEL_TOP, MID_W, PANEL_H, true);

    // ── right panel: loadout + settings ───────────────────────────────────
    this._drawPanel(RIGHT_X, PANEL_TOP, SIDE_W, PANEL_H, 'СНАРЯЖЕНИЕ');
    this._buildLoadoutPanel(RIGHT_X, PANEL_TOP, SIDE_W, PANEL_H, true);

    // ── start button ───────────────────────────────────────────────────────
    this._buildStartButton(cx, 672, 'НАЧАТЬ УРОВЕНЬ', true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  FREE PLAY LAYOUT
  // ─────────────────────────────────────────────────────────────────────────
  _buildFreeLayout(W, cx) {
    const PANEL_TOP = 66;
    const SIDE_W = 260;
    const MID_W  = W - SIDE_W * 2 - 32;
    const PANEL_H = 560;
    const LEFT_X  = UX(this, 148);
    const RIGHT_X = UX(this, 1132);

    // ── left panel: game mode ──────────────────────────────────────────────
    this._drawPanel(LEFT_X, PANEL_TOP, SIDE_W, PANEL_H, 'РЕЖИМ');
    this._buildModePanel(LEFT_X, PANEL_TOP, SIDE_W, PANEL_H);

    // ── center panel: class selection ─────────────────────────────────────
    this._drawPanel(cx, PANEL_TOP, MID_W, PANEL_H, 'БОЕЦ');
    this._buildClassPanel(cx, PANEL_TOP, MID_W, PANEL_H, false);

    // ── right panel: settings ─────────────────────────────────────────────
    this._drawPanel(RIGHT_X, PANEL_TOP, SIDE_W, PANEL_H, 'НАСТРОЙКИ');
    this._buildSettingsPanel(RIGHT_X, PANEL_TOP, SIDE_W, PANEL_H);

    // ── start button ───────────────────────────────────────────────────────
    this._buildStartButton(cx, 657, 'В БОЙ', false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PANEL BACKGROUND (reusable, matches main menu _panel style)
  // ─────────────────────────────────────────────────────────────────────────
  _drawPanel(cx, top, w, h, title) {
    const x0 = cx - w / 2;
    // Deep dark fill
    const g0 = this.add.graphics().setDepth(1);
    g0.fillStyle(0x090c16, 0.95);
    g0.fillRoundedRect(x0, top, w, h, 12);
    // Optional background texture
    if (this.textures.exists('фон для блоков меню')) {
      this.add.image(cx, top + h / 2, 'фон для блоков меню')
        .setDisplaySize(w, h).setAlpha(0.22).setDepth(1);
    }
    // Border
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(1.5, 0x8a6a10, 0.8);
    g.strokeRoundedRect(x0, top, w, h, 12);
    // Tactical corner brackets
    const cL = 14;
    g.lineStyle(2.5, 0xd8a920, 0.9);
    g.lineBetween(x0,         top + cL, x0,         top + 5);
    g.lineBetween(x0 + 5,     top,      x0 + cL,    top);
    g.lineBetween(x0 + w - cL, top,     x0 + w - 5, top);
    g.lineBetween(x0 + w,     top + 5,  x0 + w,     top + cL);
    g.lineBetween(x0,         top + h - cL, x0,     top + h - 5);
    g.lineBetween(x0 + 5,     top + h,  x0 + cL,    top + h);
    g.lineBetween(x0 + w - cL, top + h, x0 + w - 5, top + h);
    g.lineBetween(x0 + w,     top + h - 5, x0 + w,  top + h - cL);
    // Title capsule
    const probe = this.add.text(0, -999, title, { fontSize: '13px', fontStyle: 'bold' });
    const pillW = Math.max(110, probe.displayWidth + 36);
    probe.destroy();
    const tg = this.add.graphics().setDepth(3);
    tg.fillStyle(0x0c0f1e, 0.98);
    tg.fillRoundedRect(cx - pillW / 2, top + 8, pillW, 26, 6);
    tg.lineStyle(1.5, 0xd8a920, 0.85);
    tg.strokeRoundedRect(cx - pillW / 2, top + 8, pillW, 26, 6);
    this.add.text(cx, top + 21, `◆ ${title} ◆`, {
      fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(4);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MISSION BRIEF PANEL (campaign left)
  // ─────────────────────────────────────────────────────────────────────────
  _buildMissionPanel(cx, top, w, h, cl) {
    const PAD = 18;
    const x0 = cx - w / 2 + PAD;
    const x1 = cx + w / 2 - PAD;
    const innerW = x1 - x0;
    let y = top + 46;

    // Level badge
    const badge = this.add.graphics().setDepth(4);
    const bW = innerW, bH = 38;
    const mMeta = MODE_META[cl.mode] || MODE_META.CAMPAIGN;
    badge.fillStyle(mMeta.color, 0.12);
    badge.fillRoundedRect(x0, y, bW, bH, 8);
    badge.lineStyle(1.5, mMeta.color, 0.6);
    badge.strokeRoundedRect(x0, y, bW, bH, 8);
    this.add.text(cx, y + bH / 2, `УРОВЕНЬ ${cl.id}: ${cl.name}`, {
      fontSize: '13px', color: '#ffd24a', fontStyle: 'bold', align: 'center',
      wordWrap: { width: bW - 16 }
    }).setOrigin(0.5, 0.5).setDepth(5);
    y += bH + 10;

    // Map name
    if (cl.mapName) {
      const mapT = this.add.text(cx, y, `🗺  ${cl.mapName}`, {
        fontSize: '11px', color: '#8fb8ff'
      }).setOrigin(0.5).setDepth(5);
      // Clamp if too wide
      if (mapT.displayWidth > innerW) mapT.scaleX = innerW / mapT.displayWidth;
      y += 18;
    }

    // Divider
    this._hRule(cx, y, innerW); y += 12;

    // Info rows — two-column layout with fixed column split
    const labelW = 100, valX = x0 + labelW + 6;
    const valMaxW = x1 - valX;

    const infoRow = (lbl, val, col) => {
      this.add.text(x0, y, lbl + ':', {
        fontSize: '12px', color: '#6a7e9c'
      }).setDepth(5);
      const vt = this.add.text(valX, y, val, {
        fontSize: '12px', color: '#' + (col || 0xffffff).toString(16).padStart(6, '0'),
        fontStyle: 'bold'
      }).setDepth(5);
      if (vt.displayWidth > valMaxW) vt.scaleX = valMaxW / vt.displayWidth;
      y += 24;
    };

    infoRow('Режим', mMeta.label || cl.mode, mMeta.color);
    infoRow('Противников', String(cl.bots ?? cl.enemies ?? '?'), 0xff6666);
    if (cl.allies)      infoRow('Союзников', String(cl.allies), 0x66aaff);
    if (cl.scoreLimit)  infoRow('Игра до', String(cl.scoreLimit), 0xffd24a);
    if (cl.reward) {
      infoRow('Монеты', String(cl.reward.coins), 0xffdd44);
      infoRow('Опыт', String(cl.reward.experience) + ' XP', 0x44ff99);
    }

    this._hRule(cx, y, innerW); y += 10;

    // Objective text
    this.add.text(x0, y, 'ЦЕЛЬ:', {
      fontSize: '11px', color: '#ffd24a', fontStyle: 'bold'
    }).setDepth(5);
    y += 15;
    this.add.text(x0, y, cl.objective || '', {
      fontSize: '11px', color: '#c8d8f0',
      wordWrap: { width: innerW }
    }).setDepth(5);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CLASS SELECTION PANEL (center)
  // ─────────────────────────────────────────────────────────────────────────
  _buildClassPanel(cx, top, w, h, isCampaign) {
    const CARD_W = Math.min(Math.floor((w - 32) / 4) - 8, 148);
    const totalW = CARD_W * 4 + 8 * 3;
    const startX = cx - totalW / 2 + CARD_W / 2;
    const CARD_H = isCampaign ? 390 : 360;
    const cardY  = top + 50 + CARD_H / 2;

    classDefinitions.forEach((cd, i) => {
      const bx = startX + i * (CARD_W + 8);
      this._buildClassCard(bx, cardY, CARD_W, CARD_H, cd, i, isCampaign);
    });
  }

  _buildClassCard(cx, cy, w, h, cd, idx, isCampaign) {
    const isSelected = cd.id === this.selectedClass;
    const locked = !isClassUnlocked(cd.id, gameState.level);
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    // ── card background ──────────────────────────────────────────────────
    const g = this.add.graphics().setDepth(5);
    const drawCard = (hover) => {
      g.clear();
      if (isSelected) {
        // Active: rich gold-bordered card
        g.fillStyle(0x1a1408, 0.98);
        g.fillRoundedRect(x0, y0, w, h, 10);
        g.fillStyle(cd.color, 0.08);
        g.fillRoundedRect(x0, y0, w, h, 10);
        // Top sheen
        g.fillStyle(0xffd24a, 0.1);
        g.fillRoundedRect(x0 + 2, y0 + 2, w - 4, 24, { tl: 8, tr: 8, bl: 0, br: 0 });
        // Left accent stripe
        g.fillStyle(cd.color, 0.9);
        g.fillRoundedRect(x0 + 3, y0 + 8, 3.5, h - 16, 2);
        // Gold border
        g.lineStyle(2, 0xffd24a, 0.95);
        g.strokeRoundedRect(x0, y0, w, h, 10);
        // Corner notches
        g.lineStyle(2, 0xffea77, 1);
        const cN = 8;
        g.lineBetween(x0 + w - cN, y0, x0 + w - 2, y0);
        g.lineBetween(x0 + w, y0 + 2, x0 + w, y0 + cN);
        g.lineBetween(x0, y0 + h - cN, x0, y0 + h - 2);
        g.lineBetween(x0 + 2, y0 + h, x0 + cN, y0 + h);
      } else if (locked) {
        g.fillStyle(0x0a0c18, 0.88);
        g.fillRoundedRect(x0, y0, w, h, 10);
        g.lineStyle(1, 0x1e2438, 0.9);
        g.strokeRoundedRect(x0, y0, w, h, 10);
      } else {
        // Normal / hover
        g.fillStyle(hover ? 0x151c30 : 0x0e1020, 0.95);
        g.fillRoundedRect(x0, y0, w, h, 10);
        g.fillStyle(0xffffff, hover ? 0.08 : 0.03);
        g.fillRoundedRect(x0 + 2, y0 + 2, w - 4, 16, { tl: 8, tr: 8, bl: 0, br: 0 });
        // Left stripe: class color, dimmer
        g.fillStyle(cd.color, hover ? 0.55 : 0.3);
        g.fillRoundedRect(x0 + 3, y0 + 8, 3, h - 16, 2);
        g.lineStyle(hover ? 1.8 : 1.2, hover ? cd.color : 0x2a3550, hover ? 0.9 : 0.8);
        g.strokeRoundedRect(x0, y0, w, h, 10);
      }
    };
    drawCard(false);

    // ── class name badge ─────────────────────────────────────────────────
    const labelColor = locked ? '#55637a' : (isSelected ? '#ffd24a' : '#c8d0e8');
    const lbl = this.add.text(cx, y0 + 15, cd.label.toUpperCase(), {
      fontSize: isSelected ? '14px' : '13px',
      color: labelColor, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7);

    // ── hero preview ─────────────────────────────────────────────────────
    const previewY = cy - h / 2 + (isCampaign ? 200 : 180);
    const previewScale = isCampaign ? 1.42 : 1.28;
    this._spawnHeroPreview(cx, previewY, cd.id, isSelected, previewScale);

    // ── role description ─────────────────────────────────────────────────
    const descY = y0 + h - 68;
    this._hRule(cx, descY - 4, w - 20);
    const descT = this.add.text(cx, descY + 8, CLASS_DESC[cd.id] || '', {
      fontSize: '10px', color: locked ? '#3a4558' : '#8899cc',
      align: 'center', wordWrap: { width: w - 20 }
    }).setOrigin(0.5).setDepth(7);

    // ── loadout weapon name ──────────────────────────────────────────────
    if (!locked) {
      const eq = getEquipment(cd.id);
      const cdDef = classDefinitions.find(c => c.id === cd.id) || {};
      const primaryName = eq.primary || cdDef.defaultPrimary || '—';
      const wLabel = getWeaponLabel(primaryName) || primaryName;
      const wT = this.add.text(cx, y0 + h - 22, wLabel.toUpperCase(), {
        fontSize: '10px', color: isSelected ? '#aaddff' : '#556677', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(7);
      const maxWW = w - 16;
      if (wT.displayWidth > maxWW) wT.scaleX = maxWW / wT.displayWidth;
    }

    // ── unlock level (locked state) ──────────────────────────────────────
    if (locked) {
      const openLv = classOpenLevel(cd.id);
      const lockG = this.add.graphics().setDepth(7);
      lockG.fillStyle(0x000000, 0.45);
      lockG.fillRoundedRect(x0 + 4, y0 + 4, w - 8, h - 8, 8);
      this.add.text(cx, cy - 20, '🔒', { fontSize: '22px' }).setOrigin(0.5).setDepth(8);
      this.add.text(cx, cy + 12, `УРОВЕНЬ ${openLv}`, {
        fontSize: '11px', color: '#667788', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(8);
    }

    // ── hit zone ─────────────────────────────────────────────────────────
    if (!locked) {
      const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(9);
      zone.on('pointerover', () => {
        if (!isSelected) { drawCard(true); lbl.setColor('#ffffff'); }
        this._sfxHover();
      });
      zone.on('pointerout',  () => {
        if (!isSelected) { drawCard(false); lbl.setColor(labelColor); }
      });
      zone.on('pointerdown', () => {
        if (cd.id === this.selectedClass) return;
        this.selectedClass = cd.id;
        gameState.lastClass = cd.id;
        saveGameState();
        this._restart();
      });
    }

    // ── selected indicator bottom bar ───────────────────────────────────
    if (isSelected) {
      const selG = this.add.graphics().setDepth(7);
      selG.fillStyle(cd.color, 0.9);
      selG.fillRoundedRect(x0 + 12, y0 + h - 6, w - 24, 4, 2);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  LOADOUT PANEL (campaign right)
  // ─────────────────────────────────────────────────────────────────────────
  _buildLoadoutPanel(cx, top, w, h, isCampaign) {
    const PAD = 18;
    const innerW = w - PAD * 2;
    const x0 = cx - w / 2 + PAD;
    let y = top + 46;

    // Current class heading
    const cd = classDefinitions.find(c => c.id === this.selectedClass);
    if (!cd) return;

    // Class color bar
    const barG = this.add.graphics().setDepth(5);
    barG.fillStyle(cd.color, 0.18);
    barG.fillRoundedRect(x0, y, innerW, 32, 8);
    barG.lineStyle(1.5, cd.color, 0.6);
    barG.strokeRoundedRect(x0, y, innerW, 32, 8);
    this.add.text(cx, y + 16, cd.label.toUpperCase(), {
      fontSize: '14px', fontStyle: 'bold', color: '#ffd24a'
    }).setOrigin(0.5).setDepth(6);
    y += 54;

    // Weapon slots
    const eq = getEquipment(this.selectedClass);
    const slots = [
      { key: 'primary',   label: 'ОСНОВНОЕ' },
      { key: 'secondary', label: 'ВТОРИЧНОЕ' },
      { key: 'melee',     label: 'РУКОПАШНОЕ' }
    ];
    slots.forEach(sl => {
      const wName = eq[sl.key];
      const cdDef = classDefinitions.find(c => c.id === this.selectedClass) || {};
      const resolved = wName
        || (sl.key === 'primary' ? cdDef.defaultPrimary : null)
        || (sl.key === 'secondary' ? cdDef.defaultSecondary : null)
        || null;
      const wLabel = resolved ? (getWeaponLabel(resolved) || resolved) : '—';
      this._weaponSlot(cx, y, innerW, sl.label, wLabel.toUpperCase(), !!wName);
      y += 46;
    });

    // Difficulty — campaign only, no duplication with mission panel
    this._hRule(cx, y, innerW); y += 14;
    const diffCfg = getBotDifficulty(gameState.campaignDifficulty);
    const diffNotes = { novice: 'XP -30%', experienced: 'стандарт', veteran: '+10% к XP' };
    this._buildCycleButton(cx, y + 20, innerW, diffCfg.label, diffNotes[diffCfg.id] || '', () => {
      let next = nextBotDifficulty(gameState.campaignDifficulty);
      while (next === 'sandbox') next = nextBotDifficulty(next);
      gameState.campaignDifficulty = next;
      saveGameState();
      this._restart();
    });
  }

  _weaponSlot(cx, y, w, slotLabel, weaponName, hasWeapon) {
    const x0 = cx - w / 2;
    const H = 38;
    const g = this.add.graphics().setDepth(5);
    const col    = hasWeapon ? 0x1a2e1e : 0x12161e;
    const border = hasWeapon ? 0x33aa55 : 0x2a3550;
    g.fillStyle(col, 0.95);
    g.fillRoundedRect(x0, y - H / 2, w, H, 6);
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(x0, y - H / 2, w, 5, { tl: 6, tr: 6, bl: 0, br: 0 });
    g.lineStyle(1.2, border, 0.8);
    g.strokeRoundedRect(x0, y - H / 2, w, H, 6);

    // Slot label — small, top-left
    this.add.text(x0 + 10, y - 10, slotLabel, {
      fontSize: '9px', color: hasWeapon ? '#55aa77' : '#445566', fontStyle: 'bold'
    }).setDepth(6);

    // Weapon name — clamped to leave room for checkmark
    const CHECK_SPACE = hasWeapon ? 22 : 0;
    const maxNameW = w - 20 - CHECK_SPACE;
    const nameT = this.add.text(x0 + 10, y + 5, weaponName, {
      fontSize: '12px', color: hasWeapon ? '#c8f0c8' : '#445566', fontStyle: 'bold'
    }).setDepth(6);
    if (nameT.displayWidth > maxNameW) nameT.scaleX = maxNameW / nameT.displayWidth;

    // Check icon — right-aligned
    if (hasWeapon) {
      this.add.text(x0 + w - 10, y, '✓', {
        fontSize: '14px', color: '#44dd77'
      }).setOrigin(1, 0.5).setDepth(6);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MODE SELECTION PANEL (free play left)
  // ─────────────────────────────────────────────────────────────────────────
  _buildModePanel(cx, top, w, h) {
    const x0 = cx - w / 2 + 16;
    let y = top + 50;

    const modes = [
      { id: 'TDM',  label: 'КОМАНДНЫЙ БОЙ',  sub: '2 команды · лимит фрагов' },
      { id: 'FFA',  label: 'КАЖДЫЙ ЗА СЕБЯ', sub: 'Все против всех' },
      { id: 'CTF',  label: 'ЗАХВАТ ФЛАГА',   sub: 'Флаги в базу врага' },
      { id: 'BOMB', label: 'БОМБА',          sub: 'Установка взрывчатки' },
      { id: 'KOTH', label: 'ЗАХВАТ ТОЧЕК',   sub: 'Удерживай точки A/B/C' }
    ];

    modes.forEach(m => {
      const isActive = m.id === this.mode;
      const mMeta = MODE_META[m.id] || {};
      this._buildModeButton(cx, y, w - 32, m, isActive, mMeta.color || 0x44aaff, () => {
        saveLobbyMode(m.id);
        this.mode = m.id;
        this._restart();
      });
      y += 78;
    });
  }

  _buildModeButton(cx, y, w, mode, isActive, color, cb) {
    const H = 68;
    const x0 = cx - w / 2;
    const g = this.add.graphics().setDepth(5);

    const draw = (hover) => {
      g.clear();
      if (isActive) {
        g.fillStyle(0x18120a, 0.98);
        g.fillRoundedRect(x0, y - H / 2, w, H, 8);
        g.fillStyle(color, 0.1);
        g.fillRoundedRect(x0, y - H / 2, w, H, 8);
        g.fillStyle(0xffd24a, 0.1);
        g.fillRoundedRect(x0 + 2, y - H / 2 + 2, w - 4, 20, { tl: 6, tr: 6, bl: 0, br: 0 });
        // Left accent bar
        g.fillStyle(color, 1);
        g.fillRoundedRect(x0 + 3, y - H / 2 + 6, 4, H - 12, 2);
        g.lineStyle(2, 0xffd24a, 0.95);
        g.strokeRoundedRect(x0, y - H / 2, w, H, 8);
        // Bottom indicator
        g.fillStyle(color, 0.9);
        g.fillRoundedRect(x0 + 10, y + H / 2 - 4, w - 20, 3, 1.5);
      } else {
        g.fillStyle(hover ? 0x14192c : 0x0e1120, 0.96);
        g.fillRoundedRect(x0, y - H / 2, w, H, 8);
        g.fillStyle(0xffffff, hover ? 0.08 : 0.03);
        g.fillRoundedRect(x0 + 2, y - H / 2 + 2, w - 4, 14, { tl: 6, tr: 6, bl: 0, br: 0 });
        g.fillStyle(color, hover ? 0.6 : 0.3);
        g.fillRoundedRect(x0 + 3, y - H / 2 + 6, 3, H - 12, 2);
        g.lineStyle(hover ? 1.8 : 1.2, hover ? color : 0x2a3550, hover ? 0.9 : 0.7);
        g.strokeRoundedRect(x0, y - H / 2, w, H, 8);
      }
    };
    draw(false);

    const ICON_SPACE = 44; // space reserved on the right for the mode icon
    const textMaxW = w - 18 - ICON_SPACE;

    const modeLabel = this.add.text(x0 + 18, y - 14, mode.label, {
      fontSize: isActive ? '15px' : '14px',
      color: isActive ? '#ffd24a' : '#8899bb', fontStyle: 'bold'
    }).setDepth(6);
    if (modeLabel.displayWidth > textMaxW) modeLabel.scaleX = textMaxW / modeLabel.displayWidth;

    const subLabel = this.add.text(x0 + 18, y + 7, mode.sub, {
      fontSize: '11px', color: isActive ? '#aabbdd' : '#445566'
    }).setDepth(6);
    if (subLabel.displayWidth > textMaxW) subLabel.scaleX = textMaxW / subLabel.displayWidth;

    // Mode icon (right side) — drawn vector
    const iconX = cx + w / 2 - 24;
    this._drawModeIcon(iconX, y, 16, mode.id, isActive ? color : 0x334466);

    if (!isActive) {
      const zone = this.add.zone(cx, y, w, H).setInteractive({ useHandCursor: true }).setDepth(8);
      zone.on('pointerover', () => {
        draw(true);
        modeLabel.setColor('#ffffff');
        this._sfxHover();
      });
      zone.on('pointerout',  () => {
        draw(false);
        modeLabel.setColor('#8899bb');
      });
      zone.on('pointerdown', cb);
    }
  }

  // Compact vector mode icons
  _drawModeIcon(x, y, s, modeId, col) {
    const g = this.add.graphics().setDepth(6);
    g.lineStyle(1.8, col, 1);
    g.fillStyle(col, 0.9);
    switch (modeId) {
      case 'TDM': {
        // Two opposing arrows
        g.beginPath(); g.moveTo(x - s, y - 4); g.lineTo(x - 2, y - 4);
        g.lineTo(x - 2, y - s / 2 - 2); g.lineTo(x + s / 2, y - 4);
        g.strokePath();
        g.beginPath(); g.moveTo(x + s, y + 4); g.lineTo(x + 2, y + 4);
        g.lineTo(x + 2, y + s / 2 + 2); g.lineTo(x - s / 2, y + 4);
        g.strokePath();
        break;
      }
      case 'FFA': {
        // Star burst
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          g.lineBetween(x, y, x + Math.cos(a) * s, y + Math.sin(a) * s);
        }
        g.fillCircle(x, y, 3);
        break;
      }
      case 'CTF': {
        // Flag silhouette
        g.lineStyle(2, col, 1);
        g.lineBetween(x - s / 2, y - s, x - s / 2, y + s * 0.7);
        g.fillStyle(col, 0.8);
        g.fillTriangle(x - s / 2, y - s, x + s * 0.8, y - s * 0.4, x - s / 2, y);
        break;
      }
      case 'BOMB': {
        // Circle with fuse
        g.strokeCircle(x, y + 3, s * 0.65);
        g.lineStyle(2, col, 1);
        g.lineBetween(x + 4, y - s * 0.4, x + s * 0.9, y - s);
        g.fillStyle(0xff4444, 1); g.fillCircle(x + s * 0.9, y - s, 2.5);
        break;
      }
      case 'KOTH': {
        // Crown
        const pts = [
          new Phaser.Geom.Point(x - s, y + s * 0.6),
          new Phaser.Geom.Point(x - s, y - s * 0.3),
          new Phaser.Geom.Point(x - s * 0.35, y + s * 0.1),
          new Phaser.Geom.Point(x, y - s * 0.8),
          new Phaser.Geom.Point(x + s * 0.35, y + s * 0.1),
          new Phaser.Geom.Point(x + s, y - s * 0.3),
          new Phaser.Geom.Point(x + s, y + s * 0.6),
        ];
        g.fillStyle(col, 0.25);
        g.fillPoints(pts, true);
        g.lineStyle(1.8, col, 1);
        g.strokePoints(pts, true);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SETTINGS PANEL (free play right)
  // ─────────────────────────────────────────────────────────────────────────
  _buildSettingsPanel(cx, top, w, h) {
    const x0 = cx - w / 2 + 16;
    let y = top + 54;

    // ── Difficulty ────────────────────────────────────────────────────────
    this._sectionLabel(cx, y, 'СЛОЖНОСТЬ'); y += 30;
    const diffCfg = getBotDifficulty(gameState.freeDifficulty);
    const diffNotes = { novice: 'XP не начисляется', experienced: 'стандарт', veteran: '+10% к XP', sandbox: 'боты не стреляют' };
    this._buildCycleButton(cx, y + 20, w - 32, diffCfg.label, diffNotes[diffCfg.id] || '', () => {
      gameState.freeDifficulty = nextBotDifficulty(gameState.freeDifficulty);
      saveGameState();
      this._restart();
    });
    y += 56;

    this._hRule(cx, y, w - 32); y += 16;

    // ── Bots / Team size ──────────────────────────────────────────────────
    this._sectionLabel(cx, y, 'СОСТАВ КОМАНДЫ'); y += 22;
    const teamOpts = [2, 3, 4, 5, 6, 8];
    const _fix  = (v) => teamOpts.includes(v) ? v : 5;
    const cur   = this.mode === 'FFA' ? _fix(gameState.botCount) : _fix(gameState.blueBots);
    const nextT = () => {
      const next = teamOpts[(teamOpts.indexOf(cur) + 1) % teamOpts.length];
      gameState.botCount = next; gameState.blueBots = next; gameState.redBots = next;
      gameState.noAllies = false;
      saveGameState();
      this._restart();
    };
    const teamSub = this.mode === 'FFA' ? `${cur} ботов` : `${cur} на команду`;
    this._buildCycleButton(cx, y + 20, w - 32, String(cur) + ' ИГРОКОВ', teamSub, nextT);
    y += 56;

    this._hRule(cx, y, w - 32); y += 16;

    // ── Win condition ─────────────────────────────────────────────────────
    this._sectionLabel(cx, y, 'УСЛОВИЕ ПОБЕДЫ'); y += 22;
    const goalData = this._goalData();
    this._buildCycleButton(cx, y + 20, w - 32, goalData.label, goalData.sub, () => {
      goalData.cycle();
      this._restart();
    });
    y += 56;

    // CTF extra: Sudden start
    if (this.mode === 'CTF') {
      this._hRule(cx, y, w - 32); y += 14;
      this._sectionLabel(cx, y, 'РЕЖИМ ОТ'); y += 22;
      const suddenLabel = gameState.ctfSuddenStart ? 'СРАЗУ С ОТ' : 'СТАНДАРТНЫЙ';
      const suddenSub   = gameState.ctfSuddenStart ? 'Золото с 1-й секунды' : 'Сначала обычные флаги';
      this._buildCycleButton(cx, y + 20, w - 32, suddenLabel, suddenSub, () => {
        gameState.ctfSuddenStart = !gameState.ctfSuddenStart;
        saveGameState();
        this._restart();
      });
    }
  }

  _goalData() {
    const mode = this.mode;
    if (mode === 'CTF') {
      const opts = [1, 3, 5, 7, 10];
      if (!opts.includes(gameState.ctfLimit)) gameState.ctfLimit = 3;
      return {
        label: `${gameState.ctfLimit} ФЛАГОВ`,
        sub: 'Доставить флаги врага',
        cycle: () => { gameState.ctfLimit = opts[(opts.indexOf(gameState.ctfLimit) + 1) % opts.length]; saveGameState(); }
      };
    }
    if (mode === 'BOMB') {
      const opts = [1, 3, 5];
      if (!opts.includes(gameState.bombLimit)) gameState.bombLimit = 3;
      return {
        label: `${gameState.bombLimit} УСТАНОВКИ`,
        sub: 'Установить взрывчатку',
        cycle: () => { gameState.bombLimit = opts[(opts.indexOf(gameState.bombLimit) + 1) % opts.length]; saveGameState(); }
      };
    }
    if (mode === 'KOTH') {
      const opts = [100, 200, 300];
      if (!opts.includes(gameState.kothLimit)) gameState.kothLimit = 200;
      return {
        label: `${gameState.kothLimit} ОЧКОВ`,
        sub: 'Удерживать точки',
        cycle: () => { gameState.kothLimit = opts[(opts.indexOf(gameState.kothLimit) + 1) % opts.length]; saveGameState(); }
      };
    }
    // FFA / TDM
    const opts = [15, 30, 45, 60];
    if (!opts.includes(gameState.scoreLimit)) gameState.scoreLimit = 30;
    return {
      label: `${gameState.scoreLimit} ФРАГОВ`,
      sub: mode === 'FFA' ? 'Уничтожить всех' : 'Командный счёт',
      cycle: () => { gameState.scoreLimit = opts[(opts.indexOf(gameState.scoreLimit) + 1) % opts.length]; saveGameState(); }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  START BUTTON
  // ─────────────────────────────────────────────────────────────────────────
  _buildStartButton(cx, y, label, isCampaign) {
    const W = 280, H = 54;
    const g = this.add.graphics().setDepth(20);

    const draw = (hover, pressed) => {
      g.clear();
      if (pressed) {
        g.fillStyle(0x0a2a10, 1);
        g.fillRoundedRect(cx - W / 2, y - H / 2, W, H, 12);
        g.lineStyle(2.5, 0x33dd55, 1);
        g.strokeRoundedRect(cx - W / 2, y - H / 2, W, H, 12);
      } else if (hover) {
        g.fillStyle(0x0f3318, 1);
        g.fillRoundedRect(cx - W / 2, y - H / 2, W, H, 12);
        // Bright sheen
        g.fillStyle(0x44ff88, 0.18);
        g.fillRoundedRect(cx - W / 2 + 3, y - H / 2 + 3, W - 6, H / 2 - 3, { tl: 9, tr: 9, bl: 0, br: 0 });
        // Left stripe
        g.fillStyle(0x44ff88, 1);
        g.fillRoundedRect(cx - W / 2 + 4, y - H / 2 + 7, 4, H - 14, 2);
        g.lineStyle(2.5, 0x44ff88, 1);
        g.strokeRoundedRect(cx - W / 2, y - H / 2, W, H, 12);
        // Corner notches
        g.lineStyle(2.5, 0x88ffaa, 1);
        const cN = 10;
        g.lineBetween(cx - W / 2,     y - H / 2 + cN, cx - W / 2,     y - H / 2 + 3);
        g.lineBetween(cx - W / 2 + 3, y - H / 2,      cx - W / 2 + cN, y - H / 2);
        g.lineBetween(cx + W / 2 - cN, y + H / 2,     cx + W / 2 - 3,  y + H / 2);
        g.lineBetween(cx + W / 2,      y + H / 2 - cN, cx + W / 2,     y + H / 2 - 3);
      } else {
        // Normal green state
        g.fillStyle(0x0c2a14, 1);
        g.fillRoundedRect(cx - W / 2, y - H / 2, W, H, 12);
        g.fillStyle(0x44ff88, 0.08);
        g.fillRoundedRect(cx - W / 2 + 2, y - H / 2 + 2, W - 4, H / 2 - 2, { tl: 10, tr: 10, bl: 0, br: 0 });
        g.fillStyle(0x33cc55, 0.7);
        g.fillRoundedRect(cx - W / 2 + 4, y - H / 2 + 7, 3.5, H - 14, 2);
        g.lineStyle(2, 0x33cc55, 0.9);
        g.strokeRoundedRect(cx - W / 2, y - H / 2, W, H, 12);
        // Dim corner notches
        g.lineStyle(2, 0x44aa66, 0.7);
        const cN = 10;
        g.lineBetween(cx - W / 2,     y - H / 2 + cN, cx - W / 2,     y - H / 2 + 3);
        g.lineBetween(cx - W / 2 + 3, y - H / 2,      cx - W / 2 + cN, y - H / 2);
        g.lineBetween(cx + W / 2 - cN, y + H / 2,     cx + W / 2 - 3,  y + H / 2);
        g.lineBetween(cx + W / 2,      y + H / 2 - cN, cx + W / 2,     y + H / 2 - 3);
      }
    };
    draw(false, false);

    const t = this.add.text(cx, y, label, {
      fontSize: '24px', color: '#66ffaa', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5).setDepth(21);

    const zone = this.add.zone(cx, y, W, H).setInteractive({ useHandCursor: true }).setDepth(22);
    zone.on('pointerover',  () => { draw(true, false);  t.setColor('#aaffc8'); this._sfxHover(); });
    zone.on('pointerout',   () => { draw(false, false); t.setColor('#66ffaa'); });
    zone.on('pointerdown',  () => { draw(false, true);  t.setColor('#ffffff'); });
    zone.on('pointerup',    () => {
      draw(false, false);
      t.setColor('#66ffaa');
      this._launchGame();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CYCLE BUTTON — settings toggle
  // ─────────────────────────────────────────────────────────────────────────
  _buildCycleButton(cx, y, w, mainLabel, subLabel, cb) {
    const H = 42;
    const x0 = cx - w / 2;
    const g = this.add.graphics().setDepth(5);
    // Reserve space: left padding (14) + right chevron area (22)
    const textX = x0 + 14;
    const maxTW  = w - 14 - 22;

    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x1a2238 : 0x0f1425, 0.97);
      g.fillRoundedRect(x0, y - H / 2, w, H, 8);
      g.fillStyle(0xffffff, hover ? 0.1 : 0.04);
      g.fillRoundedRect(x0 + 2, y - H / 2 + 2, w - 4, 14, { tl: 6, tr: 6, bl: 0, br: 0 });
      g.fillStyle(0xffd24a, hover ? 0.9 : 0.55);
      g.fillRoundedRect(x0 + 3, y - H / 2 + 6, 3, H - 12, 2);
      g.lineStyle(hover ? 2 : 1.5, hover ? 0xffd24a : 0x2e3d5c, hover ? 0.95 : 0.75);
      g.strokeRoundedRect(x0, y - H / 2, w, H, 8);
      // Right chevron
      const ax = x0 + w - 14, ay = y;
      g.lineStyle(2, hover ? 0xffd24a : 0x667788, 1);
      g.lineBetween(ax - 4, ay - 5, ax + 2, ay);
      g.lineBetween(ax - 4, ay + 5, ax + 2, ay);
    };
    draw(false);

    const mainT = this.add.text(textX, y - 8, mainLabel, {
      fontSize: '14px', color: '#ffd24a', fontStyle: 'bold'
    }).setDepth(6);
    if (mainT.displayWidth > maxTW) mainT.scaleX = maxTW / mainT.displayWidth;

    if (subLabel) {
      const subT = this.add.text(textX, y + 8, subLabel, {
        fontSize: '11px', color: '#6a7e9c'
      }).setDepth(6);
      if (subT.displayWidth > maxTW) subT.scaleX = maxTW / subT.displayWidth;
    }

    const zone = this.add.zone(cx, y, w, H).setInteractive({ useHandCursor: true }).setDepth(8);
    zone.on('pointerover', () => { draw(true);  this._sfxHover(); });
    zone.on('pointerout',  () =>   draw(false));
    zone.on('pointerdown', cb);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SMALL HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  _sectionLabel(cx, y, label) {
    this.add.text(cx, y, label, {
      fontSize: '11px', color: '#4a6080', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);
  }

  _hRule(cx, y, w) {
    const g = this.add.graphics().setDepth(5);
    g.lineStyle(1, 0xd8a920, 0.25);
    g.lineBetween(cx - w / 2, y, cx + w / 2, y);
    g.fillStyle(0xd8a920, 0.4);
    g.fillRect(cx - 3, y - 1, 6, 2);
  }

  _infoRow(x0, y, labelStr, valueStr, valueColor) {
    this.add.text(x0, y, labelStr + ':', {
      fontSize: '12px', color: '#6a7e9c'
    }).setDepth(5);
    this.add.text(x0 + 160, y, valueStr, {
      fontSize: '12px', color: '#' + (valueColor || 0xffffff).toString(16).padStart(6, '0'),
      fontStyle: 'bold'
    }).setOrigin(0, 0).setDepth(5);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HERO PREVIEW  (same logic as original)
  // ─────────────────────────────────────────────────────────────────────────
  _spawnHeroPreview(bx, y, className, isSelected, scale) {
    try {
      const Cls = PREVIEW_CLASSES[className] || Assault;
      const p = new Cls(this, bx, y, { name: className, team: 'blue', noDefaults: true });
      p.previewScale(scale || 1.4);
      if (p.body) { p.body.setAllowGravity(false); p.body.setImmovable(true); }
      p.setVelocity(0, 0);
      p._editorGrounded = true;
      p.aimAt(bx + 200, y - 10);
      // Показать оружие в лобби: если снаряжение не задано, берём дефолт класса
      if (!p.weapon) {
        try {
          const eq = (typeof getEquipment === 'function') ? getEquipment(className) : {};
          const cdDef = classDefinitions.find(c => c.id === className) || {};
          const primaryName = (eq && eq.primary) || cdDef.defaultPrimary;
          if (primaryName && typeof p.addWeapon === 'function') p.addWeapon(primaryName);
          if (p.selectWeapon) p.selectWeapon(0);
        } catch (e) {}
      }
      p.updateBars();
      if (p.updateGun) p.updateGun();
      p.healthBar.setVisible(false);
      p.armorBar.setVisible(false);
      p.nameText.setVisible(false);
      if (p.weapon) { p._gunAllowed = true; p._setGunVisible(true); }
      else { p._gunAllowed = false; p._setGunVisible(false); }

      // Убрать шею у персонажа в лобби
      if (p._neckVis) { try { p._neckVis.setVisible(false); p._neckVis.setAlpha(0); } catch (e) {} }
      if (p.neck) { try { p.neck.setVisible(false); } catch (e) {} }

      // Lift all preview parts above card backgrounds (depth 5) so the
      // hero is always visible inside its card frame.
      const PREVIEW_DEPTH = 6;
      const GUN_DEPTH = 7;
      const liftDepth = (o, depth = PREVIEW_DEPTH) => {
        if (!o || !o.active) return;
        if (o === p.neck || o === p._neckVis) return;
        try { if (o.alpha === 0) return; } catch (e) {}
        if (typeof o.getChildren === 'function') {
          try { if (typeof o.setDepth === 'function') o.setDepth(depth); } catch (e) {}
          o.getChildren().forEach((c) => liftDepth(c, depth));
          return;
        }
        try { if (typeof o.setDepth === 'function') o.setDepth(depth); } catch (e) {}
      };
      try {
        const parts = (typeof p._smokeParts === 'function') ? p._smokeParts() : null;
        if (parts && parts.length) { parts.forEach((o) => liftDepth(o)); }
        else {
          (p._allParts || []).forEach((o) => liftDepth(o));
          if (p.head)   liftDepth(p.head);
        }
        if (p.gunImg) liftDepth(p.gunImg, GUN_DEPTH);
        if (p.gun)    liftDepth(p.gun, GUN_DEPTH);
      } catch (e) {}

      if (!isSelected) this._grayPreview(p);
      this._previews.push(p);
    } catch (e) { /* preview never crashes the scene */ }
  }

  _grayPreview(p) {
    const grayOf = (hex) => {
      try {
        const n = (Number(hex) >>> 0) || 0;
        const l = Math.round(0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
        return (l << 16) | (l << 8) | l;
      } catch (e) { return 0x888888; }
    };
    const mute = (o) => {
      try {
        if (!o) return;
        if (typeof o.setTint === 'function') { o.setTint(0x9a9a9a); return; }
        if (typeof o.setFillStyle === 'function' && o.fillColor !== undefined && o.fillColor !== null) {
          o.setFillStyle(grayOf(o.fillColor), 1); return;
        }
        if ('fillColor' in o && Number.isFinite(+o.fillColor)) {
          try { o.fillColor = grayOf(o.fillColor); } catch (e) {}
        }
      } catch (e) {}
    };
    const paint = (o) => {
      if (!o || !o.active) return;
      if (o === p.neck) return;
      try { if (o.alpha === 0) return; } catch (e) {}
      if (typeof o.getChildren === 'function') { o.getChildren().forEach(paint); return; }
      mute(o);
    };
    try {
      try { p._grayLock = true; } catch (e) {}
      const parts = (typeof p._smokeParts === 'function') ? p._smokeParts() : null;
      if (parts && parts.length) { parts.forEach(paint); }
      else {
        (p._allParts || []).forEach(paint);
        if (p.head) paint(p.head);
        if (p.neck) paint(p.neck);
        if (p.gunImg) paint(p.gunImg);
      }
    } catch (e) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  GAME LAUNCH
  // ─────────────────────────────────────────────────────────────────────────
  _launchGame() {
    this.scene.start('GameScene', {
      mode: this.mode,
      selectedClass: this.selectedClass,
      levelIndex: this.levelIndex,
      playerName: gameState.playerName,
      contractId: this.contractId || null,
      scoreLimit: this.mode === 'CTF'  ? gameState.ctfLimit
               : this.mode === 'BOMB' ? (gameState.bombLimit || 3)
               : this.mode === 'KOTH' ? (gameState.kothLimit || 200)
               : gameState.scoreLimit,
      suddenStart: this.mode === 'CTF' ? !!gameState.ctfSuddenStart : false
    });
  }

  _restart() {
    this.scene.restart({
      mode: this.mode,
      selectedClass: this.selectedClass,
      levelIndex: this.levelIndex,
      contractId: this.contractId
    });
  }

  _sfxHover() {
    try {
      if (this.cache.audio.exists('sfx_hover') && !this.sound.locked)
        this.sound.play('sfx_hover', { volume: 0.18 });
    } catch (e) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  UPDATE — parallax + preview tick
  // ─────────────────────────────────────────────────────────────────────────
  update() {
    if (this.bg) {
      const p = this.input.activePointer;
      const nx = (p.x / this.cameras.main.width  - 0.5) * 2;
      const ny = (p.y / this.cameras.main.height - 0.5) * 2;
      this.bg.x = gameW(this) / 2 + nx * 28;
      this.bg.y = (720 - this.bg.displayHeight / 2) + ny * 16;
    }
    this._prevTick = ((this._prevTick | 0) + 1) % 4;
    if (this._prevTick !== 0) return;
    (this._previews || []).forEach(pv => {
      if (!pv || !pv.active || pv.dead) return;
      try {
        pv.updateBars();
        if (pv.updateGun) pv.updateGun();
        pv.healthBar.setVisible(false);
        pv.armorBar.setVisible(false);
        pv.nameText.setVisible(false);
      } catch (e) {}
    });
  }
}
