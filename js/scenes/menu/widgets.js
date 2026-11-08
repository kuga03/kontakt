import { gameState } from '../../data/gameState.js';

import { classDefinitions } from '../../data/weapons.js';

import Assault from '../../entities/Assault.js';
import Tank from '../../entities/Tank.js';
import Medic from '../../entities/Medic.js';
import Sniper from '../../entities/Sniper.js';
import { gameW, UX } from '../../ui/layout.js';

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
const BTN_ICON_PNG = {};

export function _panel(cx, top, w, h, title) {
    const x0 = cx - w / 2;
    const g0 = this.add.graphics();
    // Глубокий темный фон панели
    g0.fillStyle(0x090c16, 0.94);
    g0.fillRoundedRect(x0, top, w, h, 12);

    if (this.textures.exists('фон для блоков меню')) {
      const img = this.add.image(cx, top + h / 2, 'фон для блоков меню');
      img.setDisplaySize(w, h);
      img.setAlpha(0.28);
    }

    // Тонкий внутренний золотой контур с уголками
    const g = this.add.graphics();
    g.lineStyle(1.5, 0x8a6a10, 0.85);
    g.strokeRoundedRect(x0, top, w, h, 12);

    // Угловые золотые тактические скобки
    const cLen = 14;
    g.lineStyle(2.5, 0xd8a920, 0.95);
    // Верх-лево
    g.lineBetween(x0, top + cLen, x0, top + 6);
    g.lineBetween(x0 + 6, top, x0 + cLen, top);
    // Верх-право
    g.lineBetween(x0 + w - cLen, top, x0 + w - 6, top);
    g.lineBetween(x0 + w, top + 6, x0 + w, top + cLen);
    // Низ-лево
    g.lineBetween(x0, top + h - cLen, x0, top + h - 6);
    g.lineBetween(x0 + 6, top + h, x0 + cLen, top + h);
    // Низ-право
    g.lineBetween(x0 + w - cLen, top + h, x0 + w - 6, top + h);
    g.lineBetween(x0 + w, top + h - 6, x0 + w, top + h - cLen);

    // Капсула заголовка панели
    const titlePill = this.add.graphics();
    const probe = this.add.text(0, 0, title, { fontSize: '13px', fontStyle: 'bold' });
    const pillW = Math.max(120, probe.displayWidth + 38);
    probe.destroy();

    titlePill.fillStyle(0x111628, 0.98);
    titlePill.fillRoundedRect(cx - pillW / 2, top + 7, pillW, 26, 6);
    titlePill.lineStyle(1.5, 0xd8a920, 0.9);
    titlePill.strokeRoundedRect(cx - pillW / 2, top + 7, pillW, 26, 6);

    this.add.text(cx, top + 20, `◆ ${title} ◆`, {
      fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);

    return top + h;
  }

  // Ежедневка: месячный цикл. Стрик живёт внутри календарного месяца,
  // пропуски любой длины — пауза без сброса; новый месяц — цикл с нуля
  // (стрик и фрагменты прошлого месяца сгорают). Откат часов назад больше
  // чем на час от максимума — подарок блокируется (защита от скручивания).
  // Шкала: неделя 1 — 700..1200 (+фрагмент в 7-й день), неделя 2 — 1300..1800,
  // дальше +600 к базе каждую неделю (+100 в день внутри недели).
export function _toastAchReady(n) {
    const t = this.add.text(UX(this, 1070), 62, `🏆 Награды ждут (${n})`, {
      fontSize: '15px', color: '#ffd24a', fontStyle: 'bold',
      backgroundColor: '#111133cc', padding: 6
    }).setOrigin(0.5).setDepth(150).setAlpha(0);
    this._achToast = t;
    this.tweens.add({
      targets: t, alpha: 1, duration: 400, delay: 300,
      onComplete: () => {
        this.tweens.add({
          targets: t, alpha: 0, duration: 600, delay: 2600,
          onComplete: () => {
            if (this._achToast === t) this._achToast = null;
            t.destroy();
          }
        });
      }
    });
  }

  // Окно статистики из витрины: две таблицы — одиночная и онлайн.
  // Процент побед считается только по матчам на Бывалом и выше.
export function _openStatsModal() {
    if (this._statsModal) return;
    const cx = gameW(this) / 2, cy = 360, W = 560, H = 480;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeStatsModal());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);
    elems.push(this.add.text(cx, cy - H / 2 + 24, 'СТАТИСТИКА', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));

    const st = gameState.stats || {};
    const kills = st.kills | 0;
    const deaths = st.deaths | 0;
    // K/D — частное фрагов на смерти. Без смертей: фраги есть — ∞, нет — прочерк.
    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : (kills > 0 ? '∞' : '—');
    const tbc = st.timeByClass || {};
    let secs = 0;
    try {
      Object.values(tbc).forEach(v => { secs += v | 0; });
    } catch (e) {}
    const mins = Math.floor(secs / 60);
    const ew = gameState.expWins | 0, el = gameState.expLosses | 0;
    const pct = (ew + el) > 0
      ? `${Math.round(ew / (ew + el) * 100)}% (${ew} из ${ew + el})`
      : '—';

    const col = (x, title, rows) => {
      elems.push(this.add.text(x, cy - H / 2 + 62, title, {
        fontSize: '15px', color: '#8fb8ff', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(202));
      rows.forEach((r, i) => {
        elems.push(this.add.text(x, cy - H / 2 + 96 + i * 32, r, {
          fontSize: '14px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(202));
      });
    };
    col(cx - 140, 'ОДИНОЧНАЯ ИГРА', [
      `Фраги: ${kills}`,
      `K/D: ${kd}`,
      `Время в бою: ${mins} мин`,
      `Побед: ${pct}`
    ]);
    col(cx + 140, 'ОНЛАЙН ИГРА', [
      'Фраги: 0',
      'K/D: —',
      'Время в бою: 0 мин',
      'Побед: —'
    ]);
    // Бои и процент побед по классам (считаются в _recordMatch).
    elems.push(this.add.text(cx, cy - H / 2 + 228, 'БОИ ПО КЛАССАМ', {
      fontSize: '15px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));
    try {
      const mbc = (gameState.stats && gameState.stats.matchesByClass) || {};
      const wbc = (gameState.stats && gameState.stats.winsByClass) || {};
      classDefinitions.forEach((cd, i) => {
        const m = (mbc[cd.id] | 0);
        const w = (wbc[cd.id] | 0);
        const pct = m > 0 ? Math.round(w / m * 100) + '%' : '—';
        const col = '#' + (cd.color | 0).toString(16).padStart(6, '0');
        elems.push(this.add.text(cx - 170, cy - H / 2 + 254 + i * 24, cd.label, {
          fontSize: '14px', color: col, fontStyle: 'bold'
        }).setOrigin(0, 0.5).setDepth(202));
        elems.push(this.add.text(cx + 170, cy - H / 2 + 254 + i * 24,
          m > 0 ? `боёв: ${m} · побед: ${pct}` : 'не играл', {
          fontSize: '13px', color: m > 0 ? '#ffffff' : '#667788'
        }).setOrigin(1, 0.5).setDepth(202));
      });
    } catch (e) { /* статистика не роняет меню */ }
    elems.push(this.add.text(cx, cy + H / 2 - 66,
      'Процент побед — только сложность «Бывалый» и выше', {
        fontSize: '12px', color: '#667788'
      }).setOrigin(0.5).setDepth(202));
    const closeBtn = this.add.text(cx, cy + H / 2 - 32, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(closeBtn);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeStatsModal());
    this._statsModal = { elems, escHandler: null };
    this._statsModal.escHandler = () => this._closeStatsModal();
    this.input.keyboard.on('keydown-ESC', this._statsModal.escHandler);
  }

export function _closeStatsModal() {
    const m = this._statsModal;
    if (!m) return;
    if (m.escHandler) {
      try { this.input.keyboard.off('keydown-ESC', m.escHandler); } catch (e) {}
    }
    m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    this._statsModal = null;
  }

  // Центральная колонка «В БОЙ»: две раскрывающиеся секции.
  // Одиночная — рабочие режимы; Онлайн — только отрисовка (мок, без логики).
  // Перестройка без рестарта сцены. Возвращает низ панели.
export function _drawBtnIcon(g, id, x, y, s, color) {
    g.clear();
    const u = s / 11;
    const locked = color === 0x667788;
    const hover = color === 0xffff55 || color === 0xffe066 || color === 0xffdd44;
    // Палитра: в обычном/hover состоянии — цветные иконки; в locked — приглушённые серые.
    // Тёмный контур добавляется почти везде для читаемости на синей подложке кнопки.
    const pal = (base, light, dark, accent) => {
      if (locked) {
        const m = 0x6b7788;
        return { a: m, b: 0x8894a3, c: 0x4f5a68, hi: 0xaab4c2, acc: 0x7b8796, glow: 0x9aa6b5 };
      }
      if (hover) {
        // На наведении сохраняем характер цвета, но делаем теплее/ярче.
        return { a: light, b: base, c: dark, hi: 0xffffff, acc: accent || 0xffe066, glow: 0xfff2a8 };
      }
      return { a: base, b: light, c: dark, hi: 0xffffff, acc: accent || 0xfff0a0, glow: light };
    };
    const outline = (w = 1.4, a = 0.95) => g.lineStyle(w, locked ? 0x3a4352 : 0x0b1020, a);

    switch (id) {
      case 'cart': { // тележка магазина (супермаркет) — стальная с золотыми акцентами
        const p = pal(0xf0b52a, 0xffd966, 0xb87410, 0xff8a3d);
        // Рукоять (горизонтальная перекладина сверху-справа)
        g.lineStyle(2.4, locked ? 0x8894a3 : p.b, 1);
        g.lineBetween(x - 2 * u, y - 8.2 * u, x + 9.2 * u, y - 8.2 * u);
        // Наклонная стойка от рукояти вниз к корзине
        g.lineStyle(2.2, locked ? 0x8894a3 : p.a, 1);
        g.lineBetween(x - 2 * u, y - 8.2 * u, x - 7.2 * u, y - 1.2 * u);
        // Горизонтальное дно корзины (основа)
        g.lineStyle(2.4, locked ? 0x6b7788 : p.a, 1);
        g.lineBetween(x - 7.4 * u, y - 1.2 * u, x + 7 * u, y - 1.2 * u);
        // Задняя стенка корзины (вертикальная, левая)
        g.lineStyle(2.2, locked ? 0x6b7788 : p.a, 1);
        g.lineBetween(x - 7.4 * u, y - 1.2 * u, x - 6.4 * u, y - 7.4 * u);
        // Передняя стенка корзины (вертикальная, правая — короче)
        g.lineStyle(2.2, locked ? 0x6b7788 : p.a, 1);
        g.lineBetween(x + 7 * u, y - 1.2 * u, x + 6.2 * u, y - 5.8 * u);
        // Верхний край корзины
        g.lineStyle(2.2, locked ? 0x6b7788 : p.b, 1);
        g.lineBetween(x - 6.4 * u, y - 7.4 * u, x + 6.2 * u, y - 5.8 * u);
        // Две вертикальные прутья внутри корзины
        g.lineStyle(1.2, locked ? 0x4f5a68 : p.c, 0.85);
        g.lineBetween(x - 1.8 * u, y - 1.2 * u, x - 1.3 * u, y - 7 * u);
        g.lineBetween(x + 2.6 * u, y - 1.2 * u, x + 2.8 * u, y - 6.5 * u);
        // Золотой акцент-маркер на рукояти
        if (!locked) {
          g.fillStyle(p.acc, 0.85);
          g.fillCircle(x + 9.2 * u, y - 8.2 * u, 1.4 * u);
        }
        // Колёса
        g.fillStyle(locked ? 0x46515f : 0x1b2436, 1);
        g.fillCircle(x - 4.2 * u, y + 3.2 * u, 2.6 * u);
        g.fillCircle(x + 4.6 * u, y + 3.2 * u, 2.6 * u);
        g.fillStyle(locked ? 0x8894a3 : p.acc, 1);
        g.fillCircle(x - 4.2 * u, y + 3.2 * u, 1.1 * u);
        g.fillCircle(x + 4.6 * u, y + 3.2 * u, 1.1 * u);
        outline(1.1, 0.8);
        g.strokeCircle(x - 4.2 * u, y + 3.2 * u, 2.6 * u);
        g.strokeCircle(x + 4.6 * u, y + 3.2 * u, 2.6 * u);
        break;
      }
      case 'backpack': { // рюкзак в профиль: лямки слева, корпус справа
        const p = pal(0x43b86b, 0x74dc95, 0x237542, 0xff9a3c);
        const bx = x + 1.5 * u; // сдвиг центра чуть вправо, чтобы лямки влезли

        // Корпус рюкзака (правая часть)
        g.fillStyle(p.c, 1);
        g.fillRoundedRect(bx - 3.8 * u, y - 8.6 * u, 11.2 * u, 17.2 * u, 2.8 * u);
        g.fillStyle(p.a, 1);
        g.fillRoundedRect(bx - 3 * u, y - 7.8 * u, 9.8 * u, 15.6 * u, 2.4 * u);
        // Блик сверху-справа
        g.fillStyle(p.hi, locked ? 0.08 : 0.22);
        g.fillRoundedRect(bx + 1.4 * u, y - 7.2 * u, 3.6 * u, 6.8 * u, 1.6 * u);
        outline(1.5); g.strokeRoundedRect(bx - 3.6 * u, y - 8.4 * u, 10.8 * u, 16.8 * u, 2.6 * u);

        // Передний карман (снизу корпуса)
        g.fillStyle(p.b, 0.9);
        g.fillRoundedRect(bx - 2.4 * u, y + 3.4 * u, 8 * u, 4.2 * u, 1.6 * u);
        outline(1, 0.8); g.strokeRoundedRect(bx - 2.2 * u, y + 3.6 * u, 7.6 * u, 3.8 * u, 1.4 * u);
        // Пряжка кармана
        g.fillStyle(p.acc, 1);
        g.fillRoundedRect(bx + 0.6 * u, y + 4.4 * u, 2.6 * u, 1.8 * u, 0.5 * u);
        g.fillStyle(locked ? 0x5d6978 : 0x6b3208, 1);
        g.fillCircle(bx + 1.9 * u, y + 5.3 * u, 0.5 * u);

        // Две лямки слева (вертикальные полосы)
        const sx = bx - 3.8 * u; // правый край лямок = левый край корпуса
        g.fillStyle(locked ? 0x7b8796 : p.acc, 1);
        // Верхняя лямка
        g.fillRoundedRect(sx - 4.2 * u, y - 7.4 * u, 2.2 * u, 9.4 * u, 1 * u);
        outline(1, 0.75); g.strokeRoundedRect(sx - 4.2 * u, y - 7.4 * u, 2.2 * u, 9.4 * u, 1 * u);
        // Нижняя лямка (чуть уже)
        g.fillStyle(locked ? 0x7b8796 : p.acc, 1);
        g.fillRoundedRect(sx - 3.8 * u, y + 2.2 * u, 2 * u, 5.8 * u, 1 * u);
        outline(1, 0.75); g.strokeRoundedRect(sx - 3.8 * u, y + 2.2 * u, 2 * u, 5.8 * u, 1 * u);
        // Пряжки лямок (маленькие прямоугольники)
        g.fillStyle(locked ? 0x8894a3 : 0xffd080, 1);
        g.fillRoundedRect(sx - 4.4 * u, y + 1 * u, 2.6 * u, 1.4 * u, 0.5 * u);
        g.fillRoundedRect(sx - 4.2 * u, y + 7.6 * u, 2.4 * u, 1.4 * u, 0.5 * u);
        break;
      }
      case 'star': { // звезда навыков — яркое золото с сиянием
        const p = pal(0xffc933, 0xffe37a, 0xd88e00, 0xff6a2a);
        // Мягкое свечение позади
        if (!locked) {
          g.fillStyle(p.glow, hover ? 0.22 : 0.14);
          g.fillCircle(x, y, 10.5 * u);
        }
        const outer = [];
        const inner = [];
        for (let i = 0; i < 5; i++) {
          const a1 = -Math.PI / 2 + i * Math.PI * 2 / 5;
          const a2 = a1 + Math.PI / 5;
          outer.push(new Phaser.Geom.Point(x + Math.cos(a1) * 10.2 * u, y + Math.sin(a1) * 10.2 * u));
          inner.push(new Phaser.Geom.Point(x + Math.cos(a2) * 4.4 * u, y + Math.sin(a2) * 4.4 * u));
        }
        const pts = [];
        for (let i = 0; i < 5; i++) { pts.push(outer[i], inner[i]); }
        g.fillStyle(p.c, 1); g.fillPoints(pts, true);
        g.fillStyle(p.a, 1);
        const pts2 = pts.map(pt => new Phaser.Geom.Point(x + (pt.x - x) * 0.9, y + (pt.y - y) * 0.9));
        g.fillPoints(pts2, true);
        // Грань-блик
        g.fillStyle(p.hi, locked ? 0.12 : 0.3);
        g.fillTriangle(x, y - 8.8 * u, x - 3.6 * u, y - 2.4 * u, x + 0.4 * u, y - 2.8 * u);
        outline(1.4); g.fillStyle(0, 0); g.fillPoints(pts, true);
        g.lineStyle(1.4, locked ? 0x3a4352 : 0x0b1020, 0.95); g.strokePoints(pts, true);
        // Ядро
        g.fillStyle(p.acc, 1);
        g.fillCircle(x, y + 0.4 * u, 2.4 * u);
        g.fillStyle(p.hi, locked ? 0.2 : 0.7);
        g.fillCircle(x - 0.5 * u, y - 0.1 * u, 0.9 * u);
        break;
      }
      case 'dna': { // ДНК — бирюзовый и фиолетовый, контрастно на синем фоне
        const p = pal(0x2fd4c2, 0x7cf3e6, 0x149184, 0xc06cff);
        if (!locked) { g.fillStyle(0x29d4c4, 0.08); g.fillCircle(x, y, 10 * u); }
        // Две цепи
        const left = []; const right = [];
        for (let i = 0; i <= 12; i++) {
          const ty = -9 * u + i * 1.5 * u;
          const ph = (i / 12) * Math.PI * 2;
          const dx = Math.sin(ph) * 5.8 * u;
          left.push({ px: x - dx, py: y + ty }); right.push({ px: x + dx, py: y + ty });
        }
        g.lineStyle(2.6, p.c, 1); g.beginPath(); g.moveTo(left[0].px, left[0].py);
        left.forEach(pt => g.lineTo(pt.px, pt.py)); g.strokePath();
        g.lineStyle(2.6, locked ? 0x7b8796 : 0xa24ce6, 1); g.beginPath(); g.moveTo(right[0].px, right[0].py);
        right.forEach(pt => g.lineTo(pt.px, pt.py)); g.strokePath();
        g.lineStyle(1.8, p.a, 1); g.beginPath(); g.moveTo(left[0].px, left[0].py);
        left.forEach(pt => g.lineTo(pt.px, pt.py)); g.strokePath();
        g.lineStyle(1.8, locked ? 0x98a5b4 : 0xd08cff, 1); g.beginPath(); g.moveTo(right[0].px, right[0].py);
        right.forEach(pt => g.lineTo(pt.px, pt.py)); g.strokePath();
        // Перемычки
        for (let i = 1; i < 12; i += 2) {
          g.lineStyle(1.5, p.hi, locked ? 0.35 : 0.55);
          g.lineBetween(left[i].px, left[i].py, right[i].px, right[i].py);
          g.fillStyle(i % 4 === 1 ? p.b : (locked ? 0xaab4c2 : 0xe0b0ff), 1);
          g.fillCircle((left[i].px + right[i].px) / 2, left[i].py, 1.15 * u);
        }
        break;
      }
      case 'case': { // кейс — стальной с янтарными акцентами
        const p = pal(0x8fb3d9, 0xc7ddf5, 0x4a6488, 0xffb020);
        // Тень/основание
        g.fillStyle(0x000000, locked ? 0.15 : 0.22);
        g.fillRoundedRect(x - 7.6 * u, y - 3.8 * u, 15.2 * u, 12.2 * u, 2.2 * u);
        // Корпус
        g.fillStyle(p.c, 1);
        g.fillRoundedRect(x - 8.2 * u, y - 5.4 * u, 16.4 * u, 11.8 * u, 2.2 * u);
        g.fillStyle(p.a, 1);
        g.fillRoundedRect(x - 7.6 * u, y - 4.8 * u, 15.2 * u, 10.4 * u, 1.8 * u);
        g.fillStyle(p.hi, locked ? 0.1 : 0.22);
        g.fillRoundedRect(x - 6.8 * u, y - 4.3 * u, 13.6 * u, 2.8 * u, 1 * u);
        outline(1.6); g.strokeRoundedRect(x - 8 * u, y - 5.2 * u, 16 * u, 11.4 * u, 2 * u);
        // Разделение крышки
        g.lineStyle(1.8, p.c, 1);
        g.lineBetween(x - 7.4 * u, y - 0.8 * u, x + 7.4 * u, y - 0.8 * u);
        g.lineStyle(1, p.hi, locked ? 0.15 : 0.35);
        g.lineBetween(x - 7 * u, y - 1.3 * u, x + 7 * u, y - 1.3 * u);
        // Усилители по углам
        const corner = (cx2, cy2, sx, sy) => {
          g.fillStyle(p.b, 0.9);
          g.fillTriangle(cx2, cy2, cx2 + 3.2 * u * sx, cy2, cx2, cy2 + 3.2 * u * sy);
        };
        corner(x - 8 * u, y - 5.2 * u, 1, 1); corner(x + 8 * u, y - 5.2 * u, -1, 1);
        corner(x - 8 * u, y + 6.2 * u, 1, -1); corner(x + 8 * u, y + 6.2 * u, -1, -1);
        // Замок
        g.fillStyle(p.acc, 1);
        g.fillRoundedRect(x - 2.2 * u, y + 1.2 * u, 4.4 * u, 3.4 * u, 1 * u);
        outline(1, 0.7); g.strokeRoundedRect(x - 2.2 * u, y + 1.2 * u, 4.4 * u, 3.4 * u, 1 * u);
        g.fillStyle(locked ? 0x5d6978 : 0x5a3608, 1);
        g.fillCircle(x, y + 3.3 * u, 0.8 * u);
        g.lineStyle(1.2, locked ? 0x5d6978 : 0x5a3608, 1);
        g.strokeCircle(x, y + 2.1 * u, 1 * u);
        break;
      }
      case 'swords': // скрещённые мечи — сталь + красные рукояти
      case 'single': {
        const p = pal(0xcfe4ff, 0xf3f8ff, 0x6f8db6, 0xff5a4a);
        if (!locked) { g.fillStyle(0xff7048, hover ? 0.16 : 0.09); g.fillCircle(x, y, 9.8 * u); }
        const blade = (ax, ay, bx, by, dir) => {
          const ang = Math.atan2(by - ay, bx - ax);
          const nx = Math.cos(ang + Math.PI / 2) * 1.15 * u * dir;
          const ny = Math.sin(ang + Math.PI / 2) * 1.15 * u * dir;
          g.fillStyle(p.c, 1);
          g.beginPath(); g.moveTo(ax + nx, ay + ny); g.lineTo(bx, by); g.lineTo(ax - nx, ay - ny); g.closePath(); g.fillPath();
          g.fillStyle(p.b, 1);
          g.beginPath(); g.moveTo(ax + nx * 0.45, ay + ny * 0.45); g.lineTo(bx - Math.cos(ang) * 1.2 * u, by - Math.sin(ang) * 1.2 * u); g.lineTo(ax, ay); g.closePath(); g.fillPath();
          g.lineStyle(1.2, locked ? 0x3a4352 : 0x0b1020, 0.9);
          g.beginPath(); g.moveTo(ax + nx, ay + ny); g.lineTo(bx, by); g.lineTo(ax - nx, ay - ny); g.closePath(); g.strokePath();
        };
        blade(x - 7.2 * u, y - 7.2 * u, x + 7.8 * u, y + 7.8 * u, 1);
        blade(x + 7.2 * u, y - 7.2 * u, x - 7.8 * u, y + 7.8 * u, -1);
        // Гарды
        g.lineStyle(2.4, p.acc, 1);
        g.lineBetween(x - 7.4 * u, y - 2.8 * u, x - 2.8 * u, y - 7.4 * u);
        g.lineBetween(x + 7.4 * u, y - 2.8 * u, x + 2.8 * u, y - 7.4 * u);
        // Рукояти
        g.lineStyle(2.6, locked ? 0x7b8796 : 0x8b3a2e, 1);
        g.lineBetween(x - 8.2 * u, y - 8.2 * u, x - 5.8 * u, y - 5.8 * u);
        g.lineBetween(x + 8.2 * u, y - 8.2 * u, x + 5.8 * u, y - 5.8 * u);
        // Центральный блик-искра
        g.fillStyle(p.hi, locked ? 0.3 : 0.95);
        g.fillCircle(x, y, 2.1 * u);
        g.fillStyle(p.acc, locked ? 0.5 : 0.9);
        g.fillCircle(x, y, 1.1 * u);
        outline(1, 0.6); g.strokeCircle(x, y, 2.1 * u);
        break;
      }
      case 'globe': { // онлайн — бирюзовая планета с сеткой
        const p = pal(0x2ec8ff, 0x8fe7ff, 0x1477b8, 0x46ffb0);
        if (!locked) { g.fillStyle(0x22b8ff, hover ? 0.18 : 0.1); g.fillCircle(x, y, 10.2 * u); }
        g.fillStyle(p.c, 1); g.fillCircle(x, y, 8.8 * u);
        g.fillStyle(p.a, 1); g.fillCircle(x - 1.2 * u, y - 1.2 * u, 8.1 * u);
        g.fillStyle(p.hi, locked ? 0.12 : 0.22);
        g.fillCircle(x - 3.2 * u, y - 3.6 * u, 3.4 * u);
        outline(1.6); g.strokeCircle(x, y, 8.8 * u);
        // Параллели/меридианы
        g.lineStyle(1.2, p.b, locked ? 0.45 : 0.75);
        g.strokeEllipse(x, y, 6.2 * u, 17.6 * u);
        g.strokeEllipse(x, y, 13.4 * u, 17.6 * u);
        g.lineBetween(x - 8.6 * u, y, x + 8.6 * u, y);
        g.beginPath(); g.arc(x, y - 2.8 * u, 8.2 * u, 0.15 * Math.PI, 0.85 * Math.PI, false); g.strokePath();
        g.beginPath(); g.arc(x, y + 2.8 * u, 8.2 * u, 1.15 * Math.PI, 1.85 * Math.PI, false); g.strokePath();
        // "Онлайн" точка
        g.fillStyle(p.acc, 1); g.fillCircle(x + 5.8 * u, y - 5.8 * u, 1.8 * u);
        g.fillStyle(p.hi, locked ? 0.4 : 0.9); g.fillCircle(x + 5.4 * u, y - 6.2 * u, 0.6 * u);
        break;
      }
      case 'flag': { // кампания — красный флаг на древке
        const p = pal(0xff4d4d, 0xff8080, 0xb81818, 0xffd24a);
        // Древко
        g.lineStyle(2.8, locked ? 0x8a97a8 : 0xc8d6ea, 1);
        g.lineBetween(x - 5.2 * u, y - 9.4 * u, x - 5.2 * u, y + 9.6 * u);
        g.lineStyle(1.4, locked ? 0x4f5a68 : 0x5b6b84, 1);
        g.lineBetween(x - 4.4 * u, y - 9.4 * u, x - 4.4 * u, y + 9.6 * u);
        // Наконечник
        g.fillStyle(p.acc, 1);
        g.fillCircle(x - 5.2 * u, y - 9.8 * u, 1.5 * u);
        // Полотнище (двойной слой + складка)
        const fx = x - 5 * u, fy = y - 8.6 * u;
        g.fillStyle(p.c, 1);
        g.fillTriangle(fx, fy, fx + 13.8 * u, fy + 4.2 * u, fx, fy + 8.8 * u);
        g.fillStyle(p.a, 1);
        g.fillTriangle(fx + 0.8 * u, fy + 0.9 * u, fx + 11.8 * u, fy + 4.2 * u, fx + 0.8 * u, fy + 7.7 * u);
        g.fillStyle(p.b, locked ? 0.18 : 0.35);
        g.fillTriangle(fx + 0.8 * u, fy + 0.9 * u, fx + 6.4 * u, fy + 4.1 * u, fx + 0.8 * u, fy + 4.2 * u);
        outline(1.3, 0.9);
        g.lineStyle(1.3, locked ? 0x3a4352 : 0x0b1020, 0.9);
        g.strokeTriangle(fx, fy, fx + 13.8 * u, fy + 4.2 * u, fx, fy + 8.8 * u);
        // Эмблема
        g.fillStyle(p.hi, locked ? 0.45 : 0.9);
        g.fillCircle(fx + 5.2 * u, fy + 4.3 * u, 1.2 * u);
        break;
      }
      case 'skull': { // испытание — череп с красным акцентом опасности
        const p = pal(0xf2ede2, 0xffffff, 0xbfb29b, 0xff4b4b);
        if (!locked) { g.fillStyle(0xff5555, hover ? 0.14 : 0.08); g.fillCircle(x, y, 10.2 * u); }
        // Череп
        g.fillStyle(p.c, 1); g.fillCircle(x, y - 1.8 * u, 7 * u);
        g.fillStyle(p.a, 1); g.fillCircle(x - 0.8 * u, y - 2.4 * u, 6.4 * u);
        g.fillStyle(p.hi, locked ? 0.1 : 0.2); g.fillCircle(x - 2.6 * u, y - 4.8 * u, 2.2 * u);
        outline(1.5); g.strokeCircle(x, y - 1.8 * u, 7 * u);
        // Скулы
        g.fillStyle(p.b, 1);
        g.fillRoundedRect(x - 5.2 * u, y + 1.4 * u, 10.4 * u, 3.8 * u, 1.2 * u);
        outline(1.2, 0.8); g.strokeRoundedRect(x - 5.2 * u, y + 1.4 * u, 10.4 * u, 3.8 * u, 1.2 * u);
        // Глаза (опасный свет)
        g.fillStyle(locked ? 0x4f5a68 : 0x220606, 1);
        g.fillEllipse(x - 2.6 * u, y - 2.4 * u, 3.4 * u, 3.8 * u);
        g.fillEllipse(x + 2.6 * u, y - 2.4 * u, 3.4 * u, 3.8 * u);
        g.fillStyle(p.acc, locked ? 0.45 : 1);
        g.fillCircle(x - 2.6 * u, y - 2.4 * u, 1.05 * u);
        g.fillCircle(x + 2.6 * u, y - 2.4 * u, 1.05 * u);
        // Нос
        g.fillStyle(locked ? 0x4f5a68 : 0x2b1b10, 1);
        g.fillTriangle(x, y - 0.4 * u, x - 1.2 * u, y + 1.6 * u, x + 1.2 * u, y + 1.6 * u);
        // Челюсть/зубы
        g.fillStyle(locked ? 0xaab4c2 : 0xe7dfd1, 1);
        g.fillRoundedRect(x - 4.4 * u, y + 4.8 * u, 8.8 * u, 3.8 * u, 1.2 * u);
        outline(1.2, 0.8); g.strokeRoundedRect(x - 4.4 * u, y + 4.8 * u, 8.8 * u, 3.8 * u, 1.2 * u);
        g.lineStyle(1.1, locked ? 0x5d6978 : 0x7a6a56, 0.9);
        for (let i = -2; i <= 2; i++) g.lineBetween(x + i * 1.55 * u, y + 5 * u, x + i * 1.55 * u, y + 8.2 * u);
        // Трещина
        g.lineStyle(1.2, p.acc, locked ? 0.35 : 0.75);
        g.lineBetween(x + 4.6 * u, y - 5.6 * u, x + 2.8 * u, y - 2.2 * u);
        g.lineBetween(x + 2.8 * u, y - 2.2 * u, x + 3.8 * u, y - 0.2 * u);
        break;
      }
      case 'medal': { // рейтинг — золотая медаль с лентой
        const p = pal(0xffc933, 0xffe680, 0xd08b00, 0xff5a5a);
        // Лента
        g.fillStyle(p.acc, 1);
        g.fillTriangle(x - 5.8 * u, y - 9.6 * u, x - 0.4 * u, y - 1.4 * u, x - 3.2 * u, y - 9.6 * u);
        g.fillStyle(locked ? 0x7b8796 : 0x3aa0ff, 1);
        g.fillTriangle(x + 5.8 * u, y - 9.6 * u, x + 0.4 * u, y - 1.4 * u, x + 3.2 * u, y - 9.6 * u);
        outline(1, 0.6);
        g.strokeTriangle(x - 5.8 * u, y - 9.6 * u, x - 0.4 * u, y - 1.4 * u, x - 3.2 * u, y - 9.6 * u);
        g.strokeTriangle(x + 5.8 * u, y - 9.6 * u, x + 0.4 * u, y - 1.4 * u, x + 3.2 * u, y - 9.6 * u);
        // Медаль
        if (!locked) { g.fillStyle(p.glow, hover ? 0.2 : 0.12); g.fillCircle(x, y + 2.8 * u, 8.4 * u); }
        g.fillStyle(p.c, 1); g.fillCircle(x, y + 2.8 * u, 6.6 * u);
        g.fillStyle(p.a, 1); g.fillCircle(x, y + 2.8 * u, 5.7 * u);
        g.fillStyle(p.hi, locked ? 0.12 : 0.28);
        g.fillCircle(x - 1.8 * u, y + 0.9 * u, 2.2 * u);
        outline(1.5); g.strokeCircle(x, y + 2.8 * u, 6.6 * u);
        g.lineStyle(1.2, p.b, locked ? 0.4 : 0.9); g.strokeCircle(x, y + 2.8 * u, 4.4 * u);
        // Звезда в центре
        const mpts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = (i % 2 === 0 ? 2.7 : 1.2) * u;
          mpts.push(new Phaser.Geom.Point(x + Math.cos(a) * r, y + 2.9 * u + Math.sin(a) * r));
        }
        g.fillStyle(p.b, 1); g.fillPoints(mpts, true);
        break;
      }
      case 'bolt': { // быстрый бой — электрическая молния
        const p = pal(0xffe14a, 0xfff48a, 0xe6a800, 0x53d8ff);
        if (!locked) { g.fillStyle(p.glow, hover ? 0.22 : 0.12); g.fillCircle(x, y, 10.2 * u); }
        const bolt = [
          new Phaser.Geom.Point(x + 2.6 * u, y - 9.8 * u),
          new Phaser.Geom.Point(x - 4.8 * u, y + 0.6 * u),
          new Phaser.Geom.Point(x - 0.4 * u, y + 0.6 * u),
          new Phaser.Geom.Point(x - 2.8 * u, y + 9.8 * u),
          new Phaser.Geom.Point(x + 4.8 * u, y - 1.2 * u),
          new Phaser.Geom.Point(x + 0.4 * u, y - 1.2 * u)
        ];
        g.fillStyle(p.c, 1); g.fillPoints(bolt, true);
        const boltIn = bolt.map(pt => new Phaser.Geom.Point(x + (pt.x - x) * 0.86, y + (pt.y - y) * 0.86));
        g.fillStyle(p.a, 1); g.fillPoints(boltIn, true);
        g.fillStyle(p.hi, locked ? 0.18 : 0.35);
        g.fillTriangle(x + 1.2 * u, y - 7.4 * u, x - 2.2 * u, y - 0.4 * u, x - 0.2 * u, y - 0.8 * u);
        g.lineStyle(1.4, locked ? 0x3a4352 : 0x0b1020, 0.95); g.strokePoints(bolt, true);
        // искры
        g.fillStyle(p.acc, locked ? 0.35 : 0.9);
        g.fillCircle(x - 6.2 * u, y - 3.6 * u, 1 * u);
        g.fillCircle(x + 6.4 * u, y + 3.4 * u, 0.9 * u);
        break;
      }
      case 'list': { // список матчей — цветные строки
        const p = pal(0x63b3ff, 0xa8d7ff, 0x2f6fcb, 0x49e2a0);
        g.fillStyle(locked ? 0x46515f : 0x15243a, 0.95);
        g.fillRoundedRect(x - 8.8 * u, y - 8.2 * u, 17.6 * u, 16.4 * u, 2.4 * u);
        outline(1.4); g.strokeRoundedRect(x - 8.8 * u, y - 8.2 * u, 17.6 * u, 16.4 * u, 2.4 * u);
        const rows = [
          { yy: y - 4.2 * u, w: 10.8, c: p.acc },
          { yy: y + 0.2 * u, w: 13.2, c: p.a },
          { yy: y + 4.6 * u, w: 8.2, c: locked ? 0x98a5b4 : 0xffc04d }
        ];
        rows.forEach(r => {
          g.fillStyle(r.c, 1); g.fillCircle(x - 5.8 * u, r.yy, 1.15 * u);
          g.fillStyle(r.c, locked ? 0.45 : 0.22); g.fillRoundedRect(x - 3.6 * u, r.yy - 1.2 * u, r.w * u, 2.4 * u, 1 * u);
          g.lineStyle(1.4, r.c, 1); g.lineBetween(x - 3.2 * u, r.yy, x - 3.2 * u + (r.w - 0.8) * u, r.yy);
        });
        break;
      }
      case 'layers': { // мои уровни — стопка слоёв
        const cols = locked ? [0x8894a3, 0x6b7788, 0x556170] : [0xff8f4d, 0x44d2ff, 0x8d7bff];
        if (!locked) { g.fillStyle(0x6ad8ff, 0.08); g.fillCircle(x, y, 10 * u); }
        const layer = (yy, col, hi) => {
          g.fillStyle(col, 1);
          g.beginPath();
          g.moveTo(x - 8.4 * u, yy);
          g.lineTo(x, yy - 4.8 * u);
          g.lineTo(x + 8.4 * u, yy);
          g.lineTo(x, yy + 4.8 * u);
          g.closePath(); g.fillPath();
          g.fillStyle(hi, locked ? 0.12 : 0.28);
          g.beginPath();
          g.moveTo(x - 6.2 * u, yy - 0.2 * u);
          g.lineTo(x, yy - 3.8 * u);
          g.lineTo(x + 1.8 * u, yy - 2.6 * u);
          g.lineTo(x - 4.4 * u, yy + 0.8 * u);
          g.closePath(); g.fillPath();
          g.lineStyle(1.2, locked ? 0x3a4352 : 0x0b1020, 0.9);
          g.beginPath();
          g.moveTo(x - 8.4 * u, yy);
          g.lineTo(x, yy - 4.8 * u);
          g.lineTo(x + 8.4 * u, yy);
          g.lineTo(x, yy + 4.8 * u);
          g.closePath(); g.strokePath();
        };
        layer(y - 4.2 * u, cols[2], 0xffffff);
        layer(y + 0.2 * u, cols[1], 0xffffff);
        layer(y + 4.6 * u, cols[0], 0xffffff);
        break;
      }
      case 'person': { // персонаж
        const p = pal(0x5fd4ff, 0xb3ecff, 0x2386b8, 0xffd24a);
        g.fillStyle(p.c, 1); g.fillCircle(x, y - 4.8 * u, 4.3 * u);
        g.fillStyle(p.a, 1); g.fillCircle(x - 0.5 * u, y - 5.2 * u, 3.8 * u);
        g.fillStyle(p.hi, locked ? 0.12 : 0.24); g.fillCircle(x - 1.6 * u, y - 6.3 * u, 1.3 * u);
        outline(1.3); g.strokeCircle(x, y - 4.8 * u, 4.3 * u);
        g.fillStyle(p.a, 1);
        g.fillRoundedRect(x - 6.8 * u, y + 0.2 * u, 13.6 * u, 8.8 * u, { tl: 5, tr: 5, bl: 2.2, br: 2.2 });
        g.fillStyle(p.c, 0.55);
        g.fillRoundedRect(x - 1.2 * u, y + 0.8 * u, 2.4 * u, 8.2 * u, 1);
        outline(1.3);
        g.strokeRoundedRect(x - 6.8 * u, y + 0.2 * u, 13.6 * u, 8.8 * u, { tl: 5, tr: 5, bl: 2.2, br: 2.2 });
        g.fillStyle(p.acc, 1); g.fillCircle(x, y + 3.2 * u, 1.1 * u);
        break;
      }
      case 'friends': { // друзья — два персонажа
        const p = pal(0x58d68d, 0xa4f0c1, 0x248a4f, 0x59c2ff);
        const buddy = (bx, by, colA, colC, sc = 1) => {
          g.fillStyle(colC, 1); g.fillCircle(bx, by - 3.8 * u * sc, 3.1 * u * sc);
          g.fillStyle(colA, 1); g.fillCircle(bx - 0.3 * u * sc, by - 4.1 * u * sc, 2.7 * u * sc);
          outline(1.1, 0.85); g.strokeCircle(bx, by - 3.8 * u * sc, 3.1 * u * sc);
          g.fillStyle(colA, 1);
          g.fillRoundedRect(bx - 4.8 * u * sc, by - 0.4 * u * sc, 9.6 * u * sc, 6.8 * u * sc, { tl: 3.6, tr: 3.6, bl: 1.8, br: 1.8 });
          outline(1.1, 0.85);
          g.strokeRoundedRect(bx - 4.8 * u * sc, by - 0.4 * u * sc, 9.6 * u * sc, 6.8 * u * sc, { tl: 3.6, tr: 3.6, bl: 1.8, br: 1.8 });
        };
        buddy(x - 4.2 * u, y + 0.8 * u, p.a, p.c, 1);
        buddy(x + 4.2 * u, y + 0.8 * u, locked ? 0x98a5b4 : 0xa8d7ff, locked ? 0x6b7788 : 0x2f6fcb, 1);
        if (!locked) {
          g.fillStyle(p.acc, 0.95); g.fillCircle(x, y - 6.8 * u, 1.5 * u);
          g.fillStyle(0xffffff, 0.8); g.fillCircle(x - 0.4 * u, y - 7.1 * u, 0.5 * u);
        }
        break;
      }
      case 'gang': { // банда — трое, центральный лидер
        const c1 = locked ? 0x98a5b4 : 0xff8a5b;
        const c2 = locked ? 0xb3bcc8 : 0xffd24a;
        const c3 = locked ? 0x7f8b99 : 0x59c2ff;
        if (!locked) { g.fillStyle(0xff9a4a, 0.08); g.fillCircle(x, y, 10 * u); }
        const member = (bx, by, col, sc, lead) => {
          g.fillStyle(locked ? 0x5d6978 : 0x000000, 0.18);
          g.fillEllipse(bx, by + 6.4 * u * sc, 5.4 * u * sc, 1.8 * u * sc);
          g.fillStyle(col, 1); g.fillCircle(bx, by - 4.1 * u * sc, 2.9 * u * sc);
          g.fillStyle(0xffffff, locked ? 0.08 : 0.18); g.fillCircle(bx - 0.7 * u * sc, by - 4.8 * u * sc, 1 * u * sc);
          outline(1.1, 0.85); g.strokeCircle(bx, by - 4.1 * u * sc, 2.9 * u * sc);
          g.fillStyle(col, 0.95);
          g.fillRoundedRect(bx - 4.4 * u * sc, by - 0.8 * u * sc, 8.8 * u * sc, 7.1 * u * sc, { tl: 3.2, tr: 3.2, bl: 1.8, br: 1.8 });
          outline(1.1, 0.85);
          g.strokeRoundedRect(bx - 4.4 * u * sc, by - 0.8 * u * sc, 8.8 * u * sc, 7.1 * u * sc, { tl: 3.2, tr: 3.2, bl: 1.8, br: 1.8 });
          if (lead && !locked) {
            g.fillStyle(0xfff0a0, 1);
            g.fillTriangle(bx, by - 8.7 * u * sc, bx - 1.4 * u * sc, by - 6.7 * u * sc, bx + 1.4 * u * sc, by - 6.7 * u * sc);
          }
        };
        member(x - 5.4 * u, y + 1.2 * u, c1, 0.92, false);
        member(x + 5.4 * u, y + 1.2 * u, c3, 0.92, false);
        member(x, y + 0.2 * u, c2, 1.04, true);
        break;
      }
      case 'event': { // ивент — календарь со звездой
        const p = pal(0x6aa9ff, 0xa9d0ff, 0x2f5fae, 0xffcc33);
        g.fillStyle(locked ? 0x46515f : 0x13233f, 1);
        g.fillRoundedRect(x - 8.4 * u, y - 5.4 * u, 16.8 * u, 14.6 * u, 2.6 * u);
        g.fillStyle(p.a, 1);
        g.fillRoundedRect(x - 7.6 * u, y - 4.6 * u, 15.2 * u, 13 * u, 2.2 * u);
        // Шапка календаря
        g.fillStyle(p.c, 1);
        g.fillRoundedRect(x - 7.6 * u, y - 4.6 * u, 15.2 * u, 4.2 * u, { tl: 2.2, tr: 2.2, bl: 0.6, br: 0.6 });
        outline(1.5); g.strokeRoundedRect(x - 8.2 * u, y - 5.2 * u, 16.4 * u, 14.2 * u, 2.4 * u);
        // Кольца
        g.lineStyle(2, p.acc, 1);
        g.lineBetween(x - 3.8 * u, y - 7.8 * u, x - 3.8 * u, y - 3.8 * u);
        g.lineBetween(x + 3.8 * u, y - 7.8 * u, x + 3.8 * u, y - 3.8 * u);
        // Сетка дней
        g.fillStyle(p.hi, locked ? 0.12 : 0.18);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue;
          g.fillRoundedRect(x - 5.4 * u + c * 3.8 * u, y + 0.8 * u + r * 3.2 * u, 2.6 * u, 2.1 * u, 0.6 * u);
        }
        // Звезда события
        const epts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = (i % 2 === 0 ? 3.9 : 1.7) * u;
          epts.push(new Phaser.Geom.Point(x + Math.cos(a) * r, y + 4.4 * u + Math.sin(a) * r));
        }
        g.fillStyle(p.acc, 1); g.fillPoints(epts, true);
        g.lineStyle(1.1, locked ? 0x3a4352 : 0x0b1020, 0.8); g.strokePoints(epts, true);
        break;
      }
      case 'upgrade': { // модернизация — молот и искра
        const p = pal(0xb7c7db, 0xe6eef8, 0x67798f, 0xff8f3d);
        if (!locked) { g.fillStyle(0xffa040, hover ? 0.16 : 0.09); g.fillCircle(x, y, 10 * u); }
        // Рукоять
        g.lineStyle(3.2, locked ? 0x7b8796 : 0x8a4f1f, 1);
        g.lineBetween(x - 6.2 * u, y + 8.4 * u, x + 2.8 * u, y - 2.4 * u);
        g.lineStyle(1.4, locked ? 0xaab4c2 : 0xd98a42, 1);
        g.lineBetween(x - 5.4 * u, y + 7.8 * u, x + 2.2 * u, y - 1.8 * u);
        // Боёк
        g.fillStyle(p.c, 1);
        g.fillRoundedRect(x - 2.2 * u, y - 9.2 * u, 11.4 * u, 6.6 * u, 1.8 * u);
        g.fillStyle(p.a, 1);
        g.fillRoundedRect(x - 1.5 * u, y - 8.5 * u, 10 * u, 3.1 * u, 1.2 * u);
        outline(1.4); g.strokeRoundedRect(x - 2.2 * u, y - 9.2 * u, 11.4 * u, 6.6 * u, 1.8 * u);
        g.fillStyle(p.b, 1);
        g.fillRoundedRect(x + 8.8 * u, y - 8.4 * u, 1.8 * u, 5 * u, 0.8 * u);
        // Искра апгрейда
        g.fillStyle(p.acc, 1);
        g.fillCircle(x + 6.8 * u, y + 5.6 * u, 2.1 * u);
        g.lineStyle(1.6, p.acc, 1);
        g.lineBetween(x + 6.8 * u, y + 2.2 * u, x + 6.8 * u, y + 9 * u);
        g.lineBetween(x + 3.4 * u, y + 5.6 * u, x + 10.2 * u, y + 5.6 * u);
        break;
      }
      default: {
        const p = pal(0x63b3ff, 0xa8d7ff, 0x2f6fcb, 0xffd24a);
        g.fillStyle(p.a, 1); g.fillCircle(x, y, 7.8 * u);
        outline(1.5); g.strokeCircle(x, y, 7.8 * u);
        g.fillStyle(p.acc, 1); g.fillCircle(x, y, 2.2 * u);
        break;
      }
    }
  }

  // «Мои уровни» — маленький пончик в углу: кольцо + подпись.
export function _donutLevels(x, y) {
    const R = 24;
    const ring = this.add.graphics();
    const glyph = this.add.graphics();
    const paint = (color, bgCol) => {
      ring.clear();
      ring.fillStyle(bgCol || 0x111628, 0.95);
      ring.fillCircle(x, y, R);
      ring.lineStyle(1.5, color, 0.9);
      ring.strokeCircle(x, y, R);
      ring.lineStyle(1, 0x4da6ff, 0.4);
      ring.strokeCircle(x, y, R - 6);
      this._drawBtnIcon(glyph, 'layers', x, y, 8, color);
    };
    paint(0xd8a920, 0x111628);
    const label = this.add.text(x, y + R + 10, 'МОИ УРОВНИ', {
      fontSize: '11px', color: '#c4d4f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, R * 2 + 16, R * 2 + 28).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      paint(0xffe066, 0x221a08);
      label.setColor('#ffd24a');
      label.setScale(1.05);
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.2 });
        }
      } catch (e) {}
    });
    zone.on('pointerout', () => {
      paint(0xd8a920, 0x111628);
      label.setColor('#c4d4f8');
      label.setScale(1);
    });
    zone.on('pointerdown', () => this.scene.start('MyLevelsScene'));
  }

