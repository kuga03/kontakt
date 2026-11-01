// abilities.js — классовые способности и ульта (было в Player).
// Функции принимают игрока первым аргументом; в классе остались тонкие
// обёртки с теми же именами. activateAbility/activateUltimate живут
// в наследниках — зовём через player.* (динамическая диспетчеризация
// сохраняется). Внутри модуля — прямые вызовы.
import { getClassAbility, ultUnlocked } from '../../data/abilities.js?v=169';

export function useAbility(player, time) {
  // Мёртвый и бесклассовый (снайпер) — молча мимо, а не краш.
  if (player.dead || !player.hasAbility) return;
  if (time < player.lastAbilityAt + player.abilityCooldown) {
    return;
  }

  player.lastAbilityAt = time;
  player.activateAbility();
}

// Финальная проверка точки кита ПОСЛЕ спавна (escapeGeometry мог
// утащить наверх): недостижим ни мне, ни союзнику рядом с посадкой —
// вернуть к моим ногам. Окна — как у _findTaker (Pickup).
// why — ветка ('aim'/'drop'), для диагностики в консоли.
export function kitSpotFix(player, x, y, why) {
  try {
    const sc = player.scene;
    if (!sc) return { x, y };
    const feetY = (player.body && Number.isFinite(player.body.bottom)) ? player.body.bottom : player.y + 28;
    const list = (sc.players) || [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p || p.dead || !p.active || p.team !== player.team) continue;
      const pb = p.body;
      const feet = pb && Number.isFinite(pb.bottom) ? pb.bottom : p.y + 28;
      const hw = (pb ? pb.width / 2 : 15) + 18;
      const dyf = y - feet;
      if (Math.abs(p.x - x) <= hw && dyf >= -75 && dyf <= 25) return { x, y };
    }
    try {
      console.warn('[KIT] relocated to feet from ' + Math.round(x) + ',' + Math.round(y) +
        ' (me ' + Math.round(player.x) + ',' + Math.round(feetY) + (why ? ', ' + why : '') + ')');
    } catch (e) {}
    return { x: player.x, y: feetY - 12 };
  } catch (e) { return { x, y }; }
}

