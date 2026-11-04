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

const NODE_W = 88;
const NODE_H = 88;

// Дерево как в навыках (п.29): квадратные значки с глифами и пипсами,
// описание — в тултипе. Две ветки колонками.
const POSITIONS = {
  second_wind: { x: 350, y: 180 },
  hot_blood: { x: 350, y: 300 },
  light_legs: { x: 350, y: 420 },
  tough_skin: { x: 350, y: 540 },
  sharp_eye: { x: 840, y: 180 },
  steady_hand: { x: 840, y: 300 },
  far_shot: { x: 840, y: 420 }
};

export default class GenomeScene extends Phaser.Scene {
  constructor() {
    super('GenomeScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a2a');
    this.nodes = [];
    const _cx = gameW(this) / 2;

    this.add.text(_cx, 36, 'ГЕНОМ', {
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.pointsText = this.add.text(_cx, 76, '', {
      fontSize: '20px',
      color: '#ffee88'
    }).setOrigin(0.5);

    GENE_BRANCHES.forEach((b, i) => {
      const x = i === 0 ? 400 : 880;
      this.add.text(x, 125, b.name, {
        fontSize: '22px',
        color: b.color,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(x, 148, b.desc, {
        fontSize: '12px',
        color: '#99aacc'
      }).setOrigin(0.5);
    });

    this.lines = this.add.graphics();
    this.lines.setDepth(-1);
    this.drawConnections();
    this.buildNodes();
    this.refreshHeader();

    this.tipBg = this.add.graphics().setDepth(100);
    this.tipTitle = this.add.text(0, 0, '', { fontSize: '16px', color: '#ffee88' }).setDepth(101);
    this.tipText = this.add.text(0, 0, '', { fontSize: '13px', color: '#e0e0e0', lineSpacing: 4 }).setDepth(101);
    this.hideTip();

    const back = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#553333',
      padding: 8
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    back.on('pointerover', () => back.setStyle({ color: '#ffff55' }));
    back.on('pointerout', () => back.setStyle({ color: '#ffffff' }));
  }

  refreshHeader() {
    const pts = genePoints();
    this.pointsText.setText(`Очки генома: ${pts}   (контракты из 5 легендарных скинов)`);
    this.pointsText.setColor(pts <= 0 ? '#888899' : '#ffee88');
  }

  drawConnections() {
    this.lines.clear();
    this.lines.lineStyle(2, 0x3a4a7a, 1);
    GENE_ORDER.forEach(id => {
      const def = geneDefinitions[id];
      if (!def.prereq) return;
      const from = POSITIONS[def.prereq];
      const to = POSITIONS[id];
      if (!from || !to) return;
      this.lines.beginPath();
      if (from.x === to.x) {
        // Вертикальная связь: низ → верх.
        this.lines.moveTo(from.x + NODE_W / 2, from.y + NODE_H);
        this.lines.lineTo(to.x + NODE_W / 2, to.y);
      } else {
        this.lines.moveTo(from.x + NODE_W / 2, from.y + NODE_H / 2);
        this.lines.lineTo(to.x - NODE_W / 2, to.y + NODE_H / 2);
      }
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
    const x = pos.x;
    const y = pos.y;
    const lvl = getGeneLevel(id);
    const isMax = lvl >= def.maxLevel;
    const learnable = canLearnGene(id);
    const prereqOk = genePrereqMet(id);
    const branch = GENE_BRANCHES.find(b => b.id === def.branch) || {};
    const accent = branch.color || '#ffcc44';

    const node = { id, gfx: this.add.graphics().setDepth(1) };
    const cx = x + NODE_W / 2;
    const cy = y + NODE_H / 2;
    const baseFill = isMax ? 0x224422 : learnable ? 0x54450f : lvl > 0 ? 0x223355 : 0x232333;
    const baseBorder = isMax ? 0x55cc55 : learnable ? 0xffcc44 : lvl > 0 ? 0x5588cc : prereqOk ? 0x555566 : 0x3a3a44;
    const glyphColor = isMax ? 0x88ee88 : learnable ? 0xffdd55 : lvl > 0 ? 0xaaccff : 0x666677;
    node.draw = (hover) => {
      node.gfx.clear();
      node.gfx.fillStyle(hover && learnable ? 0x6b5a1a : baseFill, 1);
      node.gfx.fillRoundedRect(x, y, NODE_W, NODE_H, 12);
      node.gfx.lineStyle(hover && learnable ? 3 : 2, hover && learnable ? 0xffe066 : baseBorder, 1);
      node.gfx.strokeRoundedRect(x, y, NODE_W, NODE_H, 12);
      this._drawGlyph(node.gfx, id, cx, cy - 8, 15, glyphColor);
      for (let i = 0; i < def.maxLevel; i++) {
        const px = cx + (i - (def.maxLevel - 1) / 2) * 13;
        const py = y + NODE_H - 11;
        if (i < lvl) {
          node.gfx.fillStyle(glyphColor, 1);
          node.gfx.fillCircle(px, py, 4);
        } else {
          node.gfx.lineStyle(1, glyphColor, 0.6);
          node.gfx.strokeCircle(px, py, 4);
        }
      }
    };
    node.draw(false);

    if (isMax) {
      node.gfx.lineStyle(1, 0x55cc55, 1);
      node.gfx.strokeRoundedRect(x + 4, y + 4, NODE_W - 8, NODE_H - 8, 7);
    }

    const nameTag = this.add.text(cx, y + NODE_H + 4, def.name, {
      fontSize: '12px',
      color: isMax ? '#88ee88' : learnable ? '#ffdd88' : lvl > 0 ? '#dde4ff' : '#888899',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(3);

    const hit = this.add.rectangle(cx, cy, NODE_W, NODE_H, 0xffffff, learnable ? 0 : 0.001)
      .setDepth(2)
      .setInteractive({ useHandCursor: !!learnable });
    hit.on('pointerover', () => {
      node.draw(true);
      this.showTip(id);
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.2 });
        }
      } catch (e) { /* noop */ }
    });
    hit.on('pointerout', () => {
      node.draw(false);
      this.hideTip();
    });
    if (learnable) {
      hit.on('pointerdown', () => {
        if (learnGene(id)) {
          this.rebuild();
        }
      });
    }
    node.hit = hit;
    node.texts = [nameTag];
    return node;
  }

  // Мини-пиктограммы веток генома векторной графикой.
  _drawGlyph(g, id, cx, cy, s, color) {
    g.fillStyle(color, 1);
    g.lineStyle(2, color, 1);
    const u = s / 15;
    switch (id) {
      case 'second_wind': // сердце
        g.fillCircle(cx - 5 * u, cy - 3 * u, 5.5 * u);
        g.fillCircle(cx + 5 * u, cy - 3 * u, 5.5 * u);
        g.fillTriangle(cx - 9.5 * u, cy, cx + 9.5 * u, cy, cx, cy + 9 * u);
        break;
      case 'hot_blood': // капля
        g.fillCircle(cx, cy + 2 * u, 7 * u);
        g.fillTriangle(cx - 7 * u, cy + 1 * u, cx + 7 * u, cy + 1 * u, cx, cy - 11 * u);
        break;
      case 'light_legs': // ветер
        g.lineStyle(3 * u, color, 1);
        g.lineBetween(cx - 11 * u, cy - 6 * u, cx + 6 * u, cy - 6 * u);
        g.lineBetween(cx - 11 * u, cy, cx + 11 * u, cy);
        g.lineBetween(cx - 11 * u, cy + 6 * u, cx + 2 * u, cy + 6 * u);
        break;
      case 'tough_skin': // щит
        g.fillRoundedRect(cx - 8 * u, cy - 9 * u, 16 * u, 12 * u, 3 * u);
        g.fillTriangle(cx - 8 * u, cy + 2 * u, cx + 8 * u, cy + 2 * u, cx, cy + 11 * u);
        break;
      case 'sharp_eye': // прицел
        g.strokeCircle(cx, cy, 9 * u);
        g.lineBetween(cx - 13 * u, cy, cx - 5 * u, cy);
        g.lineBetween(cx + 5 * u, cy, cx + 13 * u, cy);
        g.lineBetween(cx, cy - 13 * u, cx, cy - 5 * u);
        g.lineBetween(cx, cy + 5 * u, cx, cy + 13 * u);
        g.fillCircle(cx, cy, 1.8 * u);
        break;
      case 'steady_hand': // мишень
        g.strokeCircle(cx, cy, 10 * u);
        g.strokeCircle(cx, cy, 5 * u);
        g.fillCircle(cx, cy, 2 * u);
        break;
      case 'far_shot': // шеврон
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
    if (lvl >= def.maxLevel) return 'изучено полностью';
    if (!genePrereqMet(id)) return 'нужен ген: «' + geneDefinitions[def.prereq].name + '»';
    if (genePoints() <= 0) return 'нужно очко генома';
    return 'улучшить';
  }

  showTip(id) {
    if (!this.tipBg) return;
    const def = geneDefinitions[id];
    const lvl = getGeneLevel(id);
    this.tipTitle.setText(def.name);
    const lines = [def.desc, `Уровень: ${lvl}/${def.maxLevel}`, this.statusText(id)];
    this.tipText.setText(lines.join('\n'));
    const w = 250;
    const h = 20 + 26 + lines.length * 18;
    this.tipBg.clear();
    this.tipBg.fillStyle(0x000000, 0.9);
    this.tipBg.fillRoundedRect(0, 0, w, h, 8);
    this.tipBg.lineStyle(1, 0xffcc44);
    this.tipBg.strokeRoundedRect(0, 0, w, h, 8);
    let px = this.input.activePointer.worldX + 12;
    let py = this.input.activePointer.worldY + 12;
    if (px + w > 1272) px = this.input.activePointer.worldX - 12 - w;
    if (py + h > 712) py = this.input.activePointer.worldY - 12 - h;
    if (px < 8) px = 8;
    if (py < 8) py = 8;
    this.tipBg.setPosition(px, py);
    this.tipTitle.setPosition(px + 10, py + 8);
    this.tipText.setPosition(px + 10, py + 34);
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
      if (n.gfx) n.gfx.destroy();
      if (n.hit) n.hit.destroy();
      (n.texts || []).forEach(t => t && t.destroy());
    });
    this.nodes = [];
    this.buildNodes();
    this.refreshHeader();
  }
}
