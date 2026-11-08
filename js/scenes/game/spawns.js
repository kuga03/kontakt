import Assault from '../../entities/Assault.js';
import EnemyAI from '../../ai/EnemyAI.js';
import Tank from '../../entities/Tank.js';
import Medic from '../../entities/Medic.js';
import Sniper from '../../entities/Sniper.js';


import { randomBotNames } from '../../data/names.js';
import { gameState } from '../../data/gameState.js';

import { weaponsList, weaponByClass, classDefinitions } from '../../data/weapons.js';

import * as Koth from '../../modes/koth.js';

import * as Gang from '../../data/gang.js';
import { hasMut, stripToKnife, applySpawnStats } from '../../data/mutators.js';

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

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createPlayer() {
    const PlayerClass = classMap[this.selectedClass] || Assault;
    let px = 80;
    let py = 600;
    const sp = this.campaignSpawns && this.campaignSpawns.player;
    if (sp) {
      px = sp.x;
      py = sp.y;
    } else if (this.mode === 'FFA' && this.ffaSpawns) {
      px = this.ffaSpawns[0].x;
      py = this.ffaSpawns[0].y;
    } else if (['TDM', 'CTF', 'BOMB', 'KOTH'].includes(this.mode)) {
      // Командные режимы — игрок за синих стартует на своей (левой) базе.
      px = 120;
      py = 560;
    }
    // Без ручной точки — на землю, а не в воздух.
    if (!sp) py = this._groundSpawnY(px);
    // Проверка на карман (спавн под платформой флага и т.п.):
    // без выхода точку сдвигаем к ближайшей свободной.
    try {
      const sv = this._validateSpawn(px, py);
      px = sv.x; py = sv.y;
    } catch (e) {}
    this.player = new PlayerClass(this, px, py, {
      name: this.playerName,
      team: 'blue'
    });
    // Стартовый спавн тоже не внутри геометрии (иначе вышвырнет).
    // Плюс запас вверх: точка редактора впритык к ящику (тело 56+)
    // иначе клинит на старте — падение на пару px безвредно.
    try {
      let guard = 0;
      while (this._inSolid(this.player.x, this.player.y, 30) && guard < 20) {
        this.player.y -= 24;
        guard++;
      }
      this.player.y -= 16;
    } catch (e) {}
    this.players = [this.player];
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.covers);
    this._bindFighter(this.player);
    this._paintName(this.player);
  }

  // Толкание телами: попарные коллайдеры между бойцами (без self-пар).
  // Оба динамические — идущий потихоньку толкает стоящего, сквозь друг
  // друга не ходят. Мёртвых/неактивных пропускаем (трупы — не стены).
  // NB: НЕ через collider(group, group) с одной группой — движок на
  // self-паре ведёт себя непредсказуемо (вплоть до срыва всего физшага,
  // после чего все тела пролетают сквозь пол).
  // Несёт флаг/бомбу — для своих бестелесный, иначе стоящий союзник
  // (охранение/эскорт на посту) перекрывает носильщику проход.
export function _isObjectiveCarrier(p) {
    try {
      if (!p) return false;
      const items = [this.blueBomb, this.redBomb, this.blueFlag, this.redFlag, this.ctfSuddenFlag];
      for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].carrier === p) return true;
      }
    } catch (e) {}
    return false;
  }

  // Тела бестелесные: бойцы проходят друг сквозь друга, никого не толкают.
  // Толкотня загоняла в текстуры и стопорила ботов друг о друга (пинг-понг
  // туда-сюда). Путь ИИ персонажей препятствием не считает — только статики.
export function _bindFighter(p) {
    return;
  }

