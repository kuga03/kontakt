

import Assault from '../entities/Assault.js?v=380';
import Tank from '../entities/Tank.js?v=380';
import Medic from '../entities/Medic.js?v=380';
import Sniper from '../entities/Sniper.js?v=380';

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
import * as Lifecycle from './netgame/lifecycle.js?v=380';
import * as Puppets from './netgame/puppets.js?v=380';
import * as Hitreg from './netgame/hitreg.js?v=380';
import * as NetHud from './netgame/hud.js?v=380';
import * as Events from './netgame/events.js?v=380';
import * as ObjSmoke from './netgame/objSmoke.js?v=380';
import * as CombatFx from './netgame/combatFx.js?v=380';
export default class NetGameScene extends Phaser.Scene {
  constructor() {
    super('NetGameScene');
  }

  create(data) { return Lifecycle.create.call(this, data); }
  _leaveToLobby() { return Lifecycle._leaveToLobby.call(this); }
  _onRejoin(m) { return Lifecycle._onRejoin.call(this, m); }
  _showReconnect() { return Lifecycle._showReconnect.call(this); }
  _hideReconnect(soft) { return Lifecycle._hideReconnect.call(this, soft); }
  _escapeSolid(x, y, r) { return Lifecycle._escapeSolid.call(this, x, y, r); }
  _safeSpawn(x, y) { return Lifecycle._safeSpawn.call(this, x, y); }
  _rigK() { return Lifecycle._rigK.call(this); }
  _supportTop(x, approxY) { return Lifecycle._supportTop.call(this, x, approxY); }
  _restSpawn(x, y) { return Lifecycle._restSpawn.call(this, x, y); }
  _upsertPuppet(p) { return Puppets._upsertPuppet.call(this, p); }
  _refreshPuppet(id, p) { return Puppets._refreshPuppet.call(this, id, p); }
  _removePuppet(id) { return Puppets._removePuppet.call(this, id); }
  _syncRoster() { return Puppets._syncRoster.call(this); }
  _onSnap(m) { return Puppets._onSnap.call(this, m); }
  _bulletHitsFighter(b, f) { return Hitreg._bulletHitsFighter.call(this, b, f); }
  _segBlocked(x1, y1, x2, y2) { return Hitreg._segBlocked.call(this, x1, y1, x2, y2); }
  _sendHitBatched(targetId, dmg, wn, zone) { return Hitreg._sendHitBatched.call(this, targetId, dmg, wn, zone); }
  onMeleeHit(attacker, victimEnt, dmg) { return Hitreg.onMeleeHit.call(this, attacker, victimEnt, dmg); }
  _setFighterVisible(f, v) { return Hitreg._setFighterVisible.call(this, f, v); }
  _rememberMatchPlayers(list) { return Puppets._rememberMatchPlayers.call(this, list); }
  _matchInfo(id) { return Puppets._matchInfo.call(this, id); }
  _teamOf(p, fb) { return Puppets._teamOf.call(this, p, fb); }
  _paintName(p) { return Puppets._paintName.call(this, p); }
  _isAlly(f) { return Puppets._isAlly.call(this, f); }
  _wantBars(f) { return Puppets._wantBars.call(this, f); }
  _fixOverhead(f) { return Puppets._fixOverhead.call(this, f); }
  getDesiredZoom(range) { return Puppets.getDesiredZoom.call(this, range); }
  _aimWorld() { return Puppets._aimWorld.call(this); }
  _buildCombatHud() { return NetHud._buildCombatHud.call(this); }
  updateHudTransform() { return NetHud.updateHudTransform.call(this); }
  drawAbilityCircle(ready01) { return NetHud.drawAbilityCircle.call(this, ready01); }
  drawReloadIcon() { return NetHud.drawReloadIcon.call(this); }
  _updateCombatHud(time) { return NetHud._updateCombatHud.call(this, time); }
  drawCrosshair() { return NetHud.drawCrosshair.call(this); }
  _onDamage(m) { return Events._onDamage.call(this, m); }
  _onDead(m) { return Events._onDead.call(this, m); }
  _onSpawn(m) { return Events._onSpawn.call(this, m); }
  _onScore(m) { return Events._onScore.call(this, m); }
  _layoutScoreRow() { return NetHud._layoutScoreRow.call(this); }
  _netRows() { return NetHud._netRows.call(this); }
  _renderNetBoard() { return NetHud._renderNetBoard.call(this); }
  _onOver(m) { return NetHud._onOver.call(this, m); }
  _buildOverBoard(m) { return NetHud._buildOverBoard.call(this, m); }
  _buildObjVisuals() { return ObjSmoke._buildObjVisuals.call(this); }
  _carrierXY(id, fx, fy) { return ObjSmoke._carrierXY.call(this, id, fx, fy); }
  _drawObj() { return ObjSmoke._drawObj.call(this); }
  throwGrenade(owner, type, angle) { return ObjSmoke.throwGrenade.call(this, owner, type, angle); }
  _inSolid(tx, ty, r) { return Hitreg._inSolid.call(this, tx, ty, r); }
  explodeGrenade(g, owner) { return ObjSmoke.explodeGrenade.call(this, g, owner); }
  emitSmoke(g) { return ObjSmoke.emitSmoke.call(this, g); }
  _smokeCloud(x, y) { return ObjSmoke._smokeCloud.call(this, x, y); }
  _smokeAt(x, y) { return ObjSmoke._smokeAt.call(this, x, y); }
  _segCircle(x1, y1, x2, y2, cx, cy, r) { return Hitreg._segCircle.call(this, x1, y1, x2, y2, cx, cy, r); }
  _foeHiddenBySmoke(v, b) { return ObjSmoke._foeHiddenBySmoke.call(this, v, b); }
  _setSmokeGhost(p, hide) { return ObjSmoke._setSmokeGhost.call(this, p, hide); }
  _updateSmokeGhosts() { return ObjSmoke._updateSmokeGhosts.call(this); }
  _boomFx(x, y) { return ObjSmoke._boomFx.call(this, x, y); }
  _tracerStyle(w, owner) { return CombatFx._tracerStyle.call(this, w, owner); }
  drawTracers() { return CombatFx.drawTracers.call(this); }
  _spawnForeign(ox, oy, ang, owner, range, style, isRocket) { return CombatFx._spawnForeign.call(this, ox, oy, ang, owner, range, style, isRocket); }
  _onFire(m) { return CombatFx._onFire.call(this, m); }
  _fireOnce(weapon, owner, bx, by, ang, tx, ty) { return CombatFx._fireOnce.call(this, weapon, owner, bx, by, ang, tx, ty); }
  _onNaded(m) { return CombatFx._onNaded.call(this, m); }
  _onBoom(m) { return CombatFx._onBoom.call(this, m); }
  _onSmoke(m) { return CombatFx._onSmoke.call(this, m); }
  spawnImpact(x, y, color, n) { return CombatFx.spawnImpact.call(this, x, y, color, n); }
  _bloodFx(x, y, n) { return CombatFx._bloodFx.call(this, x, y, n); }
  _killFx(x, y, zone) { return CombatFx._killFx.call(this, x, y, zone); }
  _sfxVolAt(sx, sy, base) { return CombatFx._sfxVolAt.call(this, sx, sy, base); }
  _sfxAt(key, sx, sy, base) { return CombatFx._sfxAt.call(this, key, sx, sy, base); }
  spawnPickup(type, x, y, quiet) { return CombatFx.spawnPickup.call(this, type, x, y, quiet); }
  _throwKit(type, x, y, team, netId) { return ObjSmoke._throwKit.call(this, type, x, y, team, netId); }
  _findKit(netId) { return ObjSmoke._findKit.call(this, netId); }
  _onKit(m) { return ObjSmoke._onKit.call(this, m); }
  _onKitOk(m) { return ObjSmoke._onKitOk.call(this, m); }
  _onKitFix(m) { return ObjSmoke._onKitFix.call(this, m); }
  _feedKill(victimName, byName, victimIsMe, byIsMe, byTeam, wLabel, hs, isTeamkill) { return Events._feedKill.call(this, victimName, byName, victimIsMe, byIsMe, byTeam, wLabel, hs, isTeamkill); }
  _nameOf(id) { return Events._nameOf.call(this, id); }
  _bannerSfx(m) { return Events._bannerSfx.call(this, m); }
  _banner(text, color) { return Events._banner.call(this, text, color); }
  spawnMuzzle(x, y, angle) { return CombatFx.spawnMuzzle.call(this, x, y, angle); }
  spawnShell(x, y, dir) { return CombatFx.spawnShell.call(this, x, y, dir); }
  sfxShot(name, magLeft, sx, sy) { return CombatFx.sfxShot.call(this, name, magLeft, sx, sy); }
  spawnBullet(owner, angle, damage, range, x, y, visual) { return CombatFx.spawnBullet.call(this, owner, angle, damage, range, x, y, visual); }
  _toast(msg) { return Events._toast.call(this, msg); }
  update(time, delta) { return Events.update.call(this, time, delta); }
  _updateHudBackground(time, p) { return NetHud._updateHudBackground.call(this, time, p); }
}
