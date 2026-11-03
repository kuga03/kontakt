import { gameState, addCoins, saveGameState } from '../../data/gameState.js?v=175';

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

export function dailyRewardFor(streak) {
    const day = ((Math.max(1, streak | 0) - 1) % 30) + 1;
    const week = Math.floor((day - 1) / 7);
    const diw = (day - 1) % 7;
    return 700 + week * 600 + diw * 100;
  }

export function dailyMonthKey(now) {
    try {
      const d = now instanceof Date ? now : new Date(now);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch (e) { return ''; }
  }

export function dailyAvailable() {
    try {
      const nowMs = Date.now();
      // ВАЖНО: без | 0 — метки времени ~1.7e12 не лезут в 32 бита,
      // обрезка превращала их в мусор и ломала все проверки (был баг
      // с бесконечным подарком + мёртвой защитой отката).
      const guard = Number(gameState.timeGuard) || 0;
      if (guard && nowMs < guard - 3600 * 1000) return { avail: false, rollback: true };
      if (!guard || nowMs > guard) {
        gameState.timeGuard = nowMs;
        // Пишем редко (раз в час), а не при каждом открытии меню.
        if (!guard || nowMs - guard > 3600 * 1000) { try { saveGameState(); } catch (e) {} }
      }
      const now = new Date(nowMs);
      const today = now.toDateString();
      const lastTs = Number(gameState.lastDaily) || 0;
      const last = lastTs ? new Date(lastTs).toDateString() : null;
      if (last === today) return { avail: false };
      // Перемотка вперёд: календарный день сменился, а реальных 20 часов
      // с прошлого подарка не прошло — следующий только по таймеру.
      // Легальный режим (раз в сутки в одно время) не страдает: там зазоры сутки+.
      if (lastTs && nowMs - lastTs < 20 * 3600 * 1000) {
        return { avail: false, tooSoon: true, waitMs: 20 * 3600 * 1000 - (nowMs - lastTs) };
      }
      const sameMonth = gameState.dailyMonth === this.dailyMonthKey(now);
      const base = sameMonth ? (gameState.dailyStreak | 0) : 0;
      return { avail: true, streak: base + 1, reward: this.dailyRewardFor(base + 1), newMonth: !sameMonth };
    } catch (e) {
      return { avail: false };
    }
  }

export function _dailyLabel() {
    const d = this.dailyAvailable();
    return d.avail ? `ЕЖЕДНЕВКА +${d.reward}` : 'ЕЖЕДНЕВКА ✓';
  }

export function claimDaily() {
    const d = this.dailyAvailable();
    if (!d.avail || this._claimAnim) return;
    // Новый месяц — новый цикл стрика, а фрагменты НЕ сгорают:
    // копятся до капа 4 и тратятся обменом/финалом.
    if (d.newMonth) {
      gameState.dailyMonth = this.dailyMonthKey(Date.now());
    }
    gameState.dailyStreak = d.streak;
    gameState.lastDaily = Date.now();
    // Фрагмент главной награды — каждое воскресенье стрика (7/14/21/28).
    const dayOfStreak = ((d.streak - 1) % 30) + 1;
    if (dayOfStreak % 7 === 0) {
      gameState.dailyFrags = Math.min(4, (gameState.dailyFrags | 0) + 1);
    }
    let gained = d.reward;
    // Финал месяца: 30-й день при 4 фрагментах — крупная награда
    // (вариант-заглушка до обсуждения с автором, п.38).
    if (dayOfStreak === 30 && (gameState.dailyFrags | 0) >= 3) {
      addCoins(10000);
      gained = 10000;
      gameState.genePoints = (gameState.genePoints | 0) + 1;
      gameState.geneUnlocked = true;
      gameState.dailyFrags = Math.max(0, (gameState.dailyFrags | 0) - 3);
    } else {
      addCoins(d.reward);
    }
    saveGameState();
    // Вместо мгновенного рестарта — анимация: закрываем окно, монетки
    // летят в счётчик, сумма докручивается, потом обновляем меню.
    this._claimAnim = true;
    try {
      if (this._dailyModal) { this._dailyModal.close(); this._dailyModal = null; }
    } catch (e) {}
    let restarted = false;
    const doRestart = () => {
      if (restarted) return;
      restarted = true;
      this._claimAnim = false;
      try { if (this.scene.isActive()) this.scene.restart(); } catch (e) {}
    };
    this._flyCoinsToTop(510, 554, gained, doRestart);
    this.time.delayedCall(4000, doRestart);
  }

  // Анимация получения монет: значки летят в счётчик сверху, сумма
  // докручивается постепенно («трррр»). done — когда всё долетело.
export function _flyCoinsToTop(fromX, fromY, amount, done) {
    // Пока летит — живые обновления счётчика пропускаем (докрутит анимация).
    this._coinsFlying = true;
    const finish = () => {
      this._coinsFlying = false;
      try { done && done(); } catch (e) {}
    };
    try {
      let tx = 110, ty = 19;
      try {
        if (this._topCoinsIcon && this._topCoinsIcon.active) {
          tx = this._topCoinsIcon.x;
          ty = this._topCoinsIcon.y;
        }
      } catch (e) {}
      if (!this.textures.exists('icon_coins')) {
        this._countUpCoins(amount, finish);
        return;
      }
      const n = Math.max(3, Math.min(8, 3 + Math.round(Math.abs(amount) / 2000)));
      let landed = 0;
      for (let i = 0; i < n; i++) {
        const c = this.add.image(fromX, fromY, 'icon_coins').setDepth(400).setDisplaySize(24, 18);
        this.time.delayedCall(i * 70, () => {
          try {
            if (!c.active) return;
            const ang = Math.random() * Math.PI * 2;
            const kick = 30 + Math.random() * 50;
            this.tweens.add({
              targets: c, x: fromX + Math.cos(ang) * kick, y: fromY + Math.sin(ang) * kick - 20,
              duration: 180, ease: 'Quad.Out',
              onComplete: () => {
                this.tweens.add({
                  targets: c, x: tx, y: ty, duration: 450, ease: 'Quad.In',
                  onComplete: () => {
                    try { c.destroy(); } catch (e) {}
                    landed++;
                    if (landed >= n) this._countUpCoins(amount, finish);
                  }
                });
              }
            });
          } catch (e) {}
        });
      }
      // Страховка: твины не должны висеть вечно.
      this.time.delayedCall(3500, () => {
        if (landed < n) {
          landed = n;
          this._countUpCoins(amount, finish);
        }
      });
    } catch (e) {
      this._countUpCoins(amount, finish);
    }
  }

  // Докрутка суммы в счётчике + всплывашка +N и треск.
export function _countUpCoins(amount, done) {
    const finish = () => { try { done && done(); } catch (e) {} };
    try {
      const t = this._topCoinsT;
      let from = 0;
      try {
        from = parseInt(String(t ? t.text : gameState.coins).replace(/[^\d-]/g, ''), 10) || 0;
      } catch (e) {
        from = gameState.coins | 0;
      }
      const to = gameState.coins | 0;
      try {
        if (this.cache.audio.exists('sfx_buy') && !this.sound.locked) {
          this.sound.play('sfx_buy', { volume: 0.5 });
        }
      } catch (e) {}
      try {
        const px = t ? t.x + t.displayWidth + 12 : 200;
        const plus = this.add.text(px, 30, `+${amount}`, {
          fontSize: '16px', color: '#ffee88', fontStyle: 'bold'
        }).setOrigin(0, 0.5).setDepth(400);
        this.tweens.add({
          targets: plus, y: 6, alpha: 0, duration: 1000,
          onComplete: () => { try { plus.destroy(); } catch (e) {} }
        });
      } catch (e) {}
      if (!t || from === to) {
        try { if (t) t.setText(`${to}`); } catch (e) {}
        finish();
        return;
      }
      // Треск: короткие тики, пока крутится сумма.
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          for (let k = 0; k < 6; k++) {
            this.time.delayedCall(k * 150, () => {
              try {
                if (!this.sound.locked) this.sound.play('sfx_hover', { volume: 0.15 });
              } catch (e) {}
            });
          }
        }
      } catch (e) {}
      const counter = { v: from };
      this.tweens.add({
        targets: counter, v: to, duration: 950, ease: 'Cubic.Out',
        onUpdate: () => { try { t.setText(`${Math.round(counter.v)}`); } catch (e) {} },
        onComplete: () => {
          try { t.setText(`${to}`); } catch (e) {}
          finish();
        }
      });
    } catch (e) {
      finish();
    }
  }

  // Значок подарка (п.38): разноцветный квадрат без фонового PNG.
  // Не забрано — подсвечивается; клик — окно наград в 2 раза меньше меню.
