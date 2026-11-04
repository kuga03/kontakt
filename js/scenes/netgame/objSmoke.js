

import * as ObjView from '../../net/objview.js';
import Assault from '../../entities/Assault.js';
import Tank from '../../entities/Tank.js';
import Medic from '../../entities/Medic.js';
import Sniper from '../../entities/Sniper.js';

import Grenade from '../../entities/Grenade.js';

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
export function _buildObjVisuals() {
    return ObjView.buildObjVisuals(this);
  }

  // Живая позиция носильщика для плавных объективов: сервер шлёт флаг
  // и бомбу 4Гц по серверной точке — без доводки они телепортируются
  // за спиной несущего. Рисуем от отрисованного бойца (плавно),
  // данные сервера — запасной вариант. Возврат: {x, y: ступни, live}.
export function _carrierXY(id, fx, fy) {
    return ObjView.carrierXY(this, id, fx, fy);
  }

export function _drawObj() {
    return ObjView.drawObj(this);
  }

  // --- Гранаты (фаза 3г): свои летят и гремят через сервер ---
export function throwGrenade(owner, type, angle) {
    if (!owner || owner.dead) return;
    try {
      let sx = owner.x + Math.cos(angle) * 30;
      let sy = owner.y - 38;
      // Упор головой в плиту: точку выводим вниз, а не наверх плиты.
      try {
        if (this._inSolid(sx, sy, 6)) {
          let ny = sy;
          for (let i = 0; i < 10; i++) {
            ny += 8;
            if (!this._inSolid(sx, ny, 6)) break;
          }
          if (!this._inSolid(sx, ny, 6)) sy = ny;
          if (this._inSolid(sx, sy, 6)) {
            sx = owner.x;
            sy = owner.y - 5;
          }
        }
      } catch (e) {}
      const g = new Grenade(this, sx, sy, angle, type, owner);
      g._netReplica = owner !== this.player;
      this.grenades.add(g);
      if (!g._netReplica) {
        try { this.net.sendNaded(type, Math.round(sx), Math.round(sy), angle); } catch (e) {}
      }
    } catch (e) {}
  }

  // Точка внутри солида (для спавна гранат).
export function explodeGrenade(g, owner) {
    try {
      const gx = g.x, gy = g.y, gt = g.grenadeType;
      const replica = !!(g && g._netReplica);
      try { g.destroy(); } catch (e) {}
      // Взрыв виден сразу на месте гранаты (как _boomFx): раньше своя
      // вспыхивала только эхом от сервера, а чужая вообще без вспышки
      // исчезала — «гранаты пропадают на дистанции».
      try { this._boomFx(gx, gy); } catch (e) {}
      // Взрыв считает сервер по boom (урон всем придёт damage-сообщениями).
      if (!replica && owner === this.player) {
        try { this.net.sendBoom(Math.round(gx), Math.round(gy), gt); } catch (e) {}
      }
    } catch (e) {}
  }

export function emitSmoke(g) {
    try {
      const gx = g.x, gy = g.y;
      const replica = !!(g && g._netReplica);
      try { g.destroy(); } catch (e) {}
      this._smokeCloud(gx, gy);
      if (!replica) {
        try { this.net.sendSmoke(Math.round(gx), Math.round(gy)); } catch (e) {}
      }
    } catch (e) {}
  }

  // Дым как в одиночке: хлопок + 8 растущих клубов (~r135), живут 5с,
  // завеса скрывает чужих (см. _updateSmokeGhosts каждый кадр).
