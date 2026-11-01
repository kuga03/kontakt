import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';



import { gameState, saveGameState } from '../../data/gameState.js?v=171';
import { getAllCampaignLevels } from '../../data/levels.js?v=171';
import { getModeMap, getFreeMap, getRandomMap } from '../../data/modeMaps.js?v=171';
import { isClassUnlocked } from '../../data/weapons.js?v=170';
import { getBotDifficulty } from '../../data/difficulty.js?v=170';

import * as Koth from '../../modes/koth.js?v=169';

import * as Gang from '../../data/gang.js?v=7';
import { isMutId, hasMut, stripToKnife, applySpawnStats } from '../../data/mutators.js?v=2';

import { gameW } from '../../ui/layout.js?v=3';

const classMap = { Assault, Tank, Medic, Sniper };

// Захват точки / матч точек — константы живут в modes/koth.js.
const KOTH_NEED = Koth.KOTH_NEED;
// Матч точек: 5 минут, дальше — победа по счёту или овертайм.
const KOTH_TIME = Koth.KOTH_TIME;

const typeLabels = { Assault: 'Штурмовик', Tank: 'Танк', Medic: 'Медик', Sniper: 'Снайпер' };

const MAP_THEMES = {
  night:     { bg: 0x0a0a2a, below: 0x07091c, rim: 0x0f1430, bgTex: null },
  sunset:    { bg: 0x241024, below: 0x160a18, rim: 0x3b1a33, bgTex: null },
  wasteland: { bg: 0x1a1c12, below: 0x101208, rim: 0x2a2c18, bgTex: 'fon_ulici' },
  krisha:    { bg: 0x1a1820, below: 0x0f1018, rim: 0x2a2830, bgTex: 'fon_krisha' },
  ulica:     { bg: 0x181620, below: 0x0e0e18, rim: 0x242230, bgTex: 'fon_ulici' },
  pechera:   { bg: 0x080808, below: 0x040404, rim: 0x101010, bgTex: 'fon_pechera' },
  peshera:   { bg: 0x0a0a0c, below: 0x060606, rim: 0x121214, bgTex: 'fon_peshera' },
  pustoch:   { bg: 0x1a1208, below: 0x100c04, rim: 0x2a2010, bgTex: 'fon_pustoch' },
  pustinya:  { bg: 0x2a2418, below: 0x1a1610, rim: 0x3a3020, bgTex: 'fon_pustinya' },
  zavod:     { bg: 0x12141a, below: 0x0a0c10, rim: 0x1a1c24, bgTex: 'fon_zavod' }
};

export function init() {
    // once, а не on: инстанс сцены переиспользуется при рестартах,
    // on вешал бы N копий onShutdown (N-кратный _flushPlayTime).
    this.events.once('shutdown', this.onShutdown, this);
  }

