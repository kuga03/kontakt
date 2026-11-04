

import { RIG_DEFAULTS } from '../../../data/rigConfig.js?v=169';
import { poseArm } from './arms.js?v=396';
import { anchorFor, flipX } from './shoes.js';
import { GEO_HUMAN, partCfg, targetH } from './config.js';
import { legIK, playStep, setBone } from './legs.js';
export function updateParts(player) {
  const grounded = player.body.blocked.down || player.body.touching.down || !!player._editorGrounded;
  // k463: подгонка хитбокса, когда части рига уже расставлены (на втором
  // кадре). В конструкторе рига ещё нет, и ширина падала в фолбэк 30*k —
  // тело оставалось вдвое шире фигуры.
  try {
    player._rigTicks = (player._rigTicks || 0) + 1;
    if (player._rigTicks === 2) player._applyHitbox();
    // k463: доводка X-центровки тела. Тело сдвигается на часть ошибки за
    // кадр (offset в пикселях кадра), поэтому идём до сходимости ≤1px.
    if (player._hbFit > 0) {
      player._hbFit--;
      const pb = player.body;
      if (pb) {
        const wantX = player.x - pb.width / 2;
        const dX = wantX - pb.x;
        // k466 (ОТКАЧЕНО по Y): выравнивание низа тела по низу КАДРА. В
        // headless текстуры рига — заглушки, «низ кадра» не равен низу
        // нарисованного персонажа: тело уехало вниз на 40px (персонаж всплыл).
        // Для Y нужен замер в браузере, иначе правим вслепую.
        if (Math.abs(dX) > 1) pb.setOffset(pb.offset.x + dX, pb.offset.y);
        else player._hbFit = 0;
      }
    }
  } catch (e) {}

  // k475 (ОТКАЧЕНО): замер коэффициента offset→мир одним пробным сдвигом.
  // Результат нестабилен (ky = 4.03 и 1.1 в разных замерах): между кадрами
  // тело двигает ещё и физика, поэтому дельта — не чистый эффект offset.
  // Для честного замера нужно тело в покое и снимок ДО/ПОСЛЕ одного шага
  // без гравитации. Долг (см. docs §16.7): сделать такой замер.

  const frameMove = Math.abs(player.x - (player._lastPartX ?? player.x));
  player._lastPartX = player.x;
  player._moveEMA = player._moveEMA === undefined
    ? frameMove
    : player._moveEMA * 0.6 + frameMove * 0.4;
  // Движение — по скорости (px/s), а не по пикселям за кадр: иначе на
  // 75+ Гц медленный присед даёт <1.2px/кадр и ноги мёртво стоят.
  const spdX = player.body ? Math.abs(player.body.velocity.x) : 0;
  const moving = grounded && spdX > 30;
  if (moving) {
    player._walkFrames = (player._walkFrames || 0) + 1;
  } else {
    player._walkFrames = 0;
  }
  const walking = player._walkFrames >= 3 || !!player._netMoving;
  const airborne = !grounded;
  player._partsDbg = {
    ver: 'v5',
    ema: +player._moveEMA.toFixed(2),
    wf: player._walkFrames,
    walking,
    airborne,
    grounded,
    frameMove: +frameMove.toFixed(2)
  };

  const t = player.scene.time.now;
  const crouch = player.crouching;

  const side = player._getSide();
  const pdt = (player.scene.game.loop && player.scene.game.loop.delta) || 16;
  // Приземление: фиксируем момент и скорость падения (сквош + пыль).
  const vyNow = player.body ? player.body.velocity.y : 0;
  const wasAir = !!player._wasAir;
  player._wasAir = airborne;
  if (wasAir && !airborne) {
    player._landAt = t;
    player._landFall = Math.abs(player._landVy || 0);
    if (player._landFall > 350 && player.scene && typeof player.scene.spawnImpact === 'function') {
      try {
        const gb = player.body ? player.body.bottom : player.y;
        player.scene.spawnImpact(player.x, gb - 4, 0x9a9a9a, 6);
      } catch (e) {}
    }
  }
  player._landVy = vyNow;
  // Сквош приземления (220мс) + антиципация прыжка (130мс): таз ходит.
  let squash = 0;
  if (player._landAt && t - player._landAt < 220 && !airborne) {
    squash = 7 * (1 - (t - player._landAt) / 220);
  }
  let ant = 0;
  if (player._jumpAt && t - player._jumpAt < 130) {
    ant = 5 * (1 - (t - player._jumpAt) / 130);
  }

  // скелет: таз жёстко привязан к ступням, поэтому тело не «ездит» вверх/вниз.
  // Размеры для скелета ограничены диапазоном — нелепый сохранённый s не разносит тело
  // Если обувь «в арте» (baked) — ноги уже с ботинками, отдельной высоты ботинка нет
  const legsShoeCfg = partCfg(player, 'shoes');
  const legH = Phaser.Math.Clamp(targetH(player, 'legs') || 26, 12, 40);
  const shoeH = legsShoeCfg.baked
    ? 0
    : Phaser.Math.Clamp(targetH(player, 'shoes') || 8, 4, 28);
  // Низ хитбокса — опора стоп. Берём живой body.bottom, а не player.y+30:
  // хитбокс масштабируется от размеров рига (k), константа врала бы при
  // нестандартных размерах и персонаж висел бы над землёй.
  const bodyBottom = player.body ? player.body.bottom : player.y + 30;
  const hipY = bodyBottom - legH - shoeH / 2 + (crouch ? 12 : 0);

  // Процедурная фаза ходьбы/бега скелета: один цикл = 24 «кадра» при скорости fps кадров/сек.
  // При движении задом наперёд (противоположно взгляду) фаза крутится обратно — шаги физичны.
  // В беге (run) темп заметно выше — шаги «молотящие», поэтому фаза крутится быстрее.
  const lcfg = partCfg(player, 'legs');
  // Форсированный режим анимации (редактор превью): показывает именно
  // выбранный набор параметров walk/run/crouch, а не текущий по состоянию.
  const run = (player._runOverride === true || player._runOverride === false)
    ? player._runOverride
    : (lcfg.run !== false);
  // Режим-зависимые параметры анимации: если заданы _animModes[mode],
  // они перезаписывают базовые fps/bob/swing/lift/knee/hip.
  const animMode = player._animOverride || (crouch ? 'crouch' : (run ? 'run' : 'walk'));
  // В присяде — всегда форма шага, а не бега: у бега есть фаза полёта
  // (обе стопы в воздухе, таз вверх) — присед так подпрыгивает/виснет.
  // Форсированный показ бега в редакторе — исключение.
  const runG = (crouch && player._runOverride !== true) ? false : run;
  const am = lcfg._animModes && lcfg._animModes[animMode];
  const acfg = am ? Object.assign({}, lcfg, am) : lcfg;
  player._walkPhase = player._walkPhase || 0;
  const hop = (walking || player.forceWalk) && !airborne;
  // Шаг под скорость (анти-скольжение): фаза едет от ПРОЙДЕННОЙ дистанции,
  // длина шага растёт со скоростью. Иначе стопа едет 20px/s при теле 230 —
  // 91% скольжения. Звук шагов теперь тоже в такт дистанции.
  const spdV = player.body ? Math.abs(player.body.velocity.x) : 0;
  const stepLen = Phaser.Math.Clamp(0.22 * spdV, 10, 56);
  if (hop) {
    if (!player._wasHop) player._walkPhase = 0; // чистый заход в шаг
    // Задом наперёд (против взгляда) — фаза крутится обратно.
    const moveDir = player.body ? (player.body.velocity.x > 0 ? 1 : player.body.velocity.x < 0 ? -1 : 0) : 0;
    const dirSgn = (moveDir !== 0 && moveDir !== side && !player.forceWalk) ? -1 : 1;
    // Ходьба на месте (превью редактора: тело стоит, frameMove=0) — фазу
    // крутим ПО ВРЕМЕНИ (цикл 24 кадра при acfg.fps), иначе поза замирает:
    // было «пару кадров» на входном конверте и стоп.
    let adv = dirSgn * Math.PI * frameMove / Math.max(1, stepLen);
    // Присед: каденс ниже (иначе ноги-миксер: на метр вдвое больше шагов),
    // шаг шире — в паре даёт ту же скорость стоп (0.55×1.8≈1, без скольжения).
    const crouchCad = crouch ? 0.55 : 1;
    adv *= crouchCad;
    if (player.forceWalk && Math.abs(frameMove) < 0.05) {
      const ff = Phaser.Math.Clamp(acfg.fps ?? 16, 4, 60);
      adv = dirSgn * Math.PI * 2 * (ff / 24) * (pdt / 1000) * crouchCad;
    }
    const prevPhi = player._walkPhase;
    player._walkPhase = (player._walkPhase + adv) % (Math.PI * 2);
    // Топот: фаза прошла посадку ноги (кратно π) — короткий тихий шаг.
    if (Math.floor(prevPhi / Math.PI) !== Math.floor(player._walkPhase / Math.PI) || player._walkPhase < prevPhi) {
      playStep(player);
    }
  } else {
    player._walkPhase = 0;
  }
  player._wasHop = hop;
  // Конверты переходов: появление/уход шага и воздуха — без щелчков позы.
  player._gaitEase = hop
    ? Math.min(1, (player._gaitEase ?? 0) + pdt / 90)
    : Math.max(0, (player._gaitEase ?? 1) - pdt / 90);
  player._airEase = airborne
    ? Math.min(1, (player._airEase ?? 0) + pdt / 150)
    : Math.max(0, (player._airEase ?? 1) - pdt / 150);
  const phi = player._walkPhase;

  // Покачивание корпуса — из той же фазы, что и шаги (одно колебание за цикл).
  // Через x/y торса качаются голова/убор/руки и скелет ног (таз на торсе).
  // В беге качание отскоковое: НЫРОК в момент посадки каждой ноги (φ=0 и φ=π),
  // подъём в полёте (φ=π/2), т.е. два колебания за цикл — feel бегового бобби.
  let bobX = 0;
  let bobY = 0;
  if (hop) {
    const crouchBob = crouch ? 0.4 : 1;
    if (runG) {
      bobX = (acfg.bobX || 0) * 0.5 * Math.cos(phi * 2) * crouchBob;
      bobY = -(acfg.bobY || 0) * Math.cos(phi * 2) * crouchBob;
    } else {
      const bobFreq = acfg.bobFreq > 0 ? acfg.bobFreq : 1;
      const ang = phi * bobFreq;
      bobX = (acfg.bobX || 0) * Math.cos(ang) * crouchBob;
      bobY = (acfg.bobY || 0) * Math.sin(ang) * crouchBob;
    }
  }

  // Опорная высота таза: у скелета — от земли через длину ног и фазу шага,
  // у обычных ног — прежняя статичная формула + покачивание.
  let legsY = hipY + bobY;
  let gait = null;
  // развал стоп в стойке (симметрично вокруг таза), свой для обоих блоков скелета
  const idleGap = 2.5;
  if (player.legsRun && player._legsSkeleton) {
    const lg = partCfg(player, 'legs');
    const tl = player._legThigh || 12;
    const sl = player._legShin || 12;
    const L = tl + sl;
    const shoeT = Math.max(4, player._shoeH || 8);
    const legSgn = side;
    const swingF = Phaser.Math.Clamp(acfg.swing ?? 0.28, 0.02, 0.6);
    const liftF = Phaser.Math.Clamp(acfg.lift ?? 0.4, 0, 0.95);
    const kneeF = acfg.knee ?? 0.15;
    // угол доп. сгиба колена уменжён в 2,5 раза (множитель 0.4 ко всем значениям knee)
    const kneeScale = 1 / 2.5;
    // шарнир таза (где ноги крепятся к телу): размах бедра задаётся параметром hip
    // (0..1, по умолчанию 0.5 = прежнее значение); уменьшает и шаг, и подъём.
    const hipScale = Phaser.Math.Clamp(acfg.hip ?? 0.5, 0.05, 2);
    // Амплитуда шага ПОД СКОРОСТЬ (анти-скольжение): полуширина =
    // доля опоры от шага (иначе стопа едет быстрее/медленнее тела);
    // вкус автора (swing) — множителем вокруг физики (0.5..1.5).
    const strideAmp = Phaser.Math.Clamp(swingF / 0.32, 0.5, 1.5);
    const stanceFrac = runG ? 0.38 : 0.5;       // доля цикла в ОПОРЕ (бег ~38% + полёт)
    // Присед: шаг шире (пара к каденсу 0.55 выше — стопа в такт телу).
    const x0 = stanceFrac * stepLen * strideAmp * (crouch ? 1.8 : 1); // полуширина шага
    const liftH = liftF * L * hipScale * (0.8 + 0.4 * Math.min(1, spdV / 230)); // высота подъёма стопы
    const pL = hop ? (((phi / (Math.PI * 2)) % 1) + 1) % 1 : 0;
    const pR = (pL + 0.5) % 1;
    // стопа в «путевом» кадре:
    //   опора  — скользит +x0 -> -x0 по земле; в беге чуть приподнимается к отталкиванию (носочек)
    //   полёт  — дугой сзади -x0 -> +x0 с подъёмом; в беге дуга асимметричная (быстрый унос назад,
    //            высокое колено) и стопа уходит раньше — это и есть «бег вместо шага»
    //   knee   — доп. сгиб колена: в беге опорная нога пружинит (сгиб к середине опоры),
    //            переносная сильно складывается; в шаге — сгиб только у переносной.
    const footAt = p => {
      if (p < stanceFrac) {
        const e = p / stanceFrac;
        const ease = e * e * (3 - 2 * e);
        return {
          x: x0 * (1 - 2 * ease),
          y: run ? -liftH * 0.3 * e * e : 0,
          knee: run ? kneeF * (0.5 + 0.5 * Math.sin(Math.PI * e)) * kneeScale : 0
        };
      }
      const u = (p - stanceFrac) / (1 - stanceFrac);
      const ease = u * u * (3 - 2 * u);
      const arc = runG ? Math.pow(Math.sin(Math.PI * u), 0.7) : Math.sin(Math.PI * u);
      return {
        x: x0 * (2 * ease - 1),
        y: runG ? -liftH * arc : 0,
        // Конец полёта сходится с началом опоры (0.5), иначе щелчок колена.
        knee: runG ? kneeF * (0.5 + 0.8 * arc) * kneeScale : kneeF * kneeScale
      };
    };
    // Бег: цели поз, воздух: поза падения (передняя вперёд-вверх,
    // задняя поджата), стойка: БОЕВАЯ (разножка под стрельбу, а не плоские
    // ступни). С длинным стволом вес на ногах: передняя вперёд, задняя назад
    // с подъёмом пятки, колени подсогнуты, таз ниже. Смешиваем конвертами.
    const _w = player.weapon;
    const _rifleStance = !_w ? false : (_w.category === 'primary' && !_w.isMelee);
    const sgnA = legSgn || 1;
    // В координатах «вперёд+»: передняя стопа +8, задняя −6 (не зависит от
    // стороны — знак стороны применяется позже через legSgn). Колени 0.12/0.2,
    // задняя стопа на носке (rot 0.45), передняя плашмя (rot −0.05).
    const _stanceF = { x: 8, y: 0, knee: 0.12, rot: -0.05 };
    const _stanceB = { x: -6, y: 0, knee: 0.2, rot: 0.45 };
    const _idleF = _rifleStance && player._throwT < 0 ? _stanceF : { x: idleGap, y: 0, knee: 0, rot: 0 };
    const _idleB = _rifleStance && player._throwT < 0 ? _stanceB : { x: -idleGap, y: 0, knee: 0, rot: 0 };
    // При взгляде вправо передняя — R, задняя — L; влево — наоборот.
    const rL = hop ? footAt(pL) : (sgnA > 0 ? _idleB : _idleF);
    const rR = hop ? footAt(pR) : (sgnA > 0 ? _idleF : _idleB);
    const fAirF = { x: 9 * sgnA, y: -7, knee: 0.35 };
    const fAirB = { x: -7 * sgnA, y: -2, knee: 0.55 };
    const frontIsR = sgnA > 0;
    const aB = player._airEase ?? 0;
    const gE = player._gaitEase ?? 1;
    const mixY = (r, ix, a) => ({
      x: (ix * (1 - gE) + r.x * gE) + (a.x - (ix * (1 - gE) + r.x * gE)) * aB,
      y: (r.y * gE) + (a.y - r.y * gE) * aB,
      knee: (r.knee * gE) + (a.knee - r.knee * gE) * aB,
      rot: (r.rot || 0) * gE
    });
    const fL = mixY(rL, idleGap, frontIsR ? fAirB : fAirF);
    const fR = mixY(rR, -idleGap, frontIsR ? fAirF : fAirB);
    // высота таза — по ОПОРНОЙ (стоящей) стопе: чем стопа дальше от вертикали, тем ниже таз.
    // В беге между опорами ног есть ПОЛЁТ (обе стопы в воздухе) — таз выпрямляется вверх.
    // В стойке учитываем реальную разножку (иначе таз не опускается под вес).
    let stanceX;
    if (!hop) {
      stanceX = Math.max(idleGap, Math.min(Math.abs(fL.x), Math.abs(fR.x)));
    } else if (runG) {
      const lSup = pL < stanceFrac;
      const rSup = pR < stanceFrac;
      const sup = Math.min(lSup ? Math.abs(fL.x) : 1e9, rSup ? Math.abs(fR.x) : 1e9);
      stanceX = (lSup || rSup) ? sup : x0 * 0.55;
    } else {
      stanceX = Math.min(Math.abs(fR.x), Math.abs(fL.x));
    }
    stanceX = Math.min(stanceX, L * 0.92);
    const hipClear = Math.sqrt(Math.max(0.001, L * L - stanceX * stanceX));
    const groundY = (player.body ? player.body.bottom : player.y + 30) - shoeT * 0.5 + 2; // линия посадки ботинок (+2: видимые пиксели на земле, а не над ней)
    legsY = groundY - hipClear + (crouch ? 12 : 0) + bobY + squash + ant;
    gait = {
      tl, sl, shoeT, legSgn, kneeF,
      pL, pR, fL, fR,
      stanceFrac,
      hipClear,
      crouchOff: (crouch ? 12 : 0) + bobY,
      groundY
    };
  }
  player._gaitDbg = gait;

  if (player.torso) {
    const tc = partCfg(player, 'torso');
    player.torso.setOrigin(tc.px, tc.py);
    // при повороте налево можно задать ОТДЕЛЬНЫЕ смещения (mx,my)
    // Torso Y: ноги крепятся к низу торса (paY=1). Нужно чтобы низ торса
    // был на уровне legsY, иначе при py<0.5 (как 0.02) торс «проваливается»
    // вниз и между торсом и бёдрами появляется дыра.
    const _torsoH = player.torso.displayHeight || 1;
    player.torso.setPosition(player.x + (side < 0 ? tc.mx : tc.ox) + bobX, legsY - (1 - tc.py) * _torsoH + (side < 0 ? tc.my : tc.oy));
    // GEO: профильный торс отражаем по направлению взгляда (scale не трогаем).
    if (!(typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN)) {
      flipX(player, player.torso, 'chr_torso', 'torso', side);
    } else {
      try { player.torso.setFlipX(side < 0); } catch (e) {}
    }
    // наклон торса = ПОЛОВИНА наклона головы (в 2 раза меньше). Угол считаем от
    // «шеи» на ещё вертикальном торсе; затем доворачиваем торс. Голова/руки цепляются
    // к УЖЕ повёрнутому торсу (ниже), поэтому на стыке не видно дыр.
    player.torso.setRotation(0);
    const neck0 = anchorFor(player, 'head');
    // Наклон головы/торса к прицелу: цель прижата вперёд (_clampedAim), поэтому
    // взгляд вниз к ногам и вверх не «сбрасывается», а прицел за спиной не гнёт
    // тело назад; мёртвая зона гасит мелкие отклонения от уровня глаз.
    const clNeck = player._clampedAim(neck0.x, neck0.y);
    const rawLean = player._leanFactor(clNeck.y - neck0.y, Math.abs(clNeck.x - neck0.x)) * side;
    // До 45° наклоняется ТОЛЬКО голова; свыше 45° голову фиксируем на 45°,
    // а лишний наклон отдаём ТЕЛУ (но не сильнее прежнего максимума — 0.5 рад).
    const DEG45 = Math.PI / 4;
    let torsoLean = 0;
    if (Math.abs(rawLean) > DEG45) {
      torsoLean = Phaser.Math.Clamp(rawLean - DEG45 * Math.sign(rawLean), -0.5, 0.5);
    }
    // Боевая стойка: с винтовкой корпус слегка подан вперёд (0.1 рад) даже
    // при ровном прицеле — иначе персонаж стоит столбом на плоских ступнях.
    try {
      const _w2 = player.weapon;
      const _rifle = _w2 && _w2.category === 'primary' && !_w2.isMelee;
      if (_rifle && !crouch && !airborne && !walking && player._throwT < 0) {
        torsoLean += 0.1 * side;
      }
    } catch (e) {}
    player._leanTorso = torsoLean;
    player._leanHead = Math.sign(rawLean) * Math.min(Math.abs(rawLean), DEG45);
    player.torso.setRotation(torsoLean);
  }

  if (player.headImg && player.torso) {
    const hc = partCfg(player, 'head');
    const neck = anchorFor(player, 'head');
    player.headImg.setOrigin(hc.px, hc.py);
    player.headImg.setPosition(neck.x + (side < 0 ? hc.mx : hc.ox), neck.y + (side < 0 ? hc.my : hc.oy));
    flipX(player, player.headImg, 'chr_head', 'head', side);
    // голова наклоняется к прижатому вперёд прицелу (та же логика, что у торса)
    const clHead = player._clampedAim(player.headImg.x, player.headImg.y);
    const hLean = player._leanFactor(clHead.y - player.headImg.y, Math.abs(clHead.x - player.headImg.x)) * side;
    const DEG45H = Math.PI / 4;
    player.headImg.setRotation(Math.sign(hLean) * Math.min(Math.abs(hLean), DEG45H));
  }

  if (player.capImg && player.headImg) {
    const cc = partCfg(player, 'cap');
    const top = anchorFor(player, 'cap');
    player.capImg.setOrigin(cc.px, cc.py);
    player.capImg.setPosition(top.x + (side < 0 ? cc.mx : cc.ox), top.y + (side < 0 ? cc.my : cc.oy));
    // rotF: доля поворота головы (1 = жёсткая сварка; меньше — убор «отстаёт» при наклоне)
    player.capImg.setRotation(player.headImg.rotation * (cc.rotF ?? 1));
    flipX(player, player.capImg, 'chr_cap', 'cap', side);
  }

  if (player.armGun && player.torso) {
    const ac = partCfg(player, 'arms');
    // Скелет руки: плечо на якоре торса + смещения; локоть считает 2-сегментная IK.
    // Во время броска гранаты рука работает по своей анимации (замах+бросок).
    const shoulder = anchorFor(player, 'arms');
    let sx = shoulder.x + (side < 0 ? ac.mx : ac.ox);
    let sy = shoulder.y + (side < 0 ? ac.my : ac.oy);
    // Пивот рук: отклонение шарнира от дефолта сдвигает плечевую точку
    // ВПЕРЁД по взгляду (зеркалится стороной, как всё тело).
    // В дефолте сдвиг нулевой — поза не меняется.
    try {
      const dA = (RIG_DEFAULTS.arms || {});
      const dPx = dA.px ?? 0.12, dPy = dA.py ?? 0.45;
      const armL = Math.max(4, (ac.upper || 16) + (ac.fore || 12));
      sx += side * (dPx - (ac.px ?? dPx)) * armL;
      sy += (dPy - (ac.py ?? dPy)) * (ac.s || 26);
    } catch (e) {}
    const target = player._throwT >= 0
      ? { x: player._throwAimX, y: player._throwAimY }
      : player._clampedAim(sx, sy);
    poseArm(player, sx, sy, target.x, target.y, side, ac);
  }

  if (player.legsRun && player._legsSkeleton) {
    const cfg = partCfg(player, 'legs');
    const hip = anchorFor(player, 'legs');
    const hx = hip.x + (side < 0 ? cfg.mx : cfg.ox);
    const g = gait;
    player.legsRun.setPosition(hx, legsY); // маркер редактора следует за тазом
    // В стойке (не шаг) стопы центрируются ПОД ТОЧКОЙ КРЕПЛЕНИЯ ТАЗА: тогда какой
    // бы paX/paY ни стоял, ноги свисают вертикально, а крепление двигает ноги
    // целиком, не наклоняя их. Небольшой симметричный развал idleGap — естественная поза.
    if (!hop) {
      if (airborne) {
        // Полёт: на взлёте ноги поджаты, в падении — вытянуты вниз.
        const vy = player.body ? player.body.velocity.y : 0;
        const tuck = Phaser.Math.Clamp(-vy / 600, 0, 1);
        const droop = Phaser.Math.Clamp(vy / 600, 0, 1);
        const c = (hx - player.x) * g.legSgn;
        const legL = (g.tl || 12) + (g.sl || 12);
        const spread = 4 + 4 * droop;
        const liftY = -legL * 0.34 * tuck + legL * 0.14 * droop;
        const kn = (g.kneeF ?? 0.15) * (0.5 + 2.5 * tuck) * 0.4 + 0.05 * droop;
        g.fL = { x: c + spread, y: liftY, knee: kn };
        g.fR = { x: c - spread * 0.7, y: liftY * 0.75, knee: kn * 0.8 };
      } else {
        const c = (hx - player.x) * g.legSgn;
        // Боевая стойка с винтовкой: разножка (передняя +8/на носке задняя −6),
        // иначе плоские ступни без веса. Сторона определяет какая нога передняя.
        const _w3 = player.weapon;
        const _rifle3 = _w3 && _w3.category === 'primary' && !_w3.isMelee && player._throwT < 0;
        if (_rifle3) {
          const _F = { y: 0, knee: 0.12, rot: -0.05 };
          const _B = { y: 0, knee: 0.2, rot: 0.45 };
          if ((g.legSgn || 1) > 0) {
            g.fL = { x: c - 6, ..._B };
            g.fR = { x: c + 8, ..._F };
          } else {
            g.fL = { x: c + 8, ..._F };
            g.fR = { x: c - 6, ..._B };
          }
        } else {
          g.fL = { x: c + idleGap, y: 0, knee: 0, rot: 0 };
          g.fR = { x: c - idleGap, y: 0, knee: 0, rot: 0 };
        }
      }
    }
    // Стопа опорной ноги стоит по земле (скользит назад), переносная — поднимается
    // дугой вперёд. 2-сегментная IK сама сгибает колено; у переносной ноги оно
    // сгибается сильнее (доп. сгиб kneeF), стопа при этом остаётся на цели.
    // Стопы привязаны к МИРУ (player.x / groundY), а не к тазу: при покачивании
    // корпуса таз «гуляет» внутри ног, а стопы остаются на земле — не скользят.
    const poseFoot = (thigh, shin, foot, ft, kneeAdd, ox, oy, sideKey, p) => {
      // Крепление точки бедра ноги: сдвиг точки, из которой висит бедро.
      // Сдвиг применяется ко ВСЕЙ ноге (бедро+икра+ступня) РАВНОМЕРНО, поэтому
      // поза не меняется — нога целиком «переезжает» к своей точке крепления.
      // X — ПО РОЛИ (передняя/задняя), а не по анатомии L/R: L и R меняются
      // ролями при развороте, и статичные ±3 давали перекрест («куча») при
      // взгляде вправо: база шла навстречу стопе. Передняя база +mag,
      // задняя −mag — ноги параллельны в обе стороны. Ручная правка
      // («Креп: лев/прав») работает дельтой поверх ролевого дефолта.
      const _sum = Math.abs(cfg.hipLx || 0) + Math.abs(cfg.hipRx || 0);
      const _mag = _sum > 0.01 ? _sum / 2 : 0;
      const _isFront = (sideKey === 'r') === ((g.legSgn || 1) > 0);
      const _defAnat = sideKey === 'l' ? _mag : -_mag;
      const _cfgAnat = sideKey === 'l' ? (cfg.hipLx || 0) : (cfg.hipRx || 0);
      const _extra = _cfgAnat - _defAnat;
      const _hoxLocal = (_isFront ? _mag : -_mag) + _extra;
      const hoy = (sideKey === 'l' ? cfg.hipLy : cfg.hipRy) || 0;
      const hox = _hoxLocal * g.legSgn;
      const fx = (player.x + g.legSgn * ft.x) - player.legsRun.x;
      const fy = g.groundY + ft.y - player.legsRun.y;
      // В режиме «одна PNG на ногу» срез колена (kneeL/kneeR) определяет, где по
      // ДЛИНЕ ноги гнётся сустав: бедро = knee*L, икра = (1-knee)*L. Оба среза
      // масштабируются одним коэффициентом, поэтому пропорции арта не искажаются,
      // а линия среза стоит ровно на колене рисунка.
      let tl = g.tl;
      let sl = g.sl;
      if (player._legsFull) {
        const ck = Phaser.Math.Clamp(cfg[sideKey === 'l' ? 'kneeL' : 'kneeR'] ?? 0.5, 0.06, 0.94);
        tl = ck * (g.tl + g.sl);
        sl = (g.tl + g.sl) - tl;
      }
      let footRot = ft.rot || 0;
      if (hop) {
        // Перекат ступни по циклу бега/шага: в опоре - от посадки на пятку
        // (носок чуть вверх) до отталкивания носком (пятка вверх); в полёте нога
        // догоняет бедро - стопа дорзифлексируется (носок вверх), готовясь к
        // следующему приземлению. Иначе ботинок висит строго горизонтально и бег
        // выглядит как «кручение педалей» на велосипеде.
        const stance = p < g.stanceFrac;
        const e = stance ? p / g.stanceFrac : (p - g.stanceFrac) / (1 - g.stanceFrac);
        const ease = e * e * (3 - 2 * e);
        if (stance) {
          // посадка: -0.18 (носок вверх) -> отталкивание: +0.55 (пятка вверх)
          const HEEL = -0.18, TOE = 0.55;
          footRot = HEEL + (TOE - HEEL) * ease;
        } else {
          // перенос: стартуем после отталкивания (+0.55), в середине носок вверх,
          // перед приземлением возвращаемся к посадке (-0.18) - стык бесшовный
          const TOE = 0.55, LAND = -0.18, MID = -0.5;
          const s = 1 - e;
          footRot = s * s * TOE + 2 * s * e * MID + e * e * LAND;
        }
      }
      const ik = legIK(player, fx, fy, tl, sl, kneeAdd, g.legSgn);
      setBone(player, thigh, hox, hoy, -ik.tAng, g.legSgn, tl);
      // наложение бедра и икры: икра «въезжает» в бедро по линии бедра,
      // чтобы между ними не светилась щель на колене. OVERLAP зависит от толщины
      // кости — тонкие кости требуют меньше, толстые — больше.
      const boneW = Math.max(thigh.displayWidth, shin.displayWidth, 8);
      const OVERLAP = Math.max(4, Math.round(boneW * 0.35));
      // Икра сдвинута вверх на OVERLAP (закрыть колено), поэтому её визуал
      // удлиняем на OVERLAP + укус в ботинок: кончик икры возвращается в цель
      // стопы и прячется ПОД ботинок — щели у щиколотки нет.
      setBone(player, shin,
        ik.kx + hox - OVERLAP * Math.sin(ik.tAng),
        ik.ky + hoy - OVERLAP * Math.cos(ik.tAng),
        -ik.sAng, g.legSgn, sl, OVERLAP + 2);
      // ступня = ботинок: смещается ОТДЕЛЬНО для левой/правой стороны (lx/ly, rx/ry),
      // икра не едет за ним. Пивот ступни — СВОЙ для каждого ботинка (lPx/lPy, rPx/rPy).
      const fPx = shoeC[sideKey + 'Px'] ?? shoeC.px ?? 0.5;
      const fPy = shoeC[sideKey + 'Py'] ?? shoeC.py ?? 0.5;
      foot.setOrigin(fPx, fPy);
      // Авто-выравнивание ботинка под визуальную щиколотку икры: ботинок стоит в
      // цели IK, а низ арта икры смещён в кадре (см. _ankleAlign). Пересчитываем
      // сдвиг низа кости в мировые пиксели по её текущему повороту/масштабу и
      // переносим ступню — ботинок встаёт ровно под икрой, а не «впереди/позади».
      let bx = fx + (ox ?? 0) + hox;
      let by = fy + (oy ?? 0) + hoy;
      if (shin._ankleOff) {
        const d = shin._ankleOff * (shin._srcW || 1) * shin.scaleX;
        const cr = Math.cos(shin.rotation);
        const sr = Math.sin(shin.rotation);
        bx += d * cr;
        by += d * sr;
      }
      setBone(player, foot, bx, by, footRot * g.legSgn, g.legSgn, g.shoeT);
    };
    const shoeC = partCfg(player, 'shoes');
    poseFoot(player._thighL, player._shinL, player._footL, g.fL, g.fL.knee, shoeC.lx, shoeC.ly, 'l', g.pL);
    poseFoot(player._thighR, player._shinR, player._footR, g.fR, g.fR.knee, shoeC.rx, shoeC.ry, 'r', g.pR);
    // Z-порядок ног (по ТЗ): задняя ПОД торсом, передняя ПОВЕРХ.
    // При взгляде вправо задняя — левая (l), влево — наоборот.
    try {
      const frontIsR = (g.legSgn || 1) > 0;
      const dB = 3.9, dF = 4.6;
      player._thighL.setDepth(frontIsR ? dB : dF);
      player._shinL.setDepth(frontIsR ? dB : dF);
      player._footL.setDepth(frontIsR ? dB : dF);
      player._thighR.setDepth(frontIsR ? dF : dB);
      player._shinR.setDepth(frontIsR ? dF : dB);
      player._footR.setDepth(frontIsR ? dF : dB);
    } catch (e) {}
  } else if (player.legs) {
    player.legs.setFlipX(side < 0);
    const lx = player.x;
    if (crouch) {
      player.legs.setPosition(lx, player.y + 4).setRotation(0);
    } else {
      player.legs.setPosition(lx, player.y + 6);
      if (airborne) {
        // Полёт без скелета: взлёт — ноги подобраны, падение — ниже.
        const vy = player.body ? player.body.velocity.y : 0;
        player.legs.rotation = vy < -60 ? 0.4 : 0.15;
        player.legs.y += vy < -60 ? -4 : 2;
      } else if (walking) {
        player.legs.rotation = Math.sin(t * 0.012) * 0.3;
      } else {
        player.legs.rotation = 0;
      }
    }
  }

  // обувь в скелетном режиме — это ступни (кости _footL/_footR); отдельный слой не нужен
  if (player.shoeL && !player._legsSkeleton) {
    const sCfg = partCfg(player, 'shoes');
    player.shoeL.setOrigin(sCfg.px, sCfg.py);
    player.shoeR.setOrigin(sCfg.px, sCfg.py);
    const dist = (sCfg.dist ?? 0) || 0;
    const sOx = side < 0 ? (sCfg.mx ?? sCfg.ox ?? 0) : (sCfg.ox ?? 0);
    const legsBot = player.legsRun.y + player.legsRun.displayHeight / 2;
    const yShoe = legsBot - player._shoeH * 0.15 + (side < 0 ? (sCfg.my ?? sCfg.oy ?? 0) : (sCfg.oy ?? 0));
    const rock = walking && !crouch && !airborne ? Math.sin(t * 0.012) * 0.25 : 0;
    flipX(player, player.shoeL, 'chr_shoes', 'shoes', side);
    flipX(player, player.shoeR, 'chr_shoes', 'shoes', side);
    // «Зазор» = расстояние между центрами ботинок, поэтому каждый смещается на dist/2
    const half = dist / 2;
    player.shoeL.setPosition(player.x + sOx - half, yShoe).setRotation(-rock);
    player.shoeR.setPosition(player.x + sOx + half, yShoe).setRotation(rock);
  }

  // малиновый тинт (T в редакторе): у скелета — кости ног
  const dbgTint = !!window.__artDbg;
  // Ульта красит ноги сама (пульс 220мс): пока фаза свечения — не
  // затираем, иначе пульс живёт один кадр и ног не видно.
  const holdUlt = !!player._ultPhase;
  const tintList = player._legsSkeleton
    ? [player._thighL, player._thighR, player._shinL, player._shinR, player._footL, player._footR]
    : [player.shoeL, player.shoeR];
  tintList.forEach(p => {
    // _grayLock ставит лобби невыбранным превью: их серость держит лобби,
    // покадровый сброс тинта сюда не лезет (иначе штаны/обувь не сереют).
    if (!p || holdUlt || player._grayLock) return;
    if (typeof p.clearTint === 'function') {
      if (dbgTint) p.setTint(0xff00ff);
      else p.clearTint();
    } else if (typeof p.setFillStyle === 'function') {
      // скелетные кости теперь прямоугольники (Shape) — у них нет tint, есть fill
      p.setFillStyle(dbgTint ? 0xff00ff : (p._skeletonColor || 0xffffff), 1);
    }
  });
}

