import { gameState } from '../../data/gameState.js';

import { getWeaponLabel, weaponsList } from '../../data/weapons.js';

import { vibrate } from '../../data/gameSettings.js';

import Assault from '../../entities/Assault.js';
import Tank from '../../entities/Tank.js';
import Medic from '../../entities/Medic.js';
import Sniper from '../../entities/Sniper.js';

import { touchMove, touchAimWorld, consumeTouchJump, updateTouchTransform } from '../../ui/touch.js';
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
export function _onDamage(m) {
    if (!m) return;
    try {
      if (m.target === this.myId) {
        if (this.player) {
          this.player.hp = Math.max(0, +m.hp || 0);
          if (m.armor != null) this.player.armor = Math.max(0, +m.armor || 0);
          try { this._bloodFx(this.player.x, this.player.y - 30, 4); } catch (e) {}
        }
      } else {
        const rec = this._puppets.get(m.target);
        if (rec && rec.f) {
          rec.f.hp = Math.max(0, +m.hp || 0);
          if (m.armor != null) rec.f.armor = Math.max(0, +m.armor || 0);
          try { this._bloodFx(rec.f.x, rec.f.y - 30, 4); } catch (e) {}
        }
      }
      // Моё попадание — без меток: в одиночке их нет, только кровь выше.
    } catch (e) {}
  }

export function _onDead(m) {
    if (!m) return;
    try {
      const victimIsMe = m.id === this.myId;
      // by=-1: тихий уход (без убийцы и очков) — киллфид без героя.
      const byGone = m.by === -1 || m.by == null;
      const byIsMe = !byGone && m.by === this.myId;
      // Строка киллфида как в одиночке: цвет по команде убийцы + ствол.
      // Ствол и зона — с сервера (m.w/m.zone), запасной вариант — локальный.
      // Хедшот — значком слева от строки (как _deathZone в одиночке), без подписей.
      let byTeam = null, victimTeam = null, wLabel = '', hs = false, isTeamkill = false;
      try {
        if (byIsMe) {
          byTeam = this.myTeam;
          if (this.player && this.player.weapon) wLabel = getWeaponLabel(this.player.weapon.name);
        } else if (!byGone) {
          const rec = this._puppets.get(m.by);
          const reg = this._matchInfo(m.by);
          byTeam = (reg && reg.team) || (rec && rec.f && rec.f.team) || null;
          const wn = (m.w) || (rec && rec.lastGun);
          if (wn) wLabel = getWeaponLabel(wn);
        }
        // Команда жертвы — для подсветки убийства своего.
        if (victimIsMe) {
          victimTeam = this.myTeam;
        } else {
          const recV = this._puppets.get(m.id);
          const regV = this._matchInfo(m.id);
          victimTeam = (regV && regV.team) || (recV && recV.f && recV.f.team) || null;
        }
        hs = (m.zone === 'head' && !byGone && m.id !== m.by);
        // Тимкилл: в командном режиме убийца и жертва одного цвета (суицид — не в счёт).
        isTeamkill = !this._ffa && !byGone && m.id !== m.by &&
          byTeam != null && victimTeam != null && byTeam === victimTeam;
      } catch (e) {}
      this._feedKill(this._nameOf(m.id), byGone ? null : this._nameOf(m.by), victimIsMe, byIsMe, byTeam, wLabel, hs, isTeamkill);
      // Эффект смерти как в одиночке (вспышка+кольцо+кровь, в голову — веер).
      // Координаты — до прятанья тела ниже.
      try {
        if (victimIsMe && this.player) this._killFx(this.player.x, this.player.y, m.zone);
        else {
          const recV = this._puppets.get(m.id);
          if (recV && recV.f) this._killFx(recV.f.x, recV.f.y, m.zone);
        }
      } catch (e) {}
      // Ульта копится килами как в одиночке (X — когда готова).
      // За своих — нет: тимкилл и так карается минусом, награда не положена.
      try {
        let victimIsAlly = false;
        if (!this._ffa && !victimIsMe) {
          try {
            const reg = this._matchInfo(m.id);
            const recV = this._puppets.get(m.id);
            const vt = (reg && reg.team) || (recV && recV.f && recV.f.team) || null;
            victimIsAlly = vt != null && vt === (this.myTeam || 'blue');
          } catch (e) {}
        }
        if (byIsMe && !victimIsMe && !victimIsAlly && this.player && this.player.addUltCharge) {
          this.player.addUltCharge(1);
        }
      } catch (e) {}
      if (victimIsMe) {
        this._dead = true;
        // Локальная смерть по-серверному: движок тоже мёртв, иначе ствол
        // и ник каждый кадр возвращают updateGun/updateBars.
        try {
          const pp = this.player;
          if (pp) {
            pp.dead = true;
            try { pp.setVelocity(0, 0); } catch (e) {}
            try {
              (pp.inventory || []).forEach(w => { if (w && w.cancelReload) w.cancelReload(); });
            } catch (e) {}
          }
        } catch (e) {}
        this._setFighterVisible(this.player, false);
        this._toast('Тебя убили — жди возрождения');
      } else {
        const rec = this._puppets.get(m.id);
        if (rec) {
          rec.dead = true;
          this._setFighterVisible(rec.f, false);
        }
      }
    } catch (e) {}
  }

