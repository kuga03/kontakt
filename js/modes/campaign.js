// campaign.js тАФ ╨║╨░╨╝╨┐╨░╨╜╨╕╤П: ╤Б╤О╨╢╨╡╤В╨╜╤Л╨╣ ╤Н╨║╤А╨░╨╜ ╨╕ ╨╛╨▒╤Г╤З╨╡╨╜╨╕╨╡ (╨▒╤Л╨╗╨╛ ╨▓ GameScene).
// ╨д╤Г╨╜╨║╤Ж╨╕╨╕ ╨┐╤А╨╕╨╜╨╕╨╝╨░╤О╤В ╤Б╤Ж╨╡╨╜╤Г; ╨▒╨░╨╜╨╜╨╡╤А╤Л/╨┐╨╛╨┤╨▒╨╛╤А╤Л/╨╖╨▓╤Г╨║╨╕ тАФ ╤З╨╡╤А╨╡╨╖ ╨╛╨▒╤С╤А╤В╨║╨╕ ╤Б╤Ж╨╡╨╜╤Л
// (trackModalElems/hoverSfx/spawnPickup/groundHeightAt), ╤Б╨▓╨╛╨╕╤Е ╨╕╨╝╨┐╨╛╤А╤В╨╛╨▓ ╨╜╨╡╤В.
import { gameW } from '../ui/layout.js?v=3';


