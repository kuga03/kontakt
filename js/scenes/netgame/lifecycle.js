import { gameState } from '../../data/gameState.js';
import { NET_ARENA, NET_BUILD } from '../../net/arena.js';

import { ensureClassBadgeTextures } from '../../data/weapons.js';

import { getRigConfig } from '../../data/rigConfig.js';

import { getKeyCode, vibrate } from '../../data/gameSettings.js';

import * as ObjView from '../../net/objview.js';
import Assault from '../../entities/Assault.js';
import Tank from '../../entities/Tank.js';
import Medic from '../../entities/Medic.js';
import Sniper from '../../entities/Sniper.js';

import { createTouchControls, destroyTouchControls } from '../../ui/touch.js';
import { gameW } from '../../ui/layout.js';

const CLASSES = { Assault, Tank, Medic, Sniper };

// Значки вместо букв в шапках статов (дубль хелпера из ui/hud.js —
// сцена hud не импортирует). Нет арта — буква как раньше.
const STAT_ICONS = { 'Ф': 'icon_stat_frags', 'С': 'icon_stat_deaths', 'ФЛ': 'icon_stat_flag', 'УРОН': 'icon_stat_damage', 'ПИНГ': 'icon_stat_ping', 'КПД': 'icon_stat_kpd' };

// Метка версии САМОЙ сцены боя (вторая цифра в маркере): доказывает,
// что загрузился именно этот файл, а не закэшированный. Бампить вместе с ?v=...
const NETG_BUILD = 94;

