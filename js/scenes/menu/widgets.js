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
    g.lineStyle(2, color, 1);
    g.fillStyle(color, 1);
    const u = s / 11;
    switch (id) {
      case 'cart': // тележка магазина
        g.lineBetween(x - 9 * u, y - 6 * u, x + 9 * u, y - 6 * u);
        g.lineBetween(x - 7 * u, y - 6 * u, x - 4 * u, y + 5 * u);
        g.lineBetween(x - 4 * u, y + 5 * u, x + 7 * u, y + 5 * u);
        g.lineBetween(x + 9 * u, y - 6 * u, x + 7 * u, y + 5 * u);
        g.fillCircle(x - 2 * u, y + 8 * u, 1.8 * u);
        g.fillCircle(x + 5 * u, y + 8 * u, 1.8 * u);
        break;
      case 'backpack': // рюкзак инвентаря
        g.strokeRoundedRect(x - 7 * u, y - 5 * u, 14 * u, 13 * u, 4 * u);
        g.strokeRoundedRect(x - 3 * u, y + 1 * u, 6 * u, 5 * u, 2 * u);
        g.lineBetween(x - 3 * u, y - 5 * u, x - 3 * u, y - 9 * u);
        g.lineBetween(x + 3 * u, y - 5 * u, x + 3 * u, y - 9 * u);
        g.lineBetween(x - 3 * u, y - 9 * u, x + 3 * u, y - 9 * u);
        break;
      case 'star': { // звезда навыков
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + i * Math.PI / 5;
          const rad = (i % 2 === 0 ? 10 : 4.2) * u;
          pts.push(new Phaser.Geom.Point(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad));
        }
        g.fillPoints(pts, true);
        break;
      }
      case 'dna': // спираль генома
        g.lineBetween(x - 6 * u, y - 9 * u, x + 6 * u, y - 9 * u);
        g.lineBetween(x + 6 * u, y - 3 * u, x - 6 * u, y + 3 * u);
        g.lineBetween(x - 6 * u, y + 9 * u, x + 6 * u, y + 9 * u);
        g.lineBetween(x - 6 * u, y - 9 * u, x - 6 * u, y - 5 * u);
        g.lineBetween(x + 6 * u, y + 5 * u, x + 6 * u, y + 9 * u);
        break;
      case 'case': // ящик кейсов
        g.strokeRect(x - 8 * u, y - 5 * u, 16 * u, 12 * u);
        g.lineBetween(x - 8 * u, y - 1 * u, x + 8 * u, y - 1 * u);
        g.lineBetween(x, y - 5 * u, x, y - 1 * u);
        break;
      case 'swords': // скрещенные мечи
        g.lineBetween(x - 7 * u, y - 7 * u, x + 7 * u, y + 7 * u);
        g.lineBetween(x + 7 * u, y - 7 * u, x - 7 * u, y + 7 * u);
        g.lineBetween(x - 7 * u, y - 3 * u, x - 3 * u, y - 7 * u);
        g.lineBetween(x + 7 * u, y - 3 * u, x + 3 * u, y - 7 * u);
        break;
      case 'single': // одиночная игра (фолбэк — те же мечи)
        g.lineBetween(x - 7 * u, y - 7 * u, x + 7 * u, y + 7 * u);
        g.lineBetween(x + 7 * u, y - 7 * u, x - 7 * u, y + 7 * u);
        g.lineBetween(x - 7 * u, y - 3 * u, x - 3 * u, y - 7 * u);
        g.lineBetween(x + 7 * u, y - 3 * u, x + 3 * u, y - 7 * u);
        break;
      case 'globe': // онлайн
        g.strokeCircle(x, y, 9 * u);
        g.lineBetween(x - 9 * u, y, x + 9 * u, y);
        g.strokeEllipse(x, y, 10 * u, 18 * u);
        break;
      case 'flag': // кампания
        g.lineBetween(x - 5 * u, y - 9 * u, x - 5 * u, y + 9 * u);
        g.fillTriangle(x - 5 * u, y - 9 * u, x + 8 * u, y - 5 * u, x - 5 * u, y - 1 * u);
        break;
      case 'skull': // испытание
        g.strokeCircle(x, y - 2 * u, 6 * u);
        g.fillCircle(x - 2.4 * u, y - 2.5 * u, 1.4 * u);
        g.fillCircle(x + 2.4 * u, y - 2.5 * u, 1.4 * u);
        g.strokeRect(x - 3.5 * u, y + 3 * u, 7 * u, 5 * u);
        break;
      case 'medal': // рейтинг
        g.strokeCircle(x, y + 2 * u, 6 * u);
        g.fillCircle(x, y + 2 * u, 1.8 * u);
        g.lineBetween(x - 4 * u, y - 8 * u, x - 1 * u, y - 2 * u);
        g.lineBetween(x + 4 * u, y - 8 * u, x + 1 * u, y - 2 * u);
        break;
      case 'bolt': // быстрый бой
        g.fillTriangle(x + 2 * u, y - 9 * u, x - 4 * u, y + 1 * u, x, y + 1 * u);
        g.fillTriangle(x - 2 * u, y + 9 * u, x + 4 * u, y - 1 * u, x, y - 1 * u);
        break;
      case 'list': // выбрать матч
        g.lineBetween(x - 7 * u, y - 5 * u, x + 7 * u, y - 5 * u);
        g.lineBetween(x - 7 * u, y, x + 7 * u, y);
        g.lineBetween(x - 7 * u, y + 5 * u, x + 3 * u, y + 5 * u);
        break;
      case 'layers': // мои уровни
        g.fillTriangle(x - 8 * u, y - 2 * u, x, y - 7 * u, x + 8 * u, y - 2 * u);
        g.lineBetween(x - 8 * u, y + 2 * u, x, y + 7 * u);
        g.lineBetween(x + 8 * u, y + 2 * u, x, y + 7 * u);
        break;
      case 'person': // персонаж
        g.fillCircle(x, y - 5 * u, 3.6 * u);
        g.fillTriangle(x - 6 * u, y + 9 * u, x, y - 1 * u, x + 6 * u, y + 9 * u);
        break;
      case 'friends': // друзья
        g.fillCircle(x - 4 * u, y - 4 * u, 3 * u);
        g.fillCircle(x + 4 * u, y - 4 * u, 3 * u);
        g.fillTriangle(x - 9 * u, y + 8 * u, x - 4 * u, y, x + 1 * u, y + 8 * u);
        g.fillTriangle(x - 1 * u, y + 8 * u, x + 4 * u, y, x + 9 * u, y + 8 * u);
        break;
      case 'gang': { // банда — трое плечом к плечу
        g.fillCircle(x - 5 * u, y - 4 * u, 2.6 * u);
        g.fillCircle(x, y - 5 * u, 2.6 * u);
        g.fillCircle(x + 5 * u, y - 4 * u, 2.6 * u);
        g.fillRoundedRect(x - 9 * u, y, 18 * u, 8 * u, 3 * u);
        break;
      }
      case 'event': { // ивент — календарь со звездой
        g.strokeRoundedRect(x - 8 * u, y - 5 * u, 16 * u, 14 * u, 3 * u);
        g.lineBetween(x - 8 * u, y, x + 8 * u, y);
        g.lineBetween(x - 4 * u, y - 5 * u, x - 4 * u, y - 8 * u);
        g.lineBetween(x + 4 * u, y - 5 * u, x + 4 * u, y - 8 * u);
        const epts = [];
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + i * Math.PI / 5;
          const rad = (i % 2 === 0 ? 3.6 : 1.6) * u;
          epts.push(new Phaser.Geom.Point(x + Math.cos(ang) * rad, y + 4.5 * u + Math.sin(ang) * rad));
        }
        g.fillPoints(epts, true);
        break;
      }
      case 'upgrade': { // модернизация — молот
        g.lineStyle(3, color, 1);
        g.lineBetween(x - 6 * u, y + 8 * u, x + 3 * u, y - 3 * u);
        g.fillStyle(color, 1);
        g.fillRoundedRect(x - 1 * u, y - 9 * u, 10 * u, 6 * u, 1.5 * u);
        g.lineBetween(x + 9 * u, y - 9 * u, x + 9 * u, y - 3 * u);
        break;
      }
      default:
        g.strokeCircle(x, y, 8 * u);
        break;
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

    // Иконка-якорь ВНУТРИ кнопки слева: авторский PNG, иначе вектор.
    // Серая на закрытой, белая, жёлтая при наведении (тинт).
    // Под PNG — тёмный круг с ободком, чтоб не сливался с фоном.
    let iconGfx = null;
    let iconImg = null;
    let iconBg = null;
    const paintIcon = (color, isHover = false) => {
      if (!icon) return;
      const png = BTN_ICON_PNG[icon];
      if (png && this.textures.exists(png)) {
        if (!iconImg) {
          iconBg = this.add.graphics();
          container.add(iconBg);
          iconImg = this.add.image(iconX, 0, png);
          // Фит с сохранением пропорций
          try {
            const src = this.textures.get(png).getSourceImage();
            const sw = Math.max(1, (src && src.width) || 1);
            const sh = Math.max(1, (src && src.height) || 1);
            iconImg.setScale(Math.min(iconPx / sw, iconPx / sh));
          } catch (e) { iconImg.setDisplaySize(iconPx, iconPx); }
          container.add(iconImg);
        }
        if (iconBg) {
          iconBg.clear();
          iconBg.fillStyle(isHover ? 0x1f2742 : 0x090c18, 0.9);
          iconBg.fillCircle(iconX, 0, iconR);
          iconBg.lineStyle(1.5, isHover ? 0xffd24a : 0x2e3b58, 0.85);
          iconBg.strokeCircle(iconX, 0, iconR);
        }
        iconImg.setTint(color);
        if (iconGfx) iconGfx.clear();
        return;
      }
      if (!iconGfx) {
        iconGfx = this.add.graphics();
        container.add(iconGfx);
      }
      this._drawBtnIcon(iconGfx, icon, iconX, 0, compactIcon ? 12 : 15, color);
    };
    paintIcon(locked ? 0x667788 : 0xdfe8ff, false);
    container._paintIcon = (col) => paintIcon(col, false);

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
      const color = hover ? 0xffff55 : 0xffffff;
      g.lineStyle(3, color, 1);
      g.strokeCircle(x, y, 11);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 4);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const inner = 13;
        const outer = 17;
        g.lineBetween(
          x + Math.cos(ang) * inner, y + Math.sin(ang) * inner,
          x + Math.cos(ang) * outer, y + Math.sin(ang) * outer
        );
      }
    };

    const hitArea = this.add.rectangle(x, y, 40, 40, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => { hover = true; draw(); });
    hitArea.on('pointerout', () => { hover = false; draw(); });
    hitArea.on('pointerdown', () => this.scene.start('SettingsScene'));
    draw();
  }

