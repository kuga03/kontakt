// move.js — движение, прыжки, присед (было в Player).
// Функции принимают игрока первым аргументом; в классе остались тонкие
// обёртки с теми же именами. Внутри модуля зовём друг друга напрямую,
// методы класса (updateBars, ...) — через player.*.


export function jump(player) {
  // Crouch-jump: прыжок из приседа ОСТАЁТСЯ в приседе весь полёт.
  // Вставать в прыжке запрещено (иначе выросший хитбокс клинит в
  // платформу над головой и физика выталкивает сквозь неё наверх —
  // так с лоу запрыгивали на мид + граната уходила через платформу).
  // Отпущенная S в воздухе вставание не даёт: setCrouch(false) в полёте
  // блокируется (см. setCrouch). Встаём только после приземления.
  const grounded = player.body.blocked.down || player.body.touching.down;

  if (grounded) {
    player.jumps = 0;
  }

  if (player.jumps < player.maxJumps) {
    player.jumps += 1;
    // Штамп прыжка — антиципация (присед) в анимации.
    try {
      player._jumpAt = player.scene ? player.scene.time.now : 0;
    } catch (e) {}
    // Носильщик бомбы прыгает ниже (−36% высоты ≈ ×0.8 скорости):
    // 90-е ящики на lanes ему не взять, lanes держим ≤60.
    const cm = player.isCarrier ? 0.8 : 1;
    player.setVelocityY((grounded ? -470 : -420) * cm);
  }
}

export function move(player, direction) {
  const crouchMul = player.crouching ? 0.5 : 1;
  // Носильщик бомбы медленнее на 25% (по ТЗ 20–30%).
  // k574: вынесено в тактику (дефолт тот же 0.75) — чтобы МЕРИТЬ, сколько
  // капсов стоит это правило: замер probe_conv показал, что носильщик гибнет
  // в полосе x≈2815 на hp 6..19, и скорость — единственная непроверенная
  // ручка в этой полосе.
  let _carryMulK = 1;
  const carryMul = player.isCarrier ? _carryMulK : 1;
  // Адреналин флага (+10) — только под огнём (3с после урона): иначе
  // вор идёт быстрее погони всегда и уносит без урона. Сам бонус
  // выдаёт/снимает Flag (pickUp/drop/return/die) как раньше — здесь
  // только глушим его эффект вне боя. Бухгалтерия знаков не тронута.
  let pct = player.moveSpeedPct || 0;
  player.setVelocityX(direction * player.moveSpeed * (1 + pct / 100) * crouchMul * carryMul);
}

export function stop(player) {
  player.setVelocityX(0);
}

// Влезает ли стоящее тело: точный AABB-тест стоящего бокса
// (30k x 56k, низ = текущий низ тела) против статики.
// Раньше — 6 точек через _inSolid/сетку 30px с раздутием +12:
// рядом с платформой сетка давала ложный «потолок» и игрок
// навсегда оставался сидеть там, где место встать есть.
// extra — запас над макушкой (для вставания в прыжке).
export function canStand(player, extra = 0, exact = false) {
  try {
    const k = rigHitboxK(player);
    const b = player.body;
    const sc = player.scene;
    if (!b || !sc) return true;
    const bottom = b.bottom;
    // k466: exact=true — тест по РЕАЛЬНОМУ телу. Нужен ИГРОКУ: бокс 30k (49px)
    // при теле 27px упирается в ящик рядом, и персонаж не встаёт, хотя место
    // есть. ИИ оставлен на широком боксе: попытка сузить для всех обрушила
    // игру (0 захватов, поломки 516) — там этот размер несущий.
    const L = exact ? b.x : player.x - 15 * k;
    const R = exact ? (b.x + b.width) : (player.x + 15 * k);
    const T = bottom - 56 * k - (extra || 0), B = bottom - 2;
    const groups = [sc.platforms, sc.covers];
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];
      if (!grp) continue;
      const kids = grp.getChildren();
      for (let i = 0; i < kids.length; i++) {
        const ob = kids[i] && kids[i].body;
        if (!ob || !ob.enable) continue;
        // Касания краями (1px) — не пересечение: стоящий впритык
        // к стене/под плитой вставать может.
        if (L < ob.x + ob.width - 1 && R > ob.x + 1 &&
            T < ob.y + ob.height - 1 && B > ob.y + 1) {
          // Низ бокса — свой пол: плита под ногами не мешает.
          // Своим считаем перекрытие только по низу (последние 6px),
          // а не весь бокс, иначе потолок над головой примут за пол.
          if (B <= ob.y + 8 && T < ob.y) continue;
          return false;
        }
      }
    }
    return true;
  } catch (e) { return true; }
}

