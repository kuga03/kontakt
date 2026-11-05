import { gameW, UX } from '../ui/layout.js';
import {
  gameState,
  unlockWeapon,
  unlockSkin,
  addCoins,
  saveGameState,
  syncGameState,
  getPass,
  recordPassProgress
} from '../data/gameState.js';

import { weaponsList, getWeaponLabel, weaponImage } from '../data/weapons.js';
import { weaponSkins } from '../data/skins.js';
import { GEAR_ITEMS, gearOwned, gearUnlockBuy, gearPreviewTex, GEAR_RARITY_WEIGHT } from '../data/wardrobe.js';
import { GEAR_SETS } from '../data/gearSets.js';

const REEL_DURATION = 4200;

// Три кейса по содержимому (прозрачно: хочешь геном — крути скины,
// хочешь пушку — крути оружие, хочешь шмот — гардероб). Ящика рядового
// больше нет: дешёвый объём им фармил лестницу. Дубликаты ПАДАЮТ СНОВА:
// за повтор дают 1/3 цены (оружие/шмот) или пыль (скин).
// Повторный скин (такая редкость уже собрана) — пыль: 12% цены кейса.
const CASES = [
  {
    id: 'wardrobe', name: 'Гардеробный', price: 1500, kind: 'gear',
    gearRate: 0.15,
    coinMin: 0.1, coinMax: 0.3, jackpotChance: 0.10,
    color: 0x2a5a4a, line: 0x66d9e8,
    desc: 'Шапки, броня, штаны и обувь, пыль тоже'
  },
  {
    id: 'weapons', name: 'Оружейный', price: 3000, kind: 'weapons',
    legRate: 0.015, epicW: 0.03, rareW: 0.07, commW: 0.13, grayW: 0.18,
    meleeShare: 1.0, skinProb: 0,
    coinMin: 0.1, coinMax: 0.5, jackpotChance: 0.12,
    minPrice: 300, maxPrice: 1e9, includeMelee: true,
    color: 0x2a4a6a, line: 0xb44dff,
    desc: 'Любое оружие, включая ножи, плюс деньги. Скинов нет'
  },
  {
    id: 'skins', name: 'Скины', price: 6000, kind: 'skins',
    // Путь к геному: легендарные скины (3%) + эпики для контрактов.
    // Ножевых скинов в пуле нет — леге-скины только с оружия.
    legRate: 0.01, epicW: 0.05, rareW: 0.10, commW: 0.12, grayW: 0.18,
    skinProb: 1.0,
    allowLegendarySkins: true,
    coinMin: 0.2, smallMax: 0.3, bigMin: 0.3, coinMax: 0.5, pBig: 0.45,
    jackpotChance: 0.15,
    minPrice: 300, maxPrice: 1e9, includeMelee: false,
    color: 0x4a2a6a, line: 0xffd24a,
    desc: 'Скины любой редкости, включая легендарные, плюс деньги'
  },
  // Гарантированные кейсы (переехали из витрины магазина): скин
  // фиксированной редкости без рулетки. Легендарный пул включает нож.
  {
    id: 'case_rare', name: 'Редкий', price: 8000, kind: 'skins',
    fixedRarity: 2,
    coinMin: 0.6, smallMax: 1.0, bigMin: 1.0, coinMax: 1.7, pBig: 0.45,
    jackpotChance: 0.15,
    color: 0x2a5a4a, line: 0x35d07f,
    desc: 'Гарантированно редкий скин'
  },
  {
    id: 'case_epic', name: 'Эпический', price: 20000, kind: 'skins',
    fixedRarity: 3,
    coinMin: 0.6, smallMax: 1.0, bigMin: 1.0, coinMax: 1.7, pBig: 0.45,
    jackpotChance: 0.15,
    color: 0x4a2a6a, line: 0xb44dff,
    desc: 'Гарантированно эпический скин'
  },
  {
    id: 'case_leg', name: 'Легендарный', price: 75000, kind: 'skins',
    fixedRarity: 4,
    coinMin: 0.6, smallMax: 1.0, bigMin: 1.0, coinMax: 1.7, pBig: 0.45,
    jackpotChance: 0.15,
    color: 0x4a3a10, line: 0xffd24a,
    desc: 'Гарантированно легендарный скин, включая нож'
  }
];

const TIER_COLORS = [0x9aa0a8, 0x3b9dff, 0x35d07f, 0xb44dff, 0xffd24a];
const TIER_NAMES = ['ШИРПОТРЕБ', 'ОБЫЧНЫЙ', 'РЕДКИЙ', 'ЭПИЧЕСКИЙ', 'ЛЕГЕНДАРНЫЙ'];

const CASE_SHOWCASE_INFO = {
  wardrobe: {
    tag: 'ЭКИПИРОВКА',
    tagColor: 0x66d9e8,
    chips: [
      { text: '🧢 Головные уборы', color: '#66d9e8' },
      { text: '🦺 Броня и одежда', color: '#66d9e8' },
      { text: '⚡ Добивка сетов 3%', color: '#ffd24a' },
      { text: '🪙 Монеты & Пыль', color: '#ffee88' }
    ]
  },
  weapons: {
    tag: 'АРСЕНАЛ ОРУЖИЯ',
    tagColor: 0xb44dff,
    chips: [
      { text: '⚔ Все классы оружия', color: '#b44dff' },
      { text: '🗡 Ножи, мачете, катана', color: '#ffd24a' },
      { text: '💥 Джекпот до 50%', color: '#ffd24a' },
      { text: '🪙 Монеты при повторе', color: '#ffee88' }
    ]
  },
  skins: {
    tag: 'КОЛЛЕКЦИЯ СКИНОВ',
    tagColor: 0xffd24a,
    chips: [
      { text: '🎨 Скины любой редкости', color: '#ffd24a' },
      { text: '🧬 Эпики для генома', color: '#b44dff' },
      { text: '⭐ Легендарные скины', color: '#ffd24a' },
      { text: '🪙 Пыль за повторы', color: '#ffee88' }
    ]
  },
  case_rare: {
    tag: 'ГАРАНТИЯ: РЕДКИЙ',
    tagColor: 0x35d07f,
    chips: [
      { text: '★ Редкий скин Tier II', color: '#35d07f' },
      { text: '🛡 100% новый скин', color: '#35d07f' },
      { text: '💰 Пыль 25% если всё собрано', color: '#ffee88' }
    ]
  },
  case_epic: {
    tag: 'ГАРАНТИЯ: ЭПИЧЕСКИЙ',
    tagColor: 0xb44dff,
    chips: [
      { text: '★ Эпический скин Tier III', color: '#b44dff' },
      { text: '🧬 Подходит для контрактов', color: '#b44dff' },
      { text: '🛡 100% новый скин в коллекцию', color: '#ffd24a' }
    ]
  },
  case_leg: {
    tag: 'ГАРАНТИЯ: ЛЕГЕНДАРНЫЙ',
    tagColor: 0xffd24a,
    chips: [
      { text: '★ Легендарный скин Tier IV', color: '#ffd24a' },
      { text: '🗡 Включая ножи и топоры', color: '#ffd24a' },
      { text: '👑 Топовый статус', color: '#ffea70' }
    ]
  }
};

function weaponTier(weapon) {
  if (!weapon) return 0;
  if (weapon.category === 'melee') return 4;
  if (weapon.price < 2200) return 0;
  if (weapon.price <= 6000) return 1;
  if (weapon.price <= 12000) return 2;
  return 3;
}

export default class LootBoxScene extends Phaser.Scene {
  constructor() {
    super('LootBoxScene');
  }

  create(data) {
    syncGameState();
    const _cx = gameW(this) / 2;
    this.activeButton = null;
    this.opening = false;
    this.caseId = (data && data.caseId) || 'weapons';

    this._initBackground();
    this._initParticles();
    this._initHeader();
    this._drawCaseCards();
    this._initShowcase();
    this._initControls();

    this.refreshCase();
    this.refreshCoins();
    try { localStorage.removeItem('pendingLootSpin'); } catch (e) {}

    // Поддержка ESC для возврата в меню
    try {
      this.input.keyboard.on('keydown-ESC', () => {
        if (this.opening) return;
        this.scene.start('MenuScene');
      });
    } catch (e) {}

    this.events.once('shutdown', () => {
      this._particles = [];
      if (this._heroTween) {
        try { this._heroTween.stop(); } catch (e) {}
        this._heroTween = null;
      }
    });
  }

  update(time, delta) {
    this._updateParticles(time, delta);
  }

  // Трёхступенчатый градиент фона как в Инвентаре и Бандах + золотые разделители
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