export function onShutdown() {
    this._flushPlayTime();
    this.input.setDefaultCursor('default');
    // Добиваем висящие перезарядки: setTimeout переживает рестарт сцены.
    try {
      (this.players || []).forEach(p => {
        (p.inventory || []).forEach(w => { if (w && w.cancelReload) w.cancelReload(); });
      });
    } catch (e) {}
    if (this._pointerDownHandler) {
      this.input.off('pointerdown', this._pointerDownHandler);
    }
    if (this._pointerUpHandler) {
      this.input.off('pointerup', this._pointerUpHandler);
    }
    if (this._moveHandler) {
      this.input.off('pointermove', this._moveHandler);
    }
    if (this._escHandler) {
      this.input.keyboard.off('keydown-ESC', this._escHandler);
    }
    // Переназначаемые клавиши (R/X/G/H/E) — один обработчик 'keydown'.
    if (this._keyHandler) {
      this.input.keyboard.off('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._wheelHandler) {
      this.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
    if (this._startMus) {
      this.input.off('pointerdown', this._startMus);
      try {
        if (this.sound && Phaser.Sound && Phaser.Sound.Events) {
          this.sound.off(Phaser.Sound.Events.UNLOCKED, this._startMus);
        }
      } catch (e) {}
      this._startMus = null;
    }
    if (this._cHandler) {
      this.input.keyboard.off('keydown-C', this._cHandler);
      this._cHandler = null;
    }
    if (this._bHandler) {
      this.input.keyboard.off('keydown-B', this._bHandler);
      this._bHandler = null;
    }
    if (this._vHandler) {
      this.input.keyboard.off('keydown-V', this._vHandler);
      this._vHandler = null;
    }
    if (this.typeTimer) {
      try { this.typeTimer.remove(); } catch (e) {}
      this.typeTimer = null;
    }
    if (this._storyDismiss) {
      try { this.input.off('pointerdown', this._storyDismiss); } catch (e) {}
      try { this.input.keyboard.off('keydown', this._storyDismiss); } catch (e) {}
      this._storyDismiss = null;
    }
    if (this._storyKeyHandler) {
      try { this.input.keyboard.off('keydown', this._storyKeyHandler); } catch (e) {}
      this._storyKeyHandler = null;
    }
    // Мобильные джойстики: снять тач-хендлеры и снести круги.
    try {
      if (this._touch && this._touch._destroy) this._touch._destroy();
    } catch (e) {}
    this._touch = null;
    this._storyOpen = false;
  }

export function create(data) {
    this.mode = data.mode || 'TDM';
    this.selectedClass = data.selectedClass || 'Assault';
    // Страховка от закрытого класса (старый сейв/прямой старт):
    // танк со 2, медик с 3, снайпер с 4 уровня.
    try {
      if (!isClassUnlocked(this.selectedClass, gameState.level)) this.selectedClass = 'Assault';
    } catch (e) { this.selectedClass = 'Assault'; }
    this.levelIndex = data.levelIndex || 0;
    this.playerName = data.playerName || 'Игрок';
    // Контрактный бой банды идёт на своих случайных настройках —
    // состав/сложность/карта/лимиты свободной игры сюда не текут
    // (иначе 1 vs 8 из лобби перетекают в бой банды).
    const _contract = !!data.contractId;
    this.scoreLimit = data.scoreLimit || 30;
    // BOMB: матч до выбранного числа установок (лимит из лобби 1/3/5).
    if (this.mode === 'BOMB') {
      this.scoreLimit = Phaser.Math.Clamp(data.scoreLimit || 3, 1, 5);
    }
    if (_contract) {
      if (this.mode === 'CTF') this.scoreLimit = [3, 5, 7][(Math.random() * 3) | 0];
      else if (this.mode === 'BOMB') this.scoreLimit = [1, 3][(Math.random() * 2) | 0];
      else if (this.mode === 'KOTH') this.scoreLimit = [200, 300][(Math.random() * 2) | 0];
      else this.scoreLimit = [30, 45][(Math.random() * 2) | 0];
    }
    // Число ботов из лобби: FFA — всего (botCount), командные — по
    // командам (blueBots/redBots, игрок сверх синих). Старые сейвы без
    // полей откатываются на botCount. Диапазон 0–8, иначе 4/5.
    const _bc = gameState.botCount;
    this.botCount = [2, 3, 4, 5, 6, 8].includes(_bc) ? _bc : 4;
    const _bb = Number.isInteger(gameState.blueBots) ? gameState.blueBots
      : ([2, 3, 4, 5, 6, 8].includes(_bc) ? _bc : 5);
    const _rb = Number.isInteger(gameState.redBots) ? gameState.redBots
      : ([2, 3, 4, 5, 6, 8].includes(_bc) ? _bc : 5);
    this.blueBots = Math.max(0, Math.min(8, _bb));
    this.redBots = Math.max(0, Math.min(8, _rb));
    // Бенчмарк: фиксированный состав 8v8 (игрок-призрак заполняет слот синих).
    if (data.benchmark) {
      this._benchmark = true;
      this.blueBots = 8;
      this.redBots = 8;
    }
    if (_contract) {
      // Своя случайная война: синих 3–5, красных — столько же + твой отряд.
      let _raid = 0;
      try { _raid = (Gang.pickRaidFighters() || []).length | 0; } catch (e) { _raid = 0; }
      this.botCount = 3 + ((Math.random() * 3) | 0);
      this.blueBots = this.botCount;
      this.redBots = Math.max(1, Math.min(8, this.blueBots + Math.min(4, _raid) + ((Math.random() * 2) | 0)));
    }
    // CTF: лимит доставок в sane-диапазоне (защита от битого значения).
    if (this.mode === 'CTF') {
      if (!Number.isFinite(this.scoreLimit)) this.scoreLimit = 3;
      this.scoreLimit = Phaser.Math.Clamp(this.scoreLimit, 1, 10);
      console.info('[CTF] match limit=', this.scoreLimit);
      // k300: старт сразу с ОТ (кнопка в лобби) — золото в центре
      // с первой секунды, обычных флагов нет.
      this._suddenStart = _contract ? Math.random() < 0.5 : !!data.suddenStart;
    }
    // KOTH: лимит очков в sane-диапазоне + лог (были матчи без конца
    // при счёте за 600 — значение смотрим в F12).
    if (this.mode === 'KOTH') {
      if (!Number.isFinite(this.scoreLimit)) this.scoreLimit = 200;
      this.scoreLimit = Phaser.Math.Clamp(this.scoreLimit, 50, 1000);
      console.info('[KOTH] match limit=', this.scoreLimit);
    }
    this.isPaused = false;
    this.gameOver = false;
    this.matchCoins = 0;
    this.matchXP = 0;
    // Трекинг активности для АФК-ворот + счётчик захватов KOTH.
    // Инстанс сцены переиспользуется — сбрасываем каждый матч.
    this._activeSecs = 0;
    this._idleSecs = 0;
    this._secT = 0;
    this._secMouse = this._secFire = this._secDmg = false;
    this._dmgMark = 0;
    this._lastPX = this._lastPY = this._lastMX = this._lastMY = null;
    this._playerAfk = false;
    this._kothCaps = 0;
    this._fbDone = false;
    this._fbMine = false;
    // Банда (п.14.6): очередь бойцов в этот матч + контракт + список участников.
    this._gangQueue = [];
    this._gangFighters = [];
    this._gangContractId = data.contractId || null;
    this._wstats = null;
    this._objStats = null;

    this._trialResult = null;
    // Инстанс сцены переиспользуется: чистим JS-мусор прошлого матча
    // (дисплей/часы/твины/коллайдеры чистит сам движок).
    this._shootingPointer = null;
    this._usedBotNames = null;
    this._aiPhaseSeq = 0;
    this.victoryElems = null;
    this._modalElems = [];
    this._killFeed = [];
    this._losRects = [];
    // Навграф прошлого матча протух: сцена переиспользуется, а геометрия
    // новой карты другая (редакторские — тем более). Ленивая сборка в
    // _navPathTo подхватит заново, eager-досборка — в create() ниже.
    this._navGraph = null;
    this._navGrid = null;
    this._navRects = null;
    this._navBudgetF = -1;
    this._navBudgetN = 0;
    this.trialSpawnQueue = [];
    this.trialAllies = 0;
    this._scoreSig = null;
    // Счётчик возрождения + очередь баннеров событий (рестарт — с нуля).
    this._respawnAt = 0;
    // Статистика флангов и журнал краж (k194): учёт с нуля каждый матч.
    this._laneStat = {};
    this._stealLog = [];
    this._stealSeq = 0;
    // Журнал моих попаданий (k210): с нуля каждый матч.
    this._hitLog = [];
    // Журнал убийств (k211): с нуля каждый матч.
    this._killLog = [];
    // Журнал остановок (k234): с нуля каждый матч.
    this._stopLog = [];
    // Журнал пил (k225): с нуля каждый матч.
    this._sawLog = [];
    // k308: счётчики пил/ролей/носильщиков — тоже с нуля каждый матч
    // (были сквозные по сессии: в SRC висели боты прошлых матчей,
    // SAWC копился — лог пух на ~40 строк мусора).
    this._sawCounts = {};
    this._srcStat = {};
    // Время по зонам карты (k369): % времени бота по зонам youPlace.
    this._zoneStat = {};
    this._carryDecomp = {};
    this._gapTicks = 0;
    // Трекинг походов (k221): цель→приход/сброс. С нуля каждый матч.
    this._journey = {};
    this._journeyLog = [];
    // История ног для дрожи (k233) + кулдауны. С нуля каждый матч.
    this._feetHist = {};
    this._judRep = {};
    this._respawnTxt = null;
    this._banners = [];
    // Спавны кампании не тащим в свободные режимы (иначе игрок встаёт
    // по stale-точке прошлого кастомного уровня — хоть под картой).
    // createMap перезапишет при уровне с объектами.
    this.campaignSpawns = { player: null, team: [], enemy: [] };
    this.campaignItems = [];
    // Ленивые объекты прошлого матча протухают: движок при рестарте сносит
    // display list, а JS-ссылки висят на уничтоженном (трассеры рисовались
    // в пустоту со второго матча — «пропали пули»). Создадутся заново.
    this.tracerGfx = null;
    this._bordersDrawn = false;
    // Состояние овертаймов с прошлого матча не тащим (было только
    // для CTF — stale-флаг _tdmOvertime=true заканчивал новый TDM первым килом).
    // Мёртвые *EndsAt-якоря снесены: дедлайны идут от _modeT0loop + dur.
    this._ctfOvertime = false;
    this._classicSnapDone = false; // k374: снимок классики — раз за матч.

    this._midNext = 0; // k394: следующий порог mid-снапшота.
    this._tdmOvertime = false;
    this._bombOvertime = false;
    this._kothOvertime = false;
    // Флаги диагностики победы KOTH (баг 141/100 без финала): сбрасываем
    // каждый матч, иначе рестарт унаследует чужое состояние.
    this._kothWinLogged = false;
    this._kothWinStuck = 0;
    // Метка старта матча: таймауты/овертаймы раньше 45с невозможны
    // (защита от скачка часов и stale-состояния — «ОТ с первой секунды»).
    this._modeT0 = 0;
    // Якорь старта по НЕУБИВАЕМОМУ времени цикла (k203): дедлайны матчей
    // ставятся по часам сцены (this.time.now), а update/HUD проверяют по
    // времени цикла — после рестарта часы сцены с нуля, цикл продолжает счёт,
    // и свежий матч мгновенно «истекал» (новая игра сразу с ОТ). Длительности
    // ниже + якорь дают дедлайн на одних часах. 0 = ещё не заякорен.
    this._modeT0loop = 0;
    this._ctfDur = 0;
    this._tdmDur = 0;
    this._bombDur = 0;
    this._kothDur = 0;
    this.ctfSuddenFlag = null;
    // Часы могли остаться замороженными после выхода из паузы.
    try { this.time.paused = false; } catch (e) {}
    try { this.tweens.timeScale = 1; } catch (e) {}
    // Трекинг для showcase/ачивок (меню v2): класс и время старта.
    try {
      gameState.lastClass = this.selectedClass || gameState.lastClass || 'Assault';
      saveGameState();
    } catch (e) {}
    this._playT0 = this.time.now;

    // Музыка боя (глушим менюшную). Тот же принцип, что в меню: не дёргаем
    // трек, если он уже играет (ретрай/следующий уровень продолжают музыку).
    this._musStarted = false;
    const musPlaying = () => {
      try {
        return this.sound.sounds.some(s => s.key === 'mus_other' && s.isPlaying);
      } catch (e) {
        return false;
      }
    };
    const startMus = () => {
      try {
        if (this._musStarted || musPlaying()) return;
        if (!this.cache.audio.exists('mus_other')) return;
        if (this.sound.locked) return;
        // Успех — только если play реально стартовал (при musicVol=0 патч
        // возвращает null: флажок не взводим, слушатель остаётся до успеха).
        if (this.sound.play('mus_other', { loop: true, volume: 0.32 })) {
          this._musStarted = true;
          try { this.input.off('pointerdown', startMus); } catch (e) {}
        }
      } catch (e) { /* noop */ }
    };
    this._startMus = startMus;
    try {
      if (this.sound) {
        if (!musPlaying()) this.sound.stopAll();
        startMus();
        this.input.on('pointerdown', startMus);
        // Гарантия после анлока контекста: наш клик мог прийти раньше.
        if (this.sound.locked && Phaser.Sound && Phaser.Sound.Events) {
          this.sound.once(Phaser.Sound.Events.UNLOCKED, startMus);
        }
      }
    } catch (e) { /* без звука игра не встанет */ }

    this.campaignLevel = null;
    // Сюжетная миссия в режиме свободной игры (уровни 2–10): каждый уровень
    // кампании — это один из игровых режимов со своей картой. Правила,
    // спавны, объекты и победа — полностью режимные; прогресс кампании
    // (награды, переход дальше) даёт победа игрока (см. endGame).
    this.campaignMission = null;
    // Контракт банды: карта случайная, не выбор лобби (см. _contract выше).
    if (this._gangContractId) {
      this.campaignLevel = getRandomMap(this, this.mode);
    } else if (this.mode === 'CAMPAIGN') {
      const all = getAllCampaignLevels();
      this.campaignLevel = all[this.levelIndex] || all[0];
      const lvMode = this.campaignLevel && this.campaignLevel.mode;
      if (this.campaignLevel && lvMode && lvMode !== 'CAMPAIGN' && !this.campaignLevel.tutorial && !this.campaignLevel.custom) {
        this.mode = lvMode;
        this.campaignMission = this.campaignLevel;
        // Масштаб миссии из уровня (иначе все миссии одинаковые по ботам).
        // Лоббийные blue/red в кампании не действуют — состав из уровня.
        if (Number.isFinite(this.campaignLevel.bots)) {
          this.botCount = this.campaignLevel.bots;
          this.blueBots = this.campaignLevel.bots;
          this.redBots = this.campaignLevel.bots;
        }
        if (Number.isFinite(this.campaignLevel.scoreLimit)) this.scoreLimit = this.campaignLevel.scoreLimit;
        if (this.mode === 'BOMB') {
          this.scoreLimit = Phaser.Math.Clamp(this.scoreLimit, 1, 5);
        }
        if (this.mode === 'CTF') {
          this.scoreLimit = Phaser.Math.Clamp(this.scoreLimit, 1, 10);
        }
        if (this.mode === 'KOTH') {
          this.scoreLimit = Phaser.Math.Clamp(this.scoreLimit, 50, 1000);
        }
      }
    } else if (this.mode === 'CTF' || this.mode === 'BOMB' || this.mode === 'KOTH') {
      // Большая карта режима (maps/*.json) идёт той же веткой, что уровень
      // кампании: createMap строит объекты, ширина/тема берутся из неё.
      // Выбор карты в лобби («Карта: …») приоритетнее карты по режиму.
      this.campaignLevel = getFreeMap(this) || getModeMap(this, this.mode);
    } else if (this.mode === 'FFA' || this.mode === 'TDM') {
      // Свободная игра на выбранной карте: геометрия и фон — из файла,
      // спавны/победа — обычные режимные (точек/флагов у FFA/TDM нет).
      this.campaignLevel = getFreeMap(this);
    }
    // Сложность — ПОСЛЕ оверрайда режима миссии выше: миссии кампании идут
    // по настройке кампании, свободные режимы — по свободной. Раньше стояло
    // до оверрайда и миссия получала freeDifficulty + stale с прошлого матча.
    // Песочница в кампании и испытании не живёт (битый сейв откатываем
    // на бывалого — иначе пассивные боты и фарм без сопротивления).
    let _dk = gameState[(this.mode === 'CAMPAIGN' || this.campaignMission) ? 'campaignDifficulty' : 'freeDifficulty'];
    // Контракт банды: сложность случайная (кроме песочницы — там без
    // сопротивления и без последствий, бою банды там не место).
    if (_contract) _dk = ['novice', 'experienced', 'veteran'][(Math.random() * 3) | 0];
    if ((this.mode === 'CAMPAIGN' || this.campaignMission || this.mode === 'TRIAL') && _dk === 'sandbox') {
      _dk = 'experienced';
    }
    this.botDifficulty = getBotDifficulty(_dk);

    // Ширина арены по режиму: KOTH — шире (три точки врозь),
    // BOMB — средняя (две базы + центр), остальные — 3000.
    if (this.campaignLevel) {
      this.mapWidth = this.campaignLevel.width;
    } else if (this.mode === 'KOTH') {
      this.mapWidth = 3600;
    } else if (this.mode === 'BOMB') {
      this.mapWidth = 3200;
    } else {
      this.mapWidth = 3000;
    }
    this.mapHeight = this.campaignLevel ? this.campaignLevel.height : 900;

    if (this.mode === 'FFA' || this.mode === 'TDM' || this.mode === 'CTF' || this.mode === 'BOMB' || this.mode === 'KOTH') {
      this.enemySpawnPoints = [];
      // KOTH: волна возрождения каждые 10с (в кампании 7с — иначе одна
      // смерть превращается в снежный ком и спавн-кемп). CTF — 9с (+3 к базе).
      // Остальные — 6с.
      this.respawnDelay = this.mode === 'KOTH' ? (this.campaignLevel ? 7000 : 10000) : this.mode === 'CTF' ? 9000 : 6000;
      this.lastSpawnCheck = 0;
    }

    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.setBackgroundColor('#0a0a2a');
    this.input.setDefaultCursor('none');
    // Вариант арены на матч (0/1) — ДО createMap: от него зависят и фон,
    // и раскладка. Симметрия и прыгаемость сохраняются в обоих.
    this._arenaVariant = Phaser.Math.Between(0, 1);

    if (this.mode === 'FFA') {
      // botCount — всего участников-ботов; +1 слот под игрока.
      this.ffaSpawns = this.pickSpawns((this.botCount || 4) + 1);
    }

    if (this.mode === 'CAMPAIGN') {
      this.enemiesActiveAt = this.time.now + 2500;
    }

    // Мутаторы (п.14.2): только ивент из меню (data.mutators).
    // Контракты и кампания/триал — всегда без мутаторов (режимы не смешиваются).
    // Поле матча mutators — ставит ивент-кнопка, лобби тумблеров больше нет.
    let _ev = [];
    try {
      if (Array.isArray(data.mutators)) _ev = data.mutators.filter(isMutId).slice(0, 2);
    } catch (e) { _ev = []; }
    const _teamMode = ['FFA', 'TDM', 'CTF', 'BOMB', 'KOTH'].includes(this.mode);
    this.mutators = (_teamMode && !this._gangContractId) ? _ev : [];
    // Луна: гравитация ×0.5 на весь мир сцены (прыжки и физика летят дальше).
    try { this.physics.world.gravity.y = hasMut(this.mutators, 'moon') ? 450 : 900; } catch (e) {}
    this.createMap();
    this.createPlayer();
    this.createEnemies();
    // Бенчмарк: игрок-призрак — невидимый, без физики, вне боя (слот синих
    // закрыт, чтобы был честный 8v8 ботов). Управление отключено флагом.
    if (this._benchmark && this.player) {
      this.player._demoPuppet = true;
      this.player._benchmarkGhost = true;
      try { this.player.body.enable = false; } catch (e) {}
      try { this.player.setVisible(false); } catch (e) {}
      try { if (this.player.nameText) this.player.nameText.setVisible(false); } catch (e) {}
      try { if (this.player.healthBar) this.player.healthBar.setVisible(false); } catch (e) {}
      try { if (this.player.armorBar) this.player.armorBar.setVisible(false); } catch (e) {}
      this.player.x = this.mapWidth / 2;
      this.player.y = this.mapHeight + 2000;
    }
    // Мутаторы на спавне игрока (поверх выдачи конструктора).
    try {
      if (hasMut(this.mutators, 'knives') && this.player) stripToKnife(this.player);
      if (this.player) applySpawnStats(this.player, this.mutators);
    } catch (e) {}
    // Туман: один overlay на всю сцену + дальность уже урезана (spawnStats/aim).
    // Адаптив: ширина под экран (центр выставит _repositionFog в update).
    try {
      if (hasMut(this.mutators, 'fog')) {
        const _fogW = gameW(this);
        const fog = this.add.rectangle(640, 360, _fogW, 720, 0x0a1020, 0.55).setScrollFactor(0).setDepth(90);
        const fog2 = this.add.rectangle(640, 360, 900, 500, 0x0a1020, 0.25).setScrollFactor(0).setDepth(90);
        this._fogOverlay = [fog, fog2];
        this._fogW = _fogW;
      } else this._fogOverlay = null;
    } catch (e) { this._fogOverlay = null; }
    // Щит спавна 1с всем на старте матча (k206): конструкторы ботов revive
    // не зовут, поэтому взводим тут всем разом, включая игрока.
    try {
      (this.players || []).forEach(p => {
        if (p && typeof p._applySpawnProt === 'function') p._applySpawnProt();
      });
    } catch (e) {}

    this.createModeObjects();
    // Eager-bake проходимости: один раз на загрузке матча (~5-15мс),
    // а не с хичом посреди боя на первой мысли бота. Работает на любой
    // карте — читает живые platforms/covers, включая редакторские.
    try { this._navGraph = this._buildNavGraph(); } catch (e) { this._navGraph = null; }
    this.createInput();
    this.createHud();
    this.createPauseMenu();

    this.cameras.main.setBounds(-900, -800, this.mapWidth + 1800, this.mapHeight + 1600);
    this.cameras.main.cullPaddingX = 3000;
    this.cameras.main.cullPaddingY = 3000;
    if (this._benchmark) {
      // Камера отдалена — вся карта в кадре (замер FPS реального боя).
      const _cw = gameW(this), _ch = 720;
      const _z = Math.min(_cw / this.mapWidth, _ch / this.mapHeight);
      this.cameras.main.setZoom(_z);
      this.cameras.main.centerOn(this.mapWidth / 2, this.mapHeight / 2);
    } else {
      this.cameras.main.setZoom(this.getDesiredZoom(this.player.weapon?.range || 700));
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }
    this._introDone = false;
    this._aimInit = false;

    this.setupTutorial();

    if (this.campaignLevel && this.campaignLevel.storyIntro && !gameState.demoMode) {
      // k623: в demo (боты без игрока) интро ПРОПУСКАЕМ: showStory ставит
      // _storyOpen=true, а закрыть его может только игрок — иначе matchTick
      // (guard: isPaused||gameOver||_storyOpen) стоит на паузе, боты замерли.
      // Время чтения интро — не время матча: якорь для сдвига дедлайнов
      // в onComplete (иначе долгое чтение съедает раунд).
      this._storyT0 = this.time.now;
      this.showStory(this.campaignLevel.storyIntro, () => {
        this._introDone = true;
        if (this.tut) this.tut.started = this.time.now;
        // Сдвиг часов матча на чтение интро (та же механика, что выход из паузы).
        // Ключи — только живые loop-якоря (дедлайны идут от _modeT0loop).
        try {
          const skipped = Math.max(0, this.time.now - (this._storyT0 || this.time.now));
          if (skipped > 0) {
            for (const k of ['_modeT0loop', '_respawnAt', 'trialStart']) {
              if (Number.isFinite(this[k]) && this[k] > 0) this[k] += skipped;
            }
            try {
              (this.players || []).forEach(p => {
                if (p && p.dead && Number.isFinite(p.diedAt) && p.diedAt > 0) p.diedAt += skipped;
              });
            } catch (e2) {}
            if (Number.isFinite(this.enemiesActiveAt)) this.enemiesActiveAt += skipped;
          }
        } catch (e) {}
        this._storyT0 = 0;
        this.physics.resume();
      });
      this.physics.pause();
    }
  }
