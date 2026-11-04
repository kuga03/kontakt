import { gameState } from '../data/gameState.js';
import { campaignLevels } from '../data/levels.js';
import { loadCustomLevels, deleteCustomLevel, saveCustomLevel } from '../data/customLevels.js';
import { generateLevel } from '../data/levelGen.js';
import { gameW, UX } from '../ui/layout.js';

export default class MyLevelsScene extends Phaser.Scene {
  constructor() {
    super('MyLevelsScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a2a');
    const _cx = gameW(this) / 2;

    this.add.text(_cx, 60, 'МОИ УРОВНИ', {
      fontSize: '40px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.renderLevels();

    this.makeBtn(_cx, 420, '+ Создать новый уровень', () => {
      this.scene.start('LevelEditorScene');
    }, '#287a45', 24);

    this.makeBtn(_cx, 472, '🎲 Сгенерировать уровень', () => {
      try {
        const lvl = generateLevel(loadCustomLevels().length);
        saveCustomLevel(lvl);
        this.renderLevels();
      } catch (e) { /* генератор не роняет меню */ }
    }, '#2a5a8a', 20);

    this.add.text(_cx, 522, 'Как играть: выбери уровень и нажми «Играть».\nНа уровне будут спавны врагов, которые ты расставил.', {
      fontSize: '13px',
      color: '#556677',
      align: 'center'
    }).setOrigin(0.5);

    const back = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#553333',
      padding: 8
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  renderLevels() {
    if (this.levelRoot) {
      this.levelRoot.destroy(true);
      this.levelRoot = null;
    }

    this.levelRoot = this.add.container(0, 0);

    const levels = loadCustomLevels();
    const _cx = gameW(this) / 2;

    if (!levels.length) {
      this.levelRoot.add(
        this.add.text(_cx, 220, 'Пока нет ни одного уровня.\nСоздай первый в конструкторе!', {
          fontSize: '22px',
          color: '#7799bb',
          align: 'center'
        }).setOrigin(0.5)
      );
      return;
    }

    const root = this.levelRoot;
    let y = 150;
    // Строго в экран: больше 9 — обрезаем с пометкой (иначе кнопки уедут вниз).
    const shown = levels.slice(0, 9);
    shown.forEach((lvl, idx) => {
      const objects = lvl.objects || [];
      const plats = objects.filter(o => !o.spawnType).length;
      const enemies = objects.filter(o => o.spawnType === 'enemy').length;

      root.add(
        // Имя режем: длинное налезало бы на счётчики и кнопки.
        this.add.text(UX(this, 280), y, `${idx + 1}. «${String(lvl.name).slice(0, 24)}»`, {
          fontSize: '20px',
          color: '#ffdd55'
        }).setOrigin(0, 0.5)
      );

      root.add(
        this.add.text(UX(this, 530), y, `объектов: ${plats}  врагов: ${enemies}`, {
          fontSize: '14px',
          color: '#8899aa'
        }).setOrigin(0, 0.5)
      );

      root.add(this.makeBtn(620, y, 'Играть', () => {
        // Битый/недособранный уровень не пускаем в бой: спавн в пустоте.
        const objs = lvl.objects || [];
        const bad = [];
        if (!objs.some(o => o.type === 'ground')) bad.push('нет земли');
        if (!objs.some(o => o.spawnType === 'player')) bad.push('нет спавна игрока');
        if (!objs.some(o => o.spawnType === 'enemy')) bad.push('нет врагов');
        if (bad.length) {
          window.alert(`Уровень «${lvl.name}» не готов:\n- ${bad.join('\n- ')}\nОткрой «Изменить» и дострой.`);
          return;
        }
        this.scene.start('GameScene', {
          mode: 'CAMPAIGN',
          // Класс игрока — последний игранный, а не всегда Штурмовик.
          selectedClass: gameState.lastClass || 'Assault',
          levelIndex: campaignLevels.length + idx,
          playerName: gameState.playerName
        });
      }));

      root.add(this.makeBtn(720, y, 'Изменить', () => {
        this.scene.start('LevelEditorScene', { editingId: lvl.id });
      }));

      root.add(this.makeBtn(830, y, 'Удалить', () => {
        deleteCustomLevel(lvl.id);
        this.renderLevels();
      }, '#553333'));

      y += 52;
    });
    if (levels.length > shown.length) {
      root.add(
        this.add.text(UX(this, 280), y, `…и ещё ${levels.length - shown.length} (удали лишние)`, {
          fontSize: '14px', color: '#667788'
        }).setOrigin(0, 0.5)
      );
    }
  }

  makeBtn(x, y, label, cb, bg = '#252560', fs = 18) {
    const btn = this.add.text(x, y, label, {
      fontSize: `${fs}px`,
      color: '#ffffff',
      backgroundColor: bg,
      padding: 8
    }).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', cb);
    btn.on('pointerover', () => btn.setStyle({ color: '#ffff55' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
    return btn;
  }
}
