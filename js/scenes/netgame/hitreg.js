

import Assault from '../../entities/Assault.js?v=380';
import Tank from '../../entities/Tank.js?v=380';
import Medic from '../../entities/Medic.js?v=380';
import Sniper from '../../entities/Sniper.js?v=380';

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
export function _bulletHitsFighter(b, f) {
    try {
      if (!b || !f || !f.body) return null;
      const x0 = (b._px != null ? b._px : b.x), y0 = (b._py != null ? b._py : b.y);
      const x1 = b.x, y1 = b.y;
      // Живое тело физики (= нарисованная модель): центр и границы.
      const bx = f.body.x + f.body.width / 2;
      const top = f.body.y, bot = f.body.y + f.body.height;
      const hw = f.body.width / 2 + 3;
      const crouch = !!(f.crouching || (f.body && f.body.height < 50));
      // Голова — живой круг из рига (куклам доводит _followHeadPuppet).
      let headCx = bx, headCy = top - 8, headR = 8;
      try {
        if (f.head && Number.isFinite(f.head.x) && Number.isFinite(f.head.y)) {
          headCx = f.head.x; headCy = f.head.y;
        } else {
          headCy = f.y - (crouch ? 30 : 44);
        }
        headR = (f._geoHeadR || 8);
      } catch (e) {}
      headR += 3;
      let legLen = (f._legThigh || 12) + (f._legShin || 12) + (f._shoeH || 8);
      if (crouch) legLen *= 0.55;
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.min(8, Math.ceil(segLen / 8)));
      let bodyHit = false;
      for (let i = 0; i <= steps; i++) {
        const px = x0 + (x1 - x0) * (i / steps);
        const py = y0 + (y1 - y0) * (i / steps);
        // Голова первой (как отдельный оверлап в одиночке).
        if (Math.abs(px - headCx) <= headR && py >= headCy - headR && py <= headCy + headR) return 'head';
        if (Math.abs(px - bx) <= hw && py >= top && py <= bot) bodyHit = true;
      }
      if (!bodyHit) return null;
      // Зона по высоте нижней точки отрезка (как _hitZone по bullet.y).
      const lowY = Math.max(y0, y1);
      if (lowY >= bot - legLen) return 'legs';
      return 'body';
    } catch (e) {}
    return null;
  }
  // Стена на отрезке — зеркало серверного wallLos (те же прямоугольники
  // платформ): кровь и хит только по чистой линии от дула. Иначе сервер
  // всё равно срежет хит, а эффект в воздухе врёт. Дальше 1600 — без
  // проверки, как там.
