import { gameW, UX } from '../ui/layout.js';
import { gameState } from '../data/gameState.js';
import { ACHIEVEMENTS, achievementProgress, isClaimed, claimAchievement } from '../data/achievements.js';

// Достижения цепочками: виден только текущий тир.
// Забрал награду — на его месте появился следующий.
const CHAINS = [
  ['fighter_1', 'fighter_2', 'fighter_3', 'fighter_4', 'fighter_5'],
  ['sniper_1', 'sniper_2', 'sniper_3'],
  ['assault_1', 'assault_2', 'assault_3'],
  ['tank_1', 'tank_2'],
  ['medic_1', 'medic_2'],
  ['winner_1', 'winner_2', 'winner_3', 'winner_4', 'winner_5'],
  ['courier_1', 'courier_2', 'courier_3', 'courier_4', 'courier_5'],
  ['campaign_1', 'campaign_2', 'campaign_3'],
  ['azart_1', 'azart_2', 'azart_3'],
  ['growth_1', 'growth_2', 'growth_3'],
  ['style_1', 'style_2', 'style_3'],
  ['rich', 'rich_2'],
  ['genome_1', 'genome_2']
];

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('AchievementsScene');
  }

  create() {
    const _cx = gameW(this) / 2;
    this._initBackground();
    this._initHeader();
    this._initProgressCard();
    this._drawCards();

    // ESC для возврата в меню
    try {
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
    } catch (e) {}
  }

  // Трёхступенчатый градиент фона как во всех обновлённых сценах
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

  _initHeader() {
    const _cx = gameW(this) / 2;

    this.add.text(_cx, 22, 'ДОСТИЖЕНИЯ', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(50);

    // Золотая черта с ромбом под заголовком
    const fl = this.add.graphics().setDepth(50);
    fl.lineStyle(2, 0xffd24a, 0.8);
    fl.lineBetween(_cx - 140, 42, _cx + 140, 42);
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
  }

  _initProgressCard() {
    const _cx = gameW(this) / 2;
    const validClaimed = (gameState.achievements || []).filter(id =>
      ACHIEVEMENTS.some(a => a.id === id));
    const got = validClaimed.length;
    const total = ACHIEVEMENTS.length;
    const ratio = Math.min(1, Math.max(0, got / Math.max(1, total)));
    const pct = Math.round(ratio * 100);

    const cardW = 540;
    const cardH = 34;
    const cardY = 76;

    const g = this.add.graphics().setDepth(20);
    g.fillStyle(0x0e1124, 0.95);
    g.fillRoundedRect(_cx - cardW / 2, cardY - cardH / 2, cardW, cardH, 8);
    g.lineStyle(1.5, 0x334466, 0.8);
    g.strokeRoundedRect(_cx - cardW / 2, cardY - cardH / 2, cardW, cardH, 8);

    // Подпись
    this.add.text(_cx - cardW / 2 + 16, cardY, `ВЫПОЛНЕНО: ${got} / ${total} (${pct}%)`, {
      fontSize: '13px',
      color: '#ffd24a',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(21);

    // Прогресс бар
    const barW = 200;
    const barH = 12;
    const barX = _cx + cardW / 2 - 16 - barW;
    const barY = cardY - barH / 2;

    g.fillStyle(0x070914, 0.9);
    g.fillRoundedRect(barX, barY, barW, barH, 6);
    g.lineStyle(1, 0x222a44, 1);
    g.strokeRoundedRect(barX, barY, barW, barH, 6);

    const fillW = Math.max(6, Math.round(barW * ratio));
    if (fillW > 0) {
      g.fillStyle(0xffd24a, 1);
      g.fillRoundedRect(barX, barY, fillW, barH, 6);
      g.fillStyle(0xffffff, 0.25);
      g.fillRoundedRect(barX, barY, fillW, 4, { tl: 6, tr: 6, bl: 0, br: 0 });
    }
  }

  _drawCards() {
    const _cx = gameW(this) / 2;
    const rows = [];
    CHAINS.forEach(chain => {
      const claimedCount = chain.filter(id => isClaimed(id)).length;
      const nextId = chain.find(id => !isClaimed(id));
      if (nextId) {
        const a = ACHIEVEMENTS.find(v => v.id === nextId);
        if (a) rows.push({ a, got: claimedCount, total: chain.length });
      } else {
        const a = ACHIEVEMENTS.find(v => v.id === chain[chain.length - 1]);
        if (a) rows.push({ a, got: chain.length, total: chain.length, chainDone: true });
      }
    });

    // 2 колонки: 7 слева, 6 справа
    const colW = 580;
    const cardH = 68;
    const gapY = 8;
    const startY = 112;

    const leftCX = UX(this, _cx - colW / 2 - 10);
    const rightCX = UX(this, _cx + colW / 2 + 10);

    rows.forEach((row, i) => {
      const isLeft = i < 7;
      const slotIdx = isLeft ? i : i - 7;
      const cx = isLeft ? leftCX : rightCX;
      const cy = startY + slotIdx * (cardH + gapY) + cardH / 2;
      this._createCard(cx, cy, colW, cardH, row.a, row);
    });
  }

  _createCard(cx, cy, w, h, a, row) {
    const claimed = isClaimed(a.id);
    const [cur, need] = achievementProgress(a.id);
    const done = cur >= need || (row && row.chainDone);

    const cont = this.add.container(cx, cy).setDepth(15);

    // Основная фоновая плашка
    const bg = this.add.graphics();
    cont.add(bg);

    const baseFill = claimed ? 0x0f2416 : done ? 0x2b220d : 0x0e1124;
    const baseBorder = claimed ? 0x33aa55 : done ? 0xffd24a : 0x272d42;

    const drawCardBg = (hot) => {
      bg.clear();
      bg.fillStyle(hot && done && !claimed ? 0x3d3012 : baseFill, 0.94);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);

      // Верхний зеркальный блик
      bg.fillStyle(0xffffff, hot ? 0.12 : 0.05);
      bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, 6, { tl: 8, tr: 8, bl: 0, br: 0 });

      // Рамка
      bg.lineStyle(hot && done ? 2 : 1.5, hot && done ? 0xffea77 : baseBorder, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    drawCardBg(false);

    // Левая иконка-значок (44x44)
    const iconX = -w / 2 + 32;
    const iconBox = this.add.graphics();
    iconBox.fillStyle(claimed ? 0x163d22 : done ? 0x473814 : 0x14182e, 1);
    iconBox.fillRoundedRect(iconX - 22, -22, 44, 44, 8);
    iconBox.lineStyle(1.5, claimed ? 0x45cc6a : done ? 0xffd24a : 0x3a4566, 0.9);
    iconBox.strokeRoundedRect(iconX - 22, -22, 44, 44, 8);
    cont.add(iconBox);

    const iconGlyph = this.add.text(iconX, 0, claimed ? '🏆' : done ? '🎁' : '🔒', {
      fontSize: '22px'
    }).setOrigin(0.5);
    cont.add(iconGlyph);

    // Текстовая зона слева
    const textStartX = -w / 2 + 64;

    // Название достижения
    const nameColor = claimed ? '#88dd88' : done ? '#ffd24a' : '#ffffff';
    const nameTxt = this.add.text(textStartX, -18, a.name, {
      fontSize: '14px',
      color: nameColor,
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    cont.add(nameTxt);

    // Бейдж тира (если в цепочке > 1)
    if (row && row.total > 1) {
      const tierBadge = this.add.text(textStartX + nameTxt.displayWidth + 8, -18,
        `ТИР ${row.got | 0}/${row.total}`, {
          fontSize: '10px',
          color: claimed ? '#88dd88' : done ? '#ffd24a' : '#8899bb',
          backgroundColor: claimed ? '#0d301b' : done ? '#3d2e0f' : '#14182b',
          padding: { left: 5, right: 5, top: 2, bottom: 2 }
        }).setOrigin(0, 0.5);
      cont.add(tierBadge);
    }

    // Описание
    const descTxt = this.add.text(textStartX, 2, a.desc, {
      fontSize: '11px',
      color: '#99aacc',
      wordWrap: { width: 330 }
    }).setOrigin(0, 0.5);
    cont.add(descTxt);

    // Мини прогресс-бар достижения
    const pBarW = 190;
    const pBarH = 6;
    const pBarX = textStartX;
    const pBarY = 20;

    const pBarG = this.add.graphics();
    pBarG.fillStyle(0x0a0c18, 0.9);
    pBarG.fillRoundedRect(pBarX, pBarY - pBarH / 2, pBarW, pBarH, 3);
    pBarG.lineStyle(1, 0x222a40, 0.8);
    pBarG.strokeRoundedRect(pBarX, pBarY - pBarH / 2, pBarW, pBarH, 3);

    const pRatio = Math.min(1, Math.max(0, cur / Math.max(1, need)));
    const pFillW = Math.max(4, Math.round(pBarW * pRatio));
    if (pFillW > 0) {
      pBarG.fillStyle(claimed ? 0x44cc66 : done ? 0xffd24a : 0x4a77cc, 1);
      pBarG.fillRoundedRect(pBarX, pBarY - pBarH / 2, pFillW, pBarH, 3);
    }
    cont.add(pBarG);

    // Счётчик прогресса числом
    const progTxt = this.add.text(pBarX + pBarW + 8, pBarY, `${cur}/${need}`, {
      fontSize: '11px',
      color: claimed ? '#88dd88' : done ? '#ffd24a' : '#7788aa',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    cont.add(progTxt);

    // Правая зона действия
    const rightCenter = w / 2 - 58;

    if (claimed) {
      // Бейдж «Выполнено»
      const doneG = this.add.graphics();
      doneG.fillStyle(0x13381e, 0.9);
      doneG.fillRoundedRect(rightCenter - 48, -14, 96, 28, 6);
      doneG.lineStyle(1.5, 0x33aa55, 0.8);
      doneG.strokeRoundedRect(rightCenter - 48, -14, 96, 28, 6);
      cont.add(doneG);

      const doneTxt = this.add.text(rightCenter, 0, '✓ ГОТОВО', {
        fontSize: '12px',
        color: '#88dd88',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      cont.add(doneTxt);

    } else if (done) {
      // Кнопка «ЗАБРАТЬ» с золотым пульсом
      const btnW = 104;
      const btnH = 34;
      const btnX = rightCenter;
      const btnY = 0;

      const btnFr = this.add.graphics();
      cont.add(btnFr);

      const paintBtn = (hot) => {
        btnFr.clear();
        btnFr.fillStyle(hot ? 0x2e6634 : 0x1f4a25, 1);
        btnFr.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
        btnFr.fillStyle(0xffffff, hot ? 0.16 : 0.08);
        btnFr.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, 5, { tl: 8, tr: 8, bl: 0, br: 0 });
        btnFr.lineStyle(hot ? 2 : 1.5, hot ? 0xffff88 : 0xffd24a, 1);
        btnFr.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      };
      paintBtn(false);

      const btnLabel = a.reward > 0 ? `+${a.reward} 🪙` : 'ЗАБРАТЬ';
      const btnTxt = this.add.text(btnX, btnY - 7, 'ЗАБРАТЬ', {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      const rewTxt = this.add.text(btnX, btnY + 7, a.reward > 0 ? `+${a.reward} МОНЕТ` : '✓ НАГРАДА', {
        fontSize: '10px',
        color: '#ffee88',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      cont.add([btnTxt, rewTxt]);

      // Пульсация кнопки
      this.tweens.add({
        targets: [btnFr, btnTxt, rewTxt],
        alpha: { from: 1, to: 0.8 },
        yoyo: true,
        repeat: -1,
        duration: 750
      });

      const hit = this.add.rectangle(btnX, btnY, btnW, btnH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      cont.add(hit);

      hit.on('pointerover', () => {
        paintBtn(true);
        drawCardBg(true);
        try {
          if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
            this.sound.play('sfx_hover', { volume: 0.15 });
          }
        } catch (e) {}
      });
      hit.on('pointerout', () => {
        paintBtn(false);
        drawCardBg(false);
      });

      hit.on('pointerdown', () => {
        if (!claimAchievement(a.id)) return;
        try {
          if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
            this.sound.play('sfx_buy', { volume: 0.6 });
          }
        } catch (e) {}

        if (a.reward > 0) {
          try {
            const plus = this.add.text(cx + btnX, cy - 20, `+${a.reward} МОНЕТ!`, {
              fontSize: '16px',
              color: '#ffee88',
              fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(60);
            plus.setStroke('#111124', 4);
            this.tweens.add({
              targets: plus,
              y: cy - 54,
              alpha: 0,
              duration: 900,
              onComplete: () => { try { plus.destroy(); } catch (e) {} }
            });
          } catch (e) {}
        }

        this.time.delayedCall(700, () => {
          try {
            if (this.scene.isActive()) this.scene.restart();
          } catch (e) {}
        });
      });

    } else {
      // Превью награды
      const rewBox = this.add.graphics();
      rewBox.fillStyle(0x111425, 0.85);
      rewBox.fillRoundedRect(rightCenter - 46, -14, 92, 28, 6);
      rewBox.lineStyle(1, 0x2c334e, 0.8);
      rewBox.strokeRoundedRect(rightCenter - 46, -14, 92, 28, 6);
      cont.add(rewBox);

      const rewTxt = this.add.text(rightCenter, 0, a.reward > 0 ? `+${a.reward} 🪙` : '—', {
        fontSize: '12px',
        color: '#8899aa',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      cont.add(rewTxt);
    }
  }
}