export function createButton(x, y, label, callback, locked, lockMsg, uniTw, uniTh, fontPx, icon, marker) {
    let fs = fontPx || 22;
    const txt = this.add.text(0, 0, label, {
      fontSize: fs + 'px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Размер единый для всех кнопок (приходит снаружи); растягиваем арт под размер кнопки.
    const padX = 48;
    const padY = 12;
    let tw = uniTw || (txt.displayWidth + padX * 2);
    const th = uniTh || (txt.displayHeight + padY * 2);

    const container = this.add.container(x, y);

    const btnGfx = this.add.graphics();
    container.add(btnGfx);

    const drawBtnBg = (state) => {
      btnGfx.clear();
      const halfW = tw / 2;
      const halfH = th / 2;
      const r = 8;

      if (locked) {
        // Заблокированная кнопка
        btnGfx.fillStyle(0x0c0f1a, 0.75);
        btnGfx.fillRoundedRect(-halfW, -halfH, tw, th, r);
        btnGfx.lineStyle(1, 0x222a3d, 0.7);
        btnGfx.strokeRoundedRect(-halfW, -halfH, tw, th, r);
        return;
      }

      if (state === 'hover') {
        // Подсветка при наведении: глубокий тактический фон с янтарно-золотым акцентом
        btnGfx.fillStyle(0x19223a, 0.98);
        btnGfx.fillRoundedRect(-halfW, -halfH, tw, th, r);

        // Верхний мягкий золотистый блик
        btnGfx.fillStyle(0xffd24a, 0.12);
        btnGfx.fillRoundedRect(-halfW + 2, -halfH + 2, tw - 4, Math.floor(th / 2) - 2, { tl: 6, tr: 6, bl: 0, br: 0 });

        // Левая светящаяся полоска-акцент
        btnGfx.fillStyle(0xffd24a, 1);
        btnGfx.fillRoundedRect(-halfW + 3, -halfH + 5, 3.5, th - 10, 1.5);

        // Золотая рамка
        btnGfx.lineStyle(1.8, 0xffd24a, 0.95);
        btnGfx.strokeRoundedRect(-halfW, -halfH, tw, th, r);

        // Тактические угловые засечки
        btnGfx.lineStyle(2, 0xffea77, 1);
        const cLen = 8;
        btnGfx.lineBetween(-halfW, -halfH + cLen, -halfW, -halfH + 2);
        btnGfx.lineBetween(-halfW + 2, -halfH, -halfW + cLen, -halfH);
        btnGfx.lineBetween(halfW - cLen, halfH, halfW - 2, halfH);
        btnGfx.lineBetween(halfW, halfH - cLen, halfW, halfH - 2);
      } else if (state === 'pressed') {
        // Состояние нажатия
        btnGfx.fillStyle(0x13192c, 1);
        btnGfx.fillRoundedRect(-halfW, -halfH, tw, th, r);
        btnGfx.lineStyle(1.8, 0xd8a920, 1);
        btnGfx.strokeRoundedRect(-halfW, -halfH, tw, th, r);
      } else {
        // Обычное состояние: тактический стиль главного меню
        btnGfx.fillStyle(0x101526, 0.94);
        btnGfx.fillRoundedRect(-halfW, -halfH, tw, th, r);

        // Легкий верхний стеклянный блик
        btnGfx.fillStyle(0xffffff, 0.05);
        btnGfx.fillRoundedRect(-halfW + 2, -halfH + 2, tw - 4, Math.floor(th / 2) - 2, { tl: 6, tr: 6, bl: 0, br: 0 });

        // Левый тактический маркер (сине-голубой)
        btnGfx.fillStyle(0x4da6ff, 0.75);
        btnGfx.fillRoundedRect(-halfW + 3, -halfH + 6, 3, th - 12, 1.5);

        // Внешняя аккуратная рамка
        btnGfx.lineStyle(1.2, 0x334160, 0.9);
        btnGfx.strokeRoundedRect(-halfW, -halfH, tw, th, r);

        // Тонкие тактические скобки на углах
        btnGfx.lineStyle(1.5, 0x8a6a10, 0.65);
        btnGfx.lineBetween(-halfW, -halfH + 6, -halfW, -halfH + 2);
        btnGfx.lineBetween(-halfW + 2, -halfH, -halfW + 6, -halfH);
        btnGfx.lineBetween(halfW - 6, halfH, halfW - 2, halfH);
        btnGfx.lineBetween(halfW, halfH - 6, halfW, halfH - 2);
      }
    };
    drawBtnBg(locked ? 'locked' : 'normal');

    container.add(txt);

    // Всё позиционируем от полной ширины плашки (aw = tw)
    const aw = tw;
    // Размер значка от высоты кнопки: низким — компактный, иначе текст не влезет.
    const compactIcon = th < 70;
    const iconR = compactIcon ? 17 : 22;
    const iconX = -aw / 2 + (compactIcon ? 28 : 34);
    const iconPx = compactIcon ? 24 : 32;
    // Маркер справа внутри кнопки (стрелка секции ▾/▸).
    let rightW = 12;
    if (marker) {
      const mk = this.add.text(aw / 2 - 12, 0, marker, {
        fontSize: '13px', color: '#8fb8ff', fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add(mk);
      rightW = 26;
    }

    if (locked) {
      txt.setColor('#667788');
    }

    // Замок — до замера текста, чтобы учесть его ширину в лимите.
    let lockTxt = null;
    if (locked) {
      const lockLabel = lockMsg ? ` 🔒 ${lockMsg}` : ' 🔒';
      lockTxt = this.add.text(aw / 2 - 8, 0, lockLabel, {
        fontSize: '11px',
        color: '#889999'
      }).setOrigin(1, 0.5);
      container.add(lockTxt);
      rightW = lockTxt.displayWidth + 14;
    }

    // Текст строго внутри арта: поля под иконку слева и маркер/замок справа.
    // Центр — по свободной зоне. Уменьшаем размер шрифта и масштабируем при необходимости,
    // чтобы текст никогда не вылезал за границы кнопки.
    const iconW = icon ? (compactIcon ? 54 : 64) : 12;
    const lim = Math.max(30, aw - iconW - rightW - 10);
    while (txt.displayWidth > lim && fs > 11) {
      fs -= 1;
      txt.setFontSize(fs);
    }
    if (txt.displayWidth > lim && txt.displayWidth > 0) {
      txt.scaleX *= (lim / txt.displayWidth);
    }
    txt.setX((iconW - rightW) / 2);

    // Иконка-якорь ВНУТРИ кнопки слева.
    // Состояния normal/hover/locked запекаются в RenderTexture один раз при
    // создании кнопки. На hover — просто setTexture(), ноль геометрии в GPU.
    let iconSprite = null;

    if (icon) {
      const png = BTN_ICON_PNG[icon];
      const iconSize = (compactIcon ? 12 : 15);
      const rtSize = iconR * 2 + 4; // чуть больше круга-фона

      // Запекаем три состояния: normal, hover, locked.
      // Ключи хранятся в сцене через _btnIconRTKeys для очистки в shutdown.
      const bakeState = (stateKey, drawColor, isHover, isLocked) => {
        const key = `__btnIcon_${icon}_${stateKey}_${compactIcon ? 'c' : 'l'}`;
        if (!this.textures.exists(key)) {
          const g = this.make.graphics({ x: 0, y: 0, add: false });
          const cx2 = rtSize / 2, cy2 = rtSize / 2;
          if (png && this.textures.exists(png)) {
            // PNG-вариант: круг-подложка + тинтованное изображение
            g.fillStyle(isHover ? 0x1f2742 : 0x090c18, 0.9);
            g.fillCircle(cx2, cy2, iconR);
            g.lineStyle(1.5, isHover ? 0xffd24a : 0x2e3b58, 0.85);
            g.strokeCircle(cx2, cy2, iconR);
          } else {
            // Вектор: рисуем иконку со смещением в центр RT.
            this._drawBtnIcon(g, icon, cx2, cy2, iconSize, drawColor);
          }
          g.generateTexture(key, rtSize, rtSize);
          g.destroy();
          // Для PNG поверх фона добавляем отдельную копию спрайта с тинтом —
          // это делается через iconSprite.setTint() ниже, фон в RT.
          if (!this._btnIconRTKeys) this._btnIconRTKeys = [];
          this._btnIconRTKeys.push(key);
        }
        return key;
      };

      // Канонические состояния: кэш текстур глобальный, поэтому всегда печём
      // «обычную» версию цветной, а «заблокированную» — серой, независимо от
      // состояния конкретной кнопки (иначе первая созданная кнопка «отравляет»
      // ключ и чужая иконка остаётся серой/цветной навсегда).
      const keyNormal = bakeState('normal', 0xdfe8ff, false, false);
      const keyHover  = bakeState('hover',  0xffff55, true, false);
      const keyLocked = bakeState('locked', 0x667788, false, true);

      iconSprite = this.add.image(iconX, 0, locked ? keyLocked : keyNormal);
      container.add(iconSprite);

      // PNG поверх запечённого фона: отдельный Image с тинтом.
      let iconImgPng = null;
      if (png && this.textures.exists(png)) {
        iconImgPng = this.add.image(iconX, 0, png);
        try {
          const src = this.textures.get(png).getSourceImage();
          const sw = Math.max(1, (src && src.width) || 1);
          const sh = Math.max(1, (src && src.height) || 1);
          iconImgPng.setScale(Math.min(iconPx / sw, iconPx / sh));
        } catch (e) { iconImgPng.setDisplaySize(iconPx, iconPx); }
        iconImgPng.setTint(locked ? 0x667788 : 0xdfe8ff);
        container.add(iconImgPng);
      }

      // paintIcon теперь только меняет ключ текстуры и тинт — без GPU upload.
      var paintIcon = (color, isHover = false) => {
        if (!iconSprite) return;
        const useKey = locked ? keyLocked : (isHover ? keyHover : keyNormal);
        iconSprite.setTexture(useKey);
        if (iconImgPng) iconImgPng.setTint(color);
      };
      container._paintIcon = (col) => paintIcon(col, false);
    } else {
      // Нет иконки — пустышка, чтобы внешний код не падал на _paintIcon.
      var paintIcon = () => {};
      container._paintIcon = () => {};
    }

    container.setSize(tw, th);

    if (!locked) {
      container.setInteractive({ useHandCursor: true });

      container.on('pointerover', () => {
        txt.setColor('#ffff55');
        txt.setY(1);
        paintIcon(0xffff55, true);
        drawBtnBg('hover');
        try {
          if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
            this.sound.play('sfx_hover', { volume: 0.2 });
          }
        } catch (e) { /* noop */ }
      });

      container.on('pointerout', () => {
        txt.setColor('#ffffff');
        txt.setY(0);
        paintIcon(0xdfe8ff, false);
        drawBtnBg('normal');
      });

      container.on('pointerdown', () => {
        txt.setColor('#ffffff');
        txt.setY(0);
        drawBtnBg('pressed');
        callback();
      });
    }

    container._btnTxt = txt;
    container._btnBg = btnGfx;
    return container;
  }

export function createGearButton(x, y) {
    const g = this.add.graphics();
    let hover = false;

    const draw = () => {
      g.clear();
      const bgCol   = hover ? 0x1e1608 : 0x0e1120;
      const rimCol  = hover ? 0xffe066 : 0xd8a920;
      const gearCol = hover ? 0xffe066 : 0xd8a920;
      const holeCol = hover ? 0x1e1608 : 0x0e1120;

      // Шестиугольная подложка (плоской стороной вверх/вниз)
      const R = 15;
      g.fillStyle(bgCol, 0.95);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) g.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
        else         g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      g.closePath();
      g.fillPath();
      g.lineStyle(hover ? 1.8 : 1.4, rimCol, 0.95);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) g.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
        else         g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      g.closePath();
      g.strokePath();

      // Шестерня: 6 зубьев, stroke-стиль — силуэт читается чётко
      const teeth = 6;
      const rOuter = 9.5;
      const rInner = 6.5;
      const toothHalf = 0.32;
      g.lineStyle(hover ? 1.8 : 1.5, gearCol, 1);
      g.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a     = (i / teeth) * Math.PI * 2;
        const aNext = ((i + 1) / teeth) * Math.PI * 2;
        const aMid  = (a + aNext) / 2;
        g.moveTo(x + Math.cos(a - toothHalf) * rInner, y + Math.sin(a - toothHalf) * rInner);
        g.lineTo(x + Math.cos(a - toothHalf) * rOuter, y + Math.sin(a - toothHalf) * rOuter);
        g.lineTo(x + Math.cos(a + toothHalf) * rOuter, y + Math.sin(a + toothHalf) * rOuter);
        g.lineTo(x + Math.cos(a + toothHalf) * rInner, y + Math.sin(a + toothHalf) * rInner);
        g.lineTo(x + Math.cos(aMid) * rInner, y + Math.sin(aMid) * rInner);
      }
      g.strokePath();

      // Внешнее кольцо шестерни
      g.lineStyle(hover ? 1.4 : 1.1, gearCol, 0.5);
      g.strokeCircle(x, y, rOuter + 1);

      // Центральный круг + тактическое перекрестие
      const cr = 3.2;
      g.fillStyle(gearCol, 1);
      g.fillCircle(x, y, cr);
      g.fillStyle(holeCol, 1);
      g.fillCircle(x, y, 1.6);
      g.lineStyle(1.2, gearCol, 0.9);
      g.lineBetween(x - 6.5, y, x - cr - 0.8, y);
      g.lineBetween(x + cr + 0.8, y, x + 6.5, y);
      g.lineBetween(x, y - 6.5, x, y - cr - 0.8);
      g.lineBetween(x, y + cr + 0.8, x, y + 6.5);

      // Блик
      g.fillStyle(0xffffff, hover ? 0.45 : 0.18);
      g.fillCircle(x - 3.5, y - 4, 1.4);
    };

    const hitArea = this.add.rectangle(x, y, 36, 36, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => { hover = true;  draw(); });
    hitArea.on('pointerout',  () => { hover = false; draw(); });
    hitArea.on('pointerdown', () => this.scene.start('SettingsScene'));
    draw();
  }

