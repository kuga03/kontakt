import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';

import { bakeHouseLayers } from '../../data/bgHouses.js?v=169';
import { bakePanorama, bakeCrispBands } from '../../data/bgPanorama.js?v=268';

import * as MapPrims from '../../world/mapPrimitives.js?v=412';

import * as Koth from '../../modes/koth.js?v=169';

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

export function createMap() {
    this.platforms = this.physics.add.staticGroup();
    this.covers = this.physics.add.staticGroup();

    const levelTheme = this.campaignLevel && this.campaignLevel.theme;
    // Своя тема у каждого режима (раньше все не-кампании сидели на плоской
    // 'night' без фоновой картинки — целые бэкграунды лежали мёртвым грузом).
    const themeByMode = {
      TDM: ['ulica', 'krisha'], FFA: ['ulica', 'krisha'], CTF: ['ulica', 'krisha'],
      BOMB: ['zavod'], KOTH: ['pustoch', 'pustinya'], TRIAL: ['pechera', 'peshera']
    };
    let themeId = levelTheme || 'night';
    if (!levelTheme && themeByMode[this.mode]) {
      const arr = themeByMode[this.mode];
      themeId = arr[(this._arenaVariant || 0) % arr.length];
    }
    const th = MAP_THEMES[themeId] || MAP_THEMES.night;
    // Тема для материалов (платформы по теме, не сливаются с фоном).
    try { this._platformTheme = themeId; } catch (e) {}
    this.cameras.main.setBackgroundColor(th.bg);

    // Рисованный фон (bgPanorama) — приоритетнее PNG: нет файла — покажем
    // старый fon_*. Не вышло запечь — тоже тихо откатимся на PNG.
    let bgTexKey = th.bgTex;
    try {
      const pano = bakePanorama(this, themeId);
      if (pano && this.textures.exists(pano)) bgTexKey = pano;
    } catch (e) {}
    if (bgTexKey && this.textures.exists(bgTexKey)) {
      const tex = this.textures.get(bgTexKey);
      const src = tex.getSourceImage();
      const ratio = src.height / src.width;
      // Шире карты на ±900 (границы камеры setBounds -900..W+900):
      // на снайперском зуме за краями картинки была видна плоская заливка.
      let bgW = this.mapWidth + 1800;
      let bgH = Math.round(bgW * ratio);
      // Пустошь: привязка по горизонту (панорама 0.6 на мировой mapHeight-350).
      // Панорама двойной ширины уникальным контентом — ужатка /2 + зеркальные
      // фланги убраны: один и тот же город повторялся трижды (копипаста).
      // Остальные уличные панорамы — та же привязка (ТЗ п.11): композиции
      // рисовались с горизонтом, а центровка показывала только низ.
      // Пещеры — без горизонта, по центру.
      let bgY = this.mapHeight - bgH / 2;
      if (bgTexKey === 'pano_wasteland') {
        bgY = (this.mapHeight - 350) - bgH * 0.1;
      } else if (bgTexKey && bgTexKey.indexOf('pano_') === 0 && themeId !== 'pechera' && themeId !== 'peshera') {
        bgY = (this.mapHeight - 350) - bgH * 0.1;
      }
      const bgImg = this.add.image(this.mapWidth / 2, bgY, bgTexKey);
      bgImg.setDisplaySize(bgW, bgH);
      bgImg.setDepth(-10);
      // Фон приглушаем, чтобы платформы читались: затемнение + лёгкий
      // блюр (WebGL; на Canvas тихо пропускаем — останется затемнение).
      try { bgImg.setAlpha(0.55); } catch (e) {}
    } else {
      this.add.rectangle(
        this.mapWidth / 2, this.mapHeight / 2,
        this.mapWidth, this.mapHeight, th.bg
      ).setDepth(-10);
    }

    // Подложка шире карты на ±1800: под землёй за краями тоже низ, а не пустота.
    this.add.rectangle(
      this.mapWidth / 2, this.mapHeight + 400,
      this.mapWidth + 3600, 800, th.below
    ).setDepth(-9);

    this.add.rectangle(
      this.mapWidth / 2, this.mapHeight + 2,
      this.mapWidth, 4, th.rim
    ).setDepth(-8);

    // Фоновые дома: два параллакс-слоя поверх арта неба.
    // Пекутся раз на тему (см. data/bgHouses), дальше только tilePositionX.
    this._buildHouseLayers(themeId);

    const level = this.campaignLevel;
    let hasGround = false;
    if (level && level.objects) {
      this.campaignSpawns = { player: null, team: [], enemy: [] };
      this.campaignFlags = { blue: null, red: null };
      this.campaignItems = [];
      level.objects.forEach(o => {
        if (o.spawnType) {
          if (o.spawnType === 'player') this.campaignSpawns.player = { x: o.x, y: o.y };
          else if (o.spawnType === 'team') this.campaignSpawns.team.push({ x: o.x, y: o.y });
          else if (o.spawnType === 'enemy') this.campaignSpawns.enemy.push({ x: o.x, y: o.y });
          // Базы флагов — маркеры (геометрии не строят, только точки).
          else if (o.spawnType === 'flagBlue') this.campaignFlags.blue = { x: o.x, y: o.y };
          else if (o.spawnType === 'flagRed') this.campaignFlags.red = { x: o.x, y: o.y };
          else if (['medkit', 'armor', 'ammo', 'frag', 'smoke'].includes(o.spawnType)) {
            this.campaignItems.push({ type: o.spawnType, x: o.x, y: o.y });
          }
          return;
        }
        if (o.type === 'ground') {
          this.createGround(o.x, o.y, o.w, o.h, o.a, o.texKey);
          hasGround = true;
        } else if (o.type === 'building') {
          this.createBuilding(o.x, o.y, o.w, o.h, o.texKey, o.a);
        } else if (o.type === 'platform') {
          this.createPlatform(o.x, o.y, o.w, o.h, o.a);
        } else if (o.type === 'wall') {
          this.createWall(o.x, o.y, o.w, o.h, o.a);
        } else {
          // Ящики/бочки из карты — их PNG (map_crate/map_barrel...),
          // а не рисованная заглушка: texKey едет первым аргументом.
          this.createCover(o.x, o.y, o.w, o.h, o.texKey || o.a);
        }
      });
      if (!hasGround) this.createGround(this.mapWidth / 2, this.mapHeight - 25, this.mapWidth, 50);
      return;
    } else {
      this.createPlatform(this.mapWidth / 2, this.mapHeight - 25, this.mapWidth, 50);
    }
    if (!level) {
      [
        [500, 650, 300, 30],
        [1000, 520, 300, 30],
        [1500, 680, 350, 30],
        [2100, 560, 300, 30]
      ].forEach(p => this.createPlatform(...p));
    }
  }

  // Фоновые дома: дальний едет за камерой ×0.25, ближний ×0.5.
  // Слои под игрой (-9.x), над артом неба (-10).
  // Дома — рисованные полосы (bakeCrispBands); не вышло — векторный фолбэк.
