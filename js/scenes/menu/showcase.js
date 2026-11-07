import { gameState, mostPlayedClass, expRequired, getEquipment } from '../../data/gameState.js';
import { getRank } from '../../data/ranks.js';
import { classDefinitions } from '../../data/weapons.js';
import Assault from '../../entities/Assault.js';
import Tank from '../../entities/Tank.js';
import Medic from '../../entities/Medic.js';
import Sniper from '../../entities/Sniper.js';
import { gameW } from '../../ui/layout.js';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

// Версия игры (бета, не выпущена).
export const GAME_VERSION = 'Beta v0.21';

export function createShowcase(cx, w, badgeMaxW) {
  const cls = mostPlayedClass();
  const cd = classDefinitions.find(v => v.id === cls) || classDefinitions[0];

  // Голографический тактический пьедестал под ногами оперативника
  const pedY = 376;
  const pedG = this.add.graphics();
  // Мягкая внешняя тень платформы
  pedG.fillStyle(0x000000, 0.45);
  pedG.fillEllipse(cx, pedY + 4, 260, 58);
  // Внутреннее свечение пьедестала
  pedG.fillStyle(0x0e1728, 0.88);
  pedG.fillEllipse(cx, pedY, 230, 48);
  // Золотой контур платформы
  pedG.lineStyle(2.5, 0xd8a920, 0.95);
  pedG.strokeEllipse(cx, pedY, 230, 48);
  // Внутреннее тактическое кольцо
  pedG.lineStyle(1.5, 0x4da6ff, 0.55);
  pedG.strokeEllipse(cx, pedY, 175, 36);
  // Центровой диск
  pedG.fillStyle(0x16223d, 0.7);
  pedG.fillEllipse(cx, pedY, 110, 24);
  pedG.lineStyle(1, 0xd8a920, 0.6);
  pedG.strokeEllipse(cx, pedY, 110, 24);
  // Тактические риски по краям платформы
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const rx1 = cx + Math.cos(a) * 105;
    const ry1 = pedY + Math.sin(a) * 21;
    const rx2 = cx + Math.cos(a) * 115;
    const ry2 = pedY + Math.sin(a) * 24;
    pedG.lineStyle(2, 0xd8a920, 0.8);
    pedG.lineBetween(rx1, ry1, rx2, ry2);
  }

  // Плавающий бейдж звания и рейтинга над оперативником
  const bY = 138;
  const rating = Math.max(0, gameState.onlineRating | 0);
  const rNum = rating >= 10000
    ? (rating / 1000).toFixed(1).replace('.', ',') + 'k'
    : `${rating}`;

  const badgeW = 270;
  const badgeH = 46;
  const rBg = this.add.graphics();
  rBg.fillStyle(0x0b0e1a, 0.92);
  rBg.fillRoundedRect(cx - badgeW / 2, bY - badgeH / 2, badgeW, badgeH, 10);
  rBg.lineStyle(1.5, 0x8a6a10, 0.9);
  rBg.strokeRoundedRect(cx - badgeW / 2, bY - badgeH / 2, badgeW, badgeH, 10);
  // Золотая акцентная полоска сверху
  rBg.fillStyle(0xd8a920, 1);
  rBg.fillRoundedRect(cx - badgeW / 2 + 10, bY - badgeH / 2, badgeW - 20, 2.5, 1);

  // Звание и класс
  this.add.text(cx - 30, bY - 8, getRank(gameState.level), {
    fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
  }).setOrigin(0.5);

  const classBadgeColor = cd.color != null ? (typeof cd.color === 'string' ? cd.color : '#' + cd.color.toString(16).padStart(6, '0')) : '#4da6ff';
  this.add.text(cx - 30, bY + 9, cd.label.toUpperCase(), {
    fontSize: '11px', color: classBadgeColor, fontStyle: 'bold'
  }).setOrigin(0.5);

  // Капсула рейтинга справа внутри бейджа
  const cupPillX = cx + 82;
  const cupPill = this.add.graphics();
  cupPill.fillStyle(0x181a28, 0.95);
  cupPill.fillRoundedRect(cupPillX - 44, bY - 14, 88, 28, 6);
  cupPill.lineStyle(1, 0xd8a920, 0.85);
  cupPill.strokeRoundedRect(cupPillX - 44, bY - 14, 88, 28, 6);

  const ccx = cupPillX - 26;
  const ccy = bY;
  if (this.textures.exists('значок очки рейтинга')) {
    const cupImg = this.add.image(ccx, ccy, 'значок очки рейтинга');
    try {
      const csrc = this.textures.get('значок очки рейтинга').getSourceImage();
      const csw = Math.max(1, (csrc && csrc.width) || 1);
      const csh = Math.max(1, (csrc && csrc.height) || 1);
      cupImg.setScale(Math.min(22 / csw, 22 / csh));
    } catch (e) { cupImg.setDisplaySize(20, 22); }
  } else {
    const cup = this.add.graphics();
    cup.fillStyle(0xffd24a, 1);
    cup.fillPoints([
      new Phaser.Geom.Point(ccx - 5, ccy - 5), new Phaser.Geom.Point(ccx + 5, ccy - 5),
      new Phaser.Geom.Point(ccx + 2.5, ccy + 2.5), new Phaser.Geom.Point(ccx - 2.5, ccy + 2.5)
    ], true);
    cup.lineStyle(1.5, 0xffd24a, 1);
    cup.lineBetween(ccx, ccy + 2.5, ccx, ccy + 6);
    cup.lineBetween(ccx - 4, ccy + 6, ccx + 4, ccy + 6);
  }

  this.add.text(cupPillX + 8, bY, `${rNum}`, {
    fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
  }).setOrigin(0.5);

  // Герой — живой анимированный риг по центру сцены
  try {
    if (this._showPreview) {
      try { this._showPreview.destroy(); } catch (e) {}
      this._showPreview = null;
    }
    this._showHat = null;
    const Cls = PREVIEW_CLASSES[cls] || PREVIEW_CLASSES.Assault;
    const hx = cx - 10, hy = 264;
    const p = new Cls(this, hx, hy, { name: 'showcase', team: 'blue', noDefaults: true });
    p.previewScale(1.85);
    try {
      const eq = getEquipment(cls);
      if (eq && eq.primary) {
        p.addWeapon(eq.primary);
        p.activeWeaponIndex = p.inventory.length - 1;
        p._lastGunName = null;
      }
    } catch (e) {}
    if (p.body) {
      p.body.setAllowGravity(false);
      p.body.setImmovable(true);
    }
    p.setVelocity(0, 0);
    p._editorGrounded = true;
    p.aimAt(hx + 240, hy - 10);
    p.updateBars();
    if (p.updateGun) p.updateGun();
    p.healthBar.setVisible(false);
    p.armorBar.setVisible(false);
    p.nameText.setVisible(false);
    if (!p.weapon) {
      p._gunAllowed = false;
      p._setGunVisible(false);
    }
    this._showPreview = p;
    this._showHat = null;
  } catch (e) { /* витрина не роняет меню */ }

  // Кнопка статистики под пьедесталом.
  // Используем Zone как единственный интерактивный объект — Container с текстовым
  // дочерним элементом смещает hit-область вверх из-за пересчёта getBounds().
  const sbCx = cx, sbCy = 422;
  const sbW = 126, sbH = 28;
  const sbBg = this.add.graphics();
  const paintSb = (hover) => {
    sbBg.clear();
    sbBg.fillStyle(hover ? 0x241d0c : 0x111628, 0.95);
    sbBg.fillRoundedRect(sbCx - sbW / 2, sbCy - sbH / 2, sbW, sbH, 6);
    sbBg.lineStyle(1.2, hover ? 0xffd24a : 0x8a6a10, 0.9);
    sbBg.strokeRoundedRect(sbCx - sbW / 2, sbCy - sbH / 2, sbW, sbH, 6);
  };
  paintSb(false);
  const sbTxt = this.add.text(sbCx, sbCy, '📊 СТАТИСТИКА', {
    fontSize: '11px',
    color: '#ffd24a',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  const statBtn = this.add.zone(sbCx, sbCy, sbW, sbH).setInteractive({ useHandCursor: true });
  statBtn.on('pointerdown', () => this._openStatsModal());
  statBtn.on('pointerover', () => {
    paintSb(true);
    sbTxt.setColor('#ffffff');
  });
  statBtn.on('pointerout', () => {
    paintSb(false);
    sbTxt.setColor('#ffd24a');
  });
}

// Тонкая люксовая ячейка сверху на весь экран: имя, клан, деньги, опыт и утилиты.
export function createTopBar() {
  const H = 42;
  const W = gameW(this);
  const bg = this.add.graphics();
  // Глубокий премиальный фон с золотой каймой
  bg.fillStyle(0x080a14, 0.96);
  bg.fillRect(0, 0, W, H);
  bg.lineStyle(1.5, 0xd8a920, 0.9);
  bg.lineBetween(0, H, W, H);
  // Мягкая тонкая линия глубины под каймой
  bg.lineStyle(1, 0x443008, 0.5);
  bg.lineBetween(0, H + 1, W, H + 1);

  // Слева: капсула игрока (имя + клан)
  let tx = 14;
  const pName = String(gameState.playerName || 'Игрок').slice(0, 14);
  const clanTag = (gameState.clan && gameState.clan.tag) ? `[${gameState.clan.tag}]` : null;

  const profPill = this.add.container(tx, 6);
  const profBg = this.add.graphics();
  profPill.add(profBg);

  const nameT = this.add.text(28, 15, pName, {
    fontSize: '15px', color: '#ffffff', fontStyle: 'bold'
  }).setOrigin(0, 0.5);
  profPill.add(nameT);
  let pW = 28 + nameT.displayWidth + 12;

  if (clanTag) {
    const clanT = this.add.text(pW, 15, clanTag, {
      fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    profPill.add(clanT);
    pW += clanT.displayWidth + 12;
  }

  profBg.fillStyle(0x131728, 0.92);
  profBg.fillRoundedRect(0, 0, pW, 30, 8);
  profBg.lineStyle(1, 0x3a4568, 0.9);
  profBg.strokeRoundedRect(0, 0, pW, 30, 8);

  // Значок профиля слева в капсуле
  const userG = this.add.graphics();
  userG.fillStyle(0x4da6ff, 1);
  userG.fillCircle(15, 12, 4);
  userG.fillRoundedRect(9, 18, 12, 6, 3);
  profPill.add(userG);

  profPill.setSize(pW, 30);
  profPill.setInteractive(new Phaser.Geom.Rectangle(0, 0, pW, 30), Phaser.Geom.Rectangle.Contains);
  profPill.input.cursor = 'pointer';
  profPill.on('pointerdown', () => this.scene.start('FriendsScene', { view: 'self', returnTo: 'MenuScene' }));
  profPill.on('pointerover', () => {
    profBg.lineStyle(1.5, 0xffd24a, 1);
    profBg.strokeRoundedRect(0, 0, pW, 30, 8);
    nameT.setColor('#ffff55');
  });
  profPill.on('pointerout', () => {
    profBg.lineStyle(1, 0x3a4568, 0.9);
    profBg.strokeRoundedRect(0, 0, pW, 30, 8);
    nameT.setColor('#ffffff');
  });

  tx += pW + 12;

  // Капсула монет
  const coinPill = this.add.container(tx, 6);
  const coinBg = this.add.graphics();
  coinPill.add(coinBg);

  const coinsIcon = this.add.image(18, 15, 'icon_coins').setOrigin(0.5).setDisplaySize(22, 17);
  this._topCoinsIcon = coinsIcon;
  coinPill.add(coinsIcon);

  const coinsVal = Number(gameState.coins || 0).toLocaleString('ru-RU');
  const coinsT = this.add.text(34, 15, coinsVal, {
    fontSize: '15px', color: '#ffe066', fontStyle: 'bold'
  }).setOrigin(0, 0.5);
  this._topCoinsT = coinsT;
  coinPill.add(coinsT);

  const cW = 34 + coinsT.displayWidth + 14;
  coinBg.fillStyle(0x18150a, 0.95);
  coinBg.fillRoundedRect(0, 0, cW, 30, 8);
  coinBg.lineStyle(1.5, 0x8a6a10, 0.9);
  coinBg.strokeRoundedRect(0, 0, cW, 30, 8);

  tx += cW + 12;

  // Капсула опыта и уровня
  const req = Math.max(1, expRequired(gameState.level));
  const frac = Phaser.Math.Clamp((gameState.experience | 0) / req, 0, 1);
  const bw = 120;

  // Измеряем текст опыта заранее для точной ширины плашки
  const expStr = `${gameState.experience | 0}/${req}`;
  const expProbe = this.add.text(0, 0, expStr, { fontSize: '11px', fontStyle: 'bold' });
  const expTxtW = expProbe.displayWidth;
  expProbe.destroy();

  const expPillW = 54 + bw + 10 + expTxtW + 12;

  const expPill = this.add.graphics();
  expPill.fillStyle(0x101322, 0.92);
  expPill.fillRoundedRect(tx, 6, expPillW, 30, 8);
  expPill.lineStyle(1, 0x2e3852, 0.85);
  expPill.strokeRoundedRect(tx, 6, expPillW, 30, 8);

  // Значок уровня
  const lvlBg = this.add.graphics();
  lvlBg.fillStyle(0xd8a920, 1);
  lvlBg.fillRoundedRect(tx + 4, 9, 44, 24, 6);
  this.add.text(tx + 26, 21, `УР.${gameState.level}`, {
    fontSize: '11px', color: '#090a14', fontStyle: 'bold'
  }).setOrigin(0.5);

  // Полоска прогресса опыта
  const barX = tx + 54;
  const barG = this.add.graphics();
  barG.fillStyle(0x1b2033, 1);
  barG.fillRoundedRect(barX, 15, bw, 12, 5);
  if (frac > 0) {
    barG.fillStyle(0xffcc33, 1);
    barG.fillRoundedRect(barX, 15, Math.max(8, bw * frac), 12, 5);
    barG.fillStyle(0xffe680, 0.85);
    barG.fillRoundedRect(barX, 15, Math.max(8, bw * frac), 4, 2);
  }
  barG.lineStyle(1, 0x404d70, 0.8);
  barG.strokeRoundedRect(barX, 15, bw, 12, 5);

  this.add.text(barX + bw + 10, 21, expStr, {
    fontSize: '11px', color: '#c4d0ec', fontStyle: 'bold'
  }).setOrigin(0, 0.5);

  // Правая группа элементов (утилиты, магазин, настройки)
  // Донат-витрина (пончик)
  const donutBtn = this.add.container(W - 340, 6);
  const donBg = this.add.graphics();
  donBg.fillStyle(0x221a08, 0.95);
  donBg.fillRoundedRect(0, 0, 100, 30, 8);
  donBg.lineStyle(1.5, 0xd8a920, 0.9);
  donBg.strokeRoundedRect(0, 0, 100, 30, 8);
  donutBtn.add(donBg);

  const donIcon = this.add.text(18, 15, '🍩', { fontSize: '18px' }).setOrigin(0.5);
  const donTxt = this.add.text(34, 15, 'ДОНАТ', {
    fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
  }).setOrigin(0, 0.5);
  donutBtn.add([donIcon, donTxt]);

  donutBtn.setSize(100, 30);
  donutBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 100, 30), Phaser.Geom.Rectangle.Contains);
  donutBtn.input.cursor = 'pointer';
  donutBtn.on('pointerdown', () => this.scene.start('DonateScene'));
  donutBtn.on('pointerover', () => {
    donBg.lineStyle(2, 0xffe066, 1);
    donBg.strokeRoundedRect(0, 0, 100, 30, 8);
    donTxt.setColor('#ffffff');
    donutBtn.setScale(1.05);
  });
  donutBtn.on('pointerout', () => {
    donBg.lineStyle(1.5, 0xd8a920, 0.9);
    donBg.strokeRoundedRect(0, 0, 100, 30, 8);
    donTxt.setColor('#ffd24a');
    donutBtn.setScale(1);
  });

  // Кнопка быстрого перехода в Профиль (с комфортным отступом от истории боёв)
  const profTextBtn = this.add.container(W - 228, 6);
  const ptBg = this.add.graphics();
  ptBg.fillStyle(0x131a30, 0.92);
  ptBg.fillRoundedRect(0, 0, 82, 30, 8);
  ptBg.lineStyle(1, 0x3a4870, 0.9);
  ptBg.strokeRoundedRect(0, 0, 82, 30, 8);
  profTextBtn.add(ptBg);

  const ptTxt = this.add.text(41, 15, 'ПРОФИЛЬ', {
    fontSize: '12px', color: '#c4d4f8', fontStyle: 'bold'
  }).setOrigin(0.5);
  profTextBtn.add(ptTxt);

  profTextBtn.setSize(82, 30);
  profTextBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 82, 30), Phaser.Geom.Rectangle.Contains);
  profTextBtn.input.cursor = 'pointer';
  profTextBtn.on('pointerdown', () => this.scene.start('FriendsScene', { view: 'self', returnTo: 'MenuScene' }));
  profTextBtn.on('pointerover', () => {
    ptBg.lineStyle(1.5, 0xffd24a, 1);
    ptBg.strokeRoundedRect(0, 0, 82, 30, 8);
    ptTxt.setColor('#ffff55');
  });
  profTextBtn.on('pointerout', () => {
    ptBg.lineStyle(1, 0x3a4870, 0.9);
    ptBg.strokeRoundedRect(0, 0, 82, 30, 8);
    ptTxt.setColor('#c4d4f8');
  });

  // Иконки утилит справа: Достижения, История, Полный экран, Настройки
  this.createHistoryIcon(W - 118, 21);
  this.createAchIcon(W - 86, 21);
  this.createFullscreenButton(W - 54, 21);
  this.createGearButton(W - 22, 21);
}
