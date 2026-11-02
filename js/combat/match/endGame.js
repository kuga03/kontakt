import { gameState, addCoins, addExperience, advanceCampaignLevel, saveGameState, getPass } from '../../data/gameState.js?v=172';
import { campaignLevels } from '../../data/levels.js?v=171';

import { checkBattleMedals, awardMedals } from '../../data/medals.js?v=176';
import { drawMedalRow } from '../../ui/medalsView.js?v=9';
import * as Gang from '../../data/gang.js?v=7';
import { recordMutWin } from '../../data/mutators.js?v=2';
import { gameW } from '../../ui/layout.js?v=3';

import { flushPlayTime, playerAfk } from './activity.js';
let _newMedals = [];
export function endGame(scene, message, playerWon = false) {
  // Guard от двойного вызова в одном кадре (флаги + страховка в update):
  // иначе двойные wins++, оверлеи и твины-считалки.
  if (scene.gameOver) return;
  scene.gameOver = true;
  // Демо-бой не фармит профиль: ни статистики, ни монет, ни истории.
  const demo = !!(scene.player && scene.player._demoPuppet);
  // АФК-метка на конец боя (трекинг в update останавливается gameOver выше,
  // счётчики застывают — считаем по ним). Дальше: ворота бонуса + тег в табло.
  scene._playerAfk = playerAfk(scene);
  // Боевые награды СРАЗУ (нужны записи истории ниже): проверка + выдача
  // (АФК и кампания — мимо, см. medals.js).
  _newMedals = [];
  try {
    const _ids = checkBattleMedals(scene, playerWon);
    if (_ids.length && !demo) _newMedals = awardMedals(_ids);
  } catch (e) {}
  // Снимаем носильщиков (флаги/бомбы/турель): иначе указатели висят на телах,
  // баффы скорости и метки остаются, маркеры зависают.
  try {
    const T0 = scene._turret;
    if (T0 && T0.carrier) { try { T0.carrier.isCarrier = false; } catch (e) {} T0.carrier = null; }
    try { if (T0 && T0.installMark) { T0.installMark.destroy(); T0.installMark = null; } } catch (e) {}
    try { if (T0 && T0.mark) { T0.mark.destroy(); T0.mark = null; } } catch (e) {}
    [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag, scene.blueBomb, scene.redBomb].forEach(f => {
      if (!f) return;
      const c = f.carrier;
      if (c) {
        try { c.isCarrier = false; } catch (e) {}
        try { c.moveSpeedPct = (c.moveSpeedPct || 0); } catch (e) {}
        try { c._plant = {}; } catch (e) {}
      }
      f.carrier = null;
      if (f._mark) {
        try { f._mark.destroy(); } catch (e) {}
        f._mark = null;
      }
      if (f._defMark) {
        try { f._defMark.destroy(); } catch (e) {}
        f._defMark = null;
      }
    });
  } catch (e) {}
  // Счётчик возрождения под модалкой не нужен.
  try {
    if (scene._respawnTxt) { scene._respawnTxt.destroy(); scene._respawnTxt = null; }
    scene._respawnAt = 0;
  } catch (e) {}
  // Победы/поражения в статистику + неделю (меню v2).
  try {
    if (!demo) {
      const st = gameState.stats;
      if (st) {
        if (playerWon) {
          st.wins = (st.wins | 0) + 1;
          const ps = getPass();
          ps.wins = (ps.wins | 0) + 1;
        } else {
          st.losses = (st.losses | 0) + 1;
        }
      }
    }
  } catch (e) {}
  // История боёв для вкладки «Другое» (пишется один раз — guard выше).
  // Демо-бои в историю и процент побед не пишем.
  // Тариф урона — до записи истории: +1 монета за каждые 25 урона,
  // потолок 120/бой. Кампанию не трогаем (там фикс. награды миссий),
  // песочницу — тоже (там вообще без монет).
  if (!demo && scene.mode !== 'CAMPAIGN' &&
      (!scene.botDifficulty || scene.botDifficulty.id !== 'sandbox') &&
      (scene.mode === 'FFA' || scene.mode === 'TDM' || scene.mode === 'TRIAL' ||
       scene.mode === 'CTF' || scene.mode === 'BOMB' || scene.mode === 'KOTH')) {
    try {
      const pdmg = (scene.player && scene.player.damageDealt) || 0;
      const dmgCoins = Math.min(120, Math.floor(pdmg / 25));
      if (dmgCoins > 0) {
        scene.matchCoins = (scene.matchCoins || 0) + dmgCoins;
        addCoins(dmgCoins);
      }
    } catch (e) {}
  }
  if (!demo) recordMatch(scene, playerWon);
  // Сюжетная миссия: победа двигает кампанию и даёт награду уровня
  // (иначе миссии игрались бы как свободные бои без прогресса).
  // Поражение — просто поражение, ретрай ниже перезапускает миссию.
  if (scene.campaignMission && playerWon && !demo) {
    try {
      const clm = scene.campaignMission;
      addCoins((clm.reward && clm.reward.coins) || 0);
      addExperience((clm.reward && clm.reward.experience) || 0);
      const st = gameState.stats;
      if (st) st.campaignWins = (st.campaignWins | 0) + 1;
      advanceCampaignLevel();
    } catch (e) {}
  }
  flushPlayTime(scene);
  scene._resetCamForModal();
  scene.physics.pause();
  scene.input.setDefaultCursor('default');

  // Итог победы (п.36): «Имя победил», ниже — строка монет со значком и
  // строка опыта с геометрическим значком; цифры считаются в 2 раза медленнее.
  // Фон итогов: затемнение + панель. Раскладка потоком от заголовка:
  // длинное название (волна/фраги/время) не вылезает за панель.
  const overlay = scene.add.rectangle(640, 360, gameW(scene), 720, 0x000000, 0.72)
    .setScrollFactor(0).setDepth(199);

  let xp = 0;
  let xpNote = '';
  // Бонус за победу (раньше платили только киллы: поражение с 20 фрагами
  // давало больше победы с 18 — победа была бессмысленна экономически).
  // Выдача один раз (endGame защищён от двойного вызова выше).
  // Ворота АФК: столбу без ввода бонус не положен (тег — в табло команд).
  if (playerWon && !demo && !scene._playerAfk &&
      (scene.mode === 'FFA' || scene.mode === 'TDM' || scene.mode === 'CTF' || scene.mode === 'BOMB' || scene.mode === 'KOTH')) {
    // Песочница: победа без монет (опыт и так только трём сложностям).
    if (!scene.botDifficulty || scene.botDifficulty.id !== 'sandbox') {
      scene.matchCoins = (scene.matchCoins || 0) + 150;
      try { addCoins(150); } catch (e) {}
    }
    const diffId = scene.botDifficulty?.id;
    const winXp = diffId === 'novice' ? 15 : 60;
    if (diffId === 'experienced' || diffId === 'veteran' || diffId === 'novice') {
      scene.matchXP = (scene.matchXP || 0) + winXp;
      try { addExperience(winXp); } catch (e) {}
    }
  }
  // Банда (п.14.6): ранения/смерть/уровни/влияние/бонус контракта — до снапшота
  // coins/xp ниже (settle сам докручивает matchCoins/matchXP).
  let _gangLine = '';
  try {
    if (!demo && (scene.mode === 'TDM' || scene.mode === 'CTF' || scene.mode === 'BOMB' || scene.mode === 'KOTH')) {
      _gangLine = Gang.settleBattle(scene, playerWon) || '';
      scene._gangLine = _gangLine;
    }
  } catch (e) { _gangLine = ''; }
  // Мутаторы (п.14.2): счётчик побед + 500 за первую в выходные — до снапшота.
  let _mutLine = '';
  try {
    if (!demo) _mutLine = (recordMutWin(scene, playerWon).line) || '';
  } catch (e) { _mutLine = ''; }
  const coins = (scene.mode === 'FFA' || scene.mode === 'TDM' || scene.mode === 'TRIAL' || scene.mode === 'CTF' || scene.mode === 'BOMB' || scene.mode === 'KOTH') ? (scene.matchCoins || 0) : 0;
  // Калибровочный лог медалей (итоговые цифры — после всех начислений).
  // Медали (k218): компактная строка в консоль — что именно открыто в бою.
  if (_newMedals.length) {
    try { console.info('[MEDALS]', _newMedals.join(' ')); } catch (e) {}
  }
  if (scene.mode === 'FFA' || scene.mode === 'TDM' || scene.mode === 'TRIAL' || scene.mode === 'CTF' || scene.mode === 'BOMB' || scene.mode === 'KOTH') {
    const diffId = scene.botDifficulty?.id;
    if (diffId === 'experienced' || diffId === 'veteran' || diffId === 'novice') {
      xp = scene.matchXP || 0;
    } else if (diffId === 'sandbox') {
      xpNote = 'Песочница: наград нет';
    } else {
      xpNote = 'Опыт можно получить на сложности «Бывалый» и выше';
    }
  }

  // Итог матча — исход для игрока, без бейджей: моя команда победила —
  // «ПОБЕДА», вражеская — «ПОРАЖЕНИЕ». Поражение — красным.
  let titleStr = message, titleBadge = null;
  if (/^(Синие победили|Красные победили)/.test(message) || /победил$/.test(message)) {
    titleStr = playerWon ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
  }
  const titleText = scene.add.text(640, 170, titleStr, {
    fontSize: '34px', color: titleStr === 'ПОРАЖЕНИЕ' ? '#ff6666' : '#ffff55', align: 'center'
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);
  // Автоподгонка ширины под панель (макс. 520).
  let _fs = 34;
  titleText.setFontSize(_fs);
  while (titleText.displayWidth > 440 && _fs > 20) {
    _fs -= 2;
    titleText.setFontSize(_fs);
  }
  // Бейджа-щита больше нет (исход текстом) — заголовок всегда по центру.
  let titleBadgeImg = null;

  const coinY = 170 + titleText.displayHeight + 32;
  const coinIcon = scene.add.image(560, coinY, 'icon_coins').setScrollFactor(0).setDepth(200);
  if (scene.textures.exists('icon_coins')) coinIcon.setDisplaySize(30, 23);
  const coinText = scene.add.text(585, coinY, '+0', {
    fontSize: '30px', color: '#ffee88', fontStyle: 'bold'
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(200);

  // Значок опыта — геометрия (ромб-звезда), PNG нет.
  const xpY = coinY + 52;
  const xpIcon = scene.add.graphics().setScrollFactor(0).setDepth(200);
  xpIcon.fillStyle(0x88ccff, 1);
  xpIcon.fillPoints([
    new Phaser.Geom.Point(560 - 12, xpY), new Phaser.Geom.Point(560, xpY - 12),
    new Phaser.Geom.Point(560 + 12, xpY), new Phaser.Geom.Point(560, xpY + 12)
  ], true);
  xpIcon.lineStyle(2, 0xddf2ff, 1);
  xpIcon.strokePoints([
    new Phaser.Geom.Point(560 - 12, xpY), new Phaser.Geom.Point(560, xpY - 12),
    new Phaser.Geom.Point(560 + 12, xpY), new Phaser.Geom.Point(560, xpY + 12)
  ], true);
  const xpText = scene.add.text(585, xpY, xpNote || '+0', {
    fontSize: xpNote ? '16px' : '30px', color: '#88ccff', fontStyle: 'bold',
    wordWrap: { width: 280 }
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(200);

  // Поток вниз от наград: сначала аутро миссии (замеряем высоту),
  // потом кнопки. Раньше аутро рисовалось поверх строки опыта
  // (btnTop-64 при строке на btnTop-52), а «Следующая миссия»
  // вылезала за панель — текст сливался с наградами.
  let flowY = xpY + 52;
  let outroText = null;
  // Блок наград: заголовок + рисованные медальки (тишина, если пусто).
  if (_newMedals.length) {
    try {
    const mt = scene.add.text(640, flowY, 'НАГРАДЫ', {
      fontSize: '16px', color: '#ffd24a', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    flowY += mt.displayHeight + 8;
  // medalsView возвращает { h, objs } (объекты чистит рестарт сцены).
  // Медальки влетают лесенкой (pop-in с Back — красиво, а не текстом).
  const _mr = drawMedalRow(scene, 640, flowY, _newMedals);
  flowY += (_mr.h || 0) + 8;
  // Адаптив: заголовок и медальки — в модальный сдвиг (иначе на широком
  // экране остаются на x=640, а панель уезжает на центр).
  try { scene._trackModalElems([mt, ...((_mr && _mr.objs) || [])]); } catch (e) {}
  try {
    ((_mr && _mr.objs) || []).forEach((o, i) => {
      if (!o) return;
      try { o.setScale(0.01); } catch (e) {}
      scene.tweens.add({ targets: o, scaleX: 1, scaleY: 1, duration: 380, delay: 900 + i * 130, ease: 'Back.easeOut' });
    });
  } catch (e) {}
    } catch (e) {}
  }
  if (scene.campaignMission && playerWon) {
    const outro = scene.campaignMission.storyOutro;
    if (outro) {
      outroText = scene.add.text(640, flowY, outro, {
        fontSize: '15px', color: '#aaccff', align: 'center',
        wordWrap: { width: 440 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
      flowY += outroText.displayHeight + 20;
      // Адаптив: в модальный сдвиг (иначе текст остаётся на x=640).
      try { scene._trackModalElems([outroText]); } catch (e) {}
    }
  }
  // Строка опыта бандитов в итогах (п.14.6) + строка мутаторов (п.14.2).
  let gangText = null;
  const _footLine = [_gangLine, _mutLine].filter(Boolean).join('\n');
  if (_footLine) {
    try {
      gangText = scene.add.text(640, flowY, _footLine, {
        fontSize: '14px', color: '#c0ffd0', align: 'center',
        wordWrap: { width: 440 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
      flowY += gangText.displayHeight + 12;
    } catch (e) { gangText = null; }
  }
  // Панель под измеренный контент (рисуется после замера, depth ниже).
  const btnTop = flowY;

  // Считалки в 2 раза медленнее (было 900мс → 1800мс).
  const coinCounter = { v: 0 };
  scene.tweens.add({
    targets: coinCounter, v: coins, duration: 1800, ease: 'Cubic.Out',
    onUpdate: () => coinText.setText(`+${Math.round(coinCounter.v)}`)
  });
  if (!xpNote) {
    const xpCounter = { v: 0 };
    scene.tweens.add({
      targets: xpCounter, v: xp, duration: 1800, delay: 300, ease: 'Cubic.Out',
      onUpdate: () => xpText.setText(`+${Math.round(xpCounter.v)}`)
    });
  }

  const retryBtn = scene.add.text(640, btnTop, 'Начать заново', {
    fontSize: '24px',
    color: '#ffffff',
    backgroundColor: '#287a45',
    padding: 14
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);

  retryBtn.setInteractive({ useHandCursor: true });
  retryBtn.on('pointerover', () => { retryBtn.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
  retryBtn.on('pointerout', () => retryBtn.setStyle({ color: '#ffffff' }));
  retryBtn.on('pointerdown', () => {
    scene.scene.restart();
  });

  // Сюжетная миссия: кнопка перехода дальше (победа, не последний уровень).
  // Следующий уровень сам резолвит свой режим через оверрайд в create.
  // Аутро уже показано выше кнопок (замерено заранее).
  let nextBtn = null;
  if (scene.campaignMission && playerWon) {
    try {
      // Дальше — только встроенные миссии (свои уровни — отдельно).
      const isLast = scene.levelIndex >= campaignLevels.length - 1;
      if (!isLast) {
        nextBtn = scene.add.text(640, btnTop + 152, 'Следующая миссия', {
          fontSize: '24px',
          color: '#ffffff',
          backgroundColor: '#287a45',
          padding: 14
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
        nextBtn.setInteractive({ useHandCursor: true });
        nextBtn.on('pointerover', () => { nextBtn.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
        nextBtn.on('pointerout', () => nextBtn.setStyle({ color: '#ffffff' }));
        nextBtn.on('pointerdown', () => {
          scene.scene.start('GameScene', {
            mode: 'CAMPAIGN',
            selectedClass: scene.selectedClass,
            levelIndex: scene.levelIndex + 1,
            playerName: scene.playerName
          });
        });
        if (scene.victoryElems) scene.victoryElems.push(nextBtn);
        else scene.victoryElems = [nextBtn];
        scene._trackModalElems([nextBtn]);
      }
    } catch (e) {}
  }

  const menuBtn = scene.add.text(640, btnTop + 76, 'Выйти в меню', {
    fontSize: '20px',
    color: '#ffffff',
    backgroundColor: '#553333',
    padding: 12
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);

  menuBtn.setInteractive({ useHandCursor: true });
  menuBtn.on('pointerover', () => { menuBtn.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
  menuBtn.on('pointerout', () => menuBtn.setStyle({ color: '#ffffff' }));
  menuBtn.on('pointerdown', () => scene.scene.start('MenuScene'));



  // Панель под измеренный контент: от верха заголовка до низа кнопок
  // (включая «Следующую миссию» — она раньше торчала наружу).
  let panelBottom = btnTop + 76 + (menuBtn.displayHeight || 40);
  panelBottom = Math.max(panelBottom, btnTop + 132 + 44);
  panelBottom = Math.max(panelBottom, btnTop + 188 + 40);
  if (nextBtn) panelBottom = Math.max(panelBottom, btnTop + 152 + (nextBtn.displayHeight || 48));
  panelBottom += 24;
  const panelTop = 140;
const panelFill = playerWon ? 0x111133 : 0x181020;
const panel = scene.add.rectangle(640, (panelTop + panelBottom) / 2, 480, panelBottom - panelTop, panelFill, 0.96)
.setScrollFactor(0).setDepth(199);
// Рамка по исходу: победа — золото, поражение — тёмно-красная (была одна на всех).
panel.setStrokeStyle(3, playerWon ? 0xffd24a : 0x8a2020, 1);

  // Боковые таблы команд (TDM/CTF/KOTH/BOMB): слева моя, справа противника.
  // Полупрозрачные, у каждого строка + статы боя как в TAB.
  const sideElems = [];
  if (scene.mode === 'TDM' || scene.mode === 'CTF' || scene.mode === 'KOTH' || scene.mode === 'BOMB') {
    sideElems.push(...scene._endGameTeamBoard(true), ...scene._endGameTeamBoard(false));
  }

  // Салют итога (окно было голым): плавное затемнение, влет заголовка,
  // свечение надписи, победа — золотое конфетти, поражение — красные искры
// вверх + тряска заголовка, кнопки лесенкой, панч монетки в конце
// считалки, мягкая подсветка, вторая волна салюта,
// вспышка монетки, pop-in медалей, тлеющая пыль. Всё одноразовое;
// объекты — в общий cleanup.
  const _fxElems = [];
  try {
    try {
      overlay.setAlpha(0);
      scene.tweens.add({ targets: overlay, alpha: 0.72, duration: 350 });
    } catch (e) {}
    try {
      const _ty = titleText.y;
      titleText.y = _ty - 40;
      titleText.setAlpha(0);
      scene.tweens.add({ targets: titleText, y: _ty, alpha: 1, duration: 500, ease: 'Back.easeOut' });
      // Свечение надписи: цветная тень + плавный пульс размытия.
      try {
        const gc2 = playerWon ? '#ffd24a' : '#ff3333';
        titleText.setShadow(0, 0, gc2, 16, true, true);
        const sh = { b: 16 };
        scene.tweens.add({
          targets: sh, b: 26, duration: 1200, ease: 'Sine.easeInOut', yoyo: true, repeat: 2,
          onUpdate: () => { try { titleText.setShadow(0, 0, gc2, Math.round(sh.b), true, true); } catch (e) {} }
        });
      } catch (e) {}
    } catch (e) {}
    try {
      const N = playerWon ? 42 : 24;
      const cols = playerWon ? [0xffd24a, 0xffffff, 0xff9a3c, 0xfff2b0] : [0xff5555, 0x7a1e1e, 0xff9a8a];
      for (let i = 0; i < N; i++) {
        const r = scene.add.rectangle(
          440 + Math.random() * 400, 130 + Math.random() * 60,
          3 + Math.random() * 5, 4 + Math.random() * 6,
          cols[(Math.random() * cols.length) | 0]
        ).setScrollFactor(0).setDepth(202).setAngle(Math.random() * 360);
        _fxElems.push(r);
        const dy = playerWon ? (260 + Math.random() * 260) : -(140 + Math.random() * 160);
        scene.tweens.add({
          targets: r, y: r.y + dy, angle: r.angle + (Math.random() * 360 - 180),
          alpha: 0.5, duration: 1300 + Math.random() * 900, delay: Math.random() * 450, ease: 'Cubic.Out',
          onComplete: () => { try { r.destroy(); } catch (e) {} }
        });
      }
    } catch (e) {}
    // Красивое свечение без граней: запечённая радиальная текстура
    // (настоящий градиент — края тают в ноль). Победа — яркая тёплая,
    // поражение — приглушённая. Плавно вдох/выдох + лёгкое дыхание.
    try {
      const gk = playerWon ? 'fx_glow_win' : 'fx_glow_lose';
      if (!scene.textures.exists(gk)) {
        const _gc = scene.textures.createCanvas(gk, 256, 256);
        if (_gc && _gc.context) {
          const _c2 = _gc.context;
          const _col = playerWon ? '255,214,90' : '255,90,90';
          const _gr = _c2.createRadialGradient(128, 128, 8, 128, 128, 128);
          _gr.addColorStop(0, 'rgba(' + _col + ',0.6)');
          _gr.addColorStop(0.45, 'rgba(' + _col + ',0.24)');
          _gr.addColorStop(1, 'rgba(' + _col + ',0)');
          _c2.fillStyle = _gr;
          _c2.fillRect(0, 0, 256, 256);
          try { _gc.refresh(); } catch (e) {}
        }
      }
      if (scene.textures.exists(gk)) {
        const glowImg = scene.add.image(640, 185, gk).setScrollFactor(0).setDepth(199);
        glowImg.setDisplaySize(520, 200);
        glowImg.setAlpha(0);
        _fxElems.push(glowImg);
        const peak = playerWon ? 0.85 : 0.5;
        scene.tweens.add({ targets: glowImg, alpha: peak, scaleX: 1.03, scaleY: 1.05, duration: 900, ease: 'Sine.easeOut',
          onComplete: () => { try {
            scene.tweens.add({ targets: glowImg, alpha: 0, duration: 2000, ease: 'Sine.easeIn',
              onComplete: () => { try { glowImg.destroy(); } catch (e) {} } });
          } catch (e) {} } });
      }
    } catch (e) {}
  // Вторая волна салюта с задержкой: победа — золотая осыпь сверху,
  // поражение — тлеющие угли вверх.
  try {
    const N2 = playerWon ? 22 : 14;
    const cols2 = playerWon ? [0xffe066, 0xffffff, 0xffc44d] : [0xff6a4d, 0xa32e1e, 0xffb08a];
    for (let i = 0; i < N2; i++) {
      const r2 = scene.add.rectangle(
        460 + Math.random() * 360, playerWon ? 60 + Math.random() * 40 : 300 + Math.random() * 120,
        2 + Math.random() * 4, 3 + Math.random() * 5,
        cols2[(Math.random() * cols2.length) | 0]
      ).setScrollFactor(0).setDepth(202).setAngle(Math.random() * 360);
      _fxElems.push(r2);
      scene.tweens.add({
        targets: r2, y: r2.y + (playerWon ? 200 + Math.random() * 200 : -(120 + Math.random() * 140)),
        angle: r2.angle + (Math.random() * 360 - 180), alpha: 0.4,
        duration: 1400 + Math.random() * 800, delay: 650 + Math.random() * 500, ease: 'Cubic.Out',
        onComplete: () => { try { r2.destroy(); } catch (e) {} }
      });
    }
  } catch (e) {}
  // Вспышка у монетки в конце считалки (считалка ~1800мс).
  try {
    scene.time.delayedCall(1950, () => {
      try {
        if (!scene.sys.isActive()) return;
        for (let i = 0; i < 10; i++) {
          const sp = scene.add.circle(560, coinY, 2 + Math.random() * 2, 0xffe066, 1).setScrollFactor(0).setDepth(203);
          _fxElems.push(sp);
          const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 30;
          scene.tweens.add({
            targets: sp, x: sp.x + Math.cos(a) * d, y: sp.y + Math.sin(a) * d,
            alpha: 0, duration: 500 + Math.random() * 300, ease: 'Cubic.Out',
            onComplete: () => { try { sp.destroy(); } catch (e) {} }
          });
        }
      } catch (e) {}
    });
  } catch (e) {}
  // Тлеющая пыль за окном: медленный дрейф, гаснет сама.
  try {
    const mc = playerWon ? 0xffd98a : 0xff8a7a;
    for (let i = 0; i < 10; i++) {
      const m = scene.add.circle(420 + Math.random() * 440, 140 + Math.random() * 420, 1.5 + Math.random() * 1.5, mc, 0.5).setScrollFactor(0).setDepth(198);
      _fxElems.push(m);
      scene.tweens.add({
        targets: m, x: m.x + (Math.random() * 60 - 30), y: m.y + (Math.random() * 50 - 25),
        alpha: 0.15, duration: 2200 + Math.random() * 1200, delay: Math.random() * 600,
        yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
        onComplete: () => { try { m.destroy(); } catch (e) {} }
      });
    }
  } catch (e) {}
  if (!playerWon) {
      try { scene.tweens.add({ targets: titleText, angle: 2.5, duration: 80, yoyo: true, repeat: 3 }); } catch (e) {}
    }
    try {
      [retryBtn, menuBtn].concat(nextBtn ? [nextBtn] : []).forEach((b, i) => {
        if (!b) return;
        const by = b.y;
        b.setAlpha(0);
        b.y = by + 16;
        scene.tweens.add({ targets: b, alpha: 1, y: by, duration: 320, delay: 250 + i * 90, ease: 'Cubic.Out' });
      });
    } catch (e) {}
    try {
      // Тряска монетки и значка опыта ВО ВРЕМЯ счёта (~1800мс), не после:
      // дрожание затухает к концу, иконки встают ровно на место.
      try {
        const shaker = { t: 0 };
        const cx0 = coinIcon.x, cy0 = coinIcon.y;
        scene.tweens.add({
          targets: shaker, t: 1, duration: 1800, ease: 'Linear',
          onUpdate: () => {
            try {
              const s = 1 - shaker.t * 0.7;
              coinIcon.x = cx0 + (Math.random() - 0.5) * 5 * s;
              coinIcon.y = cy0 + (Math.random() - 0.5) * 5 * s;
              xpIcon.x = (Math.random() - 0.5) * 5 * s;
              xpIcon.y = (Math.random() - 0.5) * 5 * s;
            } catch (e) {}
          },
          onComplete: () => {
            try { coinIcon.x = cx0; coinIcon.y = cy0; xpIcon.x = 0; xpIcon.y = 0; } catch (e) {}
          }
        });
      } catch (e) {}
    } catch (e) {}
  } catch (e) {}

  if (scene.victoryElems) scene.victoryElems.push(overlay, panel, titleText, coinIcon, coinText, xpIcon, xpText, retryBtn, menuBtn, ...sideElems, ..._fxElems);
  else scene.victoryElems = [overlay, panel, titleText, coinIcon, coinText, xpIcon, xpText, retryBtn, menuBtn, ...sideElems, ..._fxElems];
  if (outroText) scene.victoryElems.push(outroText);
  if (gangText) scene.victoryElems.push(gangText);
  if (nextBtn && !scene.victoryElems.includes(nextBtn)) scene.victoryElems.push(nextBtn);
  if (titleBadgeImg) {
    scene.victoryElems.push(titleBadgeImg);
    scene._trackModalElems([titleBadgeImg]);
  }
  scene._trackModalElems([overlay, panel, titleText, coinIcon, coinText, xpIcon, xpText, retryBtn, menuBtn, ...sideElems, ..._fxElems]);
  if (gangText) scene._trackModalElems([gangText]);

  scene.input.keyboard.once('keydown-ESC', () => {
    scene.scene.start('MenuScene');
  });
}

// Снимок матча в историю боёв (последние 20): режим, счёт,
// таблицы обеих команд и моё место в команде.
// Кампания не пишется (решение автора); испытание — волной без поражения.
export function recordMatch(scene, playerWon) {
  try {
    try {
      // Недельный контракт «бои»: любой доигранный матч (кроме демо).
      if (!(scene.player && scene.player._demoPuppet)) {
        const ps = getPass();
        ps.matches = (ps.matches | 0) + 1;
      }
    } catch (e) {}
    // Процент побед — только матчи на Бывалом и выше (кроме испытания:
    // там в любом случае умираешь, это не поражение).
    // Считается и для кампании — до раннего return ниже.
    if (scene.mode !== 'TRIAL') {
      const diffId = scene.mode === 'CAMPAIGN' ? gameState.campaignDifficulty : gameState.freeDifficulty;
      // Бои и победы по классам (витрина меню + статистика).
      // Матчи — все, победы — как общий счёт: только Бывалый и выше.
      try {
        const st = gameState.stats || (gameState.stats = {});
        const cls = scene.selectedClass || 'Assault';
        st.matchesByClass = (st.matchesByClass && typeof st.matchesByClass === 'object') ? st.matchesByClass : {};
        st.winsByClass = (st.winsByClass && typeof st.winsByClass === 'object') ? st.winsByClass : {};
        st.matchesByClass[cls] = (st.matchesByClass[cls] | 0) + 1;
        if ((diffId === 'experienced' || diffId === 'veteran') && playerWon) {
          st.winsByClass[cls] = (st.winsByClass[cls] | 0) + 1;
        }
      } catch (e) {}
      if (diffId === 'experienced' || diffId === 'veteran') {
        if (playerWon) gameState.expWins = (gameState.expWins | 0) + 1;
        else gameState.expLosses = (gameState.expLosses | 0) + 1;
      }
      // Матчи пишем всегда (сейв тоже всегда — иначе новички теряются).
      saveGameState();
    }
    if (scene.mode === 'CAMPAIGN') return;
    const snap = p => ({
      name: p.playerName || '?',
      team: p.team,
      cls: (p.constructor && p.constructor.name) || null,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      dmg: p.damageDealt || 0,
      me: p === scene.player
    });
    const byKills = (x, y) => y.kills - x.kills;
    const entry = {
      t: Date.now(),
      mode: scene.mode,
      source: 'single',
      won: !!playerWon,
      afk: !!scene._playerAfk,
      medals: (_newMedals || []).slice(),
      obj: Object.assign({}, scene._objStats),
      scoreBlue: scene.scores ? (scene.scores.blue | 0) : 0,
      scoreRed: scene.scores ? (scene.scores.red | 0) : 0,
      limit: scene.scoreLimit | 0,
      coins: scene.matchCoins | 0,
      xp: scene.matchXP | 0,
      myPlace: null
    };
    if (scene.mode === 'FFA') {
      entry.all = scene.players.map(snap).sort(byKills);
      const me = entry.all.findIndex(r => r.me);
      if (me >= 0) entry.myPlace = me + 1;
    } else if (scene.mode === 'TRIAL') {
      // Испытание: состав не важен — волна, фраги и рекорд.
      entry.trial = scene._trialResult || null;
      entry.blue = [];
      entry.red = [];
    } else {
      entry.blue = scene.players.filter(p => p.team === 'blue').map(snap).sort(byKills);
      entry.red = scene.players.filter(p => p.team === 'red').map(snap).sort(byKills);
      const myList = scene.player.team === 'blue' ? entry.blue : entry.red;
      const me = myList.findIndex(r => r.me);
      if (me >= 0) entry.myPlace = me + 1;
    }
    gameState.matchHistory = gameState.matchHistory || [];
    gameState.matchHistory.unshift(entry);
    if (gameState.matchHistory.length > 20) gameState.matchHistory.length = 20;
    saveGameState();
  } catch (e) {}
}

export function matchOver(scene, dur, time) {
  try {
    if (!scene._modeT0loop || !dur) return false;
    return time > scene._modeT0loop + dur && time - scene._modeT0loop > 45000;
  } catch (e) { return false; }
}

export function matchLeft(scene, dur, time) {
  try {
    if (!scene._modeT0loop || !dur) return null;
    return Math.max(0, scene._modeT0loop + dur - time);
  } catch (e) { return null; }
}

// Таймер TDM (счёт — строкой выше, как у остальных).