export function createDailyGift(x, y, size) {
    const d = this.dailyAvailable();
    const S = size || 56;
    const bg = this.add.graphics();
    const cols = [0xff5555, 0xffaa00, 0x44ccff, 0xaa44ff];
    const ci = (new Date().getDate()) % cols.length;
    bg.fillStyle(cols[ci], 1);
    bg.fillRoundedRect(x - S / 2, y - S / 2, S, S, 10);
    bg.lineStyle(d.avail ? 3 : 2, d.avail ? 0xffff55 : 0xffffff, 1);
    bg.strokeRoundedRect(x - S / 2, y - S / 2, S, S, 10);
    // Авторский PNG подарка на тёмной плашке (чтоб не сливался);
    // нет файла — рисованный бантик.
    if (this.textures.exists('значок подарок дня')) {
      bg.fillStyle(0x0a0a1a, 0.75);
      bg.fillRoundedRect(x - S / 2 + 5, y - S / 2 + 5, S - 10, S - 10, 8);
      const img = this.add.image(x, y, 'значок подарок дня');
      img.setDisplaySize(S - 16, S - 16);
    } else {
      // Бантик: две петли + коробка геометрией (масштаб от размера).
      const k = S / 56;
      bg.fillStyle(0xffffff, 0.95);
      bg.fillRect(x - 16 * k, y - 2 * k, 32 * k, 20 * k);
      bg.fillStyle(0xffd24a, 1);
      bg.fillTriangle(x - 12 * k, y - 2 * k, x, y - 12 * k, x, y - 2 * k);
      bg.fillTriangle(x + 12 * k, y - 2 * k, x, y - 12 * k, x, y - 2 * k);
      bg.fillStyle(0xcc2222, 1);
      bg.fillRect(x - 16 * k, y + 5 * k, 32 * k, 5 * k);
    }
    const hit = this.add.rectangle(x, y, S, S, 0xffffff, 0.001);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this._openDailyModal());
    if (d.avail) {
      this.tweens.add({
        targets: bg, alpha: { from: 1, to: 0.65 },
        yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut'
      });
    }
  }