export function createEnemies() {
    // Банда — ТОЛЬКО контрактные бои (contractId): свободная игра идёт
    // обычными ботами и никак не пересекается с войной банд.
    try {
      if (this._gangContractId && ['CTF', 'TDM', 'BOMB', 'KOTH'].includes(this.mode) && !this.campaignMission) {
        this._gangQueue = Gang.pickRaidFighters();
      } else { this._gangQueue = []; }
      this._gangFighters = [];
    } catch (e) { this._gangQueue = []; this._gangFighters = []; }
    if (this.mode === 'TRIAL') {
      this.trialWave = 0;
      this.trialKills = 0;
      this.trialAllies = 0;
      // Якорь — на первом живом кадре update (loop-часы, рядом с _modeT0loop):
      // trialEndedTime считает по _loopNow, эпохи обязаны совпасть.
      this.trialStart = 0;
      this.trialEnemiesAlive = 0;
      this.trialSpawnQueue = [];
      this.trialInterWave = 2500;
      this.trialNeedWave = true;
      // Волны спавнятся отдельно (_updateTrial): общий блок ниже
      // сюда проваливаться не должен, иначе +5 статичных ботов вне волн.
      return;
    }

    if (this.mode === 'CAMPAIGN' && this.campaignLevel) {
      const cl = this.campaignLevel;

      if (cl.tutorial) {
        const mkBot = (x, y, type, name, team, tint, dummy) => {
          const BotClass = classMap[type] || Assault;
          let sx = x, sy = y;
          try {
            if (this._validateSpawn) {
              const sv = this._validateSpawn(sx, sy);
              if (sv && Number.isFinite(sv.x) && Number.isFinite(sv.y)) {
                sx = sv.x;
                sy = sv.y;
              }
            }
          } catch (e) {}
          const b = new BotClass(this, sx, sy, {
            name, team, isAI: true
          });
          b.setTexture('enemy');
          b.setTint(tint);
          this.players.push(b);
          this._bindFighter(b);
          this.physics.add.collider(b, this.platforms);
          this.physics.add.collider(b, this.covers);
          b.ai = new EnemyAI(b, this);
          if (dummy) {
            b.ai.dummy = true;
          } else {
            // Живые боты для учебного уровня: полноценный AI (движение, стрельба),
            // без гранат и с комфортным уроном, чтобы новичок мог освоиться в бою.
            this.applyBotDifficulty(b);
            try { b.damageMult = (b.damageMult || 1) * 0.6; b._diffDmgMult = b.damageMult; } catch (e) {}
            try { b.fragGrenades = 0; b.smokeGrenades = 0; } catch (e) {}
            try { if (b.ai) b.ai.noGrenades = true; } catch (e) {}
          }
          this._paintName(b);
          return b;
        };

        this.tutDummy = mkBot(680, 560, 'Assault', 'Манекен', 'red', 0xffaaaa, true);
        // Живые враги: два полноценных бота на виду правее манекена
        mkBot(920, 750, 'Assault', 'Враг 1', 'red', 0xff5555);
        mkBot(1080, 750, 'Assault', 'Враг 2', 'red', 0xff5555);
        this.tutorialSpawns = { weapon: { x: 250, y: 815 }, frag: { x: 560, y: 815 }, medkit: { x: 1150, y: 815 } };
        return;
      }

      if (cl.objects) {
        const rng = mulberry32(cl.id * 104857);

        const spawnEnemy = (x, y, typeIdx) => {
          const type = (cl.enemyTypes && cl.enemyTypes[typeIdx % cl.enemyTypes.length]) || 'Assault';
          const EnemyClass = classMap[type] || Assault;
          // Безопасный спавн: не внутри солида, иначе бот застревает с 1-й секунды.
          // Плюс проверка на карман (точка без выхода сдвигается рядом).
          let sx = x, sy = y;
          try {
            if (this._inSolid && this._inSolid(sx, sy, 30)) {
              sy = this._groundSpawnY(sx);
            }
            const esc = this._escapeSolid ? this._escapeSolid(sx, sy, 30) : { x: sx, y: sy };
            sx = esc.x; sy = esc.y;
            const sv = this._validateSpawn ? this._validateSpawn(sx, sy) : null;
            if (sv) { sx = sv.x; sy = sv.y; }
          } catch (e) {}
          const enemy = new EnemyClass(this, sx, sy, {
            name: this._botName(),
            team: 'red',
            isAI: true
          });
          enemy.setTexture('enemy');
          enemy.setTint(0xff5555);
          // Поле spawn — точка возрождения для режимов с респауном.
          // В кампании one-life (respawnDeadEnemies в CAMPAIGN не ходит).
          enemy.spawn = { x: sx, y: sy };
          this.players.push(enemy);
          this._bindFighter(enemy);
          this.physics.add.collider(enemy, this.platforms);
          this.physics.add.collider(enemy, this.covers);
          enemy.ai = new EnemyAI(enemy, this);
          this.applyBotDifficulty(enemy);
          this._paintName(enemy);
        };

        const enemySpawns = this.campaignSpawns.enemy;
        if (enemySpawns && enemySpawns.length) {
          enemySpawns.forEach((s, i) => spawnEnemy(s.x, s.y, i));
        } else {
          for (let i = 0; i < cl.enemies; i++) {
            const x = 850 + i * 250 + (rng() - 0.5) * 60;
            spawnEnemy(x, 550, i);
          }
        }

        const teamSpawns = this.campaignSpawns.team || [];
        teamSpawns.forEach((s, i) => {
          let sx = s.x, sy = s.y;
          try {
            if (this._inSolid && this._inSolid(sx, sy, 30)) sy = this._groundSpawnY(sx);
            const esc = this._escapeSolid ? this._escapeSolid(sx, sy, 30) : { x: sx, y: sy };
            sx = esc.x; sy = esc.y;
            const sv = this._validateSpawn ? this._validateSpawn(sx, sy) : null;
            if (sv) { sx = sv.x; sy = sv.y; }
          } catch (e) {}
          const ally = new Assault(this, sx, sy, {
            name: this._botName(),
            team: 'blue',
            isAI: true
          });
          ally.setTexture('enemy');
          ally.setTint(0x44ccff);
          ally.spawn = { x: sx, y: sy };
          this.players.push(ally);
          this._bindFighter(ally);
          this.physics.add.collider(ally, this.platforms);
          this.physics.add.collider(ally, this.covers);
          ally.ai = new EnemyAI(ally, this);
          // Союзникам кампании — та же сложность, что врагам.
          this.applyBotDifficulty(ally);
          // Союзные боты слабее: меньше урона и здоровья (×0.7).
          try {
            ally.damageMult = (ally.damageMult || 1) * 0.7;
            ally.maxHp = Math.max(40, Math.round((ally.maxHp || 100) * 0.7));
            ally.hp = ally.maxHp;
            if (ally.updateBars) ally.updateBars();
          } catch (e) {}
          this._paintName(ally);
        });

        return;
      }

      const rng = mulberry32(cl.id * 104857);
      const maxEngage = 1020;
      const spawnMin = Math.max(700, 80 + maxEngage + 200);
      const usable = Math.max(50, this.mapWidth - spawnMin - 150);
      const step = usable / Math.max(cl.enemies, 1);
      const yBand = (this.campaignStructure && this.campaignStructure.yBand) || [560, 700];

      for (let i = 0; i < cl.enemies; i++) {
        const type = cl.enemyTypes[i % cl.enemyTypes.length];
        const PlayerClass = classMap[type] || Assault;

        let x = spawnMin + i * step + (rng() - 0.5) * step * 0.4;
        let y = yBand[0] + rng() * (yBand[1] - yBand[0]);
        try {
          y = this._groundSpawnY(x);
          const esc = this._escapeSolid ? this._escapeSolid(x, y, 30) : { x, y };
          x = esc.x; y = esc.y;
        } catch (e) {}

        const enemy = new PlayerClass(this, x, y, {
          name: this._botName(),
          team: 'red',
          isAI: true
        });

        enemy.setTexture('enemy');
        enemy.setTint(0xff5555);
        enemy.spawn = { x, y };

        this.players.push(enemy);
        this._bindFighter(enemy);
        this.physics.add.collider(enemy, this.platforms);
        this.physics.add.collider(enemy, this.covers);
        enemy.ai = new EnemyAI(enemy, this);
        this.applyBotDifficulty(enemy);
        this._paintName(enemy);
      }
      return;
    }

    if (this.mode === 'CTF') {
      // 3х3 по умолчанию: игрок + союзники слева, враги справа.
      // Кап суммарно 15 ботов: опция лобби «8 в команде» даёт 7+8=15 —
      // резать её до 11 (было) значило молча подменять выбор (5+6 вместо
      // 7+8). FPS-контроль — строкой [AUTO] fps в дампе C.
      // «Без союзников» (лобби): вся синяя команда — игрок один. Миссии
      // кампании не трогаем (у них свой состав из уровня).
      const _solo = !!(gameState.noAllies && !this.campaignMission);
      // Составы из лобби (синие/красные отдельно, игрок сверх синих).
      // «Без союзников» honourим как раньше; Синие: 0 — то же самое.
      let allyN = (_solo || this.blueBots <= 0) ? 0 : Math.max(1, this.blueBots - 1);
      let redN = Math.max(0, this.redBots);
      if (allyN + redN > 15) {
        if (redN <= 0) allyN = 15;
        else if (allyN <= 0) redN = 15;
        else {
          const k = 15 / (allyN + redN);
          allyN = Math.max(1, Math.round(allyN * k));
          redN = 15 - allyN;
        }
      }
      // По одному часовому у флага с каждой стороны (живой патруль,
      // первым идёт на возврат). Остальные — в атаке за флагом.
      // Маршруты атаки раздаём колодой low/high/mid по кругу на команду:
      // раньше был чистый рандом 1/3 — команда из 2 атакующих регулярно
      // оставалась вообще без верха, а верх никто не крыл (фри-стил флага).
      // high вторым — даже малая команда всегда держит верх.
      // Кемперов у флага НЕТ (убраны): все в атаке, часовых ноль.
      // Держатель верха: первый high-маршрут команды держит чужое плато
      // с первой секунды (бой при контакте, флаг когда пусто). Без него
      // верх пустует весь матч — точки проходят транзитом и падают.
      // Только если атакующих двое+: одному надо возить, а не держать.
      const blueDef = 0;
      const redDef = blueDef;
      let _blueHoldDone = false, _redHoldDone = false;
      const _blueAttackN = allyN, _redAttackN = redN;
      const _routeDeck = ['low', 'high', 'mid'];
      let _blueAi = 0, _redAi = 0;
      // Смешанные классы (штурмовики чаще): медики лечат, танки танкуют,
      // снайперы держат дистанцию — а не вся карта из штурмовиков.
      const pickBotClass = () => {
        const roll = Math.random();
        return roll < 0.5 ? Assault : roll < 0.7 ? Tank : roll < 0.9 ? Medic : Sniper;
      };
      const mkBot = (x, y, team, role) => {
        // Банда: первые синие слоты — свои бойцы (имя/класс/ствол/статы).
        let _gm = null;
        try {
          if (team === 'blue' && this._gangQueue && this._gangQueue.length) _gm = this._gangQueue.shift();
        } catch (e) { _gm = null; }
        const BotClass = _gm ? (classMap[_gm.class] || Assault) : pickBotClass();
        const clsId = BotClass === Tank ? 'Tank' : BotClass === Medic ? 'Medic' : BotClass === Sniper ? 'Sniper' : 'Assault';
        const vetAssault = this.botDifficulty?.id === 'veteran' && BotClass === Assault;
        let _primary = null;
        try {
          _primary = (_gm && _gm.gun) ? _gm.gun : this._pickBotPrimary(clsId, vetAssault);
        } catch (e) { _primary = this._pickBotPrimary(clsId, vetAssault); }
        const b = new BotClass(this, x, y, {
          name: (_gm && _gm.name) ? _gm.name : this._botName(),
          team,
          isAI: true,
          primary: _primary
        });
        b.setTexture('enemy');
        b.setTint(team === 'blue' ? 0x44ccff : 0xff5555);
        b.spawn = { x, y };
        this.players.push(b);
        this._bindFighter(b);
        this.physics.add.collider(b, this.platforms);
        this.physics.add.collider(b, this.covers);
        b.ai = new EnemyAI(b, this);
        b.ai._ctfRole = role;
        // Фиксированный фланг на весь матч (см. колоду выше): не даём
        // рандому оставить команду без верха. Дефу маршрут не важен.
        try {
          if (role === 'attack') {
            if (team === 'blue') b.ai._ctfRoute = _routeDeck[_blueAi++ % _routeDeck.length];
            else b.ai._ctfRoute = _routeDeck[_redAi++ % _routeDeck.length];
            // Первый high своей команды — держатель верха (фланг с 0с).
            if (b.ai._ctfRoute === 'high') {
              if (team === 'blue' && !_blueHoldDone && _blueAttackN >= 2) {
                b.ai._ctfRole = 'holdhigh'; _blueHoldDone = true;
              } else if (team === 'red' && !_redHoldDone && _redAttackN >= 2) {
                b.ai._ctfRole = 'holdhigh'; _redHoldDone = true;
              }
            }
          }
        } catch (e) {}
        this.applyBotDifficulty(b);
        // Банда: баффы уровня + дебаффы ранения отдельным множителем.
        try {
          if (_gm) {
            Gang.applyGangStatsToBot(b, _gm);
            this._gangFighters.push({ id: _gm.id, bot: b });
          }
        } catch (e) {}
        // Мутаторы: ножи принудительно, стекло/туман — стартовые статы.
        try {
          if (hasMut(this.mutators, 'knives')) stripToKnife(b);
          applySpawnStats(b, this.mutators);
        } catch (e) {}
        this._paintName(b);
        return b;
      };
      // Кастомная карта из редактора: точки team/enemy важнее процедура.
      const ctfTeam = (this.campaignSpawns && this.campaignSpawns.team) || [];
      const ctfEnemy = (this.campaignSpawns && this.campaignSpawns.enemy) || [];
      const safeY = (x, fy) => {
        try {
          let y = (typeof fy === 'number') ? fy : this._groundSpawnY(x);
          if (this._inSolid && this._inSolid(x, y, 30)) y = this._groundSpawnY(x);
          // Точка редактора впритык: запас вверх, падение безвредно.
          return y - 16;
        } catch (e) { return fy; }
      };
      for (let i = 0; i < allyN; i++) {
        let bx, by;
        if (i < ctfTeam.length) { bx = ctfTeam[i].x; by = safeY(bx, ctfTeam[i].y); }
        else { bx = 180 + i * 140; by = this._groundSpawnY(bx); }
        // k402: карман 750–770/3030–3050 (Форты 3800): спавн i=4 (740/3060)
        // валидатор уводил в щель (sh=65 → 790/3010, Сержант L:1 весь матч
        // k401-085237, STRAIL 3090→3376→3106→3181). Поднимаем точку над
        // средней ступенью (y628) — validate находит верхнюю опору, падение
        // безвредно. Только точка спавна, поведение ботов не меняется.
        try {
          if (this.mapWidth === 3800 && typeof bx === 'number' && typeof by === 'number') {
            if ((bx >= 680 && bx <= 820) || (bx >= 2980 && bx <= 3140)) by -= 140;
          }
        } catch (e) {}
        // k383: сдвиг валидатора + стартовый лог (карман на спавне).
        let _shB = 0;
        try {
          const _oxB = bx, _oyB = by;
          const sv = this._validateSpawn(bx, by);
          bx = sv.x; by = sv.y;
          _shB = Math.round(Math.hypot(bx - _oxB, by - _oyB));
        } catch (e) {}
        const _nbB = mkBot(bx, by, 'blue', i < blueDef ? 'defend' : 'attack');
        try { if (_nbB) { _nbB._spawnShift = _shB; this._logSpawn(_nbB, bx, by); } } catch (eL) {}
      }
      for (let i = 0; i < redN; i++) {
        let bx, by;
        if (i < ctfEnemy.length) { bx = ctfEnemy[i].x; by = safeY(bx, ctfEnemy[i].y); }
        else { bx = this.mapWidth - 180 - i * 140; by = this._groundSpawnY(bx); }
        // k402: зеркало синего — тот же карман (см. выше).
        try {
          if (this.mapWidth === 3800 && typeof bx === 'number' && typeof by === 'number') {
            if ((bx >= 680 && bx <= 820) || (bx >= 2980 && bx <= 3140)) by -= 140;
          }
        } catch (e) {}
        // k383: сдвиг валидатора + стартовый лог (карман на спавне).
        let _shR = 0;
        try {
          const _oxR = bx, _oyR = by;
          const sv = this._validateSpawn(bx, by);
          bx = sv.x; by = sv.y;
          _shR = Math.round(Math.hypot(bx - _oxR, by - _oyR));
        } catch (e) {}
        const _nbR = mkBot(bx, by, 'red', i < redDef ? 'defend' : 'attack');
        try { if (_nbR) { _nbR._spawnShift = _shR; this._logSpawn(_nbR, bx, by); } } catch (eL) {}
      }
      return;
    }

    const count = this.mode === 'FFA' ? this.botCount : 5;
    const isTDM = this.mode === 'TDM';
    const isBOMB = this.mode === 'BOMB';
    const isKOTH = this.mode === 'KOTH';
    // TDM/KOTH — красные = лимит; BOMB симметрично (обороне проще стоять,
    // иначе носителя убивают по кругу и матч не заканчивается).
    // Кап 15 ботов суммарно (синхронно с CTF выше): опция лобби «8+8»
    // даёт 8+7=15 без подмены. FPS-контроль — строкой [AUTO] fps в дампе.
    let redCount = isTDM ? this.redBots : isBOMB ? (this.campaignMission ? Math.max(0, this.redBots) : (this.redBots <= 0 ? 0 : Math.max(1, this.redBots - 1))) : (isKOTH ? this.redBots : count);
    // «Без союзников»: красные как выбрано, синих ботов ноль (только игрок).
    // Кампании не касается (состав из уровня). Синие: 0 в лобби — то же самое.
    const _soloT = !!(gameState.noAllies && !this.campaignMission);
    let allyCount = (isTDM || isBOMB || isKOTH) ? ((_soloT || this.blueBots <= 0) ? 0 : Math.max(1, this.blueBots - 1)) : 0;
    // Гандикап кампании (levels.js: redNerf): срезаем красных на тяжёлых
    // миссиях, синих не трогаем. Только KOTH/кампания, остальное не задето.
    if (isKOTH && this.campaignLevel && Number.isFinite(this.campaignLevel.redNerf)) {
      redCount = Math.max(1, redCount - this.campaignLevel.redNerf);
    }
    if ((isTDM || isBOMB || isKOTH) && redCount + allyCount > 15) {
      if (redCount <= 0) allyCount = 15;
      else if (allyCount <= 0) redCount = 15;
      else {
        const k = 15 / (redCount + allyCount);
        redCount = Math.max(1, Math.round(redCount * k));
        allyCount = 15 - redCount;
      }
    }
    const total = (isTDM || isBOMB || isKOTH) ? redCount + allyCount : count;

    // BOMB: все в атаке (защитников нет ни в каком режиме):
    // идут с бомбой на чужую базу, кроют носильщика, перехватывают.
    let _bombBlueDef = 0;
    let _bombRedDef = 0;
    let _bombBlueSeen = 0, _bombRedSeen = 0;
    for (let index = 0; index < total; index++) {
      const isAlly = (isTDM || isBOMB || isKOTH) && (index >= redCount);
      const team = isAlly ? 'blue' : (this.mode === 'FFA' ? `enemy-${index}` : 'red');

      let x, y;
      const genTeam = (this.campaignSpawns && this.campaignSpawns.team) || [];
      const genEnemy = (this.campaignSpawns && this.campaignSpawns.enemy) || [];
      if (this.mode === 'FFA' && this.ffaSpawns) {
        const sp = this.ffaSpawns[index + 1];
        x = sp.x;
        y = this._groundSpawnY(sp.x);
      } else if (isTDM || isBOMB || isKOTH) {
        // Кастомная карта: точки редактора важнее процедура.
        // Запас вверх: точка впритык к геометрии клинит на спавне.
        if (isAlly && genTeam.length) {
          const s = genTeam[(index - redCount) % genTeam.length];
          x = s.x; y = s.y - 16;
          try { if (this._inSolid && this._inSolid(x, y, 30)) y = this._groundSpawnY(x); } catch (e) {}
        } else if (!isAlly && genEnemy.length) {
          const s = genEnemy[index % genEnemy.length];
          x = s.x; y = s.y - 16;
          try { if (this._inSolid && this._inSolid(x, y, 30)) y = this._groundSpawnY(x); } catch (e) {}
        } else {
          // Команды — на своих базах (синие слева, красные справа),
          // а не все слева кучей: раньше красные спавнились на 900+ и
          // шли с одной стороны вместе с синими.
          if (isAlly) {
            x = 180 + (index - redCount) * 140;
          } else {
            x = this.mapWidth - 180 - index * 140;
          }
          y = this._groundSpawnY(x);
        }
      } else {
        x = 850 + index * 250;
        y = 550;
      }
      // Проверка на карман (кастомные карты/тесные углы): без выхода
      // точку сдвигаем к ближайшей свободной.
      try {
        const sv = this._validateSpawn(x, y);
        x = sv.x; y = sv.y;
      } catch (e) {}

      const roll = Math.random();
      // Банда: первые синие слоты — свои бойцы.
      let _gm2 = null;
      try {
        if (isAlly && this._gangQueue && this._gangQueue.length) _gm2 = this._gangQueue.shift();
      } catch (e) { _gm2 = null; }
      const EnemyClass = _gm2 ? (classMap[_gm2.class] || Assault) : (roll < 0.5 ? Assault : roll < 0.7 ? Tank : roll < 0.9 ? Medic : Sniper);
      // Ветеран: штурмовики идут с лучшим доступным (было фикс АК-47).
      const vetAssault = this.botDifficulty?.id === 'veteran' && EnemyClass === Assault;
      const clsId = EnemyClass === Tank ? 'Tank' : EnemyClass === Medic ? 'Medic' : EnemyClass === Sniper ? 'Sniper' : 'Assault';
      let _primary2 = null;
      try {
        _primary2 = (_gm2 && _gm2.gun) ? _gm2.gun : this._pickBotPrimary(clsId, vetAssault);
      } catch (e) { _primary2 = this._pickBotPrimary(clsId, vetAssault); }
      const enemy = new EnemyClass(this, x, y, {
        name: (_gm2 && _gm2.name) ? _gm2.name : this._botName(),
        team,
        isAI: true,
        primary: _primary2
      });
      enemy.setTexture('enemy');
      enemy.setTint(isAlly ? 0x44ccff : 0xff5555);
      enemy.spawn = { x, y };
      this.players.push(enemy);
      this._bindFighter(enemy);
      this.physics.add.collider(enemy, this.platforms);
      this.physics.add.collider(enemy, this.covers);
      enemy.ai = new EnemyAI(enemy, this);
      if (isBOMB) {
        if (team === 'blue') {
          enemy.ai._bombRole = _bombBlueSeen < _bombBlueDef ? 'defend' : 'attack';
          _bombBlueSeen++;
        } else {
          enemy.ai._bombRole = _bombRedSeen < _bombRedDef ? 'defend' : 'attack';
          _bombRedSeen++;
        }
      }
      this.applyBotDifficulty(enemy);
      try {
        if (_gm2) {
          Gang.applyGangStatsToBot(enemy, _gm2);
          this._gangFighters.push({ id: _gm2.id, bot: enemy });
        }
      } catch (e) {}
      // Мутаторы: ножи принудительно, стекло/туман — стартовые статы.
      try {
        if (hasMut(this.mutators, 'knives')) stripToKnife(enemy);
        applySpawnStats(enemy, this.mutators);
      } catch (e) {}
      this._paintName(enemy);

      if (this.mode === 'FFA') {
        this.enemySpawnPoints.push({ x, y });
      }
    }
  }

  // Ствол бота — из доступного игроку на его уровне (свой класс):
  // на 1-м уровне все бегают со стартовыми стволами, дальше — разнообразно.
  // Ветеран-штурмовик держит АК-47 (сложность), остальное — пул по уровню.
