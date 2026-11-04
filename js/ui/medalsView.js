// medalsView.js — общая отрисовка боевых медалей (ТЗ п.7).
// Было копией в combat/match.js — вынесено, чтобы итоги боя и полка
// «НАГРАДЫ» в профиле выглядели одинаково. Логика выдачи — в data/medals.js.
// Импортирует только medalById (циклов нет: match.js и FriendsScene зовут отсюда).
import { medalById } from '../data/medals.js';

// Цвета лент медалей по id.
const MEDAL_RIBBON = {
  firstblood: 0xff5555, warrior: 0xffaa00, crusher: 0xff6600,
  bearer: 0x7db8ff, hunter: 0xb44dff, unbroken: 0x88dd88,
  hero: 0xffd24a, smasher: 0xff4444, sapper: 0x33ddff, invader: 0x35d07f
};

// Эмблема медали внутри золотого круга: у каждой своя векторная фигура
// (капля, мечи, взрыв, флаг, прицел, щит, звезда, пламя, бомба, метка).
// Без букв и эмодзи — только геометрия.
function drawMedalEmblem(g, id, x, y) {
  try {
    const BR = 0x7a5a10; // тёмная бронза на золоте
    const P = (dx, dy) => new Phaser.Geom.Point(x + dx, y + dy);
    switch (id) {
      case 'firstblood': { // капля
        g.fillStyle(BR, 1);
        g.fillTriangle(x, y - 10, x - 6, y + 1, x + 6, y + 1);
        g.fillCircle(x, y + 2, 6);
        break;
      }
      case 'warrior': { // скрещенные мечи
        g.lineStyle(3, BR, 1);
        g.lineBetween(x - 8, y + 7, x + 8, y - 7);
        g.lineBetween(x + 8, y + 7, x - 8, y - 7);
        g.lineStyle(2, BR, 1);
        g.lineBetween(x - 8, y + 4, x - 4, y + 8);
        g.lineBetween(x + 8, y + 4, x + 4, y + 8);
        break;
      }
      case 'crusher': { // взрыв — 8-конечная звезда
        const pts = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 10 : 4.5;
          pts.push(P(Math.cos(a) * r, Math.sin(a) * r));
        }
        g.fillStyle(BR, 1);
        g.fillPoints(pts, true);
        break;
      }
      case 'bearer': { // флаг
        g.lineStyle(2.5, BR, 1);
        g.lineBetween(x - 4, y - 9, x - 4, y + 9);
        g.fillStyle(BR, 1);
        g.fillTriangle(x - 4, y - 9, x + 8, y - 6, x - 4, y - 3);
        break;
      }
      case 'hunter': { // прицел
        g.lineStyle(2, BR, 1);
        g.strokeCircle(x, y, 7);
        g.lineStyle(2.5, BR, 1);
        g.lineBetween(x - 11, y, x - 4, y);
        g.lineBetween(x + 4, y, x + 11, y);
        g.lineBetween(x, y - 11, x, y - 4);
        g.lineBetween(x, y + 4, x, y + 11);
        g.fillStyle(BR, 1);
        g.fillCircle(x, y, 1.8);
        break;
      }
      case 'unbroken': { // щит с галочкой
        g.fillStyle(BR, 1);
        g.fillPoints([P(0, -10), P(8, -6), P(8, 1), P(0, 9), P(-8, 1), P(-8, -6)], true);
        g.lineStyle(2, 0xffe9a0, 1);
        g.lineBetween(x - 4, y + 1, x - 1, y + 4);
        g.lineBetween(x - 1, y + 4, x + 5, y - 4);
        break;
      }
      case 'hero': { // звезда
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 10 : 4;
          pts.push(P(Math.cos(a) * r, Math.sin(a) * r));
        }
        g.fillStyle(BR, 1);
        g.fillPoints(pts, true);
        break;
      }
      case 'smasher': { // молния (было пламя — сливалось с каплей)
        g.fillStyle(BR, 1);
        g.fillPoints([P(3, -11), P(-4, 0), P(0, 0), P(-3, 10), P(6, -3), P(2, -3)], true);
        break;
      }
      case 'sapper': { // бомба с фитилём
        g.fillStyle(BR, 1);
        g.fillCircle(x - 1, y + 2, 7);
        g.lineStyle(2, BR, 1);
        g.lineBetween(x + 3, y - 4, x + 8, y - 9);
        g.fillStyle(0xffe9a0, 1);
        g.fillCircle(x + 8, y - 9, 2.2);
        break;
      }
      case 'invader': // fallthrough — метка точки
      default: { // капля-метка: круг + остриё
        g.fillStyle(BR, 1);
        g.fillCircle(x, y - 2, 6);
        g.fillTriangle(x - 5, y + 2, x + 5, y + 2, x, y + 10);
        g.fillStyle(0xffe9a0, 1);
        g.fillCircle(x, y - 2, 2.2);
        break;
      }
    }
  } catch (e) {}
}

