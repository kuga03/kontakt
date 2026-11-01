import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';
import Flag from '../../entities/Flag.js?v=170';
import Bomb from '../../entities/Bomb.js?v=169';



import { MAP_VER } from '../../data/modeMaps.js?v=171';

import * as MapPrims from '../../world/mapPrimitives.js?v=304';

import * as Koth from '../../modes/koth.js?v=169';

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

export function createModeObjects() {
    this.scores = { blue: 0, red: 0 };
    // Метка версии (диагностика): какая карта и какой код ИИ реально
    // загрузились в этом матче. Висит 5с + дубль в консоль (F12).
    // CODE_TAG bumpается при каждом изменении кода (карта — отдельно).
    // Руками: правится здесь, дублируется в normver-версию модулей.
    // k336: ловушка фетча sudden в STOP (только чтения, поведения ноль).
    // k337: детур не уводит от ближней цели (<400, сторона против гола).
    // k338: fetch-ловушка в STOP расширена на attack/carry (только чтения).
    // k339: детур спиной к голу запрещён всегда (был <400).
    // k340: ловушка wedge в анти-стаке (только журнал, поведения ноль).
    // k341: причина wedge через st.why (scope внутренних let).
    // k342: гейт детура сбрасывает точку против живого гола (см. modes.js).
    // k343: back-шаг анти-стака не уводит от ближнего гола (flat).
    // k344: сбросы детура против гола в SAW detdrop (только журнал).
    // k345: ловушки chskip/chgrab жизненного цикла цепи (только журнал).
    // k346: back-шаг не уводит от проноса носильщика (flat, любая дальность).
    // k347: wg-причина анти-стака в STOP (только журнал).
    // k348: причина wall у контактного клина (только журнал + честный скип).
    // k349: скип-часы цепи не сбрасываются ребилдом на тот же idx (см. modes.js).
    // k350: dx/dy/feet/wall/blk в chskip/chgrab (только журнал).
    // k351: nx/ny новой точки + was срыва в тех же строках (только журнал).
    // k352: анти-парковка не срывает лазанье (только _navClimb-ветка).
    // k353: covdet в cover-ветке moveToward (только журнал).
    // k354: l/r/d в detdrop создания (только журнал).
    // k355: cover-ветка не детурит лезущего (пара к k352, см. move.js).
    // k356: ловушка форта-2917 в fetch-STOP (только журнал, см. dump.js).
    // k357: скип точки цепи сквозь потолок (bonk, см. modes.js).
    // k358: форт-ловушка v2 (h-биты высот + ab, только журнал, см. dump.js).
    // k359: подхват цепи мимо пробитой точки (bonk-memory, см. modes.js).
    // k360: hop при tile-губе рядом (только level-гол, см. move.js).
    // k361: ловушка heal-защёлки (только журнал, см. dump.js).
    // k362: губа отменяет дальний back (см. ниже, k343-блок).
    // k363: скип точки цепи под рядом-плитой (probe, см. modes.js).
    // k364: форс-скип не чаще 1/3с + память-множество (каскад k363).
    // k365: нутро нав-плана в fetch-STOP (только журнал, см. dump.js).
    // k366: состояние попыток подъёма в fetch-STOP (только журнал).
    // k367: задача прыжка (jsrc в строке + src в hop0, только журнал).
    // k368: cooldown повтора дохлого golden-разбега (см. move.js).
    // k369: учёт времени по зонам карты ([ZONE], см. dump.js).
    // k370: jsrc в whitelist короткой строки (см. dump.js).
    // k371: ловушка стены-768 в detdrop создания (ws/ww/wd, только журнал).
    // k372: 10с-бакет ключей detdrop + шире хвосты SAW/STOP (только журнал).
    // k373: SAW по видам + честные счётчики + ROWCUT (только журнал).
    // k374: снимок классики на старте овертайма (см. ctf.js + dump.js).
    // k375: сброс эскалации на сбросе гарда детура (wide-цикл, см. move.js).
    // k376: пропуск пустого снимка классики (см. ctf.js).
    // k377: снимок копим на старте ОТ, пишем в конце + [SNAP].
    // k378: явные фазы CTF в дампе (см. dump.js).
    // k379: давка fails-эскалации при отказах гарда (см. move.js).
    // k380: давка сноса нава форсированным широким при отказах гарда (см. move.js).
    // k381: ловушка владельца руля mv (см. dump.js).
    // k382: k360-проба шире 50/70/90 (см. move.js).
    // k383: сдвиг валидатора + стартовый лог спавнов (см. ниже + dump.js).
    // k384: стартовые t<=5 всегда в выводе (см. dump.js).
    // k385: чинка фильтра t=0 (см. dump.js).
    // k386: кап не вытесняет стартовые (см. dump.js).
    // k387: снапшоты входа (см. update + dump.js).
    // k388: профиль ступени eh (см. dump.js).
    // k389: хоп ступени при цели выше (см. move.js).
    // k390: событие выстрела хопа hopf (см. move.js).
    // k391: hopf-хвост только гринд в задаче (см. move.js).
    // k392: история прыжков hq в STOP (см. dump.js).
    // k393: разбег для хопа (см. move.js).
    // k394: mid-снапшоты длинных матчей (см. update + match.js + dump.js).
    // k395: аптечки hl в STOP (см. dump.js).
    // k396: guard китов в щелях + сбросы runup/refuse (см. survival.js).
    // k397: боевой трек wallshot/ult/nade (см. shoot.js + abilities.js).
    // k398: give-up погони за китом (см. survival.js).
    // k399: канал кита — первый не вытесняется (см. Pickup.js).
    // k400: триггер разбега hq-style + событие runup (см. move.js).
    // k401: разбегу deny дуэлей + nook-guard (см. move.js).
    // k402: подъём спавна i=4 над средней ступенью (карман 3023, см. выше).
    // k403: часы скипа цепи живут с начала серии подхватов (см. modes.js).
    // k404: LOS-гейт подбора/возврата/доставки флага (см. ctf.js).
    // k405: точки цепи мимо столбца ящиков (см. modes.js CTF_LANES).
    // k406: [880,520]→[830,520] в обеих high-ветках (край ступени).
    // k407: гейт точки прицела против стены (см. shoot.js).
    // k408: [830,520]→[780,520] в обеих high-ветках (короткий прыжок).
    // k409: ловушка взлёта у цепной точки stair (см. modes.js).
    // k411: гейты немых стоянок above/snipe/duelidle/edge (см. EnemyAI).
    // k412: штамп исхода руля veto в moveToward + STOP (см. move.js/dump.js).
    // k413: гейт holdfire + выход из тщетных краевых прыжков (см. EnemyAI/modes.js).
    // k414: гейты anchor + широкая дуэль + штамп walk (см. EnemyAI/move.js).
    // k415: гейт огневого рубежа volley (см. EnemyAI).
    // k416: LOS-гейт дамаг-ульт + ultwait (см. abilities.js).
    // k417: unstick считает X и прирост высоты раздельно (см. выше).
    // k418: hopB + midcross (см. EnemyAI) + вставание со сдвигом (см. ниже).
    // k419: ловушка маршрута кражи atkroute (см. dump.js logSteal, только чтения).
    // k420: ловушка маршрута носильщика carryroute (см. modes.js ctfCarry, только чтения).
    // k421: форма пути в carryroute np/ni/goldage (см. modes.js, только чтения).
    // k422: сторож прогресса к голу navstuck + радиус-скип (см. modes.js ctfMove).
    // k423: проба солида ребра ed в carryroute (см. modes.js, только чтения).
    // k424: зона обхода _navAvoid в A* (см. modes.js/move.js).
    // k425: ярусы проноса tier/runT в CARR (см. dump.js decompTick).
    // k426: счётчики заказчиков прыжков (см. move.js forceJump).
    // k427: коридор проноса по угрозе (см. modes.js ctfCarry).
    // k428: анти-двойной счёт SAWC-видов, считающих себя сами (см. dump.js logSaw).
    // k429: контекст up-прыжка adx/lip в hopf/jump/jumploop (см. move.js forceJump).
    // (k410 пропущен: номер отменённой механики взлёта, пара едет k411+d411 и дальше.)
    // k443: таймаут держания holdhigh под видимым врагом (15с) + ловушка hhstop
    //       (см. modes.js ctfAct: _hhStopSince/_hhStopUntil, _logSaw 'hhstop').
    // k444: holdhigh держится только при строгом LOS до врага; без луча —
    //       идём к врагу (сближение), а не столбом (см. modes.js ctfAct _los444).
    // k445: детур исполняем в ctfMove (раньше _detourX ставился, но не читался —
    //       бот стоял у стены, detstuck эскалировал вхолостую) — ctfMove.js:11.
    // k446: обе посадки детура заняты — не ставим детур (иначе цикл поставил→
    //       сбросил→поставил) — nav.js:235.
    // k447: seek'ы (heal/ammo/grenade) не стопорятся latch — бот дойдёт до кита
    //       (или упрётся в стену → рабочий детур), вечный latch у щели исчезает — locomotion.js:83.
    // k448: ПРОВАЛ, откачен (боты стояли на ките дольше — freeze 23→44).
    // k449: свежий детур (<2.5с) не сбрасываем гейтом «против гола» (k342) —
    //       он валил обход препятствия, поставленный анти-стаком/парком
    //       (x=768/3017: бот зажат, гейт сбрасывал обход, бот жал в стену,
    //       freeze100/70) — ctfAct.js:116 + nav.js:371 (_detourSetAt).
    // k450: ПРОВАЛ, откачен (dropStep стоял ПОСЛЕ детур-консьюмера —
    //       детур перехватывал, бот не слезал).
    // k451: бот застрял у стены (цикл детуров + blocked) — спрыгиваем с крышки
    //       ОТ стены, СТРОГО ДО детур-консьюмера (иначе детур перехватывает) —
    //       ctfMove.js:11.
    // k452: ловушка k451drop (видимость срабатываний k451) — без правок поведения.
    // k453: разбор дампа k452-092339 — кластеры 767/3017 живут при bl=00 (мгновенный
    //       blocked мерцает, но анти-стак уже поймал стену _wedgeWhy='wall'):
    //       (A) триггер k451 расширен на wedge-wall при n>=3 (кроме _navClimb) — ctfMove.js:11;
    //       (C) детур «от цели» разрешён, когда сторона К ЦЕЛИ закрыта стеной — nav.js:285;
    //       (E) эскорт у края спускается при зацикленном детуре (freeze40 форта) — climb.js:156;
    //       (D) карта: щели 750–770 / 3030–3050 залиты (платформы 610–770 / 3030–3190) — maps/ctf.json.

    if (this.mode === 'FFA') {
      this.scores = {};
      this.players.forEach(p => {
        this.scores[p.playerName] = p.kills || 0;
      });
    }
    this.pickups = this.physics.add.group();
    this.grenades = this.physics.add.group();
    this.smokeClouds = [];
    this._losRects = [];

    // Подбор — через канал 2.5с в Pickup.update (стоишь — полоска растёт):
    // мгновенного оверлапа больше нет, иначе кит исчезал без канала.
    // Оверлапы ботов убраны той же правкой (_bindPickupOverlap удалён).
    // Оверлапы подборов для ботов больше не нужны: канал в Pickup.update
    // сам находит стоящего (игрока и ботов). Привязки удалены.
    try {
      (this.players || []).forEach(p => {
        if (p) p._pickupBound = true;
      });
    } catch (e) {}
    if (this.campaignItems && this.campaignItems.length) {
      this.campaignItems.forEach(it => this.spawnPickup(it.type, it.x, it.y));
      this.campaignItems = [];
    }
    // TDM/FFA/CTF: лёгкая симметричная арена (раньше была голая плоская
    // земля — ботам не за чем прятаться, фланги/укрытия не работали).
    // Центр и четверти с зазорами от спавнов/флагов (x<350, x>W-350 чисто).
    if (this.campaignLevel) {
      // Карта режима из level-objects (maps/*.json): геометрия уже стоит —
      // процедурные арены не строим, только общий фоновый задник.
      this._addModeDecor();
    } else if (this.mode === 'TDM' || this.mode === 'FFA' || this.mode === 'CTF') {
      this._buildSkirmishArena();
    }
    if (this.mode === 'TDM') {
      // Раунд 5:00; ничья на сирене — овертайм до первого кила.
      // Дедлайн — от _modeT0loop + _tdmDur (мёртвый _tdmEndsAt снесён).
      this._tdmDur = 5 * 60 * 1000;
      this._tdmOvertime = false;
      this._modeT0 = this.time.now;
    }
    if (this.mode === 'CTF') {
      // Флаги — у спавнов команд («Форты», ctf_big 3800×900): точки берём
      // из карты (spawnType flagBlue/flagRed), код ниже — только фолбэк
      // для процедурных карт кампании: СВОЯ земля у спавна (220 / W-220),
      // низ древка на грунте. Старые 480 давали флаг под средней платформой
      // в 8px над землёй: висел в воздухе, физика его швыряла, боты гоняли
      // возврат по кругу. Над базами (x<300) открытое небо — как у спавнов.
      // Низ древка (77/2≈38) ровно на грунте, над точками небо.
      // Добраться можно чистым зигзагом без нависаний (справа зеркально):
      // земля 850 → 730 → 620 → 520 → мост 470, соседние ярусы не
      // перекрываются по X — допрыг без удара головой.
      // Всё в пределах допрыга ботов и игрока.
      // Персонаж влезает с запасом (подбор |dx|≤40,|dy|≤90, доставка
      // касанием флага).
      const groundTop = this.mapHeight - 50;
      const lv = this.campaignLevel;
      const isBigCtf = !!lv && (lv.id === 'ctf_big' ||
        (this.mapWidth === 3800 && (this.mapHeight || 900) === 900));
      let bfx = 220, bfY = groundTop - 36, rfx = this.mapWidth - 220, rfY = groundTop - 36;
      // Точки из карты (spawnType flagBlue/flagRed) — приоритетнее кода:
      // так «Форты» держат флаги у спавнов, а старые карты — как раньше.
      try {
        const fl = this.campaignFlags;
        if (fl && fl.blue && Number.isFinite(fl.blue.x) && Number.isFinite(fl.blue.y)) {
          bfx = fl.blue.x; bfY = fl.blue.y;
        } else if (isBigCtf) {
          bfx = 490; bfY = 372;
        }
        if (fl && fl.red && Number.isFinite(fl.red.x) && Number.isFinite(fl.red.y)) {
          rfx = fl.red.x; rfY = fl.red.y;
        } else if (isBigCtf) {
          rfx = this.mapWidth - 490; rfY = 372;
        }
      } catch (e) {}
      this.blueFlag = new Flag(this, bfx, bfY, 'blue');
      this.redFlag = new Flag(this, rfx, rfY, 'red');
      // Потерянный флаг падает на землю (коллайдеры тела, как у бомбы).
      [this.blueFlag, this.redFlag].forEach(f => {
        if (!f) return;
        this.physics.add.collider(f, this.platforms);
        this.physics.add.collider(f, this.covers);
      });
      // Раунд под лимит доставок — по таблице (ровные цифры):
      // 1 флаг — 2:00, 3 — 5:00, 5 — 8:30, 7 — 12:00, 10 — 17:00.
      // Вне таблицы (битый сейв) — фолбэк 102 с на флаг.
      const CTF_TIME_BY_LIMIT = { 1: 120, 3: 300, 5: 510, 7: 720, 10: 1020 };
      const _ctfSecs = CTF_TIME_BY_LIMIT[this.scoreLimit] || this.scoreLimit * 102;
      this._ctfDur = _ctfSecs * 1000;
      this._ctfOvertime = false;
      this._modeT0 = this.time.now;
      this.ctfSuddenFlag = null;
      // Круги вокруг флагов убраны: только флаги-арты на земле.
      this._flagBases = [];
      // k300: старт сразу с ОТ — оба флага исчезают, в центре золото.
      // Штатный _startCtfSuddenDeath (та же воронка, что на ничьей).
      try {
        if (this._suddenStart && !this.gameOver) this._startCtfSuddenDeath();
      } catch (e) {}
    }
    if (this.mode === 'BOMB') {
      // Две бомбы (по ТЗ): у каждой команды своя на базе.
      // Свою несут на базу врага (5с в зоне — очко), лежащую чужую
      // враг обезвреживает (5с рядом — возврат). Украсть нельзя.
      const gy = this.mapHeight - 80;
      this.blueBase = { x: 220, y: gy };
      this.enemyBase = { x: this.mapWidth - 220, y: gy };
      this.blueBomb = new Bomb(this, 220, gy, 'blue');
      this.redBomb = new Bomb(this, this.mapWidth - 220, gy, 'red');
      // Сброшенная бомба падает на землю (коллайдеры тела).
      [this.blueBomb, this.redBomb].forEach(b => {
        if (!b) return;
        this.physics.add.collider(b, this.platforms);
        this.physics.add.collider(b, this.covers);
      });
      if (!this.campaignLevel) this._buildBombArena();
      // Базы: полоса зоны закладки (±100 — честная ширина зоны) +
      // столбы по краям + подпись. Круга нет. Прогресс закладки —
      // заливка полосы (см. _drawBombBases).
      this._bombRings = {};
      [{ team: 'blue', x: 220 }, { team: 'red', x: this.mapWidth - 220 }].forEach(bd => {
        const g = this.add.graphics().setDepth(2);
        this.add.text(bd.x, gy - 44, bd.team === 'blue' ? 'БАЗА С' : 'БАЗА К', {
          fontSize: '14px', color: bd.team === 'blue' ? '#7db8ff' : '#ff8888', fontStyle: 'bold',
          backgroundColor: '#111133aa', padding: 4
        }).setOrigin(0.5).setDepth(2);
        this._bombRings[bd.team] = { g, x: bd.x, gy, _shown: -1 };
      });
      // Раунд 5:00; глубже всех — счёт проникновения для ничьей.
      // Дедлайн — от _modeT0loop + _bombDur (мёртвый _bombEndsAt снесён).
      this._bombDur = 5 * 60 * 1000;
      this._bombOvertime = false;
      this._modeT0 = this.time.now;
      this._bombT = 0;
      // Овертайм-турель (появляется только при ничьей на сирене, см. update):
      // нейтральный объект в центре, победа — установкой на свою базу (10с в зоне).
      this._turret = null;
    }
    if (this.mode === 'KOTH') {
      // Симметричная арена + три точки (A/C над землёй на ножках,
      // B на платформе). A/C подняты на 34px над землёй, чтобы флаг
      // и полоса захвата не тонули в текстуре земли (было y=GT —
      // бар на GT+10 уходил внутрь грунта 850..900 и точку было
      // не взять/не видно, работала только центральная B).
      if (!this.campaignLevel) this._buildKothArena();
      this.kothPoints = [];
      const GT = this.mapHeight - 50;
      // A/C — иксы из файла карты (koth.json держит A/B/C), иначе доли.
      // Земля во всю ширину везде — A/C всегда на грунте.
      let axF = 0.25, cxF = 0.75;
      try {
        const fp = this.campaignLevel && this.campaignLevel.kothPoints;
        if (fp && Number.isFinite(fp[0].x)) axF = Math.max(0.05, Math.min(0.95, fp[0].x / this.mapWidth));
        if (fp && Number.isFinite(fp[2].x)) cxF = Math.max(0.05, Math.min(0.95, fp[2].x / this.mapWidth));
      } catch (e) {}
      // B — на платформу: ищем верх под центром, иначе достраиваем плиту
      // (чужие файлы/генератор без плиты — флаг парил в воздухе).
      let bTop = GT - 90;
      try {
        const px = Math.round(this.mapWidth * 0.5);
        let best = null;
        (this.platforms ? this.platforms.getChildren() : []).forEach(o => {
          try {
            if (!o || !o.active) return;
            const w = o.displayWidth || o.width || 0;
            if (w < 120) return;
            const top = o.y - (o.displayHeight || o.height || 0) / 2;
            if (Math.abs((o.x || 0) - px) > w / 2) return;
            if (top < GT - 200 || top > GT - 10) return;
            if (best == null || Math.abs(top - (GT - 90)) < Math.abs(best - (GT - 90))) best = top;
          } catch (e) {}
        });
        if (best != null) bTop = best;
        else {
          MapPrims.createPlatform(this, px, GT - 82, 240, 16);
          bTop = GT - 90;
        }
      } catch (e) {}
      // y — логика захвата, gy — земля под флагом (A/C стоят на грунте,
      // B — на платформе). Флаг вбит в gy, а не парит.
      const defs = [
        { x: axF, y: GT - 34, gy: GT, name: 'А' },
        { x: 0.5, y: bTop - 34, gy: bTop, name: 'Б' },
        { x: cxF, y: GT - 34, gy: GT, name: 'С' }
      ];
      defs.forEach(d => {
        const px = Math.round(this.mapWidth * d.x);
        // Точка — флаг-арт на древке (синий/красный/нейтральный по владельцу),
        // вбит низом в землю (gy). Овалов зон нет. Прогресс — полоса под флагом.
        // Нет арта — старый векторный флажок (рисуется в _paintKoth).
        const zone = this.add.graphics().setDepth(1);
        let flagImg = null, flag = null;
        if (this.textures.exists('flag_neutral')) {
          flagImg = this.add.image(px, d.gy + 2, 'flag_neutral')
            .setOrigin(0.5, 1).setDepth(2);
          flagImg.setDisplaySize(48, 103);
        } else {
          flag = this.add.graphics().setDepth(2);
        }
        const bar = this.add.graphics().setDepth(1);
        const lbl = this.add.text(px, d.y - 124, d.name, {
          fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
          backgroundColor: '#111133aa', padding: 4
        }).setOrigin(0.5).setDepth(3);
        const pt = {
          x: px, y: d.y, gy: d.gy, holder: null, prog: 0, tick: 0,
          zone, flag, flagImg, bar, lbl, name: d.name, _st: 'idle', _shown: -1, _shownH: null
        };
        this.kothPoints.push(pt);
        this._paintKoth(pt);
      });
      // Таймер матча 5:00; ничья — овертайм (см. update).
      // Дедлайн — от _modeT0loop + _kothDur (мёртвый _kothEndsAt снесён).
      this._kothDur = KOTH_TIME;
      this._modeT0 = this.time.now;
    }
    // Земля визуально уходит за края карты (без физики).
    // Здесь — после всей постройки: земля уже есть во всех режимах.
    try { MapPrims.addGroundSkirts(this); } catch (e) {}
  }

  // Случайный декор из списка (что есть в текстурах — то и встаёт).
  // Без коллизии, задник. Нет текстуры — пропуск без ошибки.