export function throwAbility(player, type, dist = 80, targetX = null) {
  // Направление броска = направление стрельбы (прицел), а не спрайта:
  // flipX может отставать от aimX на кадр.
  // targetX — бросок конкретному союзнику (штурмовик делится патронами):
  // кидаем в его сторону так, чтобы сумка упала рядом с ним.
  const aimed = typeof targetX === 'number' && Number.isFinite(targetX);
  // Себе под ноги (медик/танк): БЕЗ дуги и полётов. Опору ищем строго
  // НИЖЕ ступней (скан от y+30 вниз): скан от центра цеплял плиту над
  // головой, и кит улетал наверх, когда прыгнул и упёрся головой.
  if (!aimed) {
    const side0 = player._getSide();
    let dropX = player.x + side0 * 22;
    let dropY = player.y + 20;
    try {
      const sc0 = player.scene;
      if (sc0 && typeof sc0._groundFeetY === 'function') {
        const myGy = sc0._groundFeetY(player.x, player.y + 30);
        // Старт скана внутри солида (сброс впритык к высокому ящику) —
        // мусорный верх вместо земли под ногами: пропускаем скан.
        let startSolid0 = false;
        try {
          if (sc0._inSolid && sc0._inSolid(dropX, player.y - 10, 6)) startSolid0 = true;
        } catch (e) {}
        const gy0 = startSolid0 ? null : sc0._groundFeetY(dropX, player.y + 30);
        if (gy0 != null) dropY = gy0 - 12;
        else if (myGy != null) dropY = myGy - 12;
        // Улетело сильно ниже нашего уровня (край платформы) —
        // кладём под ноги, а не на землю внизу (не достать).
        if (myGy != null && dropY > myGy + 60) {
          dropX = player.x;
          dropY = myGy - 12;
        }
        // Та же страховка, что у прицельного: выше ног без союзника —
        // своя земля (иначе сброс впритык к потолку ляжет наверх).
        // Союзник — ступнями у поверхности посадки.
        try {
          const feet0 = (player.body && Number.isFinite(player.body.bottom)) ? player.body.bottom : player.y + 28;
          if (dropY < feet0 - 60) {
            let mateThere0 = false;
            try {
              (sc0.players || []).forEach(p => {
                if (mateThere0 || !p || p.dead || !p.active || p === player || p.team !== player.team) return;
                if (Math.abs(p.x - dropX) >= 60) return;
                const pf0 = (p.body && Number.isFinite(p.body.bottom)) ? p.body.bottom : p.y + 28;
                if (Math.abs(pf0 - (dropY + 12)) < 40) mateThere0 = true;
              });
            } catch (e) {}
            if (!mateThere0 && myGy != null) {
              dropX = player.x;
              dropY = myGy - 12;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    const pk0 = player.scene.spawnPickup(type, dropX, dropY);
    if (pk0) {
      // Сеть безопасности: после выталкиваний точка могла уехать
      // наверх — недостижимый кит возвращаем к ногам (см. kitSpotFix).
      try {
        const fix0 = kitSpotFix(player, pk0.x, pk0.y, 'drop');
        if (Math.abs(fix0.x - pk0.x) > 1 || Math.abs(fix0.y - pk0.y) > 1) {
          try { pk0.setPosition(fix0.x, fix0.y); } catch (e) {}
          try { if (pk0.body) pk0.body.setVelocity(0, 0); } catch (e) {}
        }
      } catch (e) {}
      try { pk0.setTeamRing(player.team); } catch (e) { pk0.team = player.team; }
    }
    return;
  }
  let side = player._getSide();
  let throwDist = dist;
  side = targetX >= player.x ? 1 : -1;
  throwDist = Phaser.Math.Clamp(Math.abs(targetX - player.x) - 20, 30, 260);
  const startX = player.x + side * 12;
  const startY = player.y - 30;
  const endX = player.x + side * throwDist;
  // Адресат паса: ближайший живой союзник к targetX. Опору ищем
  // от ЕГО уровня, а не от моей груди — иначе скан цепляет мост
  // над его головой, и кит ложится наверх вместо земли под ним.
  let tgtMate = null;
  try {
    const sc0m = player.scene;
    if (sc0m && typeof targetX === 'number' && Number.isFinite(targetX)) {
      let bd = 60;
      (sc0m.players || []).forEach(p => {
        if (!p || p.dead || !p.active || p === player || p.team !== player.team) return;
        const d = Math.abs(p.x - targetX);
        if (d < bd) { bd = d; tgtMate = p; }
      });
    }
  } catch (e) { tgtMate = null; }
  // Приземление — на опору под точкой (а не на высоте броска): иначе
  // сумка материализуется в воздухе чужого яруса (с мида — на верхнюю
  // палубу) и падает куда попало. Нет опоры в пределах досягаемости —
  // как раньше, на высоте броска.
  let endY = player.y;
  try {
    const sc = player.scene;
    if (sc && typeof sc._groundFeetY === 'function') {
      // Старт скана внутри солида (точка прилёта в высоком ящике/плите,
      // головой упёрлись рядом) — результат мусорный (верх чужой
      // геометрии, куда потом не достать): не сканируем вовсе.
      // Старт — на уровне адресата, раз скан идёт от него.
      let startSolid = false;
      const scanBaseY = tgtMate ? tgtMate.y : player.y;
      try {
        if (sc._inSolid && sc._inSolid(endX, scanBaseY - 40, 6)) startSolid = true;
      } catch (e) {}
      // Адресату — скан от его груди: опора под точкой на ЕГО уровне.
      const gy = startSolid ? null : sc._groundFeetY(endX, scanBaseY);
      if (gy != null) endY = gy - 12;
      else {
        // Опоры нет — своя земля, а не высота броска (иначе escapeGeometry
        // в spawnPickup вытолкнет кит НАВЕРХ на чужую платформу).
        const myGy0 = sc._groundFeetY(player.x, player.y + 30);
        endY = (myGy0 != null ? myGy0 : player.y + 40) - 12;
      }
    }
  } catch (e) {}
  // Навес над головой: нашли опору сильно ВЫШЕ ног — это плита, в которую
  // упёрлись, а не земля. Пас кладём на свой уровень, а не наверх.
  try {
    const sc2 = player.scene;
    if (sc2 && typeof sc2._groundFeetY === 'function') {
      const myGy = sc2._groundFeetY(player.x, player.y + 30);
      if (myGy != null && endY < myGy - 100) endY = myGy - 12;
    }
  } catch (e) {}
  // Последняя страховка: посадка выше моих ног — только если там реально
  // стоит живой союзник (делюсь с ним). Иначе — своя земля: кит на чужой
  // верхней плите без хозяина висит вне зоны подбора навсегда.
  // Союзник меряется СТУПНЯМИ у поверхности посадки, а не центром:
  // иначе сойдёт свой же с земли рядом.
  try {
    const sc3 = player.scene;
    const feetY = (player.body && Number.isFinite(player.body.bottom)) ? player.body.bottom : player.y + 28;
    if (sc3 && endY < feetY - 60) {
      let mateThere = false;
      try {
        (sc3.players || []).forEach(p => {
          if (mateThere || !p || p.dead || !p.active || p === player || p.team !== player.team) return;
          if (Math.abs(p.x - endX) >= 60) return;
          const pf = (p.body && Number.isFinite(p.body.bottom)) ? p.body.bottom : p.y + 28;
          if (Math.abs(pf - (endY + 12)) < 40) mateThere = true;
        });
      } catch (e) {}
      if (!mateThere) {
        const myGy3 = (typeof sc3._groundFeetY === 'function') ? sc3._groundFeetY(player.x, player.y + 30) : null;
        endY = (myGy3 != null ? myGy3 : feetY) - 12;
      }
    }
  } catch (e) {}

  const colors = { medkit: 0x33cc55, ammo: 0x8a5a2a, armor: 0x5588ff };
  const sz = 8;

  const proj = player.scene.add.rectangle(startX, startY, sz, sz, colors[type] || 0xffffff, 1)
    .setDepth(5);

  // Полёт дугой (парабола +50px), а не прямой сквозь геометрию:
  // видно честную баллистику, а не чит-бросок через палубу.
  const _fly = { t: 0 };
  player.scene.tweens.add({
    targets: _fly,
    t: 1,
    duration: 320,
    ease: 'Cubic.Out',
    onUpdate: () => {
      try {
        const t = Math.max(0, Math.min(1, _fly.t));
        proj.x = startX + (endX - startX) * t;
        const linY = startY + (endY - startY) * t;
        proj.y = linY - 200 * t * (1 - t);
        proj.setScale(1.5 - 0.5 * t, 0.5 + 0.5 * t);
      } catch (e) {}
    },
    onComplete: () => {
      proj.destroy();
      const pk = player.scene.spawnPickup(type, endX, endY);
      // Расходник помечен командой кинувшего: боты врага его не подберут.
      // Кольцо цветом команды — видно, чей кит.
      if (pk) {
        // Сеть безопасности: недостижимый ни мне, ни союзнику рядом —
        // к ногам (см. kitSpotFix).
        try {
          const fix = kitSpotFix(player, pk.x, pk.y, 'aim');
          if (Math.abs(fix.x - pk.x) > 1 || Math.abs(fix.y - pk.y) > 1) {
            try { pk.setPosition(fix.x, fix.y); } catch (e) {}
            try { if (pk.body) pk.body.setVelocity(0, 0); } catch (e) {}
          }
        } catch (e) {}
        try { pk.setTeamRing(player.team); } catch (e) { pk.team = player.team; }
      }
      // Прицельная передача союзнику — живёт 60с (не 30): голодающий
      // дойдёт даже с другого конца платформы.
      if (pk && typeof targetX === 'number' && Number.isFinite(targetX)) {
        try { pk.expires = player.scene.time.now + 60000; } catch (e) {}
      }
    }
  });
}

export function useUltimate(player, time) {
  if (!player.ultName) return;

  const ab = getClassAbility(player.constructor.name);
  if (!ab) return;

  // Разблокировка по уровню — только для игрока. Боты дерутся
  // фиксированной сложностью и копят ульту килами (5), а не прокачкой.
  if (!player.isAI && !ultUnlocked(ab.id)) return;

  if (player.ultActive) return;

  if (player.ultCharge < player.ultMaxCharge) return;

  player.ultCharge = 0;
  player.ultActive = true;
  player.ultEndsAt = time + player.ultDuration;

  if (player._ultActiveTimer) { try { player._ultActiveTimer.remove(); } catch (e) {} }
  player._ultActiveTimer = player.scene.time.delayedCall(player.ultDuration, () => {
    if (!player.scene) return;
    player.ultActive = false;
    player.forceWalk = false;
    player._ultActiveTimer = null;
  });

  player.activateUltimate();
}

export function addUltCharge(player, amount) {
  if (player.ultActive || !player.ultName) return;
  player.ultCharge = Math.min(player.ultMaxCharge, player.ultCharge + amount);
}
