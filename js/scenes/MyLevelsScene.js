import { gameState } from '../data/gameState.js';
import { campaignLevels } from '../data/levels.js';
import { loadCustomLevels, deleteCustomLevel, saveCustomLevel } from '../data/customLevels.js';
import { generateLevel } from '../data/levelGen.js';
import { gameW, UX } from '../ui/layout.js';

const THEME_NAMES = {
  zavod: 'Завод',
  pustinya: 'Каньон',
  krisha: 'Высотки',
  pechera: 'Бункер',
  wasteland: 'Пустошь',
  ulica: 'Улицы',
  sunset: 'Закат',
  night: 'Ночь'
};

export default class MyLevelsScene extends Phaser.Scene {
  constructor() {
    super('MyLevelsScene');
    this.scrollY = 0;
    this.maxScroll = 0;
    this._wheelHandler = null;
    this._pointerDownHandler = null;
    this._pointerMoveHandler = null;
    this._pointerUpHandler = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a22');
    const _cx = gameW(this) / 2;

    this.TOP = 100;
    this.BOTTOM = 615;
    this.scrollY = 0;

    // --- 1. ФИКСИРОВАННАЯ ШАПКА ---
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x0a0a24, 0.98);
    headerBg.fillRect(0, 0, gameW(this), this.TOP);
    headerBg.lineStyle(2, 0x242a42, 1);
    headerBg.lineBetween(0, this.TOP, gameW(this), this.TOP);
    headerBg.setDepth(50);

