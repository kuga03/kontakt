import { gameW, UX } from '../ui/layout.js?v=3';
import { gameState } from '../data/gameState.js?v=175';
import {
  skillDefinitions,
  SKILL_ORDER,
  getSkillLevel,
  skillPoints,
  prereqMet,
  canLearn,
  learnSkill,
  levelMet,
  reqLevel,
  skillResetCost,
  resetSkills
} from '../data/skills.js?v=169';

const BRANCHES = {
  body: { name: 'ТЕЛО', color: 0x2aff7a, css: '#2aff7a' },
  fire: { name: 'ОГОНЬ', color: 0xffcc44, css: '#ffcc44' },
  rage: { name: 'ТЕМП', color: 0xff5555, css: '#ff5555' }
};

// Живая лоза вместо сетки 4-4-4: три ветви снизу вверх.
// r — калибр узла (важные большие), b — ветвь (цвет).
const NODES = {
  vitality: { x: 370, y: 560, r: 38, b: 'body' },
  medic:    { x: 300, y: 410, r: 28, b: 'body' },
  regen:    { x: 300, y: 250, r: 38, b: 'body' },
  armor:    { x: 490, y: 440, r: 26, b: 'body' },
  reload:   { x: 560, y: 560, r: 38, b: 'fire' },
  assault:  { x: 620, y: 410, r: 28, b: 'fire' },
  headshot: { x: 620, y: 250, r: 38, b: 'fire' },
  ammo:     { x: 640, y: 540, r: 24, b: 'fire' },
  sprint:   { x: 850, y: 560, r: 38, b: 'rage' },
  accuracy: { x: 810, y: 410, r: 28, b: 'rage' },
  frag:     { x: 770, y: 520, r: 22, b: 'rage' },
  smoke:    { x: 940, y: 500, r: 22, b: 'rage' }
};

