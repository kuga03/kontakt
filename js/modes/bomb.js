// bomb.js — режим «Бомба» + овертайм-турель (было в GameScene).
// _rewardObjective/_ctfBanner/_playFlagSfx живут в modes/ctf.js —
// зовём через сцену (там же обёртки).
import { bumpObj } from '../combat/match.js?v=349';
export function interact(scene) {
  // Флаги теперь подбираются автоматически (_updateFlags).
  // Бомба: подбор своей/сброшенной клавишей тоже работает (автоподбор
  // по касанию — в _updateBomb). Закладка — удержанием в зоне, не клавишей.
  if (scene.mode === 'BOMB') {
    if (scene.blueBomb) {
      scene.blueBomb.pickUp(scene.player);
      if (scene.blueBomb.carrier === scene.player) scene._playFlagSfx('ally');
    }
    if (scene.redBomb) {
      scene.redBomb.pickUp(scene.player);
      if (scene.redBomb.carrier === scene.player) scene._playFlagSfx('ally');
    }
  }
}

// Установка бомбы: носитель СВОЕЙ бомбы удерживает зону чужой базы 5с.
// За это даётся одно очко (по ТЗ).
export function plantBomb(scene, carrier, bomb) {
  if (scene.mode !== 'BOMB' || !bomb || bomb.installed) return;
  if (!carrier || carrier.dead || !carrier.active) return;
  if (carrier.team !== bomb.ownerTeam) return;
  const target = carrier.team === 'blue' ? scene.enemyBase : scene.blueBase;
  if (!target || Math.abs(carrier.x - target.x) >= 100) return;
  bomb.installed = true;
  scene.scores[carrier.team] = (scene.scores[carrier.team] || 0) + 1;
  // «+1» над головой минирующего (конец отсчёта 5..1):
  // мировой текст — стоит над игроком, поднимается и гаснет.
  try {
    const kk = (typeof carrier._rigHitboxK === 'function') ? carrier._rigHitboxK() : 1;
    const plus = scene.add.text(carrier.x, carrier.y - 110 * kk, '+1', {
      fontSize: '30px', color: '#ffd24a', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(30);
    scene.tweens.add({
      targets: plus, y: plus.y - 46, alpha: 0, duration: 1200,
      onComplete: () => { try { plus.destroy(); } catch (e) {} }
    });
  } catch (e) {}
  if (carrier === scene.player && !(scene.player && scene.player._demoPuppet)) {
    scene._rewardObjective();
    bumpObj(scene, 'deliver');
  }
  // Счётчик установок — всем носильщикам (звезда лучшего).
  try { if (carrier) carrier.plants = (carrier.plants | 0) + 1; } catch (e) {}
  // Видимый фидбек закладки (иначе непонятно, что +1 уже дано).
  // Попап на фиксированном месте экрана (ниже события y142 и статусов).
  // Через addHudElement: голый текст зум уносит с места.
  try {
    const t = scene.add.text(640, 172, '+1 ОЧКО', {
      fontSize: '26px', color: '#ffd24a', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(120);
    const item = { obj: t, sx: 640, sy: 172 };
    scene.hudFixed.push(item);
    scene.tweens.add({ targets: item, sy: 132, duration: 1200 });
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
    // Авторский звук закладки: чья закладка — того и файл
    // (старый buy-джингл убран, чтобы не играть внахлёст).
    scene._playFlagSfx(carrier.team === 'blue' ? 'ally' : 'foe');
  } catch (e) { /* фидбек не роняет игру */ }
  const won = carrier.team === 'blue';
  bomb.returnToBase();
  if (scene._bombOvertime) {
    // Внезапная смерть: первый заклад решает.
    scene.endGame(won ? 'Синие победили' : 'Красные победили', won);
    return;
  }
  scene.checkVictory();
}

// Обезвреживание: враг стоит рядом с лежащей чужой бомбой 5с —
// бомба возвращается на базу владельца (без очков). По ТЗ.
export function defuseBomb(scene, bomb, byPlayer) {
  if (scene.mode !== 'BOMB' || !bomb || bomb.carrier || bomb.home) return;
  bomb._defuse = 0;
  try { if (bomb._defMark) { bomb._defMark.destroy(); bomb._defMark = null; } } catch (e) {}
  const ownerBlue = bomb.ownerTeam === 'blue';
  // byPlayer — враг (обезвредивший): с его стороны это успех союзников.
  const foeWon = byPlayer ? byPlayer.team === 'blue' : !ownerBlue;
  try {
    // Событие — под статусами бомб (y142): ряды счёта/таймера/статусов
    // свободны. replace: стек не растим.
    scene._ctfBanner(
      ownerBlue ? 'СИНЯЯ БОМБА ОБЕЗВРЕЖЕНА' : 'КРАСНАЯ БОМБА ОБЕЗВРЕЖЕНА',
      foeWon ? '#7db8ff' : '#ff6666', 142, 15, true
    );
    scene._playFlagSfx(foeWon ? 'ally' : 'foe');
  } catch (e) {}
  bomb.returnToBase();
  // Счётчик дефузов — всем (звезда лучшего), выплата — только себе.
  try { if (byPlayer) byPlayer.defuses = (byPlayer.defuses | 0) + 1; } catch (e) {}
  // Разминировал сам игрок — рискованный канал 5с под огнём оплачивается.
  try {
    if (byPlayer && byPlayer === scene.player && !(scene.player && scene.player._demoPuppet) && scene._rewardObjectiveEvent) {
      scene._rewardObjectiveEvent(50, 15, 'defuse');
    }
  } catch (eR) {}
}

// Бомбы каждый кадр: автоподбор СВОЕЙ по касанию, канал закладки 5с,
// обезвреживание лежащей врагом 5с, возврат через 15с,
// маркеры носильщиков, проникновение для ничьей.
export function updateBomb(scene, time) {
  if (scene.mode !== 'BOMB') return;
  const dt = Math.min(100, Math.max(1, time - (scene._bombT || time)));
  scene._bombT = time;
  const now = scene.time ? scene.time.now : 0;
  [scene.blueBomb, scene.redBomb].forEach(b => {
    if (!b) return;
    try { b.update(); } catch (e) {}
    // Трекинг близости — КАЖДЫЙ кадр (и при носке тоже), иначе после
    // носки/респауна/возврата данные протухают и вход в радиус не ловится.
    try {
      scene.players.forEach(p => {
        if (!p) return;
        p._pickTrack = p._pickTrack || {};
        const alive = !p.dead && p.active;
        const near = alive && Math.abs(p.x - b.x) <= 40 && Math.abs(p.y - b.y) <= 90;
        const prev = p._pickTrack[b.ownerTeam];
        // Телепорт внутрь радиуса (респаун на пьедестале) входом не
        // считается: скачок позиции >150px за кадр — это не заход ногами.
        const jumped = alive && prev && Number.isFinite(prev.x) && Number.isFinite(prev.y) &&
          Math.hypot(p.x - prev.x, p.y - prev.y) > 150;
        p._pickTrack[b.ownerTeam] = {
          near, x: p.x, y: p.y,
          entered: alive && near && !(prev && prev.near) && !jumped
        };
      });
    } catch (e) {}
    const c = b.carrier;
    if (c && (c.dead || !c.active)) {
      b.drop();
      return;
    }
    if (!b.carrier && !b.installed) {
      // Кулдаун автоподбора после сброса (1с): руками через E — можно.
      const noPick = now < (b._noPickupUntil || 0);
      if (!noPick) {
        scene.players.forEach(p => {
          if (!p || p.dead || !p.active) return;
          if (b.carrier) return;
          // Подбор только на ВХОДЕ в радиус: стоявший рядом (кемпер базы,
          // сброс под ноги, возврат при зрителе) не хватает, пока не выйдет
          // и не зайдёт заново. Иначе автовозврат на базу выглядит как
          // телепорт бомбы сразу в руки. Руками через E — всегда можно.
          const tr = p._pickTrack && p._pickTrack[b.ownerTeam];
          if (!tr || !tr.entered) return;
          // Только своя команда (и игрок, и боты — и с базы, и с земли).
          // Враг чужую не подбирает — он её обезвреживает (см. ниже).
          if (p.team !== b.ownerTeam) return;
          b.pickUp(p);
          if (b.carrier === p) scene._playFlagSfx(p.team === 'blue' ? 'ally' : 'foe');
        });
      }
      // Обезвреживание: рядом стоит живой враг (не владелец) — капает 5с.
      // Отошёл — прогресс сгорает в ноль (не тает). Подобрали — в ноль.
      if (!b.carrier && !b.home) {
        let foeNear = null;
        try {
          scene.players.forEach(p => {
            if (foeNear || !p || p.dead || !p.active) return;
            if (p.team === b.ownerTeam) return;
            if (Math.abs(p.x - b.x) > 70 || Math.abs(p.y - b.y) > 90) return;
            foeNear = p;
          });
        } catch (e) {}
        b._defuse = b._defuse || 0;
        if (foeNear) {
          b._defuse += dt;
          bombDefuseMark(scene, b);
          if (b._defuse >= 5000) {
            defuseBomb(scene, b, foeNear);
            return;
          }
        } else {
          // Отошёл от бомбы — таймер СБРАСЫВАЕТСЯ в ноль, а не тает:
          // «постоял 4с, чихнул, вернулся — начинай заново».
          if ((b._defuse || 0) > 0) {
            b._defuse = 0;
            try { if (b._defMark) { b._defMark.destroy(); b._defMark = null; } } catch (e) {}
          }
        }
      } else {
        b._defuse = 0;
        try { if (b._defMark) { b._defMark.destroy(); b._defMark = null; } } catch (e) {}
      }
      // Автовозврата НЕТ: брошенная бомба лежит, где упала, пока её
      // не подберут (свои) или не разминируют (враг за 5с).
    }
    const cc = b.carrier;
    // Канал закладки: стоять в зоне 5с. Вышел/откинуло — прогресс
    // ТАЕТ (вдвое быстрее), а не сгорает: «постой ещё раз с нуля» бесит.
    // Смерть/сброс — в ноль (см. drop).
    // Прогресс ОТДЕЛЬНЫЙ на каждую бомбу: иначе две бомбы в руках
    // обнуляют друг друга каждый кадр и закладка невозможна.
    const pk = '_plant_' + b.ownerTeam;
    if (cc && !cc.dead && !b.installed && cc.team === b.ownerTeam) {
      const target = cc.team === 'blue' ? scene.enemyBase : scene.blueBase;
      cc._plant = cc._plant || {};
      if (target && Math.abs(cc.x - target.x) < 100) {
        cc._plant[pk] = (cc._plant[pk] || 0) + dt;
        if (cc._plant[pk] >= 5000) {
          cc._plant[pk] = 0;
          plantBomb(scene, cc, b);
        }
      } else {
        cc._plant[pk] = Math.max(0, (cc._plant[pk] || 0) - dt * 2);
      }
    } else if (cc) {
      if (cc._plant) cc._plant[pk] = 0;
    }
    bombMarker(scene, b);
  });
  drawBombBases(scene);
  updateBombHud(scene, time);
  updateTurret(scene, time, dt);
}

// Овертайм-турель: ничья на сирене — в центре карты появляется нейтральная
// турель (PNG «турель», рост ×2.5 от старого: ~70px — большая, на спине).
// Подбирает ЛЮБАЯ команда касанием, носильщик тащит на СВОЮ базу и
// УСТАНАВЛИВАЕТ: стоит в зоне базы (±100) 10с — победа команды.
// Вышел из зоны — прогресс тает (вдвое быстрее), смерть/сброс — в ноль.
// Носильщик убит — турель падает на месте смерти (подбирается снова).
// Надписей «ТУРЕЛЬ / НЕСИ НА БАЗУ» нет — только обратный отсчёт установки.
export function spawnOvertimeTurret(scene) {
  try {
    if (scene._turret) return;
    const cx = scene.mapWidth / 2;
    const cy = scene._groundSpawnY ? scene._groundSpawnY(cx) : scene.mapHeight - 120;
    const key = scene.textures.exists('турель') ? 'турель' : null;
    let img;
    if (key) {
      img = scene.physics.add.image(cx, cy, key);
      // Большая турель: ×2.5 от старых 28px → ~70px по высоте.
      try {
        const src = scene.textures.get(key).getSourceImage();
        const sh = (src && src.height) || 40;
        img.setScale(70 / sh);
      } catch (e) { img.setScale(1.25); }
    } else {
      img = scene.physics.add.image(cx, cy, '__white');
      img.setDisplaySize(50, 70);
      img.setTint(0x666666);
    }
    img.setDepth(5);
    if (img.body) {
      img.body.setAllowGravity(true);
      try { img.body.setSize(img.displayWidth * 0.8, img.displayHeight); } catch (e) {}
    }
    scene.physics.add.collider(img, scene.platforms);
    if (scene.covers) scene.physics.add.collider(img, scene.covers);
    scene._turret = { img, mark: null, installMark: null, x: cx, y: cy, carrier: null, done: false, install: 0 };
    try { scene._ctfBanner('ОВЕРТАЙМ! ТУРЕЛЬ В ЦЕНТРЕ', '#ffd24a'); } catch (e) {}
    try { scene._playFlagSfx('ally'); } catch (e) {}
  } catch (e) { /* турель не роняет матч */ }
}

export function updateTurret(scene, time, dt) {
  const T = scene._turret;
  if (!T || T.done || scene.gameOver) return;
  // Канал установки 10с (как закладка бомбы 5с, но дольше).
  const step = (Number.isFinite(dt) && dt > 0) ? Math.min(dt, 100) : 16;
  const NEED = 10000;
  try {
    const c = T.carrier;
    // Носильщик умер/вышел — турель падает на месте.
    if (c && (c.dead || !c.active)) {
      dropTurret(scene);
      return;
    }
    if (c && !c.dead) {
      // Турель на спине носильщика (как заряд бомбы): сзади по взгляду,
      // на уровне лопаток — а не над головой. Центр ~38px над ногами:
      // габарит 70px ложится на спину, не клиппит землю и голову.
      let dir = 1;
      try {
        if (typeof c.flipX === 'boolean') dir = c.flipX ? -1 : 1;
        else if (typeof c.aimX === 'number' && typeof c.x === 'number') {
          dir = c.aimX >= c.x ? 1 : -1;
        }
      } catch (e) {}
      const bx = c.x - dir * 24, by = c.y - 38;
      T.x = bx; T.y = by;
      try {
        T.img.setVelocity(0, 0);
        T.img.setPosition(bx, by);
        try {
          const a = c._smokeHidden ? 0 : 1;
          if (T.img.alpha !== a) T.img.alpha = a;
        } catch (e) {}
      } catch (e) {}
      // Установка на СВОЮ базу: стоять в зоне ±100 суммарно 10с.
      const home = c.team === 'blue' ? scene.blueBase : scene.enemyBase;
      const inZone = !!(home && Math.abs(c.x - home.x) < 100);
      if (inZone) {
        T.install = Math.min(NEED, (T.install || 0) + step);
        // Обратный отсчёт над носильщиком (единственная надпись турели).
        const sec = Math.ceil((NEED - T.install) / 1000);
        try {
          if (!T.installMark) {
            T.installMark = scene.add.text(c.x, c.y - 110, `УСТАНОВКА ${sec}`, {
              fontSize: '14px', color: '#ffd24a', fontStyle: 'bold',
              stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5).setDepth(30);
          } else {
            T.installMark.setText(`УСТАНОВКА ${sec}`).setPosition(c.x, c.y - 110);
          }
          try { T.installMark.alpha = (c._smokeHidden ? 0 : 1); } catch (e) {}
        } catch (e) {}
        if (T.install >= NEED) {
          T.done = true;
          const won = c.team === 'blue';
          try { if (T.installMark) T.installMark.destroy(); } catch (e) {}
          try { T.img.destroy(); } catch (e) {}
          try { c.isCarrier = false; } catch (e) {}
          scene._turret = null;
          scene.endGame(won ? 'Синие победили' : 'Красные победили', won);
          return;
        }
      } else {
        T.install = Math.max(0, (T.install || 0) - step * 2);
        try {
          if (T.installMark) {
            if (T.install <= 0) { T.installMark.destroy(); T.installMark = null; }
            else T.installMark.setText(`УСТАНОВКА ${Math.ceil((NEED - T.install) / 1000)}`).setPosition(c.x, c.y - 110);
          }
        } catch (e) {}
      }
      return;
    }
    // Лежит — синхронизируем координаты и ищем подбор любой командой.
    try { T.x = T.img.x; T.y = T.img.y; } catch (e) {}
    for (let i = 0; i < (scene.players || []).length; i++) {
      const p = scene.players[i];
      if (!p || p.dead || !p.active) continue;
      if (Math.abs(p.x - T.x) > 50 || Math.abs(p.y - T.y) > 90) continue;
      T.carrier = p;
      T.install = 0;
      try { p.isCarrier = true; } catch (e) {}
      try { scene._playFlagSfx(p.team === 'blue' ? 'ally' : 'foe'); } catch (e) {}
      break;
    }
  } catch (e) {}
}

export function dropTurret(scene) {
  const T = scene._turret;
  if (!T || T.done) return;
  try {
    const c = T.carrier;
    if (c) {
      try { c.isCarrier = false; } catch (e) {}
      try {
        T.img.setPosition(c.x, c.y - 20);
        if (T.img.body) T.img.body.setVelocity(0, -60);
      } catch (e) {}
    }
    T.carrier = null;
    // Прогресс установки сгорает при потере турели.
    T.install = 0;
    try { if (T.installMark) { T.installMark.destroy(); T.installMark = null; } } catch (e) {}
    try { if (T.mark) { T.mark.destroy(); T.mark = null; } } catch (e) {}
  } catch (e) { T.carrier = null; }
}

// Маркер обезвреживания над лежащей бомбой: обратный отсчёт.
export function bombDefuseMark(scene, b) {
  try {
    const sec = Math.ceil((5000 - (b._defuse || 0)) / 1000);
    if (!b._defMark) {
      b._defMark = scene.add.text(b.x, b.y - 60, `РАЗМИНИРОВАНИЕ ${sec}`, {
        fontSize: '13px', color: '#7dff9a', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(30);
    } else {
      b._defMark.setText(sec > 0 ? `РАЗМИНИРОВАНИЕ ${sec}` : 'РАЗМИНИРОВАНИЕ').setPosition(b.x, b.y - 60);
    }
  } catch (e) {}
}

// Красная метка над носильщиком (по ТЗ).
// Во время закладки — обратный отсчёт, чтоб было видно процесс.
export function bombMarker(scene, b) {
  try {
    const c = b.carrier;
    if (!c || c.dead) {
      if (b._mark) {
        try { b._mark.destroy(); } catch (e) {}
        b._mark = null;
        b._markSec = -1;
      }
      return;
    }
    // Обратный отсчёт — по максимальному из прогрессов бомб в руках.
    const pv = Math.max(
      (c._plant && c._plant._plant_blue) || 0,
      (c._plant && c._plant._plant_red) || 0
    );
    const planting = pv > 200;
    const sec = planting ? Math.ceil((5000 - pv) / 1000) : -1;
    // Высота метки — от масштаба рига (у крупных персов ник/плашки выше),
    // иначе метка садится на лицо. Две бомбы в одних руках — метки
    // стопкой (красная +22), а не в одной точке друг на друге.
    const kk = (typeof c._rigHitboxK === 'function') ? c._rigHitboxK() : 1;
    const other = (b === scene.redBomb) ? scene.blueBomb : scene.redBomb;
    const shared = !!(other && other.carrier === c);
    const dy = (shared && b === scene.redBomb) ? 22 : 0;
    b._markDy = dy;
    b._markKk = kk;
    // Метки «▼ НОСИЛЬЩИК» нет (убрана): над головой только
    // цифры закладки 5..1, всё остальное время — ничего.
    if (sec <= 0) {
      if (b._mark) {
        try { b._mark.destroy(); } catch (e) {}
        b._mark = null;
        b._markSec = -1;
      }
      return;
    }
    if (!b._mark) {
      b._mark = scene.add.text(c.x, c.y - 100 * kk + dy, `${sec}`, {
        fontSize: '30px', color: '#ffd24a', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(30);
      b._markSec = -2;
    }
    if (sec !== b._markSec) {
      b._markSec = sec;
      b._mark.setText(`${sec}`);
    }
    b._mark.setPosition(c.x, c.y - 100 * (b._markKk || 1) + (b._markDy || 0));
    // Метка гаснет вместе с носильщиком в дыму.
    try { b._mark.alpha = (c.alpha != null ? c.alpha : 1); } catch (e) {}
  } catch (e) {}
}

// Базы + заливка идущей закладки. Круга нет: полоса зоны ±100
// (честная ширина) + столбы по краям, прогресс — заливка полосы.
export function drawBombBases(scene) {
  try {
    ['blue', 'red'].forEach(team => {
      const R = (scene._bombRings || {})[team];
      if (!R) return;
      // Слой поверх земли (земля на 2), но под всем остальным.
      try { if (R.g && R.g.depth !== 2.5) R.g.setDepth(2.5); } catch (e) {}
      let frac = 0;
      let plantMs = 0;
      const b = team === 'blue' ? scene.blueBomb : scene.redBomb;
      const c = b && b.carrier;
      // Бар — под ЦЕЛЬЮ минирования (куда несут), а не под своим домом:
      // синие несут на вражескую (правую), красные — на синюю (левую).
      const dx = (team === 'blue' ? (scene.enemyBase && scene.enemyBase.x) : (scene.blueBase && scene.blueBase.x)) || R.x;
      if (c && !c.dead && !b.installed && c.team === b.ownerTeam) {
        if (Math.abs(c.x - dx) < 100) {
          plantMs = (c._plant && c._plant['_plant_' + b.ownerTeam]) || 0;
          frac = Math.min(1, plantMs / 5000);
        }
      }
      // Секунды до установки — цифрой над баром (видно и защитникам базы).
      const sec = frac > 0 ? Math.ceil((5000 - plantMs) / 1000) : -1;
      if (sec <= 0) {
        try { if (R.txt) R.txt.setVisible(false); } catch (e) {}
        R._sec = -1;
      } else {
        try {
          const gy0 = R.gy != null ? R.gy : scene.mapHeight - 80;
          if (!R.txt) {
            R.txt = scene.add.text(dx, gy0 + 4, '', {
              fontSize: '18px', color: team === 'blue' ? '#7db8ff' : '#ff8888', fontStyle: 'bold',
              stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5).setDepth(2.5);
            R._sec = -1;
          }
          R.txt.setVisible(true);
          R.txt.setPosition(dx, gy0 + 4);
          if (R._sec !== sec) { R._sec = sec; R.txt.setText('' + sec); }
        } catch (e) {}
      }
      const shown = Math.round(frac * 20);
      if (shown === R._shown) return;
      R._shown = shown;
      const col = team === 'blue' ? 0x4488ff : 0xff4444;
      const gy = R.gy != null ? R.gy : scene.mapHeight - 80;
      const sy = gy + 22; // полоса лежит на земле (низ = верх грунта)
      const g = R.g;
      g.clear();
      // Подложка зоны.
      g.fillStyle(0x0d0d22, 0.85);
      g.fillRect(dx - 100, sy, 200, 8);
      g.lineStyle(2, col, 0.9);
      g.strokeRect(dx - 100, sy, 200, 8);
      // Столбы по краям зоны.
      g.fillStyle(col, 1);
      g.fillRect(dx - 103, sy - 40, 6, 40);
      g.fillRect(dx + 97, sy - 40, 6, 40);
      // Прогресс закладки — заливка полосы.
      if (frac > 0.02) {
        g.fillStyle(col, 0.9);
        g.fillRect(dx - 98, sy + 2, Math.max(1, Math.round(196 * frac)), 4);
      }
    });
  } catch (e) {}
}

// Статусы бомб + таймер раунда.
export function updateBombHud(scene, time) {
  try {
    const st = (b) => {
      if (!b) return ['—', '#667788'];
      if (b.carrier && !b.carrier.dead) {
        // Ник обрезан до 8 символов: длинный не дотягивается до соседнего блока.
        return [`НЕСЁТ ${String(b.carrier.playerName || '?').slice(0, 8)}`, '#ffd24a'];
      }
      if (!b.home) {
        if ((b._defuse || 0) > 200) return ['ОБЕЗВРЕЖИВАЮТ', '#7dff9a'];
        return ['ЛЕЖИТ', '#ff8844'];
      }
      return ['ДОМА', '#88dd88'];
    };
    if (scene.bombHudBlue) {
      const [t, col] = st(scene.blueBomb);
      scene.bombHudBlue.setText(t).setColor(col);
    }
    if (scene.bombHudRed) {
      const [t, col] = st(scene.redBomb);
      scene.bombHudRed.setText(t).setColor(col);
    }
    if (scene.bombTimerHud) {
      if (scene._bombOvertime) {
        scene.bombTimerHud.setText('ОТ').setColor('#ffd24a');
      } else {
        const left = scene._matchLeft(scene._bombDur, time);
        if (left == null) return;
        const mm = Math.floor(left / 60000);
        const ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
        scene.bombTimerHud.setText(`${mm}:${ss}`).setColor('#ffffff');
      }
    }
  } catch (e) {}
}

// BOMB: адаптивное возрождение. База 6с + 1с за каждое очко матча
// (к концу тянутся дольше), потолок 14с. Отстающим на 2+ — 2с скидки
// (минимум 4с): разгром не превращается в тир.
export function bombRespawnDelay(scene, team) {
  const scored = (scene.scores.blue | 0) + (scene.scores.red | 0);
  let dl = 6000 + scored * 1000;
  dl = Math.min(dl, 14000);
  try {
    const my = scene.scores[team] | 0;
    const foe = scene.scores[team === 'blue' ? 'red' : 'blue'] | 0;
    if (foe - my >= 2) dl = Math.max(4000, dl - 2000);
  } catch (e) {}
  return dl;
}