export function _smokeCloud(x, y) {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const cx = x, cy = y;
      const gy = cy - 22;
      try { this._sfxAt('sfx_boom_smoke', cx, cy, 0.45); } catch (e) {}
      try {
        const pop = this.add.circle(cx, gy, 90, 0xdddddd, 0.5).setDepth(8);
        pop.setScale(12 / 90);
        this.tweens.add({
          targets: pop, scaleX: 1, scaleY: 1, fillAlpha: 0, duration: 450,
          onComplete: () => pop.destroy()
        });
      } catch (e) {}
      const radius = 95;
      const clouds = [];
      for (let i = 0; i < 8; i++) {
        try {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * radius * 0.7;
          const tx = cx + Math.cos(a) * r;
          const ty = cy + Math.sin(a) * r - 10;
          const endR = 34 + Math.random() * 22;
          const puff = this.add.circle(cx, gy, endR, 0xcccccc, 0).setDepth(8);
          puff.setScale(8 / endR);
          clouds.push(puff);
          this.tweens.add({
            targets: puff, delay: i * 90,
            x: tx + Phaser.Math.Between(-24, 24), y: ty - 44,
            scaleX: 1, scaleY: 1, fillAlpha: 0.4, duration: 1100, ease: 'Cubic.Out'
          });
        } catch (e) {}
      }
      this.smokeClouds = this.smokeClouds || [];
      this.smokeClouds.push({ x: cx, y: cy, radius: radius + 40 });
      let ring = null;
      try {
        ring = this.add.graphics().setDepth(7);
        ring.lineStyle(2, 0xffffff, 0.14);
        ring.strokeCircle(cx, gy, radius + 40);
      } catch (e) { ring = null; }
      this.time.delayedCall(3800, () => {
        clouds.forEach(c => {
          if (!c || !c.active) return;
          try {
            this.tweens.add({
              targets: c, fillAlpha: 0, scaleX: '+=0.5', scaleY: '+=0.5', duration: 1200,
              onComplete: () => c.destroy()
            });
          } catch (e) { try { c.destroy(); } catch (e2) {} }
        });
        if (ring && ring.active) {
          try { this.tweens.add({ targets: ring, alpha: 0, duration: 1200 }); } catch (e) {}
        }
      });
      this.time.delayedCall(5000, () => {
        clouds.forEach(c => {
          try { if (c) this.tweens.killTweensOf(c); } catch (e) {}
          try { c.destroy(); } catch (e) {}
        });
        try { if (ring) this.tweens.killTweensOf(ring); } catch (e) {}
        try { if (ring) ring.destroy(); } catch (e) {}
        try {
          const idx = (this.smokeClouds || []).findIndex(s => s.x === cx && s.y === cy);
          if (idx >= 0) this.smokeClouds.splice(idx, 1);
        } catch (e) {}
      });
    } catch (e) {}
  }

export function _smokeAt(x, y) {
    try {
      const clouds = this.smokeClouds || [];
      for (let i = 0; i < clouds.length; i++) {
        const s = clouds[i];
        if (Math.hypot(x - s.x, y - s.y) <= s.radius) return s;
      }
    } catch (e) {}
    return null;
  }

export function _foeHiddenBySmoke(v, b) {
    try {
      const clouds = this.smokeClouds || [];
      if (!clouds.length || !v || !b) return false;
      const bx = b.x, by = b.y - 28;
      const vx = v.x, vy = v.y - 28;
      if (Math.hypot(bx - vx, by - vy) <= 75) return false;
      const cb = this._smokeAt(bx, by);
      if (cb && this._smokeAt(vx, vy) === cb) return false;
      for (let i = 0; i < clouds.length; i++) {
        const s = clouds[i];
        if (Math.hypot(bx - s.x, by - s.y) <= s.radius) return true;
      }
      for (let i = 0; i < clouds.length; i++) {
        const s = clouds[i];
        if (this._segCircle(vx, vy, bx, by, s.x, s.y, s.radius)) return true;
      }
    } catch (e) {}
    return false;
  }

  // Плавный гост (220мс) через alpha — не конфликтует с visible-флагами.
export function _setSmokeGhost(p, hide) {
    try {
      if (!p) return;
      const objs = (typeof p._smokeParts === 'function')
        ? p._smokeParts()
        : [p, p.nameText, p.gunImg, p.healthBar, p.armorBar, p._shadow].filter(o => o && o.active !== false);
      objs.forEach(o => { try { this.tweens.killTweensOf(o); } catch (e) {} });
      const a = hide ? 0 : 1;
      objs.forEach(o => {
        try {
          if (o.alpha !== a) this.tweens.add({ targets: o, alpha: a, duration: 220 });
        } catch (e) {
          try { o.alpha = a; } catch (e2) {}
        }
      });
    } catch (e) {}
  }

export function _updateSmokeGhosts() {
    try {
      if (!this.player || this.player.dead) return;
      this._puppets.forEach((rec) => {
        const f = rec.f;
        if (!f || !f.active || f.dead || rec.dead) return;
        // Своих видно всегда, чужих прячет дым.
        const hide = !this._isAlly(f) && this._foeHiddenBySmoke(this.player, f);
        if (!!f._smokeHidden !== hide) {
          f._smokeHidden = hide;
          this._setSmokeGhost(f, hide);
        }
      });
    } catch (e) {}
  }

  // Взрыв как в одиночке (GameScene.explodeGrenade визуал):
  // круг на весь радиус 195 + белая вспышка + тряска камеры.
