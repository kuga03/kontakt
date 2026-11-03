import { gameW, UX } from '../ui/layout.js?v=3';
import { gameState } from '../data/gameState.js?v=175';
import { ACHIEVEMENTS, achievementProgress, isClaimed, claimAchievement } from '../data/achievements.js?v=170';

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
    this.cameras.main.setBackgroundColor('#0a0a2a');
    const _cx = gameW(this) / 2;
    this.add.text(_cx, 30, 'ДОСТИЖЕНИЯ', {
      fontSize: '32px', color: '#ffffff'
    }).setOrigin(0.5);

    // Счётчик — только по существующим сейчас достижениям
    // (в сейве могли остаться id старых версий — их не считаем,
    // иначе «21/21» при горящих замках).
    const validClaimed = (gameState.achievements || []).filter(id =>
      ACHIEVEMENTS.some(a => a.id === id));
    const got = validClaimed.length;
    this.add.text(_cx, 64, `Получено достижений: ${got}/${ACHIEVEMENTS.length}`, {
      fontSize: '17px', color: '#ffd24a'
    }).setOrigin(0.5);

    // Общий прогресс-бар.
    const bw = 400;
    const bg = this.add.graphics();
    bg.fillStyle(0x22223a, 1);
    bg.fillRoundedRect(_cx - bw / 2, 88, bw, 14, 7);
    bg.fillStyle(0xffd24a, 1);
    bg.fillRoundedRect(_cx - bw / 2, 88, Math.max(10, bw * (got / Math.max(1, ACHIEVEMENTS.length))), 14, 7);

    // Одна строка на цепочку: первый незабранный тир.
    // Всю забрал — строка с галочкой по последнему тиру.
    const rows = [];
    CHAINS.forEach(chain => {
      const claimedCount = chain.filter(id => isClaimed(id)).length;
      const nextId = chain.find(id => !isClaimed(id));
      if (nextId) {
        const a = ACHIEVEMENTS.find(v => v.id === nextId);
        // Счётчик — ЗАБРАННЫЕ тиры (как общий «Получено N/21»), а не номер
        // текущего: bare «5/5» читалось как выполнение и вводило в заблуждение
        // при незакрытом тире.
        if (a) rows.push({ a, got: claimedCount, total: chain.length });
      } else {
        const a = ACHIEVEMENTS.find(v => v.id === chain[chain.length - 1]);
        if (a) rows.push({ a, got: chain.length, total: chain.length, chainDone: true });
      }
    });

    const rowH = 42;
    const y0 = 112;
    // Колонка шире и по центру: описания цепочек не упираются в края.
    const colW = 640;
    const colX = _cx - colW / 2;
    rows.forEach((row, i) => {
      this._drawRow(colX, y0 + i * rowH, colW, rowH, row.a, row);
    });

    const back = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    back.on('pointerover', () => back.setStyle({ color: '#ffff55' }));
    back.on('pointerout', () => back.setStyle({ color: '#ffffff' }));
  }

  _drawRow(x, y, w, rowH, a, row) {
    const claimed = isClaimed(a.id);
    const [cur, need] = achievementProgress(a.id);
    const done = cur >= need || (row && row.chainDone);

    const rowBg = this.add.graphics();
    rowBg.fillStyle(claimed ? 0x1a3a1a : done ? 0x3a2f10 : 0x151538, 1);
    rowBg.fillRoundedRect(x, y, w, rowH - 5, 6);
    rowBg.lineStyle(1, claimed ? 0x44aa44 : done ? 0xffd24a : 0x444488, 1);
    rowBg.strokeRoundedRect(x, y, w, rowH - 5, 6);

    this.add.text(x + 10, y + 9, claimed ? '🏆' : done ? '🎁' : '🔒', {
      fontSize: '15px'
    }).setOrigin(0, 0.5);
    this.add.text(x + 38, y + 9, a.name, {
      fontSize: '14px', color: claimed ? '#88dd88' : done ? '#ffd24a' : '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    // Правая сторона первой: запоминаем её левый край, чтобы ступень
    // цепочки и описание не налезали на кнопку/галочку/награду.
    let rightX = x + w - 10;
    if (claimed) {
      this.add.text(rightX, y + (rowH - 5) / 2, '✓', {
        fontSize: '16px', color: '#88dd88', fontStyle: 'bold'
      }).setOrigin(1, 0.5);
      rightX -= 26;
    } else if (done) {
      const btn = this.add.text(rightX, y + (rowH - 5) / 2, a.reward > 0 ? `ПОЛУЧИТЬ +${a.reward}` : 'ПОЛУЧИТЬ', {
        fontSize: '13px', color: '#ffffff', backgroundColor: '#2a5a2a', padding: 6
      }).setOrigin(1, 0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setStyle({ color: '#ffff55' }));
      btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
      btn.on('pointerdown', () => {
        if (!claimAchievement(a.id)) return;
        // Тут нет счётчика сверху — просто всплывашка + звук и пауза.
        try {
          if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
            this.sound.play('sfx_buy', { volume: 0.5 });
          }
        } catch (e) {}
        if (a.reward > 0) {
          try {
            const plus = this.add.text(rightX - 60, y - 14, `+${a.reward}`, {
              fontSize: '15px', color: '#ffee88', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(50);
            this.tweens.add({
              targets: plus, y: y - 44, alpha: 0, duration: 900,
              onComplete: () => { try { plus.destroy(); } catch (e) {} }
            });
          } catch (e) {}
        }
        this.time.delayedCall(800, () => {
          try { if (this.scene.isActive()) this.scene.restart(); } catch (e) {}
        });
      });
      // Пульс кнопки получения.
      this.tweens.add({
        targets: btn, alpha: { from: 1, to: 0.6 },
        yoyo: true, repeat: -1, duration: 700
      });
      rightX = rightX - btn.displayWidth - 10;
    } else {
      const rw = this.add.text(rightX, y + (rowH - 5) / 2, a.reward > 0 ? `+${a.reward}` : '—', {
        fontSize: '13px', color: '#667788'
      }).setOrigin(1, 0.5);
      rightX = rightX - rw.displayWidth - 10;
    }
    // Ступень цепочки (у одиночных не показываем) — слева от правой стороны.
    // Формат «тиры 4/5»: сколько тиров ЗАБРАНО (не номер текущего).
    if (row && row.total > 1) {
      this.add.text(rightX, y + 9, `тиры ${row.got | 0}/${row.total}`, {
        fontSize: '12px', color: '#667788'
      }).setOrigin(1, 0.5);
    }
    this.add.text(x + 38, y + 26, `${a.desc} · ${cur}/${need}`, {
      fontSize: '12px', color: '#99aacc',
      wordWrap: { width: Math.max(120, rightX - (x + 38) - 8) }
    }).setOrigin(0, 0.5);
  }
}
