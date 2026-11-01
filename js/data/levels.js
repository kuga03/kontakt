import { genCampaignMapData } from './campaignMaps.js?v=7';
﻿export const campaignLevels = [
  {
    id: 1,
    theme: 'ulica',
    mode: 'CAMPAIGN',
    mapName: 'Крыши. Учебка',
    name: 'Пробуждение',
    // Учебка — минимум геометрии: 2 крыши без туннелей и мостов.
    // Было 3 дома + туннель + перемычка (19 платформ): новичка давили
    // крыши, а бот уходил туда, где его не достать и не выцелить.
    tutorial: true,
    storyIntro: '2031 год. Мир захлебнулся хаосом.\nТеррористическая организация «Синдром» захватила власть в нескольких городах.\nТы ещё не солдат — но выбора больше нет.\nМы научим тебя воевать. Следуй подсказкам.',
    storyOutro: 'Отличная работа! Связь со штабом восстановлена.\nЭто только начало — впереди настоящая война.',
    width: 2400,
    height: 900,
    ...genCampaignMapData(1, 2400, 900, 'CAMPAIGN', 'ulica'),
    enemies: 2,
    enemyTypes: ['Assault'],
    objective: 'Учебная миссия: выполни задания',
    reward: { coins: 100, experience: 50 }
  },
  {
    id: 2,
    theme: 'ulica',
    mode: 'TDM',
    mapName: 'Долина. Командный бой',
    name: 'Первый контакт',
    storyIntro: 'Штаб выслал координаты сбора.\nРазведчики «Синдрома» удерживают долину — нужно выбить их, пока они не закрепились.\nТеперь ты в отряде.\n\nРежим — КОМАНДНЫЙ БОЙ',
    storyOutro: 'Разведчики разбиты, отряд цел.\nСреди приказов врага — карта оборонительных\nлиний «Синдрома». Она пригодится.',
    width: 2600,
    height: 900,
    ...genCampaignMapData(2, 2600, 900, 'TDM', 'ulica'),
    enemies: 7,
    allies: 3,
    bots: 4,
    scoreLimit: 20,
    enemyTypes: ['Assault', 'Assault', 'Assault', 'Tank'],
    objective: 'Командный бой: набери норму фрагов раньше врага',
    reward: { coins: 150, experience: 60 }
  },
  {
    id: 3,
    theme: 'krisha',
    mode: 'FFA',
    mapName: 'Квартал. Каждый за себя',
    name: 'Засада',
    storyIntro: 'Связь с отрядом потеряна — каждый сам за себя.\nПодкрепление «Синдрома» устраивает засаду.\nКарта не помогла — враг ударил там, где мы не ждали.\n\nРежим — КАЖДЫЙ ЗА СЕБЯ',
    storyOutro: 'Засада отбита в одиночку.\nПуть к штабу перекрыт — уходим\nчерез промышленный район.',
    width: 2800,
    height: 900,
    ...genCampaignMapData(3, 2800, 900, 'FFA', 'krisha'),
    enemies: 9,
    bots: 5,
    scoreLimit: 15,
    enemyTypes: ['Assault', 'Assault', 'Tank', 'Assault', 'Sniper'],
    objective: 'Каждый за себя: набери норму фрагов первым',
    reward: { coins: 200, experience: 70 }
  },
  {
    id: 4,
    theme: 'zavod',
    mode: 'CTF',
    mapName: 'Мосты. Захват флага',
    name: 'Промзона',
    storyIntro: 'Промзона — лабиринт завалов и огневых точек.\n«Синдром» держит здесь знамя полка.\nСудя по карте, это ключевой узел обороны.\n\nРежим — ЗАХВАТ ФЛАГА',
    storyOutro: 'Знамя «Синдрома» — наше.\nНа базе найден склад оружия — уровень\nснаряжения значительно вырос.',
    width: 3000,
    height: 900,
    ...genCampaignMapData(4, 3000, 900, 'CTF', 'zavod'),
    enemies: 9,
    allies: 3,
    bots: 4,
    scoreLimit: 2,
    enemyTypes: ['Assault', 'Tank', 'Assault', 'Sniper', 'Assault', 'Medic'],
    objective: 'Захват флага: донеси флаги врага на свою базу',
    reward: { coins: 250, experience: 80 }
  },
  {
    id: 5,
    theme: 'pustinya',
    mode: 'BOMB',
    mapName: 'Эстакада. Бомба',
    name: 'Операция «Гром»',
    storyIntro: 'Командование одобрило контрудар.\nТы — авангард с подрывным зарядом.\nКарта оборонительных линий оказалась точной — самое время бить по объектам.\n\nРежим — БОМБА',
    storyOutro: 'Объекты «Синдрома» взорваны.\nОни отступают, но их лидер — «Директор» —\nвсё ещё на свободе.',
    width: 3200,
    height: 900,
    ...genCampaignMapData(5, 3200, 900, 'BOMB', 'pustinya'),
    enemies: 11,
    allies: 3,
    bots: 4,
    scoreLimit: 2,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Assault', 'Assault', 'Medic'],
    objective: 'Бомба: установи заряд на базе врага',
    reward: { coins: 300, experience: 100 }
  },
  {
    id: 6,
    theme: 'pustoch',
    mode: 'KOTH',
    mapName: 'Пустошь. Захват точек',
    name: 'Предательство',
    // Тот же ROOFS, что в 1-й, но другой город: частые крыши без туннелей
    // + небесные мосты между ними.
    // Баланс-правка: было 5 домов/8 перемычек — крышная каша запирала выход
    // со спавна, снайперы крыли выходы. Стало реже + открытое небо над
    // базами. Гандикап снят (честные 5v5 — легко не будет), счёт 200.
    storyIntro: 'В штабе завёлся предатель — позиции раскрыты.\nНужно удержать три рубежа до подхода своих.\nПохоже, враг знал о нас всё.\n\nРежим — ЗАХВАТ ТОЧЕК',
    storyOutro: 'Рубежи удержаны, но штаб потерян.\nТы оторвался от своих.\nНужно найти новых союзников.',
    width: 2800,
    height: 900,
    ...genCampaignMapData(6, 2800, 900, 'KOTH', 'pustoch'),
    enemies: 9,
    allies: 3,
    bots: 5,
    scoreLimit: 200,
    enemyTypes: ['Tank', 'Sniper', 'Assault', 'Assault', 'Medic', 'Assault'],
    objective: 'Захват точек: удерживай А, Б и С',
    reward: { coins: 350, experience: 110 }
  },
  {
    id: 7,
    theme: 'pechera',
    mode: 'TDM',
    mapName: 'Пещера. Командный бой',
    name: 'Кольцо сжимается',
    // Та же VALLEY, что во 2-й, но акцент на туннели: мало домов, крыши ниже.
    storyIntro: '«Синдром» окружает последний свободный район.\nДержим позиции с новым отрядом.\nСлухи о твоих подвигах уже разошлись по округе — к тебе присоединились выжившие.\n\nРежим — КОМАНДНЫЙ БОЙ',
    storyOutro: 'Позиции удержаны. Подкрепление прибыло.\nПришло время переходить в наступление.',
    width: 3000,
    height: 900,
    ...genCampaignMapData(7, 3000, 900, 'TDM', 'pechera'),
    enemies: 11,
    allies: 4,
    bots: 5,
    scoreLimit: 25,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Assault'],
    objective: 'Командный бой: набери норму фрагов раньше врага',
    reward: { coins: 400, experience: 120 }
  },
  {
    id: 8,
    theme: 'wasteland',
    mode: 'FFA',
    mapName: 'Руины. Каждый за себя',
    name: 'Прорыв',
    // Тот же DENSE, что в 3-й, но реже дома + туннели и пара мостов.
    storyIntro: 'Наступление началось, порядки смешались.\nВпереди — главная линия обороны «Синдрома».\nТы уже не новичок — ты ведёшь за собой других.\n\nРежим — КАЖДЫЙ ЗА СЕБЯ',
    storyOutro: 'Линия обороны прорвана.\nШтаб «Синдрома» — за горизонтом.\nФинальный штурм неизбежен.',
    width: 3400,
    height: 900,
    ...genCampaignMapData(8, 3400, 900, 'FFA', 'wasteland'),
    enemies: 13,
    bots: 6,
    scoreLimit: 20,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault'],
    objective: 'Каждый за себя: набери норму фрагов первым',
    reward: { coins: 500, experience: 140 }
  },
  {
    id: 9,
    theme: 'krisha',
    mode: 'CTF',
    mapName: 'Переправы. Захват флага',
    name: 'Логово зверя',
    // Те же BRIDGES, что в 4-й, но мостов больше и выше домов.
    storyIntro: 'Штаб «Синдрома» — крепость.\n«Директор» лично командует обороной.\nТы помнишь карту из промзоны — теперь она ведёт тебя к сердцу врага.\n\nРежим — ЗАХВАТ ФЛАГА',
    storyOutro: 'Штандарт захвачен, оборона рассыпается.\n«Директор» бежит в бункер.\nОстался последний удар.',
    width: 3600,
    height: 900,
    ...genCampaignMapData(9, 3600, 900, 'CTF', 'krisha'),
    enemies: 14,
    allies: 4,
    bots: 5,
    scoreLimit: 3,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault', 'Medic'],
    objective: 'Захват флага: донеси флаги врага на свою базу',
    reward: { coins: 600, experience: 160 }
  },
  {
    id: 10,
    theme: 'zavod',
    mode: 'BOMB',
    mapName: 'Бункер. Бомба',
    name: 'Рассвет',
    // Тот же ELEVATED, что в 5-й, но выше и плотнее: крыши, туннели, парящие.
    storyIntro: 'Бункер «Директора». Последний рубеж.\nЗаряд готов, отряд — с тобой.\nТы прошёл путь от новобранца до командира.\n\nРежим — БОМБА',
    storyOutro: '«Директор» повержен.\n«Синдром» прекратил существование.\nМир возвращается. Ты — герой.',
    width: 3200,
    height: 900,
    ...genCampaignMapData(10, 3200, 900, 'BOMB', 'zavod'),
    enemies: 15,
    allies: 4,
    bots: 5,
    scoreLimit: 3,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper'],
    objective: 'Бомба: установи заряд на базе врага',
    reward: { coins: 1000, experience: 300 }
  },
  // ===== АКТ 2: ХИМЕРА (11–20). Победа была недолгой: осколки «Синдрома»
  // сплотила бывший лейтенант «Директора» по кличке Химера. Сложнее,
  // шире карты, больше врагов и награды выше.
  {
    id: 11,
    theme: 'pustinya',
    mode: 'TDM',
    mapName: 'Долина. Командный бой',
    name: 'Пепел',
    storyIntro: 'Победа была недолгой.\nОсколки «Синдрома» сплотила Химера — бывший лейтенант «Директора».\nТы снова в строю, но теперь у тебя новый отряд.\n\nРежим — КОМАНДНЫЙ БОЙ',
    storyOutro: 'Долина наша, но это только разведка боем.\nХимера собирает «Рой» — армию фанатиков.\nОна не повторит ошибок «Директора».',
    width: 3600,
    height: 900,
    ...genCampaignMapData(11, 3600, 900, 'TDM', 'pustinya'),
    enemies: 13,
    allies: 4,
    bots: 5,
    scoreLimit: 30,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Assault'],
    objective: 'Командный бой: набери норму фрагов раньше врага',
    reward: { coins: 700, experience: 200 }
  },
  {
    id: 12,
    theme: 'krisha',
    mode: 'FFA',
    mapName: 'Квартал. Каждый за себя',
    name: 'Стая',
    storyIntro: 'Отряд отрезан завалом — снова один.\n«Рой» охотится стаями.\nТы уже проходил через это — но теперь враг умнее и злее.\n\nРежим — КАЖДЫЙ ЗА СЕБЯ',
    storyOutro: 'Стая рассеяна.\nПленные говорят про переправу —\nтам «Рой» тащит что-то большое.',
    width: 3600,
    height: 900,
    ...genCampaignMapData(12, 3600, 900, 'FFA', 'krisha'),
    enemies: 15,
    bots: 6,
    scoreLimit: 25,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault'],
    objective: 'Каждый за себя: набери норму фрагов первым',
    reward: { coins: 800, experience: 220 }
  },
  {
    id: 13,
    theme: 'zavod',
    mode: 'CTF',
    mapName: 'Переправы. Захват флага',
    name: 'Переправа',
    storyIntro: 'Через реку — единственный мост.\n«Рой» везёт через него знамёна Химеры.\nБез них колонна не тронется.\n\nРежим — ЗАХВАТ ФЛАГА',
    storyOutro: 'Знамёна наши, колонна встала.\nНо разведка докладывает: в гнезде\nуже зреет новый рой.',
    width: 3800,
    height: 900,
    ...genCampaignMapData(13, 3800, 900, 'CTF', 'zavod'),
    enemies: 15,
    allies: 4,
    bots: 6,
    scoreLimit: 4,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault'],
    objective: 'Захват флага: донеси флаги врага на свою базу',
    reward: { coins: 900, experience: 240 }
  },
  {
    id: 14,
    theme: 'pechera',
    mode: 'BOMB',
    mapName: 'Гнездо. Бомба',
    name: 'Гнездо',
    storyIntro: 'Гнездо «Роя» — пещеры с горючим.\nОдин заряд — и выводок сгорит.\nТы уже подрывал объекты «Синдрома» — теперь цель ещё важнее.\n\nРежим — БОМБА',
    storyOutro: 'Гнездо выгорело дотла.\nХимера в ярости бросила всё\nна удержание рубежей.',
    width: 3800,
    height: 900,
    ...genCampaignMapData(14, 3800, 900, 'BOMB', 'pechera'),
    enemies: 16,
    allies: 4,
    bots: 6,
    scoreLimit: 3,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault', 'Medic'],
    objective: 'Бомба: установи заряд на базе врага',
    reward: { coins: 1000, experience: 260 }
  },
  {
    id: 15,
    theme: 'pustoch',
    mode: 'KOTH',
    mapName: 'Рубежи. Захват точек',
    name: 'Рубеж',
    storyIntro: 'Три высоты — ключ к наступлению.\n«Рой» уже окапывается.\nЕсли возьмём высоты — откроем дорогу на цитадель.\n\nРежим — ЗАХВАТ ТОЧЕК',
    storyOutro: 'Высоты наши.\nДорога на цитадель Химеры открыта.',
    width: 3600,
    height: 900,
    ...genCampaignMapData(15, 3600, 900, 'KOTH', 'pustoch'),
    enemies: 14,
    allies: 4,
    bots: 6,
    scoreLimit: 250,
    enemyTypes: ['Tank', 'Sniper', 'Assault', 'Assault', 'Medic', 'Assault', 'Tank'],
    objective: 'Захват точек: удерживай А, Б и С',
    reward: { coins: 1100, experience: 280 }
  },
  {
    id: 16,
    theme: 'wasteland',
    mode: 'TDM',
    mapName: 'Пустошь. Командный бой',
    name: 'Контрудар',
    storyIntro: 'Химера бросила в бой гвардию.\nДержим пустошь любой ценой.\nОна понимает, что проигрывает, — и это делает её опаснее.\n\nРежим — КОМАНДНЫЙ БОЙ',
    storyOutro: 'Гвардия разбита.\n«Рой» пятится к своим норам.\nНо Химера не сдаётся — она готовит отчаянный ход.',
    width: 4000,
    height: 900,
    ...genCampaignMapData(16, 4000, 900, 'TDM', 'wasteland'),
    enemies: 17,
    allies: 5,
    bots: 6,
    scoreLimit: 35,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault', 'Medic'],
    objective: 'Командный бой: набери норму фрагов раньше врага',
    reward: { coins: 1200, experience: 300 }
  },
  {
    id: 17,
    theme: 'ulica',
    mode: 'FFA',
    mapName: 'Улицы. Каждый за себя',
    name: 'Мясорубка',
    storyIntro: 'Отступая, Химера запускает «Эхо Роя» — психоизлучатель, который глушит связь и сбивает опознавание.\nГород тонет в хаосе: свои не слышат своих, каждый стреляет в каждого.\nТебе нужно пережить эту мясорубку.\n\nРежим — КАЖДЫЙ ЗА СЕБЯ',
    storyOutro: '«Эхо» стихло. Ты выжил.\nСквозь дым виден штаб Химеры — на крыше её личное знамя.',
    width: 4000,
    height: 900,
    ...genCampaignMapData(17, 4000, 900, 'FFA', 'ulica'),
    enemies: 17,
    bots: 8,
    scoreLimit: 30,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault', 'Medic', 'Tank'],
    objective: 'Каждый за себя: набери норму фрагов первым',
    reward: { coins: 1300, experience: 320 }
  },
  {
    id: 18,
    theme: 'krisha',
    mode: 'CTF',
    mapName: 'Крыши. Захват флага',
    name: 'Знамя',
    storyIntro: 'Личное знамя Химеры — на крыше штаба.\nПосле хаоса её армия деморализована.\nСорви знамя у всех на глазах.\n\nРежим — ЗАХВАТ ФЛАГА',
    storyOutro: 'Знамя сорвано.\nАрмия Химеры дрогнула.',
    width: 4200,
    height: 900,
    ...genCampaignMapData(18, 4200, 900, 'CTF', 'krisha'),
    enemies: 18,
    allies: 5,
    bots: 6,
    scoreLimit: 5,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault', 'Medic', 'Tank'],
    objective: 'Захват флага: донеси флаги врага на свою базу',
    reward: { coins: 1400, experience: 340 }
  },
  {
    id: 19,
    theme: 'zavod',
    mode: 'BOMB',
    mapName: 'Завод. Бомба',
    name: 'Искра',
    storyIntro: 'Завод делает оружие для «Роя».\nОдна искра — и всё взлетит.\nТы уже уничтожал гнездо — теперь очередь арсенала.\n\nРежим — БОМБА',
    storyOutro: 'Завод горит.\nОсталась только цитадель.',
    width: 4200,
    height: 900,
    ...genCampaignMapData(19, 4200, 900, 'BOMB', 'zavod'),
    enemies: 19,
    allies: 5,
    bots: 8,
    scoreLimit: 4,
    enemyTypes: ['Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank', 'Sniper', 'Assault', 'Medic', 'Tank', 'Sniper'],
    objective: 'Бомба: установи заряд на базе врага',
    reward: { coins: 1500, experience: 360 }
  },
  {
    id: 20,
    theme: 'pustoch',
    mode: 'KOTH',
    mapName: 'Цитадель. Захват точек',
    name: 'Цитадель',
    storyIntro: 'Цитадель Химеры. Финальный бой.\nДержи три бастиона, пока идёт штурм.\nТы начинал как новобранец — а теперь ведёшь армию к победе.\n\nРежим — ЗАХВАТ ТОЧЕК',
    storyOutro: 'Химера повержена вслед за «Директором».\n«Синдром» и «Рой» стёрты из истории.\nТы дважды спас мир. Легенда.',
    width: 4400,
    height: 900,
    ...genCampaignMapData(20, 4400, 900, 'KOTH', 'pustoch'),
    enemies: 20,
    allies: 5,
    bots: 8,
    scoreLimit: 300,
    enemyTypes: ['Tank', 'Sniper', 'Assault', 'Assault', 'Medic', 'Assault', 'Tank', 'Sniper', 'Medic', 'Assault', 'Tank'],
    objective: 'Захват точек: удерживай А, Б и С',
    reward: { coins: 2000, experience: 500 }
  }
];

function getCustomLevels() {
  let custom = [];
  try {
    const raw = localStorage.getItem('sideShooterCustomLevels');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) custom = parsed;
    }
  } catch (e) { /* ignore */ }
  return custom.map((level, i) => normalizeCustomLevel(level, i));
}

function normalizeCustomLevel(level, i) {
  if (!level || !level.objects) {
    console.warn('[levels] normalizeCustomLevel: пропуск битого кастомного уровня', level);
    return null;
  }
  level.id = 1000 + i;
  level.custom = true;
  level.structure = 'CUSTOM';
  level.enemies = level.enemies
    || level.objects.filter(o => o.spawnType === 'enemy').length
    || 1;
  level.width = level.width || 2400;
  level.height = level.height || 900;
  level.enemyTypes = level.enemyTypes || ['Assault'];
  level.objective = level.objective || 'Уничтожить всех врагов';
  level.reward = level.reward || { coins: 200, experience: 100 };
  return level;
}

export function getAllCampaignLevels() {
  return campaignLevels.concat(getCustomLevels().filter(Boolean));
}