export function createFullscreenButton(x, y) {
    const g = this.add.graphics();
    let hover = false;

    const draw = (full) => {
      g.clear();
      const bgCol  = hover ? 0x0f1e3a : 0x0e1120;
      const rimCol = hover ? 0xffe066 : 0x8fb8ff;
      const col    = hover ? 0xffe066 : 0x8fb8ff;

      // Шестиугольная подложка (та же форма, что у шестерни — единый стиль пары)
      const R = 15;
      g.fillStyle(bgCol, 0.95);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) g.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
        else         g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      g.closePath();
      g.fillPath();
      g.lineStyle(hover ? 1.8 : 1.4, rimCol, 0.95);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) g.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
        else         g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      g.closePath();
      g.strokePath();

      // Силуэт монитора: скруглённый прямоугольник экрана + подставка
      const mW = 16, mH = 11, mR = 2;
      const mx = x - mW / 2, my = y - mH / 2 - 1;
      g.lineStyle(1.8, col, 1);
      g.strokeRoundedRect(mx, my, mW, mH, mR);
      // Тонкая горизонтальная полоска «статус-бар» внутри экрана
      g.lineStyle(1, col, 0.35);
      g.lineBetween(mx + 2, my + mH - 3, mx + mW - 2, my + mH - 3);
      // Подставка: ножка + основание
      g.lineStyle(1.6, col, 0.85);
      g.lineBetween(x, my + mH, x, my + mH + 3);
      g.lineBetween(x - 4, my + mH + 3, x + 4, my + mH + 3);

      // Стрелки в углах экрана: full=true → к центру (сжать), false → от центра (развернуть)
      const s = full ? -1 : 1;
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      const aLen = 3.5; // длина «ножки» стрелки
      const hLen = 2;   // длина галочки
      g.lineStyle(1.5, col, 1);
      corners.forEach(([sx, sy]) => {
        // угол экрана как опорная точка
        const ex = x + sx * (mW / 2 - 1);
        const ey = (my + (sy < 0 ? 1 : mH - 4));
        // кончик стрелки: внутри экрана если full, снаружи если !full
        const tx2 = ex + sx * s * aLen;
        const ty2 = ey + sy * s * aLen;
        // основная линия стрелки
        g.lineBetween(ex, ey, tx2, ty2);
        // галочка (два усика на кончике, перпендикулярно направлению)
        g.lineBetween(tx2, ty2, tx2 - sx * s * hLen, ty2);
        g.lineBetween(tx2, ty2, tx2, ty2 - sy * s * hLen);
      });

      // Блик
      g.fillStyle(0xffffff, hover ? 0.4 : 0.15);
      g.fillCircle(x - 3.5, y - 4.5, 1.3);
    };

    const hitArea = this.add.rectangle(x, y, 36, 36, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => { hover = true;  draw(this.scale.isFullscreen); });
    hitArea.on('pointerout',  () => { hover = false; draw(this.scale.isFullscreen); });
    hitArea.on('pointerdown', () => {
      try {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
      } catch (e) { /* noop */ }
    });
    this.scale.on('enterfullscreen', () => draw(true));
    this.scale.on('leavefullscreen', () => draw(false));
    draw(false);
  }

// Удаляет все RenderTexture-ключи иконок кнопок, запечённых в этой сцене.
// Вызывается из MenuScene.shutdown() — предотвращает утечку GPU-текстур
// при повторных заходах в меню.
export function _clearBtnIconCache(scene) {
  try {
    const keys = scene._btnIconRTKeys;
    if (!keys || !keys.length) return;
    keys.forEach(k => {
      try { if (scene.textures.exists(k)) scene.textures.remove(k); } catch (e) {}
    });
    scene._btnIconRTKeys = [];
  } catch (e) {}
}