export function showStory(scene, text, onComplete, btnLabel) {
  let finished = false;
  let revealed = false;
  let revealT = 0;
  text = text || '';
  const t0 = (scene.time && scene.time.now) || 0;
  try { scene.input.setDefaultCursor('default'); } catch (e) {}
  // ╨Ч╤Г╨╝ ╨▓ 1 ╨╜╨░ ╨▓╤А╨╡╨╝╤П ╨╖╨░╤Б╤В╨░╨▓╨║╨╕ (╨╕╨╜╤В╤А╨╛ ╨╕ ╨░╤Г╤В╤А╨╛): ╤А╨░╨╖╨╝╨╡╤А ╤В╨╡╨║╤Б╤В╨░ ╤Д╨╕╨║╤Б╨╕╤А╨╛╨▓╨░╨╜
  // ╨╕ ╨╜╨╡ ╨╖╨░╨▓╨╕╤Б╨╕╤В ╨╛╤В ╨┤╨░╨╗╤М╨╜╨╛╤Б╤В╨╕ ╨╛╤А╤Г╨╢╨╕╤П/╨║╨░╨╝╨╡╤А╤Л. ╨Т╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╨╝ ╨▓ finish.
  try {
    scene._storyPrevZoom = scene.cameras.main.zoom;
    scene.cameras.main.setZoom(1);
    scene._storyOpen = true;
  } catch (e) {}

  // ╨Р╨┤╨░╨┐╤В╨╕╨▓: ╨╖╨░╤В╨╡╨╝╨╜╨╡╨╜╨╕╨╡ ╨╜╨░ ╨▓╤Б╤О ╤И╨╕╤А╨╕╨╜╤Г (╤Ж╨╡╨╜╤В╤А ╨▓╤Л╤Б╤В╨░╨▓╨╕╤В _trackModalElems
  // ╤Б╨┤╨▓╨╕╨│╨╛╨╝ ox, ╨┐╨╛╤Н╤В╨╛╨╝╤Г x=640, ╨░ ╨╜╨╡ ╤Б╨╡╤А╨╡╨┤╨╕╨╜╨░ тАФ ╨╕╨╜╨░╤З╨╡ ╨┤╨▓╨╛╨╣╨╜╨╛╨╣ ╤Б╨┤╨▓╨╕╨│).
  const _sw = gameW(scene);
  const overlay = scene.add.rectangle(
    640, 360, _sw, 720, 0x000000, 0.75
  ).setScrollFactor(0).setDepth(400);

  const titleText = scene.add.text(640, 200, scene.campaignLevel?.name || '', {
    fontSize: '36px',
    color: '#ffff55'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);

  const storyText = scene.add.text(640, 350, '', {
    fontSize: '20px',
    color: '#ffffff',
    align: 'center',
    lineSpacing: 8
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);

  const hint = scene.add.text(640, 520, '╨Э╨░╨╢╨╝╨╕ тАФ ╨┐╨╛╨║╨░╨╖╨░╤В╤М ╤В╨╡╨║╤Б╤В ╤Б╤А╨░╨╖╤Г', {
    fontSize: '16px',
    color: '#aaaaaa'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
  hint.setVisible(false);

  // ╨Я╤А╨╛╨│╤А╨╡╤Б╤Б╨▒╨░╤А ╨╕ ╨┐╤А╨╛╨│╤А╨╡╨▓ ╨▒╨╛╤В╨╛╨▓ ╨╜╤Г╨╢╨╜╤Л ╨в╨Ю╨Ы╨м╨Ъ╨Ю ╨▓ ╨╕╨╜╤В╤А╨╛ ╨┐╨╡╤А╨╡╨┤ ╨▒╨╛╨╡╨╝ (╨╜╨╡ ╨▓ ╨░╤Г╤В╤А╨╛ ╨┐╨╛╨▒╨╡╨┤╤Л)
  const isIntro = !scene.gameOver && !scene._introDone;

  const btnY = isIntro ? 560 : 570;
  const goBtn = scene.add.text(640, btnY, btnLabel || '╨Т ╨С╨Ю╨Щ!', {
    fontSize: '26px',
    color: '#ffffff',
    backgroundColor: '#287a45',
    padding: 14
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
  goBtn.setVisible(false);

  const elements = [overlay, titleText, storyText, hint, goBtn];

  let warmTimer = null;
  let animTimer = null;

  if (isIntro) {
    // ╨б╤В╨╕╨╗╤М╨╜╤Л╨╣ ╨┐╤А╨╛╨│╤А╨╡╤Б╤Б╨▒╨░╤А ╨┐╨╛╨┤╨│╨╛╤В╨╛╨▓╨║╨╕ ╨▒╨╛╤В╨╛╨▓ (╨║╨╕╨▒╨╡╤А╨┐╨░╨╜╨║ / ╨╝╨╕╨╗╨╕╤В╨░╤А╨╕ HUD)
    const barW = 340, barH = 10;
    const barY = 620;
    const barGfx = scene.add.graphics().setScrollFactor(0).setDepth(401);
    const barLabel = scene.add.text(640, barY + 16, '╨Я╨Ю╨Ф╨У╨Ю╨в╨Ю╨Т╨Ъ╨Р ╨Я╨Ю╨Ф╨а╨Р╨Ч╨Ф╨Х╨Ы╨Х╨Э╨Ш╨п...', {
      fontSize: '13px',
      color: '#00e5ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401);

    elements.push(barGfx, barLabel);

    // ╨д╨╛╨╜╨╛╨▓╤Л╨╣ ╨┐╤А╨╛╨│╤А╨╡╨▓ ╨▒╨╛╤В╨╛╨▓ ╨┐╨╛ ╤З╨░╤Б╤В╤П╨╝:
    const aiBots = (scene.players || []).filter(p => p && p.isAI && p.ai);
    let warmIdx = 0;
    let warmDone = false;
    let curPct = 0;
    let targetPct = 0;

    const redrawBar = (pct) => {
      if (finished) return;
      barGfx.clear();
      const bx = 640 - barW / 2;
      // ╨в╤С╨╝╨╜╨░╤П ╤А╨░╨╝╨║╨░-╨┐╨╛╨┤╨╗╨╛╨╢╨║╨░
      barGfx.fillStyle(0x070c18, 0.9);
      barGfx.fillRoundedRect(bx - 3, barY - barH / 2 - 3, barW + 6, barH + 6, 6);
      barGfx.lineStyle(1.5, 0x1f3b5c, 0.9);
      barGfx.strokeRoundedRect(bx - 3, barY - barH / 2 - 3, barW + 6, barH + 6, 6);

      // ╨Ч╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╤Б ╨╜╨╡╨╛╨╜╨╛╨▓╤Л╨╝ ╨│╤А╨░╨┤╨╕╨╡╨╜╤В╨╛╨╝
      const fillW = Math.max(0, barW * pct);
      if (fillW > 0) {
        if (pct >= 1) {
          // ╨Я╨╛╨╗╨╜╨░╤П ╨│╨╛╤В╨╛╨▓╨╜╨╛╤Б╤В╤М тАФ ╨╕╨╖╤Г╨╝╤А╤Г╨┤╨╜╨╛-╨╖╨╡╨╗╤С╨╜╤Л╨╣ ╨╜╨╡╨╛╨╜
          barGfx.fillGradientStyle(0x00ff88, 0x00ff88, 0x00aa55, 0x00aa55, 1);
        } else {
          // ╨Ч╨░╨│╤А╤Г╨╖╨║╨░ тАФ ╨║╨╕╨▒╨╡╤А╨┐╨░╨╜╨║ ╤Ж╨╕╨░╨╜/╨╗╨░╨╖╤Г╤А╤М
          barGfx.fillGradientStyle(0x00e5ff, 0x00e5ff, 0x0077cc, 0x0077cc, 1);
        }
        barGfx.fillRoundedRect(bx, barY - barH / 2, fillW, barH, 4);

        // ╨б╨║╨╛╨╗╤М╨╖╤П╤Й╨╕╨╣ ╨▒╨╗╨╕╨║-╨┐╨╛╨┤╤Б╨▓╨╡╤В╨║╨░
        barGfx.fillStyle(0xffffff, 0.35);
        barGfx.fillRoundedRect(bx + 1, barY - barH / 2 + 1, Math.max(0, fillW - 2), Math.floor(barH / 2) - 1, 2);
      }
    };

    redrawBar(0);

    // ╨Я╨╗╨░╨▓╨╜╨░╤П ╨░╨╜╨╕╨╝╨░╤Ж╨╕╤П ╨┐╤А╨╛╤Ж╨╡╨╜╤В╨╛╨▓
    animTimer = scene.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        if (finished) return;
        if (curPct < targetPct) {
          curPct = Math.min(targetPct, curPct + 0.04);
          redrawBar(curPct);
          const p100 = Math.round(curPct * 100);
          if (curPct >= 1) {
            barLabel.setText(`тЬУ ╨С╨Ю╨Щ╨ж╨л ╨У╨Ю╨в╨Ю╨Т╨л ╨Ъ ╨С╨Ю╨о (${p100}%)`);
            barLabel.setColor('#00ff88');
          } else {
            barLabel.setText(`╨Я╨Ю╨Ф╨У╨Ю╨в╨Ю╨Т╨Ъ╨Р ╨Я╨Ю╨Ф╨а╨Р╨Ч╨Ф╨Х╨Ы╨Х╨Э╨Ш╨п... ${p100}%`);
          }
        }
      }
    });

    // ╨Я╨╛╤И╨░╨│╨╛╨▓╤Л╨╣ ╨┐╤А╨╛╨│╤А╨╡╨▓ ╨Ш╨Ш ╨▒╨╛╤В╨╛╨▓ (╨┐╨╛ 1 ╨▒╨╛╤В╤Г ╨▓ ╤В╨╕╨║ ╨┤╨╗╤П ╨╜╤Г╨╗╨╡╨▓╨╛╨╣ ╨╜╨░╨│╤А╤Г╨╖╨║╨╕)
    warmTimer = scene.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        if (finished || warmDone) return;
        if (aiBots.length === 0) {
          warmDone = true;
          targetPct = 1;
          if (warmTimer) { warmTimer.remove(); warmTimer = null; }
          return;
        }
        const bot = aiBots[warmIdx];
        if (bot && bot.ai) {
          try {
            const now = scene.time ? scene.time.now : 0;
            // Прогрев ИИ: разовый проход update для предварительной инициализации
            bot.ai.update(now, 33);
          } catch (eWarm) {}
        }
        warmIdx++;
        targetPct = Math.min(1, warmIdx / aiBots.length);
        if (warmIdx >= aiBots.length) {
          warmDone = true;
          targetPct = 1;
          if (warmTimer) { warmTimer.remove(); warmTimer = null; }
        }
      }
    });
  }

  scene._trackModalElems(elements);
  let chars = 0;

  const typeTimer = scene.time.addEvent({
    delay: 70,
    loop: true,
    callback: () => {
      chars = Math.min(text.length, chars + 3);
      storyText.setText(text.slice(0, chars));
      if (chars >= text.length) {
        typeTimer.remove();
        if (scene.typeTimer === typeTimer) scene.typeTimer = null;
        reveal(true);
      }
    }
  });
  scene.typeTimer = typeTimer;

  const reveal = (byTimer) => {
    if (revealed || finished) return;
    revealed = true;
    try { revealT = scene.time ? scene.time.now : 0; } catch (e) {}
    try {
      typeTimer.remove();
      if (scene.typeTimer === typeTimer) scene.typeTimer = null;
    } catch (e) {}
    storyText.setText(text);
    hint.setText(byTimer ? 'Enter тАФ ╨▓ ╨▒╨╛╨╣' : '╨в╨╡╨║╤Б╤В ╨┐╨╛╨║╨░╨╖╨░╨╜ ┬╖ ╨╢╨╝╨╕ ╨Т ╨С╨Ю╨Щ! ╨╕╨╗╨╕ Enter');
    hint.setVisible(true);
    goBtn.setVisible(true);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    try { scene.input.off('pointerdown', onDown); } catch (e) {}
    try { scene.input.keyboard.off('keydown', onKey); } catch (e) {}
    try {
      typeTimer.remove();
      if (scene.typeTimer === typeTimer) scene.typeTimer = null;
    } catch (e) {}
    try {
      if (warmTimer) warmTimer.remove();
      if (animTimer) animTimer.remove();
    } catch (e) {}
    scene._storyDismiss = null;
    scene._storyKeyHandler = null;
    // ╨Ч╤Г╨╝ ╨╜╨░╨╖╨░╨┤ ╨║╨░╨║ ╨▒╤Л╨╗ ╨┤╨╛ ╨╖╨░╤Б╤В╨░╨▓╨║╨╕.
    try {
      scene._storyOpen = false;
      if (Number.isFinite(scene._storyPrevZoom) && scene._storyPrevZoom > 0) {
        scene.cameras.main.setZoom(scene._storyPrevZoom);
      }
    } catch (e) {}
    elements.forEach(e => { try { e.destroy(); } catch (e2) {} });
    // ╨Ъ╤Г╤А╤Б╨╛╤А ╨╜╨░╨╖╨░╨┤ ╨┐╨╛╨┤ ╨┐╤А╨╕╤Ж╨╡╨╗ (╨░╤Г╤В╤А╨╛ ╤Б╨░╨╝╨╛ ╨▓╨╡╤А╨╜╤С╤В ╨╛╨▒╤Л╤З╨╜╤Л╨╣ ╨┐╨╛╤Б╨╗╨╡ ╨╜╨░╤Б).
    try { scene.input.setDefaultCursor('none'); } catch (e) {}
    if (onComplete) onComplete();
  };

  const onDown = () => {
    if (finished) return;
    try {
      if (scene.time && scene.time.now - t0 < 800) return;
    } catch (e) {}
    // ╨Ъ╨╗╨╕╨║ ╨╝╨╕╨╝╨╛ ╨║╨╜╨╛╨┐╨║╨╕ ╨╕╤Б╤В╨╛╤А╨╕╤О ╨╜╨╡ ╨╖╨░╨║╤А╤Л╨▓╨░╨╡╤В тАФ ╤В╨╛╨╗╤М╨║╨╛ ╨┤╨╛╨┐╨╡╤З╨░╤В╤Л╨▓╨░╨╡╤В.
    if (!revealed) reveal(false);
  };

  const onKey = (event) => {
    if (finished) return;
    const k = event && event.key;
    if (k === 'Escape') return; // ESC ╤Б╤О╨╢╨╡╤В ╨╜╨╡ ╨┐╤А╨╛╨┐╤Г╤Б╨║╨░╨╡╤В
    try {
      if (scene.time && scene.time.now - t0 < 800) return;
    } catch (e) {}
    if (!revealed) {
      reveal(false);
      return;
    }
    // Enter тАФ ╤В╨╛╨╗╤М╨║╨╛ ╨┐╨╛╤Б╨╗╨╡ ╨┐╨╛╨╗╨╜╨╛╨│╨╛ ╨┐╨╛╨║╨░╨╖╨░ ╨╕ ╤Б ╨┐╨░╤Г╨╖╨╛╨╣ ╨╛╤В ╨╜╨╡╨│╨╛.
    if (k === 'Enter') {
      try {
        if (scene.time && scene.time.now - revealT > 1200) finish();
      } catch (e) {}
    }
  };

  goBtn.setInteractive({ useHandCursor: true });
  goBtn.on('pointerdown', () => finish());
  goBtn.on('pointerover', () => scene._hoverSfx());

  scene.input.on('pointerdown', onDown);
  scene.input.keyboard.on('keydown', onKey);
  scene._storyDismiss = onDown;
  scene._storyKeyHandler = onKey;
}

export function setupTutorial(scene) {
  scene.tut = null;
  const cl = scene.campaignLevel;
  if (scene.mode !== 'CAMPAIGN' || !cl || !cl.tutorial) return;

  scene.tut = {
    step: 0,
    started: 0,
    baseFrag: scene.player.fragGrenades,
    fragPicked: false
  };

  scene.tutBanner = scene.addHudElement(
    scene.add.text(640, 100, '', {
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#000000bb',
      padding: 10,
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(160),
    640, 100
  );

  // ╨Ь╨░╤А╨║╨╡╤А-╤Б╤В╤А╨╡╨╗╨║╨░ ╨╜╨░╨┤ ╤Ж╨╡╨╗╤М╤О ╤Г╤З╨╡╨▒╨║╨╕ (╨╢╤С╨╗╤В╤Л╨╣ ╤В╤А╨╡╤Г╨│╨╛╨╗╤М╨╜╨╕╨║): ╨╜╨░ ╨╝╨╡╤Б╤В╨╡,
  // ╨┐╤Г╤В╨░╨╜╨╕╤Ж╤Г ╨┤╨░╨▓╨░╨╗╨░ ╨╖╨╛╨╗╨╛╤В╨░╤П ╨╖╨░╨│╨╗╤Г╤И╨║╨░ ╨┐╨╕╤Б╤В╨╛╨╗╨╡╤В╨░ ╤А╤П╨┤╨╛╨╝ тАФ ╨╡╤С ╨╖╨░╨╝╨╡╨╜╨╕╨╗╨╕
  // ╨╜╨░╤Б╤В╨╛╤П╤Й╨╕╨╝ PNG (╤Б╨╝. Pickup).
  scene.tutMarker = scene.add.triangle(
    0, 0, 0, 14, -9, 0, 9, 0, 0xffdd00
  ).setOrigin(0.5).setDepth(21);

  scene.spawnPickup(
    'weapon',
    scene.tutorialSpawns.weapon.x,
    scene.tutorialSpawns.weapon.y,
    'Makarov'
  );
  // ╨г╤З╨╡╨▒╨╜╤Л╨╡ ╨┐╨╛╨┤╨▒╨╛╤А╤Л ╨╜╨╡ ╨┐╤А╨╛╤В╤Г╤Е╨░╤О╤В: ╨╕╨╜╨░╤З╨╡ ╨╝╨╡╨┤╨╗╨╡╨╜╨╜╤Л╨╣ ╨╕╨│╤А╨╛╨║ ╤В╨╡╤А╤П╨╡╤В ╨║╨╕╤В
  // (╤Г ╨│╤А╨░╨╜╨░╤В ╨▓╤Б╨╡╨│╨╛ 15╤Б) ╨╕ ╤И╨░╨│ ┬л╨┐╨╛╨┤╨▒╨╡╤А╨╕┬╗ ╨▓╨╕╤Б╨╕╤В ╨▓╨╡╤З╨╜╨╛.
  // ╨б╤В╨╛╤П╤В ╨╜╨╕╨╖╨╛╨╝ ╤А╨╛╨▓╨╜╨╛ ╨╜╨░ ╨│╤А╤Г╨╜╤В╨╡ (╨║╨╛╤А╨╛╨▒╨║╨░ 20px тАФ ╤Ж╨╡╨╜╤В╤А ╨╜╨░ GT-10),
  // ╨░ ╨╜╨╡ ╨▓ ╨▓╨╛╨╖╨┤╤Г╤Е╨╡/╨▓ ╨╖╨╡╨╝╨╗╨╡ ╨║╨░╨║ ╤А╨░╨╜╤М╤И╨╡.
  try {
    const GTw = scene.mapHeight - 50;
    scene.pickups.getChildren().forEach(pk => {
      if (pk) {
        pk.expires = Infinity;
        pk.y = GTw - 10;
        // ╨г╤З╨╡╨▒╨╜╨╛╨╡ тАФ ╤В╨╛╨╗╤М╨║╨╛ ╤Б╨▓╨╛╨╕╨╝: ╨▒╨╛╤В╤Л ╨▓╤А╨░╨│╨░ ╨╜╨╡ ╤А╨░╤Б╤В╨░╤Й╨░╤В.
        pk.team = 'blue';
      }
    });
  } catch (e) {}
}

export function updateTutorial(scene, time) {
  const tut = scene.tut;
  if (!tut) return;
  if (!tut.started || tut.started <= 0) return;
  if (time - tut.started < 800) return;

  // ╨Я╨╛╨║╨░ ╨╕╨│╤А╨╛╨║ ╨╜╨╡ ╨┐╨╛╨┤╨╛╨▒╤А╨░╨╗ ╨┐╨╕╤Б╤В╨╛╨╗╨╡╤В (╤И╨░╨│╨╕ 0тАУ1) тАФ ╨▓╤А╨░╨│╨╕ ╤Б╨┐╤П╤В:
  // ╨╕╨╜╨░╤З╨╡ ╨╛╨▒╤Б╤В╤А╨╡╨╗ ╨▒╨╡╨╖╨╛╤А╤Г╨╢╨╜╨╛╨│╨╛. ╨е╨▓╨╛╤Б╤В 1.5╤Б ╨┐╨╛╤Б╨╗╨╡ ╨┐╨╛╨┤╨▒╨╛╤А╨░ ╨┤╨╗╤П ╨┐╨╗╨░╨▓╨╜╨╛╤Б╤В╨╕.
  if (tut.step < 2 && scene.time) {
    scene.enemiesActiveAt = Math.max(scene.enemiesActiveAt || 0, time + 1500);
  }

  const T = scene.tutorialSpawns;
  const dummyPos = scene.tutDummy ? scene.tutDummy.body.center.x : 680;
  let text = '';
  let marker = false;

  switch (tut.step) {
    case 0:
      text = '╨г╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╨╡: A/D тАФ ╨┤╨▓╨╕╨╢╨╡╨╜╨╕╨╡, W/╨Я╨а╨Ю╨С╨Х╨Ы тАФ ╨┐╤А╤Л╨╢╨╛╨║, S тАФ ╨┐╤А╨╕╤Б╨╡╤Б╤В╤М\n╨Ы╨Ъ╨Ь тАФ ╤Б╤В╤А╨╡╨╗╤П╤В╤М, R тАФ ╨┐╨╡╤А╨╡╨╖╨░╤А╤П╨┤╨║╨░, ╨╝╤Л╤И╤М тАФ ╨┐╤А╨╕╤Ж╨╡╨╗';
      if (time - tut.started > 2800) {
        tut.step = 1;
      }
      break;
    case 1:
      text = '╨Я╨╛╨┤╨▒╨╡╤А╨╕ ╨┐╨╕╤Б╤В╨╛╨╗╨╡╤В! ╨Т╤Б╤В╨░╨╜╤М ╨╜╨░ ╨╜╨╡╨│╨╛ ╨╕ ╤Б╤В╨╛╨╣ (╤Б╤В╤А╨╡╨╗╤М╨▒╨░ тАФ ╨Ы╨Ъ╨Ь).';
      marker = true;
      if (scene.tutMarker) scene.tutMarker.x = T.weapon.x;
      if (scene.player.inventory.length > 0) {
        tut.step = 2;
        const pkf = scene.spawnPickup('frag', T.frag.x, T.frag.y);
        // ╨г╤З╨╡╨▒╨╜╨░╤П: ╨╜╨╡ ╨┐╤А╨╛╤В╤Г╤Е╨░╨╡╤В + ╨▓╤Л╨┤╨░╤С╤В╤Б╤П ╨┤╨░╨╢╨╡ ╨▒╨╡╨╖ ╨╜╨░╨▓╤Л╨║╨░ (╤Б╨╝. Pickup).
        // ╨Э╨╕╨╖╨╛╨╝ ╨╜╨░ ╨│╤А╤Г╨╜╤В (╨░╤А╤В 39px тАФ ╤Ж╨╡╨╜╤В╤А ╨╜╨░ GT-19). ╨в╨╛╨╗╤М╨║╨╛ ╤Б╨▓╨╛╨╕╨╝.
        if (pkf) {
          pkf.expires = Infinity;
          pkf.tutorial = true;
          pkf.team = 'blue';
          try { pkf.y = (scene.mapHeight - 50) - 19; } catch (e) {}
        }
      }
      break;
    case 2:
      text = '╨Я╨╛╨┤╨▒╨╡╤А╨╕ ╨╛╤Б╨║╨╛╨╗╨╛╤З╨╜╤Г╤О ╨│╤А╨░╨╜╨░╤В╤Г: ╨▓╤Б╤В╨░╨╜╤М ╨╜╨░ ╨╜╨╡╤С ╨╕ ╤Б╤В╨╛╨╣.';
      marker = true;
      if (scene.tutMarker) scene.tutMarker.x = T.frag.x;
      if (scene.player.fragGrenades > tut.baseFrag) {
        tut.fragPicked = true;
        tut.step = 3;
      }
      break;
    case 3:
      text = '╨С╤А╨╛╤Б╤М ╨│╤А╨░╨╜╨░╤В╤Г ╨┐╨╛ ╨╝╨░╨╜╨╡╨║╨╡╨╜╤Г:\n╨║╨╗╨░╨▓╨╕╤И╨░ G (╨┐╤А╨╕╤Ж╨╡╨╗╤М╤Б╤П ╨╝╤Л╤И╤М╤О), ╨┤╤Л╨╝ тАФ H';
      if (scene.tutMarker) scene.tutMarker.x = dummyPos;
      marker = true;
      // ╨Ь╨░╨╜╨╡╨║╨╡╨╜ ╤Г╨▒╨╕╤В ╤А╨░╨╜╤М╤И╨╡ ╨┐╨╛╨┤╤Б╨║╨░╨╖╨║╨╕ (╤А╨░╤Б╤Б╤В╤А╨╡╨╗╤П╨╗ ╨╖╨░╤А╨░╨╜╨╡╨╡) тАФ ╨▒╤А╨╛╤Б╨░╤В╤М
      // ╨╜╨╡ ╨▓ ╨║╨╛╨│╨╛: ╨┐╤А╤Л╨│╨░╨╡╨╝ ╨┤╨░╨╗╤М╤И╨╡, ╤И╨░╨│ 4 ╤Б╨░╨╝ ╤Г╨▓╨╕╨┤╨╕╤В ╤В╤А╤Г╨┐ ╨╕ ╨┐╨╛╨╣╨┤╤С╤В ╨║ 5.
      if (scene.tutDummy && scene.tutDummy.dead) {
        tut.step = 4;
        break;
      }
      if (tut.fragPicked && scene.player.fragGrenades < tut.baseFrag + 1) {
        tut.step = 4;
        const pkm = scene.spawnPickup('medkit', T.medkit.x, T.medkit.y);
        if (pkm) {
          try { pkm.expires = Infinity; } catch (e) {}
          try { pkm.y = (scene.mapHeight - 50) - 19; } catch (e) {}
          pkm.team = 'blue';
        }
      }
      break;
    case 4:
      text = '╨г╨╜╨╕╤З╤В╨╛╨╢╤М ╨╝╨░╨╜╨╡╨║╨╡╨╜. ╨б╤В╤А╨╡╨╗╤П╨╣ ╨╕╨╗╨╕ ╨▒╤А╨╛╤Б╤М ╨│╤А╨░╨╜╨░╤В╤Г!';
      marker = true;
      if (scene.tutMarker) scene.tutMarker.x = dummyPos;
      if (scene.tutDummy && scene.tutDummy.dead) {
        tut.step = 5;
      }
      break;
    case 5:
      text = '╨Ю╤Б╤В╨░╨╗╨╛╤Б╤М ╨┤╨▓╨░ ╨▓╤А╨░╨│╨░. ╨Ч╨░╤З╨╕╤Б╤В╨╕ ╤Г╤А╨╛╨▓╨╡╨╜╤М!';
      break;
  }

  if (marker && scene.tutMarker) {
    if (scene.tutMarker.visible === false) scene.tutMarker.setVisible(true);
    scene.tutMarker.y = scene.groundHeightAt(scene.tutMarker.x) - 110 + Math.sin(time / 240) * 8;
  } else if (scene.tutMarker) {
    scene.tutMarker.setVisible(false);
  }

  if (scene.tutBanner && scene.tutBanner.text !== text) {
    scene.tutBanner.setText(text);
  }
}