    const back = this.add.text(UX(this, 75), 38, '← Назад', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#553333',
      padding: { x: 12, y: 7 }
    }).setOrigin(0.5).setDepth(55);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    back.on('pointerover', () => back.setStyle({ color: '#ffff55' }));
    back.on('pointerout', () => back.setStyle({ color: '#ffffff' }));

    this.titleText = this.add.text(_cx, 38, 'МОИ УРОВНИ', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(55);

    this.subText = this.add.text(_cx, 75, '', {
      fontSize: '14px',
      color: '#7799bb'
    }).setOrigin(0.5).setDepth(55);

    // --- 2. ФИКСИРОВАННЫЙ ПОДВАЛ (КНОПКИ ДЕЙСТВИЙ) ---
    const footerBg = this.add.graphics();
    footerBg.fillStyle(0x090a1c, 0.98);
    footerBg.fillRect(0, this.BOTTOM, gameW(this), 720 - this.BOTTOM);
    footerBg.lineStyle(2, 0x242a42, 1);
    footerBg.lineBetween(0, this.BOTTOM, gameW(this), this.BOTTOM);
    footerBg.setDepth(50);

    this.makeBtn(_cx - 170, 652, '+ Создать новый уровень', () => {
      this.scene.start('LevelEditorScene');
    }, '#23783b', 18, 55);

    this.makeBtn(_cx + 170, 652, '🎲 Сгенерировать уровень', () => {
      try {
        const lvl = generateLevel(loadCustomLevels().length);
        saveCustomLevel(lvl);
        this.renderLevels();
        // Автоматически докручиваем в самый конец к новому уровню
        this.scrollY = -this.maxScroll;
        this.applyScroll();
      } catch (e) { /* генератор не роняет меню */ }
    }, '#23528b', 18, 55);

    this.add.text(_cx, 695, 'Выбери уровень и нажми «Играть» • Колёсико мыши или перетаскивание для прокрутки', {
      fontSize: '12px',
      color: '#556677',
      align: 'center'
    }).setOrigin(0.5).setDepth(55);

    // --- 3. СКРОЛЛ-КОНТЕЙНЕР И МАСКА ---
    this.maskG = this.add.graphics();
    this.maskG.fillStyle(0xffffff);
    this.maskG.fillRect(0, this.TOP + 2, gameW(this), this.BOTTOM - this.TOP - 4);
    this.maskG.setVisible(false);

    this.scrollContainer = this.add.container(0, 0);
    this.scrollContainer.setMask(this.maskG.createGeometryMask());

    // Полоса прокрутки
    this.scrollbar = this.add.graphics().setDepth(45);

    this.bindScrollEvents();
    this.renderLevels();

    // Очистка событий при переходе
    this.events.once('shutdown', () => this.unbindScrollEvents());
  }

  bindScrollEvents() {
    this.unbindScrollEvents();

    let isDown = false;
    let startY = 0;
    let startScrollY = 0;
    this._dragged = false;

    this._wheelHandler = (pointer, _go, _dx, dy) => {
      if (pointer.y < this.TOP || pointer.y > this.BOTTOM) return;
      if (this.maxScroll <= 0) return;
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.65, -this.maxScroll, 0);
      this.applyScroll();
    };

    this._pointerDownHandler = (pointer) => {
      if (pointer.y < this.TOP || pointer.y > this.BOTTOM) return;
      isDown = true;
      startY = pointer.y;
      startScrollY = this.scrollY;
      this._dragged = false;
    };

    this._pointerMoveHandler = (pointer) => {
      if (!isDown) return;
      const dy = pointer.y - startY;
      if (Math.abs(dy) > 5) this._dragged = true;
      if (this.maxScroll > 0) {
        this.scrollY = Phaser.Math.Clamp(startScrollY + dy, -this.maxScroll, 0);
        this.applyScroll();
      }
    };

    this._pointerUpHandler = () => {
      isDown = false;
    };

    this.input.on('wheel', this._wheelHandler);
    this.input.on('pointerdown', this._pointerDownHandler);
    this.input.on('pointermove', this._pointerMoveHandler);
    this.input.on('pointerup', this._pointerUpHandler);
  }

  unbindScrollEvents() {
    if (this._wheelHandler) {
      this.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
    if (this._pointerDownHandler) {
      this.input.off('pointerdown', this._pointerDownHandler);
      this._pointerDownHandler = null;
    }
    if (this._pointerMoveHandler) {
      this.input.off('pointermove', this._pointerMoveHandler);
      this._pointerMoveHandler = null;
    }
    if (this._pointerUpHandler) {
      this.input.off('pointerup', this._pointerUpHandler);
      this._pointerUpHandler = null;
    }
  }

  applyScroll() {
    if (this.scrollContainer) {
      this.scrollContainer.y = this.scrollY;
    }
    this.updateScrollbar();
    this.updateItemClipping();
  }

  updateScrollbar() {
    if (!this.scrollbar) return;
    this.scrollbar.clear();
    if (this.maxScroll <= 0) return;

    const _cx = gameW(this) / 2;
    const trackX = _cx + 465;
    const trackY = this.TOP + 12;
    const trackH = this.BOTTOM - this.TOP - 24;

    // Фоновая дорожка
    this.scrollbar.fillStyle(0x181c2e, 0.7);
    this.scrollbar.fillRoundedRect(trackX, trackY, 6, trackH, 3);

    // Ползунок
    const viewH = this.BOTTOM - this.TOP;
    const thumbH = Math.max(30, (viewH / (viewH + this.maxScroll)) * trackH);
    const scrollRatio = -this.scrollY / this.maxScroll;
    const thumbY = trackY + scrollRatio * (trackH - thumbH);

    this.scrollbar.fillStyle(0x406088, 0.9);
    this.scrollbar.fillRoundedRect(trackX, thumbY, 6, thumbH, 3);
  }

  updateItemClipping() {
    (this.cardButtons || []).forEach(b => {
      if (!b || !b.input) return;
      const cardAbsY = b.baseY + this.scrollY;
      b.input.enabled = (cardAbsY >= this.TOP - 5 && cardAbsY <= this.BOTTOM + 5);
    });
  }

  renderLevels() {
    if (this.scrollContainer) {
      this.scrollContainer.removeAll(true);
    }
    this.cardButtons = [];

    const levels = loadCustomLevels();
    const _cx = gameW(this) / 2;

    this.subText.setText(`Всего карт: ${levels.length} • Колёсико мыши или перетаскивание для прокрутки`);

    if (!levels.length) {
      const emptyText = this.add.text(_cx, (this.TOP + this.BOTTOM) / 2, 'Пока нет ни одного уровня.\nСоздай первый в конструкторе или нажми «🎲 Сгенерировать уровень»!', {
        fontSize: '20px',
        color: '#7799bb',
        align: 'center',
        lineSpacing: 8
      }).setOrigin(0.5);
      this.scrollContainer.add(emptyText);
      this.maxScroll = 0;
      this.scrollY = 0;
      this.applyScroll();
      return;
    }

    const cardW = 900;
    const cardH = 60;
    const cardStep = 70;
    let currY = this.TOP + 16 + cardH / 2;

    levels.forEach((lvl, idx) => {
      const cardCont = this.add.container(_cx, currY);
      const objects = lvl.objects || [];
      const plats = objects.filter(o => !o.spawnType && o.type !== 'decor').length;
      const enemies = objects.filter(o => o.spawnType === 'enemy').length;
      const themeLabel = THEME_NAMES[lvl.theme] || lvl.theme || 'Город';
      const mapW = lvl.width || 3800;

      // 1. Фон карточки
      const bg = this.add.graphics();
      bg.fillStyle(0x141826, 0.96);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
      bg.lineStyle(1.5, 0x263348, 1);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
      cardCont.add(bg);

      // 2. Название уровня
      const title = this.add.text(-cardW / 2 + 18, -12, `${idx + 1}. «${String(lvl.name).slice(0, 26)}»`, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffdd55'
      }).setOrigin(0, 0.5);
      cardCont.add(title);

      // 3. Подпись темы и масштаба
      const tag = this.add.text(-cardW / 2 + 18, 14, `[${themeLabel} • ${mapW} px]`, {
        fontSize: '12px',
        color: '#6e88a6'
      }).setOrigin(0, 0.5);
      cardCont.add(tag);

      // 4. Статистика
      const stats = this.add.text(-20, 0, `🧱 Объектов: ${plats}    🎯 Врагов: ${enemies}`, {
        fontSize: '14px',
        color: '#8da2b5'
      }).setOrigin(0, 0.5);
      cardCont.add(stats);

      // 5. Кнопка «Играть»
      const playBtn = this.makeRowBtn(cardW / 2 - 210, 0, '▶ Играть', () => {
        if (this._dragged) return;
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
          selectedClass: gameState.lastClass || 'Assault',
          levelIndex: campaignLevels.length + idx,
          playerName: gameState.playerName
        });
      }, '#23783b', '#2ea04f', currY);
      cardCont.add(playBtn);
      this.cardButtons.push(playBtn);

      // 6. Кнопка «Изменить»
      const editBtn = this.makeRowBtn(cardW / 2 - 110, 0, '✎ Изменить', () => {
        if (this._dragged) return;
        this.scene.start('LevelEditorScene', { editingId: lvl.id });
      }, '#235086', '#2d68b0', currY);
      cardCont.add(editBtn);
      this.cardButtons.push(editBtn);

      // 7. Кнопка «Удалить»
      const delBtn = this.makeRowBtn(cardW / 2 - 30, 0, '✕', () => {
        if (this._dragged) return;
        deleteCustomLevel(lvl.id);
        this.renderLevels();
      }, '#6a2626', '#8e3232', currY);
      cardCont.add(delBtn);
      this.cardButtons.push(delBtn);

      this.scrollContainer.add(cardCont);
      currY += cardStep;
    });

    const totalContentH = (currY - (this.TOP + 16 + cardH / 2)) + 16;
    const viewH = this.BOTTOM - this.TOP;
    this.maxScroll = Math.max(0, totalContentH - viewH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScroll, 0);

    this.applyScroll();
  }

  makeRowBtn(x, y, label, cb, bgCol, hoverCol, baseY) {
    const btn = this.add.text(x, y, label, {
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: bgCol,
      padding: { x: 10, y: 6 }
    }).setOrigin(0.5);
    btn.baseY = baseY;
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', cb);
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverCol }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: bgCol }));
    return btn;
  }

  makeBtn(x, y, label, cb, bgCol = '#252560', fs = 18, depth = 0) {
    const btn = this.add.text(x, y, label, {
      fontSize: `${fs}px`,
      color: '#ffffff',
      backgroundColor: bgCol,
      padding: { x: 14, y: 9 }
    }).setOrigin(0.5).setDepth(depth);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', cb);
    btn.on('pointerover', () => btn.setStyle({ color: '#ffff55' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
    return btn;
  }
}