export function createFullscreenButton(x, y) {
    const g = this.add.graphics();
    let hover = false;
    const drawArrow = (x1, y1, x2, y2) => {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const h = 5;
      g.lineBetween(x1, y1, x2, y2);
      g.lineBetween(x2, y2, x2 + Math.cos(ang + Math.PI - 0.5) * h, y2 + Math.sin(ang + Math.PI - 0.5) * h);
      g.lineBetween(x2, y2, x2 + Math.cos(ang + Math.PI + 0.5) * h, y2 + Math.sin(ang + Math.PI + 0.5) * h);
    };

    const draw = (full) => {
      g.clear();
      const color = hover ? 0xffff55 : 0xffffff;
      g.lineStyle(3, color, 1);
      g.strokeRoundedRect(x - 13, y - 13, 26, 26, 3);
      const o = 15;
      if (full) {
        drawArrow(x - o, y - o, x - 7, y - 7);
        drawArrow(x + o, y - o, x + 7, y - 7);
        drawArrow(x - o, y + o, x - 7, y + 7);
        drawArrow(x + o, y + o, x + 7, y + 7);
      } else {
        drawArrow(x - 7, y - 7, x - o, y - o);
        drawArrow(x + 7, y - 7, x + o, y - o);
        drawArrow(x - 7, y + 7, x - o, y + o);
        drawArrow(x + 7, y + 7, x + o, y + o);
      }
    };

    const hitArea = this.add.rectangle(x, y, 40, 40, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => { hover = true; draw(this.scale.isFullscreen); });
    hitArea.on('pointerout', () => { hover = false; draw(this.scale.isFullscreen); });
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
