// netArena.cjs — серверный источник данных арены (CJS).
// Источник истины — js/net/arena.js (клиент). Этот файл — его CJS-копия
// для Node (server.js не умеет ESM-import). При смене арены править ОБА
// файла и сверять с тестом: node server/check-arena.cjs
// (NET_BUILD должен совпадать в обоих местах).
'use strict';

const NET_BUILD = 92;

const NET_ARENA = {
  width: 2400,
  height: 900,
  groundTop: 850,
  platforms: [
    { x: 1200, y: 700, w: 320, h: 20 },
    { x: 500, y: 640, w: 220, h: 16 },
    { x: 1900, y: 640, w: 220, h: 16 },
    { x: 350, y: 480, w: 200, h: 16 },
    { x: 2050, y: 480, w: 200, h: 16 }
  ],
  spawnsBlue: [
    { x: 150, y: 800 },
    { x: 300, y: 800 },
    { x: 450, y: 800 },
    { x: 600, y: 800 }
  ],
  spawnsRed: [
    { x: 2250, y: 800 },
    { x: 2100, y: 800 },
    { x: 1950, y: 800 },
    { x: 1800, y: 800 }
  ],
  points: [
    { name: 'А', x: 600, y: 850 },
    { name: 'Б', x: 1200, y: 690 },
    { name: 'С', x: 1800, y: 850 }
  ],
  bases: {
    blue: { x: 150, y: 850 },
    red: { x: 2250, y: 850 }
  }
};

// Солиды для проверки стен: земля + платформы (центр x,y + w/h).
const NET_SOLIDS = [
  { x: 1200, y: 890, w: 2400, h: 80 },
  { x: 1200, y: 700, w: 320, h: 20 },
  { x: 500, y: 640, w: 220, h: 16 },
  { x: 1900, y: 640, w: 220, h: 16 },
  { x: 350, y: 480, w: 200, h: 16 },
  { x: 2050, y: 480, w: 200, h: 16 }
];

function netSpawn(team, index) {
  const list = team === 'red' ? NET_ARENA.spawnsRed : NET_ARENA.spawnsBlue;
  return list[index % list.length];
}

module.exports = { NET_BUILD, NET_ARENA, NET_SOLIDS, netSpawn };