// Сетевой бой (фаза 3а): движение и присутствие.
// Свой боец — полная физика и стрельба (урон марионеткам — в фазе 3б).
// Чужие — марионетки на снапшотах 15Гц + интерполяция.
// Вход — по started из NetLobbyScene: { net, room, mode, players, myId }.
export function create(data) {
    this.cameras.main.setBackgroundColor('#0a0a2a');
    this.net = (data && data.net) || null;
    this.roomName = (data && data.room) || '?';
    this.mode = (data && data.mode) || 'TDM';
    this.myId = (data && data.myId) || null;
    if (!this.net || !this.net.connected) {
      this.scene.start('NetLobbyScene');
      return;
    }
    const snap0 = (data && data.players) || [];
    this._puppets = new Map(); // id -> { f, tx, ty, aimX, aimY, lastGun, dead }
    // Команды матча из started (единственный надёжный источник):
    // ростер лобби (net.players) после старта протухает (team=null).
    this._matchTeams = new Map(); // id -> { team, name, cls, bot }
    this.smokeClouds = [];
    this._rememberMatchPlayers(snap0);
    this._bullets = [];
    this._lastSnapAt = 0;
    this._dead = false;
    this._ffa = this.mode === 'FFA';
    // Сцена переиспользуется: сбрасываем HUD-состояние прошлого матча.
    this._hudFixed = [];
    this.weaponSlots = [];
    this.weaponSlotHits = [];
    this.weaponSlotTexts = [];
    this.grenSlots = [];
    this._scoreRows = [];
    this._board = [];
    this._limit = 0;
    this._netBoardSig = null;
    this.scoreboard = null;
    this.crosshair = null;
    this.reloadIcon = null;
    this.crosshairR = 8;
    this._prevLevel = gameState.level;
    this.abilityDisp = 0;
    // То же — для всего остального живого состояния, иначе второй и дальше
    // матчи идут на трупах прошлого: tracerGfx мёртв (пуль не видно ВООБЩЕ —
    // drawTracers падает каждый кадр), _obj рисует старые флаги/бомбы,
    // _feed/_banners держат убитые строки, _pelletGroups течёт в новый бой.
    this.tracerGfx = null;
    this._tracerShots = [];
    this._foreignBullets = [];
    this._feed = [];
    this._banners = [];
    this._pelletGroups = {};
    this._lastMag = null;
    this._lastFireSent = 0;
    this._wasReloading = false;
    this._lastSnapAt = 0;
    // Объективы из started (флаги/бомбы/точки видны с первого кадра,
    // а не с первого changed-тика).
    this._obj = (data && data.obj) || null;
    this._objLetters = [];
    this._objGfx = null;
    this._objGfxBack = null;
    this._baseLabels = [];
    this._bombBlueTxt = null;
    this._bombRedTxt = null;
    this._overElems = null;
    this._reObj = null;
    this._netBuildTxt = null;
    this._fpsAt = 0;
    this._hudAt = 0;
    this._fpsTxt = null;
    this._scoreText = null;
    this._timeText = null;
    this._pingText = null;
    this.scoreBlue = null; this.scoreMid = null; this.scoreRed = null;
    this.scoreBadgeB = null; this.scoreBadgeR = null;

    // --- Арена ---
    const A = NET_ARENA;
    this.mapWidth = A.width;
    this.mapHeight = A.height;
    this.physics.world.setBounds(0, 0, A.width, A.height);
    this.platforms = this.physics.add.staticGroup();
    this.pickups = this.physics.add.group();
    this.grenades = this.physics.add.group();
    this.players = [];
    this._kitN = 0;
    // Дедлайн матча с сервера (0 = без лимита): обратный отсчёт един для всех.
    this._endsAt = (data && data.endsAt) || 0;
    // Матч окончен (овер-экран): протухших ботов можно чистить из ростера.
    this._matchOver = false;
    try { this._matchT0 = this.time.now; } catch (e) { this._matchT0 = 0; }
    const ground = this.add.rectangle(A.width / 2, A.groundTop + 40, A.width, 80, 0x3a3a52);
    this.physics.add.existing(ground, true);
    this.platforms.add(ground);
    A.platforms.forEach(p => {
      const r = this.add.rectangle(p.x, p.y, p.w, p.h, 0x333366);
      this.physics.add.existing(r, true);
      this.platforms.add(r);
    });
    // Простой фон-полосы для ориентации.
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(0x0d0d22, 1);
    bg.fillRect(0, 0, A.width, A.height);
    bg.fillStyle(0x12122e, 1);
    for (let x = 0; x < A.width; x += 200) {
      bg.fillRect(x, 0, 2, A.height);
    }

    // --- Свой боец ---
    const me = snap0.find(p => p.id === this.myId) || snap0[0] || {};
    const myCls = CLASSES[me.cls] ? me.cls : 'Assault';
    // youTeam от сервера — страховка рассинхрона (диагностика двойных побед).
    const myTeam = (data.youTeam === 'red' || data.youTeam === 'blue')
      ? data.youTeam
      : (me.team === 'red' ? 'red' : 'blue');
    try { console.info('[NET] match team=', myTeam, 'myId=', this.myId); } catch (e) {}
    const sp0 = (me.spawn && Number.isFinite(me.spawn.x)) ? me.spawn : { x: myTeam === 'red' ? 2250 : 150, y: 800 };
    // Не спавним вмурованным в грунт/плиту (иначе физика швыряет):
    // как _validateSpawn в одиночке, только минимально. Затем посадка
    // на опору — старт стоя, без падения и сквоша (там же).
    const spSafe = this._safeSpawn(sp0.x, sp0.y != null ? sp0.y : 800);
    const sp = this._restSpawn(spSafe.x, spSafe.y);
    const MyCls = CLASSES[myCls];
    this.player = new MyCls(this, sp.x, sp.y, {
      name: (this.net.myName || gameState.playerName || 'Игрок').slice(0, 16),
      team: myTeam
    });
    this.player.setTint(myTeam === 'blue' ? 0x44ccff : 0xff5555);
    this.physics.add.collider(this.player, this.platforms);
    this.myTeam = myTeam;

    // --- Марионетки остальных ---
    snap0.forEach(p => {
      if (p.id !== this.myId) this._upsertPuppet(p);
    });

    // --- Ввод (именованные хендлеры: сцена переиспользуется, на shutdown снимаем) ---
    // Переназначение клавиш — из gameSettings.js (как в одиночке).
    const KC = Phaser.Input.Keyboard.KeyCodes;
    const codeOf = (a) => getKeyCode(a);
    this.keys = this.input.keyboard.addKeys({
      left: codeOf('left'),
      right: codeOf('right'),
      jump: codeOf('jump'),
      jumpSp: KC.SPACE,
      jumpW: KC.W,
      crouch: codeOf('crouch'),
      one: KC.ONE,
      two: KC.TWO,
      three: KC.THREE,
      tab: KC.TAB
    });
    // TAB не отдаём браузеру (иначе фокус уходит и табло не открывается).
    try { this.input.keyboard.addCapture(9); } catch (e) {}
    this.cursors = this.input.keyboard.createCursorKeys();
    this._rHandler = () => {
      try {
        const w = this.player.weapon;
        if (w && !w.isMelee && !w.reloading) {
          const wn = w.name;
          w.reload(null, this);
          try {
            if (w.reloading && this.net) {
              this.net.sendReload(wn);
              this._wasReloading = true;
            }
          } catch (e) {}
        }
      } catch (e) {}
      vibrate(8);
    };
    this._gHandler = () => {
      try {
        if (this.player && !this._dead) {
          const wp = this._aimWorld();
          this.player.throwGrenade('frag', wp.x, wp.y);
        }
      } catch (e) {}
      vibrate(25);
    };
    this._hHandler = () => {
      try {
        if (this.player && !this._dead) {
          const wp = this._aimWorld();
          this.player.throwGrenade('smoke', wp.x, wp.y);
        }
      } catch (e) {}
      vibrate(20);
    };
    this._eHandler = () => {
      try {
        if (this.player && !this._dead && this.player.useAbility) {
          this.player.useAbility(this.time.now);
        }
      } catch (e) {}
      vibrate(20);
    };
    this._xHandler = () => {
      try {
        if (this.player && !this._dead && this.player.useUltimate) {
          this.player.useUltimate(this.time.now);
        }
      } catch (e) {}
      vibrate(30);
    };
    // Переназначаемые клавиши — одним обработчиком 'keydown' (как в одиночке).
    const NK = {
      reload: codeOf('reload'),
      ultimate: codeOf('ultimate'),
      grenade: codeOf('grenade'),
      smoke: codeOf('smoke'),
      ability: codeOf('ability')
    };
    this._keyHandler = (event) => {
      const k = event && event.keyCode;
      if (k === NK.reload) { this._rHandler(); return; }
      if (k === NK.ultimate) { this._xHandler(); return; }
      if (k === NK.grenade) { this._gHandler(); return; }
      if (k === NK.smoke) { this._hHandler(); return; }
      if (k === NK.ability) { this._eHandler(); return; }
    };
    this.input.keyboard.on('keydown', this._keyHandler);
    this._escHandler = () => this._leaveToLobby();
    this.input.keyboard.on('keydown-ESC', this._escHandler);
    this._wheelHandler = (pointer, over, deltaX, deltaY) => {
      try {
        if (!this.player || this._dead) return;
        const inv = this.player.inventory;
        if (!inv || inv.length <= 1) return;
        const dir = deltaY > 0 ? 1 : -1;
        let next = this.player.activeWeaponIndex + dir;
        if (next < 0) next = inv.length - 1;
        if (next >= inv.length) next = 0;
        this.player.selectWeapon(next);
      } catch (e) {}
    };
    this.input.on('wheel', this._wheelHandler);
    // Мобильное управление: два джойстика только на телефоне (на ПК — null).
    try { createTouchControls(this); } catch (e) { try { this._touch = null; } catch (e2) {} }

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    // Паритет с одиночкой: свой курсор прячем, рисуем кастомный прицел,
    // зум от дальности ствола, ник своим цветом.
    this.input.setDefaultCursor('none');
    try {
      this.cameras.main.setZoom(this.getDesiredZoom((this.player.weapon && this.player.weapon.range) || 700));
    } catch (e) {}
    this._paintName(this.player);
    this._fixOverhead(this.player);
    // Значки классов для TAB (cls_Assault/...) — пекутся один раз, как в одиночке.
    try { if (typeof ensureClassBadgeTextures === 'function') ensureClassBadgeTextures(this); } catch (e) {}

    this._buildCombatHud();

    // Метка сборки онлайна: мелко слева вверху (под FPS) + тост на старте.
    // По ней видно, свежая ли сборка загрузилась, а не закэшированная.
    // Две цифры: arena (сеть) / сцена боя. Разошлись — кэш по файлам.
    try {
      this._netBuildTxt = this.addHudElement(this.add.text(12, 32, 'NET v' + NET_BUILD + ' g' + NETG_BUILD, {
        fontSize: '11px', color: '#667788'
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(100), 12, 32);
    } catch (e) { this._netBuildTxt = null; }
    try { this._toast('ОНЛАЙН · сборка NET v' + NET_BUILD); } catch (e) {}

    // --- HUD (верх тоже через addHudElement — стоит на месте при любом зуме) ---
    // Лишнего как в одиночке нет: ни названия комнаты, ни строки состава
    // (состав — в TAB), ни кнопки выхода (выход — ESC). Остаются счёт,
    // таймер, пинг и киллфид.
    this._scoreRowOn = !this._ffa;
    this._rosterText = null;
    this._netLimits = { TDM: 30, FFA: 30, CTF: 3, BOMB: 3, KOTH: 200, DUEL: 10 };
    this._limit = this._netLimits[this.mode] || 30;
    this._scoreText = this.addHudElement(this.add.text(640, 34, '', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100), 640, 34);
    this._timeText = this.addHudElement(this.add.text(640, this._scoreRowOn ? 62 : 60, '', this._scoreRowOn
      ? { fontSize: '15px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0d0d22cc', padding: 5 }
      : { fontSize: '13px', color: '#667788', align: 'center' }
    ).setOrigin(0.5, this._scoreRowOn ? 0.5 : 0).setScrollFactor(0).setDepth(100), 640, this._scoreRowOn ? 62 : 60);
    this._pingText = this.addHudElement(this.add.text(1266, 10, '', {
      fontSize: '14px', color: '#667788'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100), 1266, 10, 'R');
    this.scoreBlue = null; this.scoreMid = null; this.scoreRed = null;
    this.scoreBadgeB = null; this.scoreBadgeR = null;
    this._scoreBlueItem = null; this._scoreMidItem = null; this._scoreRedItem = null;
    this._scoreBadgeBItem = null; this._scoreBadgeRItem = null;
    this._teamScore = { blue: 0, red: 0 };
    if (this._scoreRowOn) {
      this._scoreText.setVisible(false);
      this.scoreBlue = this.addHudElement(this.add.text(452, 10, '', {
        fontSize: '22px', fontStyle: 'bold', color: '#6db4ff', backgroundColor: '#0d0d22cc', padding: 6
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(100), 452, 10);
      this.scoreMid = this.addHudElement(this.add.text(640, 10, ':', {
        fontSize: '22px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0d0d22cc', padding: 6
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100), 640, 10);
      this.scoreRed = this.addHudElement(this.add.text(712, 10, '', {
        fontSize: '22px', fontStyle: 'bold', color: '#ff6666', backgroundColor: '#0d0d22cc', padding: 6
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(100), 712, 10);
      // Щиты 31×38 (Ш×В): чуть меньше «вровень с плашкой счёта» (~39 в высоту),
      // больше прежнего 26×32. Пропорция арта 26/32.
      const _badgeH = 38;
      const _badgeW = 31;
      if (this.textures.exists('badge_blue')) {
        this.scoreBadgeB = this.addHudElement(this.add.image(0, 10, 'badge_blue')
          .setOrigin(0.5, 0).setScrollFactor(0).setDepth(100), 0, 10);
        try { this.scoreBadgeB.setDisplaySize(_badgeW, _badgeH); } catch (e) {}
      }
      if (this.textures.exists('badge_red')) {
        this.scoreBadgeR = this.addHudElement(this.add.image(0, 10, 'badge_red')
          .setOrigin(0.5, 0).setScrollFactor(0).setDepth(100), 0, 10);
        try { this.scoreBadgeR.setDisplaySize(_badgeW, _badgeH); } catch (e) {}
      }
      this._scoreBlueItem = this._hudFixed.find(h => h.obj === this.scoreBlue) || null;
      this._scoreMidItem = this._hudFixed.find(h => h.obj === this.scoreMid) || null;
      this._scoreRedItem = this._hudFixed.find(h => h.obj === this.scoreRed) || null;
      this._scoreBadgeBItem = this.scoreBadgeB ? this._hudFixed.find(h => h.obj === this.scoreBadgeB) : null;
      this._scoreBadgeRItem = this.scoreBadgeR ? this._hudFixed.find(h => h.obj === this.scoreBadgeR) : null;
      // Счёт виден сразу (0/лимит), а не после первого кила.
      try {
        if (this.scoreBlue) this.scoreBlue.setText(`0/${this._limit}`);
        if (this.scoreRed) this.scoreRed.setText(`0/${this._limit}`);
        if (this._ffa && this._scoreText) this._scoreText.setText(`Я: 0 / ${this._limit}`);
      } catch (e) {}
    }
    // Кнопки выхода нет как в одиночке: выход — ESC.
    // Подсказку управления убрали: низ занят боевым HUD как в одиночке
    // (оружие/патроны слева, HP/броня по центру). Было налезание текстов.

    // --- Сеть ---
    this.net.onsnap = (m) => this._onSnap(m);
    this.net.onplayers = () => this._syncRoster();
    this.net.onstarted = (m) => this._onRejoin(m);
    this.net.ondamage = (m) => this._onDamage(m);
    this.net.ondead = (m) => this._onDead(m);
    this.net.onspawn = (m) => this._onSpawn(m);
    this.net.onscore = (m) => this._onScore(m);
    this.net.onover = (m) => this._onOver(m);
    this.net.onfire = (m) => this._onFire(m);
    this.net.onnaded = (m) => this._onNaded(m);
    this.net.onboom = (m) => this._onBoom(m);
    this.net.onsmoke = (m) => this._onSmoke(m);
    this.net.onkit = (m) => this._onKit(m);
    this.net.onkitok = (m) => this._onKitOk(m);
    this.net.onkitfix = (m) => this._onKitFix(m);
    this.net.onobj = (m) => {
      try {
        if (m && m.mode === this.mode) this._obj = m.obj || null;
      } catch (e) {}
    };
    this.net.onbanner = (m) => {
      try {
        if (m) {
          this._banner(m.text || '', m.color || '#ffffff');
          this._bannerSfx(m);
        }
      } catch (e) {}
    };
    this._obj = null;
    this._buildObjVisuals();
    this.net.onclose = () => {
      this._showReconnect();
    };
    this.net.onerror = (msg) => this._toast(msg);
    // Музыка боя как в одиночке (там mus_other, в меню mus_menu):
    // глушим менюшную, свой трек не дёргаем если уже играет.
    // В меню MenuScene2 сама глушит боевую и стартует свою.
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
        if (this.sound.locked && Phaser.Sound && Phaser.Sound.Events) {
          this.sound.once(Phaser.Sound.Events.UNLOCKED, startMus);
        }
      }
    } catch (e) { /* без звука игра не встанет */ }
    this._syncRoster();
    this._hudAt = 0;

    this.events.once('shutdown', () => {
      // Чистим ВСЕ net.on* хендлеры сцены (иначе вторая катка едет на старых).
      try {
        if (this.net) {
          this.net.onsnap = null;
          this.net.onplayers = null;
          this.net.onstarted = null;
          this.net.ondamage = null;
          this.net.ondead = null;
          this.net.onspawn = null;
          this.net.onscore = null;
          this.net.onover = null;
          this.net.onfire = null;
          this.net.onnaded = null;
          this.net.onboom = null;
          this.net.onsmoke = null;
          this.net.onkit = null;
          this.net.onkitok = null;
          this.net.onkitfix = null;
          this.net.onobj = null;
          this.net.onbanner = null;
          this.net.onclose = null;
          this.net.onerror = null;
        }
      } catch (e) {}
      // Уходим из боя (в лобби/меню) — боевой трек стоп, дальше менюшная сама.
      try {
        (this.sound.sounds || []).forEach(s => {
          try { if (s && s.key === 'mus_other' && s.isPlaying) s.stop(); } catch (e) {}
        });
      } catch (e) {}
      try { if (this._startMus) this.input.off('pointerdown', this._startMus); } catch (e) {}
      this._startMus = null;
      try { this.input.setDefaultCursor('default'); } catch (e) {}
      try {
        if (this._keyHandler) this.input.keyboard.off('keydown', this._keyHandler);
        if (this._escHandler) this.input.keyboard.off('keydown-ESC', this._escHandler);
        if (this._wheelHandler) this.input.off('wheel', this._wheelHandler);
      } catch (e) {}
      this._keyHandler = null;
      this._rHandler = this._gHandler = this._hHandler = null;
      this._eHandler = this._xHandler = this._escHandler = null;
      this._wheelHandler = null;
      try { destroyTouchControls(this); } catch (e) {}
    });
  }

export function _leaveToLobby() {
    try { this.net.close(); } catch (e) {}
    try { this.net.onclose = null; } catch (e) {}
    this.scene.start('NetLobbyScene');
  }

  // Сервер прислал started повторно — это наше переподключение:
  // добрать марионеток (включая ботов) и снять оверлей.
export function _onRejoin(m) {
    try {
      if (m && Array.isArray(m.players)) {
        this._rememberMatchPlayers(m.players);
        m.players.forEach(p => {
          if (p.id !== this.myId) this._upsertPuppet(p);
        });
      }
      // Объективы из started (флаги/бомбы видны сразу, а не с первого тика).
      try { if (m && m.obj) this._obj = m.obj; } catch (e) {}
      this._dead = false;
      this._hideReconnect();
      this._toast('Снова в бою');
    } catch (e) {}
  }

export function _showReconnect() {
    try {
      if (!this.scene.isActive()) return;
      this._hideReconnect(true);
      const _cx = gameW(this) / 2;
      const bg = this.add.rectangle(_cx, 360, 560, 220, 0x000000, 0.82).setScrollFactor(0).setDepth(400);
      const t = this.add.text(_cx, 300, 'Соединение потеряно', {
        fontSize: '24px', fontStyle: 'bold', color: '#ff8888'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
      const sub = this.add.text(_cx, 340, 'Сервер держит твоё место 60с', {
        fontSize: '14px', color: '#99aacc'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
      const btn = this.add.text(_cx, 400, 'ПЕРЕПОДКЛЮЧИТЬСЯ', {
        fontSize: '18px', color: '#ffffff', backgroundColor: '#2a5a2a', padding: 10
      }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        try { sub.setText('Подключаемся...'); } catch (e) {}
        this.net.reconnect().then(() => {
          this._hideReconnect();
        }).catch((e) => {
          try { sub.setText((e && e.message) || 'Не подключилось'); } catch (e2) {}
        });
      });
      const out = this.add.text(_cx, 450, 'Выйти в лобби (место сгорит)', {
        fontSize: '13px', color: '#667788'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
      out.setInteractive({ useHandCursor: true });
      out.on('pointerdown', () => this._leaveToLobby());
      this._reObj = [bg, t, sub, btn, out];
    } catch (e) {}
  }

export function _hideReconnect(soft) {
    try {
      if (this._reObj) this._reObj.forEach(o => { try { o.destroy(); } catch (e) {} });
      this._reObj = null;
      if (!soft) this._toast('Снова в бою');
    } catch (e) {}
  }

  // Точка в солиде — см. _inSolid ниже рядом с throwGrenade (точный
  // AABB-путь по телам платформ). Нужен спавнам и Player.revive (он зовёт
  // sc._inSolid — без него в сети escape пропускался и точка садилась в грунт).
  // Вытолкнуть точку из солида вверх — как _escapeSolid в одиночке.
export function _escapeSolid(x, y, r) {
    let ny = y, guard = 0;
    const rad = (typeof r === 'number') ? r : 10;
    try {
      while (this._inSolid(x, ny, rad) && guard < 12) { ny -= 18; guard++; }
    } catch (e) {}
    return { x, y: ny };
  }

  // Безопасная точка спавна: если вмурована — вытолкнуть вверх и дать
  // запас на падение. Запас 48: половина высокого тела k~1.64 (46px) + 2.
  // Старые 30 пропускали точку 817 (73 vs 70 — «свободно» на 3px), а низ
  // тела 46px уходил в грунт на 13-19px — те самые «боты в земле».
  // Свободную точку не трогаем (спавн без лишнего падения).
export function _safeSpawn(x, y) {
    try {
      if (!this._inSolid(x, y, 48)) return { x, y };
      const esc = this._escapeSolid(x, y, 48);
      return { x: esc.x, y: esc.y - 24 };
    } catch (e) {}
    return { x, y };
  }

  // Масштаб тела из рига — как хитбокс Player (k): низ тела = f.y + 60k - 30
  // (offset 4k + высота 56k − полтекстуры 30). Сервер считает ступни y+28
  // (k=1), при k~1.64 это 68 — оттуда и вечные ~35px рассинхрона.
export function _rigK() {
    try {
      const rc = (typeof getRigConfig === 'function') ? getRigConfig() : null;
      const t = (rc && rc.torso && rc.torso.s) || 36;
      const l = (rc && rc.legs && rc.legs.s) || 47;
      const h = (rc && rc.head && rc.head.s) || 22;
      return Phaser.Math.Clamp((t + l + h) / 64, 0.6, 2.2);
    } catch (e) { return 1.64; }
  }

  // Опора под точкой: верх ближайшего солида под ней (как _findGroundY
  // в одиночке, только локально). Аналитически по телам — точно, без
  // квантования сэмплинга (оно давало +14px и снова падение со сквошем).
  // Берём поверхности НЕ ВЫШЕ точки: навес над головой — не опора.
export function _supportTop(x, approxY) {
    return ObjView.supportTop(this, x, approxY);
  }

  // Посадка на опору: центр тела так, чтобы низ встал ровно на поверхность.
  // Офлайн так стартует стоя (без падения и сквоша); сеть падала с 800.
export function _restSpawn(x, y) {
    try {
      const top = this._supportTop(x, y);
      if (top != null) {
        const k = this._rigK();
        return { x, y: top - (60 * k - 30) };
      }
    } catch (e) {}
    return { x, y };
  }