export function _boomFx(x, y) {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const radius = 195;
      const boom = this.add.circle(x, y, radius, 0xffaa33, 1).setDepth(20);
      boom.setScale(12 / radius);
      this.tweens.add({
        targets: boom,
        scaleX: 1, scaleY: 1,
        fillAlpha: 0,
        duration: 300,
        onComplete: () => { try { boom.destroy(); } catch (e) {} }
      });
      const flash = this.add.circle(x, y, 26, 0xffffff, 0.9).setDepth(21);
      this.tweens.add({
        targets: flash, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: 350,
        onComplete: () => { try { flash.destroy(); } catch (e) {} }
      });
      try { this.cameras.main.shake(180, 0.008); } catch (e) {}
      try { this._sfxAt('sfx_boom', x, y, 0.55); } catch (e) {}
    } catch (e) {}
  }

  // Стиль трассера по стволу — один в один как в одиночке
  // (GameScene.spawnBullet): длина/цвет/толщина линии вместо спрайта пули.
  // Снайперы — длинные тонкие холодные, пулемёты — длинные тёплые,
  // пистолеты — короткие, винтовки — стандартные яркие, дробь — короткие.
export function _throwKit(type, x, y, team, netId) {
    try {
      const pk = this.spawnPickup(type, x, y, true);
      if (!pk) return null;
      pk._netId = netId;
      try { pk.setTeamRing(team); } catch (e) { pk.team = team; }
      return pk;
    } catch (e) {
      return null;
    }
  }

export function _findKit(netId) {
    try {
      const kids = this.pickups ? this.pickups.getChildren() : [];
      for (const k of kids) {
        if (k && k._netId === netId) return k;
      }
    } catch (e) {}
    return null;
  }

export function _onKit(m) {
    if (!m || !m.id) return;
    try {
      if (this._findKit(m.id)) return;
      this._throwKit(m.type, +m.x || 0, +m.y || 0, m.team || 'blue', m.id);
    } catch (e) {}
  }

export function _onKitOk(m) {
    if (!m || !m.id) return;
    try {
      const pk = this._findKit(m.id) || (m.from ? this._findKit(m.from) : null);
      if (!pk) {
        // Кит уже разобран локально (пропущен kitfix): молча не теряем —
        // если забрал я, тост как в одиночке не нужен, чужой — тоже тихо.
        return;
      }
      if (m.by === this.myId) {
        if (typeof pk.grantTake === 'function') pk.grantTake();
        else {
          try { this.pickups.remove(pk); } catch (e) {}
          try { pk.destroy(); } catch (e) {}
        }
      } else {
        // Чужой подбор слышно как в одиночке: тем же сэмплом по типу кита.
        try {
          const t = pk.pickupType;
          const key = t === 'medkit' ? 'sfx_pickup_medkit'
            : t === 'ammo' ? 'sfx_pickup_ammo'
            : t === 'armor' ? 'sfx_pickup_armor' : null;
          if (key) this._sfxAt(key, pk.x, pk.y, t === 'armor' ? 0.75 : 0.5);
        } catch (e) {}
        try { this.pickups.remove(pk); } catch (e) {}
        try { pk.destroy(); } catch (e) {}
      }
    } catch (e) {}
  }

  // Сервер переписал id моего кита (коллизия): переименовать локальный,
  // иначе kitok с новым id не сматчится и кит вечно висит у кидавшего.
export function _onKitFix(m) {
    if (!m || !m.from || !m.id) return;
    try {
      const pk = this._findKit(m.from);
      if (pk) pk._netId = m.id;
    } catch (e) {}
  }

  // --- Киллфид как в одиночке: правый верхний угол, «кто ✕ кого · ствол»,
  // цвет по команде убийцы, тает за 4 сек. Через addHudElement — зум не уносит.
  // Киллфид один в один как в одиночке: правый верхний угол,
  // «кто ✕ кого · ствол», цвет по команде убийцы (без убийцы — серый),
  // хедшот — рисованный значок слева от строки; тает за 4с, макс 6 строк.
