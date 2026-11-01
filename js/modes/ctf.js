// ctf.js — режим «Захват флага» + общие баннеры/звуки объективов
// (было в GameScene). _rewardObjective и _playFlagSfx общие с BOMB —
// bomb.js зовёт их через сцену.
import Flag from '../entities/Flag.js?v=170';
import { gameState, addCoins, addExperience } from '../data/gameState.js?v=171';
import { bumpObj } from '../combat/match.js?v=349';

// Внезапная смерть CTF: оба флага исчезают, в центре — один золотой.
// Доставка его на свою базу решает матч (см. updateFlags).
export function startCtfSuddenDeath(scene) {
  if (scene._ctfOvertime || scene.gameOver) return;
  scene._ctfOvertime = true;
  [scene.blueFlag, scene.redFlag].forEach(f => {
    if (!f) return;
    try {
      // Снимаем ускорение носильщика, иначе бонус залипнет навсегда.
      if (f.carrier) f.carrier.moveSpeedPct = (f.carrier.moveSpeedPct || 0) - 10;
    } catch (e) {}
    try { f.destroy(); } catch (e) {}
  });
  scene.blueFlag = null;
  scene.redFlag = null;
  try {
    // Золото — на верхнее широкое плато по центру (а не на земле:
    // там оно спавнилось внутри холма-ящика). Ищем самую высокую
    // широкую поверхность над центром; нет такой — земля как раньше.
    let gy = scene.mapHeight - 80;
    try {
      const cx = scene.mapWidth / 2;
      let best = null;
      [scene.platforms, scene.covers].forEach(group => {
        if (!group) return;
        group.getChildren().forEach(o => {
          const b = o.body;
          if (!b || !b.enable) return;
          if (b.width < 200) return;
          if (cx + 40 < b.x || cx - 40 > b.x + b.width) return;
          const top = b.y;
          if (top < scene.mapHeight - 200 && (best == null || top < best)) best = top;
        });
      });
      if (best != null) gy = best - 38;
    } catch (e) {}
    const gf = new Flag(scene, scene.mapWidth / 2, gy, 'gold');
    try { gf.clearTint(); gf.setTint(0xffd24a); } catch (e) {}
    scene.ctfSuddenFlag = gf;
    try {
      scene.physics.add.collider(gf, scene.platforms);
      scene.physics.add.collider(gf, scene.covers);
    } catch (e) {}
  } catch (e) { scene.ctfSuddenFlag = null; }
  ctfBanner(scene, 'ВНЕЗАПНАЯ СМЕРТЬ — ФЛАГ В ЦЕНТРЕ!', '#ffd24a');
  // Авторский звук внезапной смерти (громкий акцент: ×2 от обычных).
  try {
    if (scene.cache.audio.exists('sfx_sudden') && !scene.sound.locked) {
      scene.sound.play('sfx_sudden', { volume: 1.2 });
    }
  } catch (e) {}
  // k374: снимок классики на старте овертайма — хвосты SAW/STOP классики иначе
  // вытесняются sudden-фазой (пары цепи из классики не доживают до финала).
  // k376: пропуск на старте матча (suddenStart k300: овертайм с t=0).

}

