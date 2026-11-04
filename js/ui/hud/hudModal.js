

import { gameW, OX, BASE_CX } from '../layout.js';
export function updateHudTransform(scene) {
  const z = scene.cameras.main.zoom;
  // Адаптив: центр — реальная середина экрана (на 16:9 = 640, как было),
  // весь 1280-блок HUD центрируется сдвигом ox. На 1280 формула
  // попиксельно совпадает со старой. anchor 'R' — прибит к правому краю
  // (киллфид, пинг): вместо ox получает 2*ox и остаётся у кромки.
  const cx = gameW(scene) / 2;
  const cy = 360;
  const ox = OX(scene);

  // Весь боевой HUD — строго фиксированный на экране, независимо от зума
  // камеры: позиция компенсируется от центра, масштаб — базовый (кастомный
  // фит подложек/иконок) делённый на зум. scrollFactor(0) фиксирует только
  // прокрутку, но НЕ зум — поэтому пропускать элементы здесь нельзя
  // (старый _noHudScale оставлял слоты/абилки/патроны плавать от зума).
  // Дешёвая уборка мёртвых ссылок: динамический HUD (счётчик респауна,
  // баннеры) мог остаться в массиве после destroy() и перебираться каждый
  // кадр. Без этого за долгий матч hudFixed превращался в свалку мёртвых
  // Text, а зум-трансформ каждый кадр обходил всё более длинный хвост.
  const _hf = scene.hudFixed;
  if (_hf) {
    for (let i = _hf.length - 1; i >= 0; i--) {
      const it = _hf[i];
      if (!it || !it.obj || it.obj.active === false) _hf.splice(i, 1);
    }
  }
  scene.hudFixed.forEach(item => {
    const o = item.obj;
    if (!o || !o.active) return;
    // anchor: undefined/'C' — едет с блоком (+ox), 'R' — у правого края
    // (+2ox), 'L' — у левого (без сдвига). На 16:9 ox=0 — как было.
    const ax = item.anchor === 'R' ? ox : (item.anchor === 'L' ? -ox : 0);
    o.setPosition(
      cx + (item.sx - BASE_CX) / z + ax,
      cy + (item.sy - cy) / z
    );
    if (o.scaleX !== undefined && o.scaleY !== undefined) {
      if (item.baseSx === undefined) {
        item.baseSx = o.scaleX;
        item.baseSy = o.scaleY;
      }
      o.setScale(item.baseSx / z, item.baseSy / z);
    }
  });

  if (scene._modalElems) {
    scene._modalElems.forEach(e => {
      if (e && e.active && !e._noHudScale) e.setScale((e instanceof Phaser.GameObjects.Text ? 0.5 : 1) / z);
      // Адаптив: догоняем смену ширины относительным сдвигом (твины,
      // анимирующие x, не ломаются — правим дельтой, а не абсолютом).
      if (e && e.active && e._modalShift !== undefined && e._modalShift !== ox) {
        try { e.x += (ox - e._modalShift); } catch (err) {}
        e._modalShift = ox;
      }
    });
  }
}

export function trackModalElems(scene, elems) {
  if (!scene._modalElems) scene._modalElems = [];
  let ox = 0;
  try { ox = OX(scene); } catch (e) {}
  elems.forEach(e => {
    if (e) {
      // Модалки не участвуют в per-frame HUD-масштабе (п.15).
      e._noHudScale = true;
      // Адаптив: 1280-верстка по центру экрана (на 16:9 ox=0 — как было).
      if (e._modalShift === undefined && Number.isFinite(e.x)) {
        try { e.x += ox; } catch (err) {}
        e._modalShift = ox;
      }
      scene._modalElems.push(e);
    }
  });
}

// Модалки (победа/поражение/конец) рисуем при зуме 1: иначе компенсация
// масштаба (setScale 1/z) раздувает тексты вокруг фиксированных позиций —
// строки опыта налезают на кнопки. update() после gameOver стоит, зум frozen.
export function resetCamForModal(scene) {
  scene.cameras.main.setZoom(1);
  if (scene._modalElems) {
    scene._modalElems.forEach(e => {
      if (e && e.active) e.setScale(e instanceof Phaser.GameObjects.Text ? 0.5 : 1);
    });
  }
}