export function _buildHouseLayers(themeId) {
    return MapPrims.buildHouseLayers(this, themeId, bakeCrispBands, bakeHouseLayers);
  }

export function createPlatform(x, y, width, height, alpha = 1) {
    return MapPrims.createPlatform(this, x, y, width, height, alpha);
  }

export function createGround(x, y, width, height, alpha = 1, texKey = null) {
    return MapPrims.createGround(this, x, y, width, height, alpha, texKey);
  }

  // texOrAlpha: строка — ключ арта из for maps, число — старая alpha.
  // opts: { dw, dh } — явный размер картинки (по умолчанию contain в w×h),
  //   { rows } — стопка из N картинок по высоте (высокие укрытия).
  // Тело — невидимый прямоугольник w×h (у контейнеров кривой body),
  // внешность — отдельный контейнер поверх.
  // ЯЩИКИ — ВСЕГДА рисованные (k209): PNG-крышки ('map_crate', 'ящик 2',
  // 'длинный ящик') больше не используются — рисованный ящик совпадает
  // с хитбоксом попиксельно по построению, а PNG кропились/тянулись.
  // Бочки/стены-PNG не трогаем — только ящики.
export function createCover(x, y, width, height, texOrAlpha = 1, opts = {}) {
    return MapPrims.createCover(this, x, y, width, height, texOrAlpha, opts);
  }

export function createBuilding(x, y, width, height, texKey, alpha = 1) {
    return MapPrims.createBuilding(this, x, y, width, height, texKey, alpha);
  }

export function createWall(x, y, width, height, alpha = 1) {
    return MapPrims.createWall(this, x, y, width, height, alpha);
  }
