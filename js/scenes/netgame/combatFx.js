

import { weaponsList } from '../../data/weapons.js?v=170';

import * as SoundSys from '../../combat/soundSys.js?v=174';
import * as Fx from '../../combat/fx.js?v=320';

import Assault from '../../entities/Assault.js?v=380';
import Tank from '../../entities/Tank.js?v=380';
import Medic from '../../entities/Medic.js?v=380';
import Sniper from '../../entities/Sniper.js?v=380';
import Bullet from '../../entities/Bullet.js?v=169';
import Grenade from '../../entities/Grenade.js?v=172';
import Pickup from '../../entities/Pickup.js?v=177';

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
export function _tracerStyle(w, owner) {
    try {
      w = w || {};
      const pellets = w.pellets || 1;
      // Свой/чужой: свои чуть синее, чужие чуть краснее (как в одиночке).
      const ally = Fx.isAllyShot(this, owner);
      const tc = (c) => Fx.tintTracer(c, ally);
      if (w.name === 'RPG') return { len: 20, color: tc(0xffcc66), w: 3 };
      if (pellets > 1) return { len: 10, color: tc(0xccbb88), w: 2 };
      if ((w.range || 0) >= 1000) return { len: 34, color: tc(0xd8f4ff), w: 2 };
      if (w.name === 'minigun' || w.name === 'M249') return { len: 22, color: tc(0xffd28a), w: 2 };
      if (w.category === 'secondary') return { len: 16, color: tc(0xffe9a8), w: 2 };
      return { len: 26, color: tc(0xfff2aa), w: 2 };
    } catch (e) {}
    return { len: 26, color: 0xfff2aa, w: 2 };
  }

  // Линии трассеров одним Graphics за кадр — как drawTracers в одиночке
  // (depth 3.9, альфа 0.9). Сами спрайты пуль скрыты (кроме ракеты).
  // Плюс запасные линии _tracerShots (пуля-объект не завёлся — выстрел
  // всё равно виден 150мс, а не немой).
export function drawTracers() {
    try {
      Fx.drawTracers(this);
      // Онлайн-добавка: линии чужих выстрелов без тела пули (fallback 150мс).
      try {
        const g = this.tracerGfx;
        if (!g) return;
        const nowT = (this.time ? this.time.now : Date.now());
        this._tracerShots = (this._tracerShots || []).filter(s => s && s.until > nowT);
        for (const s of this._tracerShots) {
          const t = s.style || {};
          g.lineStyle(t.w || 2, t.color || 0xfff2aa, 0.9);
          g.lineBetween(s.x, s.y, s.x - Math.cos(s.ang || 0) * (t.len || 26), s.y - Math.sin(s.ang || 0) * (t.len || 26));
        }
      } catch (e) {}
    } catch (e) {}
  }

  // Чужая пуля: физика + картинка. Не завелась — хоть линию на 150мс,
  // иначе чужой выстрел немой (был репорт «пуль не видно»).
export function _spawnForeign(ox, oy, ang, owner, range, style, isRocket) {
    let b = null;
    try {
      b = new Bullet(this, ox, oy, ang, 0, owner, range);
      if (isRocket && this.textures.exists('bullet_RPG')) {
        b.setTexture('bullet_RPG');
        b.setScale(1.4);
      } else if (!isRocket) {
        try { b.setVisible(false); } catch (e) {}
      }
      try { b._tracer = style || null; } catch (e) {}
      b.isRocket = !!isRocket;
      try { b._foreign = true; b._ownerF = owner || null; (this._foreignBullets = this._foreignBullets || []).push(b); } catch (e) {}
      try {
        this.physics.add.collider(b, this.platforms, () => { try { b.destroy(); } catch (e) {} });
      } catch (e) {}
      try {
        if (this.covers) this.physics.add.collider(b, this.covers, () => { try { b.destroy(); } catch (e) {} });
      } catch (e) {}
    } catch (e) { b = null; }
    if (!b) {
      try {
        (this._tracerShots = this._tracerShots || []).push({
          x: ox, y: oy, ang, style: style || { len: 26, color: Fx.tintTracer(0xfff2aa, Fx.isAllyShot(this, owner)), w: 2 },
          until: (this.time ? this.time.now : Date.now()) + 150
        });
      } catch (e) {}
    }
    return b;
  }