export function _pickBotPrimary(classId, veteranAK) {
    try {
      const lvl = (typeof gameState !== 'undefined' && gameState.level) || 1;
      if (veteranAK) {
        const ak = weaponsList.find(w => w && w.name === 'AK-47');
        if (ak && (ak.unlockLevel || 1) <= lvl) return 'AK-47';
      }
      const list = (weaponByClass[classId] || [])
        // Общее оружие (РПГ) — в пул каждого класса на равных с остальными,
        // с тем же фильтром по уровню ниже (лотерей и отдельных шансов нет).
        .concat(weaponByClass.Common || [])
        .map(n => weaponsList.find(w => w && w.name === n))
        .filter(w => w && (w.unlockLevel || 1) <= lvl);
      if (list.length) return list[(Math.random() * list.length) | 0].name;
      const defs = (classDefinitions || []).find(cd => cd.id === classId);
      return (defs && defs.defaultPrimary) || 'bad_ak47';
    } catch (e) {
      return 'bad_ak47';
    }
  }

  // Уникальное русское имя бота на матч (имена из names.js).
export function _botName() {
    this._usedBotNames = this._usedBotNames || [this.playerName, gameState.playerName];
    const pick = randomBotNames(1, this._usedBotNames)[0] || `Гость${this._usedBotNames.length + 1}`;
    this._usedBotNames.push(pick);
    return pick;
  }

  // Цвет ника: свой — жёлтый, синие — синие, красные — красные.
