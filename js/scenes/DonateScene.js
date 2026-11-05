// DonateScene — отдельное меню доната (вход — пончик из топбара меню).
import { DONATE_ITEMS } from '../data/donate.js';
import { donateAvailable } from '../platform/index.js';
import { gameW, UX } from '../ui/layout.js';

export default class DonateScene extends Phaser.Scene {
  constructor() {
    super('DonateScene');
  }

  create() {
    const _cx = gameW(this) / 2;
    this._initBackground();
    this._initParticles();
    this._initHeader();

    let avail = null;
    try { avail = donateAvailable(); } catch (e) {}

    // Сетка карточек: 2 колонки по 3 ряда
    const CW = 500, CH = 145;
    const GX = 24, GY = 16;
    const leftCX = UX(this, _cx - CW / 2 - GX / 2);
    const rightCX = UX(this, _cx + CW / 2 + GX / 2);
    const startY = 120;

    const TOP = 100, BOTTOM = 684;
    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff);
    maskG.fillRect(0, TOP, gameW(this), BOTTOM - TOP);
    maskG.setVisible(false);

    const scroll = this.add.container(0, 0);
    scroll.setMask(maskG.createGeometryMask());

    let maxBottom = 0;
    for (let i = 0; i < DONATE_ITEMS.length; i++) {
      const isLeft = (i % 2 === 0);
      const rowIdx = Math.floor(i / 2);
      const cx = isLeft ? leftCX : rightCX;
      const cy = startY + rowIdx * (CH + GY) + CH / 2;
      const card = this._createCard(cx, cy, CW, CH, DONATE_ITEMS[i], avail);
      scroll.add(card);
      maxBottom = Math.max(maxBottom, cy + CH / 2);
    }

    const maxScroll = Math.max(0, maxBottom - BOTTOM);
    let sv = 0;
    this.input.on('wheel', (pointer, _go, _dx, dy) => {
      if (pointer.y < TOP || pointer.y > BOTTOM) return;
      if (maxScroll <= 0) return;
      sv = Phaser.Math.Clamp(sv + dy * 0.5, 0, maxScroll);
      scroll.y = -sv;
    });

    try {
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
    } catch (e) {}

