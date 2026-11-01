// soundSys.js — позиционные звуки (было в GameScene.sfxShot/_sfxVolAt/_sfxAt/_alertNoise/_hoverSfx).
// Все функции принимают сцену первым аргументом, чтобы их могли звать
// и GameScene, и NetGameScene без копипаста.
import { synthVoiceFor, playSynthShot } from '../data/gunSynth.js?v=5';

export function sfxVolAt(scene, sx, sy, base) {
  let volume = base;
  try {
    const px = scene && scene.player ? scene.player.x : 640;
    const py = scene && scene.player ? scene.player.y : 360;
    const cam = scene.cameras.main;
    const viewW = cam.width / Math.max(0.2, cam.zoom);
    const viewH = cam.height / Math.max(0.2, cam.zoom);
    const visR = Math.hypot(viewW, viewH) / 2;
    let minRange = 440;
    (scene.players || []).forEach(p => {
      const r = p && p.weapon && p.weapon.range;
      if (typeof r === 'number' && r > 0) minRange = Math.min(minRange, r);
    });
    const fullR = Math.max(minRange, visR * 0.5);
    if (typeof sx === 'number' && typeof sy === 'number') {
      const d = Math.hypot(sx - px, sy - py);
      const wv = cam.worldView;
      const inView = wv && sx >= wv.x && sx <= wv.x + wv.width &&
        sy >= wv.y && sy <= wv.y + wv.height;
      if (!inView) volume = base * 0.1;
      else if (d <= fullR) volume = base;
      else {
        const clamp01 = (v) => Math.max(0, Math.min(1, v));
        const t = clamp01((d - fullR) / Math.max(1, visR - fullR));
        volume = base * (1 - t) + base * 0.14 * t;
        if (volume < base * 0.14) volume = base * 0.14;
      }
    }
  } catch (e) {}
  return volume;
}

export function sfxAt(scene, key, sx, sy, base) {
  try {
    if (!key || !scene || !scene.sound || scene.sound.locked) return;
    if (!scene.cache.audio.exists(key)) return;
    scene.sound.play(key, { volume: sfxVolAt(scene, sx, sy, base == null ? 0.4 : base) });
  } catch (e) {}
}

export function sfxShot(scene, name, magLeft, sx, sy, weaponsList) {
  try {
    if (!name || !scene || !scene.sound || scene.sound.locked) return;
    const base = (name === 'Makarov') ? 0.7 : 0.35;
    // Стволы без своих записей (М1913, KE-7, М60, Vickers K): сначала
    // синтез своего тембра; нет контекста — как раньше чужим сэмплом.
    try {
      if (synthVoiceFor(name) && playSynthShot(scene, name, sfxVolAt(scene, sx, sy, base))) return;
    } catch (e) {}
    let key = 'shot_' + name;
    if (name === 'Remington' && (magLeft | 0) <= 0 && scene.cache.audio.exists('shot_Remington_last')) {
      key = 'shot_Remington_last';
    }
    if (!scene.cache.audio.exists(key)) {
      try {
        const def = (weaponsList || []).find(d => d && d.name === name);
        const fb = (def && (((def.pellets | 0) > 1) || def.noMag)) ? 'shot_Remington'
          : (def && def.category === 'secondary') ? 'shot_Makarov'
          : 'shot_bad_ak47';
        if (scene.cache.audio.exists(fb)) key = fb;
        else return;
      } catch (e) { return; }
    }
    scene.sound.play(key, { volume: sfxVolAt(scene, sx, sy, base) });
  } catch (e) {}
}

export function alertNoise(scene, x, y, radius) {
  try {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    (scene.players || []).forEach(p => {
      if (!p || !p.isAI || p.dead || !p.ai) return;
      if (Math.hypot(p.x - x, p.y - y) > radius) return;
      p.ai._hear = { x, exp: scene.time.now + 2500 };
    });
  } catch (e) {}
}

export function hoverSfx(scene) {
  try {
    if (scene.cache.audio.exists('sfx_hover') && !scene.sound.locked) {
      scene.sound.play('sfx_hover', { volume: 0.2 });
    }
  } catch (e) {}
}