export function _paintName(p) {
    try {
      if (!p || !p.nameText) return;
      p.nameText.setColor(
        p === this.player ? '#ffe066'
        : p.team === 'blue' ? '#7db8ff'
        : p.team === 'red' ? '#ff8888'
        : '#ffffff'
      );
    } catch (e) {}
  }

export function applyBotDifficulty(bot, force) {
    // Сложность действует на ВСЕХ ботов одинаково, включая синих:
    // иначе команда игрока системно слабее на ветеране.
    // k518: force — для демо-слота (см. lifecycle.js): в бенче он должен
    // получать те же правила, что боты, хотя формально это `Player`.
    if (
      !bot || (!bot.isAI && !force) || (bot === this.player && !force) || !this.botDifficulty
    ) {
      return;
    }
    const diff = this.botDifficulty;
    // Запоминаем базу: die()/revive() сбрасывают damageMult в 1 (сброс ульты),
    // без этого ветеран после первой смерти терял +20% урона, а новичок —
    // свой штраф (становился сильнее). HP считаем от базы, иначе повторный
    // вызов стакал бы hpBonus (115 -> 132...).
    if (bot._baseMaxHp == null) bot._baseMaxHp = bot.maxHp;
    bot._diffDmgMult = diff.dmgMult || 1;
    bot.damageMult = (bot._diffDmgMult || 1);
    if (diff.hpBonus) {
      bot.maxHp = Math.round(bot._baseMaxHp * (1 + diff.hpBonus));
      bot.hp = bot.maxHp;
    }
    // Боты: ульта готова через 5 килов (у игрока — через 10).
    // Присваивание, а не накопление: повторные вызовы не стакают.
    bot.ultMaxCharge = 5;
    if (bot.updateBars) bot.updateBars();
  }
