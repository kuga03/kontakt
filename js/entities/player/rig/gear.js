

import { GEO_GEAR_BAKED, setGearBaked } from './config.js';
export function ensureGeoTextures(player, scene) {
  try {
    const tm = (scene || player.scene).textures;
    try {
      bakeGear(player, tm, (scene || player.scene).make);
    } catch (e2) {}
    if (!tm.exists('__geo_torso')) {
      // ПРОФИЛЬ (вид сбоку): анатомический силуэт бойца с объёмной светотенью,
      // грудной пластиной, воротником, лямкой, складками ткани и тактическим ремнём.
      // Палитра ахроматическая (под командный/пользовательский setTint), размер 24x36.
      const g = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W = 24, H = 36;
      // 1. Спина и поясница (глубокая тень сзади)
      g.fillStyle(0xb8c2d2, 1);
      g.fillRoundedRect(2, 4, 8, 25, 4);
      g.fillStyle(0xc9d2e0, 1);
      g.fillRoundedRect(4, 4, 7, 25, 3);
      // 2. Основной объём груди и живота (с анатомическим сужением к талии)
      g.fillStyle(0xe6ebf3, 1);
      g.fillRoundedRect(7, 3, 13, 26, 6);
      // Выступающая грудная клетка / пекторальная зона спереди
      g.fillStyle(0xf5f7fb, 1);
      g.fillRoundedRect(10, 5, 11, 15, 5);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(13, 6, 8, 11, 4);
      // Тень под грудной мышцей и складки на животе
      g.fillStyle(0xc5cfde, 1);
      g.fillRect(10, 19, 10, 1.5);
      g.fillRect(9, 23, 10, 1.2);
      g.fillRect(9, 26, 10, 1.2);
      // 3. Воротник-стойка с тенью горловины
      g.fillStyle(0x525c6e, 1);
      g.fillEllipse(12, 3.5, 8, 3);
      g.fillStyle(0xd5deeb, 1);
      g.fillRoundedRect(7, 2.5, 10, 3, 1.5);
      g.lineStyle(1, 0x7a8599, 1);
      g.strokeRoundedRect(7, 2.5, 10, 3, 1.5);
      // 4. Диагональная разгрузочная лямка с ячейками MOLLE и нагрудный карман
      g.lineStyle(2.2, 0x9aa4b8, 1);
      g.lineBetween(10, 4, 20, 10);
      g.lineStyle(1, 0x687387, 1);
      g.lineBetween(12, 5, 19, 9.5);
      g.fillStyle(0xdce3ee, 1);
      g.fillRoundedRect(14.5, 11, 6.5, 7, 1.5);
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(15, 11.5, 5.5, 2); // клапан кармана
      g.lineStyle(1, 0x7c879b, 1);
      g.strokeRoundedRect(14.5, 11, 6.5, 7, 1.5);
      g.lineBetween(14.5, 13.5, 21, 13.5);
      g.fillStyle(0x545f73, 1);
      g.fillCircle(17.8, 12.8, 0.9); // кнопка клапана
      // Боковой шов и центральная планка
      g.lineStyle(1, 0x8d97ab, 1);
      g.lineBetween(8, 6, 8, 28);
      g.lineStyle(1.2, 0xb0bac9, 1);
      g.lineBetween(12, 5, 12, 28);
      // 5. Плечо и дельтовидный рукав в профиль (с шевроном и манжетой)
      g.fillStyle(0xd0d8e6, 1);
      g.fillRoundedRect(10.5, 5, 9.5, 11, 4);
      g.fillStyle(0xf2f5fa, 1);
      g.fillRoundedRect(11.5, 5, 8, 9.5, 3.5);
      g.fillStyle(0xffffff, 0.85);
      g.fillEllipse(15.5, 8.5, 4.5, 5.5); // блик на дельте
      // Наплечный щиток-шеврон
      g.fillStyle(0xc2ccdc, 1);
      g.fillRoundedRect(13.5, 6.5, 4, 4.5, 1);
      g.lineStyle(0.8, 0x7a8599, 1);
      g.strokeRoundedRect(13.5, 6.5, 4, 4.5, 1);
      // Манжета рукава и складка сгиба
      g.fillStyle(0xbec8d8, 1);
      g.fillRect(11, 13, 9, 2.5);
      g.lineStyle(1, 0x6e788c, 1);
      g.strokeRoundedRect(10.5, 5, 9.5, 11, 4);
      // 6. Напуск рубахи и детальный тактический ремень с пряжкой и подсумком
      g.fillStyle(0xd8e0ec, 1);
      g.fillRoundedRect(3.5, 28, 16.5, 3, 1);
      g.lineStyle(0.8, 0x8d97ab, 1);
      g.lineBetween(4, 28.5, 19.5, 28.5);
      // Полотно ремня
      g.fillStyle(0x252b3b, 1);
      g.fillRoundedRect(3.5, 30.5, 16.5, 4.5, 1);
      g.fillStyle(0x3e465c, 1);
      g.fillRect(4, 31, 15.5, 1.2); // верхний кант ремня
      // Боковой мини-подсумок на поясе сзади
      g.fillStyle(0x32394d, 1);
      g.fillRoundedRect(4.5, 29.8, 4.5, 5.2, 1);
      g.lineStyle(0.8, 0x161a24, 1);
      g.strokeRoundedRect(4.5, 29.8, 4.5, 5.2, 1);
      // Шлёвки ремня
      g.fillStyle(0x161a24, 1);
      g.fillRect(9.5, 30.3, 1.4, 4.8);
      g.fillRect(16.5, 30.3, 1.4, 4.8);
      // Металлическая пряжка Cobra
      g.fillStyle(0xc8d2e0, 1);
      g.fillRoundedRect(11.5, 30.3, 4.5, 4.8, 1);
      g.fillStyle(0x252b3b, 1);
      g.fillRect(12.6, 31.3, 2.3, 2.8);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(11.8, 30.6, 3.8, 1);
      // 7. Чёткий внешний контур корпуса
      g.lineStyle(1.2, 0x1c2438, 0.95);
      g.strokeRoundedRect(2, 3.5, 19, 26.5, 5);
      g.generateTexture('__geo_torso', W, H);
      g.destroy();
    }
    // Кепки классов: объёмный 6-клинный купол, околыш, изогнутый козырёк с бликом,
    // люверсы вентиляции и детальная эмблема класса. Размер строго 30x14.
    const bakeCap = (key, dome, visor, button, deco) => {
      if (tm.exists(key)) return;
      const g2 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W2 = 30, H2 = 14;
      // Основной купол
      g2.fillStyle(dome, 1);
      g2.fillEllipse(W2 * 0.42, H2 * 0.44, W2 * 0.74, H2 * 0.82);
      // Затылочная тень и нижний околыш для 3D-объёма
      g2.fillStyle(0x000000, 0.24);
      g2.fillEllipse(W2 * 0.24, H2 * 0.48, W2 * 0.34, H2 * 0.68);
      g2.fillRoundedRect(W2 * 0.08, H2 * 0.56, W2 * 0.66, H2 * 0.22, 2);
      // Верхний блик купола
      g2.fillStyle(0xffffff, 0.18);
      g2.fillEllipse(W2 * 0.44, H2 * 0.24, W2 * 0.44, H2 * 0.32);
      // Клинья (швы тульи) и вентиляционные люверсы
      g2.lineStyle(0.9, 0x000000, 0.28);
      g2.lineBetween(W2 * 0.42, H2 * 0.05, W2 * 0.42, H2 * 0.72);
      g2.lineBetween(W2 * 0.42, H2 * 0.05, W2 * 0.22, H2 * 0.66);
      g2.lineBetween(W2 * 0.42, H2 * 0.05, W2 * 0.60, H2 * 0.62);
      g2.fillStyle(0x000000, 0.38);
      g2.fillCircle(W2 * 0.31, H2 * 0.26, 0.8);
      g2.fillCircle(W2 * 0.52, H2 * 0.26, 0.8);
      if (deco === 'band') {
        // Снайпер: тактическая стропа с ячейками под маскировку
        g2.fillStyle(visor, 1);
        g2.fillRoundedRect(W2 * 0.09, H2 * 0.36, W2 * 0.65, H2 * 0.24, 1.5);
        g2.fillStyle(button, 0.75);
        [0.16, 0.28, 0.40, 0.52, 0.64].forEach(f => {
          g2.fillRect(W2 * f, H2 * 0.38, 1.4, H2 * 0.20);
        });
      }
      if (deco === 'rivets') {
        // Танк: бронепластина на лбу и объёмные стальные заклёпки с бликами
        g2.fillStyle(visor, 0.9);
        g2.fillRoundedRect(W2 * 0.14, H2 * 0.24, W2 * 0.56, H2 * 0.32, 2);
        [
          [W2 * 0.22, H2 * 0.36],
          [W2 * 0.42, H2 * 0.28],
          [W2 * 0.60, H2 * 0.36]
        ].forEach(([rx, ry]) => {
          g2.fillStyle(0x1a1208, 0.7);
          g2.fillCircle(rx + 0.4, ry + 0.5, 1.7);
          g2.fillStyle(button, 1);
          g2.fillCircle(rx, ry, 1.5);
          g2.fillStyle(0xffffff, 0.8);
          g2.fillCircle(rx - 0.4, ry - 0.4, 0.5);
        });
      }
      if (deco === null) {
        // Штурмовик: тактическая велкро-панель спереди
        g2.fillStyle(visor, 0.85);
        g2.fillRoundedRect(W2 * 0.50, H2 * 0.26, W2 * 0.20, H2 * 0.26, 1);
        g2.lineStyle(0.8, button, 0.7);
        g2.strokeRoundedRect(W2 * 0.50, H2 * 0.26, W2 * 0.20, H2 * 0.26, 1);
      }
      // Изогнутый козырёк вперёд (вправо): нижняя тень + верх + блик
      g2.fillStyle(0x000000, 0.45);
      g2.fillRoundedRect(W2 * 0.54, H2 * 0.56, W2 * 0.44, H2 * 0.24, 2);
      g2.fillStyle(visor, 1);
      g2.fillRoundedRect(W2 * 0.54, H2 * 0.48, W2 * 0.44, H2 * 0.26, 2);
      g2.lineStyle(1, 0xffffff, 0.22);
      g2.lineBetween(W2 * 0.57, H2 * 0.52, W2 * 0.94, H2 * 0.54);
      if (deco === 'cross') {
        // Медик: нашивка-щиток и рельефный красный крест
        g2.fillStyle(0xd9dfe8, 1);
        g2.fillRoundedRect(W2 * 0.25, H2 * 0.06, W2 * 0.34, H2 * 0.54, 2);
        g2.lineStyle(0.8, 0x8a95a8, 1);
        g2.strokeRoundedRect(W2 * 0.25, H2 * 0.06, W2 * 0.34, H2 * 0.54, 2);
        g2.fillStyle(0x8f1d1d, 1);
        g2.fillRect(W2 * 0.37, H2 * 0.11, W2 * 0.12, H2 * 0.46);
        g2.fillRect(W2 * 0.28, H2 * 0.21, W2 * 0.30, H2 * 0.26);
        g2.fillStyle(0xe03434, 1);
        g2.fillRect(W2 * 0.36, H2 * 0.09, W2 * 0.12, H2 * 0.46);
        g2.fillRect(W2 * 0.27, H2 * 0.19, W2 * 0.30, H2 * 0.26);
      } else {
        // Кнопка на макушке с тенью и бликом
        g2.fillStyle(0x000000, 0.35);
        g2.fillCircle(W2 * 0.42, H2 * 0.09, 2.1);
        g2.fillStyle(button, 1);
        g2.fillCircle(W2 * 0.42, H2 * 0.08, 1.8);
        g2.fillStyle(0xffffff, 0.65);
        g2.fillCircle(W2 * 0.40, H2 * 0.06, 0.6);
      }
      // Чёткий внешний контур кепки
      g2.lineStyle(1.2, 0x141a29, 0.9);
      g2.strokeEllipse(W2 * 0.42, H2 * 0.44, W2 * 0.74, H2 * 0.82);
      g2.strokeRoundedRect(W2 * 0.54, H2 * 0.48, W2 * 0.44, H2 * 0.26, 2);
      g2.generateTexture(key, W2, H2);
      g2.destroy();
    };
    bakeCap('__geo_cap', 0x2e4a7a, 0x1e3154, 0x9fb6dd, null); // базовый/штурмовик — синяя
    bakeCap('__geo_cap_Assault', 0x2e4a7a, 0x1e3154, 0x9fb6dd, null);
    bakeCap('__geo_cap_Tank', 0x8a5a24, 0x5c3812, 0xd8b46a, 'rivets'); // танк — бронза, клёпки
    bakeCap('__geo_cap_Medic', 0xf2f4f8, 0xc8d0de, 0xffffff, 'cross'); // медик — белая с крестом
    bakeCap('__geo_cap_Sniper', 0x5e3a6e, 0x3d2449, 0xc79bdd, 'band'); // снайпер — тёмная со стропой
    if (!tm.exists('__geo_shoe')) {
      // Тактический ботинок/кед в профиль (22x13), носок вправо:
      // мягкий валик лодыжки, усиленный задник, защитный мысок, шнуровка с люверсами
      // и рельефная подошва с зубчатым протектором.
      const g3 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W3 = 22, H3 = 13;
      // Мягкий манжет лодыжки сверху
      g3.fillStyle(0x1e2638, 1);
      g3.fillRoundedRect(1.5, 0.5, 10, 4, 2);
      // Основной корпус обуви
      g3.fillStyle(0x3a4a6b, 1);
      g3.fillRoundedRect(1, 1.5, 20, 8.5, 3.5);
      // Усиленный кожаный задник (пятка)
      g3.fillStyle(0x25324c, 1);
      g3.fillRoundedRect(1, 2.5, 6.5, 7, 2.5);
      // Боковая поддерживающая накладка
      g3.fillStyle(0x4e638f, 1);
      g3.fillRoundedRect(6.5, 3, 6, 6, 1.5);
      // Защитный прорезиненный носок с объёмным бликом
      g3.fillStyle(0x6880b2, 1);
      g3.fillRoundedRect(13.5, 3, 7.5, 6.5, 3);
      g3.fillStyle(0x98aed9, 0.85);
      g3.fillRoundedRect(15, 3.8, 4.5, 2.2, 1);
      // Язычок и крестообразная шнуровка с металлическими люверсами
      g3.lineStyle(1.3, 0xe8edf5, 1);
      g3.lineBetween(9, 2.2, 11.5, 6.2);
      g3.lineBetween(11, 2.5, 13.5, 6.5);
      g3.lineBetween(13, 3, 15, 6.8);
      g3.fillStyle(0xa8b5d1, 1);
      g3.fillCircle(9, 2.2, 0.75);
      g3.fillCircle(11, 2.5, 0.75);
      g3.fillCircle(13, 3, 0.75);
      // Двухслойная подошва с каблуком и зубчатым протектором
      g3.fillStyle(0xd8dfe9, 1);
      g3.fillRoundedRect(0, 8.8, 22, 3.4, 1.5);
      g3.fillStyle(0x8d97ab, 1);
      g3.fillRect(0.5, 10.6, 21, 1.8);
      // Зубья протектора снизу
      g3.fillStyle(0x1c2438, 1);
      [2, 5, 8, 12, 15, 18].forEach(tx => g3.fillRect(tx, 11.4, 1.6, 1.6));
      g3.lineStyle(0.9, 0x6c768a, 1);
      g3.strokeRoundedRect(0, 8.8, 22, 3.4, 1.5);
      // Чёткий внешний контур верха
      g3.lineStyle(1.3, 0x161d2e, 1);
      g3.strokeRoundedRect(1, 1.5, 20, 8.5, 3.5);
      g3.generateTexture('__geo_shoe', W3, H3);
      g3.destroy();
    }
    if (!tm.exists('__geo_arm_up')) {
      // Плечо / рукав футболки (14x24, белый под командный тинт):
      // объёмная дельтовидная мышца, тень трицепса, наплечная нашивка,
      // складки ткани у локтя и прошитая манжета.
      const g4 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W4 = 14, H4 = 24;
      // Базовый объём рукава
      g4.fillStyle(0xe6ebf3, 1);
      g4.fillRoundedRect(1, 0, 12, 22, 5);
      // Задняя тень (трицепс)
      g4.fillStyle(0xbac4d4, 1);
      g4.fillRoundedRect(1, 1, 4.5, 20, 3);
      // Передний свет и блик на дельте/бицепсе
      g4.fillStyle(0xffffff, 1);
      g4.fillRoundedRect(5.5, 1, 6.5, 17, 3.5);
      // Тактическая велкро-нашивка на плече
      g4.fillStyle(0xcfd8e6, 1);
      g4.fillRoundedRect(3.5, 4, 7, 6.5, 1.5);
      g4.lineStyle(0.8, 0x7e889c, 1);
      g4.strokeRoundedRect(3.5, 4, 7, 6.5, 1.5);
      g4.lineBetween(4.5, 8.5, 9.5, 5.5); // шевронная полоса
      // Складки ткани у локтевого сгиба
      g4.lineStyle(0.9, 0x9aa4b8, 1);
      g4.lineBetween(3, 15, 10, 16);
      g4.lineBetween(4, 17, 11, 17.5);
      // Плотная манжета рукава со строчкой
      g4.fillStyle(0xc5cfde, 1);
      g4.fillRect(1.5, 18.5, 11, 3.5);
      g4.lineStyle(0.8, 0x7e889c, 1);
      g4.lineBetween(1.5, 18.5, 12.5, 18.5);
      g4.lineStyle(1.3, 0x1c2438, 1);
      g4.strokeRoundedRect(1, 0, 12, 22, 5);
      g4.generateTexture('__geo_arm_up', W4, H4);
      g4.destroy();
    }
    if (!tm.exists('__geo_arm_fore')) {
      // Предплечье (10x22) — мускулистая рука с анатомическим рельефом,
      // тенью локтевого сгиба и тактическими часами/манжетой у запястья.
      const g5 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W5 = 10, H5 = 22;
      // Основной тон кожи — БЕЛЫЙ: кисть/предплечье тонируются выбранным
      // цветом кожи (setTint), поэтому база должна быть нейтральной.
      g5.fillStyle(0xffffff, 1);
      g5.fillRoundedRect(1, 0, 8, 21, 4);
      // Тень по локтевой стороне
      g5.fillStyle(0xc0c0c0, 1);
      g5.fillRoundedRect(1, 1, 3, 16, 2);
      // Рельеф мышцы-разгибателя (светлый блик)
      g5.fillStyle(0xffffff, 1);
      g5.fillRoundedRect(3.8, 1.5, 4.2, 13, 2);
      // Локтевая складка и сухожилие
      g5.lineStyle(0.9, 0x9a9a9a, 0.85);
      g5.lineBetween(2.5, 2, 7.5, 2.5);
      g5.lineBetween(4, 6, 4.5, 15);
      // Тактический ремешок / часы и манжета перчатки у запястья
      g5.fillStyle(0x252b3b, 1);
      g5.fillRoundedRect(1, 16.5, 8, 4, 1);
      g5.fillStyle(0x4a556b, 1);
      g5.fillRoundedRect(2.5, 16.8, 5, 3.2, 1); // корпус часов
      g5.fillStyle(0x9aa6b8, 1);
      g5.fillRect(3.2, 17.3, 3.6, 2.2);
      g5.fillStyle(0x39ff6a, 0.9);
      g5.fillRect(4.2, 17.9, 1.6, 1); // подсветка циферблата
      g5.lineStyle(1.1, 0x1c2438, 1);
      g5.strokeRoundedRect(1, 0, 8, 21, 4);
      g5.generateTexture('__geo_arm_fore', W5, H5);
      g5.destroy();
    }
    if (!tm.exists('__geo_hand')) {
      // Кисть в тактической беспалой перчатке с кастетом-накладкой и пальцами,
      // обхватывающими рукоятку/цевьё (12x8, смотрит вправо вдоль кости).
      const g6 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W6 = 12, H6 = 8;
      // Пальцы (телесный тон задаётся тинтом кожи — база белая)
      g6.fillStyle(0xffffff, 1);
      g6.fillRoundedRect(0, 0, 12, 8, 3);
      g6.fillStyle(0xffffff, 1);
      g6.fillRoundedRect(6, 1, 5.2, 6, 2);
      // Беспалая тактическая перчатка на тыльной стороне ладони
      g6.fillStyle(0x262d3d, 1);
      g6.fillRoundedRect(0, 0, 7.2, 8, 2.5);
      // Защитная карбоновая накладка на костяшках
      g6.fillStyle(0x434f66, 1);
      g6.fillRoundedRect(3.5, 1, 3.2, 6, 1.5);
      g6.fillStyle(0x7c8ba6, 1);
      g6.fillCircle(5.2, 2.3, 0.6);
      g6.fillCircle(5.2, 4.0, 0.6);
      g6.fillCircle(5.2, 5.7, 0.6);
      // Фаланги пальцев и борозды хвата
      g6.lineStyle(1, 0x9a9a9a, 1);
      g6.lineBetween(8.2, 0.8, 8.2, 7.2);
      g6.lineBetween(10.0, 1.2, 10.0, 6.8);
      g6.lineBetween(7.2, 3.8, 11.4, 3.8);
      // Большой палец снизу в обхвате
      g6.fillStyle(0xd8d8d8, 1);
      g6.fillRoundedRect(2.2, 5.2, 5.2, 2.8, 1.4);
      g6.lineStyle(0.9, 0x1c2438, 1);
      g6.strokeRoundedRect(2.2, 5.2, 5.2, 2.8, 1.4);
      g6.lineStyle(1.1, 0x1c2438, 1);
      g6.strokeRoundedRect(0, 0, 12, 8, 3);
      g6.generateTexture('__geo_hand', W6, H6);
      g6.destroy();
    }
    if (!tm.exists('__geo_face_ov')) {
      // Реалистичная анатомическая светотень лица поверх головы-круга (20x20, R=10):
      // объём черепа и челюсти, армейская стрижка с виском, глубокие глазницы с веками,
      // рельеф скулы, переносицы, ноздри и подбородка + лёгкая небритость.
      const W = 20, H = 20, R = 10;
      const g10 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const fx = R, fy = R;
      // 1. Объёмная тень затылка и нижней челюсти (убирает «плоский кружок»)
      g10.fillStyle(0x1a0e08, 0.16);
      g10.fillEllipse(fx - 0.52 * R, fy + 0.12 * R, 0.55 * R, 1.45 * R);
      g10.fillEllipse(fx + 0.15 * R, fy + 0.78 * R, 1.15 * R, 0.34 * R);
      // 2. Короткая армейская стрижка на затылке и аккуратный висок перед ухом
      g10.fillStyle(0x241810, 0.68);
      g10.fillEllipse(fx - 0.68 * R, fy - 0.24 * R, 0.56 * R, 0.92 * R);
      g10.fillRoundedRect(fx - 0.52 * R, fy - 0.32 * R, 0.22 * R, 0.48 * R, 1);
      g10.fillStyle(0x241810, 0.38);
      g10.fillEllipse(fx - 0.15 * R, fy - 0.78 * R, 0.95 * R, 0.28 * R);
      // 3. Свет на лбу и скуле + суровая впадина щеки и лёгкая щетина на челюсти
      g10.fillStyle(0xffffff, 0.16);
      g10.fillEllipse(fx + 0.32 * R, fy - 0.42 * R, 0.55 * R, 0.28 * R);
      g10.fillEllipse(fx + 0.48 * R, fy + 0.08 * R, 0.36 * R, 0.26 * R);
      g10.fillStyle(0x2a160c, 0.14);
      g10.fillEllipse(fx + 0.20 * R, fy + 0.36 * R, 0.38 * R, 0.28 * R);
      g10.fillStyle(0x1c1612, 0.13);
      g10.fillEllipse(fx + 0.34 * R, fy + 0.58 * R, 0.76 * R, 0.42 * R);
      // 4. Глубокие глазницы, верхние веки и тень под глазами
      g10.fillStyle(0x24120a, 0.24);
      g10.fillEllipse(fx + 0.02 * R, fy - 0.10 * R, 0.50 * R, 0.36 * R);
      g10.fillEllipse(fx + 0.42 * R, fy - 0.13 * R, 0.40 * R, 0.34 * R);
      g10.fillStyle(0x2a1810, 0.48);
      g10.fillRoundedRect(fx - 0.20 * R, fy - 0.26 * R, 0.46 * R, 0.10 * R, 0.4);
      g10.fillRoundedRect(fx + 0.24 * R, fy - 0.28 * R, 0.36 * R, 0.10 * R, 0.4);
      g10.lineStyle(0.7, 0x24120a, 0.22);
      g10.lineBetween(fx - 0.14 * R, fy + 0.05 * R, fx + 0.18 * R, fy + 0.03 * R);
      // 5. Тень под носом, ноздря, впадина под нижней губой и рельеф уха
      g10.fillStyle(0xffffff, 0.15);
      g10.fillRect(fx + 0.72 * R, fy - 0.08 * R, 0.12 * R, 0.22 * R);
      g10.fillStyle(0x24120a, 0.26);
      g10.fillEllipse(fx + 0.78 * R, fy + 0.28 * R, 0.26 * R, 0.14 * R);
      g10.fillEllipse(fx + 0.38 * R, fy + 0.62 * R, 0.32 * R, 0.12 * R);
      g10.fillEllipse(fx - 0.76 * R, fy + 0.05 * R, 0.16 * R, 0.24 * R);
      g10.generateTexture('__geo_face_ov', W, H);
      g10.destroy();
    }
    if (!tm.exists('__geo_thigh')) {
      // Бедро-штанина (16x28, тактический деним): анатомический объём квадрицепса,
      // косой врезной карман с заклёпкой, объёмный накладной карго-карман с клапаном,
      // двойная джинсовая строчка и складки у колена.
      const g7 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W7 = 16, H7 = 28;
      // Базовый цвет денима
      g7.fillStyle(0x2e4f8f, 1);
      g7.fillRoundedRect(1, 0, 14, 28, 5);
      // Задняя глубокая тень бедра
      g7.fillStyle(0x1d3461, 1);
      g7.fillRoundedRect(1, 0, 4.5, 28, 3);
      // Передний объём (квадрицепс) и светлый блик потертости
      g7.fillStyle(0x436ab0, 0.85);
      g7.fillRoundedRect(6, 1.5, 7.5, 20, 3);
      g7.fillStyle(0x6389c9, 0.45);
      g7.fillRoundedRect(8.5, 3, 3.5, 15, 1.5);
      // Верхний косой врезной карман с медной заклёпкой
      g7.lineStyle(1, 0x16284c, 1);
      g7.lineBetween(7, 1.5, 13.5, 5);
      g7.fillStyle(0xd8a24a, 1);
      g7.fillCircle(7.5, 2, 0.7);
      // Боковой объёмный карго-карман с клапаном и кнопкой
      g7.fillStyle(0x26437a, 1);
      g7.fillRoundedRect(7.5, 7, 6.5, 9, 1.5);
      g7.fillStyle(0x385b9e, 1);
      g7.fillRoundedRect(7.5, 7, 6.5, 3, 1); // клапан
      g7.lineStyle(1, 0x16284c, 1);
      g7.strokeRoundedRect(7.5, 7, 6.5, 9, 1.5);
      g7.lineBetween(7.5, 10, 14, 10);
      g7.fillStyle(0xc8963e, 1);
      g7.fillCircle(10.8, 8.6, 0.75);
      // Двойная рыжая джинсовая отстрочка по боковому шву
      g7.lineStyle(0.8, 0xc8963e, 0.85);
      g7.lineBetween(5.5, 1.5, 5.5, 25);
      g7.lineBetween(6.5, 1.5, 6.5, 25);
      // Складки натяжения ткани и коленная чашечка снизу
      g7.fillStyle(0x213b6e, 1);
      g7.fillRoundedRect(1, 21.5, 14, 6.5, 3);
      g7.lineStyle(0.9, 0x16284c, 0.9);
      g7.lineBetween(3, 20, 12, 21);
      g7.lineBetween(4, 22.5, 13, 22.5);
      g7.lineStyle(1.2, 0x141c2e, 1);
      g7.strokeRoundedRect(1, 0, 14, 28, 5);
      g7.generateTexture('__geo_thigh', W7, H7);
      g7.destroy();
    }
    if (!tm.exists('__geo_shin')) {
      // Икра-штанина (14x26): анатомический изгиб икроножной мышцы,
      // усиленный наколенник со складками сверху, двойной шов и манжета с отворотом.
      const g8 = (scene || player.scene).make.graphics({ x: 0, y: 0, add: false });
      const W8 = 14, H8 = 26;
      // База голени
      g8.fillStyle(0x2b4c86, 1);
      g8.fillRoundedRect(1, 0, 12, 26, 5);
      // Тень икроножной мышцы сзади
      g8.fillStyle(0x1b325c, 1);
      g8.fillRoundedRect(1, 0, 4, 24, 3);
      // Передний свет по голени
      g8.fillStyle(0x436ab0, 0.75);
      g8.fillRoundedRect(5.5, 2, 6, 17, 2.5);
      // Усиленная коленная секция сверху с горизонтальными рёбрами сгиба
      g8.fillStyle(0x223d70, 1);
      g8.fillRoundedRect(2.5, 1, 9.5, 7.5, 2.5);
      g8.fillStyle(0x385b9e, 1);
      g8.fillRoundedRect(3.5, 2, 7.5, 5.5, 2);
      g8.lineStyle(0.8, 0x16284c, 0.9);
      g8.lineBetween(3.5, 4.5, 11, 4.5);
      // Двойная джинсовая строчка по шву
      g8.lineStyle(0.8, 0xc8963e, 0.8);
      g8.lineBetween(4.2, 1.5, 4.2, 20);
      // Складки напуска и подвёрнутая манжета над ботинком
      g8.lineStyle(0.9, 0x16284c, 0.85);
      g8.lineBetween(2.5, 18.5, 11.5, 19.2);
      g8.fillStyle(0x4b6fb0, 1);
      g8.fillRoundedRect(1, 20, 12, 5.5, 2);
      g8.fillStyle(0x688bc9, 0.7);
      g8.fillRect(2, 20.5, 10, 1.8);
      g8.lineStyle(1, 0xd5dbe7, 0.85);
      g8.lineBetween(2, 22.8, 12, 22.8);
      g8.lineStyle(1.2, 0x141c2e, 1);
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
  const G = (key, w, h, draw) => bakeOneGear(player, tm, make, key, w, h, (g, gw, gh) => {
    draw(g, gw, gh);
    // Автоматический реалистичный объём, складки, фурнитура и контур для всех
    // торсов (24x36) и обуви (22x13) гардероба без изменения их размеров.
    if (gw === 24 && gh === 36) {
      // Глубокая тень спины и объём грудной мышцы
      g.fillStyle(0x000000, 0.18);
      g.fillRoundedRect(2, 4, 4.5, 25, 3);
      g.fillStyle(0xffffff, 0.14);
      g.fillRoundedRect(13.5, 6.5, 6.5, 10, 3);
      g.fillEllipse(15.5, 8.5, 4.5, 5);
      // Тень горловины воротника и складки на талии
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(12, 3.6, 7.5, 2.4);
      g.lineStyle(0.9, 0x000000, 0.20);
      g.lineBetween(9, 22.5, 19, 23);
      g.lineBetween(9, 25.5, 19, 26);
      // Детали ремня: шлёвки, блик пряжки и контур
      g.fillStyle(0x000000, 0.42);
      g.fillRect(8.2, 31, 1.3, 4);
      g.fillRect(15.2, 31, 1.3, 4);
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(10.3, 31.2, 3.4, 0.9);
      g.lineStyle(1, 0x101520, 0.78);
      g.strokeRoundedRect(12, 5, 9, 10, 4);
      g.lineStyle(1.2, 0x101520, 0.88);
      g.strokeRoundedRect(2, 3.5, 19, 26.5, 5);
    } else if (gw === 22 && gh === 13) {
      // Мягкий валик лодыжки, тень пятки, блик мыска, люверсы и зубчатый протектор
      g.fillStyle(0x000000, 0.24);
      g.fillRoundedRect(1.5, 0.6, 9, 2.8, 1.4);
      g.fillRoundedRect(1, 2.5, 5, 6.5, 2);
      g.fillStyle(0xffffff, 0.20);
      g.fillRoundedRect(15, 3.8, 4.5, 2, 1);
      g.fillStyle(0xd8e0ee, 0.85);
      g.fillCircle(10, 2.5, 0.65);
      g.fillCircle(12.5, 2.7, 0.65);
      g.fillStyle(0x0a0d14, 0.75);
      [2, 5, 8, 12, 15, 18].forEach(tx => g.fillRect(tx, 11.4, 1.6, 1.6));
    }
  });
  // --- форменные уборы (только сетовые; вне-сетевые удалены из игры)
  G('военный_шлем', 32, 16, (g) => {
    // Кевларовый тактический шлем PASGT в профиль: наушный свес, кант, ремешок
    g.fillStyle(0x4b532a, 1);
    g.fillEllipse(16, 7.2, 27, 13.5);
    g.fillStyle(0x5a6234, 1);
    g.fillEllipse(16.5, 6.8, 25, 12);
    g.fillStyle(0x3d4422, 1);
    g.fillRoundedRect(1, 9, 30, 4, 2); // поля и свес над ухом
    g.fillRoundedRect(6, 10, 10, 4.5, 2); // защита виска/уха
    g.fillStyle(0x788246, 0.85);
    g.fillEllipse(13, 4.5, 12, 5.5); // блик купола
    // Крепление ПНВ спереди и резиновая лента
    g.fillStyle(0x282c18, 1);
    g.fillRect(2, 7.5, 28, 1.6);
    g.fillRoundedRect(26, 5.5, 4, 4, 1);
    // Болты подвесной системы
    g.fillStyle(0x9aa382, 1);
    g.fillCircle(9, 11, 0.8);
    g.fillCircle(19, 10.5, 0.8);
    g.lineStyle(1.4, 0x222612, 1);
    g.strokeEllipse(16, 7.2, 27, 13.5);
  });
  G('камуфляжный_шлем', 32, 16, (g) => {
    g.fillStyle(0x4b532a, 1);
    g.fillEllipse(16, 7.2, 27, 13.5);
    g.fillStyle(0x5a6234, 1);
    g.fillEllipse(16.5, 6.8, 25, 12);
    g.fillRoundedRect(1, 9, 30, 4, 2);
    g.fillRoundedRect(6, 10, 10, 4.5, 2);
    // Органические пятна камуфляжа на чехле шлема
    g.fillStyle(0x6b4a2a, 1);
    g.fillEllipse(9.5, 6, 7, 5);
    g.fillEllipse(22, 8, 6, 4.5);
    g.fillStyle(0x8f7e4f, 1);
    g.fillEllipse(16, 4, 6.5, 4);
    g.fillEllipse(14, 10, 5.5, 3);
    g.fillStyle(0xffffff, 0.14);
    g.fillEllipse(13, 4.2, 11, 4.5);
    // Стропа для очков/маскировки
    g.fillStyle(0x2e3319, 0.85);
    g.fillRect(2, 7.8, 28, 1.5);
    g.lineStyle(1.4, 0x222612, 1);
    g.strokeEllipse(16, 7.2, 27, 13.5);
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
    G(id + '_up', 16, 28, (g, gw, gh) => {
      thighFn(g, gw, gh);
      // Реалистичный объём бедра: тень сзади, свет квадрицепса, косой карман,
      // боковой шов с двойной строчкой и складки сгиба у колена.
      g.fillStyle(0x000000, 0.20);
      g.fillRoundedRect(1, 1, 4, 26, 2.5);
      g.fillStyle(0xffffff, 0.12);
      g.fillRoundedRect(7, 2.5, 4.5, 16, 2);
      g.lineStyle(0.9, 0x000000, 0.32);
      g.lineBetween(7, 1.5, 13.5, 5);
      g.lineBetween(3, 20.5, 12.5, 21.2);
      g.lineStyle(0.8, 0x000000, 0.22);
      g.lineBetween(5.5, 1.5, 5.5, 24);
    });
    G(id + '_low', 14, 26, (g, gw, gh) => {
      shinFn(g, gw, gh);
      // Реалистичный объём голени: тень икры, накладка колена, шов и складка у ботинка.
      g.fillStyle(0x000000, 0.20);
      g.fillRoundedRect(1, 1, 3.5, 24, 2.5);
      g.fillStyle(0xffffff, 0.12);
      g.fillRoundedRect(5.5, 2.5, 4, 15, 2);
      g.lineStyle(0.8, 0x000000, 0.28);
      g.lineBetween(3.5, 5, 10.5, 5);
      g.lineBetween(2.5, 19, 11.5, 19.5);
      g.lineBetween(4.2, 1.5, 4.2, 20);
    });
    // Иконка для инвентаря/кейсов/магазина 30x30: пояс + две штанины,
    // чтобы читалось как штаны, а не один овал бедра.
    const ic = icon || { base: 0x8a8f9a, dark: 0x5a5f6a, line: 0x22242c };
    G(id + '_icon', 30, 30, (g) => {
      g.fillStyle(ic.base, 1);
      g.fillRoundedRect(5, 2, 20, 7, 3); // пояс
      g.fillRoundedRect(6, 9, 8, 19, 3); // левая штанина
      g.fillRoundedRect(16, 9, 8, 19, 3); // правая штанина
      g.fillStyle(0x000000, 0.18);
      g.fillRoundedRect(6, 9, 3, 19, 2);
      g.fillRoundedRect(16, 9, 3, 19, 2);
      g.fillStyle(0xffffff, 0.14);
      g.fillRoundedRect(9.5, 10, 3, 15, 1.5);
      g.fillRoundedRect(19.5, 10, 3, 15, 1.5);
      g.fillStyle(ic.dark, 1);
      g.fillRect(5, 5.5, 20, 2.5); // ремень
      g.fillRect(8, 11, 2, 15);
      g.fillRect(20, 11, 2, 15);
      g.fillStyle(0xd0d8e4, 1);
      g.fillRect(13.5, 5.3, 3, 2.8); // пряжка на поясе
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
