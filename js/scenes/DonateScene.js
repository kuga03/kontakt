// DonateScene — отдельное меню доната (вход — пончик из топбара меню).
// Раньше жило скрытой вкладкой ShopScene (tab 'donate') — вынесено наружу,
// чтобы «Снаряжение» осталось про оружие и модернизацию.
import { DONATE_ITEMS } from '../data/donate.js?v=170';
import { donateAvailable } from '../platform/index.js?v=169';
import { gameW, UX } from '../ui/layout.js?v=3';

export default class DonateScene extends Phaser.Scene {
  constructor() { super('DonateScene'); }

  create() {
    const _cx = gameW(this) / 2;
    this.cameras.main.setBackgroundColor('#0a0a2a');
    this.add.text(_cx, 25, 'ДОНАТ', {
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.add.text(_cx, 58, 'Донат: платежи подключатся с выходом на площадки.', {
      fontSize: '12px', color: '#667788'
    }).setOrigin(0.5);

    const back = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(50);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));
    back.on('pointerover', () => back.setStyle({ color: '#ffff55' }));
    back.on('pointerout', () => back.setStyle({ color: '#ffffff' }));
    try {
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
    } catch (e) {}

    // Витрина в прокручиваемой ленте: шапка стоит, карточки едут.
    // Wheel крутит только зону карточек (TOP–BOTTOM).
    let avail = null;
    try { avail = donateAvailable(); } catch (e) {}
    const CW = 360, CH = 140, GX = 40, GY = 20;
    const X0 = _cx - CW - GX / 2, X1 = _cx + GX / 2;
    const TOP = 100, BOTTOM = 700;
    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff);
    maskG.fillRect(0, TOP, gameW(this), BOTTOM - TOP);
    maskG.setVisible(false);
    const scroll = this.add.container(0, 0);
    scroll.setMask(maskG.createGeometryMask());

    let yy = TOP;
    const placePair = (cardA, cardB) => {
      const cy = yy + CH / 2;
      if (cardA) { cardA.setPosition(X0 + CW / 2, cy); scroll.add(cardA); }
      if (cardB) { cardB.setPosition(X1 + CW / 2, cy); scroll.add(cardB); }
      yy += CH + GY;
    };
    for (let i = 0; i < DONATE_ITEMS.length; i += 2) {
      const a = this._card(0, 0, CW, CH, DONATE_ITEMS[i], avail);
      const b = (i + 1 < DONATE_ITEMS.length) ? this._card(0, 0, CW, CH, DONATE_ITEMS[i + 1], avail) : null;
      placePair(a, b);
    }
    const maxScroll = Math.max(0, (yy - TOP) - (BOTTOM - TOP));
    let sv = 0;
    this.input.on('wheel', (pointer, _go, _dx, dy) => {
      if (pointer.y < TOP || pointer.y > BOTTOM) return;
      if (maxScroll <= 0) return;
      sv = Phaser.Math.Clamp(sv + dy * 0.5, 0, maxScroll);
      scroll.y = -sv;
    });
  }

  _card(x, y, w, h, item, avail) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x14142e, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(2, item.tag === 'ЭКСКЛЮЗИВ' ? 0xffd24a : 0x3a3a6a, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    c.add(bg);
    c.add(this.add.text(-w / 2 + 14, -h / 2 + 36, item.icon, {
      fontSize: '36px'
    }).setOrigin(0, 0.5));
    c.add(this.add.text(-w / 2 + 68, -h / 2 + 18, item.name, {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0));
    if (item.tag) {
      c.add(this.add.text(w / 2 - 12, -h / 2 + 14, item.tag, {
        fontSize: '11px', color: '#0a0a2a', backgroundColor: '#ffd24a', padding: 4
      }).setOrigin(1, 0));
    }
    c.add(this.add.text(-w / 2 + 68, -h / 2 + 44, item.desc, {
      fontSize: '12px', color: '#99aacc', wordWrap: { width: w - 88 }
    }).setOrigin(0, 0));
    c.add(this.add.text(-w / 2 + 16, h / 2 - 22, item.priceRub + ' ₽', {
      fontSize: '16px', color: '#ffee88', fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    const btn = this.add.text(w / 2 - 16, h / 2 - 22, 'СКОРО', {
      fontSize: '14px', color: '#bbbbcc', backgroundColor: '#444455', padding: 7
    }).setOrigin(1, 0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this._toast((avail && avail.reason) || 'Донат скоро появится'));
    c.add(btn);
    return c;
  }

  _toast(msg) {
    const _cx = gameW(this) / 2;
    try {
      if (this._toastObj) this._toastObj.destroy();
      this._toastObj = this.add.text(_cx, 690, msg, {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#252560', padding: 8
      }).setOrigin(0.5).setDepth(100);
      this.time.delayedCall(2200, () => {
        try { if (this._toastObj) this._toastObj.destroy(); } catch (e) {}
        this._toastObj = null;
      });
    } catch (e) {}
  }
}
