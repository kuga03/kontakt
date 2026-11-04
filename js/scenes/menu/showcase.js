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

// Баттл-пасс «Контракты» живёт в data/pass.js (40 ярусов × 2 ряда,
// сезон 30 дней, задания строго по порядку).
// Здесь — только позиция ленты (переживает переоткрытия окна).
let passScrollX = 0;

// Открытая секция центра («single» — режимы, «online» — мок онлайна).
// Модульная переменная — переживает перестройки колонки без рестарта сцены.
let openSection = 'single';

// Подписи режимов для истории боёв.

// Авторские PNG-значки для кнопок (id иконки → ключ текстуры).
// Нет файла — рисуется вектор из _drawBtnIcon.
const BTN_ICON_PNG = {
  cart: 'значок магазин',
  backpack: 'значок инвентарь',
  star: 'значок дерево навыков',
  dna: 'значок геном',
  case: 'значок кейсы',
  list: 'значок выбрать матч',
  friends: 'значок друзья',
  swords: 'значок свободная игра',
  globe: 'значок онлайн',
  flag: 'значок компания',
  skull: 'значок испытание',
  medal: 'значок рейтинг',
  bolt: 'значок быстрая игра',
  single: 'значок одиночная игра'
};

export function createShowcase(cx, w, badgeMaxW) {
    const K = 1.5;
    const cls = mostPlayedClass();
    const cd = classDefinitions.find(v => v.id === cls) || classDefinitions[0];

    const PW = w || 196;
    const PX = cx - PW / 2, PY = 148, PH = Math.round(474 / K);
    if (this.textures.exists('фон для блоков меню')) {
      const pimg = this.add.image(cx, PY + PH / 2, 'фон для блоков меню');
      pimg.setDisplaySize(PW, PH);
      pimg.setAlpha(0.7);
    }
    const g = this.add.graphics();
    if (!this.textures.exists('фон для блоков меню')) {
      g.fillStyle(0x12122e, 0.92);
      g.fillRoundedRect(PX, PY, PW, PH, 12);
    }
    g.lineStyle(2, cd.color || 0x3a3a6a, 1);
    g.strokeRoundedRect(PX, PY, PW, PH, 12);

    // Рейтинг: бейдж НАД блоком персонажа — фон + кубок + цифра.
    // Это ОНЛАЙН-рейтинг: начинается с 0 и растёт только сетевыми боями,
    // одиночка на него не влияет. Блок крупный, почти впритык к соседям.
    const rating = Math.max(0, gameState.onlineRating | 0);
    const bY = PY - 26;
    const budget = Math.max(110, badgeMaxW || 190);
    const rNum = rating >= 10000
      ? (rating / 1000).toFixed(1).replace('.', ',') + 'k'
      : `${rating}`;
    let rFs = 15, rW = 0;
    const probe = this.add.text(-500, -500, '', {
      fontSize: '15px', fontStyle: 'bold'
    }).setOrigin(0.5);
    while (rFs >= 12) {
      probe.setFontSize(rFs);
      probe.setText(`Рейтинг: ${rNum}`);
      rW = probe.displayWidth;
      if (rW + 32 + 36 <= budget) break;
      rFs--;
    }
    const bgW = Math.ceil(rW) + 32 + 36;
    probe.destroy();
    const rBg = this.add.graphics();
    rBg.fillStyle(0x12122e, 0.95);
    rBg.fillRoundedRect(cx - bgW / 2, bY - 18, bgW, 36, 10);
    rBg.lineStyle(2, 0xffd24a, 0.9);
    rBg.strokeRoundedRect(cx - bgW / 2, bY - 18, bgW, 36, 10);
    const rT = this.add.text(cx + 10, bY, `Рейтинг: ${rNum}`, {
      fontSize: rFs + 'px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);
    // Значок слева от надписи: авторский PNG на тёмной подложке,
    // иначе рисованный кубок.
    const ccx = cx + 10 - rT.displayWidth / 2 - 19, ccy = bY;
    if (this.textures.exists('значок очки рейтинга')) {
      const rcb = this.add.graphics();
      rcb.fillStyle(0x0a0a1a, 0.85);
      rcb.fillCircle(ccx, ccy, 16);
      const cupImg = this.add.image(ccx, ccy, 'значок очки рейтинга');
      // Фит с сохранением пропорций: медалька 306×620, квадратом её
      // плющило вдвое (та же болячка, что была у значков кнопок).
      try {
        const csrc = this.textures.get('значок очки рейтинга').getSourceImage();
        const csw = Math.max(1, (csrc && csrc.width) || 1);
        const csh = Math.max(1, (csrc && csrc.height) || 1);
        cupImg.setScale(Math.min(30 / csw, 30 / csh));
      } catch (e) { cupImg.setDisplaySize(30, 30); }
    } else {
      const cup = this.add.graphics();
      cup.fillStyle(0xffd24a, 1);
      cup.fillPoints([
        new Phaser.Geom.Point(ccx - 6, ccy - 6), new Phaser.Geom.Point(ccx + 6, ccy - 6),
        new Phaser.Geom.Point(ccx + 3, ccy + 3), new Phaser.Geom.Point(ccx - 3, ccy + 3)
      ], true);
      cup.lineStyle(2, 0xffd24a, 1);
      cup.strokeCircle(ccx - 7, ccy - 3, 3.5);
      cup.strokeCircle(ccx + 7, ccy - 3, 3.5);
      cup.lineStyle(2, 0xffd24a, 1);
      cup.lineBetween(ccx, ccy + 3, ccx, ccy + 7);
      cup.lineBetween(ccx - 5, ccy + 7, ccx + 5, ccy + 7);
    }
    this.add.text(cx, PY + 14, getRank(gameState.level), {
      fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(cx, PY + 32, cd.label, {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Герой — тот же живой риг, что в инвентаре (Preview-класс + снаряжение
    // из инвентаря), а не статичные PNG. Класс — самый наигранный по боям.
    // Крупный (×1.75 — ровно ×2 в щель 237px не влезает: фигура 254px;
    // верх = якорь−67k, низ = якорь+60k).
    try {
      if (this._showPreview) {
        try { this._showPreview.destroy(); } catch (e) {}
        this._showPreview = null;
      }
      this._showHat = null;
      const Cls = PREVIEW_CLASSES[cls] || PREVIEW_CLASSES.Assault;
      const hx = cx - 12, hy = 303;
      const p = new Cls(this, hx, hy, { name: 'showcase', team: 'blue', noDefaults: true });
      p.previewScale(1.75);
      // Витрина — как в редакторе, но ствол честный: тот, что реально надет
      // у класса в инвентаре (раньше всегда выдавался АК — врало после
      // сброса/смены снаряжения). Пустые руки прячутся ниже, как было.
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
      p.aimAt(hx + 200, hy - 10);
      p.updateBars();
      if (p.updateGun) p.updateGun();
      p.healthBar.setVisible(false);
      p.armorBar.setVisible(false);
      p.nameText.setVisible(false);
      // Безоружный класс: прячем и векторный ствол (иначе рисует силуэт).
      if (!p.weapon) {
        p._gunAllowed = false;
        p._setGunVisible(false);
      }
      this._showPreview = p;
      // Убор рисует сам персонаж (capImg из экипировки) — дубль поверх
      // больше не нужен (давал две балаклавы).
      this._showHat = null;
    } catch (e) { /* витрина не роняет меню */ }
    // Кнопка статистики вместо двух строк (влезает в панель).
    const statBtn = this.add.text(cx, PY + PH - 20, 'СТАТИСТИКА', {
      fontSize: '13px', color: '#ffffff', backgroundColor: '#252560', padding: 7
    }).setOrigin(0.5);
    statBtn.setInteractive({ useHandCursor: true });
    statBtn.on('pointerdown', () => this._openStatsModal());
    statBtn.on('pointerover', () => statBtn.setStyle({ color: '#ffff55' }));
    statBtn.on('pointerout', () => statBtn.setStyle({ color: '#ffffff' }));
  }

  // Тонкая ячейка сверху на весь экран: слева монеты + опыт, справа кнопки.
export function createTopBar() {
    const H = 38;
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d22, 0.95);
    bg.fillRect(0, 0, gameW(this), H);
    bg.lineStyle(1, 0x3a3a6a, 1);
    bg.lineBetween(0, H, gameW(this), H);

    // Слева направо: имя, клан, деньги, опыт.
    let tx = 14;
    const nameT = this.add.text(tx, H / 2, String(gameState.playerName || 'Игрок').slice(0, 14), {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    tx += nameT.displayWidth + 12;
    if (gameState.clan && gameState.clan.tag) {
      const clanT = this.add.text(tx, H / 2, `[${gameState.clan.tag}]`, {
        fontSize: '14px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      tx += clanT.displayWidth + 12;
    }
    const coinsIcon = this.add.image(tx + 12, H / 2, 'icon_coins').setOrigin(0.5).setDisplaySize(24, 18);
    // Цель для анимации монет (куда летят значки при клейме наград).
    this._topCoinsIcon = coinsIcon;
    tx += 24 + 6;
    const coinsT = this.add.text(tx, H / 2, `${gameState.coins}`, {
      fontSize: '18px', color: '#ffee88', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    // Ссылка для живого обновления после клейма контрактов/покупок.
    this._topCoinsT = coinsT;
    tx += coinsT.displayWidth + 20;

    // Шкала опыта + уровень.
    const bx = tx;
    const bw = 150;
    const req = Math.max(1, expRequired(gameState.level));
    const frac = Phaser.Math.Clamp((gameState.experience | 0) / req, 0, 1);
    const bar = this.add.graphics();
    bar.fillStyle(0x22223a, 1);
    bar.fillRoundedRect(bx, H / 2 - 6, bw, 12, 6);
    bar.fillStyle(0xffee55, 1);
    bar.fillRoundedRect(bx, H / 2 - 6, Math.max(10, bw * frac), 12, 6);
    this.add.text(bx + bw + 10, H / 2, `Ур. ${gameState.level} · ${gameState.experience | 0}/${req}`, {
      fontSize: '14px', color: '#ffeeaa'
    }).setOrigin(0, 0.5);

    // Свой профиль: открывает Друзей сразу с открытым окном профиля.
    const profBtn = this.add.text(gameW(this) - 300, H / 2, '👤 ПРОФИЛЬ', {
      fontSize: '14px', color: '#ffffff', backgroundColor: '#252560', padding: 6
    }).setOrigin(0.5);
    profBtn.setInteractive({ useHandCursor: true });
    profBtn.on('pointerdown', () => this.scene.start('FriendsScene', { view: 'self', returnTo: 'MenuScene' }));
    profBtn.on('pointerover', () => profBtn.setStyle({ color: '#ffff55' }));
    profBtn.on('pointerout', () => profBtn.setStyle({ color: '#ffffff' }));

    // Пончик (донат-витрина): открывает отдельное меню доната.
    const donutBtn = this.add.text(gameW(this) - 410, H / 2, '🍩', {
      fontSize: '26px'
    }).setOrigin(0.5);
    donutBtn.setInteractive({ useHandCursor: true });
    donutBtn.on('pointerdown', () => this.scene.start('DonateScene'));
    // Тексты в игре создаются с масштабом 0.5 (HiDPI-хак в game.js) —
    // запоминаем базовый и возвращаем его, иначе «обратно» не ужмётся.
    const donutBase = donutBtn.scaleX;
    donutBtn.on('pointerover', () => donutBtn.setScale(donutBase * 1.25));
    donutBtn.on('pointerout', () => donutBtn.setScale(donutBase));

    this.createAchIcon(gameW(this) - 134, H / 2 + 1);
    this.createHistoryIcon(gameW(this) - 186, H / 2 + 1);
    this.createFullscreenButton(gameW(this) - 82, H / 2 + 1);
    this.createGearButton(gameW(this) - 38, H / 2 + 1);
  }

  // Иконка-часы истории боёв: авторский PNG, иначе вектор.
  // Открывает инвентарь на виде истории.
