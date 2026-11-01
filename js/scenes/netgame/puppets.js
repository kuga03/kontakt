

import { weaponsList } from '../../data/weapons.js?v=170';

import * as CameraRig from '../../world/cameraRig.js?v=170';

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
export function _upsertPuppet(p) {
    if (!p || p.id == null || p.id === this.myId) return;
    // Уже есть — обновить (команда/ник на месте, класс/скин через пересоздание),
    // а не молча выйти: иначе смена команды видна только новым куклам.
    if (this._puppets.has(p.id)) {
      try { this._refreshPuppet(p.id, p); } catch (e) {}
      return;
    }
    try { this._rememberMatchPlayers([p]); } catch (e) {}
    const Cls = CLASSES[p.cls] && CLASSES[p.cls] ? CLASSES[p.cls] : Assault;
    const sx0 = (p.spawn && Number.isFinite(p.spawn.x)) ? p.spawn.x : 1200;
    const sy0 = (p.spawn && Number.isFinite(p.spawn.y)) ? p.spawn.y : 800;
    // Кукла не должна рождаться вмурованной (см. _safeSpawn),
    // затем посадка на опору — старт стоя (см. _restSpawn).
    const ssp = this._safeSpawn(sx0, sy0);
    const rs = this._restSpawn(ssp.x, ssp.y);
    const sx = rs.x, sy = rs.y;
    const team = this._teamOf(p, null);
    const pGear = (this._matchInfo(p.id) || {}).gear || null;
    try { console.info('[NET] puppet gear in:', p.name, p.cls, JSON.stringify(pGear)); } catch (e) {}
    let f = null;
    try {
      f = new Cls(this, sx, sy, {
        name: String((this._matchInfo(p.id) || {}).name || p.name || 'Игрок').slice(0, 16),
        team,
        isAI: true,
        gear: pGear
      });
    } catch (e) {
      return;
    }
    // Кукла — чужой билд нам неизвестен: сбрасываем СВОИ скиллы/гены/сеты
    // до базы класса, иначе конструктор applyPassives раздует ей maxHp/maxArmor
    // моей прокачкой, а сервер шлёт ХП по базе — полоски вечно неполные.
    // База как в entities и на сервере (CLASS_HP/CLASS_ARMOR).
    try {
      const _base = { Assault: [100, 40], Tank: [150, 100], Medic: [90, 30], Sniper: [80, 20] };
      const _bc = _base[(p.cls in _base) ? p.cls : 'Assault'];
      f.maxHp = _bc[0];
      f.maxArmor = _bc[1];
      if (f.hp > f.maxHp) f.hp = f.maxHp;
      if (f.armor > f.maxArmor) f.armor = f.maxArmor;
    } catch (e) {}
    f.setTint(f.team === 'blue' ? 0x44ccff : 0xff5555);
    // В FFA все чужие — красные (команд нет, каждый сам за себя).
    if (this._ffa) {
      try { f.setTint(0xff5555); } catch (e) {}
    }
    // Без ИИ: марионеткой движут снапшоты. Гравитация живая.
    try {
      if (f.body) {
        f.body.setAllowGravity(true);
        f.body.setImmovable(false);
      }
    } catch (e) {}
    try { f.setVelocity(0, 0); } catch (e) {}
    this.physics.add.collider(f, this.platforms);
    this._puppets.set(p.id, { f, tx: sx, ty: sy, aimX: sx + 100, aimY: sy, lastGun: null, cls: (p.cls || (this._matchInfo(p.id) || {}).cls || 'Assault'), gear: pGear });
    try { this._paintName(f); } catch (e) {}
    try { this._fixOverhead(f); } catch (e) {}
  }

  // Кукла уже есть, пришли новые данные (ростер/started/rejoin):
  // команду и ник правим на месте, смену класса или скина — пересозданием
  // (скин задаётся только в конструкторе Player).
export function _refreshPuppet(id, p) {
    const rec = this._puppets.get(id);
    if (!rec || !rec.f) return;
    try { this._rememberMatchPlayers([p]); } catch (e) {}
    const info = this._matchInfo(id) || {};
    const wantCls = (p && p.cls) || info.cls || rec.cls || 'Assault';
    const wantGear = info.gear || null;
    let gearSame = false;
    try { gearSame = JSON.stringify(wantGear) === JSON.stringify(rec.gear || null); } catch (e) {}
    if (wantCls !== rec.cls || !gearSame) {
      // Пересоздать с новыми классом/скином (позицию держим текущую).
      let cx = rec.tx, cy = rec.ty;
      try { if (rec.f && rec.f.x != null) { cx = rec.f.x; cy = rec.f.y; } } catch (e) {}
      try { this._removePuppet(id); } catch (e) {}
      try {
        this._upsertPuppet({
          id, name: info.name || (p && p.name) || 'Игрок',
          cls: wantCls, team: info.team || (p && p.team) || null,
          spawn: { x: cx, y: cy }
        });
        const rec2 = this._puppets.get(id);
        if (rec2) { rec2.tx = cx; rec2.ty = cy; }
      } catch (e) {}
      return;
    }
    const wantTeam = info.team || (p && p.team) || null;
    if (wantTeam && rec.f.team !== wantTeam) {
      try { rec.f.team = wantTeam; } catch (e) {}
      try { rec.f.setTint(wantTeam === 'blue' ? 0x44ccff : 0xff5555); } catch (e) {}
      if (this._ffa) {
        try { rec.f.setTint(0xff5555); } catch (e) {}
      }
    }
    const wantName = String(info.name || (p && p.name) || 'Игрок').slice(0, 16);
    if (rec.f.playerName !== wantName) {
      try { rec.f.playerName = wantName; } catch (e) {}
    }
    try { this._paintName(rec.f); } catch (e) {}
    try { this._fixOverhead(rec.f); } catch (e) {}
  }

