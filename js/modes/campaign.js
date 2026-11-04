// campaign.js тАФ ╨║╨░╨╝╨┐╨░╨╜╨╕╤П: ╤Б╤О╨╢╨╡╤В╨╜╤Л╨╣ ╤Н╨║╤А╨░╨╜ ╨╕ ╨╛╨▒╤Г╤З╨╡╨╜╨╕╨╡ (╨▒╤Л╨╗╨╛ ╨▓ GameScene).
// ╨д╤Г╨╜╨║╤Ж╨╕╨╕ ╨┐╤А╨╕╨╜╨╕╨╝╨░╤О╤В ╤Б╤Ж╨╡╨╜╤Г; ╨▒╨░╨╜╨╜╨╡╤А╤Л/╨┐╨╛╨┤╨▒╨╛╤А╤Л/╨╖╨▓╤Г╨║╨╕ тАФ ╤З╨╡╤А╨╡╨╖ ╨╛╨▒╤С╤А╤В╨║╨╕ ╤Б╤Ж╨╡╨╜╤Л
// (trackModalElems/hoverSfx/spawnPickup/groundHeightAt), ╤Б╨▓╨╛╨╕╤Е ╨╕╨╝╨┐╨╛╤А╤В╨╛╨▓ ╨╜╨╡╤В.
import { gameW } from '../ui/layout.js';
import Assault from '../entities/Assault.js';
import { navGraph as navMeshGraph } from '../ai/navMesh.js';


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

  const hint = scene.add.text(640, 520, 'Нажми — показать текст сразу', {
    fontSize: '16px',
    color: '#aaaaaa'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
  hint.setVisible(false);

  // ╨Я╤А╨╛╨│╤А╨╡╤Б╤Б╨▒╨░╤А ╨╕ ╨┐╤А╨╛╨│╤А╨╡╨▓ ╨▒╨╛╤В╨╛╨▓ ╨╜╤Г╨╢╨╜╤Л ╨в╨Ю╨Ы╨м╨Ъ╨Ю ╨▓ ╨╕╨╜╤В╤А╨╛ ╨┐╨╡╤А╨╡╨┤ ╨▒╨╛╨╡╨╝ (╨╜╨╡ ╨▓ ╨░╤Г╤В╤А╨╛ ╨┐╨╛╨▒╨╡╨┤╤Л)
  const isIntro = !scene.gameOver && !scene._introDone;

  const btnY = isIntro ? 560 : 570;
  const goBtn = scene.add.text(640, btnY, btnLabel || 'В БОЙ!', {
    fontSize: '26px',
    color: '#ffffff',
    backgroundColor: '#287a45',
    padding: 14
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
  goBtn.setVisible(false);

  const elements = [overlay, titleText, storyText, hint, goBtn];

  let warmTimer = null;
  let animTimer = null;
  let warmDone = true;
  let curPct = 0;
  let targetPct = 0;

  if (isIntro) {
    warmDone = false;
    // ╨б╤В╨╕╨╗╤М╨╜╤Л╨╣ ╨┐╤А╨╛╨│╤А╨╡╤Б╤Б╨▒╨░╤А ╨┐╨╛╨┤╨│╨╛╤В╨╛╨▓╨║╨╕ ╨▒╨╛╤В╨╛╨▓ (╨║╨╕╨▒╨╡╤А╨┐╨░╨╜╨║ / ╨╝╨╕╨╗╨╕╤В╨░╤А╨╕ HUD)
    const barW = 340, barH = 10;
    const barY = 620;
    const barGfx = scene.add.graphics().setScrollFactor(0).setDepth(401);
    const barLabel = scene.add.text(640, barY + 16, 'ПОДГОТОВКА ПОДРАЗДЕЛЕНИЯ...', {
      fontSize: '13px',
      color: '#00e5ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401);

    elements.push(barGfx, barLabel);

    // Фоновый прогрев навигации и ботов по шагам:
    const aiBots = (scene.players || []).filter(p => p && p.isAI && p.ai);
    let warmStep = 0;
    let warmBotIdx = 0;
    curPct = 0;
    targetPct = 0;

    const redrawBar = (pct) => {
      if (finished) return;
      barGfx.clear();
      const bx = 640 - barW / 2;
      // Тёмная рамка-подложка
      barGfx.fillStyle(0x070c18, 0.9);
      barGfx.fillRoundedRect(bx - 3, barY - barH / 2 - 3, barW + 6, barH + 6, 6);
      barGfx.lineStyle(1.5, 0x1f3b5c, 0.9);
      barGfx.strokeRoundedRect(bx - 3, barY - barH / 2 - 3, barW + 6, barH + 6, 6);

      // Заполнение с неоновым градиентом
      const fillW = Math.max(0, barW * pct);
      if (fillW > 0) {
        if (pct >= 1) {
          // Полная готовность — изумрудно-зелёный неон
          barGfx.fillGradientStyle(0x00ff88, 0x00ff88, 0x00aa55, 0x00aa55, 1);
        } else {
          // Загрузка — киберпанк циан/лазурь
          barGfx.fillGradientStyle(0x00e5ff, 0x00e5ff, 0x0077cc, 0x0077cc, 1);
        }
        barGfx.fillRoundedRect(bx, barY - barH / 2, fillW, barH, 4);

        // Скользящий блик-подсветка
        barGfx.fillStyle(0xffffff, 0.35);
        barGfx.fillRoundedRect(bx + 1, barY - barH / 2 + 1, Math.max(0, fillW - 2), Math.floor(barH / 2) - 1, 2);
      }
    };

    redrawBar(0);

    // Плавная анимация процентов
    animTimer = scene.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        if (finished) return;
        if (curPct < targetPct) {
          curPct = Math.min(targetPct, curPct + 0.05);
          redrawBar(curPct);
          const p100 = Math.round(curPct * 100);
          if (curPct >= 1) {
            barLabel.setText(`✓ БОЙЦЫ ГОТОВЫ К БОЮ (${p100}%)`);
            barLabel.setColor('#00ff88');
            if (revealed && !finished) {
              hint.setText('Бойцы готовы · жми В БОЙ! или Enter');
              hint.setVisible(true);
              goBtn.setVisible(true);
            }
          } else {
            barLabel.setText(`ПОДГОТОВКА ПОДРАЗДЕЛЕНИЯ... ${p100}%`);
          }
        } else if (curPct >= 1 && warmDone) {
          barLabel.setText('✓ БОЙЦЫ ГОТОВЫ К БОЮ (100%)');
          barLabel.setColor('#00ff88');
          if (revealed && !finished && !goBtn.visible) {
            hint.setText('Бойцы готовы · жми В БОЙ! или Enter');
            hint.setVisible(true);
            goBtn.setVisible(true);
          }
        }
      }
    });

    // Пошаговый прогрев геометрии, навигации и ИИ ботов (до нажатия «В БОЙ!»)
    warmTimer = scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (finished || warmDone) return;
        try {
          if (warmStep === 0) {
            // Шаг 1: построение графа навигации для обычных бойцов (H_SMALL)
            navMeshGraph(scene, false);
            warmStep = 1;
            targetPct = 0.45;
          } else if (warmStep === 1) {
            // Шаг 2: построение графа навигации для тяжелых бойцов (H_TALL)
            navMeshGraph(scene, true);
            warmStep = 2;
            targetPct = 0.80;
          } else {
            // Шаг 3: прогрев логики ИИ ботов (по 1-2 бота за такт)
            if (aiBots.length > 0 && warmBotIdx < aiBots.length) {
              const b = aiBots[warmBotIdx];
              if (b && b.ai) {
                try { b.ai.update(scene.time ? scene.time.now : 0, 33); } catch (e) {}
              }
              warmBotIdx++;
              targetPct = 0.80 + 0.20 * Math.min(1, warmBotIdx / aiBots.length);
            } else {
              warmDone = true;
              targetPct = 1;
              if (warmTimer) { warmTimer.remove(); warmTimer = null; }
            }
          }
        } catch (eWarm) {
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
    if (!isIntro || (warmDone && curPct >= 1)) {
      hint.setText(byTimer ? 'Enter — в бой' : 'Текст показан · жми В БОЙ! или Enter');
      hint.setVisible(true);
      goBtn.setVisible(true);
    } else {
      hint.setText('Подготовка подразделения к бою...');
      hint.setVisible(true);
      goBtn.setVisible(false);
    }
  };

  const finish = () => {
    if (finished) return;
    // Если игрок нажал «В БОЙ!» раньше завершения прогрева — завершаем прогрев ДО старта матча
    if (!warmDone) {
      try {
        navMeshGraph(scene, false);
        navMeshGraph(scene, true);
        (scene.players || []).forEach(p => {
          if (p && p.isAI && p.ai) {
            try { p.ai.update(scene.time ? scene.time.now : 0, 33); } catch (e) {}
          }
        });
      } catch (eWarm) {}
      warmDone = true;
    }
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
      if (isIntro && (!warmDone || curPct < 1)) return;
      try {
        if (scene.time && scene.time.now - revealT > 800) finish();
      } catch (e) {}
    }
  };

  goBtn.setInteractive({ useHandCursor: true });
  goBtn.on('pointerdown', () => {
    if (isIntro && (!warmDone || curPct < 1)) return;
    finish();
  });
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
    'LAR'
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

  // Пока игрок осваивает управление, подборы и гранату по манекену (шаги 0–3) —
  // враги стоят на страже и не нападают на обучающегося. С шага 4 (уничтожение манекена/зачистка) — вступают в бой.
  if (tut.step < 4 && scene.time) {
    scene.enemiesActiveAt = Math.max(scene.enemiesActiveAt || 0, time + 1200);
  }

  const T = scene.tutorialSpawns;
  const dummyPos = scene.tutDummy ? scene.tutDummy.body.center.x : 680;
  let text = '';
  let marker = false;

  switch (tut.step) {
    case 0:
    text = 'Управление: A/D — движение, W/ПРОБЕЛ — прыжок, S — присесть\nЛКМ — стрелять, R — перезарядка, мышь — прицел';
      if (time - tut.started > 2800) {
        tut.step = 1;
      }
      break;
    case 1:
    text = 'Подбери пистолет! Встань на него и стой (стрельба — ЛКМ).';
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
    text = 'Подбери осколочную гранату: встань на неё и стой.';
      marker = true;
      if (scene.tutMarker) scene.tutMarker.x = T.frag.x;
      if (scene.player.fragGrenades > tut.baseFrag) {
        tut.fragPicked = true;
        tut.step = 3;
      }
      break;
    case 3:
    text = 'Брось гранату по манекену:\nклавиша G (прицелься мышью), дым — H';
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
    text = 'Уничтожь манекен. Стреляй или брось гранату!';
      marker = true;
      if (scene.tutMarker) scene.tutMarker.x = dummyPos;
      if (scene.tutDummy && scene.tutDummy.dead) {
        tut.step = 5;
      }
      break;
    case 5:
    text = 'Осталось два врага. Зачисти уровень!';
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