// Короткие объявления сверху: CTF — ряд y92 (там пусто),
// BOMB — под статусами бомб (y142): там ничего нет.
// Через addHudElement (а не голый текст): иначе зум камеры уносит баннер
// с экрана (на короткостволе зум 1.5 — было «наполовину за экраном»).
// Очередь: новое при живом старом встаёт ПОД ним; когда верхнее гаснет —
// остальные плавно поднимаются на его место (твином item.sy — позицию
// каждый кадр считает updateHudTransform, прямой твин y он бы перебивал).
// replace=true (бомба) — заменить видимый: стек не растим.
// Гаснет само через 2.5с.
export function ctfBanner(scene, text, color, y, fontSize, replace) {
  try {
    scene._banners = scene._banners || [];
    const baseY = y || 92;
    const dropItem = (item) => {
      try {
        const hi = (scene.hudFixed || []).indexOf(item);
        if (hi >= 0) scene.hudFixed.splice(hi, 1);
      } catch (e) {}
    };
    if (replace) {
      while (scene._banners.length) {
        const old = scene._banners.shift();
        try { if (old && old.item) dropItem(old.item); } catch (e) {}
        try { if (old && old.obj) old.obj.destroy(); } catch (e) {}
      }
    }
    const idx = scene._banners.length;
    const t = scene.add.text(640, baseY + idx * 34, text, {
      fontSize: (fontSize || 17) + 'px', fontStyle: 'bold', color: color || '#ffffff',
      backgroundColor: '#0d0d22dd', padding: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(97);
    const item = { obj: t, sx: 640, sy: baseY + idx * 34 };
    scene.hudFixed.push(item);
    const rec = { obj: t, item, baseY };
    scene._banners.push(rec);
    scene.time.delayedCall(2500, () => {
      try {
        const arr = scene._banners || [];
        const i = arr.indexOf(rec);
        if (i < 0) return;
        arr.splice(i, 1);
        try { t.destroy(); } catch (e) {}
        dropItem(item);
        bannerRelayout(scene);
      } catch (e) {}
    });
  } catch (e) { /* баннер не роняет игру */ }
}

// Подтянуть очередь вверх после сгорания верхнего (плавно, 250мс).
// Двигаем item.sy — позицию из него каждый кадр ставит updateHudTransform.
export function bannerRelayout(scene) {
  try {
    (scene._banners || []).forEach((r, j) => {
      if (!r || !r.obj || !r.obj.active || !r.item) return;
      const wantY = (r.baseY || 92) + j * 34;
      try {
        scene.tweens.killTweensOf(r.item);
        scene.tweens.add({ targets: r.item, sy: wantY, duration: 250, ease: 'Cubic.Out' });
      } catch (e) {
        try { r.item.sy = wantY; } catch (e2) {}
      }
    });
  } catch (e) {}
}

// Звук взаимодействия с флагом/бомбой: союзник — свой файл, враг — свой.
// side: 'ally' | 'foe'. Нет файла — тишина (патч громкости учтёт слайдер).
export function playFlagSfx(scene, side) {
  try {
    const key = side === 'foe' ? 'sfx_flag_foe' : 'sfx_flag_ally';
    if (!scene.cache.audio.exists(key) || !scene.sound || scene.sound.locked) return;
    scene.sound.play(key, { volume: 0.55 });
  } catch (e) { /* без звука игра не встанет */ }
}

// Подписи событий флага: вместо «ТЫ» — ник (игрок всегда за синих).
export function ctfNick(scene, p, fallback) {
  try {
    const nm = String((p && p.playerName) || fallback || 'Союзник').slice(0, 14);
    return nm;
  } catch (e) { return fallback || 'Союзник'; }
}

export function ctfFlagTakenBanner(scene, f, p) {
  if (!f || !p) return;
  if (f === scene.ctfSuddenFlag) {
    if (p.team === 'blue') {
      ctfBanner(scene, `${ctfNick(scene, p)} ВЗЯЛ ЗОЛОТОЙ ФЛАГ!`, '#7db8ff');
      playFlagSfx(scene, 'ally');
    } else {
      ctfBanner(scene, 'ВРАГ ВЗЯЛ ЗОЛОТОЙ ФЛАГ!', '#ff6666');
      playFlagSfx(scene, 'foe');
    }
    return;
  }
  if (f.team === 'blue') {
    ctfBanner(scene, 'ВРАГ ВЗЯЛ НАШ ФЛАГ!', '#ff6666');
    playFlagSfx(scene, 'foe');
  } else {
    ctfBanner(scene, `${ctfNick(scene, p)} ВЗЯЛ ФЛАГ ВРАГА!`, '#7db8ff');
    playFlagSfx(scene, 'ally');
  }
}

export function ctfFlagLostBanner(scene, f, victim) {
  if (!f) return;
  if (f === scene.ctfSuddenFlag) {
    if (victim && victim.team === 'red') {
      ctfBanner(scene, 'ВРАГ ПОТЕРЯЛ ЗОЛОТОЙ ФЛАГ!', '#7db8ff');
      playFlagSfx(scene, 'ally');
    } else {
      ctfBanner(scene, `${ctfNick(scene, victim)} ПОТЕРЯЛ ЗОЛОТОЙ ФЛАГ!`, '#ff6666');
      playFlagSfx(scene, 'foe');
    }
    return;
  }
  if (f.team === 'blue') {
    ctfBanner(scene, 'ВРАГ ПОТЕРЯЛ НАШ ФЛАГ!', '#7db8ff');
    playFlagSfx(scene, 'ally');
  } else {
    ctfBanner(scene, `${ctfNick(scene, victim)} ПОТЕРЯЛ ФЛАГ!`, '#ff6666');
    playFlagSfx(scene, 'foe');
  }
}

export function ctfFlagReturnedBanner(scene, f) {
  if (!f || f === scene.ctfSuddenFlag) return;
  if (f.team === 'blue') {
    ctfBanner(scene, 'СОЮЗНЫЙ ФЛАГ ВОЗВРАЩЁН НА БАЗУ', '#7db8ff');
    playFlagSfx(scene, 'ally');
  } else {
    ctfBanner(scene, 'ФЛАГ ВРАГА ВОЗВРАЩЁН НА БАЗУ', '#ff6666');
    playFlagSfx(scene, 'foe');
  }
}

// k404: флаг на платформе брался прыжком ПОД ней (окно 40×90 без
// проверки преграды — боты «возвращали» не залезая). Гейт: между
// центрами не должно быть солида (середины отрезка пробником 6).
// Прыжок над лежащим флагом и подход по той же плите — чистят,
// подкоп через плиту/ящик — нет. Только чтения, fail-open
// (без _inSolid — как раньше). Дешёвый: 3 точки на пару.
function flagReachable(scene, p, f) {
  try {
    if (!scene || typeof scene._inSolid !== 'function') return true;
    for (const t of [0.3, 0.55, 0.8]) {
      const x = p.x + (f.x - p.x) * t, y = p.y + (f.y - p.y) * t;
      if (scene._inSolid(x, y, 6)) return false;
    }
    return true;
  } catch (e) { return true; }
}

export function updateFlags(scene, time) {
  if (scene.mode !== 'CTF') return;
  const now = typeof time === 'number' ? time : (scene.time ? scene.time.now : 0);
  const flags = [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag].filter(Boolean);
  flags.forEach(f => { try { f.update(); } catch (e) {} });
  // Брошенный флаг без носителя — автовозврат на базу через 22с,
  // иначе матч может встать в вечный ступор.
  // Золотой возвращается в центр (его baseX — середина карты).
  // Кулдаун возвратов по флагу (2.5с = жизнь баннера): страховка
  // от спама «возвращён», если флаг не может лечь на базу
  // (точка в геометрии / физика выталкивает). Плюс счётчик цикла:
  // 6+ возвратов за 10с — пишем диагностику в консоль (F12).
  const flagRetOk = (f) => {
    try {
      scene._flagRetAt = scene._flagRetAt || {};
      const key = (f && f.team) || 'x';
      if (now - (scene._flagRetAt[key] || 0) < 2500) return false;
      scene._flagRetAt[key] = now;
      f._retLog = f._retLog || [];
      f._retLog.push(now);
      while (f._retLog.length && now - f._retLog[0] > 10000) f._retLog.shift();
      if (f._retLog.length >= 6) {
        f._retLog.length = 0;
        let near = '?';
        try {
          near = (scene.players || []).filter(p => p && !p.dead)
            .map(p => `${p.team}@${Math.round(p.x)},${Math.round(p.y)}`).join(' ').slice(0, 160);
        } catch (e2) {}
        console.warn('[CTF] flag return loop team=' + key +
          ' flag@' + Math.round(f.x) + ',' + Math.round(f.y) +
          ' base@' + Math.round(f.baseX) + ',' + Math.round(f.baseY) +
          ' carrier=' + (f.carrier ? f.carrier.team : 'none') +
          ' near: ' + near);
      }
      return true;
    } catch (e) { return true; }
  };
  flags.forEach(f => {
    if (f.carrier) return;
    if (Math.hypot(f.x - f.baseX, f.y - f.baseY) <= 60) return;
    // Брошенный флаг без носителя — автовозврат на базу через 22с,
    // иначе мясорубка в центре стоит вечно.
    if (now - (f.droppedAt || 0) > 22000) {
      if (!flagRetOk(f)) return;
      f.returnToBase();
      try { scene._closeSteal(f, 'таймаут', now); } catch (eS) {}
      ctfFlagReturnedBanner(scene, f);
    }
  });
  scene.players.forEach(p => {
    if (!p || p.dead || !p.active) return;
    flags.forEach(f => {
      if (f.carrier) return;
      // Секунда после сброса — без подбора/возврата (как у бомбы):
      // иначе F-сброс хватает обратно мгновенно.
      if (now < (f._noPickupUntil || 0)) return;
      if (Math.abs(p.x - f.x) > 40 || Math.abs(p.y - f.y) > 90) return;
      if (!flagReachable(scene, p, f)) return;
      if (p.team !== f.team) {
        f.pickUp(p);
        if (f.carrier === p) { ctfFlagTakenBanner(scene, f, p); try { scene._logSteal(f, p, now); } catch (eS) {} }
      } else if (Math.hypot(f.x - f.baseX, f.y - f.baseY) > 60) {
        if (!flagRetOk(f)) return;
        f.returnToBase();
        try { scene._closeSteal(f, 'возвращён', now); } catch (eS) {}
        ctfFlagReturnedBanner(scene, f);
        // Счётчик возвратов — всем (звезда лучшего), выплата — только себе.
        try { if (p) p.returnsCount = (p.returnsCount | 0) + 1; } catch (eR2) {}
        // Вернул свой флаг касанием сам игрок — оборона оплачивается.
        try {
          if (p === scene.player && !(scene.player && scene.player._demoPuppet) && scene._rewardObjectiveEvent) {
            scene._rewardObjectiveEvent(25, 10, 'ret');
          }
        } catch (eR) {}
      }
    });
  });
  flags.forEach(f => {
    const c = f.carrier;
    if (!c) return;
    if (c.dead || !c.active) {
      f.drop();
      return;
    }
    // Середина карты (k195): первая смена половины носильщиком относительно
    // стороны подбора — фиксируем его ярус. Подбор всегда у базы (низ),
    // информативен именно коридор проноса через центр.
    try {
      const _ev = f._stealEv;
      if (_ev && !_ev.out && !_ev.mid && c && Number.isFinite(c.x)) {
        const _mw2 = (scene.mapWidth || 3800) / 2;
        const _s = c.x >= _mw2 ? 1 : -1;
        if (_ev.side0 != null && _s !== _ev.side0) {
          _ev.mid = scene._laneOf(c) || '?';
        }
      }
    } catch (eM) {}
    // Золотой флаг: доставка на СВОЮ базу решает матч сразу.
    // Зона доставки узкая (45px): раньше 130 — засчитывало издали.
    if (f === scene.ctfSuddenFlag) {
      const bx = c.team === 'blue' ? 220 : scene.mapWidth - 220;
      if (Math.abs(c.x - bx) < 45) {
        const won = c.team === 'blue';
        c.flagsDelivered = (c.flagsDelivered | 0) + 1;
        if (c === scene.player && !(scene.player && scene.player._demoPuppet)) {
          rewardObjective(scene);
          bumpObj(scene, 'deliver');
          try {
            const st0 = gameState.stats || (gameState.stats = {});
            st0.flagsDelivered = (st0.flagsDelivered | 0) + 1;
          } catch (e) {}
        }
        ctfBanner(scene, won ? 'СОЮЗНИКИ ДОСТАВИЛИ ЗОЛОТОЙ ФЛАГ!' : 'ВРАГ ДОСТАВИЛ ЗОЛОТОЙ ФЛАГ!', won ? '#7db8ff' : '#ff6666');
        scene.endGame(won ? 'Синие победили' : 'Красные победили', won);
      }
      return;
    }
    const home = c.team === 'blue' ? scene.blueFlag : scene.redFlag;
    if (!home || f === home) return;
    // Доставка — только по классике, два условия:
    // 1) свой флаг дома (не тащит враг и не валяется в поле — тот же
    //    порог 60, что у автовозврата/подбора выше);
    // 2) носитель коснулся СВОЕГО флага (то же окно подбора 40×90,
    //    что у кражи — по размеру персонажа, а не абстрактная зона).
    // Раньше засчитывало по |x-baseX|<45 даже при украденном своём.
    const homeAtBase = !home.carrier &&
      Math.hypot(home.x - home.baseX, home.y - home.baseY) <= 60;
    if (!homeAtBase) return;
    // Y-окно доставки сужено 90→60: флаг стоит на плите (baseY — центр спрайта,
    // низ древка на ~12px ниже верха плиты), а окно 90 пускало носителя в яму
    // ПОД плитой (низ ~93-112px ниже центра флага) и засчитывало доставку под
    // флагом. 60 держит честное касание на плите (~20px) и режет яму.
    if (Math.abs(c.x - home.x) > 40 || Math.abs(c.y - home.y) > 60) return;
    // k404-gate на доставке снят: флаг стоит на плите (baseY — центр спрайта
    // на ~38 выше верха), носитель под плитой проходит окно 40×90 честно, но
    // луч центра→центру режется самой плитой (16px). Подбор/возврат гейт
    // оставлен — там окно без луча давало подкоп через платформу.
    // if (!flagReachable(scene, c, home)) return;
    {
      scene.scores[c.team] = (scene.scores[c.team] || 0) + 1;
      c.flagsDelivered = (c.flagsDelivered | 0) + 1;
      if (c === scene.player && !(scene.player && scene.player._demoPuppet)) {
        rewardObjective(scene);
        bumpObj(scene, 'deliver');
        try {
          const st0 = gameState.stats || (gameState.stats = {});
          st0.flagsDelivered = (st0.flagsDelivered | 0) + 1;
        } catch (e) {}
      }
      f.returnToBase();
      try { scene._closeSteal(f, 'доставлен', now); } catch (eS) {}
      ctfBanner(scene, c.team === 'blue' ? 'СОЮЗНИКИ ДОСТАВИЛИ ФЛАГ!' : 'ВРАГ ДОСТАВИЛ ФЛАГ!', c.team === 'blue' ? '#7db8ff' : '#ff6666');
      console.info('[CTF] capture team=' + c.team + ' scores=' + JSON.stringify(scene.scores) + ' limit=' + scene.scoreLimit);
      flagCaptureFx(scene, c.team);
      // Победа сразу по достижении лимита, без посредников.
      if (scene.scores[c.team] >= scene.scoreLimit) {
        scene.endGame(c.team === 'blue' ? 'Синие победили' : 'Красные победили', c.team === 'blue');
      } else {
        scene.checkVictory();
      }
    }
  });
}

// Награда за выполненную задачу (доставка флага, закладка бомбы):
// +100 монет и +40 опыта сразу. Новичок тоже получает (10 — вчетверо
// меньше, как за киллы): раньше ветка plantXp=10 была недостижима,
// т.к. условие не включало novice.
export function rewardObjective(scene) {
  try {
    scene.matchCoins = (scene.matchCoins || 0) + 100;
    addCoins(100);
    const diffId = scene.botDifficulty?.id;
    if (diffId === 'experienced' || diffId === 'veteran' || diffId === 'novice') {
      const plantXp = diffId === 'novice' ? 10 : 40;
      scene.matchXP = (scene.matchXP || 0) + plantXp;
      addExperience(plantXp);
    }
  } catch (e) { /* награда не роняет игру */ }
}

// Видимый фидбек доставки флага (счёт в HUD тоже растёт сам).
// Попап на фиксированном месте экрана (под баннером событий),
// а не в мире у игрока: иначе позиция и размер плавают от зума камеры.
// Через addHudElement: голый текст зум уносит с места.
export function flagCaptureFx(scene, team) {
  try {
    const t = scene.add.text(640, 132, '+1 ФЛАГ', {
      fontSize: '30px', fontStyle: 'bold',
      color: team === 'blue' ? '#7db8ff' : '#ff8888',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(120);
    const item = { obj: t, sx: 640, sy: 132 };
    scene.hudFixed.push(item);
    // Подъём — твином item.sy (позицию ставит updateHudTransform),
    // затухание — твином alpha самого текста.
    scene.tweens.add({ targets: item, sy: 92, duration: 1200 });
    scene.tweens.add({
      targets: t, alpha: 0, duration: 1200,
      onComplete: () => {
        try {
          const hi = (scene.hudFixed || []).indexOf(item);
          if (hi >= 0) scene.hudFixed.splice(hi, 1);
        } catch (e) {}
        t.destroy();
      }
    });
    // Авторский звук доставки: наша команда / вражеская.
    // Игрок всегда за синих: синяя доставка = наша.
    const key = team === 'blue' ? 'sfx_flagours' : 'sfx_flagfoe';
    if (scene.cache.audio.exists(key) && !scene.sound.locked) {
      scene.sound.play(key, { volume: 0.6 });
    } else if (scene.cache.audio.exists('sfx_buy') && !scene.sound.locked) {
      scene.sound.play('sfx_buy', { volume: 0.5 });
    }
  } catch (e) { /* фидбек не роняет игру */ }
}

export function updateCtfHud(scene, time) {
  try {
    if (scene.ctfTimerHud) {
      if (scene._ctfOvertime) {
        scene.ctfTimerHud.setText('ОТ').setColor('#ffd24a');
      } else {
        const left = scene._matchLeft(scene._ctfDur, time);
        if (left == null) return;
        const mm = Math.floor(left / 60000);
        const ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
        scene.ctfTimerHud.setText(`${mm}:${ss}`);
      }
    }
  } catch (e) {}
}