export function _segBlocked(x1, y1, x2, y2) {
    try {
      if (![x1, y1, x2, y2].every(Number.isFinite)) return false;
      if (Math.hypot(x2 - x1, y2 - y1) > 1600) return false;
      const groups = [this.platforms, this.covers];
      for (const grp of groups) {
        if (!grp) continue;
        const kids = grp.getChildren();
        for (let i = 0; i < kids.length; i++) {
          const b = kids[i] && kids[i].body;
          if (!b || !b.enable) continue;
          const x0 = b.x, x1r = b.x + b.width;
          const y0 = b.y, y1r = b.y + b.height;
          if (x1 > x0 && x1 < x1r && y1 > y0 && y1 < y1r) return true;
          if (x2 > x0 && x2 < x1r && y2 > y0 && y2 < y1r) return true;
          let tmin = 0, tmax = 1;
          const dx = x2 - x1, dy = y2 - y1;
          const axes = [
            [-dx, x1 - x0], [dx, x1r - x1],
            [-dy, y1 - y0], [dy, y1r - y1]
          ];
          let ok = true;
          for (const [p, q] of axes) {
            if (Math.abs(p) < 1e-9) {
              if (q < 0) { ok = false; break; }
            } else {
              const t = q / p;
              if (p < 0) { if (t > tmax) { ok = false; break; } if (t > tmin) tmin = t; }
              else { if (t < tmin) { ok = false; break; } if (t < tmax) tmax = t; }
            }
          }
          if (ok) return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // Показать/спрятать бойца ЦЕЛИКОМ: тело + все части рига + плашки.
  // Иначе смерть прячет только базу: значок класса, голова и ноги
  // остаются висеть (трупы-имена на спавнах). Состояние запоминаем,
  // чтобы показ не включал то, что было скрыто изначально (GEO-голова
  // при арт-скине и т.п.).
  // Дробь одним хитом (см. выше): сумма за 120мс по цели, зона —
  // голова если была, иначе ноги (если только они), иначе тело.
export function _sendHitBatched(targetId, dmg, wn, zone) {
    try {
      this._pelletGroups = this._pelletGroups || {};
      let g = this._pelletGroups[targetId];
      if (!g) {
        g = this._pelletGroups[targetId] = { dmg: 0, wn, head: 0, legs: 0, body: 0, t: false };
      }
      g.dmg += Math.max(1, dmg | 0); g.wn = wn;
      if (zone === 'head') g.head++;
      else if (zone === 'legs') g.legs++;
      else g.body++;
      if (!g.t) {
        g.t = true;
        try {
          this.time.delayedCall(120, () => {
            try {
              const gg = (this._pelletGroups || {})[targetId];
              if (gg) {
                delete this._pelletGroups[targetId];
                const z = gg.head > 0 ? 'head' : (gg.legs > 0 && gg.body === 0 ? 'legs' : 'body');
                this.net.sendHit(targetId, Math.min(150, gg.dmg | 0) || 10, gg.wn || '', z,
                  (this.player && this.player.headshotMult) || 1);
              }
            } catch (e) {}
          });
        } catch (e) { g.t = false; }
      }
    } catch (e) {}
  }

  // Хук из Player._meleeSwing (только сетевая сцена его задаёт):
  // взмах по кукле — серверу отдельным melee (дистанция/стена/темп — там).
  // Локальный урон кукле движок уже нанёс — серверный его перезапишет.
export function onMeleeHit(attacker, victimEnt, dmg) {
    try {
      if (!attacker || attacker !== this.player || this._dead) return;
      if (!victimEnt || victimEnt.dead) return;
      let vid = null;
      for (const [id, rec] of this._puppets) {
        if (rec && rec.f === victimEnt) { vid = id; break; }
      }
      if (vid == null) return;
      const wn = (this.player && this.player.weapon && this.player.weapon.name) || '';
      this.net.sendMelee(vid, (dmg | 0) || 10, wn);
    } catch (e) {}
  }

export function _setFighterVisible(f, v) {
    if (!f) return;
    try { f.setVisible(v); } catch (e) {}
    try {
      const parts = [];
      try { (f._allParts || []).forEach(o => { if (o) parts.push(o); }); } catch (e) {}
      ['nameText', 'healthBar', 'armorBar', 'nameBadge', 'gunImg', 'gun',
        'head', 'neck', 'headImg', 'capImg', '_shadow', 'aura', '_ultRing', '_ammoMark'].forEach(k => {
        try { if (f[k]) parts.push(f[k]); } catch (e) {}
      });
      try { (f._geoFace || []).forEach(o => { if (o) parts.push(o); }); } catch (e) {}
      ['_eyeWB', '_eyeWF', '_eyePB', '_eyePF', '_browF', '_browB', '_ear', '_nose', '_mouth'].forEach(k => {
        try { if (f[k]) parts.push(f[k]); } catch (e) {}
      });
      parts.forEach(o => {
        try {
          if (!v) {
            if (o.__wasVis === undefined) o.__wasVis = !!o.visible;
            o.setVisible(false);
          } else if (o.__wasVis !== false) {
            o.setVisible(true);
          }
        } catch (e) {}
      });
      if (v) {
        try { if (f.healthBar) f.healthBar.setVisible(this._wantBars(f)); } catch (e) {}
        try { if (f.armorBar) f.armorBar.setVisible(this._wantBars(f)); } catch (e) {}
        try { if (f.nameText && !f.nameText.visible && f.__wasVis !== false) f.nameText.setVisible(true); } catch (e) {}
      }
    } catch (e) {}
    try {
      if (f.body) {
        if (v) f.body.enable = true;
        else {
          f.body.enable = false;
          try { f.setVelocity(0, 0); } catch (e2) {}
        }
      }
    } catch (e) {}
  }

  // Реестр состава матча: id -> { team, name, cls, bot }.
  // started/rejoin — источник правды; добиваем из лобби-ростера и счёта.
export function _inSolid(tx, ty, r) {
    try {
      const rr = r == null ? 10 : r;
      const groups = [this.platforms];
      for (const grp of groups) {
        if (!grp) continue;
        for (const o of grp.getChildren()) {
          const b = o.body;
          if (!b || !b.enable) continue;
          const hw = b.width / 2, hh = b.height / 2;
          if (Math.abs(tx - (b.x + hw)) < hw + rr && Math.abs(ty - (b.y + hh)) < hh + rr) return true;
        }
      }
    } catch (e) {}
    return false;
  }

export function _segCircle(x1, y1, x2, y2, cx, cy, r) {
    try {
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(x1 + dx * t - cx, y1 + dy * t - cy) <= r;
    } catch (e) {}
    return false;
  }

  // Чужак скрыт дымом: в облаке, или луч взгляда сквозь облако.
  // В упор (75) и в одном облаке со мной — виден.
