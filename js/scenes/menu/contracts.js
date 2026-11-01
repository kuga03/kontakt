import { gameState, addCoins, saveGameState, getPass } from '../../data/gameState.js?v=171';
import { PASS_TIERS, PASS_QUESTS, PASS_PREMIUM_PRICE, passDaysLeft, passEndDate, passQuestProgress, passTierUnlocked, passClaimedCount, passHasUnclaimed, passActiveTier } from '../../data/pass.js?v=170';

import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';
import { gameW } from '../../ui/layout.js?v=3';

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

export function createContractsRow() {
    const _cx = gameW(this) / 2;
    const ps = getPass();
    const done = passClaimedCount(ps);
    const daysLeft = passDaysLeft();
    this._contractsDays = daysLeft;
    this._contractsCounter = this.add.text(_cx, 612, `КОНТРАКТЫ · ${done}/40 · сезон: ${daysLeft} дн.`, {
      fontSize: '14px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);
    this._contractsBtn = this.createButton(_cx, 662, 'Контракты', () => this._openContracts(), false, null, null, null, 16);
    this._contractsOverlay = null;
    this._refreshContractsGlow();
  }

  // Подсветка кнопки, пока есть готовое к выдаче (с учётом premium).
export function _refreshContractsGlow() {
    try {
      const ps = getPass();
      const has = passHasUnclaimed(ps);
      // Монеты в топ-баре — живьём (клейм/покупка премиума без рестарта сцены).
      // Кроме полёта монет: там сумма докручивается анимацией, не прыгаем.
      try { if (this._topCoinsT && !this._coinsFlying) this._topCoinsT.setText(`${gameState.coins}`); } catch (e) {}
      this._contractsDays = passDaysLeft();
      if (this._contractsCounter) {
        let t = `КОНТРАКТЫ · ${passClaimedCount(ps)}/40 · сезон: ${this._contractsDays} дн.`;
        if (has) t += ' · ЗАБЕРИ НАГРАДУ!';
        this._contractsCounter.setText(t);
      }
      const btn = this._contractsBtn;
      if (!btn) return;
      if (has) {
        if (!this._contractsGlowTw) {
          if (btn._btnTxt) btn._btnTxt.setColor('#ffdd44');
          if (btn._paintIcon) btn._paintIcon(0xffdd44);
          this._contractsGlowTw = this.tweens.add({
            targets: btn,
            scale: { from: 1, to: 1.07 },
            yoyo: true,
            repeat: -1,
            duration: 900,
            ease: 'Sine.easeInOut'
          });
        }
      } else {
        if (this._contractsGlowTw) {
          try { this._contractsGlowTw.stop(); } catch (e) {}
          this._contractsGlowTw = null;
          try { btn.setScale(1); } catch (e) {}
        }
        if (btn._btnTxt) btn._btnTxt.setColor('#ffffff');
        if (btn._paintIcon) btn._paintIcon(0xdfe8ff);
      }
    } catch (e) {}
  }

export function _closeContracts() {
    try {
      if (this._contractsWheel) {
        try { this.input.off('wheel', this._contractsWheel); } catch (e) {}
        this._contractsWheel = null;
      }
      try { (this._cellTweens || []).forEach(t => { try { t.stop(); } catch (e) {} }); } catch (e) {}
      this._cellTweens = null;
      this._renderContractsStrip = null;
      this._contractsStrip = null;
      this._contractsVel = 0;
      // Запечённую статику ленты — в утиль, иначе течь текстур.
      try { if (this._cstripKey) this.textures.remove(this._cstripKey); } catch (e) {}
      this._cstripKey = null;
      // Вернуть меню из-под шторки.
      try { (this._contractsHidden || []).forEach(o => { try { o.visible = true; } catch (e) {} }); } catch (e) {}
      this._contractsHidden = null;
      (this._contractsTweens || []).forEach(t => { try { t.stop(); } catch (e) {} });
      this._contractsTweens = null;
      (this._contractsOverlay || []).forEach(o => { try { o.destroy(); } catch (e) {} });
    } catch (e) {}
    this._contractsOverlay = null;
  }

  // Забрать все готовые награды контрактов разом. Возвращает {count, gained}.
  export function _claimAllContracts() {
    const ps = getPass();
    let count = 0;
    let gained = 0;
    for (const track of ['n', 'p']) {
      const cl = ps.claimed[track] || (ps.claimed[track] = {});
      for (let i = 1; i <= PASS_TIERS; i++) {
        if (cl[i]) continue;
        if (!passTierUnlocked(ps, track, i)) continue;
        const q = PASS_QUESTS[i - 1];
        if (!q || passQuestProgress(ps, q) < q.need) continue;
        if (track === 'p' && !ps.premium) continue;
        cl[i] = true;
        gained += track === 'n' ? q.reward : q.rewardP;
        count++;
      }
    }
    if (count === 0) return { count: 0, gained: 0 };
    addCoins(gained);
    saveGameState();
    try { this._refreshContractsGlow(); } catch (e) {}
    return { count, gained };
  }

  // Окно баттл-пасса: 40 ярусов × 2 ряда (обычный + премиум), одна лента.
  // Скролл — колесом мыши (стрелок нет). Награды строго по порядку.
  export function _openContracts() {
    this._closeContracts();
    this._contractsOverlay = [];
    this._contractsTweens = [];
    const put = (o) => { this._contractsOverlay.push(o); return o; };
    const ps = getPass();
    const dim = this.add.rectangle(gameW(this) / 2, 360, gameW(this), 720, 0x000000, 0.72).setDepth(140);
    dim.setInteractive();
    put(dim);
    const PW = 1060, PH = 560, PX = gameW(this) / 2, PY = 360;
    const x0 = PX - PW / 2, y0 = PY - PH / 2;
    const D = 142;
    // Панель: золотая окантовка + тёмное нутро + плашка + заклёпки + ромб.
    const bg = this.add.graphics().setDepth(141);
    bg.fillStyle(0x8a6a10, 1);
    bg.fillRoundedRect(x0 - 2, y0 - 2, PW + 4, PH + 4, 18);
    bg.fillStyle(0xd8a920, 1);
    bg.fillRoundedRect(x0, y0, PW, PH, 16);
    bg.fillStyle(0x0d0d24, 0.98);
    bg.fillRoundedRect(x0 + 3, y0 + 3, PW - 6, PH - 6, 14);
    bg.fillStyle(0xffe9a0, 0.35);
    bg.fillRoundedRect(x0 + 6, y0 + 2, PW - 12, 3, 2);
    bg.fillStyle(0x1c1c38, 1);
    bg.fillRect(x0 + 3, y0 + 17, PW - 6, 60);
    bg.fillCircle(x0 + 17, y0 + 17, 14);
    bg.fillCircle(x0 + PW - 17, y0 + 17, 14);
    bg.fillStyle(0xd8a920, 1);
    bg.fillRect(x0 + 3, y0 + 77, PW - 6, 2);
    bg.fillTriangle(PX - 8, y0 + 78, PX + 8, y0 + 78, PX, y0 + 70);
    bg.fillTriangle(PX - 8, y0 + 78, PX + 8, y0 + 78, PX, y0 + 86);
    bg.fillStyle(0x6a5208, 1);
    [[x0 + 12, y0 + 12], [x0 + PW - 12, y0 + 12], [x0 + 12, y0 + PH - 12], [x0 + PW - 12, y0 + PH - 12]].forEach(([rx, ry]) => {
      bg.fillCircle(rx, ry, 4);
      bg.fillStyle(0xffe9a0, 0.8);
      bg.fillCircle(rx - 1, ry - 1, 1.5);
      bg.fillStyle(0x6a5208, 1);
    });
    put(bg);
    put(this.add.text(PX, y0 + 32, `★ КОНТРАКТЫ · сезон до ${passEndDate()} · осталось ${passDaysLeft()} дн. ★`, {
      fontSize: '20px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(D));
    // Премиум-статус / покупка (за монеты — платёжки ещё нет, см. donate.js).
    if (ps.premium) {
      // Куплен: вместо кнопки — золотая плашка «ПРЕМИУМ».
      const pt = this.add.text(PX, y0 + 60, '★ ПРЕМИУМ ★', {
        fontSize: '16px', color: '#1a1400', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(D + 1);
      const pw = pt.displayWidth + 36, ph = pt.displayHeight + 14;
      const pq = this.add.graphics().setDepth(D);
      pq.fillStyle(0x8a6a10, 1);
      pq.fillRoundedRect(PX - pw / 2, y0 + 60 - ph / 2, pw, ph, 10);
      pq.fillStyle(0xffd24a, 1);
      pq.fillRoundedRect(PX - pw / 2 + 2, y0 + 60 - ph / 2 + 2, pw - 4, ph - 4, 9);
      pq.fillStyle(0xffffff, 0.35);
      pq.fillRoundedRect(PX - pw / 2 + 5, y0 + 60 - ph / 2 + 4, pw - 10, 3, 2);
      put(pq);
      put(pt);
    } else {
      const can = (gameState.coins | 0) >= PASS_PREMIUM_PRICE;
      const pbPrice = `★ ПРЕМИУМ — ${PASS_PREMIUM_PRICE.toLocaleString('ru-RU')} монет (золотой ряд)`;
      const pb = this.add.text(PX, y0 + 60, pbPrice, {
        fontSize: '14px', color: can ? '#ffd24a' : '#667788', fontStyle: 'bold',
        backgroundColor: can ? '#4a3a10' : '#22222e', padding: 6
      }).setOrigin(0.5).setDepth(D);
      pb.setInteractive({ useHandCursor: true });
      pb.on('pointerdown', () => {
        const ps2 = getPass();
        if (ps2.premium) { this._openContracts(); return; }
        if ((gameState.coins | 0) < PASS_PREMIUM_PRICE) {
          pb.setText('★ Не хватает монет!');
          pb.setColor('#ff6666');
          // Вернуть ценник через секунду (окно ещё открыто).
          this.time.delayedCall(1200, () => {
            try {
              if (!this._contractsOverlay || getPass().premium) return;
              pb.setText(pbPrice);
              pb.setColor((gameState.coins | 0) >= PASS_PREMIUM_PRICE ? '#ffd24a' : '#667788');
            } catch (e) {}
          });
          return;
        }
        gameState.coins -= PASS_PREMIUM_PRICE;
        ps2.premium = true;
        saveGameState();
        try { this._refreshContractsGlow(); } catch (e) {}
        this._openContracts();
      });
      pb.on('pointerover', () => { if ((gameState.coins | 0) >= PASS_PREMIUM_PRICE) pb.setColor('#ffff88'); });
      pb.on('pointerout', () => {
        try {
          if (pb.text === '★ Не хватает монет!') pb.setText(pbPrice);
        } catch (e) {}
        pb.setColor((gameState.coins | 0) >= PASS_PREMIUM_PRICE ? '#ffd24a' : '#667788');
      });
      put(pb);
    }
    // Счёт всего внизу, подальше от ячеек.
    let totGot = 0;
    try {
      const cl = (ps && ps.claimed) || {};
      for (let k = 1; k <= PASS_TIERS; k++) {
        if ((cl.n || {})[k]) totGot++;
        if ((cl.p || {})[k]) totGot++;
      }
    } catch (e) {}
    put(this.add.text(PX, 560, `Награды по порядку · крути колесом · забрано ${totGot}/80`, {
      fontSize: '11px', color: '#8a8aa0'
    }).setOrigin(0.5).setDepth(D));

    // Лента: оба ряда в одном контейнере, общий скролл, маска-окно.
    const viewL = PX - PW / 2 + 54, viewR = PX + PW / 2 - 54;
    const viewW = viewR - viewL;
    const CW = 150, CH = 120, STEP = CW + 12;
    const maxScroll = Math.max(0, PASS_TIERS * STEP - viewW);
    const maskGfx = this.add.graphics();
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(viewL, 196, viewW, 320);
    const mask = new Phaser.Display.Masks.GeometryMask(this, maskGfx);
    maskGfx.setVisible(false);
    put(maskGfx);
    const strip = this.add.container(viewL, 0).setDepth(D);
    strip.setMask(mask);
    put(strip);
    const setScroll = (v, snap) => {
      passScrollX = Math.max(0, Math.min(maxScroll, v));
      if (snap) {
        strip.x = viewL - passScrollX;
        this._contractsTarget = passScrollX;
        this._contractsVel = 0;
      }
    };
    setScroll(passScrollX, true);
    // Колесо мыши вместо стрелок (dy + dx для трекпадов): задаёт цель
    // и толчок инерции, update() плавно дотягивает ленту.
    this._contractsStrip = strip;
    this._contractsViewL = viewL;
    this._contractsMax = maxScroll;
    this._contractsTarget = passScrollX;
    this._contractsVel = 0;
    this._contractsWheel = (pointer, objs, dx, dy) => {
      if (!this._contractsOverlay) return;
      const d = (dy || 0) + (dx || 0);
      this._contractsTarget = Math.max(0, Math.min(maxScroll, this._contractsTarget + d * 0.7));
      this._contractsVel = (this._contractsVel || 0) + d * 0.35;
    };
    this.input.on('wheel', this._contractsWheel);

    const rowDefs = [
      { track: 'n', label: 'ОБЫЧНЫЕ НАГРАДЫ', color: '#7db8ff', line: 0x4488cc, rowY: 266 },
      { track: 'p', label: '★ ПРЕМИУМ', color: '#ffd24a', line: 0xd8a920, rowY: 434 }
    ];
    rowDefs.forEach(rd => {
      put(this.add.text(viewL + 4, rd.rowY - 80, rd.label, {
        fontSize: '13px', color: rd.color, fontStyle: 'bold'
      }).setOrigin(0, 0.5).setDepth(D));
      const ul = this.add.graphics().setDepth(D);
      ul.lineStyle(3, rd.line, 0.9);
      ul.lineBetween(viewL + 4, rd.rowY - 70, viewL + 174, rd.rowY - 70);
      ul.lineStyle(1, rd.line, 0.5);
      ul.lineBetween(viewL + 4, rd.rowY - 64, viewL + 120, rd.rowY - 64);
      put(ul);
      // Дальний забранный ярус ряда — для рельсы (считается раз за открытие).
      let furthest = 0;
      try {
        const cl = ((ps.claimed || {})[rd.track]) || {};
        for (let k = PASS_TIERS; k >= 1; k--) {
          if (cl[k]) { furthest = k; break; }
        }
      } catch (e) {}
      rd._furthest = furthest;
    });
    // Виртуализация + запекание: статика ВСЕХ ярусов (рамки, медали, бары,
    // рельсы, пластины, замки) печётся в одну текстуру 1 раз за открытие
    // (вектор каждый кадр ронял FPS до ~5), живьём — только тексты/кнопки
    // видимого окна. На выходе ~70 дешёвых объектов вместо 800.
    this._stripRange = [-1, -1];
    this._cellTweens = [];
    this._cstripSeq = (this._cstripSeq | 0) + 1;
    const renderStrip = () => {
      const base = Math.max(0, this._contractsTarget || 0);
      const i0 = Math.max(1, Math.floor(base / STEP) - 1);
      const i1 = Math.min(PASS_TIERS, Math.ceil((base + viewW) / STEP) + 1);
      const bakedOk = !!this._cstripKey;
      if (bakedOk && this._stripRange[0] === i0 && this._stripRange[1] === i1) return;
      this._stripRange = [i0, i1];
      try { (this._cellTweens || []).forEach(t => { try { t.stop(); } catch (e) {} }); } catch (e) {}
      this._cellTweens = [];
      try { strip.removeAll(true); } catch (e) {}
      if (!bakedOk) {
        const gt = this.add.graphics();
        try {
          rowDefs.forEach(rd => {
            const sy = rd.rowY + CH / 2 + 12;
            const totalW = PASS_TIERS * STEP;
            gt.fillStyle(0x14142a, 1);
            gt.fillRoundedRect(-4, sy - 5, totalW + 8, 10, 5);
            gt.fillStyle(0x2e2e4e, 1);
            for (let s = 0; s < PASS_TIERS; s++) {
              gt.fillRect(s * STEP + 6, sy - 5, 10, 10);
            }
            if (rd._furthest > 0) {
              gt.fillStyle(rd.line, 1);
              gt.fillRoundedRect(-4, sy - 2, Math.max(8, rd._furthest * STEP), 4, 2);
              gt.fillStyle(0xffffff, 0.35);
              gt.fillRect(-4, sy - 2, Math.max(8, rd._furthest * STEP), 1.5);
              gt.fillStyle(rd.line, 1);
              gt.fillCircle(Math.max(8, rd._furthest * STEP), sy, 7);
              gt.lineStyle(2, 0xffffff, 0.6);
              gt.strokeCircle(Math.max(8, rd._furthest * STEP), sy, 7);
            }
            for (let i = 1; i <= PASS_TIERS; i++) {
              this._passCellArt(gt, ps, rd.track, i, (i - 1) * STEP + CW / 2, rd.rowY, CW, CH);
            }
          });
          // Общие номера ярусов: один кружок на рельсе между рядами
          // (ячейки 206..326 и 374..494, рельса верхнего ряда на 338 —
          // кружок на 356: рельсу почти не задевает, ячейки свободны).
          for (let i = 1; i <= PASS_TIERS; i++) {
            const bcx = (i - 1) * STEP + CW / 2, bcy = 356;
            gt.fillStyle(0x101020, 1);
            gt.fillCircle(bcx, bcy, 13);
            gt.fillStyle(0x1c1c34, 1);
            gt.fillCircle(bcx, bcy, 11);
            gt.lineStyle(2, 0x9a9ab0, 1);
            gt.strokeCircle(bcx, bcy, 12);
            gt.fillStyle(0xffffff, 0.25);
            gt.fillCircle(bcx - 3, bcy - 4, 3);
          }
        } catch (e) {}
        const key = 'cstrip_' + this._cstripSeq + '_' + Date.now() % 100000;
        try {
          gt.generateTexture(key, PASS_TIERS * STEP, 520);
        } catch (e) {}
        try { gt.destroy(); } catch (e) {}
        if (this.textures.exists(key)) {
          this._cstripKey = key;
          strip.add(this.add.image(0, 0, key).setOrigin(0, 0));
        } else {
          this._cstripKey = null;
        }
      } else if (this._cstripKey && this.textures.exists(this._cstripKey)) {
        strip.add(this.add.image(0, 0, this._cstripKey).setOrigin(0, 0));
      }
      rowDefs.forEach(rd => {
        for (let i = i0; i <= i1; i++) {
          this._passCellLive(strip, ps, rd.track, i, (i - 1) * STEP + CW / 2, rd.rowY, CW, CH, viewL, viewR);
        }
      });
      // Живые цифры общих номеров (видимое окно; чистятся removeAll выше).
      for (let i = i0; i <= i1; i++) {
        const nt = this.add.text((i - 1) * STEP + CW / 2, 356, '' + i, {
          fontSize: '13px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        strip.add(nt);
      }
    };
    this._renderContractsStrip = renderStrip;
    renderStrip();

    // Автоскролл к первому незабранному ярусу любого ряда, если за кадром.
    try {
      const psA = getPass();
      let act = passActiveTier(psA);
      try {
        const clp = (psA.claimed || {}).p || {};
        for (let k = 1; k <= PASS_TIERS; k++) {
          if (!clp[k] && psA.premium) { act = Math.min(act, k); break; }
        }
      } catch (e) {}
      const left = (act - 1) * STEP;
      if (left < passScrollX || left + CW > passScrollX + viewW) setScroll(left - 200);
    } catch (e) {}

    // Кнопка «ЗАБРАТЬ ВСЁ» — забирает все готовые награды разом.
    const claimAllBtn = this.add.text(PX - 230, PY + PH / 2 - 34, 'ЗАБРАТЬ ВСЁ', {
      fontSize: '15px', color: '#1a1a00', fontStyle: 'bold',
      backgroundColor: '#ffd24a', padding: 10
    }).setOrigin(0.5).setDepth(D + 1);
    claimAllBtn.setInteractive({ useHandCursor: true });
    claimAllBtn.on('pointerdown', () => {
      const res = _claimAllContracts.call(this);
      if (!res || res.count <= 0) return;
      const overlayWas = this._contractsOverlay;
      this._flyCoinsToTop(PX - 230, PY + PH / 2 - 34, res.gained, () => {
        try {
          if (this._contractsOverlay === overlayWas && overlayWas) this._openContracts();
        } catch (e) {}
      });
    });
    claimAllBtn.on('pointerover', () => claimAllBtn.setColor('#000000'));
    claimAllBtn.on('pointerout', () => claimAllBtn.setColor('#1a1a00'));
    put(claimAllBtn);

    const closeBtn = this.add.text(PX + 230, PY + PH / 2 - 34, 'Закрыть', {
      fontSize: '16px', color: '#ffffff', padding: 10
    }).setOrigin(0.5).setDepth(D + 1);
    // Пластина под кнопкой закрытия.
    const cbw = closeBtn.displayWidth + 28, cbh = closeBtn.displayHeight + 16;
    const cbCy = PY + PH / 2 - 34;
    const cb = this.add.graphics().setDepth(D);
    cb.fillStyle(0x3a2020, 1);
    cb.fillRoundedRect(PX - cbw / 2, cbCy - cbh / 2, cbw, cbh, 10);
    cb.lineStyle(2, 0x8a4a4a, 1);
    cb.strokeRoundedRect(PX - cbw / 2, cbCy - cbh / 2, cbw, cbh, 10);
    cb.fillStyle(0xffffff, 0.08);
    cb.fillRoundedRect(PX - cbw / 2 + 3, cbCy - cbh / 2 + 3, cbw - 6, 4, 2);
    put(cb);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeContracts());
    closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#ffff55' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ color: '#ffffff' }));
    put(closeBtn);
    // Шторка: меню под окном не рисуем (овердроу + объекты каждый кадр).
    // Затемнение и так всё перекрывает. Возврат — в _closeContracts.
    this._contractsHidden = [];
    try {
      this.children.each(o => {
        if (o.depth < 140 && o.visible) {
          o.visible = false;
          this._contractsHidden.push(o);
        }
      });
    } catch (e) {}
  }

  // Ячейка яруса: рамка, номер, задание, прогресс, награда/кнопка.
  // Ячейка яруса: медаль, задание, прогресс с бликом, награда/кнопка/замок.
  // gr — общая графика ряда для статики (рамки, медали, бары): ячейки
  // пересоздаются при скролле, а статичная графика едет одним объектом.
  // Статика ячейки в общую графику ряда (для запекания в текстуру).
export function _passCellArt(gr, ps, track, i, cx, rowY, CW, CH) {
    const q = PASS_QUESTS[i - 1];
    if (!q) return;
    const unlocked = passTierUnlocked(ps, track, i);
    const cur = passQuestProgress(ps, q);
    const done = cur >= q.need;
    const claimed = !!((ps.claimed[track] || {})[i]);
    const isP = track === 'p';
    const canClaim = unlocked && done && !claimed && (!isP || ps.premium);
    const preview = isP && !ps.premium;
    const visU = unlocked || preview;
    const frameCol = claimed ? 0x3a6a4a : (canClaim ? 0xffd24a : (unlocked ? (isP ? 0x8a6a20 : 0x3a6a8a) : 0x2a2a3a));
    if (canClaim) {
      gr.lineStyle(6, 0xffd24a, 0.28);
      gr.strokeRoundedRect(cx - CW / 2 - 4, rowY - CH / 2 - 4, CW + 8, CH + 8, 13);
    }
    gr.fillStyle(visU ? (isP ? 0x1e1c34 : 0x121226) : 0x0a0a16, visU ? 0.97 : 0.8);
    gr.fillRoundedRect(cx - CW / 2, rowY - CH / 2, CW, CH, 10);
    gr.fillStyle(0xffffff, visU ? 0.06 : 0.03);
    gr.fillRoundedRect(cx - CW / 2 + 3, rowY - CH / 2 + 3, CW - 6, 4, 2);
    gr.lineStyle(canClaim ? 3 : 2, frameCol, 1);
    gr.strokeRoundedRect(cx - CW / 2, rowY - CH / 2, CW, CH, 10);
    gr.lineStyle(1, frameCol, 0.45);
    gr.strokeRoundedRect(cx - CW / 2 + 4, rowY - CH / 2 + 4, CW - 8, CH - 8, 7);
    gr.fillStyle(frameCol, 0.9);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy2]) => {
      gr.fillCircle(cx + sx * (CW / 2 - 9), rowY + sy2 * (CH / 2 - 9), 2.6);
    });
    if (claimed) {
      gr.fillStyle(0x2a6a3a, 0.25);
      gr.fillRoundedRect(cx - CW / 2 + 2, rowY - CH / 2 + 2, CW - 4, CH - 4, 9);
    }
    // Номер яруса больше не в ячейке (дублировался в обоих рядах) —
    // один общий на рельсе между рядами (см. bake ниже + live-текст).
    const bw = CW - 20, bx0 = cx - bw / 2, by0 = rowY - 2;
    gr.fillStyle(0x14142a, 1);
    gr.fillRoundedRect(bx0, by0, bw, 12, 6);
    gr.lineStyle(1, 0x000000, 0.5);
    gr.strokeRoundedRect(bx0, by0, bw, 12, 6);
    if (visU && cur > 0) {
      const fw = Math.max(12, bw * Math.min(1, cur / q.need));
      gr.fillStyle(done ? 0x33cc55 : (isP ? 0xd8a920 : 0x4488cc), 1);
      gr.fillRoundedRect(bx0, by0, fw, 12, 6);
      gr.fillStyle(0xffffff, 0.22);
      gr.fillRoundedRect(bx0 + 2, by0 + 2, Math.max(0, fw - 4), 3, 2);
      if (done) {
        gr.fillStyle(0x33cc55, 1);
        gr.fillCircle(bx0 + bw - 3, by0 + 6, 4);
        gr.lineStyle(1.5, 0xffffff, 0.7);
        gr.strokeCircle(bx0 + bw - 3, by0 + 6, 4);
      }
    }
    gr.fillStyle(0x0a0a16, 0.55);
    for (let sgm = 1; sgm < 4; sgm++) gr.fillRect(bx0 + (bw / 4) * sgm - 1, by0 + 1, 2, 10);
    // Замки — фиксированные позиции.
    if (!unlocked) {
      if (isP && !ps.premium) {
        gr.fillStyle(0x2e2e42, 1);
        gr.fillRoundedRect(cx + 48, rowY + 39, 16, 12, 2);
        gr.lineStyle(1, 0x8a8aa0, 0.6);
        gr.strokeRoundedRect(cx + 48, rowY + 39, 16, 12, 2);
        gr.lineStyle(3, 0x8a8aa0, 1);
        gr.beginPath();
        gr.arc(cx + 56, rowY + 40, 6, Math.PI, 0, false);
        gr.strokePath();
        gr.fillStyle(0x11111c, 1);
        gr.fillCircle(cx + 56, rowY + 45, 2);
      } else {
        gr.fillStyle(0x2e2e42, 1);
        gr.fillRoundedRect(cx + 46, rowY + 43, 20, 15, 3);
        gr.lineStyle(1, 0x8a8aa0, 0.5);
        gr.strokeRoundedRect(cx + 46, rowY + 43, 20, 15, 3);
        gr.lineStyle(4, 0x55556a, 1);
        gr.beginPath();
        gr.arc(cx + 56, rowY + 45, 8, Math.PI, 0, false);
        gr.strokePath();
        gr.fillStyle(0x11111c, 1);
        gr.fillCircle(cx + 56, rowY + 50, 2.5);
      }
    }
  }

  // Живьё ячейки: тексты, иконки, кнопки (пересоздаётся в видимом окне).
  // Раскладка фиксированная: иконка cx-52, текст cx+8, замок cx+56.
  // Номер яруса — общий между рядами (рисуется в renderStrip, не здесь).
export function _passCellLive(strip, ps, track, i, cx, rowY, CW, CH, viewL, viewR) {
    const q = PASS_QUESTS[i - 1];
    if (!q) return;
    const unlocked = passTierUnlocked(ps, track, i);
    const cur = passQuestProgress(ps, q);
    const done = cur >= q.need;
    const claimed = !!((ps.claimed[track] || {})[i]);
    const isP = track === 'p';
    const canClaim = unlocked && done && !claimed && (!isP || ps.premium);
    const preview = isP && !ps.premium;
    const visU = unlocked || preview;
    const nameT = this.add.text(cx, rowY - 28, visU ? q.name : '???', {
      fontSize: '12px', color: !visU ? '#4a4a5a' : (done ? '#7dffa0' : '#ffffff'), fontStyle: 'bold'
    }).setOrigin(0.5);
    strip.add(nameT);
    const prog = this.add.text(cx, rowY + 24, visU ? cur + '/' + q.need : '???', {
      fontSize: '11px', color: '#ffffff'
    }).setOrigin(0.5);
    strip.add(prog);
    const rw = isP ? q.rewardP : q.reward;
    const rwTxt = '+' + rw.toLocaleString('ru-RU');
    const coinAt = (x, y, alpha, sc) => {
      try {
        if (!this.textures.exists('icon_coins')) return;
        const ic = this.add.image(x, y, 'icon_coins');
        ic.setScale(sc || 0.8);
        ic.setAlpha(alpha == null ? 0.9 : alpha);
        strip.add(ic);
      } catch (e) {}
    };
    if (claimed) {
      const t = this.add.text(cx + 8, rowY + 45, '✓ ' + rwTxt, {
        fontSize: '12px', color: '#55cc66', fontStyle: 'bold'
      }).setOrigin(0.5);
      strip.add(t);
      coinAt(cx - 52, rowY + 45, 0.9, 0.9);
    } else if (canClaim) {
      // Забор — кнопкой «ЗАБРАТЬ ВСЁ» внизу окна (индивидуальных кнопок нет).
      const t = this.add.text(cx + 8, rowY + 45, rwTxt, {
        fontSize: '12px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0.5);
      strip.add(t);
      coinAt(cx - 52, rowY + 45, 1, 0.9);
    } else if (isP && !ps.premium) {
      const t = this.add.text(cx + 8, rowY + 45, '★ ' + rwTxt, {
        fontSize: '11px', color: '#c8a83a', fontStyle: 'bold'
      }).setOrigin(0.5);
      strip.add(t);
      coinAt(cx - 52, rowY + 45, 0.85, 0.8);
    } else if (!unlocked) {
      const t2 = this.add.text(cx + 8, rowY + 45, rwTxt, {
        fontSize: '11px', color: '#4a4a5c', fontStyle: 'bold'
      }).setOrigin(0.5);
      strip.add(t2);
      coinAt(cx - 52, rowY + 45, 0.35, 0.8);
    } else {
      const t = this.add.text(cx + 8, rowY + 45, rwTxt, {
        fontSize: '12px', color: isP ? '#ffd24a' : '#c8c8d8', fontStyle: 'bold'
      }).setOrigin(0.5);
      strip.add(t);
      coinAt(cx - 52, rowY + 45, isP ? 1 : 0.85, 0.9);
    }
  }
  // Тост о незабранных наградах (без выдачи — она по кнопке в сцене).
  // Справа в свободной зоне (не поверх заголовка/панелей) и ниже модалки.