    this.events.once('shutdown', () => {
      this._particles = [];
    });
  }

  update(time, delta) {
    this._updateParticles(time, delta);
  }

  // Трёхступенчатый градиент фона
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

  // Золотые частицы роскоши
  _initParticles() {
    this._particles = [];
    const W = gameW(this);
    const count = 16;
    for (let i = 0; i < count; i++) {
      const g = this.add.graphics().setDepth(-8);
      const r = Phaser.Math.FloatBetween(1.2, 2.5);
      g.fillStyle(0xffd24a, 1);
      g.fillCircle(0, 0, r);
      const p = {
        gfx: g,
        x: Phaser.Math.Between(40, W - 40),
        y: Phaser.Math.Between(70, 680),
        speed: Phaser.Math.FloatBetween(10, 25),
        baseAlpha: Phaser.Math.FloatBetween(0.1, 0.35),
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
      p.x += Math.sin(time * 0.001 + p.seed) * 0.3;
      if (p.y < 65) {
        p.y = 685;
        p.x = Phaser.Math.Between(40, W - 40);
      }
      p.gfx.setPosition(p.x, p.y);
    }
  }

  _initHeader() {
    const _cx = gameW(this) / 2;

    this.add.text(_cx, 22, 'ПРЕМИУМ МАГАЗИН', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(50);

    // Золотая черта с ромбом под заголовком
    const fl = this.add.graphics().setDepth(50);
    fl.lineStyle(2, 0xffd24a, 0.8);
    fl.lineBetween(_cx - 160, 42, _cx + 160, 42);
    fl.fillStyle(0xffd24a, 0.9);
    const dd = 5;
    fl.fillPoints([
      new Phaser.Geom.Point(_cx, 42 - dd), new Phaser.Geom.Point(_cx + dd, 42),
      new Phaser.Geom.Point(_cx, 42 + dd), new Phaser.Geom.Point(_cx - dd, 42)
    ], true);

    // Подзаголовок-плашка с динамическим замером ширины текста
    const subText = this.add.text(_cx, 70, 'ПЛАТЕЖИ БУДУТ ПОДКЛЮЧЕНЫ С ВЫХОДОМ НА ПЛОЩАДКИ', {
      fontSize: '11px',
      color: '#ffd24a',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(46);

    const subW = Math.max(340, Math.ceil(subText.displayWidth + 36));
    const subH = 26;
    const subG = this.add.graphics().setDepth(45);
    subG.fillStyle(0x0e1124, 0.92);
    subG.fillRoundedRect(_cx - subW / 2, 70 - subH / 2, subW, subH, 6);
    subG.lineStyle(1, 0x2a3550, 0.85);
    subG.strokeRoundedRect(_cx - subW / 2, 70 - subH / 2, subW, subH, 6);

    // Кнопка Назад
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
      fontStyle: 'bold'
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

  _createCard(x, y, w, h, item, avail) {
    const c = this.add.container(x, y);

    const isExcl = item.tag === 'ЭКСКЛЮЗИВ';
    const isHit = item.tag === 'ХИТ';
    const isGood = item.tag === 'ВЫГОДНО';

    const baseBorder = isExcl ? 0xffd24a : isHit ? 0xff5566 : isGood ? 0x35d07f : 0x2b3450;
    const accentCol = isExcl ? 0xffd24a : isHit ? 0xff5566 : isGood ? 0x35d07f : 0x4a66aa;

    const bg = this.add.graphics();
    const renderCardBg = (hot) => {
      bg.clear();
      bg.fillStyle(hot ? 0x181c34 : 0x0f1224, 0.96);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);

      // Верхняя световая полоска
      bg.fillStyle(accentCol, hot ? 0.35 : 0.2);
      bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, 4, { tl: 10, tr: 10, bl: 0, br: 0 });

      // Рамка
      bg.lineStyle(hot ? 2 : 1.5, hot ? (isExcl ? 0xfff088 : 0x88ccff) : baseBorder, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    renderCardBg(false);
    c.add(bg);

    // Значок слева (64x64)
    const iconX = -w / 2 + 48;
    const iconY = -8;
    const iconBox = this.add.graphics();
    iconBox.fillStyle(0x14182e, 1);
    iconBox.fillRoundedRect(iconX - 30, iconY - 30, 60, 60, 10);
    iconBox.lineStyle(1.5, accentCol, 0.8);
    iconBox.strokeRoundedRect(iconX - 30, iconY - 30, 60, 60, 10);
    c.add(iconBox);

    const iconTxt = this.add.text(iconX, iconY, item.icon, {
      fontSize: '34px'
    }).setOrigin(0.5);
    c.add(iconTxt);

    // Название
    const textStartX = -w / 2 + 92;
    const nameTxt = this.add.text(textStartX, -h / 2 + 18, item.name, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0);
    c.add(nameTxt);

    // Бейдж тега справа вверху с авто-подгонкой ширины под текст
    if (item.tag) {
      const tagTxt = this.add.text(0, 0, item.tag, {
        fontSize: '10px',
        color: isExcl ? '#ffd24a' : isHit ? '#ff8899' : '#88eeaa',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const tagW = Math.max(76, Math.ceil(tagTxt.displayWidth + 20));
      const tagH = 22;
      const tagX = w / 2 - 16 - tagW / 2;
      const tagY = -h / 2 + 15 + tagH / 2;
      tagTxt.setPosition(tagX, tagY);

      const tagBg = this.add.graphics();
      tagBg.fillStyle(isExcl ? 0x473612 : isHit ? 0x4a181e : 0x163e26, 0.95);
      tagBg.fillRoundedRect(tagX - tagW / 2, tagY - tagH / 2, tagW, tagH, 6);
      tagBg.lineStyle(1, accentCol, 1);
      tagBg.strokeRoundedRect(tagX - tagW / 2, tagY - tagH / 2, tagW, tagH, 6);
      c.add(tagBg);
      c.add(tagTxt);
    }

    // Описание
    const descTxt = this.add.text(textStartX, -h / 2 + 44, item.desc, {
      fontSize: '12px',
      color: '#99aacc',
      wordWrap: { width: w - 130 }
    }).setOrigin(0, 0);
    c.add(descTxt);

    // Нижняя плашка с ценой
    const pbW = 110;
    const pbH = 32;
    const pbX = -w / 2 + 18 + pbW / 2;
    const pbY = h / 2 - 26;

    const priceBox = this.add.graphics();
    priceBox.fillStyle(0x0e1124, 0.92);
    priceBox.fillRoundedRect(pbX - pbW / 2, pbY - pbH / 2, pbW, pbH, 6);
    priceBox.lineStyle(1, 0x2a3550, 0.85);
    priceBox.strokeRoundedRect(pbX - pbW / 2, pbY - pbH / 2, pbW, pbH, 6);
    c.add(priceBox);

    const priceTxt = this.add.text(pbX, pbY, item.priceRub + ' ₽', {
      fontSize: '15px',
      color: '#ffee88',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    c.add(priceTxt);

    // Кнопка СКОРО
    const btnW = 120;
    const btnH = 32;
    const btnX = w / 2 - 18 - btnW / 2;
    const btnY = h / 2 - 26;

    const btnFr = this.add.graphics();
    const renderBtn = (hot) => {
      btnFr.clear();
      btnFr.fillStyle(hot ? 0x2e3550 : 0x1a1e30, 1);
      btnFr.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      btnFr.fillStyle(0xffffff, hot ? 0.12 : 0.05);
      btnFr.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
      btnFr.lineStyle(hot ? 1.8 : 1.2, hot ? 0x88bbff : 0x3d4766, 1);
      btnFr.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
    };
    renderBtn(false);
    c.add(btnFr);

    const btnTxt = this.add.text(btnX, btnY, 'СКОРО', {
      fontSize: '13px',
      color: '#a0b0d0',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    c.add(btnTxt);

    const hit = this.add.rectangle(btnX, btnY, btnW, btnH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    c.add(hit);

    hit.on('pointerover', () => {
      renderBtn(true);
      btnTxt.setStyle({ color: '#ffffff' });
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.15 });
        }
      } catch (e) {}
    });
    hit.on('pointerout', () => {
      renderBtn(false);
      btnTxt.setStyle({ color: '#a0b0d0' });
    });
    hit.on('pointerdown', () => {
      this._toast((avail && avail.reason) || 'Платежи будут доступны после запуска на площадках');
    });

    return c;
  }

  _toast(msg) {
    const _cx = gameW(this) / 2;
    try {
      if (this._toastObj) this._toastObj.destroy();
      const t = this.add.text(_cx, 690, msg, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#161936ee',
        padding: { left: 16, right: 16, top: 8, bottom: 8 }
      }).setOrigin(0.5).setDepth(150);
      t.setStroke('#080916', 3);
      this._toastObj = t;

      this.tweens.add({
        targets: t,
        y: 668,
        duration: 250,
        ease: 'Back.Out'
      });

      this.time.delayedCall(2400, () => {
        try {
          if (this._toastObj === t) {
            this.tweens.add({
              targets: t,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                try { t.destroy(); } catch (e) {}
                if (this._toastObj === t) this._toastObj = null;
              }
            });
          }
        } catch (e) {}
      });
    } catch (e) {}
  }
}