export function _removePuppet(id) {
    const rec = this._puppets.get(id);
    if (!rec) return;
    try { rec.f.destroy(); } catch (e) {}
    this._puppets.delete(id);
  }

export function _syncRoster() {
    // Состав из лобби/сервера: добрать новых, убрать ушедших.
    // Ботов (id<0) не трогаем — их состав ведёт сервер через снапы.
    // Имена запоминаем, команды матча не затираем (в бою ростер протухший).
    try { this._rememberMatchPlayers(this.net.players); } catch (e) {}
    try {
      (this.net.players || []).forEach(p => {
        if (p.id !== this.myId) this._upsertPuppet(p);
      });
      for (const id of [...this._puppets.keys()]) {
        // Ботов mid-match не трогаем (их состав ведёт сервер через снапы),
        // но после конца матча чистим и их — иначе висят прошлые.
        if (id < 0 && !this._matchOver) continue;
        if (!(this.net.players || []).some(p => p.id === id)) this._removePuppet(id);
      }
      // Живой список бойцов для подборов/гранат.
      this.players = [this.player];
      this._puppets.forEach(rec => {
        if (rec && rec.f) this.players.push(rec.f);
      });
    } catch (e) {}
    try {
      const ping = this.net.lastPingMs != null ? `${this.net.lastPingMs}мс` : '—';
      if (this._pingText) this._pingText.setText(ping);
    } catch (e) {}
  }