export default class SkillsScene extends Phaser.Scene {
  constructor() {
    super('SkillsScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#080914');

    // Атмосферный темный градиент фона (в стиле Инвентаря / Банд)
    try {
      const bgb = this.add.graphics();
      bgb.fillStyle(0x0f1224, 1);
      bgb.fillRect(0, 0, gameW(this), 240);
      bgb.fillStyle(0x0a0c1a, 1);
      bgb.fillRect(0, 240, gameW(this), 240);
      bgb.fillStyle(0x060710, 1);
      bgb.fillRect(0, 480, gameW(this), 240);
    } catch (e) {}

    this.activeButton = null;
    const _cx = gameW(this) / 2;

    this.add.text(_cx, 40, 'БОЕВАЯ ПОДГОТОВКА', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Золотая черта с ромбом под заголовком
    try {
      const fl = this.add.graphics();
      fl.lineStyle(2, 0xffd24a, 0.75);
      fl.lineBetween(_cx - 120, 64, _cx + 120, 64);
      fl.fillStyle(0xffd24a, 0.85);
      const dd = 5;
      fl.fillPoints([
        new Phaser.Geom.Point(_cx, 64 - dd), new Phaser.Geom.Point(_cx + dd, 64),
        new Phaser.Geom.Point(_cx, 64 + dd), new Phaser.Geom.Point(_cx - dd, 64)
      ], true);
    } catch (e) {}

    this.pointsText = this.add.text(_cx, 90, '', {
      fontSize: '18px',
      color: '#ffee88'
    }).setOrigin(0.5);

    // Сброс навыков с подтверждением: 1-й бесплатно, 2-й — 5000,
    // 3-й — 100000, дальше — бесконечно по 100000. Очки возвращаются в пул.
    // На платном подтверждении — цена и значок монеты.
    this._resetSkillsArmed = false;
    this._resetSkillsCoin = null;
    {
      const btn = this.add.text(_cx, 668, '', {
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      const btnFr = this.add.graphics();
      const paint = () => {
        const cost = skillResetCost();
        if (coin) coin.setVisible(false);
        btnFr.clear();
        let bw = 320, bh = 36, br = 8;
        if (cost == null) {
          btnFr.fillStyle(0x141420, 0.9);
          btnFr.fillRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, bh, br);
          btnFr.lineStyle(1, 0x222238, 1);
          btnFr.strokeRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, bh, br);
          btn.setText('Сброс недоступен');
          btn.setColor('#666677');
          btn.disableInteractive();
        } else if (!this._resetSkillsArmed) {
          btnFr.fillStyle(0x252a40, 0.95);
          btnFr.fillRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, bh, br);
          btnFr.fillStyle(0xffffff, 0.1);
          btnFr.fillRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, 4, { tl: br, tr: br, bl: 0, br: 0 });
          btnFr.lineStyle(1.5, 0x4a5a88, 1);
          btnFr.strokeRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, bh, br);
          btn.setText(cost > 0
            ? `Сбросить подготовку · ${cost.toLocaleString('ru-RU')}`
            : 'Сбросить подготовку');
          btn.setColor('#ffffff');
          btn.setInteractive({ useHandCursor: true });
        } else {
          btnFr.fillStyle(0x4a1e24, 0.95);
          btnFr.fillRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, bh, br);
          btnFr.fillStyle(0xffffff, 0.15);
          btnFr.fillRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, 4, { tl: br, tr: br, bl: 0, br: 0 });
          btnFr.lineStyle(2, 0xd05555, 1);
          btnFr.strokeRoundedRect(_cx - bw / 2, 668 - bh / 2, bw, bh, br);
          btn.setText(cost > 0
            ? `Точно? Сброс за ${cost.toLocaleString('ru-RU')}`
            : 'Точно? Жми ещё раз');
          btn.setColor('#ffb0b0');
          if (coin && cost > 0) {
            coin.setVisible(true);
            coin.setPosition(_cx + btn.displayWidth / 2 + 18, 668);
          }
        }
      };
      this._paintResetSkills = paint;
      paint();
      btn.on('pointerdown', () => {
        if (skillResetCost() == null) return;
        if (!this._resetSkillsArmed) {
          this._resetSkillsArmed = true;
          paint();
          return;
        }
        this._resetSkillsArmed = false;
        const r = resetSkills();
        if (!r.ok) {
          btn.setText(r.reason === 'coins' ? 'Не хватает монет!' : 'Нечего сбрасывать');
          btn.setColor('#ff5555');
          this.time.delayedCall(1200, () => paint());
          return;
        }
        this.rebuild();
        paint();
      });
      btn.on('pointerover', () => {
        if (skillResetCost() != null) btn.setStyle({ color: '#ffff55' });
      });
      btn.on('pointerout', () => paint());
      this._resetSkillsBtn = btn;
    }

    this.add.text(_cx, 118, 'Клик — вложить очко подготовки; очки даются за каждый уровень', {
      fontSize: '14px',
      color: '#9aacdd'
    }).setOrigin(0.5);

    this.lines = this.add.graphics();
    this.lines.setDepth(-1);

    this.drawConnections();
    this.buildNodes();
    this.refreshHeader();

    // Тултип значка (как в магазине).
    this.tipBg = this.add.graphics().setDepth(100);
    this.tipTitle = this.add.text(0, 0, '', { fontSize: '16px', color: '#ffee88' }).setDepth(101);
    this.tipText = this.add.text(0, 0, '', {
      fontSize: '13px', color: '#e0e0e0', lineSpacing: 4,
      wordWrap: { width: 226 }
    }).setDepth(101);
    this.hideTip();

    // Кнопка Назад в стиле меню Банды / Инвентаря
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

    const back = this.add.text(backX, backY, '← Назад', {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      fixedWidth: backW,
      padding: { top: 7, bottom: 7 },
      align: 'center'
    }).setOrigin(0.5).setDepth(60);

    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
    back.on('pointerover', () => {
      renderBack(true);
      back.setStyle({ color: '#ffff55' });
    });
    back.on('pointerout', () => {
      renderBack(false);
      back.setStyle({ color: '#ffffff' });
    });
  }

  refreshHeader() {
    const pts = skillPoints();
    this.pointsText.setText(`Очки подготовки: ${pts}   Уровень игрока: ${gameState.level}`);
    this.pointsText.setColor(pts <= 0 ? '#888899' : '#ffee88');
  }

  drawConnections() {
    this.lines.clear();
    SKILL_ORDER.forEach(id => {
      const def = skillDefinitions[id];
      if (!def.prereq) return;
      const from = NODES[def.prereq];
      const to = NODES[id];
      if (!from || !to) return;
      // Лоза цветом ветви: вкачано — яркая с ореолом, предок открыт —
      // приглушённая, иначе тёмная. Кривая с боковым выгибом для органики.
      const bc = (BRANCHES[to.b] || {}).color || 0x555566;
      const childLvl = getSkillLevel(id);
      const parLvl = getSkillLevel(def.prereq);
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const bend = 26;
      const mx = (from.x + to.x) / 2 + nx * bend;
      const my = (from.y + to.y) / 2 + ny * bend;
      // Усекаем концы до краёв кругов, чтобы не залезать под узлы.
      const ux = dx / len, uy = dy / len;
      const x1 = from.x + ux * (from.r - 2), y1 = from.y + uy * (from.r - 2);
      const x2 = to.x - ux * (to.r - 2), y2 = to.y - uy * (to.r - 2);
      // Кривую сэмплируем отрезками вручную: quadraticCurveTo в Graphics нет.
      const drawCurve = (w, col, alpha) => {
        this.lines.lineStyle(w, col, alpha);
        let px = x1, py = y1;
        const N = 14;
        for (let s = 1; s <= N; s++) {
          const t = s / N, u = 1 - t;
          const qx = u * u * x1 + 2 * u * t * mx + t * t * x2;
          const qy = u * u * y1 + 2 * u * t * my + t * t * y2;
          this.lines.lineBetween(px, py, qx, qy);
          px = qx; py = qy;
        }
      };
      if (childLvl > 0) {
        drawCurve(10, bc, 0.22);
        drawCurve(5, bc, 0.95);
      } else if (parLvl > 0) {
        drawCurve(4, bc, 0.45);
      } else {
        drawCurve(2, 0x2a2a44, 1);
      }
    });
  }

  buildNodes() {
    this.nodes = [];
    SKILL_ORDER.forEach(id => {
      const node = this.createNode(id);
      this.nodes.push(node);
    });
  }

  createNode(id) {
    const def = skillDefinitions[id];
    const pos = NODES[id] || { x: 640, y: 400, r: 28, b: 'fire' };
    const x = pos.x;
    const y = pos.y;
    const r = pos.r || 28;
    const bc = (BRANCHES[pos.b] || {}).color || 0x555566;
    const lvl = getSkillLevel(id);
    const isMax = lvl >= def.maxLevel;
    const learnable = canLearn(id);

    const node = { id, gfx: this.add.graphics().setDepth(1), clickable: false };
    // Кольцо цветом ветви (серое — закрыт), тёмная сердцевина, ореол живых.
    const ringColor = isMax || lvl > 0 ? bc : learnable ? bc : 0x3a3a4e;
    const glyphColor = isMax || lvl > 0 ? bc : learnable ? bc : 0x555566;
    node.draw = (hover) => {
      node.gfx.clear();
      if (isMax || lvl > 0 || learnable) {
        node.gfx.fillStyle(bc, hover ? 0.22 : 0.13);
        node.gfx.fillCircle(x, y, r + 9);
      }
      node.gfx.fillStyle(0x14141f, 1);
      node.gfx.fillCircle(x, y, r);
      // Верхний блик дугой — объём.
      node.gfx.lineStyle(2, 0xffffff, 0.10);
      node.gfx.beginPath();
      node.gfx.arc(x, y, r - 5, Math.PI * 1.15, Math.PI * 1.85, false);
      node.gfx.strokePath();
      node.gfx.lineStyle(hover && learnable ? 4 : 3, hover && learnable ? 0xffffff : ringColor, 1);
      node.gfx.strokeCircle(x, y, r);
      this._drawGlyph(node.gfx, id, x, y - 3, r * 0.55, glyphColor);
    };
    node.draw(false);
    // Бейдж «3/9» под узлом: жёлтый только у максимума,
    // у вкачанных не до конца — бело-серый.
    const badge = this.add.text(x, y + r + 13, `${lvl}/${def.maxLevel}`, {
      fontSize: '13px',
      color: isMax ? '#ffcc44' : lvl > 0 ? '#c8ccd8' : '#666677',
      fontStyle: 'bold',
      backgroundColor: '#0a0a18',
      padding: { left: 6, right: 6, top: 2, bottom: 2 }
    }).setOrigin(0.5).setDepth(2);
    node.badge = badge;

    const hitR = r * 2 + 18;
    const hit = this.add.rectangle(x, y, hitR, hitR, 0xffffff, learnable ? 0 : 0.001)
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
      node.clickable = true;
      hit.on('pointerdown', () => {
        if (learnSkill(id)) {
          this.rebuild();
        }
      });
    }
    node.hit = hit;
    return node;
  }

  // Мини-пиктограмма навыка векторной графикой (без артов).
  _drawGlyph(g, id, cx, cy, s, color) {
    g.fillStyle(color, 1);
    g.lineStyle(2, color, 1);
    const u = s / 15;
    switch (id) {
      case 'vitality': // сердце
        g.fillCircle(cx - 5 * u, cy - 3 * u, 5.5 * u);
        g.fillCircle(cx + 5 * u, cy - 3 * u, 5.5 * u);
        g.fillTriangle(cx - 9.5 * u, cy, cx + 9.5 * u, cy, cx, cy + 9 * u);
        break;
      case 'reload': // двойной шеврон (скорость)
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
      case 'ammo': // патрон
        g.fillRoundedRect(cx - 4 * u, cy - 9 * u, 8 * u, 12 * u, 2 * u);
        g.fillTriangle(cx - 4 * u, cy - 9 * u, cx + 4 * u, cy - 9 * u, cx, cy - 14 * u);
        break;
      case 'sprint': // ветер
        g.lineStyle(3 * u, color, 1);
        g.lineBetween(cx - 11 * u, cy - 6 * u, cx + 6 * u, cy - 6 * u);
        g.lineBetween(cx - 11 * u, cy, cx + 11 * u, cy);
        g.lineBetween(cx - 11 * u, cy + 6 * u, cx + 2 * u, cy + 6 * u);
        break;
      case 'armor': // щит
        g.fillRoundedRect(cx - 8 * u, cy - 9 * u, 16 * u, 12 * u, 3 * u);
        g.fillTriangle(cx - 8 * u, cy + 2 * u, cx + 8 * u, cy + 2 * u, cx, cy + 11 * u);
        break;
      case 'medic': // крест
        g.fillRect(cx - 3 * u, cy - 10 * u, 6 * u, 20 * u);
        g.fillRect(cx - 10 * u, cy - 3 * u, 20 * u, 6 * u);
        break;
      case 'assault': // звезда-вспышка
        g.fillTriangle(cx, cy - 12 * u, cx + 3 * u, cy - 3 * u, cx + 11 * u, cy - 6 * u);
        g.fillTriangle(cx + 11 * u, cy - 6 * u, cx + 4 * u, cy + 2 * u, cx + 7 * u, cy + 10 * u);
        g.fillTriangle(cx + 7 * u, cy + 10 * u, cx, cy + 4 * u, cx - 7 * u, cy + 10 * u);
        g.fillTriangle(cx - 7 * u, cy + 10 * u, cx - 4 * u, cy + 2 * u, cx - 11 * u, cy - 6 * u);
        g.fillTriangle(cx - 11 * u, cy - 6 * u, cx - 3 * u, cy - 3 * u, cx, cy - 12 * u);
        break;
      case 'accuracy': // мишень
        g.strokeCircle(cx, cy, 10 * u);
        g.strokeCircle(cx, cy, 5 * u);
        g.fillCircle(cx, cy, 2 * u);
        break;
      case 'regen': // капля
        g.fillCircle(cx, cy + 2 * u, 7 * u);
        g.fillTriangle(cx - 7 * u, cy + 1 * u, cx + 7 * u, cy + 1 * u, cx, cy - 11 * u);
        break;
      case 'frag': // граната: корпус + рычаг + кольцо
        g.fillRoundedRect(cx - 7 * u, cy - 4 * u, 14 * u, 12 * u, 3 * u);
        g.lineStyle(3 * u, color, 1);
        g.lineBetween(cx - 7 * u, cy - 4 * u, cx - 11 * u, cy - 10 * u);
        g.strokeCircle(cx + 9 * u, cy - 9 * u, 3.5 * u);
        break;
      case 'smoke': // дым: три клуба над базой
        g.fillCircle(cx - 8 * u, cy + 2 * u, 5 * u);
        g.fillCircle(cx, cy - 2 * u, 6.5 * u);
        g.fillCircle(cx + 8 * u, cy + 2 * u, 5 * u);
        g.fillRect(cx - 11 * u, cy + 7 * u, 22 * u, 3 * u);
        break;
      case 'headshot': // прицел
      default:
        g.strokeCircle(cx, cy, 9 * u);
        g.lineBetween(cx - 13 * u, cy, cx - 5 * u, cy);
        g.lineBetween(cx + 5 * u, cy, cx + 13 * u, cy);
        g.lineBetween(cx, cy - 13 * u, cx, cy - 5 * u);
        g.lineBetween(cx, cy + 5 * u, cx, cy + 13 * u);
        g.fillCircle(cx, cy, 1.8 * u);
        break;
    }
  }

  // Тултип значка: что даёт навык. Текст с переносами и замером —
  // длинные описания больше не вылезают из бокса.
  showTip(id) {
    if (!this.tipBg) return;
    const def = skillDefinitions[id];
    const lvl = getSkillLevel(id);
    this.tipTitle.setText(def.name);
    const lines = [def.desc];
    const st = this.statusText(id);
    if (st) lines.push(st);
    this.tipText.setText(lines.join('\n'));
    const w = 250;
    const h = 20 + 26 + this.tipText.displayHeight + 10;
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

  statusText(id) {
    const def = skillDefinitions[id];
    const lvl = getSkillLevel(id);
    if (lvl >= def.maxLevel) return 'макс. уровень';
    if (!levelMet(id)) return `нужен уровень: ${reqLevel(id)}`;
    if (!prereqMet(id)) return 'требуется: «' + skillDefinitions[def.prereq].name + '»';
    // Готов к улучшению — отдельной строки нет (клик и так работает).
    return '';
  }

  rebuild() {
    this.nodes.forEach(n => {
      if (n.gfx) n.gfx.destroy();
      if (n.hit) n.hit.destroy();
      if (n.badge) n.badge.destroy();
    });
    this.nodes = [];
    this.buildNodes();
    this.refreshHeader();
  }
}