export function _openDailyModal() {
    if (this._dailyModal) return;
    // Часы крутили (назад — откат, вперёд — недобор 20 часов):
    // вместо окна предупреждение (мигает и гаснет).
    try {
      const chk = this.dailyAvailable();
      const why = chk.rollback ? 'Часы на ПК переведены назад.\nВерните правильное время — подарок разблокируется.'
        : chk.tooSoon ? `До следующего подарка осталось ${Math.max(1, Math.ceil((chk.waitMs || 0) / 3600000))} ч.\nПеремотка времени не ускоряет награды.`
        : null;
      if (why) {
        const t = this.add.text(gameW(this) / 2, 360, why, {
          fontSize: '18px', color: '#ff8888', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5).setDepth(250);
        this.tweens.add({
          targets: t, alpha: 0, duration: 600, delay: 2600,
          onComplete: () => { try { t.destroy(); } catch (e) {} }
        });
        return;
      }
    } catch (e) {}
    // Тост не должен висеть поверх модалки.
    if (this._achToast) {
      this._achToast.destroy();
      this._achToast = null;
    }
    const W = 640, H = 460;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);
    const d = this.dailyAvailable();
    const streak = d.avail ? d.streak : (gameState.dailyStreak | 0);
    const dayOfStreak = ((Math.max(1, streak) - 1) % 30) + 1;
    const frags = gameState.dailyFrags | 0;
    const title = this.add.text(cx, cy - H / 2 + 22, 'ПОДАРОК ДНЯ', {
      fontSize: '22px', color: '#ffdd88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202);
    const sub = this.add.text(cx, cy - H / 2 + 48,
      `Стрик: ${streak} дн. · Фрагменты: ${frags}/3 (по воскресеньям)`, {
      fontSize: '13px', color: '#99aacc'
    }).setOrigin(0.5).setDepth(202);
    elems.push(title, sub);
    // Сетка месяца 7×5: конец каждой недели — фрагмент, 30-й день — финал.
    const gx0 = cx - W / 2 + 36, gy0 = cy - H / 2 + 80;
    const cw = 80, ch = 52;
    for (let day = 1; day <= 30; day++) {
      const col = (day - 1) % 7, row = Math.floor((day - 1) / 7);
      const x = gx0 + col * (cw + 4), y = gy0 + row * (ch + 4);
      const isFrag = day % 7 === 0 && day < 30;
      const isFinal = day === 30;
      const claimed = day < dayOfStreak || (!d.avail && day <= dayOfStreak);
      const isToday = d.avail && day === dayOfStreak;
      const g = this.add.graphics().setDepth(202);
      g.fillStyle(isFinal ? 0x5a3a00 : isFrag ? 0x3a2a5a : claimed ? 0x224422 : isToday ? 0x4a3a12 : 0x1a1a3c, 1);
      g.fillRoundedRect(x, y, cw, ch, 6);
      g.lineStyle(isToday ? 3 : 1, isToday ? 0xffee55 : isFinal ? 0xffd24a : 0x4466aa, 1);
      g.strokeRoundedRect(x, y, cw, ch, 6);
      elems.push(g);
      const reward = isFinal ? 'ФИНАЛ' : isFrag ? 'ФРАГМЕНТ' : `+${this.dailyRewardFor(day)}`;
      const t = this.add.text(x + cw / 2, y + 12, `День ${day}`, {
        fontSize: '10px', color: claimed ? '#88aa88' : '#ffffff'
      }).setOrigin(0.5).setDepth(203);
      const t2 = this.add.text(x + cw / 2, y + 30, reward, {
        fontSize: '10px', color: isFinal || isFrag ? '#ffd24a' : '#ffee88', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(203);
      elems.push(t, t2);
    }
    const claimBtn = this.add.text(cx - 130, cy + H / 2 - 36,
      d.avail ? `ЗАБРАТЬ +${d.reward}` : 'УЖЕ ЗАБРАНО', {
      fontSize: '16px', color: d.avail ? '#ffffff' : '#667788',
      backgroundColor: d.avail ? '#2a5a2a' : '#22223a', padding: 8
    }).setOrigin(0.5).setDepth(202);
    const closeBtn = this.add.text(cx + 130, cy + H / 2 - 36, 'ЗАКРЫТЬ', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(claimBtn, closeBtn);
    if (d.avail) {
      claimBtn.setInteractive({ useHandCursor: true });
      claimBtn.on('pointerdown', () => {
        this.claimDaily();
      });
    }
    closeBtn.setInteractive({ useHandCursor: true });
    const close = () => elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    closeBtn.on('pointerdown', () => { close(); this._dailyModal = null; });
    overlay.setInteractive();
    overlay.on('pointerdown', () => { close(); this._dailyModal = null; });
    this._dailyModal = { elems, close };
  }

  // Витрина героя (меню v2.1): самый наигранный по боям класс в экипировке,
  // звание над ним. Тот же живой риг, что в инвентаре. Компактная (×1/1.5).
  // w — ширина панели (динамическая, чтобы не налезать на соседей).
  // badgeMaxW — макс. ширина бейджа рейтинга (влезает между панелями).
