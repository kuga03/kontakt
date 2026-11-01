// pauseModal.js — меню паузы (было в GameScene.createPauseMenu/togglePause).
// Функции принимают сцену; колбэки зовут методы сцены как раньше.
import { gameW } from './layout.js?v=3';

export function createPauseMenu(scene) {
  // Адаптив: затемнение на всю ширину (позицию центрит updateHudTransform).
  scene.pauseOverlay = scene.addHudElement(scene.add.rectangle(
    640, 360, gameW(scene), 720, 0x000000, 0.6
  ).setScrollFactor(0).setDepth(300).setVisible(false), 640, 360);

  scene.pauseTitle = scene.addHudElement(scene.add.text(640, 250, 'ПАУЗА', {
    fontSize: '42px',
    color: '#ffffff'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false), 640, 250);

  scene.pauseResume = scene.addHudElement(scene.add.text(640, 340, 'Продолжить', {
    fontSize: '28px',
    color: '#ffffff',
    backgroundColor: '#287a45',
    padding: 15
  }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false), 640, 340);

  scene.pauseResume.setInteractive({ useHandCursor: true });
  scene.pauseResume.on('pointerdown', () => scene.togglePause());
  scene.pauseResume.on('pointerover', () => { scene.pauseResume.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
  scene.pauseResume.on('pointerout', () => scene.pauseResume.setStyle({ color: '#ffffff' }));

  scene.pauseMenuBtn = scene.addHudElement(scene.add.text(640, 420, 'Выйти в меню', {
    fontSize: '28px',
    color: '#ffffff',
    backgroundColor: '#553333',
    padding: 15
  }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false), 640, 420);

  scene.pauseMenuBtn.setInteractive({ useHandCursor: true });
  scene.pauseMenuBtn.on('pointerdown', () => {
    scene.isPaused = false;
    scene.scene.start('MenuScene');
  });
  scene.pauseMenuBtn.on('pointerover', () => { scene.pauseMenuBtn.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
  scene.pauseMenuBtn.on('pointerout', () => scene.pauseMenuBtn.setStyle({ color: '#ffffff' }));

  scene.pauseElements = [
    scene.pauseOverlay, scene.pauseTitle,
    scene.pauseResume, scene.pauseMenuBtn
  ];
  scene.pauseElements.forEach(e => { try { e._noHudScale = true; } catch (err) {} });

  if (scene.mode === 'TRIAL') {
    scene.pauseBuyAlly = scene.addHudElement(scene.add.text(640, 490, 'Купить сокомандника (300 монет · ×25 жив.)', {
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#2a5a8a',
      padding: 12
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setVisible(false), 640, 490);

    scene.pauseBuyAlly.setInteractive({ useHandCursor: true });
    scene.pauseBuyAlly.on('pointerdown', () => scene.buyTrialAlly());
    scene.pauseBuyAlly.on('pointerover', () => { scene.pauseBuyAlly.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
    scene.pauseBuyAlly.on('pointerout', () => scene.pauseBuyAlly.setStyle({ color: '#ffffff' }));

    scene.pauseElements.push(scene.pauseBuyAlly);
    try { scene.pauseBuyAlly._noHudScale = true; } catch (err) {}
  }
}

export function togglePause(scene) {
  scene.isPaused = !scene.isPaused;

  if (scene.isPaused) {
    scene.physics.pause();
    try { scene.time.paused = true; } catch (e) {}
    try { scene.tweens.timeScale = 0; } catch (e) {}
    try {
      (scene.players || []).forEach(p => {
        (p.inventory || []).forEach(w => { if (w && w.pauseReload) w.pauseReload(); });
      });
    } catch (e) {}
    try { scene._pauseRealAt = Date.now(); } catch (e) {}
    scene.pauseElements.forEach(e => e.setVisible(true));
    scene.input.setDefaultCursor('default');
  } else {
    scene.physics.resume();
    try { scene.time.paused = false; } catch (e) {}
    try { scene.tweens.timeScale = 1; } catch (e) {}
    // Пауза не должна съедать время матча: часы цикла (scene._loopNow)
    // идут и в паузе — сдвигаем loop-ключи на реально прошедшие мс.
    // Мёртвые ключи _ctfEndsAt/_tdmEndsAt/_bombEndsAt/_kothEndsAt/_modeT0
    // здесь больше не трогаем (матч их не читает — только создание).
    try {
      const skipped = Math.max(0, Date.now() - (scene._pauseRealAt || Date.now()));
      if (skipped > 0) {
        for (const k of ['_modeT0loop', '_respawnAt', 'trialStart']) {
          if (Number.isFinite(scene[k]) && scene[k] > 0) scene[k] += skipped;
        }
        (scene.players || []).forEach(p => {
          if (p && p.dead && Number.isFinite(p.diedAt)) p.diedAt += skipped;
        });
        [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag].forEach(f => {
          if (f && Number.isFinite(f.droppedAt) && f.droppedAt > 0) f.droppedAt += skipped;
        });
        try {
          scene._pauseSkippedTotal = (scene._pauseSkippedTotal || 0) + skipped;
          const _sh = (o, keys) => {
            try {
              if (!o) return;
              keys.forEach(k => { if (Number.isFinite(o[k]) && o[k] > 0) o[k] += skipped; });
            } catch (e) {}
          };
          _sh(scene, ['_youStillSince', '_stealAt', '_arrAt', '_firstHAt']);
          try {
            Object.keys(scene._journey || {}).forEach(nm => {
              const r = scene._journey[nm];
              if (r && Number.isFinite(r.t0) && r.t0 > 0) r.t0 += skipped;
            });
          } catch (e) {}
          try {
            Object.keys(scene._warnWatch || {}).forEach(nm => {
              _sh(scene._warnWatch[nm], ['at', 'stillSince', 'nodeSince', 'flSince']);
            });
          } catch (e) {}
          try {
            Object.keys(scene._flankWatch || {}).forEach(nm => {
              const r = scene._flankWatch[nm];
              if (r && Number.isFinite(r.since) && r.since > 0) r.since += skipped;
            });
          } catch (e) {}
          try {
            Object.keys(scene._stillWatch || {}).forEach(nm => {
              const r = scene._stillWatch[nm];
              if (r && Number.isFinite(r.since) && r.since > 0) r.since += skipped;
            });
            Object.keys(scene._navWatch || {}).forEach(nm => {
              const r = scene._navWatch[nm];
              if (r && Number.isFinite(r.since) && r.since > 0) r.since += skipped;
            });
            Object.keys(scene._gapSince || {}).forEach(nm => {
              const r = scene._gapSince[nm];
              if (r && Number.isFinite(r.since) && r.since > 0) r.since += skipped;
            });
            if (Number.isFinite(scene._gapSince0) && scene._gapSince0 > 0) scene._gapSince0 += skipped;
            Object.keys(scene._wedgeWatch || {}).forEach(nm => {
              const r = scene._wedgeWatch[nm];
              if (r && Number.isFinite(r.since) && r.since > 0) r.since += skipped;
            });
            Object.keys(scene._misWatch || {}).forEach(nm => {
              const r = scene._misWatch[nm];
              if (r && Number.isFinite(r.since) && r.since > 0) r.since += skipped;
            });
          } catch (e) {}
          try {
            (scene.players || []).forEach(p => {
              if (!p || !p.ai) return;
              const ai = p.ai;
              if (Number.isFinite(ai._stopSince) && ai._stopSince > 0) ai._stopSince += skipped;
              if (Number.isFinite(ai._crouchSince) && ai._crouchSince > 0) ai._crouchSince += skipped;
              if (Number.isFinite(ai._baseCampSince) && ai._baseCampSince > 0) ai._baseCampSince += skipped;
              if (Number.isFinite(ai._hhAnchorSince) && ai._hhAnchorSince > 0) ai._hhAnchorSince += skipped;
            });
          } catch (e) {}
        } catch (e) {}
      }
    } catch (e) {}
    try { scene._pauseRealAt = 0; } catch (e) {}
    try {
      (scene.players || []).forEach(p => {
        (p.inventory || []).forEach(w => { if (w && w.resumeReload) w.resumeReload(); });
      });
    } catch (e) {}
    scene.pauseElements.forEach(e => e.setVisible(false));
    scene.input.setDefaultCursor('none');
  }
}
