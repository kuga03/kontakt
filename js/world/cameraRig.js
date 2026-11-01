// cameraRig.js — зум и следование камеры (было в GameScene).
// Функции принимают сцену, ничего не хранят сами.

export function getDesiredZoom(range) {
  const visibleHalfWidth = range * 1.05;
  // 1280 — логическая ширина игры; кламп как в оригинале.
  const z = 1280 / (2 * visibleHalfWidth);
  return Math.max(0.35, Math.min(1.5, z));
}

export function updateCameraZoom(scene) {
  try {
    if (!scene || !scene.cameras || !scene.player) return;
    if (scene._storyOpen) return;
    const range = (scene.player.weapon && scene.player.weapon.range) || 700;
    const target = getDesiredZoom(range);
    const cam = scene.cameras.main;
    const current = cam.zoom;
    if (Math.abs(current - target) > 0.001) {
      // Phaser.Math.Linear доступен через scene; фолбэк — вручную.
      const next = (typeof Phaser !== 'undefined' && Phaser.Math && Phaser.Math.Linear)
        ? Phaser.Math.Linear(current, target, 0.05)
        : current + (target - current) * 0.05;
      cam.setZoom(next);
    }
  } catch (e) {}
}

export function updateCameraFollow(scene) {
  try {
    if (!scene || !scene.cameras || !scene.player || !scene.input) return;
    const p = scene.player;
    const aimActive = scene._aimInit &&
      (scene.mode !== 'CAMPAIGN' || scene._introDone);
    let offX = 0;
    if (aimActive) {
      // На телефоне activePointer скачет между пальцами стиков, и сдвиг
      // следования болтается — камера дёргается при наводке. Берём прицел
      // игрока (правый стик пишет его каждый кадр). На ПК — как было.
      let aimWX = null;
      try {
        const _t = scene._touch;
        if (_t && _t.enabled && Number.isFinite(p.aimX)) aimWX = p.aimX;
      } catch (e) {}
      if (!Number.isFinite(aimWX)) {
        try { aimWX = scene.input.activePointer.worldX; } catch (e2) {}
      }
      try {
        const dx = aimWX - p.x;
        offX = -Math.sign(dx) * Math.min(Math.abs(dx) * 0.12, 25);
      } catch (e) {}
    }
    scene.cameras.main.setFollowOffset(offX, p.crouching ? 0 : 25);
  } catch (e) {}
}
