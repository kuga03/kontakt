'use strict';
const { lookupWeapon, magazineSizeOf, reloadTimeOf } = require('./weapons.cjs');

function srvMagSize(wspec) {
  try { return magazineSizeOf(wspec && wspec.name); } catch (e) { return 30; }
}
function srvReloadMs(wspec) {
  try { return reloadTimeOf(wspec && wspec.name); } catch (e) { return 2000; }
}
function srvMags(ws) {
  try {
    if (!ws._mags || typeof ws._mags !== 'object') ws._mags = {};
    return ws._mags;
  } catch (e) { return {}; }
}
function srvEnsureMag(ws, wspec) {
  try {
    if (!wspec) return 0;
    if (ws._gun !== wspec.name) ws._gun = wspec.name;
    const mm = srvMags(ws);
    if (!Number.isFinite(mm[wspec.name])) mm[wspec.name] = srvMagSize(wspec);
    return mm[wspec.name];
  } catch (e) { return 0; }
}
function srvRefillDone(ws, now) {
  try {
    if (ws._reloadUntil && now >= ws._reloadUntil) {
      const wspec = lookupWeapon(ws._reloadGun || ws._gun || '');
      if (wspec && wspec.kind !== 'melee') {
        srvMags(ws)[wspec.name] = srvMagSize(wspec);
      }
      ws._reloadUntil = 0;
      ws._reloadGun = null;
    }
  } catch (e) {}
}
function srvInitMagFromMsg(ws, m) {
  try {
    if (!m || !m.weapon) return;
    const w0 = lookupWeapon(String(m.weapon).slice(0, 24));
    if (!w0 || w0.kind === 'melee') return;
    ws._gun = w0.name;
    const mm = srvMags(ws);
    // Клиентский остаток принимаем только в пределах штатного (иначе фул):
    // переключение стволов фул не даёт — у каждого свой счёт.
    if (m.magazine != null && Number.isFinite(+m.magazine)) {
      mm[w0.name] = Math.max(0, Math.min(srvMagSize(w0), Math.floor(+m.magazine)));
    } else if (!Number.isFinite(mm[w0.name])) {
      mm[w0.name] = srvMagSize(w0);
    }
  } catch (e) {}
}
module.exports = { srvMagSize, srvReloadMs, srvMags, srvEnsureMag, srvRefillDone, srvInitMagFromMsg };