export function attachWorld(player, key) {
  return anchorFor(player, key);
}

// Доводка GEO-головы/шеи/лица для кукол сетевой игры: в update() этот блок
// (см. «Голова/шея/лицо — для ВСЕХ») едет каждый кадр, а куклам update()
// не зовём — без этого голова висит на точке спавна, пока тело уходит.
// Арт-голова (headImg) едет в _updateParts и тут не трогается.
export function followHeadPuppet(player) {
  try {
    if (player.headImg) return;
    if (!player.head) return;
    const hc = partCfg(player, 'head');
    const side = player.aimX >= player.x ? 1 : -1;
    const neck0 = anchorFor(player, 'head');
    let headX = neck0.x + (side < 0 ? hc.mx : hc.ox);
    let headY = neck0.y + (side < 0 ? hc.my : hc.oy) + (player.crouching ? 12 : 0);
    const hD = (player._geoHeadR || 8) * 2;
    headX += side * (0.5 - (hc.px ?? 0.5)) * hD;
    headY += (0.93 - (hc.py ?? 0.93)) * hD;
    let _leanX = 0, _leanY = 0;
    try {
      const _hr0 = player._geoHeadR || 8;
      _leanX = Phaser.Math.Clamp((player.aimX - headX) / 220, -1, 1);
      _leanY = Phaser.Math.Clamp((player.aimY - headY) / 220, -1, 1);
      headX += _leanX * _hr0 * 0.22;
      headY += _leanY * _hr0 * 0.18;
    } catch (e) {}
    try {
      const _sc = player.scene;
      if (_sc && typeof _sc._inSolid === 'function') {
        for (let _gi = 0; _gi < 3 && _sc._inSolid(headX, headY, 4); _gi++) {
          headY += 6;
        }
      }
    } catch (e) {}
    if (player.head && player.head.body) {
      player.head.body.reset(headX, headY);
    }
    if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN && player._geoFace && player._geoFace.length) {
      const fside = player.aimX >= player.x ? 1 : -1;
      const hr = player._geoHeadR || 8;
      const eY = headY - hr * 0.12 + _leanY * hr * 0.15;
      if (player._neckVis) player._neckVis.setPosition(headX - fside * hr * 0.14, headY + hr * 0.72);
      if (player._eyeWF) player._eyeWF.setPosition(headX + fside * hr * 0.02, eY);
      if (player._faceOv) {
        player._faceOv.setPosition(headX, headY);
        try { player._faceOv.setScale((hr * 2) / 20); } catch (e2) {}
        try { player._faceOv.setFlipX(fside < 0); } catch (e) {}
      }
      if (player._eyePF) player._eyePF.setPosition(headX + fside * (hr * 0.02 + hr * 0.10) + _leanX * hr * 0.10, eY);
      if (player._eyeWB) player._eyeWB.setPosition(headX + fside * hr * 0.42, eY - hr * 0.04);
      if (player._eyePB) player._eyePB.setPosition(headX + fside * (hr * 0.42 + hr * 0.08) + _leanX * hr * 0.10, eY - hr * 0.04);
      if (player._browF) {
        player._browF.setPosition(headX + fside * hr * 0.02, headY - hr * 0.44);
        try { player._browF.setRotation(fside * 0.10); } catch (e) {}
      }
      if (player._browB) {
        player._browB.setPosition(headX + fside * hr * 0.42, headY - hr * 0.48);
        try { player._browB.setRotation(fside * 0.08); } catch (e) {}
      }
      if (player._ear) player._ear.setPosition(headX - fside * hr * 0.78, headY + hr * 0.05);
      if (player._nose) {
        player._nose.setPosition(headX + fside * hr * 0.86, headY + hr * 0.10);
        try { player._nose.setRotation(-fside * 0.18); } catch (e) {}
      }
      if (player._mouth) {
        player._mouth.setPosition(headX + fside * hr * 0.38, headY + hr * 0.48);
        try { player._mouth.setRotation(fside * 0.04); } catch (e) {}
      }
    }
    try {
      const neck = anchorFor(player, 'head');
      if (player.neck && player.neck.body) {
        player.neck.body.reset(neck.x, neck.y);
      }
    } catch (e) {}
  } catch (e) {}
}

