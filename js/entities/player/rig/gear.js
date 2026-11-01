

import { GEO_GEAR_BAKED, setGearBaked } from './config.js';
export function ensureGeoTextures(player, scene) {
  try {
    const tm = (scene || player.scene).textures;
    try {
      bakeGear(player, tm, (scene || player.scene).make);
    } catch (e2) {}
    if (!tm.exists('__geo_torso')) {
      // ПРОФИЛЬ (вид сбоку): боец стоит боком по направлению взгляда —
      // узкий силуэт груди, плечо вперёд, спина сзади, ворот сбоку.
      // Было «передом» (широкая футболка с карманом) — теперь боковой
      // срез: грудь выступает вперёд (+x — сторона взгляда по умолчанию),
      // лопатка сзади, рукав один спереди. Зеркалит flipX движка.
      const g = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W = 24, H = 36;
      // спина (тёмная полоса сзади)
      g.fillStyle(0xd9dfe8, 1);
      g.fillRoundedRect(2, 4, 7, 27, 4);
      // грудь/живот (светлый объём спереди)
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(8, 3, 12, 28, 7);
      // грудная пластина — выступ вперёд
      g.fillStyle(0xf2f4f8, 1);
      g.fillRoundedRect(14, 8, 7, 14, 3);
      // плечо спереди (короткий рукав в профиль — один, не два)
      g.fillStyle(0xf2f4f8, 1);
      g.fillRoundedRect(12, 5, 9, 10, 4);
      g.fillStyle(0xd9dfe8, 1);
      g.fillRect(12, 12, 9, 3);
      // ворот сбоку (не круг спереди)
      g.lineStyle(2, 0x8a93a3, 1);
      g.lineBetween(9, 4, 15, 4);
      g.fillStyle(0x8a93a3, 1);
      g.fillCircle(12, 6, 1);
      // боковой шов и подол с ремнём
      g.lineStyle(1, 0x9aa3b5, 1);
      g.lineBetween(8, 6, 8, 28);
      // ДЕТАЛИ: нагрудный карман, застёжка, строчки, лямка
      g.fillStyle(0xe4e9f0, 1);
      g.fillRoundedRect(15, 12, 6, 6, 1.5); // карман на груди
      g.lineStyle(1, 0x8a93a3, 1);
      g.strokeRoundedRect(15, 12, 6, 6, 1.5); // шов кармана
      g.lineStyle(1.5, 0xb8c0cc, 1);
      g.lineBetween(11.5, 5, 11.5, 28); // застёжка посередине
      g.lineStyle(0.8, 0x9aa3b5, 1);
      g.lineBetween(4, 27, 20, 27); // строчка подола
      g.lineBetween(12, 5, 19, 7); // лямка рюкзака через плечо
      g.lineBetween(12, 8, 19, 10); // вторая строчка лямки
      g.fillStyle(0x6a7686, 1);
      g.fillCircle(16.5, 14.5, 0.8); // кнопка кармана
      g.fillStyle(0xe6ebf2, 1);
      g.fillRect(4, 28, 16, 3);
      g.fillStyle(0x3a3f52, 1);
      g.fillRect(4, 31, 16, 4);
      g.fillStyle(0xc8cfdb, 1);
      g.fillRect(10, 31, 4, 4);
      g.generateTexture('__geo_torso', W, H);
      g.destroy();
    }
    // Кепки классов: купол + козырёк вправо + кнопка, плюс знак класса.
    // deco: null | 'cross' (медик) | 'band' (снайпер) | 'rivets' (танк).
    const bakeCap = (key, dome, visor, button, deco) => {
      if (tm.exists(key)) return;
      const g2 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W2 = 30, H2 = 14;
      g2.fillStyle(dome, 1);
      g2.fillEllipse(W2 * 0.42, H2 * 0.42, W2 * 0.72, H2 * 0.8);
      if (deco === 'band') {
        g2.fillStyle(visor, 1);
        g2.fillRect(W2 * 0.12, H2 * 0.3, W2 * 0.6, H2 * 0.24);
      }
      if (deco === 'rivets') {
        g2.fillStyle(button, 1);
        g2.fillCircle(W2 * 0.22, H2 * 0.3, 1.4);
        g2.fillCircle(W2 * 0.42, H2 * 0.22, 1.4);
        g2.fillCircle(W2 * 0.62, H2 * 0.3, 1.4);
      }
      // козырёк вперёд (вправо — сторона взгляда по умолчанию)
      g2.fillStyle(visor, 1);
      g2.fillRoundedRect(W2 * 0.55, H2 * 0.5, W2 * 0.42, H2 * 0.26, 2);
      // ДЕТАЛИ: строчка по козырьку и шов тульи (кепка не плоская плашка)
      g2.lineStyle(1, 0x000000, 0.25);
      g2.lineBetween(W2 * 0.58, H2 * 0.52, W2 * 0.95, H2 * 0.52); // кант козырька
      g2.lineBetween(W2 * 0.42, H2 * 0.06, W2 * 0.42, H2 * 0.62); // шов тульи
      if (deco === 'cross') {
        // красный крест медика
        g2.fillStyle(0xd23b3b, 1);
        g2.fillRect(W2 * 0.36, H2 * 0.08, W2 * 0.12, H2 * 0.5);
        g2.fillRect(W2 * 0.27, H2 * 0.18, W2 * 0.3, H2 * 0.3);
      } else {
        // кнопка на макушке
        g2.fillStyle(button, 1);
        g2.fillCircle(W2 * 0.42, H2 * 0.08, 2);
      }
      g2.generateTexture(key, W2, H2);
      g2.destroy();
    };
    bakeCap('__geo_cap', 0x2e4a7a, 0x22375e, 0x9fb6dd, null); // базовый/штурмовик — синяя
    bakeCap('__geo_cap_Assault', 0x2e4a7a, 0x22375e, 0x9fb6dd, null);
    bakeCap('__geo_cap_Tank', 0x8a5a24, 0x6b4218, 0xd8b46a, 'rivets'); // танк — оранжевая, клёпки
    bakeCap('__geo_cap_Medic', 0xf2f4f8, 0xd9dfe8, 0xffffff, 'cross'); // медик — белая с крестом
    bakeCap('__geo_cap_Sniper', 0x5e3a6e, 0x472b54, 0xc79bdd, 'band'); // снайпер — тёмная с полосой
    if (!tm.exists('__geo_shoe')) {
      // Кед в профиль, носок вправо: тёмный верх, светлая подошва,
      // светлый носок, шнурки. Зеркалит код (scaleX) под сторону взгляда.
      const g3 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W3 = 22, H3 = 13;
      // верх
      g3.fillStyle(0x3a4a6b, 1);
      g3.fillRoundedRect(1, 1, 20, 9, 4);
      // пятка темнее
      g3.fillStyle(0x2c3a57, 1);
      g3.fillRoundedRect(1, 2, 5, 8, 2);
      // носок светлее
      g3.fillStyle(0x6f87b8, 1);
      g3.fillRoundedRect(14, 3, 7, 7, 3);
      // шнурки
      g3.lineStyle(1.5, 0xe8edf5, 1);
      g3.lineBetween(10, 3, 12, 7);
      g3.lineBetween(12.5, 3, 14.5, 7);
      // ДЕТАЛИ: люверсы и блик на носке
      g3.fillStyle(0x9aa7c7, 1);
      g3.fillCircle(10, 2.5, 0.8);
      g3.fillCircle(12.5, 2.5, 0.8);
      g3.lineStyle(0.8, 0xd5dbe7, 1);
      g3.lineBetween(15, 3.5, 19, 6); // блик на резине носка
      // подошва
      g3.fillStyle(0xd5dbe7, 1);
      g3.fillRoundedRect(0, 9, 22, 4, 2);
      g3.lineStyle(1, 0x8a93a3, 1);
      g3.strokeRoundedRect(0, 9, 22, 4, 2);
      // контур верха для читаемости
      g3.lineStyle(1.5, 0x1c2438, 1);
      g3.strokeRoundedRect(1, 1, 20, 9, 4);
      g3.generateTexture('__geo_shoe', W3, H3);
      g3.destroy();
    }
    if (!tm.exists('__geo_arm_up')) {
      // Рукав футболки (белый — красится тинтом тела).
      // Текстура СТОИТ вертикально: верх = плечо, низ = локоть
      // (поза доворачивает её вдоль кости).
      const g4 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W4 = 14, H4 = 24;
      g4.fillStyle(0xffffff, 1);
      g4.fillRoundedRect(1, 0, 12, 22, 5);
      g4.fillStyle(0xd9dfe8, 1);
      g4.fillRoundedRect(1, 0, 4, 22, 3);
      // манжета у локтя
      g4.fillStyle(0xd9dfe8, 1);
      g4.fillRect(1, 19, 12, 3);
      g4.lineStyle(1.5, 0x1c2438, 1);
      g4.strokeRoundedRect(1, 0, 12, 22, 5);
      g4.generateTexture('__geo_arm_up', W4, H4);
      g4.destroy();
    }
    if (!tm.exists('__geo_arm_fore')) {
      // Предплечье — голая рука (телесный, фиксированный).
      // Верх = локоть, низ = запястье.
      const g5 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W5 = 10, H5 = 22;
      g5.fillStyle(0xeec9a0, 1);
      g5.fillRoundedRect(1, 0, 8, 21, 4);
      // мышца-блик
      g5.fillStyle(0xf6dcbb, 1);
      g5.fillRoundedRect(3, 2, 4, 14, 2);
      // браслет у запястья
      g5.fillStyle(0x8a93a3, 1);
      g5.fillRect(1, 18, 8, 3);
      g5.lineStyle(1, 0x1c2438, 1);
      g5.strokeRoundedRect(1, 0, 8, 21, 4);
      g5.generateTexture('__geo_arm_fore', W5, H5);
      g5.destroy();
    }
    if (!tm.exists('__geo_hand')) {
      // Кисть с пальцами (нос смотрит ВПРАВО — вдоль кости, без доворота).
      const g6 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W6 = 12, H6 = 8;
      g6.fillStyle(0xeec9a0, 1);
      g6.fillRoundedRect(0, 0, 12, 8, 3);
      g6.fillStyle(0xf6dcbb, 1);
      g6.fillRoundedRect(1, 1, 7, 6, 2);
      // пальцы: две борозды + большой палец снизу
      g6.lineStyle(1, 0xb98a5e, 1);
      g6.lineBetween(8, 1, 8, 7);
      g6.lineBetween(10, 1.5, 10, 6.5);
      g6.fillStyle(0xeec9a0, 1);
      g6.fillCircle(3, 8, 2);
      g6.lineStyle(1, 0x1c2438, 1);
      g6.strokeRoundedRect(0, 0, 12, 8, 3);
      g6.generateTexture('__geo_hand', W6, H6);
      g6.destroy();
    }
    if (!tm.exists('__geo_face_ov')) {
      // Детали лица поверх головы-круга: нейтральные полупрозрачные —
      // работают на любом цвете кожи (голова красится скином). Раньше
      // белый глаз-круг висел «на коже» и читался выпученным; глазница
      // сажает его внутрь морды. Центр текстуры = центр головы, R —
      // радиус головы в текстуре, +x — сторона взгляда (флипается).
      const W = 20, H = 20, R = 10;
      const g10 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const fx = R, fy = R;
      // глазницы (тень «впадины»)
      g10.fillStyle(0x000000, 0.16);
      g10.fillEllipse(fx + 0.02 * R, fy - 0.02 * R, 0.62 * R, 0.52 * R);
      g10.fillEllipse(fx + 0.40 * R, fy - 0.06 * R, 0.48 * R, 0.48 * R);
      // веки: тёмные полоски над глазами
      g10.fillStyle(0x5a4232, 0.30);
      g10.fillRoundedRect(fx + -0.10 * R, fy - 0.30 * R, 0.62 * R, 0.14 * R, 0.5);
      g10.fillRoundedRect(fx + 0.36 * R, fy - 0.28 * R, 0.42 * R, 0.15 * R, 0.5);
      // тень под носом и подбородком
      g10.fillStyle(0x000000, 0.10);
      g10.fillEllipse(fx + 0.84 * R, fy + 0.34 * R, 0.28 * R, 0.16 * R);
      g10.fillEllipse(fx + 0.42 * R, fy + 0.76 * R, 0.9 * R, 0.26 * R);
      // скула-блик спереди
      g10.fillStyle(0xffffff, 0.10);
      g10.fillEllipse(fx + 0.55 * R, fy + 0.05 * R, 0.30 * R, 0.24 * R);
      // прядь волос на затылке (выглядывает из-под убора)
      g10.fillStyle(0x3a2a1c, 0.55);
      g10.fillEllipse(fx - 0.68 * R, fy - 0.26 * R, 0.55 * R, 0.85 * R);
      g10.generateTexture('__geo_face_ov', W, H);
      g10.destroy();
    }
    if (!tm.exists('__geo_thigh')) {
      // Бедро-штанина (деним). Верх = таз (карман), низ = колено.
      const g7 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W7 = 16, H7 = 28;
      g7.fillStyle(0x2e4f8f, 1);
      g7.fillRoundedRect(1, 0, 14, 28, 5);
      // боковая тень и блик
      g7.fillStyle(0x274579, 1);
      g7.fillRoundedRect(1, 0, 4, 28, 3);
      g7.fillStyle(0x3f66a8, 0.6);
      g7.fillRoundedRect(7, 2, 4, 22, 2);
            // карман
      g7.lineStyle(1.5, 0x1e3a6e, 1);
      g7.strokeRect(8, 3, 6, 7);
      // ДЕТАЛИ: двойная строчка по боковому шву и потёртость у кармана
      g7.lineStyle(0.8, 0x8fa3c8, 1);
      g7.lineBetween(6.5, 2, 6.5, 24); // левая строчка
      g7.lineBetween(7.5, 2, 7.5, 24); // вторая
      g7.lineStyle(0.8, 0x9db4d8, 1);
      g7.lineBetween(9, 9, 13, 9); // светлая складка у кармана

      // колено темнее
      g7.fillStyle(0x274579, 1);
      g7.fillRoundedRect(1, 22, 14, 6, 3);
      g7.lineStyle(1, 0x1c2438, 1);
      g7.strokeRoundedRect(1, 0, 14, 28, 5);
      g7.generateTexture('__geo_thigh', W7, H7);
      g7.destroy();
    }
    if (!tm.exists('__geo_shin')) {
      // Икра-штанина. Верх = колено, низ = манжета над кедом.
      const g8 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W8 = 14, H8 = 26;
      g8.fillStyle(0x2b4c86, 1);
      g8.fillRoundedRect(1, 0, 12, 26, 5);
      g8.fillStyle(0x3f66a8, 0.5);
      g8.fillRoundedRect(5, 2, 4, 16, 2);
      // манжета (подворот) светлее
      g8.fillStyle(0x4f70a8, 1);
      g8.fillRoundedRect(1, 20, 12, 6, 2);
      g8.lineStyle(1, 0xd5dbe7, 1);
      g8.lineBetween(2, 22.5, 12, 22.5);
      // ДЕТАЛИ: двойная строчка по шву и пятна потёртости на колене
      g8.lineStyle(0.8, 0x8fa3c8, 1);
      g8.lineBetween(2.5, 1, 2.5, 20); // боковой шов
      g8.fillStyle(0x1c2438, 0.35);
      g8.fillCircle(6, 4, 0.9); // потёртость на колене
      g8.fillCircle(9, 5.5, 0.7); // вторая
      g8.lineStyle(1, 0x1c2438, 1);
      g8.strokeRoundedRect(1, 0, 12, 26, 5);
      g8.generateTexture('__geo_shin', W8, H8);
      g8.destroy();
    }
  } catch (e) { /* без гео-текстур — фолбэк BootScene */ }
}