// Безопасно присесть: если после смены хитбокса центр внутри солида —
// откат (иначе ресайз тела внутри геометрии = вечный клин).
export function safeCrouch(player) {
  if (player.crouching) return true;
  try {
    setCrouch(player, true);
    const sc = player.scene;
    if (sc && typeof sc._inSolid === 'function' && sc._inSolid(player.x, player.y, 8)) {
      setCrouch(player, false);
      return false;
    }
    return true;
  } catch (e) { return false; }
}

export function setCrouch(player, crouching, exact = false) {
  if (!!player.crouching === !!crouching) {
    return;
  }
  // Встаём, только если макушка влезает: иначе голова окажется в
  // платформе (пересечение даже на 1px запрещено).
  if (!crouching) {
    try { if (!canStand(player, 0, exact)) return; } catch (e) {}
    // Вставание в полёте: разрешаем, если сверху есть запас 10px
    // сверх стоящего тела. Без запаса растущий на 18k вверх хитбокс
    // клинит в платформу над головой и физика выталкивает наверх
    // сквозь неё (баг «прыгнул сидя, отпустил S — перепрыгнул ярус»).
    // В чистом небе (запас есть) сидеть до приземления незачем —
    // это и было «есть место встать, а он продолжает сидеть».
    // Исключение — тела без гравитации (превью в лобби/инвентаре).
    try {
      const b = player.body;
      if (b && b.allowGravity !== false && !b.blocked.down && !b.touching.down) {
        if (!canStand(player, 10 * rigHitboxK(player), exact)) return;
      }
    } catch (e) {}
  }
  player.crouching = !!crouching;

  // Хитбокс растёт вместе с персонажем (п.25): базовые 30×56/30×38
  // умножаем на масштаб рига. Низ на месте (60k).
  // В приседе было 30×30: между верхом тела и кругом головы
  // оставалась щель ~6-8px — пули летели СКВОЗЬ сидящего.
  // 38 высотой закрывает щель внахлёст с головой.
  // Хитбокс: высота растёт вместе с персонажем (п.25), ШИРИНА — по реальной
  // ширине рига и с центровкой (k463, см. Player._applyHitbox).
  try { player._applyHitbox(); } catch (e) {
    const k = rigHitboxK(player);
    if (player.crouching) {
      player.body.setSize(30 * k, 38 * k, false);
      player.body.setOffset(1, 22 * k);
    } else {
      player.body.setSize(30 * k, 56 * k, false);
      player.body.setOffset(1, 4 * k);
    }
  }
  // Низ и так на месте (60k в обоих стойках) — спрайт не двигаем.
  // Только сразу дотягиваем риг, чтобы ноги не отставали на кадр.
  try { player.updateBars(); } catch (e) {}
}

// Масштаб хитбокса из размеров рига: сумма высот торс+ноги+голова
// относительно дефолта (22+26+16=64).
export function rigHitboxK(player) {
  try {
    const rc = player._rcfg || {};
    const t = (rc.torso && rc.torso.s) || 22;
    const l = (rc.legs && rc.legs.s) || 26;
    const h = (rc.head && rc.head.s) || 16;
    return Phaser.Math.Clamp((t + l + h) / 64, 0.6, 2.2);
  } catch (e) {
    return 1;
  }
}