export function _onSpawn(m) {
    if (!m) return;
    try {
      if (m.id === this.myId) {
        this._dead = false;
        const p = this.player;
        if (p) {
          // Полное возрождение движком (части/ствол/бары/прицел),
          // ХП и броню поверх — с сервера. Точка — на опору (стоя).
          try {
            if (typeof p.revive === 'function') {
              const rs = this._restSpawn(m.x, m.y);
              p.revive(rs.x, rs.y);
            }
            else if (p.body) { p.body.enable = true; p.body.reset(m.x, m.y); }
            else p.setPosition(m.x, m.y);
          } catch (e) {
            try { p.setPosition(m.x, m.y); } catch (e2) {}
          }
          p.hp = Math.max(1, +m.hp || 100);
          if (m.armor != null) p.armor = Math.max(0, +m.armor || 0);
          this._setFighterVisible(p, true);
        }
      } else {
        const rec = this._puppets.get(m.id);
        if (rec && rec.f) {
          rec.dead = false;
          // Возрождение не в грунт (см. _safeSpawn) и сразу стоя на опоре.
          // Локальный флаг смерти тоже гасим (движок его сам не снимает).
          try { rec.f.dead = false; } catch (e) {}
          const ssp = this._safeSpawn(m.x, m.y);
          const rs = this._restSpawn(ssp.x, ssp.y);
          rec.tx = rs.x;
          rec.ty = rs.y;
          try {
            if (rec.f.body) rec.f.body.reset(rs.x, rs.y);
            else rec.f.setPosition(rs.x, rs.y);
          } catch (e) {
            rec.f.setPosition(rs.x, rs.y);
          }
          rec.f.hp = Math.max(1, +m.hp || 100);
          if (m.armor != null) rec.f.armor = Math.max(0, +m.armor || 0);
          this._setFighterVisible(rec.f, true);
        }
      }
    } catch (e) {}
  }

export function _onScore(m) {
    if (!m) return;
    try {
      this._board = Array.isArray(m.board) ? m.board : [];
      this._limit = m.limit | 0;
      this._teamScore = { blue: m.blue | 0, red: m.red | 0 };
      // Подтяжка дедлайна из счёта (переподключение/расхождения часов).
      try {
        if (m.timeLeft != null && m.timeLeft >= 0) {
          this._endsAt = Date.now() + (m.timeLeft | 0) * 1000;
        } else if (m.timeLeft === -1) {
          this._endsAt = 0;
        }
      } catch (e) {}
      if (this._ffa) {
        if (!this._scoreText) return;
        const board = (m.board || []).slice(0, 3);
        const me = (m.board || []).find(r => r.id === this.myId);
        const top = board.map((r, i) => `${i + 1}. ${r.name} ${r.kills}`).join('   ');
        this._scoreText.setText(`${top}   |   Я: ${me ? me.kills : 0} / ${m.limit | 0}`);
      } else {
        // Счёт с лимитом как в одиночке («12/30 : 8/30»), центрируем в update.
        const lim = Math.max(1, m.limit | 0 || 1);
        if (this.scoreBlue) this.scoreBlue.setText(`${m.blue | 0}/${lim}`);
        if (this.scoreRed) this.scoreRed.setText(`${m.red | 0}/${lim}`);
      }
    } catch (e) {}
  }

  // Ряд «щит Синие : Красные щит» центрируем вокруг реального центра
  // (на 16:9 = 640, как было) с равными зазорами (как в одиночке).