export function _onFire(m) {
    if (!m) return;
    try {
      const bx = +m.x || 0, by = +m.y || 0, ang = +m.angle || 0;
      // Очередь: первый выстрел сразу, остальные пачкой по 90мс
      // (темп SIG SG) — соседи видят все пули, а не одну.
      const n = Math.max(1, Math.min(5, parseInt(m.n, 10) || 1));
      const rec = this._puppets.get(m.id);
      const owner = (rec && rec.f) || null;
      const tx = Number.isFinite(+m.tx) ? +m.tx : null;
      const ty = Number.isFinite(+m.ty) ? +m.ty : null;
      for (let i = 0; i < n; i++) {
        if (i === 0) {
          try { this._fireOnce(m.weapon, owner, bx, by, ang, tx, ty); } catch (e) {}
        } else {
          try {
            this.time.delayedCall(i * 90, () => {
              try { this._fireOnce(m.weapon, owner, bx, by, ang, tx, ty); } catch (e) {}
            });
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // Один видимый выстрел соседа: звук + вспышка + гильза + трассер
  // (урона нет — считает сервер). Точка вылета — дуло владельца, как
  // в одиночке (muzzleWorld), а не центр тела: у людей дуло шлёт стрелок,
  // у ботов сервер шлёт центр — дуло считаем сами по кукле.
  // Направление — в серверную точку прицеливания (tx,ty): угол из чужого
  // дула давал параллельный сдвиг и линия летела мимо головы.
  // Звук ботов — по классу (BOT-Assault→AK-47, Tank→M249, Medic→UZI, Sniper→Winchester).
export function _fireOnce(weapon, owner, bx, by, ang, tx, ty) {
    try {
      const wStr = String(weapon || '');
      const isBot = wStr.startsWith('BOT');
      const BOT_SFX = { 'BOT-Assault': 'AK-47', 'BOT-Tank': 'M249', 'BOT-Medic': 'UZI', 'BOT-Sniper': 'Winchester', BOT: 'AK-47' };
      const BOT_RANGE = { 'BOT-Assault': 650, 'BOT-Tank': 720, 'BOT-Medic': 500, 'BOT-Sniper': 950, BOT: 520 };
      // Точка вылета: у ботов — дуло куклы, у людей — присланное дуло.
      // Направление: в серверную точку прицеливания из СВОЕГО дула
      // (угол сервера из чужого дула даёт параллельный сдвиг).
      let ox = bx, oy = by, a2 = ang;
      if (isBot) {
        try {
          if (owner && typeof owner.muzzleWorld === 'function') {
            const mz = owner.muzzleWorld(ang);
            if (mz && Number.isFinite(mz.x) && Number.isFinite(mz.y)) { ox = mz.x; oy = mz.y; }
          }
        } catch (e) {}
        try {
          if (Number.isFinite(tx) && Number.isFinite(ty)) a2 = Math.atan2(ty - oy, tx - ox);
        } catch (e) {}
      }
      this.sfxShot(isBot ? (BOT_SFX[wStr] || 'AK-47') : weapon, -1, ox, oy);
      this.spawnMuzzle(ox, oy, a2);
      try { this.spawnShell(ox, oy, Math.cos(a2) >= 0 ? 1 : -1); } catch (e) {}
      try {
        if (isBot) {
          const bw = { name: BOT_SFX[wStr] || 'AK-47', pellets: 1, range: BOT_RANGE[wStr] || 520, category: 'primary' };
          // Пулю не видно — только трассер по классу (как в одиночке).
          this._spawnForeign(ox, oy, a2, owner, bw.range, this._tracerStyle(bw, owner), false);
          return;
        }
        const wd = (weaponsList || []).find(w => w && w.name === weapon) || null;
        if (wd && wd.category !== 'melee') {
          let range = wd.range || 700;
          try {
            if (owner && owner.weapon && owner.weapon.name === weapon && owner.weapon.range) {
              range = owner.weapon.range;
            }
          } catch (e) {}
          // Визуал трассера ВМЕСТО спрайта пули (ракета — спрайтом).
          const isRocket = wd.name === 'RPG';
          this._spawnForeign(ox, oy, a2, owner, range,
            isRocket ? { len: 20, color: Fx.tintTracer(0xffcc66, Fx.isAllyShot(this, owner)), w: 3 } : this._tracerStyle(wd, owner), isRocket);
        }
      } catch (e) {}
    } catch (e) {}
  }

export function _onNaded(m) {
    if (!m) return;
    try {
      let owner = null;
      this._puppets.forEach((rec, id) => {
        if (id === m.id && rec && rec.f) owner = rec.f;
      });
      const g = new Grenade(this, +m.x || 0, +m.y || 0, +m.angle || 0, m.type === 'smoke' ? 'smoke' : 'frag', owner);
      g._netReplica = true;
      this.grenades.add(g);
      try { this._sfxAt('sfx_throw', +m.x || 0, +m.y || 0, 0.6); } catch (e) {}
    } catch (e) {}
  }

export function _onBoom(m) {
    if (!m) return;
    try {
      // Дымовой boom (старый сервер слал вспышку и на дым) — рисуем дымом.
      if (m.type === 'smoke') this._smokeCloud(+m.x || 0, +m.y || 0);
      else this._boomFx(+m.x || 0, +m.y || 0);
    } catch (e) {}
  }

export function _onSmoke(m) {
    if (!m) return;
    try {
      this._smokeCloud(+m.x || 0, +m.y || 0);
    } catch (e) {}
  }

  // Пыль приземления как в одиночке (GameScene.spawnImpact):
  // _updateParts кукол зовёт её на жёстких посадках.
export function spawnImpact(x, y, color, n) {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      Fx.spawnImpact(this, x, y, color == null ? 0xffffff : color, n);
    } catch (e) {}
  }

  // Кровь попадания как в одиночке (GameScene.spawnImpact, красные 3px).
export function _bloodFx(x, y, n) {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const count = Math.max(1, Math.min(8, n || 4));
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 8 + Math.random() * 18;
        const p = this.add.rectangle(x, y, 3, 3, 0xff3333, 1).setDepth(19);
        this.tweens.add({
          targets: p,
          x: x + Math.cos(a) * d,
          y: y + Math.sin(a) * d,
          alpha: 0,
          duration: 220 + Math.random() * 120,
          onComplete: () => { try { p.destroy(); } catch (e) {} }
        });
      }
    } catch (e) {}
  }

  // Эффект смерти как в одиночке (Player.die: вспышка + кольцо/осколки + кровь).
  // Зона — с сервера (head — золотой веер вместо кольца).
export function _killFx(x, y, zone) {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const dx = x, dy = y - 30;
      const zn = zone === 'head' ? 'head' : (zone === 'legs' ? 'legs' : 'body');
      const flashCol = zn === 'head' ? 0xffe27a : 0xffffff;
      const flash = this.add.circle(dx, dy, zn === 'head' ? 30 : 26, flashCol, zn === 'head' ? 0.95 : 0.9).setDepth(30);
      this.tweens.add({
        targets: flash, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: zn === 'head' ? 400 : 350,
        onComplete: () => { try { flash.destroy(); } catch (e) {} }
      });
      if (zn === 'head') {
        for (let i = 0; i < 9; i++) {
          try {
            const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
            const cols = [0xff2222, 0xff2222, 0xffd24a, 0xffffff];
            const sh = this.add.rectangle(dx, dy - 20, 3 + Math.random() * 5, 2 + Math.random() * 3,
              cols[i % cols.length], 1).setDepth(30);
            this.tweens.add({
              targets: sh,
              x: dx + Math.cos(a) * (50 + Math.random() * 60),
              y: dy - 20 + Math.sin(a) * (45 + Math.random() * 55),
              rotation: (Math.random() * 2 - 1) * 6,
              alpha: 0, duration: 600 + Math.random() * 300,
              onComplete: () => { try { sh.destroy(); } catch (e) {} }
            });
          } catch (e) {}
        }
      } else {
        try {
          const ring = this.add.circle(dx, dy, 10, 0xff4444, 0).setDepth(30);
          try { ring.setStrokeStyle(4, 0xff4444, 0.9); } catch (e) {}
          this.tweens.add({
            targets: ring, scaleX: 4.2, scaleY: 4.2, alpha: 0, duration: 650,
            onComplete: () => { try { ring.destroy(); } catch (e) {} }
          });
        } catch (e) {}
      }
      const dots = zn === 'legs' ? 3 : 6;
      for (let i = 0; i < dots; i++) {
        try {
          const a = Math.random() * Math.PI * 2;
          const dot = this.add.circle(dx, dy, 3, i % 2 ? 0xff6666 : 0xffffff, 1).setDepth(30);
          this.tweens.add({
            targets: dot,
            x: dx + Math.cos(a) * (30 + Math.random() * 40),
            y: dy + Math.sin(a) * (20 + Math.random() * 30) - 20,
            alpha: 0, duration: 500 + Math.random() * 250,
            onComplete: () => { try { dot.destroy(); } catch (e) {} }
          });
        } catch (e) {}
      }
    } catch (e) {}
  }

  // Громкость любого позиционного звука по той же кривой, что в одиночке:
  // не видно — 10%, край видимости — 15%, рядом — 100%.
export function _sfxVolAt(sx, sy, base) {
    return SoundSys.sfxVolAt(this, sx, sy, base);
  }

  // Позиционный звук по ключу (взрывы, бросок, подбор). Нет файла — тишина.
export function _sfxAt(key, sx, sy, base) {
    return SoundSys.sfxAt(this, key, sx, sy, base);
  }

  // --- Киты способностей (фаза 3г): свои кидаем, чужие видим ---
  // quiet=true — эхо с сервера (уже есть у всех, не рассылаем).
export function spawnPickup(type, x, y, quiet) {
    try {
      const pk = new Pickup(this, x, y, type);
      this.pickups.add(pk);
      try {
        const col = this.physics.add.collider(pk, this.platforms);
        pk._col = col;
      } catch (e) {}
      pk.onWantTake = (pp) => {
        try { this.net.sendKitWant(pp._netId); } catch (e) {}
      };
      pk._netId = `${this.myId}:${(this._kitN = (this._kitN | 0) + 1)}`;
      if (!quiet) {
        try {
          this.net.sendKit(pk._netId, type, Math.round(x), Math.round(y));
        } catch (e) {}
      }
      return pk;
    } catch (e) {
      return null;
    }
  }

export function spawnMuzzle(x, y, angle) {
    try { Fx.spawnMuzzle(this, x, y, Number.isFinite(angle) ? angle : 0); } catch (e) {}
  }

  // Вылет гильзы как в одиночке (зовёт и свой Player, и чужой огонь).
export function spawnShell(x, y, dir) {
    try { Fx.spawnShell(this, x, y, dir); } catch (e) {}
  }

  // Выстрел как в одиночке: звук shot_<Имя>, громкость по дистанции.
export function sfxShot(name, magLeft, sx, sy) {
    return SoundSys.sfxShot(this, name, magLeft, sx, sy, weaponsList);
  }

export function spawnBullet(owner, angle, damage, range, x, y, visual) {
    try {
      const b = new Bullet(this, x, y, angle, damage, owner, range || 700);
      // Старт для проверки стены по траектории (как _sx/_sy в одиночке).
      try { b._sx = x; b._sy = y; } catch (e) {}
      // Визуал трассера ВМЕСТО спрайта пули — как в одиночке (кроме ракеты).
      // visual === false: дробинка без отрисовки (только урон).
      try {
        const w = (owner && owner.weapon) || {};
        const isRocket = w.name === 'RPG';
        if (isRocket && this.textures.exists('bullet_RPG')) {
          b.setTexture('bullet_RPG');
          b.setScale(1.4);
        } else if (!isRocket) {
          // Пулю не видно — только трассер (физика и урон как были).
          b.setVisible(false);
        }
        b._tracer = visual === false ? null : (isRocket
          ? { len: 20, color: Fx.tintTracer(0xffcc66, Fx.isAllyShot(this, owner)), w: 3 }
          : this._tracerStyle(w, owner));
        b.isRocket = isRocket;
      } catch (e) {}
      this.physics.add.collider(b, this.platforms, () => {
        try { b.destroy(); } catch (e) {}
      });
      // Чужие укрытия тоже режут свои пули (паритет с GameScene:
      // platforms+covers, иначе свои пули летят сквозь ящики).
      try {
        if (this.covers) this.physics.add.collider(b, this.covers, () => { try { b.destroy(); } catch (e) {} });
      } catch (e) {}
      // Только свои пули бьют марионеток (урон — фаза 3б, сервер решает).
      if (owner === this.player) {
        try { b._wn = (owner.weapon && owner.weapon.name) || ''; } catch (e) {}
        this._bullets.push(b);
      }
      return b;
    } catch (e) {
      return null;
    }
  }