// Уборы и обувь из магазина — рисуются кодом (вместо PNG) под ТЕМИ ЖЕ
// ключами, поэтому магазин/инвентарь работают без изменений.
// Уборы: посадка низом на макушку (origin 0.5/1), кроме балаклавы —
// она сидит по центру головы (там же глазницы). Обувь: 22x13 как кед.
export function bakeOneGear(player, tm, make, key, w, h, draw) {
  try {
    if (tm.exists(key)) tm.remove(key);
    const g = make.graphics({ x: 0, y: 0, add: false });
    draw(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  } catch (e) { /* без вещи — как было */ }
}

export function bakeGear(player, tm, make) {
  // Флаг — только после успеха: при сбое следующий персонаж допечёт.
  // (Повтор безопасен: каждый ключ печётся remove+create заново.)
  if (GEO_GEAR_BAKED) return;
  const G = (key, w, h, draw) => bakeOneGear(player, tm, make, key, w, h, draw);
  // --- форменные уборы (только сетовые; вне-сетевые удалены из игры)
  G('военный_шлем', 32, 16, (g) => {
    g.fillStyle(0x5a6234, 1);
    g.fillEllipse(16, 7, 26, 13); // купол
    g.fillRoundedRect(1, 9, 30, 4, 2); // поля
    g.fillStyle(0x707a40, 1);
    g.fillEllipse(13, 5, 12, 7);
    g.lineStyle(1.5, 0x2e3319, 1);
    g.strokeEllipse(16, 7, 26, 13);
  });
  G('камуфляжный_шлем', 32, 16, (g) => {
    g.fillStyle(0x5a6234, 1);
    g.fillEllipse(16, 7, 26, 13);
    g.fillRoundedRect(1, 9, 30, 4, 2);
    g.fillStyle(0x6b4a2a, 1); // пятна
    g.fillCircle(10, 6, 3);
    g.fillCircle(22, 8, 2.5);
    g.fillStyle(0x8a7a4d, 1);
    g.fillCircle(16, 4, 2.5);
    g.lineStyle(1.5, 0x2e3319, 1);
    g.strokeEllipse(16, 7, 26, 13);
  });
  // --- обувь 22x13, как кед (замена дроп-ин)
  G('полуберцы', 22, 13, (g) => {
    g.fillStyle(0x6b4423, 1);
    g.fillRoundedRect(1, 1, 20, 9, 4);
    g.fillStyle(0x8a5f30, 1);
    g.fillRoundedRect(14, 3, 7, 7, 3);
    g.lineStyle(1.5, 0xe8edf5, 1);
    g.lineBetween(10, 3, 12, 7);
    g.lineBetween(12.5, 3, 14.5, 7);
    g.fillStyle(0x3a3f52, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1.5, 0x241408, 1);
    g.strokeRoundedRect(1, 1, 20, 9, 4);
  });
  G('ботинки_усиленные', 22, 13, (g) => {
    g.fillStyle(0x2c2c34, 1);
    g.fillRoundedRect(1, 0, 20, 10, 3); // высокое голенище
    g.fillStyle(0x9aa3b5, 1);
    g.fillRoundedRect(14, 4, 7, 6, 2); // стальной нос
    g.fillStyle(0xd8b400, 1);
    g.fillRect(6, 2, 2, 6); // пряжка
    g.fillStyle(0x17171d, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1, 0x9aa3b5, 1);
    g.lineBetween(1, 10.5, 21, 10.5);
    g.lineStyle(1.5, 0x000000, 1);
    g.strokeRoundedRect(1, 0, 20, 10, 3);
  });
  // --- торсы 24x36 в ПРОФИЛЬ вправо (как __geo_torso: тот же силуэт —
  // спина слева, грудь вперёд, один рукав спереди; влево зеркалит flipX).
  // Отличается только раскраска. Анфас/3-4 в игре с видом сбоку не годятся.
  G('торс_тельняшка', 24, 36, (g) => {
    g.fillStyle(0xd4d9e4, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4); // спина
    g.fillStyle(0xf2f4f8, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7); // грудь
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(14, 8, 7, 14, 3); // выступ вперёд
    g.fillStyle(0x2e4a7a, 1); // полосы
    [10, 15, 20, 25].forEach(y => g.fillRect(8, y, 12, 2));
    g.fillStyle(0xf2f4f8, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4); // рукав
    g.fillStyle(0x2e4a7a, 1);
    g.fillRect(12, 12, 9, 2);
    g.lineStyle(2, 0x8a93a3, 1);
    g.lineBetween(9, 4, 15, 4); // ворот сбоку
    g.fillStyle(0x8a93a3, 1);
    g.fillCircle(12, 6, 1);
    g.lineStyle(1, 0x9aa3b5, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0xe6ebf2, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x3a3f52, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0xc8cfdb, 1);
    g.fillRect(10, 31, 4, 4);
  });
  G('торс_разгрузка', 24, 36, (g) => {
    g.fillStyle(0x777753, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0x8a8a6a, 1); // рубаха хаки
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0x5a6234, 1); // бронежилет
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0x4a5228, 1);
    g.fillRect(14, 13, 7, 2); // стропы
    g.fillRect(14, 18, 7, 2);
    g.fillStyle(0x6b7a40, 1); // подсумок
    g.fillRoundedRect(15, 21, 5, 4, 1);
    g.fillStyle(0x8a8a6a, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x777753, 1);
    g.fillRect(12, 12, 9, 3);
    g.lineStyle(2, 0x2e3319, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x2e3319, 1);
    g.fillCircle(12, 6, 1);
    g.lineStyle(1, 0x6b7048, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0xe6ebf2, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x3a3f52, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0xc8cfdb, 1);
    g.fillRect(10, 31, 4, 4);
  });
  G('торс_камуфляж', 24, 36, (g) => {
    g.fillStyle(0xa89468, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0xc2b280, 1); // песок
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0xd0bd8a, 1);
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0x5a6234, 1); // пятна
    g.fillEllipse(16, 13, 7, 6);
    g.fillStyle(0x6b4a2a, 1);
    g.fillEllipse(13, 21, 5, 4);
    g.fillStyle(0xc2b280, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x5a6234, 1);
    g.fillEllipse(16, 8, 5, 3);
    g.lineStyle(2, 0x8a93a3, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x8a93a3, 1);
    g.fillCircle(12, 6, 1);
    g.lineStyle(1, 0x9aa3b5, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0xe6ebf2, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x3a3f52, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0xc8cfdb, 1);
    g.fillRect(10, 31, 4, 4);
  });
  // --- штаны: бедро 16x28 + икра 14x26, как geo (замена дроп-ин)
  const _pantsPair = (id, thighFn, shinFn, icon) => {
    G(id + '_up', 16, 28, thighFn);
    G(id + '_low', 14, 26, shinFn);
    // Иконка для инвентаря/кейсов/магазина 30x30: пояс + две штанины,
    // чтобы читалось как штаны, а не один овал бедра.
    const ic = icon || { base: 0x8a8f9a, dark: 0x5a5f6a, line: 0x22242c };
    G(id + '_icon', 30, 30, (g) => {
      g.fillStyle(ic.base, 1);
      g.fillRoundedRect(5, 2, 20, 7, 3); // пояс
      g.fillRoundedRect(6, 9, 8, 19, 3); // левая штанина
      g.fillRoundedRect(16, 9, 8, 19, 3); // правая штанина
      g.fillStyle(ic.dark, 1);
      g.fillRect(5, 6, 20, 2); // ремень
      g.fillRect(8, 11, 2, 15);
      g.fillRect(20, 11, 2, 15);
      g.lineStyle(1.5, ic.line, 1);
      g.strokeRoundedRect(5, 2, 20, 7, 3);
      g.strokeRoundedRect(6, 9, 8, 19, 3);
      g.strokeRoundedRect(16, 9, 8, 19, 3);
    });
  };
  _pantsPair('штаны_камуфляж', (g) => {
    g.fillStyle(0xc2b280, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0x5a6234, 1);
    g.fillCircle(5, 8, 3);
    g.fillCircle(11, 18, 3.5);
    g.fillStyle(0x6b4a2a, 1);
    g.fillCircle(11, 5, 2.5);
    g.fillStyle(0x274579, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x1c2438, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0xc2b280, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0x5a6234, 1);
    g.fillCircle(5, 8, 2.5);
    g.fillStyle(0x6b4a2a, 1);
    g.fillCircle(9, 16, 2);
    g.fillStyle(0x4f70a8, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x1c2438, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0xc2b280, dark: 0x5a6234, line: 0x1c2438 });
  _pantsPair('штаны_чёрные', (g) => {
    g.fillStyle(0x23232b, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0x3a3a46, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2); // блик
    g.lineStyle(1.5, 0x1e3a6e, 1);
    g.strokeRect(8, 3, 6, 7); // карман
    g.fillStyle(0x17171d, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x000000, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x23232b, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0x3a3a46, 0.8);
    g.fillRoundedRect(5, 2, 4, 16, 2);
    g.fillStyle(0x17171d, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x000000, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  });
  // --- берцы камуфляжные 22x13 под сет
  G('берцы_камуфляж', 22, 13, (g) => {
    g.fillStyle(0xc2b280, 1);
    g.fillRoundedRect(1, 1, 20, 9, 4);
    g.fillStyle(0x5a6234, 1);
    g.fillCircle(7, 5, 2.5);
    g.fillCircle(15, 6, 2);
    g.fillStyle(0x6b4a2a, 1);
    g.fillCircle(11, 4, 1.8);
    g.lineStyle(1.5, 0x3c424e, 1);
    g.lineBetween(10, 2, 12, 8);
    g.lineBetween(13, 2, 15, 8);
    g.fillStyle(0x3a3f52, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1.5, 0x2e3319, 1);
    g.strokeRoundedRect(1, 1, 20, 9, 4);
  });
  // --- бескозырка моряка 30x14: белый верх, чёрный околыш, ленточки
  G('бескозырка', 30, 14, (g) => {
    g.fillStyle(0xf2f4f8, 1);
    g.fillEllipse(13, 6, 24, 10); // белый верх
    g.fillStyle(0x14141c, 1);
    g.fillRoundedRect(2, 8, 22, 5, 2); // околыш
    g.fillStyle(0xd8b400, 1);
    g.fillRect(11, 9, 4, 3); // кокарда-якорь
    g.fillStyle(0x14141c, 1);
    g.fillRoundedRect(0, 9, 4, 5, 1); // ленточки сзади
    g.fillRoundedRect(3, 10, 3, 4, 1);
    g.lineStyle(1.5, 0x000000, 1);
    g.strokeEllipse(13, 6, 24, 10);
  }, { base: 0x23232b, dark: 0x3a3a46, line: 0x000000 });
  // --- белые штаны моряка
  _pantsPair('штаны_белые', (g) => {
    g.fillStyle(0xe8ecf2, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2); // блик
    g.lineStyle(1.5, 0x1e3a6e, 1);
    g.strokeRect(8, 3, 6, 7); // карман
    g.fillStyle(0x1c2a52, 1); // синяя манжета
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x0c142e, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0xe8ecf2, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0xffffff, 0.8);
    g.fillRoundedRect(5, 2, 4, 16, 2);
    g.fillStyle(0x1c2a52, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x0c142e, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0xe8ecf2, dark: 0xb9c2d4, line: 0x0c142e });
  // --- Ночной охотник: тактический шлем с двухтрубным ПНВ 30x20.
  // ПРОФИЛЬ (как у персонажа: +x — сторона взгляда). Купол смещён
  // назад, передняя маска-«клюв» посадки, тубусы ПНВ торчат вперёд:
  // виден передний тубус, за ним ступенька второго, зелёная линза
  // с торца тубуса (а не анфас — раньше ПНВ смотрел «в монитор»).
  G('маска_ночная', 30, 20, (g) => {
    g.fillStyle(0x2b2f3a, 1);
    g.fillEllipse(12, 8.5, 24, 12); // купол (смещён назад)
    g.fillRoundedRect(16, 4, 10, 10, 3); // передняя маска (лоб/клюв)
    g.fillStyle(0x3d4356, 1);
    g.fillEllipse(9, 5.5, 10, 4); // блик по куполу
    g.fillStyle(0x1e222c, 1);
    g.fillRoundedRect(1, 11.5, 26, 3, 1); // кант-полоса по низу
    g.fillStyle(0x171a22, 1);
    g.fillRect(1, 6, 3, 4); // задние рельсы
    g.fillRoundedRect(19, 6, 7, 5, 1); // площадка ПНВ на лбу
    g.fillStyle(0x14161d, 1);
    g.fillRoundedRect(20.5, 11, 3.5, 5, 1); // дальний тубус (ступенька)
    g.fillRoundedRect(22, 10, 8, 7, 2); // передний тубус (в профиль)
    g.fillStyle(0x3d4356, 1);
    g.fillRect(22, 10, 8, 1); // верхняя кромка тубуса
    g.fillStyle(0x39ff6a, 1); // линза с торца
    g.fillEllipse(29, 13.5, 2.6, 4.6);
    g.fillStyle(0x0a3a18, 1);
    g.fillEllipse(29, 13.5, 1.2, 2.6);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(28.7, 12.2, 0.7); // блик линзы
    g.lineStyle(1.5, 0x0c0e14, 1);
    g.strokeEllipse(12, 8.5, 24, 12);
    g.strokeRoundedRect(22, 10, 8, 7, 2);
  });
  // --- Офицер: парадная фуражка 30x18
  // --- Офицер (ЭПИЧЕСКИЙ): пурпурный околыш, золотой кант и кокарда.
  G('фуражка_парадная', 30, 18, (g) => {
    g.fillStyle(0xf2f4f8, 1);
    g.fillRoundedRect(7, 0, 15, 10, 2); // белый верх
    g.fillStyle(0xd8b400, 1); // золотой столбик на правом торце тульи
    g.fillRect(20.5, 1, 1.4, 8);
    g.fillStyle(0x7a3ad0, 1); // пурпурный околыш
    g.fillRect(7, 8, 15, 4);
    g.fillStyle(0xd8b400, 1); // золото по верху околыша
    g.fillRect(7, 8, 15, 1);
    g.fillStyle(0x101014, 1);
    g.fillRoundedRect(15, 10, 14, 4, 2); // козырёк
    g.fillStyle(0xd8b400, 1); // золотой кант козырька
    g.fillRect(15, 10, 14, 1);
    g.fillStyle(0xffd24a, 1);
    g.fillCircle(11, 6, 2.4); // кокарда крупнее
    g.fillStyle(0x7a3ad0, 1);
    g.fillCircle(11, 6, 1.1); // пурпурная сердцевина
    g.fillStyle(0xfff3c0, 1);
    g.fillCircle(10.4, 5.4, 0.5); // блик кокарды
    g.lineStyle(1.5, 0x000000, 1);
    g.strokeRoundedRect(7, 0, 15, 10, 2);
  });
  // --- Шериф: шляпа закона 34x18
  G('шляпа_закона', 34, 18, (g) => {
    g.fillStyle(0xe8dcc0, 1);
    g.fillEllipse(17, 12, 33, 7); // поля
    g.fillStyle(0xf4ecd8, 1);
    g.fillRoundedRect(10, 0, 14, 12, 3); // тулья
    g.fillStyle(0x6b5636, 1);
    g.fillRect(10, 8, 14, 3); // лента
    g.fillStyle(0xd8b400, 1);
    g.fillCircle(22, 9.5, 1.8); // звезда
    g.lineStyle(1.5, 0x8a7a5e, 1);
    g.strokeEllipse(17, 12, 33, 7);
  });
  // --- Ночные берцы 22x13
  G('берцы_ночные', 22, 13, (g) => {
    g.fillStyle(0x1c1c24, 1);
    g.fillRoundedRect(1, 0, 20, 10, 3);
    g.fillStyle(0x3a3a48, 1);
    g.fillRoundedRect(14, 4, 7, 6, 2); // нос
    g.lineStyle(1.5, 0x9aa3b5, 1);
    g.lineBetween(10, 2, 12, 8);
    g.lineBetween(12.5, 2, 14.5, 8);
    g.fillStyle(0x0e0e14, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1, 0x000000, 1);
    g.strokeRoundedRect(1, 0, 20, 10, 3);
  });
  // --- Офицерские туфли (ЭПИЧЕСКИЕ): лак, золотая пряжка/кант, пурпурный ремешок.
  G('туфли_офицера', 22, 13, (g) => {
    g.fillStyle(0x10101a, 1);
    g.fillRoundedRect(1, 3, 20, 7, 3);
    g.fillStyle(0x3a3a48, 1);
    g.fillRoundedRect(12, 4, 5, 3, 1); // блик лака
    g.fillStyle(0x7a3ad0, 1); // пурпурный ремешок
    g.fillRect(4, 4, 6, 1.2);
    g.fillStyle(0xd8b400, 1); // золотая пряжка
    g.fillRect(5, 3.4, 1.4, 2.8);
    g.fillStyle(0x05050a, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.fillStyle(0xd8b400, 1); // золотой кант подошвы
    g.fillRect(1, 9, 20, 0.7);
    g.lineStyle(1, 0x000000, 1);
    g.strokeRoundedRect(1, 3, 20, 7, 3);
  });
  // --- Ковбойские сапоги 22x13
  G('сапоги_шерифа', 22, 13, (g) => {
    g.fillStyle(0x6b4423, 1);
    g.fillRoundedRect(1, 0, 16, 10, 3); // голенище
    g.fillRoundedRect(12, 4, 9, 6, 2); // острый нос
    g.fillStyle(0x8a5f30, 1);
    g.fillRoundedRect(4, 2, 5, 6, 2);
    g.fillStyle(0xd8b400, 1);
    g.fillCircle(3, 7, 1.6); // шпора
    g.fillStyle(0x2c1c10, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1, 0x241408, 1);
    g.strokeRoundedRect(1, 0, 16, 10, 3);
  });
  // --- Ночной торс 24x36, профиль вправо
  G('торс_ночной', 24, 36, (g) => {
    g.fillStyle(0x1a1f2a, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0x2b3242, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0x39435a, 1);
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0x232a38, 1); // стропы
    g.fillRect(14, 13, 7, 2);
    g.fillRect(14, 18, 7, 2);
    g.fillStyle(0x39ff6a, 1); // светометка
    g.fillRect(17, 21, 3, 3);
    g.fillStyle(0x2b3242, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x1a1f2a, 1);
    g.fillRect(12, 12, 9, 3);
    g.lineStyle(2, 0x141821, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x141821, 1);
    g.fillCircle(12, 6, 1);
    g.lineStyle(1, 0x161b26, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0x232a38, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x10141c, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0x39435a, 1);
    g.fillRect(10, 31, 4, 4);
  });
  // --- Китель офицера 24x36 (ЭПИЧЕСКИЙ): тёмно-синий мундир, золотая
  // выпушка и пуговицы, пурпурные петлица и эполет.
  G('китель_офицера', 24, 36, (g) => {
    g.fillStyle(0x232a4a, 1); // тёмно-синяя спина
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0x2e3a5e, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0x3a4a72, 1); // мундирная пластина на груди
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0xd8b400, 1); // золотая выпушка сверху и снизу пластины
    g.fillRect(14, 8, 7, 1);
    g.fillRect(14, 21, 7, 1);
    g.fillStyle(0xffd24a, 1); // три крупных пуговицы с бликом
    g.fillCircle(17, 12, 1.4);
    g.fillCircle(17, 16, 1.4);
    g.fillCircle(17, 20, 1.4);
    g.fillStyle(0xfff3c0, 1);
    g.fillCircle(16.6, 11.6, 0.4);
    g.fillCircle(16.6, 15.6, 0.4);
    g.fillCircle(16.6, 19.6, 0.4);
    g.fillStyle(0x7a3ad0, 1); // пурпурная петлица с золотой жилой
    g.fillRect(14, 4, 4, 3);
    g.fillStyle(0xd8b400, 1);
    g.fillRect(14, 4, 4, 0.8);
    g.fillStyle(0x2e3a5e, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x7a3ad0, 1); // пурпурный эполет на муфте
    g.fillRect(12, 5, 9, 1.4);
    g.fillStyle(0x232a4a, 1);
    g.fillRect(12, 12, 9, 3);
    g.fillStyle(0xd8b400, 1); // золото на планке
    g.fillRect(12, 12.8, 9, 0.8);
    g.fillStyle(0xffd24a, 1);
    g.fillCircle(12, 6, 1.2); // пуговица на вороте
    g.lineStyle(2, 0x141828, 1);
    g.lineBetween(9, 4, 15, 4);
    g.lineStyle(1, 0x232a4a, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0x232a4a, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x141828, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0x3a4a72, 1);
    g.fillRect(10, 31, 4, 4);
    g.fillStyle(0xffd24a, 1); // золотая шпилька на стыке
    g.fillRect(11.5, 31.5, 1, 3);
  });
  // --- Куртка шерифа 24x36, профиль вправо
  G('куртка_шерифа', 24, 36, (g) => {
    g.fillStyle(0x7d5f3a, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0xa8845c, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0xbd9a6c, 1);
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0x6b4f30, 1); // планка
    g.fillRect(17, 8, 2, 14);
    g.fillRoundedRect(14, 19, 5, 4, 1); // карман
    g.fillStyle(0xd8b400, 1); // звезда
    g.fillCircle(15, 12, 1.6);
    g.fillStyle(0xa8845c, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x7d5f3a, 1);
    g.fillRect(12, 12, 9, 3);
    g.lineStyle(2, 0x4a3822, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x4a3822, 1);
    g.fillCircle(12, 6, 1);
    g.lineStyle(1, 0x7d5f3a, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0x6b4f30, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x3a2c1a, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0xc8a06a, 1);
    g.fillRect(10, 31, 4, 4);
  });
  // --- Ночные штаны: бедро 16x28 + икра 14x26
  _pantsPair('штаны_ночные', (g) => {
    g.fillStyle(0x33333d, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0x45454f, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2);
    g.fillStyle(0x1c1c22, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x000000, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x33333d, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0x45454f, 0.8);
    g.fillRoundedRect(5, 2, 4, 16, 2);
    g.fillStyle(0x1c1c22, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x000000, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0x33333d, dark: 0x45454f, line: 0x000000 });
  // --- Галифе офицера (ЭПИЧЕСКИЕ): синий сукон, золотой лампас с бликом.
  _pantsPair('галифе_офицера', (g) => {
    g.fillStyle(0x232a4a, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0xd8b400, 1); // золотой лампас
    g.fillRect(2, 2, 2, 20);
    g.fillStyle(0xffd24a, 1); // блик лампаса
    g.fillRect(2, 2, 0.7, 20);
    g.fillStyle(0x2e3a5e, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2);
    g.fillStyle(0x141828, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.fillStyle(0xd8b400, 1); // золото по манжете
    g.fillRect(2, 23.5, 12, 0.9);
    g.lineStyle(1, 0x0c0e1c, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x232a4a, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0xd8b400, 1);
    g.fillRect(2, 2, 2, 16);
    g.fillStyle(0xffd24a, 1);
    g.fillRect(2, 2, 0.7, 16);
    g.fillStyle(0x141828, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.fillStyle(0xd8b400, 1);
    g.fillRect(2, 21.4, 10, 0.9);
    g.lineStyle(1, 0x0c0e1c, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0x232a4a, dark: 0xd8b400, line: 0x0c0e1c });
  // --- Джинсы шерифа
  _pantsPair('джинсы_шерифа', (g) => {
    g.fillStyle(0x3a5a8c, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0x4f70a8, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2);
    g.lineStyle(1, 0xc8a040, 1);
    g.strokeRect(8, 3, 6, 7); // карман
    g.fillStyle(0x2c4468, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x1c2c48, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x3a5a8c, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0x4f70a8, 0.8);
    g.fillRoundedRect(5, 2, 4, 16, 2);
    g.fillStyle(0x2c4468, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x1c2c48, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0x3a5a8c, dark: 0x4f70a8, line: 0x1c2c48 });
  // ===== 5 НОВЫХ СЕТОВ (профиль везде: +x — сторона взгляда) =====
  // Сет «Десант»: сине-серый берет с хвостом-«фальдой», тельняшечный камуф.
  G('берет_десанта', 30, 14, (g) => {
    g.fillStyle(0x2f5fa8, 1);
    g.fillEllipse(12, 6, 22, 10); // купол
    g.fillStyle(0x2a5494, 1);
    g.fillRoundedRect(21, 4, 8, 10, 3); // хвост-фальда справа (затылочный)
    g.fillStyle(0x4a7cc0, 1);
    g.fillEllipse(9, 4, 9, 4); // блик
    g.fillStyle(0x93b3e0, 1);
    g.fillCircle(23, 13, 1.2); // пуговка на фальде
    g.lineStyle(1.5, 0x1e3c6e, 1);
    g.strokeEllipse(12, 6, 22, 10);
  });
  G('торс_десанта', 24, 36, (g) => {
    g.fillStyle(0x8d97a6, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0xb9c4d2, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0xd7dee6, 1);
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0x30599b, 1); // голубые полосы
    [10, 15, 20, 25].forEach(y => g.fillRect(8, y, 12, 2));
    g.fillStyle(0xb9c4d2, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x30599b, 1);
    g.fillRect(12, 12, 9, 2);
    g.lineStyle(2, 0x5a6572, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x5a6572, 1);
    g.fillCircle(12, 6, 1);
    g.fillStyle(0xe4e9f0, 1);
    g.fillRoundedRect(15, 12, 6, 6, 1.5);
    g.lineStyle(1, 0x5a6572, 1);
    g.strokeRoundedRect(15, 12, 6, 6, 1.5);
    g.lineStyle(1, 0x9aa3b5, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0x9aa4b2, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x242b3a, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0x4a6ab0, 1);
    g.fillRect(10, 31, 4, 4);
  });
  _pantsPair('штаны_десанта', (g) => {
    g.fillStyle(0x9aa4b2, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0xb4bdca, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2);
    g.lineStyle(1, 0x4a5563, 1);
    g.strokeRect(8, 3, 6, 7);
    g.fillStyle(0x30599b, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x21283a, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x9aa4b2, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0xb4bdca, 0.8);
    g.fillRoundedRect(5, 2, 4, 16, 2);
    g.fillStyle(0x30599b, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x21283a, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0x9aa4b2, dark: 0x30599b, line: 0x21283a });
  G('берцы_десанта', 22, 13, (g) => {
    g.fillStyle(0x3c4654, 1);
    g.fillRoundedRect(1, 1, 20, 9, 4);
    g.fillStyle(0x566273, 1);
    g.fillRoundedRect(14, 3, 7, 7, 3);
    g.lineStyle(1.5, 0xa8bdd4, 1);
    g.lineBetween(10, 3, 12, 7);
    g.lineBetween(12.5, 3, 14.5, 7);
    g.fillStyle(0x8fa3c0, 1);
    g.fillCircle(10, 2.5, 0.8);
    g.fillCircle(12.5, 2.5, 0.8);
    g.fillStyle(0x222835, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1.5, 0x1a2030, 1);
    g.strokeRoundedRect(1, 1, 20, 9, 4);
  });
  // Сет «Стрелок»: оливковый берет с накидкой, потёртый камуф, кевлар.
  G('берет_стрелка', 30, 14, (g) => {
    g.fillStyle(0x5c6b36, 1);
    g.fillEllipse(12, 6, 22, 10);
    g.fillStyle(0x4c5a2c, 1);
    g.fillRoundedRect(21, 4, 8, 10, 3);
    g.fillStyle(0x71813f, 1);
    g.fillEllipse(9, 4, 9, 4);
    g.fillStyle(0xb9c39a, 1);
    g.fillCircle(23, 13, 1.2);
    g.lineStyle(1.5, 0x35401e, 1);
    g.strokeEllipse(12, 6, 22, 10);
  });
  G('торс_стрелка', 24, 36, (g) => {
    g.fillStyle(0x4a5430, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0x667448, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0x767f4e, 1);
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0x39431f, 1); // потёртости
    g.fillEllipse(11, 18, 6, 4);
    g.fillEllipse(13, 10, 5, 3);
    g.fillStyle(0x667448, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x4a5430, 1);
    g.fillRect(12, 12, 9, 3);
    g.lineStyle(2, 0x3a4224, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x3a4224, 1);
    g.fillCircle(12, 6, 1);
    g.fillStyle(0x2b3320, 1);
    g.fillRoundedRect(15, 12, 6, 6, 1.5);
    g.lineStyle(1, 0x39431f, 1);
    g.strokeRoundedRect(15, 12, 6, 6, 1.5);
    g.lineStyle(1.5, 0x39431f, 1);
    g.lineBetween(12, 5, 19, 7);
    g.lineBetween(12, 8, 19, 10);
    g.lineStyle(1, 0x55603c, 1);
    g.lineBetween(8, 6, 8, 28);
    g.lineStyle(0.8, 0x39431f, 1);
    g.lineBetween(4, 27, 20, 27);
    g.fillStyle(0x4a5430, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x242b18, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0x5c6b36, 1);
    g.fillRect(10, 31, 4, 4);
  });
  _pantsPair('штаны_стрелка', (g) => {
    g.fillStyle(0x667448, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0x39431f, 1);
    g.fillCircle(5, 8, 3);
    g.fillCircle(11, 14, 3);
    g.fillStyle(0xb4bdca, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2);
    g.lineStyle(1, 0x39431f, 1);
    g.strokeRect(8, 3, 6, 7);
    g.fillStyle(0x2c3322, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x1c2316, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x667448, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0x39431f, 1);
    g.fillCircle(5, 8, 2.5);
    g.fillCircle(9, 15, 2);
    g.fillStyle(0xb4bdca, 0.8);
    g.fillRoundedRect(5, 2, 4, 16, 2);
    g.fillStyle(0x2c3322, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x1c2316, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0x667448, dark: 0x39431f, line: 0x1c2316 });
  G('боты_стрелка', 22, 13, (g) => {
    g.fillStyle(0x4c5838, 1);
    g.fillRoundedRect(1, 1, 20, 9, 4);
    g.fillStyle(0x6b7a4e, 1);
    g.fillRoundedRect(14, 3, 7, 7, 3);
    g.lineStyle(1.5, 0xcfd8b8, 1);
    g.lineBetween(10, 3, 12, 7);
    g.lineBetween(12.5, 3, 14.5, 7);
    g.fillStyle(0x20240f, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1.5, 0x141809, 1);
    g.strokeRoundedRect(1, 1, 20, 9, 4);
  });
  // Сет «Сапёр» (ЛЕГЕНДАРНЫЙ): тёмная сталь, щиток с янтарным стеклом,
  // золотая окантовка — редкость читается с первого взгляда в бою.
  G('маска_сапёра', 32, 20, (g) => {
    g.fillStyle(0x2a2e3a, 1);
    g.fillEllipse(14, 9, 28, 15); // купол — тёмная сталь
    g.fillStyle(0x465064, 1);
    g.fillEllipse(10, 5, 12, 5); // стальной блик
    g.fillStyle(0xd8b400, 1); // золотой ошейник-окантовка
    g.fillRoundedRect(1, 12, 24, 3, 1);
    g.fillStyle(0xffa63a, 1); // янтарная полоска света в окантовке
    g.fillRect(1, 13.2, 24, 1);
    g.fillStyle(0x8a7450, 1);
    g.fillRect(1, 7, 3, 4); // задние рельсы
    g.fillStyle(0xd8b400, 1); // рычаг щитка — золото
    g.fillRoundedRect(21, 4, 5, 3, 1);
    g.fillStyle(0x5c4a18, 1); // тёмная рама щитка
    g.fillRoundedRect(22, 6, 10, 10, 2);
    g.fillStyle(0xd8b400, 1);
    g.fillRect(23, 7, 8, 1.2); // золото по верху щитка
    g.fillStyle(0x3a2a10, 1);
    g.fillRoundedRect(23, 8.5, 8, 6, 1); // янтарное стекло
    g.fillStyle(0xffb44a, 0.9);
    g.fillRect(24, 9.5, 5, 2); // светящаяся жила стекла
    g.fillStyle(0xff8a1a, 0.8);
    g.fillRect(25, 11.5, 4, 1);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(24, 8.8, 1.2, 4.5); // блик стекла
    // золотые заклёпки по куполу
    g.fillStyle(0xffd24a, 1);
    g.fillCircle(6, 8, 1);
    g.fillCircle(10, 11.5, 0.9);
    g.fillCircle(16, 12, 0.9);
    g.lineStyle(1.5, 0x14181a, 1);
    g.strokeEllipse(14, 9, 28, 15);
    g.strokeRoundedRect(22, 6, 10, 10, 2);
  });
  G('торс_сапёра', 24, 36, (g) => {
    g.fillStyle(0x2e323c, 1); // тёмная сталь: спина
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0x3d4350, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0x565e70, 1); // стальная кираса-пластина
    g.fillRoundedRect(14, 8, 7, 14, 3);
    g.fillStyle(0xd8b400, 1); // золотые шевроны по пластине
    g.fillRect(14, 11, 7, 1.2);
    g.fillRect(14, 15, 7, 1.2);
    g.fillRect(14, 19, 7, 1.2);
    g.fillStyle(0xffa63a, 1); // янтарный индикатор на пластине
    g.fillRect(19, 9.5, 1.5, 1.5);
    g.fillStyle(0x3d4350, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0x2e323c, 1);
    g.fillRect(12, 12, 9, 3);
    g.fillStyle(0xffb44a, 0.9); // светящаяся полоска на муфте
    g.fillRect(13, 13.2, 7, 1);
    g.lineStyle(2, 0x1b1e26, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x1b1e26, 1);
    g.fillCircle(12, 6, 1);
    g.fillStyle(0xd8b400, 1); // золото по воротнику-стойке
    g.fillRect(9, 4.5, 6, 0.8);
    g.lineStyle(1, 0x333844, 1);
    g.lineBetween(8, 6, 8, 28);
    g.lineBetween(12, 5, 19, 7);
    g.lineBetween(12, 8, 19, 10);
    g.fillStyle(0x2e323c, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x22252e, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0x565e70, 1);
    g.fillRect(10, 31, 4, 4);
    g.fillStyle(0xffb44a, 0.85); // янтарная светометка на стыке
    g.fillRect(9.5, 31.5, 0.8, 3);
  });
  _pantsPair('штаны_сапёра', (g) => {
    g.fillStyle(0x333845, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0xd8b400, 1); // золотой клапан карго-кармана
    g.fillRect(8, 10, 6, 2);
    g.lineStyle(1, 0x1b1e26, 1);
    g.strokeRect(8, 10, 6, 8);
    g.fillStyle(0x8a7450, 1); // строп-ремень с золотой пряжкой
    g.fillRoundedRect(7, 2, 4, 6, 2);
    g.fillStyle(0xffd24a, 1);
    g.fillRect(7, 4.4, 4, 1);
    g.fillStyle(0x22252e, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.fillStyle(0xffa63a, 0.9); // янтарная манжета
    g.fillRect(2, 24, 12, 1);
    g.lineStyle(1, 0x14171e, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x333845, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0x565e70, 1); // стальной наколенник
    g.fillRoundedRect(3, 2, 8, 8, 3);
    g.fillStyle(0xd8b400, 1); // золото по наколеннику
    g.fillRect(3, 5.5, 8, 1);
    g.fillStyle(0x22252e, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.fillStyle(0xffa63a, 0.85);
    g.fillRect(2, 22, 10, 1);
    g.lineStyle(1, 0x14171e, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0x333845, dark: 0xd8b400, line: 0x14171e });
  G('сапоги_сапёра', 22, 13, (g) => {
    g.fillStyle(0x1d2129, 1);
    g.fillRoundedRect(1, 0, 20, 10, 3);
    g.fillStyle(0x2b2f39, 1);
    g.fillRoundedRect(14, 4, 7, 6, 2);
    g.fillStyle(0x8a7450, 1); // ремень поперек голяшки
    g.fillRect(3, 3.5, 14, 1);
    g.fillStyle(0xd8b400, 1); // золотая пряжка
    g.fillRect(6, 2, 2.4, 5);
    g.lineStyle(1.5, 0x8f96aa, 1);
    g.lineBetween(10, 2, 12, 8);
    g.lineBetween(12.5, 2, 14.5, 8);
    g.fillStyle(0x0e1016, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1, 0xffa63a, 1); // янтарная подошва-светоотражатель
    g.lineBetween(1, 10.5, 21, 10.5);
    g.lineStyle(1.5, 0x14181a, 1);
    g.strokeRoundedRect(1, 0, 20, 10, 3);
  });
  // Сет «Пожарный»: красная каска с гребнем, жилет со светоотражателями.
  G('каска_пожарная', 32, 18, (g) => {
    g.fillStyle(0xb32424, 1);
    g.fillEllipse(15, 8, 28, 13); // купол
    g.fillStyle(0x8a1616, 1);
    g.fillRect(7, 2, 17, 3); // гребень сверху
    g.fillRoundedRect(1, 8, 7, 5, 2); // хвостовик сзади
    g.fillRoundedRect(19, 12, 12, 3, 1); // козырёк
    g.fillStyle(0xd65656, 1);
    g.fillEllipse(9, 4, 10, 4); // блик
    g.fillStyle(0xffd24a, 1);
    g.fillCircle(24, 8, 1.8); // эмблема
    g.lineStyle(1.5, 0x4a0c0c, 1);
    g.strokeEllipse(15, 8, 28, 13);
    g.strokeRoundedRect(19, 12, 12, 3, 1);
  });
  G('торс_пожарного', 24, 36, (g) => {
    g.fillStyle(0x1c2440, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0x2b355c, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0x515b7a, 1);
    g.fillRect(16, 8, 2, 14); // застёжка
    g.fillStyle(0xffd24a, 1); // светоотражатели
    g.fillRect(8, 14, 12, 3);
    g.fillRect(8, 21, 12, 2);
    g.fillStyle(0x2b355c, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0xffd24a, 1);
    g.fillRect(12, 11, 9, 2);
    g.fillStyle(0x1c2440, 1);
    g.fillRect(12, 12, 9, 2);
    g.lineStyle(2, 0x0f1426, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x0f1426, 1);
    g.fillCircle(12, 6, 1);
    g.lineStyle(1, 0x3a446b, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0x1c2440, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x10161f, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0x3a446b, 1);
    g.fillRect(10, 31, 4, 4);
  });
  _pantsPair('штаны_пожарные', (g) => {
    g.fillStyle(0x2b355c, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0xffd24a, 1);
    g.fillRect(1, 10, 14, 3);
    g.fillStyle(0x3a446b, 1);
    g.fillRoundedRect(7, 2, 4, 6, 2);
    g.fillStyle(0x10161f, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x0c101a, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0x2b355c, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0xffd24a, 1);
    g.fillRect(1, 8, 12, 3);
    g.fillStyle(0x10161f, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x0c101a, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0x2b355c, dark: 0xffd24a, line: 0x0c101a });
  G('боты_пожарные', 22, 13, (g) => {
    g.fillStyle(0x1c1c22, 1);
    g.fillRoundedRect(1, 0, 20, 10, 3);
    g.fillStyle(0x2e2e38, 1);
    g.fillRoundedRect(14, 4, 7, 6, 2);
    g.lineStyle(1.5, 0xc8ccd8, 1);
    g.lineBetween(10, 2, 12, 8);
    g.lineBetween(12.5, 2, 14.5, 8);
    g.fillStyle(0x0e0e12, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1, 0xffd24a, 1);
    g.lineBetween(1, 10.5, 21, 10.5);
    g.lineStyle(1.5, 0x000000, 1);
    g.strokeRoundedRect(1, 0, 20, 10, 3);
  });
  // Сет «Атлет»: белая бандана с узлом, олимпийка со знаковой полосой.
  G('бандана_атлета', 30, 14, (g) => {
    g.fillStyle(0xf2f4f8, 1);
    g.fillRoundedRect(2, 4, 27, 7, 3); // повязка
    g.fillStyle(0xd0342c, 1);
    g.fillRect(2, 6, 27, 2); // центральная полоса
    g.fillStyle(0xe4e8ef, 1);
    g.fillRoundedRect(0, 9, 7, 5, 2); // узел сзади
    g.lineStyle(1, 0x9aa3b5, 1);
    g.lineBetween(2, 9, 7, 12); // кончик узла
    g.lineStyle(1.5, 0x9aa3b5, 0.8);
    g.strokeRoundedRect(2, 4, 27, 7, 3);
  });
  G('торс_олимпийка', 24, 36, (g) => {
    g.fillStyle(0xdfe4ee, 1);
    g.fillRoundedRect(2, 4, 7, 27, 4);
    g.fillStyle(0xf8fafc, 1);
    g.fillRoundedRect(8, 3, 12, 28, 7);
    g.fillStyle(0xd0342c, 1);
    g.fillRect(6, 4, 3, 24); // боковая полоса
    g.fillStyle(0xd0342c, 1);
    g.fillCircle(17, 14, 2.5); // знак на груди
    g.fillStyle(0xffd24a, 1);
    g.fillCircle(17, 14, 1);
    g.fillStyle(0xf8fafc, 1);
    g.fillRoundedRect(12, 5, 9, 10, 4);
    g.fillStyle(0xd0342c, 1);
    g.fillRect(12, 11, 9, 2);
    g.fillStyle(0xf8fafc, 1);
    g.fillRect(12, 12, 9, 2);
    g.lineStyle(2, 0x9aa3b5, 1);
    g.lineBetween(9, 4, 15, 4);
    g.fillStyle(0x9aa3b5, 1);
    g.fillCircle(12, 6, 1);
    g.lineStyle(1, 0xa8b1c0, 1);
    g.lineBetween(8, 6, 8, 28);
    g.fillStyle(0xdfe4ee, 1);
    g.fillRect(4, 28, 16, 3);
    g.fillStyle(0x1c2438, 1);
    g.fillRect(4, 31, 16, 4);
    g.fillStyle(0xd0342c, 1);
    g.fillRect(10, 31, 4, 4);
  });
  _pantsPair('штаны_атлета', (g) => {
    g.fillStyle(0xf2f4f8, 1);
    g.fillRoundedRect(1, 0, 14, 28, 5);
    g.fillStyle(0xd0342c, 1);
    g.fillRect(1, 0, 3, 22); // боковая полоса
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(7, 2, 4, 22, 2);
    g.lineStyle(1, 0x9aa3b5, 1);
    g.strokeRect(8, 3, 6, 7);
    g.fillStyle(0x1c2438, 1);
    g.fillRoundedRect(1, 22, 14, 6, 3);
    g.lineStyle(1, 0x9aa3b5, 1);
    g.strokeRoundedRect(1, 0, 14, 28, 5);
  }, (g) => {
    g.fillStyle(0xf2f4f8, 1);
    g.fillRoundedRect(1, 0, 12, 26, 5);
    g.fillStyle(0xd0342c, 1);
    g.fillRect(1, 0, 3, 20);
    g.fillStyle(0xffffff, 0.8);
    g.fillRoundedRect(5, 2, 4, 16, 2);
    g.fillStyle(0x1c2438, 1);
    g.fillRoundedRect(1, 20, 12, 6, 2);
    g.lineStyle(1, 0x9aa3b5, 1);
    g.strokeRoundedRect(1, 0, 12, 26, 5);
  }, { base: 0xf2f4f8, dark: 0xd0342c, line: 0x9aa3b5 });
  G('кроссы_олимпийка', 22, 13, (g) => {
    g.fillStyle(0xf2f4f8, 1);
    g.fillRoundedRect(1, 1, 20, 9, 4);
    g.fillStyle(0xdfe4ee, 1);
    g.fillRoundedRect(1, 2, 5, 8, 2); // пятка
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(14, 3, 7, 7, 3); // носок
    g.fillStyle(0xd0342c, 1); // фирменные три полоски
    g.fillRect(7, 3, 1.2, 6);
    g.fillRect(9, 3.5, 1.2, 5.5);
    g.fillRect(11, 4, 1.2, 5);
    g.lineStyle(1.5, 0x9aa3b5, 1);
    g.lineBetween(13, 3, 15, 7);
    g.fillStyle(0x1c2438, 1);
    g.fillRoundedRect(0, 9, 22, 4, 2);
    g.lineStyle(1, 0xffffff, 1);
    g.lineBetween(1, 10.5, 21, 10.5);
    g.lineStyle(1.5, 0x9aa3b5, 1);
    g.strokeRoundedRect(1, 1, 20, 9, 4);
  });
  setGearBaked(true);
}
