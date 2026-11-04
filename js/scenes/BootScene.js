import { applyVolumePatch } from '../data/audio.js';
import { bakeGearTextures } from '../entities/Player.js';
import { MAP_VER } from '../data/modeMaps.js';
import { gameW } from '../ui/layout.js';
import { GAME_VERSION } from './menu/showcase.js';
import { GENERATED, texUrl, FUNNY_LOADS } from './boot/config.js';
// ---- delegated generators (extracted to boot/*.js, called with scene as this) ----
import * as Legs from './boot/legs.js';
import * as Character from './boot/character.js';
import * as GunScan from './boot/gunScan.js';
import * as ArtEnv from './boot/artEnv.js';
import * as ArtSmall from './boot/artSmall.js';
import * as ArtBuildings from './boot/artBuildings.js';
import * as Fallback from './boot/fallback.js';
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Диагностика смерти WebGL (чёрный экран в редакторе): слушаем потерю
    // контекста один раз — в консоли будет видно, КТО и КОГДА его убил.
    try {
      if (!window.__glLossHooked && this.game && this.game.events) {
        window.__glLossHooked = true;
        this.game.events.on(Phaser.Core.Events.CONTEXT_LOST, () => {
          console.error('[GL] context LOST — экран чёрный до восстановления');
        });
        this.game.events.on(Phaser.Core.Events.CONTEXT_RESTORED, () => {
          console.info('[GL] context restored');
        });
      }
    } catch (e) {}
    // Версии ассетов против кэша браузера: браузер кэширует PNG/MP3 по URL,
    // и после замены файла молча отдаёт старый (как сейчас со звуком СТГ).
    // Правило: поменял файлы — подними ASSET_V, всё докачается само.
    // Ручная чистка кэша больше не нужна (и сейвы в localStorage при ней
    // вообще не страдают — они живут отдельно от HTTP-кэша).
    const ASSET_V = '?v=169';
    try {
      ['image', 'audio'].forEach(fnName => {
        const orig = this.load[fnName].bind(this.load);
        this.load[fnName] = (cfg) => {
          if (cfg && typeof cfg === 'object' && typeof cfg.url === 'string') {
            cfg = { ...cfg, url: cfg.url.split('?')[0] + ASSET_V };
          }
          return orig(cfg);
        };
      });
    } catch (e) { /* без версий грузим как раньше */ }
    // Кран громкости (музыка/звуки из настроек): один раз на менеджер.
    try { applyVolumePatch(this.sound); } catch (e) {}
    const W = gameW(this);
    const H = this.scale.height;

    // Градиентный фон (тёмный → чуть светлее внизу).
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x080820, 0x0f0f35, 0x2a1a4a, 1);
    bg.fillRect(0, 0, W, H);
    // Декор фона: процедурные ящики и бочки в углах.
    const decKeys = ['map_crate1', 'map_crate3', 'map_barrel2', 'map_crate7', 'map_barrel5'];
    decKeys.forEach((k, i) => {
      const cx = (i % 2) ? W * 0.85 : W * 0.15;
      const cy = (i < 3) ? H * 0.2 : H * 0.78;
      try {
        const img = this.add.image(cx, cy, k);
        img.setDepth(-20);
        img.setAlpha(0.35);
        img.setDisplaySize(60 + (i * 12), 60 + (i * 8));
      } catch (e) {}
    });
    // Мягкие светящиеся круги для красоты (боке).
    [[W*0.3, H*0.3, 180, 0x5566aa, 0.08], [W*0.7, H*0.7, 220, 0x8844aa, 0.08], [W*0.5, H*0.15, 140, 0x44aaff, 0.06]].forEach(p => {
      try { this.add.ellipse(p[0], p[1], p[2], p[2], p[3], p[4]).setDepth(-25); } catch(e){}
    });
    const barW = Math.min(640, W * 0.65);
    const barH = 18;
    const barX = (W - barW) / 2;
    const barY = H / 2;
    this._barBg = this.add.rectangle(W / 2, barY, barW, barH, 0x333355).setStrokeStyle(1, 0x556688);
    // Светящийся прогресс-бар: тень + яркий градиент.
    this._barGlow = this.add.rectangle(W / 2, barY, barW + 10, barH + 6, 0x44aaff, 0.35).setDepth(-1);
    // Прогресс-бар с градиентом (не фоновые цвета): бирюзовый → золотистый.
    this._barFill = this.add.graphics().setDepth(1);
    this._barFillFill = (w, h) => { this._barFill.clear(); this._barFill.fillGradientStyle(0x00d4aa, 0x66ccff, 0xffd166, 1); this._barFill.fillRect(barX + 1, barY - h/2 + 1, Math.max(0, w), h-2); };
    this._jokeIdx = Math.floor(Math.random() * FUNNY_LOADS.length);
    this._barPct = 0;
    this._barText = this.add.text(W / 2, barY + 24, FUNNY_LOADS[this._jokeIdx], {
      fontSize: '26px', color: '#8899bb'
    }).setOrigin(0.5);
    this._barPctLabel = this.add.text(barX + barW + 14, barY, '0%', {
      fontSize: '14px', color: '#66ccff', fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    // Шутки листаются сами, проценты — по факту загрузки.
    this.time.addEvent({
      delay: 2000, loop: true,
      callback: () => {
        if (!this._barText || !this._barText.active) return;
        this._jokeIdx = (this._jokeIdx + 1) % FUNNY_LOADS.length;
        this._refreshBarText();
      }
    });
    this._barW = barW - 2;
    this._barH = barH;
    this._loadPhase = 'files';
    this._loadedPngKeys = new Set();
    const keys = Object.keys(GENERATED);
    this._totalLoad = 0;
    this._doneLoad = 0;

    // Части тела рисуются кодом (GEO-персонаж, шмотки запекаются): PNG
    // из «невостребовано» не грузим (файлы удалены). Ключи и рисованные
    // фолбэки (generateFallback) остаются — редактор рига и превью их ждут.
    const BODY_PNG_DEAD = new Set([
      'chr_torso', 'chr_head', 'chr_cap', 'chr_shoes',
      'chr_arm_fore_l', 'chr_arm_fore_r', 'jeans_left', 'jeans_right'
    ]);
    // Подборы (аптечки/патроны/броня/гранаты) рисуются кодом
    // (generatePickupArt, ниже) — на оценку владельцу. Файлы PNG пока
    // лежат (вернуть: убрать ключ из сета). Фолбэки остаются.
    const KIT_PNG_CODE = new Set([
      'medkit', 'ammo_kit', 'armor_kit', 'frag_granade', 'smoke_granade',
      'bullet_RPG'
    ]);
    // Файлы удалены с диска — грузить нечего, только 404 в консоль.
    // У каждого ключа ниже есть кодовый фолбэк (GENERATED + generateFallback),
    // игра уже живёт на нём: снятие загрузок ничего не меняет визуально.
    // Вернуть файл: убрать ключ из сета.
    const PNG_FILE_GONE = new Set([
      'player', 'enemy', 'bullet', 'grenade', 'platform', 'cover', 'wall',
      'ground', 'pickup', 'tile',
      'icon_coins', 'icon_rifle', 'icon_smg', 'icon_shotgun', 'icon_sniper',
      'icon_lmg', 'icon_pistol', 'icon_revolver', 'icon_crossbow', 'icon_knife',
      'chr_arms', 'chr_arm_up', 'chr_arm_fore', 'chr_hand', 'chr_hand_l', 'chr_hand_r',
      'chr_pants_thigh', 'chr_pants_shin',
      'chr_pants_thigh_l', 'chr_pants_thigh_r', 'chr_pants_shin_l', 'chr_pants_shin_r',
      'chr_pants_leg_l', 'chr_pants_leg_r'
    ]);
    keys.forEach(key => {
      if (GENERATED[key].kind === 'chrRunFrames') return;
      if (GENERATED[key].kind === 'chrWalkFrames') return;
      if (BODY_PNG_DEAD.has(key)) return;
      if (KIT_PNG_CODE.has(key)) return;
      if (PNG_FILE_GONE.has(key)) return;
      this.load.image({
        key,
        url: texUrl(key + '.png'),
        errorCallback: (e) => { console.warn('[ART] load failed:', key, e); }
      });
    });

    // Кадры ходьбы (walk/sprite_r*_c*-obrezano.png) удалены с диска —
    // загрузки сняты, makeLegsWalkSheet откатывается на фолбэк.
    // Вернуть файлы: вернуть цикл ниже по GENERATED.chr_legs_walk.

    // Кадры бега (chr_legs_run_*.png) удалены с диска — загрузки сняты,
    // makeLegsRunFrames откатывается на фолбэк.
    // Вернуть файлы: вернуть цикл ниже по GENERATED.chr_legs_run.

    // Фоны уровней рисуются кодом (bakePanorama — он же в бою и в редакторе).
    // PNG из assets/backgrounds больше не грузим, кроме fon_menu (меню frozen).
    const BGS = [
      { key: 'fon_menu',     url: 'fon_menu.jpg' }
    ];
    BGS.forEach(bg => {
      this.load.image({
        key: bg.key,
        url: `assets/backgrounds/${bg.url}`,
        errorCallback: () => {}
      });
    });

    // Музыка (assets/audio) и звуки (assets/sounds). Имена файлов на русском —
    // грузим как есть (браузер сам кодирует URL), ключи ASCII.
    const MUSIC = [
      { key: 'mus_menu', file: 'мелодия-меню.mp3' },
      { key: 'mus_city', file: 'мелодия-для-городских-уровней.mp3' },
      { key: 'mus_desert', file: 'мелодия-для-пустынных-уровней.mp3' },
      { key: 'mus_other', file: 'мелодия для других уровней.mp3' }
    ];
    MUSIC.forEach(m => {
      this.load.audio({
        key: m.key,
        url: `assets/audio/${m.file}`,
        errorCallback: () => {}
      });
    });
    // Выстрелы: ключ shot_<ИмяОружия>. Нет файла — тишина (проверка в sfxShot).
    const SHOTS = [
      ['bad_ak47', 'выстрел ак-47.mp3'], ['AK-47', 'выстрел ак-47.mp3'],
      ['AUG', 'Выстрел AUG.mp3'], ['UZI', 'выстрел UZI.mp3'],
      ['P90', 'выстрел P90.mp3'], ['Benelli_M4', 'выстрел Benelli M4.mp3'],
      ['M1918', 'выстрел M1918.mp3'], ['M1911', 'выстрел M1911.mp3'],
      ['Makarov', 'выстрел Makarov.mp3'], ['Glock', 'выстрел Glock.mp3'],
      ['Deagle', 'выстрел Desert Eagle.mp3'], ['revolver', 'выстрел Revolver.mp3'],
      ['SIG_SG_550', 'выстрел SIG SG 550.mp3'],
      ['SIG_SG_543', 'выстрел SIG SG 543.mp3'], ['Sturmgewehr_44', 'выстрел StG 44.mp3'],
      ['SSG', 'выстрел SSG 3000.mp3'], ['LAR', 'выстрел LAR.mp3'],
      ['VKS', 'выстрел VKS.mp3'], ['Barrett_M82', 'Выстрел BARRETT M82.mp3'],
      ['Remington_700', 'выстрел Remington 700.mp3'], ['Winchester', 'выстрел винчестер.mp3'],
      ['М16', 'выстрел М16.mp3'], ['M249', 'Выстрел М249.mp3'],
      // Своих записей у новичков нет — стреляют чужими (файлы есть).
      ['М1913', 'выстрел M1918.mp3'], ['Neuhausen KE-7', 'Выстрел М249.mp3'],
      ['М60', 'Выстрел М249.mp3'], ['Vickers K', 'выстрел минигана.mp3'],
      ['minigun', 'выстрел минигана.mp3'], ['RPG', 'Выстрел РПГ-7.mp3'],
      ['Remington', 'выстрел (не последний патрон) Remington-870.mp3'],
      ['обрез', 'выстрел (не последний патрон) Remington-870.mp3'],
      ['Remington_last', 'выстрел (последний патрон) Remington-870.mp3'],
      // Файл выстрела Сайги на месте; у катаны/мачете файлов нет
      // (ближний бой и так машет sfx_swing_* с exists-проверкой) —
      // загрузки сняты, чтобы не сыпали 404. Вернуть файлы: дописать строки.
      ['Сайга', 'выстрел Сайга.mp3']
    ];
    SHOTS.forEach(([key, file]) => {
      if (!file) return;
      this.load.audio({
        key: 'shot_' + key,
        url: `assets/sounds/${file}`,
        errorCallback: () => {}
      });
    });
    this.load.audio({ key: 'sfx_step', url: 'assets/sounds/звук шага.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_hover', url: 'assets/sounds/звук наведения на ячейку.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_buy', url: 'assets/sounds/Звук покупки.mp3', errorCallback: () => {} });
    // Дополнительные звуки (п.28): взрывы, бросок, взмахи ближнего боя.
    this.load.audio({ key: 'sfx_boom', url: 'assets/sounds/взрыв гранаты.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_boom_smoke', url: 'assets/sounds/взрыв дымовой гранаты.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_boom_rpg', url: 'assets/sounds/взрыв снаряда РПГ.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_throw', url: 'assets/sounds/звук при броске гранаты.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_swing_katana', url: 'assets/sounds/удар катаной по воздуху.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_swing_machete', url: 'assets/sounds/удар мачете по воздуху.mp3', errorCallback: () => {} });
    // Подборы: аптечка / патроны / броня.
    this.load.audio({ key: 'sfx_pickup_medkit', url: 'assets/sounds/подбор аптечки.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_pickup_ammo', url: 'assets/sounds/подбор патронов.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_pickup_armor', url: 'assets/sounds/подбор брони.mp3', errorCallback: () => {} });
    // Доставка флага: наша команда / вражеская.
    this.load.audio({ key: 'sfx_flagours', url: 'assets/sounds/флаг доставила наша команда.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_flagfoe', url: 'assets/sounds/флаг доставила вражеская команда.mp3', errorCallback: () => {} });
    // Взаимодействие с флагом/бомбой: союзник — свой файл, враг — свой.
    this.load.audio({ key: 'sfx_flag_ally', url: 'assets/sounds/звук взаимодействия союзника с флагом.mp3', errorCallback: () => {} });
    this.load.audio({ key: 'sfx_flag_foe', url: 'assets/sounds/звук взаимодействия врага с флагом.mp3', errorCallback: () => {} });
    // Начало внезапной смерти (золотой флаг в центре).
    this.load.audio({ key: 'sfx_sudden', url: 'assets/sounds/звук внезапная смерть.mp3', errorCallback: () => {} });

    // Шмотки запекаются кодом (bakeGearTextures, ниже) — файлы удалены,
    // загрузки сняты (были чистые 404). Вернуть файлы: вернуть цикл
    // по ключам ниже через texUrl(key + '.png').
    // Ключи: торс_тельняшка, торс_разгрузка, торс_камуфляж,
    // штаны_камуфляж_up/low, штаны_чёрные_up/low, бескозырка,
    // штаны_белые_up/low, берцы_камуфляж, маска_ночная,
    // фуражка_парадная, шляпа_закона.

    this.load.image({
      key: 'Benelli_M4',
      url: texUrl('Benelli M4.png'),
      errorCallback: () => {}
    });

    // Плитки земли gr_* рисуются кодом (generateGroundArt, ниже).
    // PNG из assets/sprites больше не грузим. Ключи те же — карты,
    // сейвы и палитра редактора не менялись.

    // Арты карт рисуются кодом (generateMapArt/generateMapBuilding),
    // PNG из for maps больше не грузим. Ключи, потребители не менялись.
    [
      ['map_barrel', null],
      ['map_wall_iron2', null],
      ['map_wall_metal', null],
      ['map_wire', null],
      ['map_rabica', null],
      ['map_eji', null],
      ['map_garage', null],
      ['map_apteka', null],
      ['map_shop', null],
      ['map_zdanie', null],
      ['map_kino', null],
      ['map_pochta', null],
      ['map_stol', null],
      ['map_sarai', null],
      ['map_bigdom', null],
      ['map_domik', null],
      ['map_derevdom', null],
      ['map_mini_dom', null],
      ['map_domik2', null]
    ].forEach(([key, file]) => {
      if (!file) return;
      this.load.image({
        key,
        url: `assets/textures/for maps/${file}`,
        errorCallback: () => {}
      });
    });

    // Флаги и щиты рисуются кодом (generateFlagArt/generateBadgeArt ниже).
    // Бомбы (assets/textures). Нет файла — сущности молча откатываются
    // на старые векторные (проверка exists на месте).
    [
      ['bomb_ally', 'бомба союзников.png'],
      ['bomb_foe', 'бомба врага.png'],
      ['bomb_neutral', 'нейтральная бомба.png']
      // Ящики (map_crate/ящик 2/длинный ящик) рисуются кодом (generateMapArt):
      // в бою укрытия всегда рисованные (createCover игнорирует эти ключи),
      // а палитре редактора и exists() в аренах хватает ключа с артом.
    ].forEach(([key, file]) => {
      this.load.image({
        key,
        url: texUrl(file),
        errorCallback: () => {}
      });
    });

    // Оливковые штаны рисуются кодом (GEO-ноги, пары из wardrobe):
    // PNG удалены, загрузки сняты. Ключи не используются.

    // Арты кейсов рисуются кодом (generateCaseArt, ниже).
    // PNG из значки/ больше не грузим. Ключи показа те же.

    this.load.image({
      key: 'fon_btn',
      url: texUrl('фон_кнопок_меню.png') + '?v=169',
      errorCallback: () => {}
    });

    this.load.image({
      key: 'fon_btn_pressed',
      url: texUrl('выделенный_фон_кнопок_меню.png') + '?v=169',
      errorCallback: () => {}
    });

    // Фон блоков меню (панели Арсенал/В бой/Профиль/витрина).
    this.load.image({
      key: 'фон для блоков меню',
      url: texUrl('фон для блоков меню.png'),
      errorCallback: () => {}
    });

    // Значки для кнопок и иконок меню (авторские PNG).
    // Нет файла — код молча рисует векторную заглушку (проверка textures.exists).
    [
      'значок быстрая игра', 'значок во весь экран', 'значок выбрать матч',
      'значок геном', 'значок дерево навыков', 'значок достижения',
      'значок друзья', 'значок инвентарь', 'значок испытание',
      'значок история боёв', 'значок кейсы', 'значок компания',
      'значок магазин', 'значок настройки', 'значок одиночная игра',
      'значок онлайн', 'значок очки рейтинга', 'значок подарок дня',
      'значок рейтинг', 'значок свободная игра'
    ].forEach(key => {
      this.load.image({
        key,
        url: texUrl(key + '.png'),
        errorCallback: () => {}
      });
    });

    // Здания assets/buildings больше не грузим (52 PNG): фоновые полосы
    // рисуются кодом (bakeCrispBands), здания в игре/редакторе — алиасом
    // BLD_ALIAS на рисованные map_* (см. world/mapPrimitives.js).
    // Файлы на диске пока лежат, загрузчика их не касаются.
    this.buildingFiles = [];

    // Карты режимов (maps/*.json, формат level-objects): CTF/BOMB/KOTH
    // играют на больших аренах с тремя путями. Нет файла — режимы
    // откатятся на процедурные арены (см. getModeMap).
    [['BOMB', 'bomb'], ['CTF', 'ctf'], ['KOTH', 'koth']].forEach(([mode, file]) => {
      // Версия против кэша браузера: привязана к MAP_VER, чтобы правки
      // карт сразу пробивали HTTP-кэш (старый ?v=169 вечно отдавал v2).
      this.load.json('modeMap_' + mode, `maps/${file}.json?v=${MAP_VER}`);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      const FONT = 'ScienceGothic, monospace';
      this.game.registry.set('globalFont', FONT);
      this._updateBar('Подготовка артов', 0.72);
      try {
        console.info('[ART] loaded PNG keys:', this._loadedPngKeys.size, [...this._loadedPngKeys].slice(0, 20));
        // Красные точки-маркеры хвата на PNG оружия (чистый #FF0000): считываем
        // позиции рукояток ДО обрезки/нарезки и стираем их — игроки точек не видят.
        // Вертикальные клинки (катана/мачете) НЕ поворачиваем — стоковый наклон
        // как в PNG; сканы ниже умеют высокий арт (две точки, кончик сверху).
        this._scanGunDots();
        this._scanGunTips();
        this.makeLegsWalkSheet();
        this.makeLegsRunFrames();
        // Подборы — ДО фолбэков: свой арт вместо плоских заглушек.
        ['medkit', 'ammo_kit', 'armor_kit', 'frag_granade', 'smoke_granade'].forEach(k => {
          try { this.generatePickupArt(k); } catch (e) {}
        });
        // Снаряд РПГ — тоже кодом (файл пока лежит, на оценку).
        try { this.generateRocketArt(); } catch (e) {}
        // Флаги CTF/КОТХ — детализированные, кодом (PNG удалены).
        ['flag_ally', 'flag_foe', 'flag_neutral'].forEach(k => {
          try { this.generateFlagArt(k); } catch (e) {}
        });
        // Щиты команд (HUD, меню) — стальные, кодом (PNG удалены).
        ['badge_blue', 'badge_red'].forEach(k => {
          try { this.generateBadgeArt(k); } catch (e) {}
        });
        // Бейджи банд (карта войны) — индивидуальные, кодом.
        ['gang_player', 'gang_syndicate', 'gang_swarm', 'gang_chimera'].forEach(k => {
          try { this.generateGangBadge(k); } catch (e) {}
        });
        // Значки статов для шапок таблиц (вместо букв).
        ['icon_stat_frags', 'icon_stat_deaths', 'icon_stat_flag', 'icon_stat_kpd', 'icon_stat_damage', 'icon_stat_ping'].forEach(k => {
          try { this.generateStatIcon(k); } catch (e) {}
        });
        // Платформы по темам (геймдизайн: свой материал + светлая кромка).
        ['platform_city', 'platform_sunset', 'platform_waste', 'platform_desert',
         'platform_ind', 'platform_cave1', 'platform_cave2'].forEach(k => {
          try { this.generatePlatformArt(k); } catch (e) {}
        });
        keys.forEach(key => {
          if (this.textures.exists(key)) return;
          this.generateFallback(key);
        });
        // Рисованный декор/укрытия/здания (всегда кодом, PNG не грузим).
        ['map_barrel', 'map_barrel1', 'map_barrel2', 'map_barrel3', 'map_barrel4', 'map_barrel5',
         'map_barrel6', 'map_barrel7', 'map_barrel8', 'map_barrel9',
         'map_crate', 'map_crate1', 'map_crate2', 'map_crate3', 'map_crate4', 'map_crate5',
         'map_crate6', 'map_crate7', 'map_crate8', 'map_crate9',
         'map_wall_iron2', 'map_wall_metal', 'map_wire', 'map_rabica', 'map_eji',
         'map_jerry', 'map_ammo', 'map_tires', 'map_crate_stack'].forEach(k => {
          try { this.generateMapArt(k); } catch (e) {}
        });
        ['map_garage', 'map_apteka', 'map_shop', 'map_zdanie', 'map_kino', 'map_pochta', 'map_stol',
         'map_sarai', 'map_derevdom', 'map_bigdom', 'map_mini_dom', 'map_domik2', 'map_domik',
         'map_ruin', 'map_scrap', 'map_ruin2', 'map_wreck', 'map_ruin3',
         'map_ruin4', 'map_ruin5', 'map_ruin6', 'map_ruin7',
         'map_tank', 'map_tower', 'map_bags'].forEach(k => {
          try { this.generateMapBuilding(k); } catch (e) {}
        });
        this._updateBar('Обрезка текстур', 0.76);
        this.makeLegsSheet();
        this.prepareCharacters();
        // Земля gr_* — всегда кодом (плитка 256x128, бесшовная по горизонтали).
        // ПОСЛЕ prepareCharacters: он пересоздаёт __realTextures, иначе
        // редактор (_isRealTex) спрячет варианты земли.
        ['gr_grass', 'gr_sand', 'gr_stones', 'gr_beton', 'gr_beton_sand', 'gr_scorch'].forEach(k => {
          try { this.generateGroundArt(k); } catch (e) {}
        });
        // Кейсы экрана «Кейсы» — всегда кодом (не меню, решение владельца).
        ['case_weapons', 'case_wardrobe', 'case_skins',
         'case_rare', 'case_epic', 'case_leg'].forEach(k => {
          try { this.generateCaseArt(k); } catch (e) {}
        });
        // Рисованные уборы/обувь магазина поверх PNG (те же ключи —
        // магазин и превью подхватывают их сами, код не меняем).
        try { bakeGearTextures(this); } catch (e) {}
      } catch (e) {
        console.error('[ART] BootScene stage failed:', e);
      }

      this._preloadFontAndStart();
    });

    // Необязательные арт-слоты (нет PNG — рисуем заглушку): их 404 в консоли
    // браузера НЕ отключить, но наши варны для них прячем в debug.
    // Всё, чего нет в этом списке и не загрузилось, — варн как раньше.
    const OPTIONAL_ART = new Set([
      'player', 'enemy', 'bullet', 'grenade', 'platform', 'cover', 'wall',
      'ground', 'pickup', 'tile', 'medkit', 'ammo_kit', 'armor_kit', 'icon_knife',
      'Makarov2',
      'chr_arms', 'chr_arm_up', 'chr_arm_fore', 'chr_hand', 'chr_hand_l', 'chr_hand_r',
      'chr_pants_thigh', 'chr_pants_shin',
      'chr_pants_thigh_l', 'chr_pants_thigh_r', 'chr_pants_shin_l', 'chr_pants_shin_r',
      'icon_coins'
    ]);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
      if (OPTIONAL_ART.has(file.key) || String(file.key).startsWith('chr_legs_')) {
        console.debug('[ART] нет PNG (заглушка):', file.key);
      } else {
        console.warn('[ART] FILE_LOAD_ERROR:', file.key, file.url);
      }
    });

    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key, type, data) => {
      if (type === 'image') {
        this._loadedPngKeys.add(key);
      }
    });

    this._doneLoad = 0;
    this.load.on(Phaser.Loader.Events.PROGRESS, (v) => {
      this._doneLoad = v;
      this._updateBar('Загрузка ресурсов', v * 0.7);
    });

    this.load.start();
  }

  _updateBar(label, progress) {
    if (!this._barFill || !this._barText) return;
    const p = Phaser.Math.Clamp(progress, 0, 1);
    const w = Math.max(0, this._barW * p);
    if (typeof this._barFillFill === 'function') this._barFillFill(w, this._barH || 18);
    else this._barFill.width = w;
    this._barPct = p;
    this._refreshBarText();
  }

  _refreshBarText() {
    if (!this._barText) return;
    const p = this._barPct || 0;
    const pct = Math.round(p * 100) + '%';
    this._barText.setText(FUNNY_LOADS[this._jokeIdx % FUNNY_LOADS.length]);
    if (this._barPctLabel) this._barPctLabel.setText(pct);
  }

  _preloadFontAndStart() {
    this._updateBar('Шрифты', 0.75);
    const span = document.createElement('span');
    span.style.fontFamily = 'ScienceGothic';
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = '24px';
    // Кириллица ОБЯЗАТЕЛЬНО в прелоаде: шрифт грузится поглифно, и если
    // дождаться только латиницы — русские надписи приедут позже уже́ шире,
    // а кнопки меню замеряются один раз и после матча «увеличиваются».
    span.textContent = 'preload АБВГД абвгд Ёё Жж 0123456789 — ·';
    document.body.appendChild(span);

    let fontAttempts = 0;
    const MAX_FONT_ATTEMPTS = 100; // ~5 сек (100 x 50мс), дальше — старт принудительно
    const CYR = 'АБВГДЖабвгджЁё —';
    const finish = () => {
      if (span.parentNode) document.body.removeChild(span);
      if (this._barText) this._barText.setText('Проверка файлов...');
      // Отдельный шаг: целостность ассетов + сверка версии, затем результат.
      this._checkFiles();
    };
    const check = () => {
      fontAttempts++;
      const p = Math.min(0.95, 0.8 + fontAttempts * 0.01);
      this._updateBar('Загрузка шрифта', p);
      if (document.fonts && document.fonts.check('24px ScienceGothic') &&
          document.fonts.check('24px ScienceGothic', CYR)) {
        finish();
      } else if (fontAttempts >= MAX_FONT_ATTEMPTS) {
        finish();
      } else {
        setTimeout(check, 50);
      }
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(check, 0));
    } else {
      setTimeout(check, 200);
    }
  }

  // Отдельный шаг загрузки — проверка файлов. Технически: целостность
  // критичных ассетов (нет ли недокачанных/битых) + сверка версии с сервером
  // (version.json). Визуально: строка состояния с галочкой/предупреждением.
  _checkFiles() {
    try { this._updateBar('Проверка файлов', 0.9); } catch (e) {}
    const needTex = ['fon_menu', 'fon_btn', 'fon_btn_pressed', 'badge_blue', 'badge_red', 'icon_coins'];
    const needAudio = ['mus_menu'];
    let assetsOk = true;
    try {
      needTex.forEach(k => { if (!this.textures.exists(k)) assetsOk = false; });
      needAudio.forEach(k => { if (!this.cache.audio.exists(k)) assetsOk = false; });
    } catch (e) { assetsOk = false; }
    const done = (vOk) => this._showCheckResult(assetsOk && vOk);
    // Сверка версии с сервером (version.json). Офлайн/без файла — только ассеты.
    try {
      fetch('version.json', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(srv => {
          let vOk = true;
          if (srv && srv.version && srv.version !== GAME_VERSION) vOk = false;
          done(vOk);
        })
        .catch(() => done(true));
    } catch (e) { done(true); }
  }

  _showCheckResult(up) {
    const t = this._barText;
    if (t) {
      t.setText('');
    }
    if (this._barFill) this._barFill.width = Math.max(0, this._barW);
    if (up) {
      // Пауза, чтобы результат прочитали, затем в меню.
      this.time.delayedCall(1100, () => this.scene.start('MenuScene'));
    } else {
      this._showRefreshButton();
    }
  }

  // Кнопка «Обновить»: перезагружает страницу, чтобы докачать свежие файлы
  // (versioned-URL иммутабельны — добавляем метку в query, иначе кэш отдаёт
  // старое). До меню не пускает.
  _showRefreshButton() {
    try {
      const W = gameW(this), H = this.scale.height;
      const bw = 240, bh = 56;
      const bx = W / 2, by = H / 2 + 78;
      const bg = this.add.rectangle(bx, by, bw, bh, 0x287a45)
        .setStrokeStyle(2, 0x88ff88);
      this.add.text(bx, by, 'ОБНОВИТЬ', {
        fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(bx, by + 42, 'докачает новую версию', {
        fontSize: '12px', color: '#8899bb'
      }).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x35a055));
      bg.on('pointerout', () => bg.setFillStyle(0x287a45));
      bg.on('pointerdown', () => {
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('_', String(Date.now()));
          window.location.href = u.toString();
        } catch (e) {
          window.location.reload();
        }
      });
    } catch (e) {}
  }

  // 24 отдельных кадра ходьбы (файлы walk/sprite_r{ряд}_c{колонка}-obrezano.png)
  // сшиваем в один равномерный лист: каждый кадр по центру ячейки и по низу.
  makeLegsWalkSheet() { return Legs.makeLegsWalkSheet.call(this); }
  _detectSheetLayout(W, H, n, colsHint, rowsHint) { return Legs._detectSheetLayout.call(this, W, H, n, colsHint, rowsHint); }
  prepareCharacters() { return Character.prepareCharacters.call(this); }
  makeLegsRunFrames() { return Legs.makeLegsRunFrames.call(this); }
  makeLegsSheet() { return Legs.makeLegsSheet.call(this); }
  _scanGunDots() { return GunScan._scanGunDots.call(this); }
  _scanGunTips() { return GunScan._scanGunTips.call(this); }
  _cloneFullLeg() { return Character._cloneFullLeg.call(this); }
  averageShoulderColor(src, key) { return Character.averageShoulderColor.call(this, src, key); }
  cropCharacterTexture(key) { return Character.cropCharacterTexture.call(this, key); }
  generateMapArt(key) { return ArtEnv.generateMapArt.call(this, key); }
  generateGroundArt(key) { return ArtEnv.generateGroundArt.call(this, key); }
  generateCaseArt(key) { return ArtEnv.generateCaseArt.call(this, key); }
  generatePickupArt(key) { return ArtSmall.generatePickupArt.call(this, key); }
  generateRocketArt() { return ArtSmall.generateRocketArt.call(this); }
  generateFlagArt(key) { return ArtSmall.generateFlagArt.call(this, key); }
  generateBadgeArt(key) { return ArtSmall.generateBadgeArt.call(this, key); }
  generateGangBadge(key) { return ArtSmall.generateGangBadge.call(this, key); }
  generatePlatformArt(key) { return ArtSmall.generatePlatformArt.call(this, key); }
  generateStatIcon(key) { return ArtSmall.generateStatIcon.call(this, key); }
  generateMapBuilding(key) { return ArtBuildings.generateMapBuilding.call(this, key); }
  generateFallback(key) { return Fallback.generateFallback.call(this, key); }
  generateChrPart(key, part, w, h) { return Legs.generateChrPart.call(this, key, part, w, h); }
  generateRunSheet(key, def) { return Legs.generateRunSheet.call(this, key, def); }
}