    // Золотые акцентные разделители сверху и снизу
    bgb.lineStyle(1, 0xffd24a, 0.22);
    bgb.lineBetween(0, 56, W, 56);
    bgb.lineBetween(0, 692, W, 692);
  }

  // Мягкие парящие световые частицы на фоне
  _initParticles() {
    this._particles = [];
    const W = gameW(this);
    const count = 18;
    for (let i = 0; i < count; i++) {
      const g = this.add.graphics().setDepth(-8);
      const r = Phaser.Math.FloatBetween(1.2, 2.6);
      g.fillStyle(0xffd24a, 1);
      g.fillCircle(0, 0, r);
      const p = {
        gfx: g,
        x: Phaser.Math.Between(40, W - 40),
        y: Phaser.Math.Between(70, 680),
        speed: Phaser.Math.FloatBetween(10, 28),
        baseAlpha: Phaser.Math.FloatBetween(0.10, 0.35),
        seed: Math.random() * 100,
        radius: r
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
      p.x += Math.sin(time * 0.0012 + p.seed) * 0.35;
      if (p.y < 65) {
        p.y = 685;
        p.x = Phaser.Math.Between(40, W - 40);
      }
      p.gfx.setPosition(p.x, p.y);
    }
  }

  // Верхняя шапка: Кнопка Назад, Заголовок с золотым ромбом, Баланс монет в плашке
  _initHeader() {
    const _cx = gameW(this) / 2;

    // Заголовок сцены
    this.add.text(_cx, 22, 'КЕЙСЫ', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(50);

    // Золотая черта с ромбом под заголовком
    const fl = this.add.graphics().setDepth(50);
    fl.lineStyle(2, 0xffd24a, 0.8);
    fl.lineBetween(_cx - 130, 42, _cx + 130, 42);
    fl.fillStyle(0xffd24a, 0.9);
    const dd = 5;
    fl.fillPoints([
      new Phaser.Geom.Point(_cx, 42 - dd), new Phaser.Geom.Point(_cx + dd, 42),
      new Phaser.Geom.Point(_cx, 42 + dd), new Phaser.Geom.Point(_cx - dd, 42)
    ], true);

    // Кнопка Назад в стиле меню Банды и Инвентаря
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
    this._backBtn = back;
    this._renderBack = renderBack;
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      if (this.opening) return;
      this.scene.start('MenuScene');
    });
    back.on('pointerover', () => {
      if (this.opening) return;
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

    // Плашка баланса монет (справа сверху)
    const coinPillX = gameW(this) - UX(this, 95);
    const coinPillY = 27;
    const pillW = 144, pillH = 34;
    const pillBg = this.add.graphics().setDepth(59);
    pillBg.fillStyle(0x131526, 0.95);
    pillBg.fillRoundedRect(coinPillX - pillW / 2, coinPillY - pillH / 2, pillW, pillH, 8);
    pillBg.lineStyle(1.5, 0xffd24a, 0.45);
    pillBg.strokeRoundedRect(coinPillX - pillW / 2, coinPillY - pillH / 2, pillW, pillH, 8);
    pillBg.fillStyle(0xffffff, 0.08);
    pillBg.fillRoundedRect(coinPillX - pillW / 2, coinPillY - pillH / 2, pillW, 4, { tl: 8, tr: 8, bl: 0, br: 0 });

    this.add.image(coinPillX - pillW / 2 + 18, coinPillY, 'icon_coins')
      .setOrigin(0.5).setDisplaySize(20, 15).setDepth(60);
    this.coinsText = this.add.text(coinPillX - pillW / 2 + 34, coinPillY, '', {
      fontSize: '15px',
      color: '#ffee88',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(60);
  }

  // Карточки кейсов: аккуратная лента вверху с категориями, артом, подсветкой выбора
  _drawCaseCards() {
    if (this.caseCards) this.caseCards.forEach(c => c.container.destroy());
    this.caseCards = [];

    const _cx = gameW(this) / 2;
    const W = 196;
    const H = 98;
    const step = 208;
    const startX = _cx - (5 * step) / 2;
    const cy = 114;

    CASES.forEach((c, i) => {
      const cx = startX + i * step;
      const container = this.add.container(cx, cy).setDepth(30);
      const frame = this.add.graphics();
      const pointerMarker = this.add.graphics();

      const paintCard = (selected, hovered) => {
        frame.clear();
        pointerMarker.clear();

        const bgCol = selected ? 0x181a33 : (hovered ? 0x16182c : 0x111324);
        frame.fillStyle(bgCol, 0.98);
        frame.fillRoundedRect(-W / 2, -H / 2, W, H, 10);

        // Верхняя акцентная полоска цвета кейса (3px толщиной)
        frame.fillStyle(c.line, selected ? 1 : 0.7);
        frame.fillRoundedRect(-W / 2 + 3, -H / 2 + 2, W - 6, 3, { tl: 8, tr: 8, bl: 0, br: 0 });

        // Внутренний блик
        frame.lineStyle(1, 0xffffff, selected ? 0.16 : 0.06);
        frame.strokeRoundedRect(-W / 2 + 2, -H / 2 + 2, W - 4, H - 4, 8);

        if (selected) {
          // Двойная золотая рамка с внешним свечением
          frame.lineStyle(2.5, 0xffe066, 1);
          frame.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
          frame.lineStyle(2, 0xffe066, 0.28);
          frame.strokeRoundedRect(-W / 2 - 4, -H / 2 - 4, W + 8, H + 8, 13);

          // Стрелочка-указатель вниз к витрине
          pointerMarker.fillStyle(0xffe066, 1);
          pointerMarker.fillPoints([
            new Phaser.Geom.Point(0, H / 2 + 8),
            new Phaser.Geom.Point(-7, H / 2 + 1),
            new Phaser.Geom.Point(7, H / 2 + 1)
          ], true);
        } else {
          frame.lineStyle(hovered ? 1.5 : 1, c.line, hovered ? 0.9 : 0.45);
          frame.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
        }
      };

      container.add(frame);
      container.add(pointerMarker);

      // Название кейса вверху карточки с просторным отступом от цветной полосы (не впритык!)
      const name = this.add.text(0, -27, c.name, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0.5);
      container.add(name);

      // Иконка кейса в центре
      const texKey = c.id.startsWith('case_') ? c.id : 'case_' + c.id;
      const hasArt = this.textures.exists(texKey);
      if (hasArt) {
        const img = this.add.image(0, 3, texKey);
        const src = this.textures.get(texKey).getSourceImage();
        if (src && src.width && src.height) {
          img.setScale(Math.min(130 / src.width, 32 / src.height));
        }
        container.add(img);
      } else {
        const ph = this.add.graphics();
        ph.fillStyle(c.color, 1);
        ph.fillCircle(0, 3, 14);
        ph.lineStyle(2, c.line, 1);
        ph.strokeCircle(0, 3, 14);
        container.add(ph);
      }

      // Плашка цены внизу карточки (отдельная чёткая зона)
      const priceCapsule = this.add.graphics();
      const pw = 88, ph = 18;
      priceCapsule.fillStyle(0x0a0c18, 0.85);
      priceCapsule.fillRoundedRect(-pw / 2, 28, pw, ph, 5);
      priceCapsule.lineStyle(1, 0xffd24a, 0.35);
      priceCapsule.strokeRoundedRect(-pw / 2, 28, pw, ph, 5);
      container.add(priceCapsule);

      const coinIcon = this.add.image(-pw / 2 + 12, 37, 'icon_coins').setDisplaySize(13, 10);
      const priceText = this.add.text(2, 37, `${c.price.toLocaleString('ru-RU')}`, {
        fontSize: '11px',
        color: '#ffee88',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      container.add([coinIcon, priceText]);

      paintCard(c.id === this.caseId, false);

      container.setSize(W, H);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => {
        paintCard(c.id === this.caseId, true);
        container.y = cy - 2;
        try {
          if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
            this.sound.play('sfx_hover', { volume: 0.15 });
          }
        } catch (e) {}
      });
      container.on('pointerout', () => {
        paintCard(c.id === this.caseId, false);
        container.y = cy;
      });
      container.on('pointerdown', () => {
        if (this.opening) return;
        this.caseId = c.id;
        this.refreshCase();
      });

      this.caseCards.push({ id: c.id, container, paintCard });
    });
  }

  // Центральный постамент и витрина выбранного кейса (когда не идёт крутка)
  _initShowcase() {
    const _cx = gameW(this) / 2;
    const stageY = 368;

    this._showcaseCont = this.add.container(_cx, stageY).setDepth(20);

    // Фоновое мягкое свечение постамента
    this._stageGlow = this.add.graphics();
    this._showcaseCont.add(this._stageGlow);

    // Постамент (концентрические эллипсы)
    this._stageDais = this.add.graphics();
    this._showcaseCont.add(this._stageDais);

    // Тень под парящим кейсом
    this._heroShadow = this.add.graphics();
    this._heroShadow.y = 80;
    this._showcaseCont.add(this._heroShadow);

    // Парящий арт выбранного кейса
    this._heroImg = this.add.image(0, -22, 'case_weapons').setOrigin(0.5);
    this._showcaseCont.add(this._heroImg);

    // Анимация парения кейса
    this._heroTween = this.tweens.add({
      targets: this._heroImg,
      y: -36,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Шапка витрины: категория и крупное название
    this._showcaseCategory = this.add.text(0, -120, '', {
      fontSize: '12px',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    this._showcaseTitle = this.add.text(0, -98, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#080a14',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Описание содержимого в тёмной плашке
    this._showcaseDescBg = this.add.graphics();
    this._showcaseDesc = this.add.text(0, 96, '', {
      fontSize: '13px',
      color: '#c2cee0',
      align: 'center'
    }).setOrigin(0.5);

    // Контейнер чипов наград (фичи кейса)
    this._showcaseChipsCont = this.add.container(0, 124);

    this._showcaseCont.add([
      this._showcaseCategory,
      this._showcaseTitle,
      this._showcaseDescBg,
      this._showcaseDesc,
      this._showcaseChipsCont
    ]);
  }

  // Обновление витрины при выборе другого кейса
  _updateShowcase(c) {
    if (!this._showcaseCont) return;

    const info = CASE_SHOWCASE_INFO[c.id] || { tag: 'КЕЙС', chips: [] };
    const colorHex = '#' + c.line.toString(16).padStart(6, '0');

    // 1. Свечение
    this._stageGlow.clear();
    this._stageGlow.fillStyle(c.line, 0.07);
    this._stageGlow.fillCircle(0, 20, 140);
    this._stageGlow.fillStyle(c.line, 0.12);
    this._stageGlow.fillCircle(0, 30, 80);

    // 2. Постамент
    this._stageDais.clear();
    // Внешний эллипс
    this._stageDais.fillStyle(0x0a0c18, 0.9);
    this._stageDais.fillEllipse(0, 80, 270, 56);
    this._stageDais.lineStyle(2, c.line, 0.55);
    this._stageDais.strokeEllipse(0, 80, 270, 56);
    // Внутренний светящийся эллипс
    this._stageDais.fillStyle(c.line, 0.15);
    this._stageDais.fillEllipse(0, 80, 190, 38);
    this._stageDais.lineStyle(1.5, 0xffffff, 0.4);
    this._stageDais.strokeEllipse(0, 80, 190, 38);

    // 3. Тень под кейсом
    this._heroShadow.clear();
    this._heroShadow.fillStyle(0x000000, 0.45);
    this._heroShadow.fillEllipse(0, 0, 140, 28);

    // 4. Текстура кейса
    const texKey = c.id.startsWith('case_') ? c.id : 'case_' + c.id;
    if (this.textures.exists(texKey)) {
      this._heroImg.setTexture(texKey);
      const src = this.textures.get(texKey).getSourceImage();
      if (src && src.width && src.height) {
        this._heroImg.setScale(Math.min(220 / src.width, 96 / src.height));
      }
      this._heroImg.setVisible(true);
    } else {
      this._heroImg.setVisible(false);
    }

    // 5. Заголовки
    this._showcaseCategory.setText(`[ ${info.tag} ]`);
    this._showcaseCategory.setColor(colorHex);

    this._showcaseTitle.setText(c.name.toUpperCase());

    // 6. Описание
    this._showcaseDesc.setText(c.desc);
    const tw = Math.max(340, this._showcaseDesc.displayWidth + 32);
    this._showcaseDescBg.clear();
    this._showcaseDescBg.fillStyle(0x0e1022, 0.85);
    this._showcaseDescBg.fillRoundedRect(-tw / 2, 83, tw, 26, 6);
    this._showcaseDescBg.lineStyle(1, 0xffffff, 0.1);
    this._showcaseDescBg.strokeRoundedRect(-tw / 2, 83, tw, 26, 6);

    // 7. Фиче-чипы (лут-превью)
    this._showcaseChipsCont.removeAll(true);
    const chips = info.chips || [];
    let chipTotalW = 0;
    const chipItems = [];

    chips.forEach(ch => {
      const txt = this.add.text(0, 0, ch.text, {
        fontSize: '12px',
        color: ch.color || '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const cw = txt.displayWidth + 20;
      const chH = 22;
      const bg = this.add.graphics();
      bg.fillStyle(0x13162b, 0.9);
      bg.fillRoundedRect(-cw / 2, -chH / 2, cw, chH, 5);
      bg.lineStyle(1, Phaser.Display.Color.HexStringToColor(ch.color || '#ffffff').color, 0.35);
      bg.strokeRoundedRect(-cw / 2, -chH / 2, cw, chH, 5);

      const cont = this.add.container(0, 0, [bg, txt]);
      chipItems.push({ cont, w: cw });
      chipTotalW += cw + 10;
    });

    chipTotalW -= 10;
    let curX = -chipTotalW / 2;
    chipItems.forEach(item => {
      item.cont.x = curX + item.w / 2;
      this._showcaseChipsCont.add(item.cont);
      curX += item.w + 10;
    });
  }

  // Нижняя панель управления: Мульти-чипы (x1/x2/x3) и Сочная кнопка открытия
  _initControls() {
    const _cx = gameW(this) / 2;

    this.result = this.add.text(_cx, 532, '', {
      fontSize: '17px',
      color: '#ff6666',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(45);

    // Мультипликатор открытия: x1 / x2 / x3
    this.openCount = 1;
    this.countChips = [];
    const chipSteps = [-70, 0, 70];
    [1, 2, 3].forEach((n, i) => {
      const chipX = _cx + chipSteps[i];
      const chipY = 566;
      const chipW = 58, chipH = 30;

      const cont = this.add.container(chipX, chipY).setDepth(45);
      const bg = this.add.graphics();
      const txt = this.add.text(0, 0, `×${n}`, {
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      cont.add([bg, txt]);
      cont.setSize(chipW, chipH);
      cont.setInteractive({ useHandCursor: true });

      const paintChip = (active, hovered) => {
        bg.clear();
        if (active) {
          bg.fillStyle(0x4a2468, 1);
          bg.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 7);
          bg.fillStyle(0xffffff, 0.15);
          bg.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, 4, { tl: 7, tr: 7, bl: 0, br: 0 });
          bg.lineStyle(2, 0xffd24a, 1);
          bg.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 7);
          txt.setStyle({ color: '#ffff55' });
        } else {
          bg.fillStyle(hovered ? 0x222642 : 0x16182c, 0.95);
          bg.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 7);
          bg.lineStyle(1, hovered ? 0x667799 : 0x303550, 1);
          bg.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 7);
          txt.setStyle({ color: hovered ? '#ffffff' : '#8899aa' });
        }
      };

      cont.on('pointerdown', () => {
        if (this.opening) return;
        this.openCount = n;
        this.refreshOpen();
        try {
          if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
            this.sound.play('sfx_hover', { volume: 0.2 });
          }
        } catch (e) {}
      });
      cont.on('pointerover', () => {
        if (!this.opening) paintChip(this.openCount === n, true);
      });
      cont.on('pointerout', () => {
        paintChip(this.openCount === n, false);
      });

      this.countChips.push({ n, cont, paintChip });
    });

    // Главная кнопка ОТКРЫТЬ (сочная, выпуклая, с золотой каймой и монеткой)
    const btnW = 340, btnH = 52;
    const btnY = 632;
    this._openBtnCont = this.add.container(_cx, btnY).setDepth(45);
    this._openBtnGfx = this.add.graphics();
    this._openBtnCont.add(this._openBtnGfx);

    this.open = this.add.text(0, 0, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.openCoin = this.add.image(0, 0, 'icon_coins').setDisplaySize(20, 15);
    this._openBtnCont.add([this.open, this.openCoin]);

    this._openBtnCont.setSize(btnW, btnH);
    this._openBtnCont.setInteractive({ useHandCursor: true });

    this._openBtnCont.on('pointerdown', () => {
      if (this.opening) return;
      this._openBtnCont.setScale(0.97);
      this.openCase();
    });
    this._openBtnCont.on('pointerup', () => {
      this._openBtnCont.setScale(1);
    });
    this._openBtnCont.on('pointerover', () => {
      if (this.opening) return;
      this._openBtnCont.setScale(1.02);
      this._paintOpenBtn(true);
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.2 });
        }
      } catch (e) {}
    });
    this._openBtnCont.on('pointerout', () => {
      this._openBtnCont.setScale(1);
      this._paintOpenBtn(false);
    });
  }

  // Отрисовка сочной кнопки открытия
  _paintOpenBtn(hovered) {
    if (!this._openBtnGfx) return;
    const c = this._caseDef();
    const total = c.price * this.openCount;
    const canAfford = gameState.coins >= total;
    const btnW = 340, btnH = 52;

    this._openBtnGfx.clear();

    if (this.opening) {
      this._openBtnGfx.fillStyle(0x1a1e28, 0.85);
      this._openBtnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      this._openBtnGfx.lineStyle(1.5, 0x333b4d, 1);
      this._openBtnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    } else if (!canAfford) {
      // Не хватает монет: приглушённо-бордовый
      this._openBtnGfx.fillStyle(0x301a22, 0.95);
      this._openBtnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      this._openBtnGfx.lineStyle(1.5, 0x8a3a4a, 0.8);
      this._openBtnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    } else {
      // Изумрудно-зелёный градиент с золотым бликом и кантом
      this._openBtnGfx.fillStyle(hovered ? 0x278749 : 0x1d6c3a, 1);
      this._openBtnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);

      // Верхний глянцевый блик
      this._openBtnGfx.fillStyle(0xffffff, hovered ? 0.22 : 0.12);
      this._openBtnGfx.fillRoundedRect(-btnW / 2 + 2, -btnH / 2 + 2, btnW - 4, 14, { tl: 10, tr: 10, bl: 0, br: 0 });

      // Золотая кайма
      this._openBtnGfx.lineStyle(hovered ? 2.5 : 2, 0xffd24a, 1);
      this._openBtnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    }
  }

  _savePendingSpin(rewards) {
    try {
      const data = rewards.map(r => {
        if (r.type === 'coins') return { type: 'coins', amount: r.amount, jackpot: r.jackpot, dust: r.dust };
        if (r.type === 'weapon' || r.type === 'dup') return { type: r.type, weaponName: r.weapon.name };
        if (r.type === 'skin') return { type: 'skin', skinId: r.skin.id };
        if (r.type === 'gear' || r.type === 'geardup') return { type: r.type, gearTex: r.gear ? r.gear.tex : null };
        return null;
      }).filter(Boolean);
      localStorage.setItem('pendingLootSpin', JSON.stringify({ rewards: data, caseId: this.caseId }));
    } catch (e) {}
  }

  _restorePendingSpin() {
    try {
      const raw = localStorage.getItem('pendingLootSpin');
      if (!raw) return;
      localStorage.removeItem('pendingLootSpin');
      const data = JSON.parse(raw);
      if (!data || !data.rewards || !data.rewards.length) return;
      const rewards = data.rewards.map(r => {
        if (r.type === 'coins') return { type: 'coins', amount: r.amount, jackpot: r.jackpot, dust: r.dust };
        if (r.type === 'weapon' || r.type === 'dup') {
          const w = weaponsList.find(w => w.name === r.weaponName);
          if (w) return { type: r.type, weapon: w };
          return { type: 'coins', amount: 100, jackpot: false, dust: true };
        }
        if (r.type === 'skin') {
          const s = weaponSkins.find(s => s.id === r.skinId);
          if (s) return { type: 'skin', skin: s };
          return { type: 'coins', amount: 100, jackpot: false, dust: true };
        }
        if (r.type === 'gear' || r.type === 'geardup') {
          const g = GEAR_ITEMS.find(g => g.tex === r.gearTex);
          if (g) return { type: r.type, gear: g };
          return { type: 'coins', amount: 100, jackpot: false, dust: true };
        }
        return null;
      }).filter(Boolean);
      if (!rewards.length) return;
      this.opening = true;
      this._hideRewards();
      this._clearReels();
      this._clearMultiIcons();
      this._pendingReels = rewards.length;
      this._finishedRewards = [];
      this._multiRewards = rewards.slice();
      this._multiLines = [];
      this._pendingFinalized = false;
      this._grantAllPending(rewards);
    } catch (e) {}
  }

  _grantAllPending(rewards) {
    rewards.forEach(rw => { try { this._grantReward(rw); } catch (e) {} });
    try { saveGameState(); } catch (e) {}
    this._showMultiIcons(rewards);
    this._showOkButton();
    this.refreshCoins();
    this.opening = false;
    this.refreshOpen();
    if (this._backBtn) this._backBtn.setStyle({ color: '#ffffff' });
  }

  _caseDef() {
    return CASES.find(c => c.id === this.caseId) || CASES[0];
  }

  refreshCase() {
    const c = this._caseDef();
    this._hideRewards();
    if (!this.opening) {
      this._clearReels();
      this._hideRewards();
    }
    (this.caseCards || []).forEach(card => {
      const on = card.id === c.id;
      if (card.paintCard) card.paintCard(on, false);
    });

    this._updateShowcase(c);
    this.result.setText('');
    this.refreshOpen();
  }

  refreshOpen() {
    const c = this._caseDef();
    const total = c.price * this.openCount;
    const canAfford = gameState.coins >= total;

    (this.countChips || []).forEach(chip => {
      chip.paintChip(chip.n === this.openCount, false);
    });

    if (this.opening) {
      this.open.setText('ОТКРЫВАЕТСЯ...').setFontSize('18px').setColor('#888888');
      this.openCoin.setVisible(false);
      this.open.setPosition(0, 0).setOrigin(0.5, 0.5);
    } else if (!canAfford) {
      this.open.setFontSize('14px');
      this.open.setText(`НЕДОСТАТОЧНО МОНЕТ (${total.toLocaleString('ru-RU')})`);
      this.open.setColor('#ff9999');
      this.openCoin.setVisible(true);

      const coinW = 20;
      const gap = 8;
      const totalW = this.open.displayWidth + coinW + gap;
      const startX = -totalW / 2;
      this.openCoin.setPosition(startX + coinW / 2, 0);
      this.open.setPosition(startX + coinW + gap, 0).setOrigin(0, 0.5);
    } else {
      this.open.setFontSize('17px');
      this.open.setText(`ОТКРЫТЬ ЗА ${total.toLocaleString('ru-RU')}`);
      this.open.setColor('#ffffff');
      this.openCoin.setVisible(true);

      const coinW = 20;
      const gap = 8;
      const totalW = this.open.displayWidth + coinW + gap;
      const startX = -totalW / 2;
      this.openCoin.setPosition(startX + coinW / 2, 0);
      this.open.setPosition(startX + coinW + gap, 0).setOrigin(0, 0.5);
    }

    this._paintOpenBtn(false);
  }

  refreshCoins() {
    this.coinsText.setText(`${gameState.coins.toLocaleString('ru-RU')}`);
  }

  // Пулы кейса: оружие по цене + скины ТОЛЬКО на это оружие.
  _casePools() {
    const c = this._caseDef();
    const ownedSkinIds = new Set(gameState.weaponSkins || []);
    const allowLegendary = !!c.includeMelee;
    const allowLegSkins = allowLegendary || !!c.allowLegendarySkins;
    const pool = weaponsList.filter(w =>
      (((w.price >= c.minPrice && w.price <= c.maxPrice && w.category !== 'melee') ||
      (c.includeMelee && w.category === 'melee' && w.caseOnly)) &&
      w.price > 0)
    );
    const poolNames = new Set();
    pool.forEach(w => poolNames.add(w.name));

    if (allowLegendary) poolNames.add('Knife');
    if (c.allowLegendarySkins) ['катана', 'мачете', 'топор'].forEach(n => poolNames.add(n));
    const caseSkins = weaponSkins.filter(s => {
      if (ownedSkinIds.has(s.id)) return false;
      if (!poolNames.has(s.weapon)) return false;
      if ((s.rarity ?? 1) >= 4 && !allowLegSkins) return false;
      return true;
    });

    const rarityExists = new Set();
    weaponSkins.forEach(s => {
      if (!poolNames.has(s.weapon)) return;
      if ((s.rarity ?? 1) >= 4 && !allowLegSkins) return;
      rarityExists.add(s.rarity ?? 1);
    });
    return { c, pool, caseSkins, allowLegendary, allowLegSkins, rarityExists };
  }

  rollReward() {
    const { c, pool, caseSkins, allowLegendary, allowLegSkins, rarityExists } = this._casePools();
    if (c.kind === 'gear') return this._rollGear();

    if (c.fixedRarity != null) {
      try {
        const ownedIds = new Set(gameState.weaponSkins || []);
        const pool = weaponSkins.filter(s => (s.rarity ?? 1) === c.fixedRarity && !ownedIds.has(s.id));
        if (pool.length) return { type: 'skin', skin: pool[(Math.random() * pool.length) | 0] };
      } catch (e) {}
      return { type: 'coins', amount: Math.max(1, Math.round(c.price * 0.25)), jackpot: false, dust: true };
    }

    const weaponsOnly = c.kind === 'weapons';
    const skinsOnly = c.kind === 'skins';
    const pickWeapon = (pred) => {
      if (skinsOnly) return null;
      const list = pool.filter(pred);
      return list.length ? Phaser.Math.RND.pick(list) : null;
    };
    const pickSkin = (rarity) => {
      if (weaponsOnly) return null;
      const list = caseSkins.filter(s => (s.rarity ?? 1) === rarity);
      return list.length ? Phaser.Math.RND.pick(list) : null;
    };

    const trySkin = (rarity) => {
      const sk = pickSkin(rarity);
      if (sk) return { type: 'skin', skin: sk };
      if (rarityExists.has(rarity)) {
        return { type: 'coins', amount: Math.max(1, Math.round(c.price * 0.25)), jackpot: false, dust: true };
      }
      return null;
    };
    const asWeapon = (weapon) => {
      if (!weapon) return null;
      if (gameState.unlockedWeapons.includes(weapon.name)) return { type: 'dup', weapon };
      return { type: 'weapon', weapon };
    };
    const r = Math.random();

    const legR = c.legRate ?? 0.01, epicW = c.epicW ?? 0.05;
    const rareW = c.rareW ?? 0.10, commW = c.commW ?? 0.12, grayW = c.grayW ?? 0.18;
    const skinP = c.skinProb ?? 0.5;
    const tE = legR + epicW, tR = tE + rareW, tB = tR + commW, tG = tB + grayW;

    if (r < legR && (allowLegendary || allowLegSkins)) {
      if (allowLegendary) {
        const melee = pool.filter(w => w.category === 'melee');
        const meleeShare = c.meleeShare ?? 0.5;
        if (melee.length && Math.random() < meleeShare) return asWeapon(Phaser.Math.RND.pick(melee)) || this._coinDrop(c, true);
      }
      const s4 = trySkin(4);
      if (s4 && s4.type === 'skin') return s4;
      if (allowLegendary) {
        const melee = pool.filter(w => w.category === 'melee');
        if (melee.length) return asWeapon(Phaser.Math.RND.pick(melee));
      }
      if (s4) return s4;
    }

    if (r < tE) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.category !== 'melee' && w.price > 12000);
        if (w) return asWeapon(w);
      }
      const s3 = trySkin(3);
      if (s3) return s3;
    }

    if (r < tR) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.category !== 'melee' && w.price > 6000 && w.price <= 12000);
        if (w) return asWeapon(w);
      }
      const s2 = trySkin(2);
      if (s2) return s2;
    }

    if (r < tB) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.price >= 2200 && w.price <= 6000);
        if (w) return asWeapon(w);
      }
      const s1 = trySkin(1);
      if (s1) return s1;
    }

    if (r < tG) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.price < 2200);
        if (w) return asWeapon(w);
      }
      const s0 = trySkin(0);
      if (s0) return s0;
    }

    if (Math.random() < (c.pBig ?? 0.37)) return this._coinDrop(c, true);
    return this._coinDrop(c, false);
  }

  _rollGear() {
    const c = this._caseDef();
    try {
      if (Math.random() < 0.03) {
        const need = [];
        GEAR_SETS.forEach(s => {
          const parts = [
            [s.pieces.head, 'head'], [s.pieces.torso, 'torso'],
            [s.pieces.pants, 'pants'], [s.pieces.shoes, 'shoes']
          ];
          const missing = parts.filter(([tex, slot]) => !gearOwned({ tex, slot }));
          if (missing.length === 1) {
            const meta = GEAR_ITEMS.find(g => g.tex === missing[0][0]);
            if (meta) need.push(meta);
          }
        });
        if (need.length) return { type: 'gear', gear: Phaser.Math.RND.pick(need), pity: true };
      }
    } catch (e) {}
    const fresh = GEAR_ITEMS.filter(g => !gearOwned(g));
    const r = Math.random();
    const rate = c.gearRate ?? 0.55;
    if (r < rate) {
      if (fresh.length) {
        try {
          const weights = fresh.map(g => GEAR_RARITY_WEIGHT[Math.min(4, Math.max(0, g.rarity ?? 1))]);
          let total = weights.reduce((a, b) => a + b, 0);
          let roll = Math.random() * total;
          let picked = fresh[fresh.length - 1];
          for (let i = 0; i < fresh.length; i++) {
            roll -= weights[i];
            if (roll <= 0) { picked = fresh[i]; break; }
          }
          return { type: 'gear', gear: picked };
        } catch (e) { return { type: 'gear', gear: Phaser.Math.RND.pick(fresh) }; }
      }
      return { type: 'coins', amount: Math.max(1, Math.round(c.price * 0.25)), jackpot: false, dust: true };
    }
    return Math.random() < (c.pBig ?? 0.37) ? this._coinDrop(c, true) : this._coinDrop(c, false);
  }

  _coinDrop(c, big) {
    const lo = big
      ? Math.round(c.price * (c.bigMin != null ? c.bigMin : 1))
      : Math.round(c.price * c.coinMin);
    const hi = big
      ? Math.round(c.price * c.coinMax)
      : Math.round(c.price * (c.smallMax != null ? c.smallMax : 1));
    const hi2 = Math.max(lo, hi);
    const amount = Phaser.Math.Between(Math.max(1, lo), hi2);
    const jackpot = big && amount >= Math.round(c.price * c.coinMax * 0.95);
    return { type: 'coins', amount, jackpot };
  }

  _poolEntryFor(reward) {
    if (reward.type === 'coins') {
      const e = { kind: 'coins', amount: reward.amount, jackpot: !!reward.jackpot };
      if (reward.dust) e.sub = 'повторный скин';
      return e;
    }
    if (reward.type === 'dup') {
      return {
        kind: 'coins',
        amount: Math.round(reward.weapon.price / 3),
        jackpot: false,
        sub: 'компенсация: ' + getWeaponLabel(reward.weapon.name)
      };
    }
    if (reward.type === 'geardup') {
      return {
        kind: 'coins',
        amount: Math.round((reward.gear ? reward.gear.price : 300) / 3),
        jackpot: false,
        sub: 'повтор: ' + (reward.gear ? reward.gear.label : 'одежда')
      };
    }
    if (reward.type === 'gear') {
      return { kind: 'gear', gear: reward.gear };
    }
    if (reward.type === 'weapon') {
      return { kind: 'weapon', weapon: reward.weapon, dup: false };
    }
    return { kind: 'skin', skin: reward.skin };
  }

  _randomPoolEntry() {
    const { c, pool, caseSkins } = this._casePools();
    const r = Math.random();
    if (c.kind === 'gear') {
      if (r < 0.3) {
        const fresh = GEAR_ITEMS.filter(g => !gearOwned(g));
        const src = fresh.length ? fresh : GEAR_ITEMS;
        if (src.length) {
          const gear = Phaser.Math.RND.pick(src);
          return { kind: 'gear', gear, dup: !fresh.length };
        }
      }
      const jackpot = Math.random() < c.jackpotChance;
      const mult = jackpot ? c.coinMax : c.coinMin + Math.random() * (c.coinMax - c.coinMin);
      return { kind: 'coins', amount: Math.round(c.price * mult), jackpot };
    }
    if (c.kind === 'weapons') {
      if (r < 0.45 && pool.length) {
        const weapon = Phaser.Math.RND.pick(pool);
        return { kind: 'weapon', weapon, dup: gameState.unlockedWeapons.includes(weapon.name) };
      }
      const jackpot = Math.random() < c.jackpotChance;
      const mult = jackpot ? c.coinMax : c.coinMin + Math.random() * (c.coinMax - c.coinMin);
      return { kind: 'coins', amount: Math.round(c.price * mult), jackpot };
    }
    if (c.kind === 'skins') {
      if (r < 0.45 && caseSkins.length) return { kind: 'skin', skin: Phaser.Math.RND.pick(caseSkins) };
      const jackpot = Math.random() < c.jackpotChance;
      const mult = jackpot ? c.coinMax : c.coinMin + Math.random() * (c.coinMax - c.coinMin);
      return { kind: 'coins', amount: Math.round(c.price * mult), jackpot };
    }
    if (r < 0.3) {
      const src = pool.length ? pool : weaponsList.filter(w => w.price > 0);
      if (src.length) {
        const weapon = Phaser.Math.RND.pick(src);
        return { kind: 'weapon', weapon, dup: gameState.unlockedWeapons.includes(weapon.name) };
      }
    }
    if (r < 0.55) {
      if (caseSkins.length) return { kind: 'skin', skin: Phaser.Math.RND.pick(caseSkins) };
    }
    const jackpot = Math.random() < c.jackpotChance;
    const mult = jackpot ? c.coinMax : c.coinMin + Math.random() * (c.coinMax - c.coinMin);
    return { kind: 'coins', amount: Math.round(c.price * mult), jackpot };
  }

  _tierCss(colorInt) {
    return '#' + colorInt.toString(16).padStart(6, '0');
  }

  _skinTier(skin) {
    const r = skin.rarity ?? 1;
    return Math.min(4, Math.max(0, r));
  }

  _tierLabel(tierIndex) {
    return TIER_NAMES[Math.min(4, Math.max(0, tierIndex))] || 'ПРЕДМЕТ';
  }

  // Ячейка рулетки с красивым оформлением, тиром редкости, бликами и центрированным артом
  _reelCell(entry, CELL_W, CELL_H, casePrice) {
    let colorInt;
    let tierIdx = 0;
    if (entry.kind === 'skin') {
      tierIdx = this._skinTier(entry.skin);
      const rc = String(entry.skin.rarityColor || '');
      colorInt = /^#[0-9a-fA-F]{6}$/.test(rc) ? parseInt(rc.slice(1), 16) : TIER_COLORS[tierIdx];
    } else if (entry.kind === 'coins') {
      tierIdx = entry.jackpot ? 4 : (casePrice && entry.amount > casePrice ? 1 : 0);
      colorInt = entry.jackpot ? TIER_COLORS[4] : (casePrice && entry.amount > casePrice ? TIER_COLORS[1] : TIER_COLORS[0]);
    } else if (entry.kind === 'gear') {
      tierIdx = entry.gear ? Math.min(4, Math.max(0, entry.gear.rarity ?? 1)) : 1;
      colorInt = TIER_COLORS[tierIdx];
    } else {
      tierIdx = weaponTier(entry.weapon);
      colorInt = TIER_COLORS[tierIdx];
    }
    const css = this._tierCss(colorInt);

    const container = this.add.container(0, 0);
    const W = CELL_W - 22;
    const H = CELL_H - 22;

    const bg = this.add.graphics();
    bg.fillStyle(0x0e1020, 0.96);
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 10);

    // Верхняя полоска тира редкости
    bg.fillStyle(colorInt, 0.9);
    bg.fillRoundedRect(-W / 2 + 3, -H / 2 + 2, W - 6, 3, { tl: 8, tr: 8, bl: 0, br: 0 });

    // Рамка цвета редкости
    bg.lineStyle(2.5, colorInt, 1);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);

    // Тонкий внутренний блик
    bg.lineStyle(1, 0xffffff, 0.12);
    bg.strokeRoundedRect(-W / 2 + 2, -H / 2 + 2, W - 4, H - 4, 8);

    // Бейдж тира (название редкости с просторным отступом от полоски)
    const tierName = this._tierLabel(tierIdx);
    const badgeY = -H / 2 + 22;
    const badgeText = this.add.text(0, badgeY, tierName, {
      fontSize: '11px',
      color: css,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const bw = Math.max(84, Math.ceil(badgeText.displayWidth + 18));
    const bh = 18;
    bg.fillStyle(0x070914, 0.85);
    bg.fillRoundedRect(-bw / 2, badgeY - bh / 2, bw, bh, 5);
    bg.lineStyle(1, colorInt, 0.4);
    bg.strokeRoundedRect(-bw / 2, badgeY - bh / 2, bw, bh, 5);

    container.add(bg);
    container.add(badgeText);

    if (entry.kind === 'coins') {
      const ih = Math.min(60, H * 0.35);
      const img = this.add.image(0, -10, 'icon_coins');
      img.setDisplaySize(ih / 0.77, ih);
      container.add(img);

      container.add(this.add.text(0, H / 2 - 36, `+${entry.amount.toLocaleString('ru-RU')}`, {
        fontSize: '24px', color: css, fontStyle: 'bold'
      }).setOrigin(0.5));

      if (entry.sub) {
        container.add(this.add.text(0, H / 2 - 14, entry.sub, {
          fontSize: '11px', color: '#ffcc88', align: 'center',
          wordWrap: { width: W - 16 }
        }).setOrigin(0.5));
      }
    } else if (entry.kind === 'weapon') {
      const imgKey = weaponImage(entry.weapon.name);
      if (this.textures.exists(imgKey)) {
        const img = this.add.image(0, -6, imgKey);
        const src = this.textures.get(imgKey).getSourceImage();
        if (src && src.width && src.height) {
          let sc = Math.min((W - 24) / src.width, 68 / src.height);
          if (entry.weapon.name === 'катана') {
            const rot = 0.32, co = Math.cos(rot), si = Math.sin(rot);
            const fitRot = Math.min(
              (W - 20) / (src.width * co + src.height * si),
              110 / (src.width * si + src.height * co)
            );
            sc = Math.min(sc * 2, fitRot);
            img.setRotation(rot);
          }
          img.setScale(sc);
        }
        container.add(img);
      }
      container.add(this.add.text(0, H / 2 - 24, getWeaponLabel(entry.weapon.name), {
        fontSize: '14px', color: css, fontStyle: 'bold', align: 'center',
        wordWrap: { width: W - 16 }
      }).setOrigin(0.5));
    } else if (entry.kind === 'gear' && entry.gear) {
      try {
        const gk = gearPreviewTex(entry.gear);
        if (gk && this.textures.exists(gk)) {
          const gimg = this.add.image(0, -6, gk);
          const gs = this.textures.get(gk).getSourceImage();
          if (gs && gs.width && gs.height) {
            gimg.setScale(Math.min((W - 24) / gs.width, 68 / gs.height));
          }
          container.add(gimg);
        }
      } catch (e) {}
      container.add(this.add.text(0, H / 2 - 24, entry.gear.label, {
        fontSize: '14px', color: entry.gear.rarityColor || css, fontStyle: 'bold',
        align: 'center', wordWrap: { width: W - 16 }
      }).setOrigin(0.5));
    } else {
      container.add(this.add.text(0, -4, entry.skin.name, {
        fontSize: '16px', color: entry.skin.rarityColor || css, fontStyle: 'bold',
        align: 'center', wordWrap: { width: W - 16 }
      }).setOrigin(0.5));
      container.add(this.add.text(0, H / 2 - 20, getWeaponLabel(entry.skin.weapon), {
        fontSize: '12px', color: '#99aacc'
      }).setOrigin(0.5));
    }
    return container;
  }

  // Звуковой щелчок рулетки при прокрутке ячейки (быстрый механический клик без тормозов)
  _playReelTick() {
    const now = (this.time && this.time.now) || Date.now();
    if (this._lastTickTime && (now - this._lastTickTime < 70)) return;
    this._lastTickTime = now;

    try {
      const sc = this.sound;
      if (!sc || sc.locked || !sc.context || typeof sc.context.createOscillator !== 'function') return;
      const ctx = sc.context;
      if (ctx.state === 'suspended') return;
      let vol = 0.05;
      try {
        const sv = gameState && gameState.sfxVol;
        vol = 0.05 * (Number.isFinite(+sv) ? Math.max(0, Math.min(1, +sv)) : 1);
      } catch (e) {}
      if (!(vol > 0.005)) return;
      const t0 = ctx.currentTime || 0;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, t0);
      osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.02);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.025);
    } catch (e) {}
  }

  openCase() {
    const c = this._caseDef();
    const total = c.price * this.openCount;
    if (gameState.coins < total) {
      this.result.setText('Недостаточно монет для открытия');
      this.refreshOpen();
      return;
    }

    if (this.opening) return;

    gameState.coins -= total;
    try {
      if (gameState.stats) gameState.stats.cases = (gameState.stats.cases | 0) + this.openCount;
      recordPassProgress('cases', this.openCount);
    } catch (e) {}
    try { saveGameState(); } catch (e) {}

    this._pendingTotal = total;
    this._pendingCount = this.openCount;
    this._pendingFinalized = false;
    this._finishedRewards = [];
    this._grantCaseId = c.id;
    this.refreshCoins();
    try {
      if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
        this.sound.play('sfx_buy', { volume: 0.4 });
      }
    } catch (e) {}

    const rewards = [];
    for (let i = 0; i < this.openCount; i++) rewards.push(this.rollReward());

    {
      const seenNew = new Set();
      const seenGear = new Set();
      rewards.forEach(rw => {
        if (rw.type === 'weapon') {
          if (seenNew.has(rw.weapon.name)) {
            rw.type = 'dup';
          } else {
            seenNew.add(rw.weapon.name);
          }
        } else if (rw.type === 'gear' && rw.gear) {
          if (seenGear.has(rw.gear.tex) || gearOwned(rw.gear)) {
            rw.type = 'geardup';
          } else {
            seenGear.add(rw.gear.tex);
          }
        }
      });
    }

    this.opening = true;
    this._hideRewards();
    this.refreshOpen();
    if (this._backBtn) {
      this._backBtn.setStyle({ color: '#888888' });
      if (this._renderBack) this._renderBack(false);
    }
    this._savePendingSpin(rewards);

    // Плавное скрытие постамента при старте крутки + отключение рендера витрины
    if (this._showcaseCont) {
      this.tweens.add({
        targets: this._showcaseCont,
        alpha: 0,
        scale: 0.94,
        duration: 250,
        ease: 'Cubic.Out',
        onComplete: () => {
          if (this._showcaseCont) this._showcaseCont.setVisible(false);
          if (this._heroTween) this._heroTween.pause();
        }
      });
    }

    this._pendingReels = rewards.length;
    this._multiLines = [];
    this._multiRewards = rewards.slice();
    rewards.forEach((reward, i) => {
      if (rewards.length === 1) {
        this.startReel(reward, { y: 366, scale: 1, delay: 0, isMaster: true });
      } else {
        this.startReel(reward, { y: 295 + i * 112, scale: 0.52, delay: i * 300, isMaster: i === 0 });
      }
    });
  }

  _clearReels() {
    (this.reelContainers || []).forEach(r => {
      try { this.tweens.killTweensOf(r); } catch (e) {}
      try { r.destroy(); } catch (e) {}
    });
    this.reelContainers = [];
    (this._reelFrames || []).forEach(f => { try { f.destroy(); } catch (e) {} });
    this._reelFrames = [];
  }

  _clearMultiIcons() {
    (this._multiIcons || []).forEach(o => { try { o.destroy(); } catch (e) {} });
    this._multiIcons = [];
  }

  // Кнопка ОК/Забрать после показа наград
  _showOkButton() {
    const _cx = gameW(this) / 2;
    this._clearOk();
    this._openRow = [this._openBtnCont, ...(this.countChips || []).map(c => c.cont)].filter(Boolean);
    this._openRow.forEach(o => { try { o.setVisible(false); } catch (e) {} });

    const btnCont = this.add.container(_cx, 638).setDepth(60);
    const btnW = 200, btnH = 46;
    const btnGfx = this.add.graphics();

    const paintOk = (hovered) => {
      btnGfx.clear();
      btnGfx.fillStyle(hovered ? 0x278749 : 0x1d6c3a, 1);
      btnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      btnGfx.fillStyle(0xffffff, hovered ? 0.22 : 0.12);
      btnGfx.fillRoundedRect(-btnW / 2 + 2, -btnH / 2 + 2, btnW - 4, 12, { tl: 8, tr: 8, bl: 0, br: 0 });
      btnGfx.lineStyle(hovered ? 2.5 : 2, 0xffd24a, 1);
      btnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    };
    paintOk(false);

    const txt = this.add.text(0, 0, 'ЗАБРАТЬ', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btnCont.add([btnGfx, txt]);
    btnCont.setSize(btnW, btnH);
    btnCont.setInteractive({ useHandCursor: true });
    btnCont.on('pointerover', () => {
      paintOk(true);
      btnCont.setScale(1.03);
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.2 });
        }
      } catch (e) {}
    });
    btnCont.on('pointerout', () => {
      paintOk(false);
      btnCont.setScale(1);
    });
    btnCont.on('pointerdown', () => this._hideRewards());
    this._okBtn = btnCont;
  }

  _clearOk() {
    if (this._okBtn) {
      try { this._okBtn.destroy(); } catch (e) {}
      this._okBtn = null;
    }
  }

  _hideRewards() {
    this._clearMultiIcons();
    this._clearOk();
    if (this.result) this.result.setText('');
    (this._openRow || []).forEach(o => { try { o.setVisible(true); } catch (e) {} });

    // Возвращаем витрину выбранного кейса
    if (this._showcaseCont) {
      this._showcaseCont.setVisible(true);
      if (this._heroTween) this._heroTween.resume();
      this.tweens.add({
        targets: this._showcaseCont,
        alpha: 1,
        scale: 1,
        duration: 350,
        ease: 'Cubic.Out'
      });
    }
  }

  // Запуск крутки рулетки
  startReel(reward, layout) {
    const CELL_W = 340;
    const CELL_H = 200;
    const cellCount = 11;
    const finalIdx = 8;
    const { y: REEL_Y, scale = 1, delay = 0, isMaster = true } = layout || {};
    const _cx = gameW(this) / 2;

    const finalEntry = this._poolEntryFor(reward);

    if (!this.reelContainers) this.reelContainers = [];
    if (!this._reelFrames) this._reelFrames = [];

    // Фоновая подложка трека рулетки
    const trackW = (CELL_W * 3 + 40) * scale;
    const trackH = (CELL_H + 24) * scale;
    const trackBg = this.add.graphics().setDepth(38);
    trackBg.fillStyle(0x0a0c18, 0.88);
    trackBg.fillRoundedRect(_cx - trackW / 2, REEL_Y - trackH / 2, trackW, trackH, 12 * scale);
    trackBg.lineStyle(1.5, 0x2a3048, 1);
    trackBg.strokeRoundedRect(_cx - trackW / 2, REEL_Y - trackH / 2, trackW, trackH, 12 * scale);
    this._reelFrames.push(trackBg);

    // Боковые шторки под цвет фона (depth 41) — скрывают выходящие за пределы трека ячейки БЕЗ тяжелых WebGL stencil-масок!
    const curtainY = REEL_Y - trackH / 2 - 2;
    const curtainH = trackH + 4;
    const leftCurtainW = Math.max(0, _cx - trackW / 2);
    const rightCurtainX = _cx + trackW / 2;

    const leftCurtain = this.add.graphics().setDepth(41);
    leftCurtain.fillStyle(0x090b1c, 1);
    leftCurtain.fillRect(0, curtainY, leftCurtainW, curtainH);
    leftCurtain.fillStyle(0x050610, 0.5);
    leftCurtain.fillRect(leftCurtainW - 16, curtainY, 16, curtainH);
    this._reelFrames.push(leftCurtain);

    const rightCurtain = this.add.graphics().setDepth(41);
    rightCurtain.fillStyle(0x090b1c, 1);
    rightCurtain.fillRect(rightCurtainX, curtainY, gameW(this) - rightCurtainX, curtainH);
    rightCurtain.fillStyle(0x050610, 0.5);
    rightCurtain.fillRect(rightCurtainX, curtainY, 16, curtainH);
    this._reelFrames.push(rightCurtain);

    const reel = this.add.container(0, REEL_Y).setDepth(40);
    reel.setScale(scale);
    this.reelContainers.push(reel);

    for (let i = 0; i < cellCount; i++) {
      const entry = i === finalIdx ? finalEntry : this._randomPoolEntry();
      const cell = this._reelCell(entry, CELL_W, CELL_H, this._caseDef().price);
      cell.setPosition(i * CELL_W + CELL_W / 2, 0);
      reel.add(cell);
    }

    // Рамка выигрышного окна по центру
    const frameGfx = this.add.graphics().setDepth(42);
    const winW = (CELL_W + 8) * scale;
    const winH = (CELL_H + 12) * scale;

    // Золотая рамка
    frameGfx.lineStyle(3.5, 0xffd700, 1);
    frameGfx.strokeRoundedRect(_cx - winW / 2, REEL_Y - winH / 2, winW, winH, 10 * scale);

    // Внешнее свечение
    frameGfx.lineStyle(2, 0xffd700, 0.35);
    frameGfx.strokeRoundedRect(_cx - winW / 2 - 4 * scale, REEL_Y - winH / 2 - 4 * scale, winW + 8 * scale, winH + 8 * scale, 12 * scale);

    // Верхняя и нижняя золотые стрелочки-маркеры (указатели payline)
    const arrowSz = 9 * scale;
    frameGfx.fillStyle(0xffd700, 1);
    frameGfx.fillPoints([
      new Phaser.Geom.Point(_cx, REEL_Y - winH / 2 + arrowSz + 2),
      new Phaser.Geom.Point(_cx - arrowSz, REEL_Y - winH / 2 - 2),
      new Phaser.Geom.Point(_cx + arrowSz, REEL_Y - winH / 2 - 2)
    ], true);

    frameGfx.fillPoints([
      new Phaser.Geom.Point(_cx, REEL_Y + winH / 2 - arrowSz - 2),
      new Phaser.Geom.Point(_cx - arrowSz, REEL_Y + winH / 2 + 2),
      new Phaser.Geom.Point(_cx + arrowSz, REEL_Y + winH / 2 + 2)
    ], true);

    this._reelFrames.push(frameGfx);

    const targetX = _cx - (finalIdx * CELL_W + CELL_W / 2) * scale;
    const startX = _cx - (CELL_W / 2) * scale + CELL_W * scale * 2;
    reel.x = startX;

    let lastTickIndex = Math.floor(reel.x / (CELL_W * scale));

    const tweenCfg = {
      targets: reel,
      x: targetX,
      duration: REEL_DURATION,
      delay,
      ease: 'Cubic.Out',
      onComplete: () => {
        try { frameGfx.destroy(); } catch (e) {}
        try { trackBg.destroy(); } catch (e) {}
        try { leftCurtain.destroy(); } catch (e) {}
        try { rightCurtain.destroy(); } catch (e) {}
        this._reelFrames = this._reelFrames.filter(f => f !== frameGfx && f !== trackBg && f !== leftCurtain && f !== rightCurtain);
        this.reelContainers = this.reelContainers.filter(r => r !== reel);
        try { reel.destroy(); } catch (e) {}
        this.finishReel(reward);
      }
    };

    if (isMaster) {
      tweenCfg.onUpdate = () => {
        const curTickIndex = Math.floor(reel.x / (CELL_W * scale));
        if (curTickIndex !== lastTickIndex) {
          lastTickIndex = curTickIndex;
          this._playReelTick();
        }
      };
    }

    this.tweens.add(tweenCfg);
  }

  _grantReward(reward) {
    if (reward.type === 'coins') {
      addCoins(reward.amount);
      return `+${reward.amount.toLocaleString('ru-RU')}${reward.jackpot ? ' ДЖЕКПОТ!' : ''}`;
    }
    if (reward.type === 'weapon') {
      unlockWeapon(reward.weapon.name);
      return `Новое оружие: ${getWeaponLabel(reward.weapon.name)}`;
    }
    if (reward.type === 'dup') {
      const comp = Math.round(reward.weapon.price / 3);
      addCoins(comp);
      return `Компенсация за ${getWeaponLabel(reward.weapon.name)} +${comp.toLocaleString('ru-RU')}`;
    }
    if (reward.type === 'gear') {
      if (gearOwned(reward.gear)) {
        const comp = Math.round(reward.gear.price / 3);
        addCoins(comp);
        return `Повтор: ${reward.gear.label} +${comp.toLocaleString('ru-RU')}`;
      }
      gearUnlockBuy(reward.gear);
      return `Одежда: ${reward.gear.label}`;
    }
    if (reward.type === 'geardup') {
      const comp = Math.round((reward.gear ? reward.gear.price : 300) / 3);
      addCoins(comp);
      return `Повтор: ${reward.gear ? reward.gear.label : 'одежда'} +${comp.toLocaleString('ru-RU')}`;
    }
    unlockSkin(reward.skin.id);
    try {
      gameState.skinOrigin = gameState.skinOrigin || {};
      if (this._grantCaseId) gameState.skinOrigin[reward.skin.id] = this._grantCaseId;
      saveGameState();
    } catch (e) {}
    return `Скин: ${reward.skin.name}`;
  }

  finishReel(reward) {
    try { (this._finishedRewards || (this._finishedRewards = [])).push(reward); } catch (e) {}

    try {
      if (this._pendingReels <= 1) {
        const list = (this._multiRewards && this._multiRewards.length ? this._multiRewards : [reward]) || [];
        const hasGun = list.some(rw => rw && rw.type === 'weapon' && rw.weapon && rw.weapon.category === 'melee');
        const hasSkin = list.some(rw => rw && rw.type === 'skin' && rw.skin && (rw.skin.rarity | 0) >= 4);
        const hasEpic = list.some(rw => rw && ((rw.type === 'skin' && rw.skin && (rw.skin.rarity | 0) === 3) || (rw.type === 'gear' && rw.gear && (rw.gear.rarity | 0) === 3)));
        if (hasGun || hasSkin) this._legendaryWeaponFx('skin');
        else if (hasEpic) this._epicItemFx();
      }
    } catch (e) {}

    this._pendingReels--;
    if (this._pendingReels > 0) return;

    if (this._pendingFinalized) return;
    this._pendingFinalized = true;

    ((this._finishedRewards && this._finishedRewards.length) ? this._finishedRewards : [reward])
      .forEach(rw => { try { this._grantReward(rw); } catch (e) {} });
    try { saveGameState(); } catch (e) {}

    this._clearReels();
    this._showMultiIcons(this._multiRewards && this._multiRewards.length ? this._multiRewards : [reward]);
    this._multiLines = [];
    this._showOkButton();

    this.refreshCoins();
    this.opening = false;
    this.refreshOpen();
    if (this._backBtn) {
      this._backBtn.setStyle({ color: '#ffffff' });
      if (this._renderBack) this._renderBack(false);
    }
  }

  _legendaryWeaponFx(kind) {
    try {
      const D = 70;
      try { this.cameras.main.shake(450, 0.012); } catch (e) {}
      const flash = this.add.rectangle(gameW(this) / 2, 360, gameW(this), 720, 0xffd24a, 0).setDepth(D);
      this.tweens.add({
        targets: flash, alpha: { from: 0.5, to: 0 }, duration: 800,
        onComplete: () => { try { flash.destroy(); } catch (e) {} }
      });
      [0, 180, 360, 540].forEach(delay => {
        const ring = this.add.graphics().setDepth(D + 1);
        const st = { r: 20, a: 0.95 };
        this.tweens.add({
          targets: st, r: 380, a: 0, duration: 1200, delay,
          onUpdate: () => {
            try {
              ring.clear();
              ring.lineStyle(6, 0xffd24a, Math.max(0, st.a));
              ring.strokeCircle(gameW(this) / 2, 380, Math.max(1, st.r));
            } catch (e) {}
          },
          onComplete: () => { try { ring.destroy(); } catch (e) {} }
        });
      });
      const title = kind === 'skin' ? 'ЛЕГЕНДАРНЫЙ СКИН!' : 'ЛЕГЕНДАРНОЕ ОРУЖИЕ!';
      const t = this.add.text(gameW(this) / 2, 200, title, {
        fontSize: '34px', color: '#ffd24a', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 7
      }).setOrigin(0.5).setDepth(D + 2).setScale(0.3).setAlpha(0);
      this.tweens.add({
        targets: t, scale: 1.05, alpha: 1, duration: 450, ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: t, alpha: 0, y: 170, duration: 900, delay: 1400,
            onComplete: () => { try { t.destroy(); } catch (e) {} }
          });
        }
      });
      this._legendaryFanfare();
    } catch (e) {}
  }

  _epicItemFx() {
    try {
      const D = 70;
      try { this.cameras.main.shake(300, 0.008); } catch (e) {}
      const flash = this.add.rectangle(gameW(this) / 2, 360, gameW(this), 720, 0xb44dff, 0).setDepth(D);
      this.tweens.add({
        targets: flash, alpha: { from: 0.35, to: 0 }, duration: 600,
        onComplete: () => { try { flash.destroy(); } catch (e) {} }
      });
      [0, 200].forEach(delay => {
        const ring = this.add.graphics().setDepth(D + 1);
        const st = { r: 20, a: 0.8 };
        this.tweens.add({
          targets: st, r: 280, a: 0, duration: 900, delay,
          onUpdate: () => {
            try {
              ring.clear();
              ring.lineStyle(5, 0xb44dff, Math.max(0, st.a));
              ring.strokeCircle(gameW(this) / 2, 380, Math.max(1, st.r));
            } catch (e) {}
          },
          onComplete: () => { try { ring.destroy(); } catch (e) {} }
        });
      });
      const t = this.add.text(gameW(this) / 2, 200, 'ЭПИЧЕСКИЙ ПРЕДМЕТ!', {
        fontSize: '32px', color: '#b44dff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 6
      }).setOrigin(0.5).setDepth(D + 2).setScale(0.3).setAlpha(0);
      this.tweens.add({
        targets: t, scale: 1.05, alpha: 1, duration: 400, ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: t, alpha: 0, y: 170, duration: 800, delay: 1200,
            onComplete: () => { try { t.destroy(); } catch (e) {} }
          });
        }
      });
    } catch (e) {}
  }

  _legendaryFanfare() {
    try {
      const sc = this.sound;
      if (!sc || sc.locked || !sc.context || typeof sc.context.createOscillator !== 'function') return;
      const ctx = sc.context;
      if (ctx.state === 'suspended') {
        try { ctx.resume(); } catch (e) {}
        if (ctx.state === 'suspended') return;
      }
      let vol = 0.35;
      try {
        const sv = gameState && gameState.sfxVol;
        vol = 0.35 * (Number.isFinite(+sv) ? Math.max(0, Math.min(1, +sv)) : 1);
      } catch (e) {}
      if (!(vol > 0.01)) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const t0 = ctx.currentTime || 0;
      const out = ctx.createGain();
      out.gain.setValueAtTime(vol, t0);
      out.connect(ctx.destination);
      notes.forEach((f, idx) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t0 + idx * 0.13);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0 + idx * 0.13);
        g.gain.exponentialRampToValueAtTime(0.9, t0 + idx * 0.13 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + idx * 0.13 + 0.34);
        o.connect(g);
        g.connect(out);
        o.start(t0 + idx * 0.13);
        o.stop(t0 + idx * 0.13 + 0.4);
      });
    } catch (e) {}
  }

  // Витрина наград (для одного и мультиоткрытий) в роскошной раме с анимацией
  _showMultiIcons(rewards) {
    this._clearMultiIcons();
    const entries = (rewards || []).map(rw => this._poolEntryFor(rw));
    const merged = [];
    let coinSum = 0, coinJack = false;
    entries.forEach(e => {
      if (e && e.kind === 'coins' && !e.sub) {
        coinSum += e.amount | 0;
        if (e.jackpot) coinJack = true;
      } else if (e) {
        merged.push(e);
      }
    });
    if (coinSum > 0) merged.unshift({ kind: 'coins', amount: coinSum, jackpot: coinJack });
    const list = merged.length ? merged : entries;
    const n = list.length;
    const CELL_W = 250;
    const CELL_H = 210;
    const step = 270;
    const y = 390;
    const _cx = gameW(this) / 2;
    const x0 = _cx - (n - 1) * step / 2;

    const bw = Math.max(380, (n - 1) * step + CELL_W + 70);
    const bh = CELL_H + 116;

    // Затемняющая подложка
    const scrim = this.add.graphics().setDepth(49);
    scrim.fillStyle(0x060710, 0.75);
    scrim.fillRect(0, 56, gameW(this), 636);
    scrim.setAlpha(0);
    this._multiIcons.push(scrim);
    this.tweens.add({ targets: scrim, alpha: 1, duration: 300 });

    // Панель наград
    const bg = this.add.graphics().setDepth(50);
    bg.fillStyle(0x0e1024, 0.98);
    bg.fillRoundedRect(_cx - bw / 2, y - bh / 2, bw, bh, 16);
    bg.fillStyle(0xffffff, 0.08);
    bg.fillRoundedRect(_cx - bw / 2 + 2, y - bh / 2 + 2, bw - 4, 6, { tl: 14, tr: 14, bl: 0, br: 0 });
    bg.lineStyle(2.5, 0xffd24a, 1);
    bg.strokeRoundedRect(_cx - bw / 2, y - bh / 2, bw, bh, 16);

    // Заклёпки по углам
    const ro = 14;
    [[_cx - bw / 2 + ro, y - bh / 2 + ro], [_cx + bw / 2 - ro, y - bh / 2 + ro],
     [_cx - bw / 2 + ro, y + bh / 2 - ro], [_cx + bw / 2 - ro, y + bh / 2 - ro]].forEach(([rx, ry]) => {
      bg.fillStyle(0xffd24a, 0.7);
      bg.fillCircle(rx, ry, 3.5);
      bg.fillStyle(0xffffff, 0.9);
      bg.fillCircle(rx - 1, ry - 1, 1);
    });

    bg.setAlpha(0);
    this._multiIcons.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 350 });

    // Заголовок модалки
    const title = this.add.text(_cx, y - bh / 2 + 24, 'НАГРАДЫ', {
      fontSize: '22px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(51).setAlpha(0);
    this._multiIcons.push(title);
    this.tweens.add({ targets: title, alpha: 1, duration: 350, delay: 150 });

    list.forEach((entry, i) => {
      const cell = this._reelCell(entry, CELL_W, CELL_H, this._caseDef().price);
      cell.setDepth(52);
      const tx = x0 + i * step;
      cell.setPosition(tx, y + 14);
      cell.setScale(0.3);
      cell.setAlpha(0);
      this._multiIcons.push(cell);

      this.tweens.add({
        targets: cell,
        scale: 1,
        alpha: 1,
        duration: 500,
        delay: 180 + i * 120,
        ease: 'Back.easeOut'
      });
    });
  }
}