// Ряд рисованных медалей: лента + золотой круг с эмблемой + подпись.
// Заголовок — отдельно выше (зовёт endGame). По 3 в ряду, дальше перенос.
// Ячейка ФИКСИРОВАННАЯ по числу в ряду (замер displayWidth врёт на
// фолбэк-шрифтах — был налезание и вылезание за края): 3 → 500/3,
// 2/1 → 190. Подпись всегда переносится в ячейку + ужатие 11→9,
// так что налезание невозможно по построению. Ряд ≤ 500 (панель 560).
// opts: { depth (база, тултип +2), labelFn(m, id) — подпись }.
// Возвращает { h (занятая высота), objs (созданные объекты — на уничтожение зовом) }.
export function drawMedalRow(scene, cx, y, ids, opts = {}) {
  const objs = [];
  try {
    const depth = opts.depth || 201;
    const labelFn = opts.labelFn || null;
    const perRow = 3, MR = 17;
    const rows = Math.max(1, Math.ceil(ids.length / perRow));
    ids.forEach((id, idx) => {
      const m = medalById(id) || { name: id };
      const r = Math.floor(idx / perRow), c = idx % perRow;
      const inRow = Math.min(perRow, ids.length - r * perRow);
      const cellW = inRow >= 3 ? 500 / 3 : 190;
      const x = cx - (inRow * cellW) / 2 + cellW / 2 + c * cellW;
      const my = y + 28 + r * 80;
      const ribbon = MEDAL_RIBBON[id] != null ? MEDAL_RIBBON[id] : 0xffd24a;
      const g = scene.add.graphics().setScrollFactor(0).setDepth(depth);
      objs.push(g);
      // Лента-трапеция + складки по краям и светлая середина.
      const ty = my - 28, by = my - 12;
      g.fillStyle(ribbon, 1);
      g.fillTriangle(x - 9, ty, x + 9, ty, x + 5, by);
      g.fillTriangle(x - 9, ty, x - 5, by, x + 5, by);
      g.fillStyle(0xffffff, 0.22);
      g.fillTriangle(x - 2.5, ty, x + 2.5, ty, x + 1.5, by);
      g.fillTriangle(x - 2.5, ty, x - 1.5, by, x + 1.5, by);
      g.lineStyle(1, 0x000000, 0.35);
      g.lineBetween(x - 9, ty, x - 5, by);
      g.lineBetween(x + 9, ty, x + 5, by);
      // Круг медали + ободки.
      g.fillStyle(0xffd24a, 1);
      g.fillCircle(x, my, MR);
      g.lineStyle(2, 0x8a6a10, 1);
      g.strokeCircle(x, my, MR);
      // Заклёпки по тёмному ободу (белые — чтобы не сливались ни с золотом,
      // ни со светлым внутренним кольцом).
      g.fillStyle(0xffffff, 1);
      for (let ri = 0; ri < 8; ri++) {
        const ra = (ri / 8) * Math.PI * 2 + Math.PI / 8;
        g.fillCircle(x + Math.cos(ra) * (MR - 1), my + Math.sin(ra) * (MR - 1), 1.3);
      }
      // Внутренний диск-подложка под эмблему.
      g.fillStyle(0xdfa400, 1);
      g.fillCircle(x, my, MR - 6);
      g.lineStyle(1, 0xfff2b0, 0.6);
      g.strokeCircle(x, my, MR - 6);
      // Блик сверху слева.
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(x - 6, my - 8, 2);
      // Эмблема по центру (у каждой медали своя).
      drawMedalEmblem(g, id, x, my);
      // Подпись под медалью (букв на круге нет — только лента и золото).
      // Мелкая (9px): длинные названия иначе налезают друг на друга.
      const nm = labelFn ? labelFn(m, id) : String((m && m.name) || id);
      const lab = scene.add.text(x, my + MR + 8, nm, {
        fontSize: '9px', color: '#ffd24a', align: 'center',
        wordWrap: { width: cellW - 12 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth);
      // Страховка от широкого фолбэк-шрифта: ужатие 9→8 (как в карточках).
      try {
        let fs = 9, guard = 0;
        while (lab.displayWidth > cellW - 12 && fs > 8 && guard++ < 4) { fs -= 1; lab.setFontSize(fs); }
      } catch (e) {}
      objs.push(lab);
      // Подсказка за что дали: всплывает при наведении на медаль.
      try {
        const desc = String((m && m.desc) || '');
        if (desc) {
          const tip = scene.add.text(x, my - MR - 12, desc, {
            fontSize: '12px', color: '#ffffff', align: 'center',
            backgroundColor: '#0d0d22ee', padding: 6,
            wordWrap: { width: 220 }
          }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 2).setVisible(false);
          objs.push(tip);
          g.setInteractive(new Phaser.Geom.Circle(x, my, MR + 7), Phaser.Geom.Circle.Contains);
          if (g.input) g.input.cursor = 'pointer';
          g.on('pointerover', () => {
            try { tip.setVisible(true); } catch (e) {}
            try {
              if (scene.cache.audio.exists('sfx_hover') && !scene.sound.locked) {
                scene.sound.play('sfx_hover', { volume: 0.15 });
              }
            } catch (e) {}
          });
          g.on('pointerout', () => { try { tip.setVisible(false); } catch (e) {} });
        }
      } catch (e) {}
    });
    return { h: rows * 80, objs };
  } catch (e) {
    return { h: 0, objs };
  }
}

// Компактные иконки медалей для полки профиля: золотой круг с эмблемой
// + счётчик ×N (лент и подписей нет — имя в тултипе по ховеру).
// opts: { counts ({id: n}), perRow, cellW, MR, depth }.
// Возвращает { h, objs }.
export function drawMedalIcons(scene, cx, y, ids, opts = {}) {
  const objs = [];
  try {
    const depth = opts.depth || 202;
    const counts = opts.counts || {};
    const perRow = opts.perRow || 10;
    const cellW = opts.cellW || 48;
    const MR = opts.MR || 12;
    const rows = Math.max(1, Math.ceil(ids.length / perRow));
    ids.forEach((id, idx) => {
      const m = medalById(id) || { name: id, desc: '' };
      const r = Math.floor(idx / perRow), c = idx % perRow;
      const inRow = Math.min(perRow, ids.length - r * perRow);
      const x = cx - (inRow * cellW) / 2 + cellW / 2 + c * cellW;
      const my = y + 4 + MR + r * (MR * 2 + 26);
      const g = scene.add.graphics().setScrollFactor(0).setDepth(depth);
      objs.push(g);
      g.fillStyle(0xffd24a, 1);
      g.fillCircle(x, my, MR);
      g.lineStyle(2, 0x8a6a10, 1);
      g.strokeCircle(x, my, MR);
      g.fillStyle(0xdfa400, 1);
      g.fillCircle(x, my, Math.max(4, MR - 5));
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(x - MR * 0.35, my - MR * 0.45, 1.6);
      drawMedalEmblem(g, id, x, my);
      const n = (counts[id] | 0) || 0;
      if (n > 0) {
        const lab = scene.add.text(x, my + MR + 3, `×${n}`, {
          fontSize: '10px', color: '#ffd24a', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth);
        objs.push(lab);
      }
      try {
        const tipTxt = `${m.name}${n > 0 ? ` ×${n}` : ''}${m.desc ? '\n' + m.desc : ''}`;
        const tip = scene.add.text(x, my - MR - 6, tipTxt, {
          fontSize: '12px', color: '#ffffff', align: 'center',
          backgroundColor: '#0d0d22ee', padding: 6,
          wordWrap: { width: 220 }
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 2).setVisible(false);
        objs.push(tip);
        g.setInteractive(new Phaser.Geom.Circle(x, my, MR + 6), Phaser.Geom.Circle.Contains);
        if (g.input) g.input.cursor = 'pointer';
        g.on('pointerover', () => {
          try { tip.setVisible(true); } catch (e) {}
          try {
            if (scene.cache.audio.exists('sfx_hover') && !scene.sound.locked) {
              scene.sound.play('sfx_hover', { volume: 0.15 });
            }
          } catch (e) {}
        });
        g.on('pointerout', () => { try { tip.setVisible(false); } catch (e) {} });
      } catch (e) {}
    });
    return { h: rows * (MR * 2 + 26) + 4, objs };
  } catch (e) {
    return { h: 0, objs };
  }
}
