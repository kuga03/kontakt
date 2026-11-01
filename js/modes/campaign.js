// campaign.js — кампания: сюжетный экран и обучение (было в GameScene).
// Функции принимают сцену; баннеры/подборы/звуки — через обёртки сцены
// (trackModalElems/hoverSfx/spawnPickup/groundHeightAt), своих импортов нет.
import { gameW } from '../ui/layout.js?v=3';

export function showStory(scene, text, onComplete, btnLabel) {
  let finished = false;
  let revealed = false;
  let revealT = 0;
  text = text || '';
  const t0 = (scene.time && scene.time.now) || 0;
  try { scene.input.setDefaultCursor('default'); } catch (e) {}
  // Зум в 1 на время заставки (интро и аутро): размер текста фиксирован
  // и не зависит от дальности оружия/камеры. Возвращаем в finish.
  try {
    scene._storyPrevZoom = scene.cameras.main.zoom;
    scene.cameras.main.setZoom(1);
    scene._storyOpen = true;
  } catch (e) {}

  // Адаптив: затемнение на всю ширину (центр выставит _trackModalElems
  // сдвигом ox, поэтому x=640, а не середина — иначе двойной сдвиг).
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

  const goBtn = scene.add.text(640, 570, btnLabel || 'В БОЙ!', {
    fontSize: '26px',
    color: '#ffffff',
    backgroundColor: '#287a45',
    padding: 14
  }).setOrigin(0.5).setScrollFactor(0).setDepth(401);
  goBtn.setVisible(false);

  const BAR_W = 420;
  const barBg = scene.add.rectangle(640, 470, BAR_W, 8, 0x333344).setScrollFactor(0).setDepth(401);
  const barFg = scene.add.rectangle(640 - BAR_W / 2, 470, 1, 8, 0x55aaff).setOrigin(0, 0.5).setScrollFactor(0).setDepth(402);
  barFg.setDisplaySize(0, 8);

  const elements = [overlay, titleText, storyText, hint, goBtn, barBg, barFg];
  scene._trackModalElems(elements);
  let chars = 0;

  const typeTimer = scene.time.addEvent({
    delay: 70,
    loop: true,
    callback: () => {
      chars = Math.min(text.length, chars + 3);
      storyText.setText(text.slice(0, chars));
      barFg.setDisplaySize(BAR_W * chars / Math.max(1, text.length), 8);
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
    try { barFg.setDisplaySize(BAR_W, 8); } catch (e) {}
    try { revealT = scene.time ? scene.time.now : 0; } catch (e) {}
    try {
      typeTimer.remove();
      if (scene.typeTimer === typeTimer) scene.typeTimer = null;
    } catch (e) {}
    storyText.setText(text);
    hint.setText(byTimer ? 'Enter — в бой' : 'Текст показан · жми В БОЙ! или Enter');
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
    scene._storyDismiss = null;
    scene._storyKeyHandler = null;
    // Зум назад как был до заставки.
    try {
      scene._storyOpen = false;
      if (Number.isFinite(scene._storyPrevZoom) && scene._storyPrevZoom > 0) {
        scene.cameras.main.setZoom(scene._storyPrevZoom);
      }
    } catch (e) {}
    elements.forEach(e => { try { e.destroy(); } catch (e2) {} });
    try { scene.input.setDefaultCursor('none'); } catch (e) {}
    if (onComplete) onComplete();
  };

  const onDown = () => {
    if (finished) return;
    try {
      if (scene.time && scene.time.now - t0 < 800) return;
    } catch (e) {}
    // Клик мимо кнопки историю не закрывает — только допечатывает.
    if (!revealed) reveal(false);
  };

  const onKey = (event) => {
    if (finished) return;
    const k = event && event.key;
    if (k === 'Escape') return; // ESC сюжет не пропускает
    try {
      if (scene.time && scene.time.now - t0 < 800) return;
    } catch (e) {}
    if (!revealed) {
      reveal(false);
      return;
    }
    // Enter — только после полного показа и с паузой от него.
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

  // Маркер-стрелка над целью учебки (жёлтый треугольник): на месте,
  // путаницу давала золотая заглушка пистолета рядом — её заменили
  // настоящим PNG (см. Pickup).
  scene.tutMarker = scene.add.triangle(
    0, 0, 0, 14, -9, 0, 9, 0, 0xffdd00
  ).setOrigin(0.5).setDepth(21);

  scene.spawnPickup(
    'weapon',
    scene.tutorialSpawns.weapon.x,
    scene.tutorialSpawns.weapon.y,
    'Makarov'
  );
  // Учебные подборы не протухают: иначе медленный игрок теряет кит
  // (у гранат всего 15с) и шаг «подбери» висит вечно.
  // Стоят низом ровно на грунте (коробка 20px — центр на GT-10),
  // а не в воздухе/в земле как раньше.
  try {
    const GTw = scene.mapHeight - 50;
    scene.pickups.getChildren().forEach(pk => {
      if (pk) {
        pk.expires = Infinity;
        pk.y = GTw - 10;
        // Учебное — только своим: боты врага не растащат.
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

  // Пока игрок не подобрал пистолет (шаги 0–1) — враги спят:
  // иначе обстрел безоружного. Хвост 1.5с после подбора для плавности.
  if (tut.step < 2 && scene.time) {
    scene.enemiesActiveAt = Math.max(scene.enemiesActiveAt || 0, time + 1500);
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
        // Учебная: не протухает + выдаётся даже без навыка (см. Pickup).
        // Низом на грунт (арт 39px — центр на GT-19). Только своим.
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
      // Манекен убит раньше подсказки (расстрелял заранее) — бросать
      // не в кого: прыгаем дальше, шаг 4 сам увидит труп и пойдёт к 5.
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
