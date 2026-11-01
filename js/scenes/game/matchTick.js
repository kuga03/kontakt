import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';





import { vibrate } from '../../data/gameSettings.js';

import * as Hud from '../../ui/hud.js?v=370';

import * as Koth from '../../modes/koth.js?v=169';

import * as Match from '../../combat/match.js?v=349';

import { touchMove, touchAimWorld, consumeTouchJump, updateTouchTransform } from '../../ui/touch.js?v=4';
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

export function updateTick(time, delta) {
    // Loop-якорь для всех матч-таймеров (респауны, триал, дедлайны):
    // ставится до early-return, чтобы пауза/стори его освежали, а сами
    // дедлайны сдвигаются на выход из паузы/стори (pauseModal/story).
    try { this._loopNow = time; } catch (e) {}
    // Счётчик FPS (оставлен по запросу), без версий и отладочных меток.
    if (this.fpsTxt && this.fpsTxt.active && time - (this._fpsNext || 0) > 500) {
      this._fpsNext = time;
      try {
        const fps = this.game && this.game.loop ? Math.round(this.game.loop.actualFps) : 0;
        this.fpsTxt.setText(fps + ' FPS');
      } catch (e) {}
    }
    // Delta-нормализация: лерпы HUD и стаггер ИИ зависят от времени,
    // а не от кадров (иначе на 30/120 FPS скорость разная).
    const _dt = (typeof delta === 'number' && delta > 0) ? delta : 16.666;
    const k = Math.min(1, _dt / 16.666);
    const lerp12 = 1 - Math.pow(1 - 0.12, k);
    const lerp20 = 1 - Math.pow(1 - 0.2, k);
    // Временной стаггер ИИ: половина ботов думает каждые ~33мс
    // по очереди (раньше — кадровый (tick+phase)%2).
    this._aiAcc = (this._aiAcc || 0) + _dt;
    if (this._aiAcc >= 33) {
      this._aiAcc = 0;
      this._aiPhaseRun = ((this._aiPhaseRun | 0) + 1) % 2;
    }
    if (this._aiPhaseRun == null) this._aiPhaseRun = 0;
    if (this.victoryElems) {
      // Модалки победы не масштабируем (п.15/п.36): зум уже сброшен в 1.
    }
    // Стори-интро кампании — тоже стоп-кадр для логики: физика уже на паузе,
    // а без этого флага update крутился (боты стреляли, KOTH захватывался
    // и очки капали, пока игрок читает текст). Печатная машинка живёт на
    // scene.time и не зависит от этого флага — текст допечатается.
    if (this.isPaused || this.gameOver || this._storyOpen) return;
    // Якорь старта матча по времени цикла (k203): первый живой кадр.
    // Дедлайны ниже считаются от него — рестарт не приносит «прошлое».
    if (!this._modeT0loop) this._modeT0loop = time;
    // Якорь триала — там же (эпоха обязана совпасть с trialEndedTime).
    if (this.mode === 'TRIAL' && !this.trialStart) this.trialStart = time;
    // Трекинг активности для АФК-ворот (пара сравнений чисел за кадр).
    try { Match.trackActivity(this, time); } catch (e) {}
    // k548: ТЕЛЕМЕТРИЯ «я vs боты» для разбора в логе матча.
    // Прыжок = отрыв с земли при вертикальной скорости вверх (ловится
    // покадрово; 0.5с-семпл пропускал бы — за 0.5с vy гаснет на ~450).
    // След — точка раз в 1с (или при сдвиге >120px), у всех, включая
    // человека. Пишется в полный лог как [JMP] и [TR] (см. copyDbg).
    try {
      if (this.mode === 'CTF' && Array.isArray(this.players)) {
        const _js = this._jumpStat || (this._jumpStat = {});
        const _tr = this._trailAll || (this._trailAll = {});
        const _t1 = Math.round(time / 1000);
        for (const pl of this.players) {
          if (!pl || !pl.body || pl.active === false) continue;
          const nm = pl.playerName || '?';
          let e = _js[nm];
          if (!e) e = _js[nm] = { team: pl.team, n: 0, air: false, ev: [] };
          e.team = pl.team;
          const b = pl.body;
          const gr = !!(b.blocked && (b.blocked.down || (b.touching && b.touching.down)));
          const vy = (b.velocity && b.velocity.y) || 0;
          if (gr) e.air = false;
          else if (!e.air && vy < -120) {
            e.air = true; e.n++;
            if (e.ev.length < 800) e.ev.push([_t1, Math.round(pl.x), Math.round(pl.y + 28)]);
          }
          let tr = _tr[nm];
          if (!tr) tr = _tr[nm] = [];
          const last = tr.length ? tr[tr.length - 1] : null;
          if (!last || _t1 !== last[0] ||
              Math.hypot(pl.x - last[1], pl.y - last[2]) > 120) {
            tr.push([_t1, Math.round(pl.x), Math.round(pl.y)]);
            if (tr.length > 400) tr.splice(0, tr.length - 400);
          }
        }
      }
    } catch (eTM548) {}

    // k387: снапшоты позиций после спавна (вход в карман: t=0→пины).
    // 4 порога от старта матча, каждый один раз. Только журнал.
    try {
      const _mt0 = this._modeT0loop || time;
      const _mt = time - _mt0;
      if (_mt < 0) { this._strailDone = null; this._spawnTrail = null; }
      else {
        this._strailDone = this._strailDone || {};
        const _marks = [5000, 15000, 30000, 60000];
        for (let _mi = 0; _mi < _marks.length; _mi++) {
          const _mk = _marks[_mi];
          if (_mt >= _mk && !this._strailDone[_mk]) {
            this._strailDone[_mk] = 1;
            this._spawnTrail = this._spawnTrail || {};
            (this.players || []).forEach(pl => {
              if (!pl || !pl.playerName || pl.dead) return;
              try {
                const _e = this._spawnTrail[pl.playerName] || (this._spawnTrail[pl.playerName] = {});
                _e[_mk] = Math.round(pl.x) + ',' + Math.round(pl.y);
              } catch (eP) {}
            });
          }
        }
      }
    } catch (eST) {}

    // Счётчик FPS (2 раза в секунду, если включён в настройках).
    if (this.fpsTxt && this.fpsTxt.active && time - (this._fpsNext || 0) > 500) {
      this._fpsNext = time;
      try {
        const fps = this.game && this.game.loop ? Math.round(this.game.loop.actualFps) : 0;
        const label = fps + ' FPS';
        if (this.fpsTxt.text !== label) this.fpsTxt.setText(label);
      } catch (e) {}
      // k293: моё местоположение мелким текстом под FPS (те же 2 раза в секунду).
      try {
        if (this.placeTxt && this.placeTxt.active && this.player &&
          Number.isFinite(this.player.x) && Number.isFinite(this.player.y)) {
          const _pl = (typeof this._youPlace === 'function')
            ? this._youPlace(this.player.x, this.player.y) : '?';
          const _pt = `${_pl} ${Math.round(this.player.x)},${Math.round(this.player.y)}`;
          if (this.placeTxt.text !== _pt) this.placeTxt.setText(_pt);
        }
      } catch (e2) {}
    }


    if (!this.player.dead && !this.player._demoPuppet) {
      // Мобильное управление (только телефон, на ПК touchMove = 0).
      let _tmX = 0, _tmCrouch = false, _tAim = null;
      try {
        const _tm = touchMove(this);
        _tmX = _tm.x || 0; _tmCrouch = !!_tm.crouch;
        _tAim = touchAimWorld(this, this.player, 420);
      } catch (e) { _tmX = 0; _tmCrouch = false; _tAim = null; }
      if (this.keys.left.isDown) {
        this.player.move(-1);
      } else if (this.keys.right.isDown) {
        this.player.move(1);
      } else if (_tmX !== 0) {
        this.player.move(_tmX);
      } else {
        this.player.stop();
      }

      if (Phaser.Input.Keyboard.JustDown(this.keys.jump) ||
          Phaser.Input.Keyboard.JustDown(this.keys.jumpW)) {
        this.player.jump();
      }
      try { if (consumeTouchJump(this)) this.player.jump(); } catch (e) {}

      if (this.keys.crouch.isDown || _tmCrouch) {
        this.player.setCrouch(true);
      } else {
        // Отпустили S — пробуем встать всегда: setCrouch сам решает,
        // можно ли (canStand + запас 10px в воздухе). Под низким
        // потолком останемся сидеть, в чистом небе/на земле — встанем.
        // Раньше пробовали только на земле, и после приседа под
        // «ложным» потолком сетки игрок сидел вечно.
        // k418: клин щелью (767,722: сидя плечом в платформе — встать
        // не даёт, хотя рядом свободно; приходится отходить). Не встали
        // впритык — пробуем со сдвигом ±4/8/12 (setCrouch сам решает;
        // сдвиг на месте, тело догоняет за кадр). Не встали нигде —
        // назад как было, сидим. Только ввод, fail-open.
        try { this.player.setCrouch(false, true); } catch (e) {}
        try {
          if (this.player.crouching) {
            const _x0418 = this.player.x;
            for (const _dd418 of [4, -4, 8, -8, 12, -12]) {
              try {
                this.player.x = _x0418 + _dd418;
                this.player.setCrouch(false, true);
                if (!this.player.crouching) break;
              } catch (eD) {}
            }
            if (this.player.crouching) { try { this.player.x = _x0418; } catch (eX) {} }
          }
        } catch (e) {}
      }

      if (Phaser.Input.Keyboard.JustDown(this.keys.one)) {
        this.player.selectWeaponSlot(0);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.two)) {
        this.player.selectWeaponSlot(1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.three)) {
        this.player.selectWeaponSlot(2);
      }

      // Носильщик: F — небольшой бросок в сторону прицела (не под ноги:
      // иначе автоподбор хватает обратно мгновенно; плюс кулдаун 1с в drop).
      // Флаги (включая золотой) — так же: сброс + бросок от себя.
      if (Phaser.Input.Keyboard.JustDown(this.keys.dropB) &&
          !this.isPaused && !this.gameOver && !this._demoBlock()) {
        [this.blueBomb, this.redBomb].forEach(b => {
          if (!b || b.carrier !== this.player) return;
          b.drop();
          try {
            const p = this.player;
            let ax = p.aimX, ay = p.aimY;
            if (!Number.isFinite(ax) || !Number.isFinite(ay)) { ax = p.x + 200; ay = p.y; }
            const ang = Phaser.Math.Angle.Between(p.x, p.y, ax, ay);
            if (b.body) b.body.setVelocity(Math.cos(ang) * 380, Math.sin(ang) * 380 - 140);
          } catch (e) {}
        });
        [this.blueFlag, this.redFlag, this.ctfSuddenFlag].forEach(f => {
          if (!f || f.carrier !== this.player || typeof f.drop !== 'function') return;
          f.drop();
          try {
            const p = this.player;
            let ax = p.aimX, ay = p.aimY;
            if (!Number.isFinite(ax) || !Number.isFinite(ay)) { ax = p.x + 200; ay = p.y; }
            const ang = Phaser.Math.Angle.Between(p.x, p.y, ax, ay);
            if (f.body) f.body.setVelocity(Math.cos(ang) * 380, Math.sin(ang) * 380 - 140);
          } catch (e) {}
        });
      }

      if (this._shootingPointer && !this.isPaused && !this.gameOver) {
        const wp = this.cameras.main.getWorldPoint(
          this._shootingPointer.x,
          this._shootingPointer.y
        );
        this.player.shoot(this.time.now, wp.x, wp.y);
      }
      // Правый стик телефона: прицел + огонь (держит — стреляет очередью сам).
      if (_tAim && !this.isPaused && !this.gameOver && !this._demoBlock()) {
        try {
          this._aimInit = true;
          this.player.aimAt(_tAim.x, _tAim.y);
          this.player.shoot(this.time.now, _tAim.x, _tAim.y);
          // Вибрацию — не каждый кадр (стик держат долго), а не чаще 4 раз/сек.
          if (time - (this._lastVibeAt || 0) > 250) { this._lastVibeAt = time; vibrate(15); }
        } catch (e) {}
      }
    }

    this.players.forEach((player, pIdx) => {
      // Тяжёлые проверки (дым, застревание) — не каждый кадр, а ~7 раз
      // в секунду со сдвигом по игрокам: на глаз то же самое, CPU — нет.
      const slowOk = time >= (player._slowNext || 0);
      if (slowOk) player._slowNext = time + 140 + ((pIdx || 0) % 5) * 12;
      // Стаггер ИИ: боты думают по очереди каждые ~33мс (временной,
      // а не кадровый — см. this._aiAcc выше).
      // Реакция страдает на ≤16мс при окнах 500–1500мс, нагрузка — вдвое меньше.
      if (player._aiPhase == null && player.ai) {
        player._aiPhase = (this._aiPhaseSeq = (this._aiPhaseSeq | 0) + 1) % 2;
      }
      // Страховка от вышвыривания в небо (пенетрация/баг физики):
      // штатные прыжки слабее −800, остальное режем.
      try {
        if (player.body && player.body.velocity.y < -800) {
          player.body.setVelocityY(-800);
        }
      } catch (e) {}
      if (player.ai && !player.dead && player.active !== false) {
        // Заморозка врагов (туториал/интро): останавливаем КАЖДЫЙ кадр,
        // а не только в тики думанья — иначе в промежуточных тиках висит
        // старая скорость и бот скользит.
        if (this.enemiesActiveAt && time < this.enemiesActiveAt) {
          try { player.stop(); } catch (e) {}
        }
        if ((player._aiPhase | 0) === (this._aiPhaseRun | 0)) {
          // Один глючный бот не роняет весь кадр: ловим, троттлим лог,
          // бот просто пропустит такт. Без этого null.x в ИИ = красный экран.
          try {
            // Реальная дельта думания (~66мс), а не кадровая: иначе _aimK
            // в 2 раза медленнее и velocity висит лишний такт.
            const last = player._aiLastThink || 0;
            const aiDt = last ? Phaser.Math.Clamp(time - last, 16, 120) : 33;
            player._aiLastThink = time;
            player.ai.update(time, aiDt);
          } catch (aiErr) {
            try {
              if (time - (this._aiErrAt || 0) > 3000) {
                this._aiErrAt = time;
                console.error('[AI]', aiErr && aiErr.stack || aiErr);
              }
              player.stop();
            } catch (e2) {}
          }
        }
      }
      // Жёсткие рамки движения: подрезаем скорость так, чтобы тело вообще
      // не входило в статику (см. _clampFighterMotion). После этого
      // пересечений нет и стрелять можно всегда.
      try { this._clampFighterMotion(player, _dt / 1000); } catch (e) {}
      // k467 ЗАПЛАТКА СНЯТА (2026-10-22): выталкивание из статики давало
      // заметный толчок при приседе у ящика. По директиве ТЗ «не костыли, а
      // причины» заплатка убрана; причина входа в ящик ищется логом [pen].
      // Подборы для ботов: оверлап привязан разово в createModeObjects
      // (_bindPickupOverlap); здесь только страховка для поздно
      // созданных бойцов, без создания коллайдеров каждый кадр.
      if (player && player.isAI && !player._pickupBound) {
        this._bindPickupOverlap(player);
      }
      if (player.passiveRegen > 0 && !player.dead && player.hp < player.maxHp) {
        // Реген идёт через healMult как аптечки (скилл «Медик» действует и тут).
        player.hp = Math.min(player.maxHp, player.hp + player.passiveRegen * (player.healMult || 1) * Math.min(100, Math.max(0, time - (player._lastRegenAt || time))) / 1000);
      }
      player._lastRegenAt = time;
      player.updateBars();
      // Трупам риг-математику не гоняем: при 16 бойцах и частых смертях впустую.
      if (!player.dead) player.updateGun();
      // Страховка от провала под карту (любая причина: туннелинг на
      // скорости, NaN-координаты, вышвыривание): вернуть бойца на базу,
      // а не терять. В норме не срабатывает никогда.
      try {
        const lost = !Number.isFinite(player.x) || !Number.isFinite(player.y) ||
          player.y > (this.mapHeight || 900) + 200;
        if (lost && !this.gameOver && player.active) {
          let sx = 220;
          if (this.mode === 'FFA' && this.ffaSpawns && this.ffaSpawns.length) {
            sx = this.ffaSpawns[0].x;
          } else if (player.team === 'red') {
            sx = (this.mapWidth || 3000) - 220;
          }
          const sy = this._groundSpawnY(sx);
          try { if (player.body) player.body.setVelocity(0, 0); } catch (e) {}
          player.revive(sx, sy);
        }
      } catch (e) {}
      // Дым скрывает: чужого бота в дыму или за дымом по лучу от меня —
      // плавно гасим/возвращаем (тушка+ник+пушка; трассера/вспышки остаются).
      // updateBars выше форсит нику visible-флаг — работаем через alpha,
      // с ним не конфликтуем. Трупы не трогаем (иначе убитый в дыму
      // всплывает обратно гостом). Проверка — в slowOk-блоке выше.
      if (slowOk) try {
        const viewer = this.player;
        const foeBot = viewer && !viewer.dead && player.isAI && player !== viewer &&
          player.team !== viewer.team && !player.dead;
        if (foeBot) {
          const hide = this._botHiddenBySmoke(viewer, player);
          if (!!player._smokeHidden !== hide) {
            player._smokeHidden = hide;
            this._setSmokeGhost(player, hide);
          }
        } else if (player._smokeHidden && !player.dead) {
          player._smokeHidden = false;
          this._setSmokeGhost(player, false);
        }
      } catch (e) {}
      // Разводки тел нет: бойцы проходят друг сквозь друга.
      // Любое расталкивание стопорило ботов друг о друга (пинг-понг),
      // а толпа загоняла игрока в текстуры. Путь считается только
      // по статике — персонажи препятствием не считаются.
      // Втолкнули в текстуру (толкотня телами): выталкиваем вверх,
      // иначе боец застревает в стене до прыжка. ВАЖНО: радиусы
      // ОТРИЦАТЕЛЬНЫЕ (точка реально внутри солида). Положительный радиус
      // срабатывал и рядом со стеной — выталкивание дёргало вверх при
      // обычной ходьбе вдоль стен и прыжках у платформ (то самое «липну»).
      // Штатный прыжок не трогаем: скорость меньше 60 — полёт, физика сама.
      // В присяде под низкими потолками голову не проверяем.
      // Проверка — в slowOk-блоке выше (застревание за 150мс никуда не денется).
      if (slowOk) try {
        const vyNow = (player.body && player.body.velocity) ? player.body.velocity.y : 0;
        const centerStuck = !player.dead && player.active && this._inSolid(player.x, player.y, -8);
        let headStuck = false;
        if (!centerStuck && !player.dead && player.active && !player.crouching && vyNow >= 60) {
          if (this._inSolid(player.x, player.y - 30, -2)) headStuck = true;
        }
        if (centerStuck || headStuck) {
          const p = this._escapeSolid(player.x, player.y, centerStuck ? -8 : -2);
          player.setPosition(p.x, p.y);
          try { if (player.body) player.body.setVelocity(player.body.velocity.x, Math.min(0, player.body.velocity.y)); } catch (e2) {}
        }
      } catch (e) {}
      // Вис на кромке (допрыг в край: голова в солиде, центр снаружи,
      // в воздухе): держаться не за что — через 350мс сбросить вниз,
      // а не дёргаться на кромке. Боту заодно детур (попробует иначе).
      if (slowOk) try {
        const bd = player.body;
        const air = bd && !bd.blocked.down && !(bd.touching && bd.touching.down);
        if (!player.dead && player.active && air && !player.crouching &&
            !this._inSolid(player.x, player.y, -2) &&
            this._inSolid(player.x, player.y - 30, -2)) {
          const hg = player._rimHang || (player._rimHang = {});
          if (!hg.since) hg.since = time;
          if (time - hg.since > 350) {
            hg.since = 0;
            try { player.setVelocityY(Math.max((bd.velocity && bd.velocity.y) || 0, 250)); } catch (e2) {}
            try {
              if (player.ai) {
                player.ai._climbAt = time + 950;
                player.ai._blockedSince = null;
                player.ai._smartDetour(time, player.x, player.y);
              }
            } catch (e2) {}
          }
        } else if (player._rimHang) {
          player._rimHang.since = 0;
        }
      } catch (e) {}
      // Анти-стак в щели (как на скрине: под платформой между бочками):
      // жму движение, а стою на месте >1.2с — шаг назад + детур и прыжок.
      // Без телепортов: только честное движение. Трекаем по факту движения,
      // а не по вводу — работает и для игрока, и для бота.
      // Намерение, а не скорость тела: зацеп за край платформы в 1px
      // гасит скорость в ноль (move жмётся, vp=0) — по скорости такой
      // клин был невидим и стоял вечно. У ИИ смотрим штамп намерения.
      try {
        if (!player.dead && player.active && player.body) {
          const st = player._unstick || (player._unstick = {});
          const vx = player.body.velocity.x || 0;
          let trying = Math.abs(vx) > 20;
          try {
            if (player.ai && time - (player.ai._moveIntentAt || 0) < 400) trying = true;
          } catch (e) {}
          if (!trying) { st.x = player.x; st.y = player.y; st.at = time; try { st.bestY = null; } catch (eB1) {} }
          else {
            if (st.x == null) { st.x = player.x; st.y = player.y; st.at = time; }
            // k417: прыжки на месте гасили таймер (hypot считал Y: подлёт
            // 200px = «движение», unstick — back/детур/прыжок — не стрелял
            // никогда; носильщики топтались в углах ящиков минутами:
            // Медведь 15с вертикали x1889 + откат, проносы по 64–70с вместо
            // 30с). Считаем раздельно: сдвиг по X (>30 — ушёл) и ПРИРОСТ
            // высоты (>25 вверх — честно лезет, не срываем), сброс уровня
            // (>120 вниз — упал/спустился,.timer заново). Качание на месте
            // (вверх-вниз без прироста) — застой, спасаем штатным пакетом.
            // Только чтения положения + пара чисел, fail-open (пакет тот же).
            let _fy417 = null;
            try {
              const _bb417 = player.body;
              _fy417 = (_bb417 && Number.isFinite(_bb417.y) && Number.isFinite(_bb417.height))
                ? _bb417.y + _bb417.height : player.y + 28;
            } catch (eF4) {}
            try { if (st.bestY == null && _fy417 != null) st.bestY = _fy417; } catch (eB0) {}
            let _rose417 = false, _drop417 = false;
            try {
              if (_fy417 != null && st.bestY != null) {
                if (_fy417 < st.bestY - 25) _rose417 = true;
                else if (_fy417 > st.bestY + 120) _drop417 = true;
              }
            } catch (eRD) {}
            const moved = Math.abs(player.x - st.x);
            // Порог 30px за 2.5с (было 150px/1.2с — дёргало всех, кто
            // топчется у скалы/лесенки: сходящиеся к цели висли
            // в детурах, так и не залезая. Такое окно — уже честная
            // попытка: бегущий прыжок берёт стек 110 за ~1.7с).
            // Ловим только настоящий клин (1px-зацеп, угол): там сдвиг
            // вообще ~0. Патрули (±110), стрейфы (±100) и марши под
            // порог не попадают; стоящий без намерения — тоже (см. trying).
            if (moved > 30 || _rose417 || _drop417) {
              st.x = player.x; st.y = player.y; st.at = time;
              try { if (_fy417 != null) st.bestY = _fy417; } catch (eBY) {}
              try { if (player.ai) player.ai._detContSince = null; } catch (eDC3) {}
            }
            else if (time - (st.at || 0) > 2500) {
              // Дёргаем ТОЛЬКО настоящий клин (упёрся в стену/угол — есть
              // свежий blocked): grinding у скалы без blocked — честная
              // попытка подъёма (300px в три ступени занимают 5-8с), её
              // срывать нельзя. Раньше дёргали всех с net<30 — сходящиеся
              // срывались каждые 2.5с и топтались на месте (seesaw ±,
              // sdx≈0): путь 1200px в обход так не пройти никогда.
              let _wedged = false;
              try {
                const bd = player.body;
                // k348: контактным веткам — тоже причина (иначе st.why/_wedgeWhy
                // старые: Buran k347 7x why=back/climb+back при wg=- — клин от
                // стены читался как «без причины», k343-скип решал по тухлому).
                // Стена — не flat: разбег для допрыга честный, back не скипаем.
                if (bd && (bd.blocked.left || bd.blocked.right)) {
                  _wedged = true;
                  try { st.why = 'wall'; if (player.ai) player.ai._wedgeWhy = 'wall'; } catch (eBW) {}
                }
                else if (player.ai && time - (player.ai._lastBlockedAt || 0) < 2500) {
                  _wedged = true;
                  try { st.why = 'wall'; if (player.ai) player.ai._wedgeWhy = 'wall'; } catch (eBW2) {}
                }
                // k301: притирка к губе без blocked (край плато 2900: 4px над
                // полосой пробника wallAhead, контакт мерцает, _lastBlockedAt
                // протухает) — детектор выше молчит, таймер сбрасывается
                // вечно (k300: ? 9-17с у 2918, руль жмёт на запад, detX пуст,
                // wback-). От честного подъёма отличаем целью НЕ выше
                // (там скала/лесенка — срывать нельзя, как в комментарии выше)
                // и чужими окнами (детур/парк уже рулят — не мешаем).
                else try {
                  const _aiW = player.ai;
                  if (_aiW && _aiW._dbgGoalY != null && Number.isFinite(_aiW._dbgGoalY)) {
                    let _feetW = player.y + 28;
                    try {
                      const _bbW = player.body;
                      if (_bbW && Number.isFinite(_bbW.y) && Number.isFinite(_bbW.height)) _feetW = _bbW.y + _bbW.height;
                    } catch (eFW) {}
                    const _flatGoal = _aiW._dbgGoalY >= _feetW - 100;
                    const _detLive = (time < (_aiW._detourUntil || 0));
                    const _busyWin = _detLive || (time < (_aiW._holdMoveUntil || 0)) ||
                      (time < (_aiW._backUntil || 0)) || (time < (_aiW._pursueStopUntil || 0));
                    // k305: детур живёт непрерывно >15с без смещения (k304:
                    // Смерч wide39-53 + freeze70 в щели, Ураган/Базальт det
                    // 70с) — сам детур зациклился, ждать нечего: спасаем тем
                    // же честным пакетом. Живой детур моложе 15с не трогаем.
                    // Подъём (цель выше) и честные окна — как раньше, мимо.
                    if (_detLive) {
                      try {
                        if (_aiW._detContSince == null) _aiW._detContSince = time;
                      } catch (eDC) {}
                    } else {
                      try { _aiW._detContSince = null; } catch (eDC2) {}
                    }
                    let _detStale = false;
                    try {
                      _detStale = _detLive && _flatGoal && (time - (_aiW._detContSince || time) > 15000);
                    } catch (eDS) {}
                    // k307: абсолютный кап стояния 30с (k306: Хан/Волк 18-26с
                    // в углу 3698 — цель выше на 236, ветка «подъём» защищает,
                    // но 30с без смещения не лезет никто: лесенка 300px идёт
                    // 5-8с с движением >30px и сюда не попадает). Тот же пакет.
                    let _overstay = false;
                    try {
                      _overstay = (time - (st.at || time) > 30000);
                    } catch (eOS) {}
                    if ((_flatGoal && !_busyWin) || _detStale || _overstay) {
                      _wedged = true;
                      // k341: причина зацепа для wedge-ловушки ниже (_detStale/
                      // _overstay/_flatGoal — let внутри try, снаружи не видны;
                      // k340 читал их и падал в '?'). Только запись в трекер.
                      try { st.why = (_overstay ? 'over' : (_detStale ? 'stale' : 'flat')); } catch (eSW) {}
                      // k347: причина последнего дёргания на ИИ (читает STOP
                      // в момент записи — одномоментно; только журнал).
                      try { if (player.ai) player.ai._wedgeWhy = st.why; } catch (eWW) {}
                    }
                  }
                } catch (eW) {}
              } catch (e) {}
              if (!_wedged) { st.x = player.x; st.y = player.y; st.at = time; }
              else {
              // Выхода ТЕЛЕПОРТОМ больше нет (убраны полностью: выглядели
              // как читы — blink сквозь стену/решётку на глазах у игрока).
              // Только честные средства: шаг назад из зацепа (500мс против
              // шерсти размыкает 1px-клин) + боту детур и прыжок, чтобы
              // не качался назад-вперёд на месте, а искал обход.
              try {
                const _aiD = (player.ai && player.ai._dbgDir) || 0;
                if (player.ai) {
                  // k343: шаг назад НЕ от ближней цели (Страж k342: wedge
                  // back1 dx-263 flat + STOP 2918 wback0.5 dh------ detX- —
                  // flat-дёргание уводило с губы от гола, детур уже убран).
                  // Дальние/stale/over — как раньше (там разбег/клин честные).
                  // Пропуск — только back-шаг, детур+прыжок ниже идут своим.
                  // k346: носильщику — на любой дистанции (коридор 2297/1488:
                  // Беркут k340 wedge back-1 dx1283 flat + Скала k345 3x
                  // wback0.5 dh к голу stuck1→2 — каждый шаг назад роняет
                  // пронос; разбег носильщику не нужен — цель по ровному).
                  let _bd = _aiD !== 0 ? -Math.sign(_aiD) : (Math.random() < 0.5 ? -1 : 1);
                  try {
                    const _gxB = player.ai._dbgGoalX;
                    if (_aiD !== 0 && Number.isFinite(_gxB)) {
                      const _dxB = _gxB - player.x;
                      let _csB = null;
                      try { _csB = st.why; } catch (eCB) {}
                      let _carrB = false;
                      try {
                        const _sb = player.ai._dbgSrc || '';
                        _carrB = (_sb === 'ctfCarry' || _sb === 'ctfSuddenCarry');
                      } catch (eSB) {}
                      // k362: губа отменяет и дальний back (Волк k361: 19×2.5с
                      // на 867 h0011 + back-1 + ab1 — hop k360 вперёд и back
                      // k343 назад гасят друг друга; разбег у губы не нужен —
                      // детур+прыжок ниже идут своим). Условия губы как в k360
                      // (ровный гол, слепой пробник к голу, tile рядом).
                      // Только чтения + bd=0.
                      let _lipB = false;
                      try {
                        const _aiL = player.ai;
                        const _gdL = Math.sign(_dxB);
                        if (_aiL && _gdL !== 0) {
                          let _ftL = player.y + 28;
                          try {
                            const _bbL = player.body;
                            if (_bbL && Number.isFinite(_bbL.y) && Number.isFinite(_bbL.height)) _ftL = _bbL.y + _bbL.height;
                          } catch (eFL) {}
                          const _gyL = Number.isFinite(_aiL._dbgGoalY) ? _aiL._dbgGoalY : _ftL;
                          if ((_gyL - _ftL) > -60) {
                            let _blindL = true;
                            try { if (_aiL.wallAhead && _aiL.wallAhead(_gdL)) _blindL = false; } catch (eBL) {}
                            if (_blindL) {
                              try {
                                if (this._inSolid && this._inSolid(player.x + _gdL * 50, _ftL - 14, 14)) _lipB = true;
                              } catch (eIL) {}
                            }
                          }
                        }
                      } catch (eLB) {}
                      if (_csB === 'flat' && _bd !== 0 && Math.sign(_dxB) !== _bd &&
                          (Math.abs(_dxB) < 400 || _carrB || _lipB)) _bd = 0;
                    }
                  } catch (eBB) {}
                  if (_bd !== 0) {
                    player.ai._backUntil = time + 500;
                    player.ai._backDir = _bd;
                  }
                }
              } catch (e) {}
              try {
                if (player.ai && typeof player.ai._smartDetour === 'function') {
                  player.ai._smartDetour(time, player.x, player.y);
                }
              } catch (e) {}
              try {
                if (player.ai && typeof player.ai.forceJump === 'function') {
                  player.ai.forceJump();
                }
              } catch (e) {}
              // k340: ловушка анти-стака (Рысь/Агат на губах 867/2917 стоят
              // с wback0.5+dh к голу+blk1: детур уже убран k337/k339, остался
              // back-шаг отсюда + допрыг). Кто дёргает: причина (flat/stale/
              // over), шаг назад, dx до гола. Только журнал, поведения ноль.
              try {
                if (typeof this._logSaw === 'function' && player.ai) {
                  const _bdW = player.ai._backDir || 0;
                  let _dxW = '?';
                  try {
                    if (Number.isFinite(player.ai._dbgGoalX)) _dxW = Math.round(player.ai._dbgGoalX - player.x);
                  } catch (eDX) {}
                  let _csW = '';
                  try {
                    // k341: причина из st.why (см. выше) — прямые имена тут
                    // вне scope и давали '?'.
                    _csW = (st && st.why) ? st.why : 'flat';
                  } catch (eCS) { _csW = '?'; }
                  this._logSaw(player.ai, 'wedge', { back: _bdW }, null, 'dx' + _dxW + ' ' + _csW);
                }
              } catch (eW) {}
              st.x = player.x; st.y = player.y; st.at = time;
            }
          }
        }
        }
      } catch (e) {}
      // Скан ауры медика — раз в ~5 кадров, а не каждый (O(медики × игроки)).
      if (player instanceof Medic) {
        player._medTick = (player._medTick | 0) + 1;
        if (player._medTick % 5 === 1) player.update();
      }
    });

    this.grenades.getChildren().forEach(g => g.update(time));
    this.pickups.getChildren().forEach(p => p.update && p.update(time));
    // Свип пуль против пролёта сквозь тонкие платформы (см. _sweepBullets).
    try { this._sweepBullets(); } catch (e) {}

    if (this.tut) this.updateTutorial(time);

    if (this.mode === 'TRIAL') {
      this.updateTrial(time);
    }

    if (this.mode === 'FFA' || this.mode === 'TDM' || this.mode === 'CTF' || this.mode === 'BOMB' || this.mode === 'KOTH') {
      this.respawnDeadEnemies(time);
    }

    try {
      this._updateFlags(time);
      this._updateBomb(time);
      this._updateKoth(time);
    } catch (e) { /* флаги не роняют кадр и TAB ниже */ }
    // Счётчик возрождения игрока: «ДО ВОЗРОЖДЕНИЯ: N» по центру.
    // Часы те же, что у ревайва выше — врать не может.
    try {
      const showResp = !this.gameOver && this.player && this.player.dead &&
        (this._respawnAt || 0) > 0 &&
        ['TDM', 'CTF', 'BOMB', 'KOTH'].includes(this.mode);
      if (showResp) {
        const left = Math.max(0, (this._respawnAt || 0) - time);
        if (!this._respawnTxt) {
          this._respawnTxt = this.addHudElement(
            this.add.text(640, 320, '', {
              fontSize: '26px', fontStyle: 'bold', color: '#ffd24a',
              stroke: '#000000', strokeThickness: 5
            }).setOrigin(0.5).setScrollFactor(0).setDepth(150),
            640, 320
          );
        }
        this._respawnTxt.setText(`ДО ВОЗРОЖДЕНИЯ: ${Math.ceil(left / 1000)}`);
        this._respawnTxt.setVisible(true);
      } else if (this._respawnTxt) {
        try { this._respawnTxt.destroy(); } catch (e) {}
        this._respawnTxt = null;
        this._respawnAt = 0;
      }
    } catch (e) {}
    // BOMB: время вышло — победа по счёту; ничья — ОВЕРТАЙМ С ТУРЕЛЬЮ:
    // в центре карты появляется нейтральная турель (большая, на спину),
    // победа — установкой её на свою базу (стоять в зоне 10с). Старой победы
    // «кто дальше донёс» больше нет (треки _blueBest/_redBest оставлены только для статистики).
    // Таймауты раньше 45с матча невозможны (защита от «ОТ с первой секунды»).
    if (this.mode === 'BOMB' && !this.gameOver && !this._bombOvertime &&
        this._matchOver(this._bombDur, time)) {
      const b = this.scores.blue | 0, r = this.scores.red | 0;
      if (b !== r) {
        this.endGame(b > r ? 'Синие победили' : 'Красные победили', b > r);
      } else {
        this._bombOvertime = true;
        this._spawnOvertimeTurret();
      }
    }
    // Страховка победы CTF каждый кадр: счёт мог вырасти любым путём.
    if (this.mode === 'CTF' && !this.gameOver) {
      this.checkVictory();
    }
    // Страховка победы KOTH каждый кадр — по той же причине.
    if (this.mode === 'KOTH' && !this.gameOver) {
      this.checkVictory();
    }
    // Дубль-страховка KOTH: счёт за лимитом висит 3с, а финала всё нет —
    // дожимаем победу напрямую. Страховка на случай регрессий скобок выше.
    if (this.mode === 'KOTH' && !this.gameOver) {
      try {
        if (this.scores.blue >= this.scoreLimit || this.scores.red >= this.scoreLimit) {
          this._kothWinStuck = (this._kothWinStuck | 0) + 1;
          if (this._kothWinStuck > 180) {
            try {
              console.warn('[KOTH] backstop: forcing endGame ' + JSON.stringify({
                mode: this.mode, gameOver: this.gameOver,
                blue: this.scores.blue, red: this.scores.red, limit: this.scoreLimit,
                tBlue: typeof this.scores.blue, tLimit: typeof this.scoreLimit,
                hasCheck: typeof this.checkVictory, hasEnd: typeof this.endGame,
                checkRuns: this._kothCheckRuns | 0, winLogged: !!this._kothWinLogged
              }));
            } catch (e) {}
            this.endGame(
              this.scores.blue >= this.scoreLimit ? 'Синие победили' : 'Красные победили',
              this.scores.blue >= this.scoreLimit
            );
          }
        } else {
          this._kothWinStuck = 0;
        }
      } catch (e) {}
    }
    // TDM: время вышло — ведёт одна из команд: победа ей сразу.
    // Ничья — овертайм до первого кила (см. checkVictory).
    // Дедлайн — по времени цикла через _matchOver (k203): сценовые часы
    // после рестарта с нуля и свежий матч мгновенно «истекал».
    if (this.mode === 'TDM' && !this.gameOver && !this._tdmOvertime &&
        this._matchOver(this._tdmDur, time)) {
      const b = this.scores.blue | 0, r = this.scores.red | 0;
      console.info('[TDM] time out b=' + b + ' r=' + r + ' limit=' + this.scoreLimit);
      if (b !== r) {
        this.endGame(b > r ? 'Синие победили' : 'Красные победили', b > r);
      } else {
        this._tdmOvertime = true;
        try { this._ctfBanner('ОВЕРТАЙМ — ДО ПЕРВОГО КИЛА!', '#ffd24a'); } catch (e) {}
      }
    }
    // CTF: время вышло — ведёт одна из команд: победа ей сразу.
    // Ничья — внезапная смерть: оба флага исчезают,
    // в центре один решающий (доставка на свою базу = победа).
    if (this.mode === 'CTF' && !this.gameOver && !this._ctfOvertime &&
        this._matchOver(this._ctfDur, time)) {
      const b = this.scores.blue | 0, r = this.scores.red | 0;
      try { console.info('[CTF] timeout at elapsed=' + Math.round(time - (this._modeT0loop | 0)) + 'ms b=' + b + ' r=' + r); } catch (e) {}
      if (b !== r) {
        this.endGame(b > r ? 'Синие победили' : 'Красные победили', b > r);
      } else {
        this._startCtfSuddenDeath();
      }
    }
    // KOTH: время вышло — победа по счёту; ничья — овертайм:
    // точки в нейтраль, первый захват решает.
    if (this.mode === 'KOTH' && !this.gameOver && !this._kothOvertime &&
        this._matchOver(this._kothDur, time)) {
      const b = this.scores.blue | 0, r = this.scores.red | 0;
      if (b === r) {
        this._kothOvertime = true;
        (this.kothPoints || []).forEach(pt => {
          pt.holder = null;
          pt.prog = 0;
          pt.tick = 0;
          pt._st = 'idle';
          this._paintKoth(pt);
          this._kothFx(pt.x, pt.y, 'ОВЕРТАЙМ!', '#ffd24a');
        });
      } else {
        this.endGame(b > r ? 'Синие победили' : 'Красные победили', b > r);
      }
    }

    // Per-frame HUD — в ui/hud.js (бары, слоты, счёт, TAB, параллакс).
    Hud.updateHud(this, time, delta);
    // Тач-слой держим на месте при смене зума (смена оружия) — как HUD.
    try { updateTouchTransform(this); } catch (e) {}
    // Адаптив: туман-мутатор держим на весь экран (дешёвый кэш ширины).
    try {
      if (this._fogOverlay && this._fogOverlay[0] && this._fogOverlay[0].active) {
        const _fw = gameW(this);
        if (_fw !== this._fogW) {
          this._fogW = _fw;
          try { this._fogOverlay[0].setDisplaySize(_fw, 720); } catch (e) {}
        }
        try { this._fogOverlay[0].setPosition(_fw / 2, 360); } catch (e) {}
        try { this._fogOverlay[1].setPosition(_fw / 2, 360); } catch (e) {}
      }
    } catch (e) {}
  }

  // Таймер CTF (счёт — строкой выше, как у KOTH).
  // Остаток — по времени цикла через _matchLeft (k203): сценовые часы
  // после рестарта врали бы (см. _modeT0loop).