export function _onSnap(m) {
    if (!m || m.id == null || m.id === this.myId) return;
    let rec = this._puppets.get(m.id);
    if (!rec) {
      const known = this._matchInfo(m.id);
      this._upsertPuppet({ id: m.id, name: (known || {}).name || 'Игрок', cls: m.cls || (known || {}).cls || 'Assault', team: (known || {}).team || 'red' });
      rec = this._puppets.get(m.id);
      if (!rec) return;
    }
    rec.tx = +m.x || 0;
    rec.ty = +m.y || 0;
    rec.vx = Number.isFinite(+m.vx) ? +m.vx : 0;
    rec.vy = Number.isFinite(+m.vy) ? +m.vy : 0;
    try { rec._snapAt = this.time.now; } catch (e) { rec._snapAt = 0; }
    rec.aimX = Number.isFinite(+m.aimX) ? +m.aimX : rec.tx + 100;
    rec.aimY = Number.isFinite(+m.aimY) ? +m.aimY : rec.ty;
    try {
      if (Number.isFinite(+m.hp) && rec.f) rec.f.hp = Math.max(0, +m.hp);
      if (Number.isFinite(+m.armor) && rec.f) rec.f.armor = Math.max(0, +m.armor);
    } catch (e) {}
    try {
      if (m.crouch != null && rec.f && typeof rec.f.setCrouch === 'function') {
        rec.f.setCrouch(!!m.crouch);
      }
    } catch (e) {}
    // Ствол сменился — показать его (один раз, без спама).
    // 'BOT' и прочий мусор из снапов бота — не ствол: игнорим, иначе
    // addWeapon по неизвестному имени сдвигает activeWeaponIndex на нож.
    try {
      const wn = String(m.weapon || '');
      if (wn && wn !== rec.lastGun) {
        rec.lastGun = wn;
        const known = (weaponsList || []).some(w => w && w.name === wn);
        if (known && rec.f && typeof rec.f.addWeapon === 'function') {
          rec.f.addWeapon(wn);
          try {
            rec.f.activeWeaponIndex = rec.f.inventory.length - 1;
            rec.f._lastGunName = null;
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // Попадание своей пули в бойца: бокс всего тела (макушка ~y-54,
  // ступни ~y+28, ширина ±22) + радиус пули. Проверяем не точку, а весь
  // отрезок пути за кадр с шагом 8px — иначе скоростная пуля туннелит
  // сквозь ноги между кадрами.
  // Возврат: 'head'/'body'/'legs' как в одиночке (GameScene._hitZone +
  // head-оверлап: голова — круг y-44 r~8; ноги — низ тела по длине ног),
  // null — мимо. В приседе голова ниже, ноги короче (x0.55).
  // Попадание своей пули в бойца — ящик ЖИВОГО тела (не константы от f.y!):
  // f.y сидит на 20-70px выше ступней (зависит от k рига), а константы
  // top=y-54/bot=y+28 отрывались от нарисованной модели: пуля над головой
  // считалась, кровь рисовалась в воздухе. Голова — живой круг из рига
  // (как head-оверлап в одиночке). Проверяем отрезок пути за кадр с шагом
  // 8px — скоростная пуля иначе туннелит сквозь ноги между кадрами.
  // Возврат: 'head'/'body'/'legs' как в одиночке, null — мимо.
  // В приседе тело ниже и короче — берётся из живого тела само.
export function _rememberMatchPlayers(list) {
    try {
      (list || []).forEach(p => {
        if (!p || p.id == null) return;
        const prev = this._matchTeams.get(p.id) || {};
        this._matchTeams.set(p.id, {
          team: (p.team === 'red' ? 'red' : (p.team === 'blue' ? 'blue' : (prev.team || null))),
          name: (p.name != null ? String(p.name).slice(0, 16) : prev.name) || 'Игрок',
          cls: p.cls || prev.cls || null,
          bot: !!(p.bot || prev.bot),
          gear: (p.gear && typeof p.gear === 'object') ? p.gear : (prev.gear || null)
        });
      });
    } catch (e) {}
  }

export function _matchInfo(id) {
    try { return this._matchTeams.get(id) || null; } catch (e) { return null; }
  }

  // Команда бойца: реестр матча -> поле снапшота -> живая марионетка -> синие.
export function _teamOf(p, fb) {
    try {
      if (p && p.id != null) {
        const rec = this._matchTeams.get(p.id);
        if (rec && (rec.team === 'red' || rec.team === 'blue')) return rec.team;
      }
      if (p && (p.team === 'red' || p.team === 'blue')) return p.team;
      if (fb && (fb === 'red' || fb === 'blue')) return fb;
    } catch (e) {}
    return 'blue';
  }

  // Ник цветом команды (как в одиночке): свой — жёлтый, союзник — синий,
  // враг — красный. В FFA все чужие — красные.
export function _paintName(p) {
    try {
      if (!p || !p.nameText) return;
      let c = '#ffffff';
      if (p === this.player) c = '#ffe066';
      else if (this._ffa) c = '#ff8888';
      else if (p.team === this.myTeam) c = '#7db8ff';
      else c = '#ff8888';
      p.nameText.setColor(c);
    } catch (e) {}
  }

  // Союзник ли боец относительно меня (для полосок над головой).
export function _isAlly(f) {
    try {
      if (!f || f === this.player) return true;
      if (this._ffa) return false;
      return (f.team || 'blue') === (this.myTeam || 'blue');
    } catch (e) {}
    return false;
  }

  // Полоски над головой — ТОЛЬКО союзникам (как в одиночке: свои бары
  // внизу в HUD, у врагов полосок нет). В FFA — никому, все враги.
  // Player.updateBars внутри ставит showBars по своей формуле
  // (isAI && team blue) — после него правим видимость под сеть.
export function _wantBars(f) {
    try {
      if (!f || f.dead) return false;
      if (f === this.player) return false;
      if (this._ffa) return false;
      return this._isAlly(f);
    } catch (e) {}
    return false;
  }

export function _fixOverhead(f) {
    try {
      if (!f || !f.active) return;
      // Скрытый (труп до респауна): ник и бары не возвращаем — иначе
      // секундный ростер (_syncRoster → _refreshPuppet → сюда) зажигает
      // ник над пустым местом смерти. Показ — только через _setFighterVisible.
      if (!f.visible) {
        try { if (f.nameText && f.nameText.visible) f.nameText.setVisible(false); } catch (e) {}
        try { if (f.healthBar && f.healthBar.visible) f.healthBar.setVisible(false); } catch (e) {}
        try { if (f.armorBar && f.armorBar.visible) f.armorBar.setVisible(false); } catch (e) {}
        return;
      }
      const want = this._wantBars(f);
      if (f.healthBar && f.healthBar.visible !== want) f.healthBar.setVisible(want);
      if (f.armorBar && f.armorBar.visible !== want) f.armorBar.setVisible(want);
      if (f.nameText && !f.nameText.visible) f.nameText.setVisible(true);
    } catch (e) {}
  }

export function getDesiredZoom(range) {
    return CameraRig.getDesiredZoom(range || 700);
  }

  // Мир под курсором — пересчётом каждый раз (как в одиночке через
  // getWorldPoint): pointer.worldX протухает, когда камера едет следом
  // за игроком без движения мыши, и выстрелы ложатся мимо курсора.
export function _aimWorld() {
    try {
      const ptr = this.input.activePointer;
      return this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    } catch (e) {
      try {
        const ptr = this.input.activePointer;
        return { x: ptr.worldX, y: ptr.worldY };
      } catch (e2) {
        return { x: 0, y: 0 };
      }
    }
  }

  // Боевой HUD один в один как в одиночке (GameScene.createHud):
  // низ — 3 слота оружия с PNG-иконками, HP/броня, ячейки гранат,
  // круг абилки, ульта, опыт; прицел — кастомный вместо курсора.
