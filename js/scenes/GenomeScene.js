import { gameW, UX } from '../ui/layout.js';

import {
  geneDefinitions,
  GENE_ORDER,
  GENE_BRANCHES,
  getGeneLevel,
  genePoints,
  genePrereqMet,
  canLearnGene,
  learnGene
} from '../data/genes.js';

const NODE_W = 90;
const NODE_H = 90;

const POSITIONS = {
  second_wind: { x: 350, y: 180 },
  hot_blood:   { x: 350, y: 304 },
  light_legs:  { x: 350, y: 428 },
  tough_skin:  { x: 350, y: 552 },
  sharp_eye:   { x: 840, y: 200 },
  steady_hand: { x: 840, y: 340 },
  far_shot:    { x: 840, y: 480 }
};

export default class GenomeScene extends Phaser.Scene {
  constructor() {
    super('GenomeScene');
  }

  create() {
    const _cx = gameW(this) / 2;
    this.nodes = [];

    this._initBackground();
    this._initParticles();
    this._initHeader();
    this._drawBranchPanels();

    this.lines = this.add.graphics().setDepth(1);
    this.drawConnections();
    this.buildNodes();
    this.refreshHeader();

    this.tipBg = this.add.graphics().setDepth(100);
    this.tipTitle = this.add.text(0, 0, '', { fontSize: '15px', color: '#ffee88', fontStyle: 'bold' }).setDepth(101);
    this.tipText = this.add.text(0, 0, '', { fontSize: '12px', color: '#e0e0e0', lineSpacing: 4 }).setDepth(101);
    this.hideTip();

    // ESC для возврата в меню
    try {
      this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));
    } catch (e) {}

    this.events.once('shutdown', () => {
      this._particles = [];
    });
  }

  update(time, delta) {
    this._updateParticles(time, delta);
  }

  // Трёхступенчатый градиент фона как в Инвентаре и Бандах
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

  // Мягкие биолюминесцентные частицы на фоне
  _initParticles() {
    this._particles = [];
    const W = gameW(this);
    const count = 16;
    for (let i = 0; i < count; i++) {
      const g = this.add.graphics().setDepth(-8);
      const isRed = i % 2 === 0;
      const col = isRed ? 0xff6655 : 0x66ccff;
      const r = Phaser.Math.FloatBetween(1.2, 2.6);
      g.fillStyle(col, 1);
      g.fillCircle(0, 0, r);
      const p = {
        gfx: g,
        x: Phaser.Math.Between(40, W - 40),
        y: Phaser.Math.Between(70, 680),
        speed: Phaser.Math.FloatBetween(8, 24),
        baseAlpha: Phaser.Math.FloatBetween(0.12, 0.35),
        seed: Math.random() * 100
      };
      g.setPosition(p.x, p.y);
      g.setAlpha(p.baseAlpha);
      this._particles.push(p);
    }
  }

  _updateParticles(time, delta) {
    if (!this._particles || !this._particles.length) return;
    const dt = (delta || 16.6) / 1000;
    const W = gameW(this);
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      p.y -= p.speed * dt;
      p.x += Math.sin(time * 0.0012 + p.seed) * 0.35;
      if (p.y < 65) {
        p.y = 685;
        p.x = Phaser.Math.Between(40, W - 40);
      }
      p.gfx.setPosition(p.x, p.y);
    }
  }

  _initHeader() {
    const _cx = gameW(this) / 2;

    this.add.text(_cx, 22, 'ГЕНОМ', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(50);

    // Золотая черта с ромбом под заголовком
    const fl = this.add.graphics().setDepth(50);
    fl.lineStyle(2, 0xffd24a, 0.8);
    fl.lineBetween(_cx - 130, 42, _cx + 130, 42);
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

    const back = this.add.text(backX, backY, '← Назад', {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      fixedWidth: backW,
      padding: { top: 7, bottom: 7 },
      align: 'center'
    }).setOrigin(0.5).setDepth(60);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    back.on('pointerover', () => {
      renderBack(true);
      back.setStyle({ color: '#ffff55' });
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.2 });
        }
      } catch (e) {}
    });
    back.on('pointerout', () => {
      renderBack(false);
      back.setStyle({ color: '#ffffff' });
    });

    // Плашка с очками генома
    this._pointsCont = this.add.container(_cx, 74).setDepth(50);
    this._pointsBg = this.add.graphics();
    this.pointsText = this.add.text(0, 0, '', {
      fontSize: '14px',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this._pointsCont.add([this._pointsBg, this.pointsText]);
  }

  // Фоновые панели двух ветвей генома
  _drawBranchPanels() {
    GENE_BRANCHES.forEach((b, i) => {
      const panelCX = UX(this, i === 0 ? 395 : 885);
      const panelW = 420;
      const panelH = 556;
      const panelY = 114;

      const g = this.add.graphics().setDepth(-2);
      g.fillStyle(0x0e1022, 0.94);
      g.fillRoundedRect(panelCX - panelW / 2, panelY, panelW, panelH, 14);

      // Акцентная цветная шапка
      const colInt = Phaser.Display.Color.HexStringToColor(b.color).color;
      g.fillStyle(colInt, 0.22);
      g.fillRoundedRect(panelCX - panelW / 2 + 3, panelY + 3, panelW - 6, 42, { tl: 11, tr: 11, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 0.1);
      g.fillRoundedRect(panelCX - panelW / 2 + 3, panelY + 3, panelW - 6, 4, { tl: 11, tr: 11, bl: 0, br: 0 });

      // Рамка
      g.lineStyle(1.5, colInt, 0.6);
      g.strokeRoundedRect(panelCX - panelW / 2, panelY, panelW, panelH, 14);

      // Заклёпки
      const ro = 10;
      [[panelCX - panelW / 2 + ro, panelY + ro], [panelCX + panelW / 2 - ro, panelY + ro],
       [panelCX - panelW / 2 + ro, panelY + panelH - ro], [panelCX + panelW / 2 - ro, panelY + panelH - ro]].forEach(([rx, ry]) => {
        g.fillStyle(colInt, 0.8);
        g.fillCircle(rx, ry, 3);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(rx - 1, ry - 1, 1);
      });

      // Тексты шапки ветки
      this.add.text(panelCX, panelY + 16, b.name.toUpperCase(), {
        fontSize: '18px',
        color: b.color,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(2);

      this.add.text(panelCX, panelY + 32, b.desc, {
        fontSize: '11px',
        color: '#a0b0c8'
      }).setOrigin(0.5).setDepth(2);
    });
  }

  refreshHeader() {
    const pts = genePoints();
    const str = `Очки генома: ${pts}   (контракты из 5 легендарных скинов)`;
    this.pointsText.setText(str);
    this.pointsText.setColor(pts <= 0 ? '#8899aa' : '#ffee88');

    const tw = Math.max(340, this.pointsText.displayWidth + 36);
    const th = 28;
    this._pointsBg.clear();
    this._pointsBg.fillStyle(0x111326, 0.95);
    this._pointsBg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 8);
    this._pointsBg.lineStyle(1.5, pts > 0 ? 0xffd24a : 0x333d55, pts > 0 ? 0.9 : 0.6);
    this._pointsBg.strokeRoundedRect(-tw / 2, -th / 2, tw, th, 8);
  }

  // Неоновые светящиеся нейро-линии связи между узлами
  drawConnections() {
    this.lines.clear();

    GENE_ORDER.forEach(id => {
      const def = geneDefinitions[id];
      if (!def.prereq) return;
      const fromPos = POSITIONS[def.prereq];
      const toPos = POSITIONS[id];
      if (!fromPos || !toPos) return;

      const fromX = UX(this, fromPos.x) + NODE_W / 2;
      const fromY = fromPos.y + NODE_H;
      const toX = UX(this, toPos.x) + NODE_W / 2;
      const toY = toPos.y;

      const lvl = getGeneLevel(id);
      const prereqLvl = getGeneLevel(def.prereq);
      const active = prereqLvl >= 1;
      const branch = GENE_BRANCHES.find(b => b.id === def.branch) || {};
      const colInt = Phaser.Display.Color.HexStringToColor(branch.color || '#ffcc44').color;

      // Внешнее свечение
      this.lines.lineStyle(6, colInt, active ? 0.28 : 0.08);
      this.lines.beginPath();
      this.lines.moveTo(fromX, fromY);
      this.lines.lineTo(toX, toY);
      this.lines.strokePath();

      // Центральный проводник
      this.lines.lineStyle(2, active ? 0xffffff : 0x3a4a66, active ? 0.85 : 0.5);
      this.lines.beginPath();
      this.lines.moveTo(fromX, fromY);
      this.lines.lineTo(toX, toY);
      this.lines.strokePath();
    });
  }

  buildNodes() {
    this.nodes = [];
    GENE_ORDER.forEach(id => {
      this.nodes.push(this.createNode(id));
    });
  }

  createNode(id) {
    const def = geneDefinitions[id];
    const pos = POSITIONS[id];
    const x = UX(this, pos.x);
    const y = pos.y;
    const lvl = getGeneLevel(id);
    const isMax = lvl >= def.maxLevel;
    const learnable = canLearnGene(id);
    const prereqOk = genePrereqMet(id);
    const branch = GENE_BRANCHES.find(b => b.id === def.branch) || {};
    const branchCol = Phaser.Display.Color.HexStringToColor(branch.color || '#ffcc44').color;

    const cx = x + NODE_W / 2;
    const cy = y + NODE_H / 2;

    const cont = this.add.container(cx, cy).setDepth(10);
    const gfx = this.add.graphics();
    cont.add(gfx);

    const baseFill = isMax ? 0x16341f : learnable ? 0x3d3012 : lvl > 0 ? 0x16233d : 0x111322;
    const baseBorder = isMax ? 0x35d07f : learnable ? 0xffd24a : lvl > 0 ? branchCol : prereqOk ? 0x4a5570 : 0x242838;
    const glyphColor = isMax ? 0x77ee99 : learnable ? 0xffea77 : lvl > 0 ? 0xc8ddff : 0x5a6478;

    const drawNode = (hover) => {
      gfx.clear();

      // Внешний ореол для доступного к улучшению гена
      if (learnable) {
        gfx.lineStyle(4, 0xffd24a, hover ? 0.45 : 0.25);
        gfx.strokeRoundedRect(-NODE_W / 2 - 4, -NODE_H / 2 - 4, NODE_W + 8, NODE_H + 8, 14);
      }

      // Тело узла
      gfx.fillStyle(hover && learnable ? 0x544216 : baseFill, 0.98);
      gfx.fillRoundedRect(-NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 12);

      // Верхняя акцентная полоса
      gfx.fillStyle(isMax ? 0x35d07f : lvl > 0 ? branchCol : 0x3a4055, 0.85);
      gfx.fillRoundedRect(-NODE_W / 2 + 3, -NODE_H / 2 + 2, NODE_W - 6, 3, { tl: 8, tr: 8, bl: 0, br: 0 });

      // Рамка
      gfx.lineStyle(hover && learnable ? 2.5 : 2, hover && learnable ? 0xffea77 : baseBorder, 1);
      gfx.strokeRoundedRect(-NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 12);

      // Внутренний блик
      gfx.lineStyle(1, 0xffffff, hover ? 0.2 : 0.08);
      gfx.strokeRoundedRect(-NODE_W / 2 + 2, -NODE_H / 2 + 2, NODE_W - 4, NODE_H - 4, 10);

      // Глиф гена
      this._drawGlyph(gfx, id, 0, -8, 16, glyphColor);

      // Пипсы уровня прокачки
      for (let i = 0; i < def.maxLevel; i++) {
        const px = (i - (def.maxLevel - 1) / 2) * 14;
        const py = NODE_H / 2 - 12;
        if (i < lvl) {
          gfx.fillStyle(glyphColor, 1);
          gfx.fillCircle(px, py, 4);
          gfx.fillStyle(0xffffff, 0.8);
          gfx.fillCircle(px - 1, py - 1, 1.2);
        } else {
          gfx.fillStyle(0x0a0c16, 0.8);
          gfx.fillCircle(px, py, 3.5);
          gfx.lineStyle(1.2, glyphColor, 0.5);
          gfx.strokeCircle(px, py, 3.5);
        }
      }
    };

    drawNode(false);

    // Подпись названия гена
    const nameTag = this.add.text(0, NODE_H / 2 + 6, def.name, {
      fontSize: '12px',
      color: isMax ? '#88ee88' : learnable ? '#ffdd88' : lvl > 0 ? '#dde4ff' : '#8899aa',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    cont.add(nameTag);

    cont.setSize(NODE_W, NODE_H);
    cont.setInteractive({ useHandCursor: !!learnable });

    cont.on('pointerover', () => {
      drawNode(true);
      cont.y = cy - 2;
      this.showTip(id);
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.15 });
        }
      } catch (e) {}
    });

    cont.on('pointerout', () => {
      drawNode(false);
      cont.y = cy;
      this.hideTip();
    });

    if (learnable) {
      cont.on('pointerdown', () => {
        if (learnGene(id)) {
          try {
            if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
              this.sound.play('sfx_buy', { volume: 0.4 });
            }
          } catch (e) {}
          this.rebuild();
        }
      });
    }

    return { id, cont };
  }

  _drawGlyph(g, id, cx, cy, s, color) {
    g.fillStyle(color, 1);
    g.lineStyle(2, color, 1);
    const u = s / 15;
    switch (id) {
      case 'second_wind':
        g.fillCircle(cx - 5 * u, cy - 3 * u, 5.5 * u);
        g.fillCircle(cx + 5 * u, cy - 3 * u, 5.5 * u);
        g.fillTriangle(cx - 9.5 * u, cy, cx + 9.5 * u, cy, cx, cy + 9 * u);
        break;
      case 'hot_blood':
        g.fillCircle(cx, cy + 2 * u, 7 * u);
        g.fillTriangle(cx - 7 * u, cy + 1 * u, cx + 7 * u, cy + 1 * u, cx, cy - 11 * u);
        break;
      case 'light_legs':
        g.lineStyle(3 * u, color, 1);
        g.lineBetween(cx - 11 * u, cy - 6 * u, cx + 6 * u, cy - 6 * u);
        g.lineBetween(cx - 11 * u, cy, cx + 11 * u, cy);
        g.lineBetween(cx - 11 * u, cy + 6 * u, cx + 2 * u, cy + 6 * u);
        break;
      case 'tough_skin':
        g.fillRoundedRect(cx - 8 * u, cy - 9 * u, 16 * u, 12 * u, 3 * u);
        g.fillTriangle(cx - 8 * u, cy + 2 * u, cx + 8 * u, cy + 2 * u, cx, cy + 11 * u);
        break;
      case 'sharp_eye':
        g.strokeCircle(cx, cy, 9 * u);
        g.lineBetween(cx - 13 * u, cy, cx - 5 * u, cy);
        g.lineBetween(cx + 5 * u, cy, cx + 13 * u, cy);
        g.lineBetween(cx, cy - 13 * u, cx, cy - 5 * u);
        g.lineBetween(cx, cy + 5 * u, cx, cy + 13 * u);
        g.fillCircle(cx, cy, 1.8 * u);
        break;
      case 'steady_hand':
        g.strokeCircle(cx, cy, 10 * u);
        g.strokeCircle(cx, cy, 5 * u);
        g.fillCircle(cx, cy, 2 * u);
        break;
      case 'far_shot':
      default:
        g.lineStyle(4 * u, color, 1);
        g.beginPath();
        g.moveTo(cx - 9 * u, cy - 8 * u);
        g.lineTo(cx - 1 * u, cy);
        g.lineTo(cx - 9 * u, cy + 8 * u);
        g.moveTo(cx - 1 * u, cy - 8 * u);
        g.lineTo(cx + 7 * u, cy);
        g.lineTo(cx - 1 * u, cy + 8 * u);
        g.strokePath();
        break;
    }
  }

  statusText(id) {
    const def = geneDefinitions[id];
    const lvl = getGeneLevel(id);
    if (lvl >= def.maxLevel) return 'Изучено полностью ✓';
    if (!genePrereqMet(id)) return 'Требуется ген: «' + geneDefinitions[def.prereq].name + '»';
    if (genePoints() <= 0) return 'Требуется очко генома';
    return 'Клик для улучшения';
  }

  showTip(id) {
    if (!this.tipBg) return;
    const def = geneDefinitions[id];
    const lvl = getGeneLevel(id);
    const branch = GENE_BRANCHES.find(b => b.id === def.branch) || {};
    const branchCol = Phaser.Display.Color.HexStringToColor(branch.color || '#ffcc44').color;

    this.tipTitle.setText(def.name);
    const lines = [def.desc, `Уровень: ${lvl}/${def.maxLevel}`, this.statusText(id)];
    this.tipText.setText(lines.join('\n'));
    const w = 260;
    const h = 20 + 26 + lines.length * 18;

    this.tipBg.clear();
    this.tipBg.fillStyle(0x0e1124, 0.96);
    this.tipBg.fillRoundedRect(0, 0, w, h, 8);
    this.tipBg.lineStyle(1.5, branchCol, 0.9);
    this.tipBg.strokeRoundedRect(0, 0, w, h, 8);

    let px = this.input.activePointer.worldX + 14;
    let py = this.input.activePointer.worldY + 14;
    if (px + w > gameW(this) - 10) px = this.input.activePointer.worldX - 14 - w;
    if (py + h > 712) py = this.input.activePointer.worldY - 14 - h;
    if (px < 8) px = 8;
    if (py < 8) py = 8;

    this.tipBg.setPosition(px, py);
    this.tipTitle.setPosition(px + 12, py + 8);
    this.tipText.setPosition(px + 12, py + 34);
    this.tipBg.setVisible(true);
    this.tipTitle.setVisible(true);
    this.tipText.setVisible(true);
  }

  hideTip() {
    if (!this.tipBg) return;
    this.tipBg.setVisible(false);
    this.tipTitle.setVisible(false);
    this.tipText.setVisible(false);
  }

  rebuild() {
    this.nodes.forEach(n => {
      if (n.cont) n.cont.destroy();
    });
    this.nodes = [];
    this.drawConnections();
    this.buildNodes();
    this.refreshHeader();
  }
}
