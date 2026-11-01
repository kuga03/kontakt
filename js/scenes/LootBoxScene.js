import { gameW, UX } from '../ui/layout.js?v=3';
import {
  gameState,
  unlockWeapon,
  unlockSkin,
  addCoins,
  saveGameState,
  getPass
} from '../data/gameState.js?v=171';

import { weaponsList, getWeaponLabel, weaponImage } from '../data/weapons.js?v=170';
import { weaponSkins } from '../data/skins.js?v=169';
import { GEAR_ITEMS, gearOwned, gearUnlockBuy, gearPreviewTex, GEAR_RARITY_WEIGHT } from '../data/wardrobe.js?v=172';
import { GEAR_SETS } from '../data/gearSets.js?v=172';

const REEL_DURATION = 7000;

// Три кейса по содержимому (прозрачно: хочешь геном — крути скины,
// хочешь пушку — крути оружие, хочешь шмот — гардероб). Ящика рядового
// больше нет: дешёвый объём им фармил лестницу. Дубликаты ПАДАЮТ СНОВА:
// за повтор дают 1/3 цены (оружие/шмот) или пыль (скин).
// Повторный скин (такая редкость уже собрана) — пыль: 12% цены кейса.
const CASES = [
  {
    id: 'wardrobe', name: 'Гардеробный', price: 1500, kind: 'gear',
    gearRate: 0.15,
    coinMin: 0.3, coinMax: 1.5, jackpotChance: 0.10,
    color: 0x2a5a4a, line: 0x66d9e8,
    desc: 'Шапки, броня, штаны и обувь, пыль тоже'
  },
  {
    id: 'weapons', name: 'Оружейный', price: 3000, kind: 'weapons',
    legRate: 0.015, epicW: 0.03, rareW: 0.07, commW: 0.13, grayW: 0.18,
    meleeShare: 1.0, skinProb: 0,
    coinMin: 0.3, coinMax: 2.5, jackpotChance: 0.12,
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
    coinMin: 0.6, smallMax: 1.0, bigMin: 1.0, coinMax: 1.7, pBig: 0.45,
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

// Редкость рамки/названия — строго по системе редкостей:
// 0 ширпотреб (серый), 1 обычный (синий), 2 редкий (зелёный),
// 3 эпический (фиолет), 4 легендарный (золото). Монеты: золото у джекпота,
// синь — сумма больше цены кейса, серое — мелочь.
const TIER_COLORS = [0x9aa0a8, 0x3b9dff, 0x35d07f, 0xb44dff, 0xffd24a];
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

  create() {
    const _cx = gameW(this) / 2;
    this.cameras.main.setBackgroundColor('#0a0a2a');
    this.activeButton = null;
    this.opening = false;
    // Дефолт — Оружейный (как раньше, когда он был первым в ряду).
    this.caseId = 'weapons';

    this.add.text(_cx, 30, 'КЕЙСЫ', {
      fontSize: '38px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.image(UX(this, 140), 40, 'icon_coins').setOrigin(0, 0.5).setDisplaySize(24, 18);
    this.coinsText = this.add.text(UX(this, 170), 30, '', {
      fontSize: '20px',
      color: '#ffee88'
    });

    this._drawCaseCards();

    this.result = this.add.text(_cx, 540, '', {
      fontSize: '22px',
      color: '#ffee55',
      align: 'center'
    }).setOrigin(0.5);

    // Сколько кейсов открывать: x1/x2/x3. При x2/x3 — три крутки сразу
    // мелкими ячейками.
    this.openCount = 1;
    this.countChips = [];
    [1, 2, 3].forEach((n, i) => {
      // Чипы выше кнопки открытия с зазором (текст не впритык к интерактиву).
      const chip = this.add.text(UX(this, 580 + i * 60), 584, `×${n}`, {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#252560',
        padding: 8
      }).setOrigin(0.5);
      chip.setInteractive({ useHandCursor: true });
      chip.on('pointerdown', () => {
        if (this.opening) return;
        this.openCount = n;
        this.refreshOpen();
      });
      chip.on('pointerover', () => chip.setStyle({ color: '#ffff55' }));
      chip.on('pointerout', () => chip.setStyle({ color: '#ffffff' }));
      this.countChips.push(chip);
    });

    this.open = this.add.text(_cx, 640, '', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#633c76',
      padding: 14
    }).setOrigin(0.5);
    this.openCoin = this.add.image(0, 0, 'icon_coins').setDisplaySize(20, 15);

    this.open.setInteractive({ useHandCursor: true });
    this.open.on('pointerdown', () => {
      if (this.opening) return;
      if (this.activeButton && this.activeButton !== this.open) {
        this.activeButton.setStyle({ color: '#ffffff' });
      }
      this.activeButton = this.open;
      this.open.setStyle({ color: '#ffff55' });
      this.openCase();
    });
    this.open.on('pointerover', () => this.open.setStyle({ color: '#ffff55' }));
    this.open.on('pointerout', () => {
      if (this.activeButton !== this.open) {
        this.open.setStyle({ color: '#ffffff' });
      }
    });

    const back = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#553333',
      padding: 8
    }).setOrigin(0.5);

    this._backBtn = back;
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      if (this.opening) return;
      this.scene.start('MenuScene');
    });
    back.on('pointerover', () => back.setStyle({ color: '#ffff55' }));
    back.on('pointerout', () => back.setStyle({ color: '#ffffff' }));

    this.refreshCase();
    this.refreshCoins();
    this._restorePendingSpin();
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
    this.open.setStyle({ color: '#ffffff' });
    if (this._backBtn) this._backBtn.setStyle({ color: '#ffffff' });
  }

  // Тултипы кейсов убраны по просьбе автора (описаний нет вообще).

  _caseDef() {
    return CASES.find(c => c.id === this.caseId) || CASES[0];
  }

  // Карточки кейсов: всегда непрозрачный фон-панель + арт поверх.
  // Прозрачные PNG больше не дают «стеклянный» вид; выбор — яркой рамкой.
  _drawCaseCards() {
    if (this.caseCards) this.caseCards.forEach(c => c.container.destroy());
    this.caseCards = [];
    CASES.forEach((c, i) => {
      // Шесть кейсов в ряд (было три): карточки уже, всё влезает без скролла.
      const cx = UX(this, 107 + i * 213);
      const cy = 150;
      const W = 200;
      const H = 110;
      const container = this.add.container(cx, cy);
      const frame = this.add.graphics();
      // Выбор виден на любом цвете рамки: толстая золотая + внешнее
      // свечение + галочка. (У кейса «Скины» своя рамка золотая 2px —
      // тонкую подсветку с ней было не отличить.)
      const paintCard = (selected) => {
        frame.clear();
        frame.fillStyle(0x14142e, 1);
        frame.fillRoundedRect(-W / 2, -H / 2, W, H, 10);
        frame.lineStyle(2, c.line, 1);
        frame.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
        if (selected) {
          frame.lineStyle(5, 0xffe066, 1);
          frame.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
          frame.lineStyle(2, 0xffe066, 0.35);
          frame.strokeRoundedRect(-W / 2 - 6, -H / 2 - 6, W + 12, H + 12, 14);
        }
      };
      paintCard(c.id === this.caseId);
      container.add(frame);
      const texKey = c.id.startsWith('case_') ? c.id : 'case_' + c.id;
      const hasArt = this.textures.exists(texKey);
      if (hasArt) {
        const img = this.add.image(0, -18, texKey);
        const src = this.textures.get(texKey).getSourceImage();
        if (src && src.width && src.height) {
          img.setScale(Math.min(200 / src.width, 52 / src.height));
        }
        container.add(img);
      } else {
        // Заглушка-эмблема в цвете кейса.
        const ph = this.add.graphics();
        ph.fillStyle(c.color, 1);
        ph.fillCircle(0, -18, 20);
        ph.lineStyle(3, c.line, 1);
        ph.strokeCircle(0, -18, 20);
        container.add(ph);
      }
      const name = this.add.text(0, 12, c.name, {
        fontSize: '17px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5, 0);
      const price = this.add.text(14, H / 2 - 6, `${c.price}`, {
        fontSize: '16px', color: '#ffee88'
      }).setOrigin(0.5, 1);
      const coin = this.add.image(0, 0, 'icon_coins').setDisplaySize(15, 12);
      coin.setPosition(14 - price.displayWidth / 2 - 12, H / 2 - 14);
      container.add([name, price, coin]);
      container.setSize(W, H);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => {
        try {
          if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
            this.sound.play('sfx_hover', { volume: 0.2 });
          }
        } catch (e) { /* noop */ }
      });
      container.on('pointerdown', () => {
        if (this.opening) return;
        this.caseId = c.id;
        this.refreshCase();
      });
      this.caseCards.push({ id: c.id, container, paintCard });
    });
  }

  refreshCase() {
    const c = this._caseDef();
    this._hideRewards();
    // Смена кейса — старые ленты и призы не должны висеть фоном.
    if (!this.opening) {
      this._clearReels();
      this._hideRewards();
    }
    (this.caseCards || []).forEach(card => {
      const on = card.id === c.id;
      if (card.paintCard) card.paintCard(on);
    });
    this.open.setText(`Открыть за ${c.price}`);
    this.openCoin.setPosition(this.open.x - this.open.displayWidth / 2 - 20, this.open.y);
    this.result.setText('');
    this.refreshOpen();
  }

  // Цена с учётом количества + подсветка выбранного чипа.
  refreshOpen() {
    const c = this._caseDef();
    this.open.setText(`Открыть за ${c.price * this.openCount}`);
    this.openCoin.setPosition(this.open.x - this.open.displayWidth / 2 - 20, this.open.y);
    (this.countChips || []).forEach((chip, i) => {
      const on = (i + 1) === this.openCount;
      chip.setStyle({
        color: on ? '#ffff55' : '#ffffff',
        backgroundColor: on ? '#633c76' : '#252560'
      });
    });
  }

  refreshCoins() {
    this.coinsText.setText(`${gameState.coins}`);
  }

  // Пулы кейса: оружие по цене + скины ТОЛЬКО на это оружие.
  // Легендарное оружие (ножи) — где ближний бой; легендарные скины —
  // где allowLegendarySkins (кейс скинов — путь к геному).
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
    // Скины ножа — легендарные, только где разрешены леге-скины.
    // В кейсе скинов — еще и скины ближнего боя (все редкости 4):
    // иначе леге-пул всего 3 штуки и контракт из 5 не собрать.
    if (allowLegendary) poolNames.add('Knife');
    if (c.allowLegendarySkins) ['катана', 'мачете', 'топор'].forEach(n => poolNames.add(n));
    const caseSkins = weaponSkins.filter(s => {
      if (ownedSkinIds.has(s.id)) return false;
      if (!poolNames.has(s.weapon)) return false;
      if ((s.rarity ?? 1) >= 4 && !allowLegSkins) return false;
      return true;
    });
    // Редкости скинов пула БЕЗ учёта владения: отличаем «такое уже есть»
    // (пыль) от «такого в кейсе нет» (провал ниже по тирам).
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
    // Гардероб крутится отдельно: шмотка или монеты.
    if (c.kind === 'gear') return this._rollGear();
    // Гарантированный кейс: скин фиксированной редкости без рулетки.
    // Легендарный пул включает нож. Всё скуплено — пыль 25% как везде.
    if (c.fixedRarity != null) {
      try {
        const ownedIds = new Set(gameState.weaponSkins || []);
        const pool = weaponSkins.filter(s => (s.rarity ?? 1) === c.fixedRarity && !ownedIds.has(s.id));
        if (pool.length) return { type: 'skin', skin: pool[(Math.random() * pool.length) | 0] };
      } catch (e) {}
      return { type: 'coins', amount: Math.max(1, Math.round(c.price * 0.25)), jackpot: false, dust: true };
    }
    // Строго по предикату: пустого класса нет — проваливаемся ниже по тирам,
    // а не тянем чужое из общего пула.
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
    // Скин ветки: есть свободный — выдаём; всё такой редкости уже собрано —
    // пыль (немного монет, без джекпота); такой редкости в кейсе нет вовсе —
    // null, каскад ниже по тирам.
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
    // Пороги веток — из полей кейса (legRate/epicW/rareW/commW/grayW).
    // skinProb — доля скинов в ветке (0 — только оружие, 1 — только скины).
    const legR = c.legRate ?? 0.01, epicW = c.epicW ?? 0.05;
    const rareW = c.rareW ?? 0.10, commW = c.commW ?? 0.12, grayW = c.grayW ?? 0.18;
    const skinP = c.skinProb ?? 0.5;
    const tE = legR + epicW, tR = tE + rareW, tB = tR + commW, tG = tB + grayW;
    // Легендарное: ближний бой (ножи) и/или скин 4. В оружейном —
    // только ножи, в скинах — только скины.
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
    // Эпическое: оружие tier 3 (price > 12000) или скин редкости 3.
    if (r < tE) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.category !== 'melee' && w.price > 12000);
        if (w) return asWeapon(w);
      }
      const s3 = trySkin(3);
      if (s3) return s3;
    }
    // Редкое: оружие tier 2 (6000–12000) или скин редкости 2.
    if (r < tR) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.category !== 'melee' && w.price > 6000 && w.price <= 12000);
        if (w) return asWeapon(w);
      }
      const s2 = trySkin(2);
      if (s2) return s2;
    }
    // Обычное: оружие tier 1 (2200–6000) или скин редкости 1.
    if (r < tB) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.price >= 2200 && w.price <= 6000);
        if (w) return asWeapon(w);
      }
      const s1 = trySkin(1);
      if (s1) return s1;
    }
    // Ширпотреб: дешёвое оружие (< 2200) или скин редкости 0.
    if (r < tG) {
      if (Math.random() >= skinP) {
        const w = pickWeapon(w => w.price < 2200);
        if (w) return asWeapon(w);
      }
      const s0 = trySkin(0);
      if (s0) return s0;
    }
    // 20% — деньги больше цены кейса, 34% — деньги меньше цены.
    // Размер — ОТДЕЛЬНЫМ роллом (доля больших — pBig кейса, иначе 0.37):
    // иначе несработавшие ветки скинов/пушек сыпались бы только в большие
    // и кейс печатал деньги.
    if (Math.random() < (c.pBig ?? 0.37)) return this._coinDrop(c, true);
    return this._coinDrop(c, false);
  }

  // Крутка гардероба: gearRate — вещь, иначе монеты. Всё собрано — пыль.
  // Добивка сета: не хватает 1 из 4 — недостающая часть падает с шансом 3%.
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
        // Взвешенный выбор по редкости вещи (GEAR_RARITY_WEIGHT: ширпотреб
        // сыплется часто, легендарка — почти никогда).
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
    // Диапазоны множителями от цены (bigMin/smallMax опциональны,
    // по умолчанию 1 — как раньше: большие от цены и выше).
    const lo = big
      ? Math.round(c.price * (c.bigMin != null ? c.bigMin : 1))
      : Math.round(c.price * c.coinMin);
    const hi = big
      ? Math.round(c.price * c.coinMax)
      : Math.round(c.price * (c.smallMax != null ? c.smallMax : 1));
    // hi обязан быть >= lo: при округлении lo==hi давало +1 сверху.
    const hi2 = Math.max(lo, hi);
    const amount = Phaser.Math.Between(Math.max(1, lo), hi2);
    const jackpot = big && amount >= Math.round(c.price * c.coinMax * 0.95);
    return { type: 'coins', amount, jackpot };
  }

  // Ячейка ленты как объект: {kind:'coins'|'weapon'|'skin', ...}.
  // Компенсация (дубликат) показывается деньгами: сумма + подпись за что.
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
    // Наполнение ленты — строго из ветки кейса: в оружейном нет скинов,
    // в скинах нет пушек. Иначе крутка врёт о содержимом.
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
      // Наполнение ленты — из того же пула скинов кейса (легенд/ножей
      // в рядовом и легенд в арсенале тут тоже нет).
      if (caseSkins.length) return { kind: 'skin', skin: Phaser.Math.RND.pick(caseSkins) };
    }
    const jackpot = Math.random() < c.jackpotChance;
    const mult = jackpot ? c.coinMax : c.coinMin + Math.random() * (c.coinMax - c.coinMin);
    return { kind: 'coins', amount: Math.round(c.price * mult), jackpot };
  }

  _tierCss(colorInt) {
    return '#' + colorInt.toString(16).padStart(6, '0');
  }

  // Редкость скина (0–4) → тир рамки (0–4) один в один.
  _skinTier(skin) {
    const r = skin.rarity ?? 1;
    return Math.min(4, Math.max(0, r));
  }

  // Одна ячейка: картинка в рамке редкости, название — в цвете редкости.
  // Скины — тоже рамкой (а не голым текстом): имя в цвете редкости скина.
  // Монеты: джекпот — золото, сумма больше цены кейса — синь, мелочь — серая.
  _reelCell(entry, CELL_W, CELL_H, casePrice) {
    let colorInt;
    if (entry.kind === 'skin') {
      const rc = String(entry.skin.rarityColor || '');
      colorInt = /^#[0-9a-fA-F]{6}$/.test(rc) ? parseInt(rc.slice(1), 16) : TIER_COLORS[this._skinTier(entry.skin)];
    } else if (entry.kind === 'coins') {
      colorInt = entry.jackpot ? TIER_COLORS[3] : (casePrice && entry.amount > casePrice ? TIER_COLORS[1] : TIER_COLORS[0]);
    } else if (entry.kind === 'gear') {
      colorInt = 0x66d9e8;
    } else {
      colorInt = TIER_COLORS[weaponTier(entry.weapon)];
    }
    const css = this._tierCss(colorInt);
    const dark = Phaser.Display.Color.IntegerToColor(colorInt);
    dark.brighten(-55);

    const container = this.add.container(0, 0);
    const W = CELL_W - 24;
    const H = CELL_H - 24;
    const bg = this.add.graphics();
    bg.fillStyle(dark.color, 1);
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 10);
    bg.lineStyle(8, colorInt, 1);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
    container.add(bg);

    if (entry.kind === 'coins') {
      // Значок строго внутри ячейки: высота ≤ 36% высоты, центр с отступом.
      const ih = Math.min(64, H * 0.36);
      const img = this.add.image(0, -H / 2 + 14 + ih / 2, 'icon_coins');
      img.setDisplaySize(ih / 0.77, ih);
      container.add(img);
      container.add(this.add.text(0, H / 2 - 32, `+${entry.amount}`, {
        fontSize: '26px', color: css, fontStyle: 'bold'
      }).setOrigin(0.5));
      if (entry.sub) {
        container.add(this.add.text(0, H / 2 - 12, entry.sub, {
          fontSize: '12px', color: '#ffcc88', align: 'center',
          wordWrap: { width: W - 16 }
        }).setOrigin(0.5));
      }
    } else if (entry.kind === 'weapon') {
      const imgKey = weaponImage(entry.weapon.name);
      if (this.textures.exists(imgKey)) {
        const img = this.add.image(0, -H / 2 + 44, imgKey);
        const src = this.textures.get(imgKey).getSourceImage();
        if (src && src.width && src.height) {
          let sc = Math.min((W - 20) / src.width, 70 / src.height);
          // Катана в ячейке: в 2 раза крупнее и чуть вправо — с клампом,
          // чтобы повёрнутая влезла в рамку.
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
      container.add(this.add.text(0, H / 2 - 46, getWeaponLabel(entry.weapon.name), {
        fontSize: '15px', color: css, fontStyle: 'bold', align: 'center',
        wordWrap: { width: W - 16 }
      }).setOrigin(0.5));
    } else if (entry.kind === 'gear' && entry.gear) {
      container.add(this.add.text(0, -H / 2 + 16, 'ОДЕЖДА' + (entry.dup ? ' (повтор)' : ''), {
        fontSize: '12px', color: '#99aacc', fontStyle: 'bold'
      }).setOrigin(0.5));
      try {
        const gk = gearPreviewTex(entry.gear);
        if (gk && this.textures.exists(gk)) {
          const gimg = this.add.image(0, 0, gk);
          const gs = this.textures.get(gk).getSourceImage();
          if (gs && gs.width && gs.height) {
            gimg.setScale(Math.min((W - 20) / gs.width, 70 / gs.height));
          }
          container.add(gimg);
        }
      } catch (e) {}
      container.add(this.add.text(0, H / 2 - 18, entry.gear.label, {
        fontSize: '16px', color: entry.gear.rarityColor || css, fontStyle: 'bold',
        align: 'center', wordWrap: { width: W - 16 }
      }).setOrigin(0.5));
    } else {
      container.add(this.add.text(0, -H / 2 + 16, 'СКИН', {
        fontSize: '12px', color: '#99aacc', fontStyle: 'bold'
      }).setOrigin(0.5));
      container.add(this.add.text(0, 4, entry.skin.name, {
        fontSize: '16px', color: entry.skin.rarityColor || css, fontStyle: 'bold',
        align: 'center', wordWrap: { width: W - 16 }
      }).setOrigin(0.5));
      container.add(this.add.text(0, H / 2 - 18, getWeaponLabel(entry.skin.weapon), {
        fontSize: '12px', color: '#99aacc'
      }).setOrigin(0.5));
    }
    return container;
  }

  openCase() {
    const c = this._caseDef();
    const total = c.price * this.openCount;
    if (gameState.coins < total) {
      this.result.setText('Недостаточно монет');
      return;
    }

    if (this.opening) return;

    gameState.coins -= total;
    try {
      if (gameState.stats) gameState.stats.cases = (gameState.stats.cases | 0) + this.openCount;
      const _ps = getPass();
      _ps.cases = (_ps.cases | 0) + this.openCount;
    } catch (e) {}
    try { saveGameState(); } catch (e) {}

    this._pendingTotal = total;
    this._pendingCount = this.openCount;
    this._pendingFinalized = false;
    this._finishedRewards = [];
    // Запоминаем, из какого кейса призы: скины штампуются происхождением
    // (нужно контракту — на легендарный идут только эпики из кейса Скинов).
    this._grantCaseId = c.id;
    this.refreshCoins();
    try {
      if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
        this.sound.play('sfx_buy', { volume: 0.4 });
      }
    } catch (e) { /* noop */ }

    const rewards = [];
    for (let i = 0; i < this.openCount; i++) rewards.push(this.rollReward());
    // Дубликат внутри одного открытия (п.9): второй такой же кейсовый ствол —
    // уже компенсация, а не «новое оружие». rollReward не видит будущие
    // выдачи, поэтому правим здесь до анимации. То же для шмоток.
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
    this.open.setStyle({ color: '#888888' });
    if (this._backBtn) this._backBtn.setStyle({ color: '#888888' });
    this._savePendingSpin(rewards);

    this._pendingReels = rewards.length;
    this._multiLines = [];
    this._multiRewards = rewards.slice();
    rewards.forEach((reward, i) => {
      if (rewards.length === 1) {
        this.startReel(reward, { y: 330, scale: 1, delay: 0 });
      } else {
        // Три крутки мелко (ниже карточек ~221, выше чипов ~578):
        // ряды 292/402/512, золотая рамка без внешней.
        this.startReel(reward, { y: 292 + i * 110, scale: 0.5, delay: i * 350 });
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

  // Кнопка ОК после показа наград: прячет блок наград, возвращает открытие.
  _showOkButton() {
    const _cx = gameW(this) / 2;
    this._clearOk();
    this._openRow = [this.open, this.openCoin, ...(this.countChips || [])].filter(Boolean);
    this._openRow.forEach(o => { try { o.setVisible(false); } catch (e) {} });
    const btn = this.add.text(_cx, 630, 'ОК', {
      fontSize: '24px', color: '#ffffff', backgroundColor: '#2a5a2a',
      padding: 12, fixedWidth: 160, align: 'center'
    }).setOrigin(0.5).setDepth(60);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: '#ffff55' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerdown', () => this._hideRewards());
    this._okBtn = btn;
  }

  _clearOk() {
    if (this._okBtn) {
      try { this._okBtn.destroy(); } catch (e) {}
      this._okBtn = null;
    }
  }

  // Убрать весь блок наград (иконки, ОК, текст) и вернуть ряд открытия.
  _hideRewards() {
    this._clearMultiIcons();
    this._clearOk();
    if (this.result) this.result.setText('');
    (this._openRow || []).forEach(o => { try { o.setVisible(true); } catch (e) {} });
  }

  startReel(reward, layout) {
    const CELL_W = 340;
    const CELL_H = 200;
    const cellCount = 13;
    const finalIdx = 9;
    const { y: REEL_Y, scale = 1, delay = 0 } = layout || {};

    const finalEntry = this._poolEntryFor(reward);

    if (!this.reelContainers) this.reelContainers = [];
    if (!this._reelFrames) this._reelFrames = [];
    const reel = this.add.container(0, REEL_Y);
    reel.setScale(scale);
    this.reelContainers.push(reel);

    for (let i = 0; i < cellCount; i++) {
      const entry = i === finalIdx ? finalEntry : this._randomPoolEntry();
      const cell = this._reelCell(entry, CELL_W, CELL_H, this._caseDef().price);
      cell.setPosition(i * CELL_W + CELL_W / 2, 0);
      reel.add(cell);
    }

    // Рамка окна выигрыша (масштабируется вместе с лентой).
    // У мелких лент — только золотая, без внешней белой (ряды впритык).
    let frame = null;
    let frameIn = null;
    if (scale < 1) {
      frameIn = this.add.graphics();
      frameIn.lineStyle(4, 0xffd700, 1);
      frameIn.strokeRoundedRect(
        gameW(this) / 2 - (CELL_W / 2 + 6) * scale, REEL_Y - (CELL_H / 2 + 6) * scale,
        (CELL_W + 12) * scale, (CELL_H + 12) * scale, 10
      );
      this._reelFrames.push(frameIn);
    } else {
      frame = this.add.graphics();
      frame.lineStyle(7, 0xffffff, 0.95);
      frame.strokeRoundedRect(
        gameW(this) / 2 - (CELL_W / 2 + 12) * scale, REEL_Y - (CELL_H / 2 + 12) * scale,
        (CELL_W + 24) * scale, (CELL_H + 24) * scale, 12
      );
      frameIn = this.add.graphics();
      frameIn.lineStyle(4, 0xffd700, 1);
      frameIn.strokeRoundedRect(
        gameW(this) / 2 - (CELL_W / 2 + 6) * scale, REEL_Y - (CELL_H / 2 + 6) * scale,
        (CELL_W + 12) * scale, (CELL_H + 12) * scale, 10
      );
      this._reelFrames.push(frame, frameIn);
    }

    // В масштабированном контейнере позиция умножается на scale.
    const targetX = gameW(this) / 2 - (finalIdx * CELL_W + CELL_W / 2) * scale;
    const startX = gameW(this) / 2 - (CELL_W / 2) * scale + CELL_W * scale * 2;
    reel.x = startX;

    this.tweens.add({
      targets: reel,
      x: targetX,
      duration: REEL_DURATION,
      delay,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (frame) {
          try { frame.destroy(); } catch (e) {}
          this._reelFrames = this._reelFrames.filter(f => f !== frame);
        }
        if (frameIn) {
          try { frameIn.destroy(); } catch (e) {}
          this._reelFrames = this._reelFrames.filter(f => f !== frameIn);
        }
        this.reelContainers = this.reelContainers.filter(r => r !== reel);
        // Ленту уничтожаем сразу: иначе вставшие ячейки висят на экране
        // и смешиваются со следующей круткой/призами.
        try { reel.destroy(); } catch (e) {}
        this.finishReel(reward);
      }
    });
  }

  // Выдача награды + строка итога. В мультирежиме строки копятся.
  _grantReward(reward) {
    if (reward.type === 'coins') {
      addCoins(reward.amount);
      return `+${reward.amount}${reward.jackpot ? ' ДЖЕКПОТ!' : ''}`;
    }
    if (reward.type === 'weapon') {
      unlockWeapon(reward.weapon.name);
      return `Новое оружие: ${getWeaponLabel(reward.weapon.name)}`;
    }
    if (reward.type === 'dup') {
      const comp = Math.round(reward.weapon.price / 3);
      addCoins(comp);
      // Вторая такая же пушка — компенсация (п.9), не «новое оружие».
      return `Компенсация за ${getWeaponLabel(reward.weapon.name)} +${comp}`;
    }
    if (reward.type === 'gear') {
      if (gearOwned(reward.gear)) {
        const comp = Math.round(reward.gear.price / 3);
        addCoins(comp);
        return `Повтор: ${reward.gear.label} +${comp}`;
      }
      gearUnlockBuy(reward.gear);
      return `Одежда: ${reward.gear.label}`;
    }
    if (reward.type === 'geardup') {
      const comp = Math.round((reward.gear ? reward.gear.price : 300) / 3);
      addCoins(comp);
      return `Повтор: ${reward.gear ? reward.gear.label : 'одежда'} +${comp}`;
    }
    unlockSkin(reward.skin.id);
    // Штамп происхождения скина (кейс): контракт меняет на легендарный
    // только эпики из кейса Скинов.
    try {
      gameState.skinOrigin = gameState.skinOrigin || {};
      if (this._grantCaseId) gameState.skinOrigin[reward.skin.id] = this._grantCaseId;
      saveGameState();
    } catch (e) {}
    return `Скин: ${reward.skin.name}`;
  }

  finishReel(reward) {
    // Награды выдаются разом, когда докрутился последний барабан.
    // Оплата и счётчики — в openCase() при клике.
    try { (this._finishedRewards || (this._finishedRewards = [])).push(reward); } catch (e) {}
    // Легенда в улове — салют один раз, когда докрутился
    // последний барабан (иконки уже на экране). Стволы и лего-скины
    // делят салют, подпись разная.
    try {
      if (this._pendingReels <= 1) {
        const list = (this._multiRewards && this._multiRewards.length ? this._multiRewards : [reward]) || [];
        const hasGun = list.some(rw => rw && rw.type === 'weapon' && rw.weapon && rw.weapon.category === 'melee');
        const hasSkin = list.some(rw => rw && rw.type === 'skin' && rw.skin && (rw.skin.rarity | 0) >= 4);
        if (hasGun) this._legendaryWeaponFx('gun');
        else if (hasSkin) this._legendaryWeaponFx('skin');
      }
    } catch (e) {}
    this._pendingReels--;
    if (this._pendingReels > 0) return;
    // Финал крутки — строго один раз (флаг от двойной финализации):
    // сначала оплата и счётчики, потом выдача всех накопленных наград.
    if (this._pendingFinalized) return;
    this._pendingFinalized = true;
    ((this._finishedRewards && this._finishedRewards.length) ? this._finishedRewards : [reward])
      .forEach(rw => { try { this._grantReward(rw); } catch (e) {} });
    try { saveGameState(); } catch (e) {}
    this._clearReels();
    this._showMultiIcons(this._multiRewards && this._multiRewards.length ? this._multiRewards : [reward]);
    this._multiLines = [];
    // Кнопка ОК: убирает блок наград, возвращает ряд открытия.
    this._showOkButton();

    this.refreshCoins();
    this.opening = false;
    this.open.setStyle({ color: '#ffffff' });
    if (this._backBtn) this._backBtn.setStyle({ color: '#ffffff' });
  }

  // Салют легендарному стволу: вспышка, кольца, баннер, тряска, фанфары.
  // Всё поверх иконок (глубина 70+), всё умирает само по таймерам.
  _legendaryWeaponFx(kind) {
    try {
      const D = 70;
      try { this.cameras.main.shake(450, 0.012); } catch (e) {}
      const flash = this.add.rectangle(gameW(this) / 2, 360, gameW(this), 720, 0xffd24a, 0).setDepth(D);
      this.tweens.add({
        targets: flash, alpha: { from: 0.5, to: 0 }, duration: 800,
        onComplete: () => { try { flash.destroy(); } catch (e) {} }
      });
      [0, 200, 400].forEach(delay => {
        const ring = this.add.graphics().setDepth(D + 1);
        const st = { r: 30, a: 0.9 };
        this.tweens.add({
          targets: st, r: 340, a: 0, duration: 1100, delay,
          onUpdate: () => {
            try {
              ring.clear();
              ring.lineStyle(7, 0xffd24a, Math.max(0, st.a));
              ring.strokeCircle(gameW(this) / 2, 380, Math.max(1, st.r));
            } catch (e) {}
          },
          onComplete: () => { try { ring.destroy(); } catch (e) {} }
        });
      });
      const title = kind === 'skin' ? 'ЛЕГЕНДАРНЫЙ СКИН!' : 'ЛЕГЕНДАРНОЕ ОРУЖИЕ!';
      const t = this.add.text(gameW(this) / 2, 200, title, {
        fontSize: '44px', color: '#ffd24a', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 8
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

  // Фанфары без файлов: 4 ноты вверх через WebAudio (как клац трубки).
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

  // Витрина призов мультиоткрытия: общий фон + крупные ячейки в ряд,
  // плавно съезжаются с боков. Все подписи — внутри ячеек, ничего не налезает.
  // Несколько денежных призов — одна ячейка суммой (компенсации за дубли
  // с подписью «за что» — отдельно). Выдача не меняется, только показ.
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
    const CELL_W = 240;
    const CELL_H = 200;
    const step = 260;
    const y = 430;
    const x0 = gameW(this) / 2 - (n - 1) * step / 2;

    const bw = (n - 1) * step + CELL_W + 80;
    const bh = CELL_H + 110;
    const bg = this.add.graphics().setDepth(50);
    bg.fillStyle(0x0d0d2a, 0.96);
    bg.fillRoundedRect(gameW(this) / 2 - bw / 2, y - bh / 2, bw, bh, 16);
    bg.lineStyle(3, 0xffd24a, 1);
    bg.strokeRoundedRect(gameW(this) / 2 - bw / 2, y - bh / 2, bw, bh, 16);
    bg.setAlpha(0);
    this._multiIcons.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 400 });

    const title = this.add.text(gameW(this) / 2, y - bh / 2 + 22, 'НАГРАДЫ', {
      fontSize: '20px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(51).setAlpha(0);
    this._multiIcons.push(title);
    this.tweens.add({ targets: title, alpha: 1, duration: 400, delay: 200 });

    list.forEach((entry, i) => {
      const cell = this._reelCell(entry, CELL_W, CELL_H, this._caseDef().price);
      cell.setDepth(51);
      const tx = x0 + i * step;
      // Стартуем с боков — едем в центр.
      cell.setPosition(i < n / 2 ? -160 : gameW(this) + 160, y + 14);
      cell.setAlpha(0);
      this._multiIcons.push(cell);
      this.tweens.add({
        targets: cell,
        x: tx,
        alpha: 1,
        duration: 600,
        delay: i * 140,
        ease: 'Cubic.Out'
      });
    });
  }
}