// Все видимые части рига разом (труп не должен висеть частями).
// Спрятанные боксы перчаток (_hiddenBySlice) не трогаем никогда.
export function setPartsVisible(player, v) {
  try {
    const objs = [
      player.torso, player.headImg, player.capImg,
      player.armGun, player.armFront,
      player.legs, player.legsRun,
      player.shoeL, player.shoeR,
      player.head, player.neck,
      ...(player._geoFace || [])
    ];
    objs.forEach(o => {
      if (o && o.active && !o._hiddenBySlice) o.setVisible(v);
    });
  } catch (e) {}
}

// Превью для меню/лобби: равномерно увеличить весь риг в k раз.
// _rcfg свежий на каждое создание — мутация безопасна.
export function previewScale(player, k) {
  try {
    // Запоминаем множитель: updateBars считает убор от живой головы,
    // умноженной уже на него, — вкус cap.s/11 делим обратно, иначе
    // в меню убор в k раз больше, чем в редакторе.
    player._previewK = (player._previewK || 1) * k;
    const rc = player._rcfg || {};
    const mult = (o, keys) => {
      if (!o) return;
      keys.forEach(key => {
        if (typeof o[key] === 'number') o[key] = Math.round(o[key] * k * 10) / 10;
      });
    };
    mult(rc.torso, ['s']);
    mult(rc.head, ['s']);
    mult(rc.cap, ['s']);
    mult(rc.legs, ['s', 'thigh', 'shin']);
    mult(rc.arms, ['s', 'upper', 'fore']);
    mult(rc.shoes, ['s']);
    // Длины скелета читаются один раз при построении — пересчитать.
    const legs = partCfg(player, 'legs');
    player._legThigh = typeof legs.thigh === 'number' ? legs.thigh : 12;
    player._legShin = typeof legs.shin === 'number' ? legs.shin : 12;
    // Высота ступни тоже запечена при построении — иначе в меню ступни
    // мелкие при больших ногах (и наоборот при уменьшении).
    player._shoeH = targetH(player, 'shoes');
    // GEO: торс/голова/лицо/кепка тоже запекли размер при создании —
    // пересчитать под новый масштаб (иначе ноги растут, а верх — нет).
    if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN) {
      try {
        const tcfg = partCfg(player, 'torso');
        if (player.torso) player.torso.setScale((tcfg.s || 22) / (player._geoTorsoH || 36));
      } catch (e) {}
      try {
        const hcfg = partCfg(player, 'head');
        const hk = (hcfg.s || 16) / (player._geoHeadS0 || hcfg.s || 16);
        if (player.head) {
          player.head.setScale(hk);
          try {
            if (player.head.body) player.head.body.setCircle(Math.max(6, (player._geoHeadR0 || 8) * hk - 1));
          } catch (e2) {}
        }
        player._geoHeadR = (player._geoHeadR0 || 8) * hk;
        (player._geoFace || []).forEach(o => { if (o) { try { o.setScale(hk); } catch (e3) {} } });
      } catch (e) {}
      try {
        const ccfg = partCfg(player, 'cap');
        if (player.capImg) {
          // Тот же коэффициент, что в конструкторе Player: стоковые кепки
          // чуть крупнее покупных уборов.
          const stockCap = typeof player._geoCapKey === 'string' && player._geoCapKey.startsWith('__geo_cap');
          const cs = Math.max(0.7, (ccfg.s || 11) / (player._geoCapH || 14)) * (stockCap ? 1.12 : 1);
          player.capImg.setScale(cs, cs);
        }
      } catch (e) {}
    }
  } catch (e) { /* превью без масштаба */ }
}

// Все видимые части тушки для дымового госта. Тело — это отдельные
// картинки (торс/голова/руки/ноги), а базовый спрайт 'player' — заглушка
// цвета команды: конструктор прячет её (alpha 0), трогать её НЕЛЬЗЯ,
// иначе за бойцом висит цветной прямоугольник.
export function smokeParts(player) {
  const out = [player.nameText, player.nameBadge, player.gun, player.gunImg, player.torso,
    player.head, player.headImg, player.capImg, player.neck,
    player.legs, player.legsRun, player.armGun, player.armFront,
    player.shoeL, player.shoeR, player.aura,
    player.healthBar, player.armorBar, player._ammoMark, player._shadow];
  if (player._allParts) {
    for (let i = 0; i < player._allParts.length; i++) out.push(player._allParts[i]);
  }
  const seen = new Set();
  const res = [];
  for (let i = 0; i < out.length; i++) {
    const o = out[i];
    if (!o || o.active === false || seen.has(o)) continue;
    seen.add(o);
    res.push(o);
  }
  return res;
}