export function _feedKill(victimName, byName, victimIsMe, byIsMe, byTeam, wLabel, hs, isTeamkill) {
    try {
      this._feed = this._feed || [];
      const kn = byIsMe ? 'Ты' : (byName || '—');
      const vn = victimIsMe ? 'Тебя' : (victimName || '—');
      // Тимкилл выделяем максимально: префикс + суффикс + свой цвет,
      // иначе в бою синяя строка своих теряется среди синих фрагов по чужим.
      const tkMark = isTeamkill ? ' · СВОЙ!' : '';
      const tkPre = isTeamkill ? '⚠ ' : '';
      const line = this.add.text(0, 0, `${tkPre}${kn} ✕ ${vn}${wLabel ? ' · ' + wLabel : ''}${tkMark}`, {
        fontSize: '14px', fontStyle: isTeamkill ? 'bold' : 'normal', color: '#ffffff',
        backgroundColor: isTeamkill ? 'rgba(160,30,0,0.92)' : 'rgba(17,17,51,0.85)', padding: 4,
        fixedWidth: 300, align: 'right'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(140);
      // Цвет строки — по команде убийцы: красная убила синего — красная.
      // Тимкилл — ярко-жёлтым поверх, чтобы выделялся среди обычных фрагов.
      if (isTeamkill) line.setColor('#ffe12e');
      else if (!byName) line.setColor('#cccccc');
      else if (byTeam === 'blue') line.setColor('#7db8ff');
      else if (byTeam === 'red') line.setColor('#ff8888');
      else line.setColor('#ffffff');
      const rowY = 44 + this._feed.length * 24;
      let icon = null, iconItem = null;
      if (hs) {
        try {
          const g = this.add.graphics().setScrollFactor(0).setDepth(140);
          // Голова в прицеле: золотая голова, красный прицел, дырка.
          g.fillStyle(0xffd24a, 1);
          g.fillCircle(0, 0, 6);
          g.lineStyle(2, 0xff2222, 1);
          g.strokeCircle(0, 0, 10);
          g.lineBetween(-13, 0, -7, 0);
          g.lineBetween(7, 0, 13, 0);
          g.lineBetween(0, -13, 0, -7);
          g.lineBetween(0, 7, 0, 13);
          g.fillStyle(0x991111, 1);
          g.fillCircle(2, -2, 2);
          icon = g;
          iconItem = { obj: g, sx: 950, sy: rowY + 11, anchor: 'R' };
          (this._hudFixed = this._hudFixed || []).push(iconItem);
        } catch (e) { icon = null; iconItem = null; }
      }
      const item = { obj: line, icon, iconItem, sx: 1270, sy: rowY, anchor: 'R' };
      (this._hudFixed = this._hudFixed || []).push(item);
      this._feed.push(item);
      while (this._feed.length > 6) {
        const old = this._feed.shift();
        try {
          const ix = (this._hudFixed || []).indexOf(old);
          if (ix >= 0) this._hudFixed.splice(ix, 1);
        } catch (e) {}
        try { old.obj.destroy(); } catch (e) {}
        if (old.iconItem) {
          try {
            const jx = (this._hudFixed || []).indexOf(old.iconItem);
            if (jx >= 0) this._hudFixed.splice(jx, 1);
          } catch (e) {}
        }
        try { if (old.icon) old.icon.destroy(); } catch (e) {}
      }
      this._feed.forEach((it, i) => {
        try { it.sy = 44 + i * 24; } catch (e) {}
        try { if (it.iconItem) it.iconItem.sy = 44 + i * 24 + 11; } catch (e) {}
      });
      this.time.delayedCall(4000, () => {
        try {
          const ix = this._feed.indexOf(item);
          if (ix >= 0) this._feed.splice(ix, 1);
          try {
            const hx = (this._hudFixed || []).indexOf(item);
            if (hx >= 0) this._hudFixed.splice(hx, 1);
          } catch (e) {}
          if (item.iconItem) {
            try {
              const jx = (this._hudFixed || []).indexOf(item.iconItem);
              if (jx >= 0) this._hudFixed.splice(jx, 1);
            } catch (e) {}
          }
          try {
            this.tweens.add({ targets: line, alpha: 0, duration: 400, onComplete: () => line.destroy() });
          } catch (e) { try { line.destroy(); } catch (e2) {} }
          try { if (item.icon) item.icon.destroy(); } catch (e) {}
          this._feed.forEach((it, i) => {
            try { it.sy = 44 + i * 24; } catch (e) {}
            try { if (it.iconItem) it.iconItem.sy = 44 + i * 24 + 11; } catch (e) {}
          });
        } catch (e) {}
      });
    } catch (e) {}
  }

export function _nameOf(id) {
    try {
      if (id === this.myId) return (this.net.myName || gameState.playerName || 'Игрок').slice(0, 16);
      const p = (this.net.players || []).find(x => x.id === id);
      if (p && p.name) return String(p.name).slice(0, 16);
      const rec = this._puppets.get(id);
      if (rec && rec.f && rec.f.playerName) return String(rec.f.playerName).slice(0, 16);
    } catch (e) {}
    return 'Игрок';
  }

  // Баннеры очередью (до 3 строк): серия захватов не затирает
  // предыдущие, каждый живёт 2.5с и уползает вверх по мере новых.
  // Звук события баннера как в одиночке (_playFlagSfx/sfx_sudden):
  // flag/point + team маппятся на свой/чужой сэмпл по моей команде.
export function _bannerSfx(m) {
    try {
      if (!m || !m.sfx || !this.sound || this.sound.locked) return;
      const mine = (m.team === 'blue' || m.team === 'red') && m.team === this.myTeam;
      let key = null, vol = 0.55;
      if (m.sfx === 'flag') {
        key = mine ? 'sfx_flagours' : 'sfx_flagfoe';
        vol = 0.6;
      } else if (m.sfx === 'point') {
        key = mine ? 'sfx_flag_ally' : 'sfx_flag_foe';
        vol = 0.55;
      } else if (m.sfx === 'sudden') {
        key = 'sfx_sudden';
        vol = 1.2;
      }
      if (!key) return;
      if (!this.cache.audio.exists(key)) {
        if (key === 'sfx_flagours' || key === 'sfx_flagfoe') {
          if (!this.cache.audio.exists('sfx_buy')) return;
          key = 'sfx_buy';
          vol = 0.5;
        } else {
          return;
        }
      }
      this.sound.play(key, { volume: vol });
    } catch (e) {}
  }

  // Баннеры как в одиночке (GameScene._ctfBanner): y=92, шаг 34,
  // 17px bold, pad 6, фон #0d0d22dd, depth 97, жизнь 2.5с, макс 3.
export function _banner(text, color) {
    try {
      this._banners = this._banners || [];
      const t = this.add.text(gameW(this) / 2, 92 + this._banners.length * 34, text, {
        fontSize: '17px', fontStyle: 'bold', color: color || '#ffffff',
        backgroundColor: '#0d0d22dd', padding: 6
      }).setOrigin(0.5).setScrollFactor(0).setDepth(97);
      this._banners.push(t);
      while (this._banners.length > 3) {
        const old = this._banners.shift();
        try { old.destroy(); } catch (e) {}
      }
      this._banners.forEach((b, i) => {
        try { b.setY(92 + i * 34); } catch (e) {}
      });
      this.time.delayedCall(2500, () => {
        try {
          const ix = this._banners.indexOf(t);
          if (ix >= 0) this._banners.splice(ix, 1);
          try { t.destroy(); } catch (e) {}
          this._banners.forEach((b, i) => {
            try { b.setY(92 + i * 34); } catch (e) {}
          });
        } catch (e) {}
      });
    } catch (e) {}
  }

    // Минимум сцены для Player.shoot: вспышка, звук, пуля (урон — фаза 3б).
export function _toast(msg) {
    try {
      const t = this.add.text(gameW(this) / 2, 660, msg, {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#252560', padding: 8
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
      this.time.delayedCall(2200, () => {
        try { t.destroy(); } catch (e) {}
      });
    } catch (e) {}
  }

export function update(time, delta) {
    // delta — для паритета с GameScene (dt-нормализация лерпов HUD/зума):
    // Phaser передаёт его всегда, раньше сигнатура его теряла.
    const _dt = (typeof delta === 'number' && Number.isFinite(delta)) ? delta : 16.666;
    const p = this.player;
    if (!p || !p.active) {
      try { if (this.crosshair) this.crosshair.clear(); } catch (e) {}
      return;
    }
    // Фон (пинг/таймер/объективы/гранаты/киты/дым) живёт и у мёртвого:
    // иначе на 5с смерти мир визуально замирает, таймер встаёт.
    try { this._updateHudBackground(time, p); } catch (e) {}
    // Матч окончен (овер-экран): мир стоит — ни ввода, ни стрельбы,
    // ни снапов, ни кукол. Бегать и стрелять после сирены нельзя.
    if (this._matchOver) return;
    // Мёртвый не ходит/не стреляет (гейты ниже по this._dead),
    // но ЧУЖИЕ куклы едут дальше — иначе при смерти всё замирает.
    // Ранний return убран: гейт смерти — перед прицелом внизу.
    if (p.dead) {
      try { if (this.crosshair) this.crosshair.clear(); } catch (e) {}
    }

    // --- Ввод (мёртвый не ходит и не стреляет) ---
    // Мобильное управление (только телефон, на ПК нули).
    let _tmX = 0, _tmCrouch = false, _tAim = null;
    try {
      const _tm = touchMove(this);
      _tmX = _tm.x || 0; _tmCrouch = !!_tm.crouch;
      _tAim = touchAimWorld(this, p, 420);
    } catch (e) { _tmX = 0; _tmCrouch = false; _tAim = null; }
    if (!this._dead) {
      const L = (this.cursors.left.isDown || this.keys.left.isDown) ? -1 : 0;
      const R = (this.cursors.right.isDown || this.keys.right.isDown) ? 1 : 0;
      const dir = L + R;
      if (dir !== 0) p.move(dir);
      else if (_tmX !== 0) p.move(_tmX);
      else p.stop();
      if (Phaser.Input.Keyboard.JustDown(this.keys.jump) || Phaser.Input.Keyboard.JustDown(this.keys.jumpSp) ||
          Phaser.Input.Keyboard.JustDown(this.keys.jumpW) ||
          Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
        try { p.jump(); } catch (e) {}
      }
      try { if (consumeTouchJump(this)) p.jump(); } catch (e) {}
      try {
        p.setCrouch(!!(this.cursors.down.isDown || this.keys.crouch.isDown || _tmCrouch));
      } catch (e) {}
    }
    const ptr = this.input.activePointer;
    const _wp = this._aimWorld();
    let wx = _wp.x, wy = _wp.y;
    // Правый стик телефона перебивает мышь: прицел + огонь от наклона.
    let _tFire = false;
    if (_tAim) { wx = _tAim.x; wy = _tAim.y; _tFire = true; }
    if (!this._dead) {
      try { p.aimAt(wx, wy); } catch (e) {}
      // Палец на джойстике/кнопке — не «мышь»: выстрел только с правого стика.
      let _ptrMouse = false;
      try {
        _ptrMouse = !!(ptr.isDown && ptr.leftButtonDown() &&
          !(this._touch && this._touch.ownIds && this._touch.ownIds.has(ptr.id)));
      } catch (e) { _ptrMouse = false; }
      if (_ptrMouse || _tFire) {
        try { p.shoot(time, wx, wy); } catch (e) {}
        // Вибрацию — не каждый кадр, а не чаще 4 раз/сек.
        if (_tFire && time - (this._lastVibeAt || 0) > 250) { this._lastVibeAt = time; vibrate(15); }
      }
      // Огонь соседям: один ивент на спуск очереди (иначе спам),
      // на обычном темпе — по каждому выстрелу.
      // Очередь (SIG SG x3): числом пуль в ивенте — соседи дорисуют все.
      try {
        const w = p.weapon;
        const mg = w ? w.magazine : -1;
        if (this._lastMag != null && mg < this._lastMag && !this._dead) {
          const burst = w && w.burst > 1;
          const gap = burst ? 400 : 0;
          if (time - (this._lastFireSent || 0) > gap) {
            this._lastFireSent = time;
            let ang = 0;
            try { ang = p.aimAngle ? p.aimAngle() : 0; } catch (e) {}
            // Точка — дуло, а не плечо: иначе у соседей пуля летит
            // параллельно стволу со сдвигом и кажется, что «выше».
            let fx = p.x, fy = p.y - 20;
            try {
              const mz = p.muzzleWorld ? p.muzzleWorld(ang) : null;
              if (mz && Number.isFinite(mz.x) && Number.isFinite(mz.y)) { fx = mz.x; fy = mz.y; }
            } catch (e) {}
            const bn = burst ? Math.max(1, Math.min(5, w.burst | 0)) : 1;
            this.net.sendFire((w && w.name) || '', Math.round(fx), Math.round(fy), ang, bn);
          }
        }
        this._lastMag = mg;
      } catch (e) {}
      // Авто-перезарядка из handleEmpty (вне сцены): шлём серверу старт
      // по переходу в reloading (ручной R уже отметился флагом выше).
      try {
        const w2 = p.weapon;
        const now2 = !!(w2 && w2.reloading);
        if (now2 && !this._wasReloading && w2 && !w2.isMelee && this.net) {
          try { this.net.sendReload(w2.name); } catch (e) {}
        }
        this._wasReloading = now2;
      } catch (e) {}
      if (Phaser.Input.Keyboard.JustDown(this.keys.one)) {
        try { p.selectWeaponSlot(0); } catch (e) {}
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.two)) {
        try { p.selectWeaponSlot(1); } catch (e) {}
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.three)) {
        try { p.selectWeaponSlot(2); } catch (e) {}
      }
    }
    try {
      p.updateBars();
      if (p.updateGun) p.updateGun();
      this._fixOverhead(p);
    } catch (e) {}

    // --- Свои пули по марионеткам: попадание — серверу, урон — от сервера ---
    // Свип отрезка пути за кадр (пуля 1700px/s проходит ~27px/кадр и иначе
    // пролетает сквозь ноги/тело между кадрами) по боксу всего тела.
    // Мёртвый не бьёт (гейт смерти выше снят — куклы едут и у мёртвого).
    if (!this._dead) {
    try {
      this._bullets = (this._bullets || []).filter(b => b && b.active);
      for (const b of this._bullets) {
        if (!b || !b.active) continue;
        try {
          if (b._px == null) { b._px = b.x; b._py = b.y; }
        } catch (e) {}
        let hitId = null, hitZone = 'body';
        for (const [id, rec] of this._puppets) {
          const f = rec.f;
          if (!f || !f.active || rec.dead || f.dead) continue;
          const zn = this._bulletHitsFighter(b, f);
          if (zn) { hitId = id; hitZone = zn; break; }
        }
        try { b._px = b.x; b._py = b.y; } catch (e) {}
        if (hitId != null) {
          // Стена по траектории от дула: иначе кровь в воздухе, а сервер
          // хит срежет (проверено — там та же геометрия).
          try {
            if (this._segBlocked(b._sx, b._sy, b.x, b.y)) { hitId = null; }
          } catch (e) {}
        }
        if (hitId != null) {
          try {
            const hsMult = (this.player && this.player.headshotMult) || 1;
            // Дробь — одним хитом: каждая дробина своим sendHit душит
            // лимит 15/с (8 дробин × 2 очереди = дроп). Копим 120мс.
            const wdef = (weaponsList || []).find(w => w && w.name === (b._wn || '')) || null;
            if (wdef && (wdef.pellets | 0) > 1) {
              this._sendHitBatched(hitId, (b.damage | 0) || 10, b._wn || '', hitZone);
            } else {
              this.net.sendHit(hitId, (b.damage | 0) || 10, b._wn || '', hitZone, hsMult);
            }
          } catch (e) {}
          try { b.destroy(); } catch (e) {}
        }
      }
    } catch (e) {}
    } // end if (!this._dead) — свои пули

    // --- Чужие трассеры гаснут о бойцов (только картинка) ---
    // Иначе пули ботов и соседей летят сквозь тебя без следа. Урона нет
    // (урон считает сервер и пришлёт damage), просто кровь на контакте.
    try {
      this._foreignBullets = (this._foreignBullets || []).filter(b => b && b.active);
      for (const b of this._foreignBullets) {
        if (!b || !b.active) continue;
        try {
          if (b._px == null) { b._px = b.x; b._py = b.y; }
        } catch (e) {}
        let hitF = null;
        try {
          if (this.player && !this.player.dead && b._ownerF !== this.player) {
            if (this._bulletHitsFighter(b, this.player)) hitF = this.player;
          }
        } catch (e) {}
        if (!hitF) {
          for (const [id, rec] of this._puppets) {
            const f = rec.f;
            if (!f || !f.active || rec.dead || f.dead || f === b._ownerF) continue;
            if (this._bulletHitsFighter(b, f)) { hitF = f; break; }
          }
        }
        try { b._px = b.x; b._py = b.y; } catch (e) {}
        if (hitF) {
          try { this._bloodFx(b.x, b.y, 2); } catch (e) {}
          try { b.destroy(); } catch (e) {}
        }
      }
    } catch (e) {}

    // --- Снапшот себя (15Гц, живой) ---
    if (!this._dead && time - this._lastSnapAt > 66) {
      this._lastSnapAt = time;
        try {
        this.net.sendSnap({
          x: p.x, y: p.y,
          vx: (p.body && p.body.velocity) ? p.body.velocity.x : 0,
          vy: (p.body && p.body.velocity) ? p.body.velocity.y : 0,
          hp: p.hp, armor: p.armor,
          aimX: wx, aimY: wy,
          weapon: (p.weapon && p.weapon.name) || '',
          crouch: !!p.crouching,
          // Живая голова из рига (см. _bulletHitsFighter): серверным
          // ботам для честного прицела по факту стойки/приседа.
          headY: (p.head && Number.isFinite(p.head.y)) ? p.head.y : (p.y - 30),
          // Свой билд для серверных формул (стойкость/капы).
          taken: p.damageTakenMult,
          maxHp: p.maxHp, maxArmor: p.maxArmor
        });
      } catch (e) {}
    }

    // --- Марионетки: догон цели (мёртвых не трогаем) ---
    // Скорости — честные из снапов владельца (анимация ног едет от них же),
    // позиция — мягкой доводкой без телепортов каждый кадр: дёрганья нет,
    // рассинхрон подбирается сам. Жёсткий сброс — только при разлёте >300.
    this._puppets.forEach((rec) => {
      const f = rec.f;
      if (!f || !f.active || f.dead || rec.dead) return;
      try {
        const nowT = time || 0;
        const snapAge = nowT - (rec._snapAt || 0);
        // Протухший снап (>0.6с без вестей): горизонтальный стоп,
        // вертикаль — физике (в воздухе упадёт сам, на земле стоит).
        // Без body.reset: reset сносит blocked.down и дёргает анимацию
        // (приземления/пыль на месте), а позиция и так последняя.
        if (snapAge >= 0 && snapAge > 600) {
          try {
            if (f.body) f.setVelocityX(0);
            else f.setPosition(rec.tx, rec.ty);
          } catch (e) {}
          try { f._netMoving = false; } catch (e) {}
        } else {
        // Дед-реконинг цели по X: серверная скорость честная (px/s),
        // тело везёт она — покадровых reset больше нет (они ломали опору,
        // топили тело в грунт и спамили пылью приземлений на месте).
        // Вертикаль НЕ трогаем вообще: гравитация и платформы сами.
        const ageS = Math.max(0, Math.min(0.25, snapAge / 1000));
        const _px = rec.tx + (rec.vx || 0) * ageS;
        const dx = _px - f.x, dy = rec.ty - f.y;
        const d = Math.hypot(dx, dy);
        if (d > 300) {
          // Далеко — редкий телепорт с синхроном тела (опору дальше
          // пересчитает физика, один кадр «полёта» не в счёт).
          try {
            if (f.body) f.body.reset(rec.tx, rec.ty);
            else f.setPosition(rec.tx, rec.ty);
          } catch (e) {
            try { f.setPosition(rec.tx, rec.ty); } catch (e2) {}
          }
          try { f.setVelocity(rec.vx || 0, rec.vy || 0); } catch (e) {}
        } else if (Math.abs(dy) > 120) {
          // Смена этажа — только если под целью реально есть пол:
          // иначе идущий к мосту по земле телепортируется наверх, падает,
          // снова телепортируется — вечный цикл «телепорт-падение»
          // (точка Б и мост). Без пола: догон по X, высота — физике.
          let floorFound = false;
          try {
            const groups = [this.platforms, this.covers];
            for (const grp of groups) {
              if (floorFound || !grp) continue;
              const kids = grp.getChildren();
              for (let i = 0; i < kids.length; i++) {
                const b = kids[i] && kids[i].body;
                if (!b || !b.enable) continue;
                if (f.x < b.x - 2 || f.x > b.x + b.width + 2) continue;
                if (b.y < rec.ty - 70 || b.y > rec.ty + 30) continue;
                floorFound = true;
                break;
              }
            }
          } catch (e) {}
          if (!floorFound) {
            // Пола под целью нет — едем за X как обычно, Y не трогаем.
            try {
              const fresh = snapAge >= 0 && snapAge < 500;
              const svx = fresh ? (rec.vx || 0) : 0;
              const ease = Math.min(1, Math.abs(dx) / 10);
              const boost = Math.max(-150, Math.min(150, dx * 1.5));
              f.setVelocityX(Math.max(-600, Math.min(600, svx * ease + boost)));
            } catch (e) {}
          } else {
            // Пол есть: один перенос по Y с запасом 24px сверху, чтобы
            // не появиться вмурованным в плиту. X продолжает вести скорость.
            try {
              if (f.body) f.body.reset(f.x, rec.ty - 24);
              else f.setPosition(f.x, rec.ty - 24);
            } catch (e) {}
            try { f.setVelocity(rec.vx || 0, 0); } catch (e) {}
          }
        } else {
          // Снапы протухли (>0.5с без вестей) — встать, а не уплывать.
          const fresh = snapAge >= 0 && snapAge < 500;
          const svx = fresh ? (rec.vx || 0) : 0;
          // П-контроллер: серверная скорость + добивка отставания.
          // Плавная остановка у цели: скорость гаснет — не ходим на месте.
          const ease = Math.min(1, Math.abs(dx) / 10);
          const boost = Math.max(-150, Math.min(150, dx * 1.5));
          const vx = Math.max(-600, Math.min(600, svx * ease + boost));
          try { f.setVelocityX(vx); } catch (e) {}
        }
        } // конец ветки свежих снапов (протухшие — стоп выше)
        f.aimAt(rec.aimX, rec.aimY);
        // Ходьба кукол (и ботов тоже): _updateParts ниже решает по
        // _walkFrames (>=3 — нужна скорость тела >30 три кадра подряд)
        // или _netMoving. Боты шлют снапы 8Гц тихими шагами (vx~10-200):
        // чистый порог смещения 0.3/кадр ловил и джиттер ±5px стоящего
        // бота — фаза сбрасывалась каждый кадр и ноги стояли. Поэтому
        // первична честная скорость из снапа, смещение — дубль с запасом.
        // Протухший снап (>0.5с) — стоим, а не идём на месте.
        try {
          const moved = Math.abs(f.x - (rec._lx ?? f.x));
          rec._lx = f.x;
          const nowT2 = time || 0;
          const age2 = nowT2 - (rec._snapAt || 0);
          const fresh2 = age2 >= 0 && age2 < 500;
          f._netMoving = !!(fresh2 && (Math.abs(rec.vx || 0) > 30 || moved > 1.0));
        } catch (e) {}
        // Ноги/тело/присед едут в _updateParts от скорости и _netMoving.
        // Целиком update() куклам не зовём (там ввод/стрельба/ИИ), без этого
        // кукла скользит статично — как и было у ботов.
        try { if (typeof f._updateParts === 'function') f._updateParts(); } catch (e) {}
        // GEO-голова/шея/лицо (арт-голова уже уехала в _updateParts).
        try { if (typeof f._followHeadPuppet === 'function') f._followHeadPuppet(); } catch (e) {}
        f.updateBars();
        if (f.updateGun) f.updateGun();
        this._fixOverhead(f);
      } catch (e) {}
    });

    // Мёртвый дальше не идёт: прицел/перезарядка/HUD — только живым.
    if (p.dead) return;

    // Регенерация из прокачки (гены/сеты) — как тик в одиночке
    // (GameScene.update): себе, пока жив. Чужим ХП владеет сервер.
    try {
      if (p.passiveRegen > 0 && !p.dead && !this._dead && p.hp < p.maxHp) {
        // Паритет с одиночкой: реген через healMult.
        p.hp = Math.min(p.maxHp, p.hp + p.passiveRegen * (p.healMult || 1) * Math.min(100, Math.max(0, time - (p._lastRegenAt || time))) / 1000);
      }
      p._lastRegenAt = time;
    } catch (e) {}

    // Паритет с одиночкой: прицел, перезарядка, фикс HUD под зум,
    // боевой HUD, зум от ствола. TAB — табло со счётом каждого + пинг.
    try { this.drawCrosshair(); } catch (e) {}
    try { this.drawReloadIcon(); } catch (e) {}
    try { this.updateHudTransform(); } catch (e) {}
    // Тач-слой держим на месте при смене зума (смена оружия) — как HUD.
    try { updateTouchTransform(this); } catch (e) {}
    try { this._updateCombatHud(time); } catch (e) {}
  }

  // Фон кадра: зум, табло, гранаты/киты, FPS, пинг+ростер+таймер (1с),
  // объективы, дым. Крутится и у мёртвого (см. update).
