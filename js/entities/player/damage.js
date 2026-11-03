// damage.js — урон, смерть, возрождение, лечение (было в Player).
// Функции принимают игрока первым аргументом; в классе остались тонкие
// обёртки с теми же именами (наследники Assault/Tank/Medic/Sniper зовут
// super.die/super.destroy — работает как раньше). Внутри модуля зовём
// друг друга напрямую, методы класса — через player.*.
import { getPass, saveGameState } from '../../data/gameState.js?v=175';
import { fragMax, smokeMax } from '../../data/skills.js?v=169';


// zone: 'head' | 'body' | 'legs'. Голова x2 (кроме взрывов),
// ноги x0.7, тело x1. Взрывы ('frag'/'RPG') зональность игнорят.
export function receiveDamage(player, amount, attacker, src, zone) {
  if (player.dead) {
    return;
  }
  // Щит спавна 1с (k206): урон не проходит вообще — ни в ХП, ни в счётчики
  // и адреналин ниже. Часы — сценовые (те же, что ставит revive).
  try {
    const _now0 = (player.scene && player.scene.time) ? player.scene.time.now : 0;
    if (_now0 < (player._spawnProtUntil || 0)) return;
  } catch (e) {}
  // Источник урона для киллфида (граната/ракета): запоминаем с последнего
  // удара — смертельный и определит подпись. Без src — текущее оружие.
  player._deathSrc = src || null;
  // Битый урон (NaN/0/минус) не лечит и не даёт бессмертия через NaN-HP.
  if (!Number.isFinite(+amount) || +amount <= 0) return;
  amount = +amount;
  const zn = zone || 'body';
  // Зона добивающего удара — для эффекта смерти (см. deathZoneFx).
  player._deathZone = zn;
  if (zn === 'head' && src !== 'frag' && src !== 'RPG') amount *= 2;
  else if (zn === 'legs') amount *= 0.7;

  let mult = Number(player.damageTakenMult);
  if (!isFinite(mult) || mult < 0) mult = 1;

  const eff = amount * mult;
  const absorbed = Math.min(player.armor, eff * 0.6);
  player.armor -= absorbed;
  player.hp -= eff - absorbed;
  // Адреналин носильщика флага: под огнём +10% к бегу на 3с (см. move()).
  // Без огня бонуса нет — иначе вора в спину не догнать никогда.
  try {
    const sc = player.scene;
    if ((sc.blueFlag && sc.blueFlag.carrier === player) ||
        (sc.redFlag && sc.redFlag.carrier === player)) {
      player._adrenalineUntil = (sc.time ? sc.time.now : 0) + 3000;
    }
  } catch (e) {}
  // Статистика урона для TAB-табло.
  if (attacker && attacker !== player) {
    attacker.damageDealt = (attacker.damageDealt | 0) + Math.max(0, Math.round(amount));
    // Журнал моих попаданий (k210): слепок жертвы ПОСЛЕ урона.
    try {
      if (player.scene && typeof player.scene._logHit === 'function') {
        player.scene._logHit(attacker, player);
      }
    } catch (e) {}
    // Недельный контракт «урон»: только живому человеку (не бот, не демо).
    try {
      if (!attacker.isAI && !attacker._demoPuppet && !attacker.dead) {
        const ps = getPass();
        ps.damage = (ps.damage | 0) + Math.max(0, Math.round(amount));
        attacker._wDmgTick = ((attacker._wDmgTick | 0) + 1) % 50;
        if (attacker._wDmgTick === 0) saveGameState();
      }
    } catch (e) {}
  }

  if (player.hp <= 0) {
    die(player, attacker);
  } else if (player.ai && typeof player.ai.onShot === 'function') {
    player.ai.onShot(attacker, player.scene.time.now);
  }
}

export function die(player, killer) {
  // Идемпотентность: повторный вызов по трупу ничего не делает
  // (иначе двойные deaths/дропы флага при гонке урона).
  if (player.dead) return;
  // Журнал убийств (k211): кто/кого/где/чем — пишется до сброса состояний.
  try {
    if (player.scene && typeof player.scene._logKill === 'function') {
      player.scene._logKill(killer, player);
    }
  } catch (e) {}
  player.dead = true;
  // Кровь смерти по ТЗ попаданий: веер + след (лёгкая, без каши).
  // Нет метода — тихо пропускаем (сеть/превью без арта).
  try { if (player.scene && typeof player.scene.spawnDeath === 'function') player.scene.spawnDeath(player.x, player.y); } catch (e) {}
  // Смерть гасит ульту классов: их die() при уроне не вызывается
  // (урон идёт напрямую сюда) — без этого аура медика висит на трупе
  // и продолжает лечить, а штурмовик/танк остаются красными/стальными.
  // Чистилки идемпотентны: без активной ульты — no-op.
  try { if (player._ultTimer) { try { player._ultTimer.remove(); } catch (e2) {} player._ultTimer = null; } } catch (e) {}
  try { if (typeof player._cancelUltimate === 'function') player._cancelUltimate(); } catch (e) {}
  try { if (typeof player._clearUltFx === 'function') player._clearUltFx(); } catch (e) {}
  try {
    if ((player.ultActive || player._ultWeapon) && typeof player._revertUltimate === 'function') {
      player._revertUltimate();
    }
  } catch (e) {}
  // Тень гаснет вместе с телом.
  try {
    if (player._shadow) player._shadow.setVisible(false);
  } catch (e) {}
  // Умер в замахе до релиза — граната не сгорела: возвращаем в сток.
  // Кап — по прокачке (людям) / 2 (ботам).
  if (player._throwT >= 0 && player._throwType) {
    try {
      const t = player._throwType;
      if (t === 'frag') {
        const capF = player.isAI ? 2 : fragMax();
        player.fragGrenades = Math.min(capF, (player.fragGrenades | 0) + 1);
      }
      if (t === 'smoke') {
        const capS = player.isAI ? 2 : smokeMax();
        player.smokeGrenades = Math.min(capS, (player.smokeGrenades | 0) + 1);
      }
    } catch (e) {}
    player._throwT = -1;
    player._throwType = null;
  }
  // Смерть сбрасывает все временные баффы ульты.
  // Бонус флага (+10 moveSpeedPct) снимает Flag.drop() — его дёргает
  // сцена (handleDeath) и Flag.update при carrier.dead; здесь не трогаем,
  // иначе будет двойное вычитание.
  // Боты: откатываемся к множителю сложности, а не к 1 — иначе ветеран
  // после первой смерти теряет +20% урона, а новичок свой штраф.
  player.damageMult = (player.isAI && player._diffDmgMult) || 1;
  player.damageTakenMult = 1;
  player.spreadMult = 1;
  player.fireRateMult = 1;
  try {
    (player.inventory || []).forEach(w => {
      if (!w) return;
      w.fireRateMult = 1;
      w.infiniteAmmo = !!w.isMelee;
    });
  } catch (e) {}
  player._throwT = -1;
  player.ultActive = false;
  player.forceWalk = false;
  if (player._ultActiveTimer) { try { player._ultActiveTimer.remove(); } catch (e) {} player._ultActiveTimer = null; }
  player.setVelocity(0, 0);
  player.setActive(false);
  player.setVisible(false);
  // Сброшенная перезарядка не должна «добивать» таймером после смерти.
  try {
    player.inventory.forEach(w => w && w.cancelReload && w.cancelReload());
  } catch (e) {}

  if (player.aura) {
    player.aura.setVisible(false);
  }
  // Кольцо госпиталя не висит после смерти медика.
  if (player._ultRingT) {
    try { player._ultRingT.remove(); } catch (e) {}
    player._ultRingT = null;
  }
  if (player._ultRing) {
    try { player._ultRing.destroy(); } catch (e) {}
    player._ultRing = null;
  }
  player._setGunVisible(false);
  player._setPartsVisible(false);

  player.healthBar.setVisible(false);
  player.armorBar.setVisible(false);
  player.nameText.setVisible(false);
  try { if (player.nameBadge) player.nameBadge.setVisible(false); } catch (e) {}
  player.head.setVisible(player.art && player.art.head ? false : false);
  player.neck.setVisible(false);

  // Эффект смерти: вспышка + расходящееся кольцо + осколки.
  // Depth 30 — поверх бойцов и дыма (8), ниже модалок/бана.
  // Хедшот: кольца нет — вместо него веер осколков (см. ниже),
  // чтобы смерть в голову визуально отличалась от тела.
  try {
    const sc = player.scene, dx = player.x, dy = player.y - 30;
    const zn0 = player._deathZone || 'body';
    if (sc && sc.add && sc.tweens) {
      const flash = sc.add.circle(dx, dy, 26, 0xffffff, 0.9).setDepth(30);
      sc.tweens.add({
        targets: flash, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: 350,
        onComplete: () => { try { flash.destroy(); } catch (e) {} }
      });
      if (zn0 !== 'head') {
        const ring = sc.add.circle(dx, dy, 10, 0xff4444, 0).setDepth(30);
        try { ring.setStrokeStyle(4, 0xff4444, 0.9); } catch (e) {}
        sc.tweens.add({
          targets: ring, scaleX: 4.2, scaleY: 4.2, alpha: 0, duration: 650,
          onComplete: () => { try { ring.destroy(); } catch (e) {} }
        });
      } else {
        // Веер осколков вместо кольца: прямоугольники с вращением,
        // красно-золото-белые, разлетаются во все стороны.
        for (let i = 0; i < 9; i++) {
          try {
            const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
            const cols = [0xff2222, 0xff2222, 0xffd24a, 0xffffff];
            const sh = sc.add.rectangle(dx, dy - 20, 3 + Math.random() * 5, 2 + Math.random() * 3,
              cols[i % cols.length], 1).setDepth(30);
            sc.tweens.add({
              targets: sh,
              x: dx + Math.cos(a) * (50 + Math.random() * 60),
              y: dy - 20 + Math.sin(a) * (45 + Math.random() * 55),
              rotation: (Math.random() * 2 - 1) * 6,
              alpha: 0, duration: 600 + Math.random() * 300,
              onComplete: () => { try { sh.destroy(); } catch (e) {} }
            });
          } catch (e) {}
        }
      }
      for (let i = 0; i < 6; i++) {
        try {
          const a = Math.random() * Math.PI * 2;
          const dot = sc.add.circle(dx, dy, 3, i % 2 ? 0xff6666 : 0xffffff, 1).setDepth(30);
          sc.tweens.add({
            targets: dot,
            x: dx + Math.cos(a) * (30 + Math.random() * 40),
            y: dy + Math.sin(a) * (20 + Math.random() * 30) - 20,
            alpha: 0, duration: 500 + Math.random() * 250,
            onComplete: () => { try { dot.destroy(); } catch (e) {} }
          });
        } catch (e) {}
      }
    }
  } catch (e) {}

  const dsrc = player._deathSrc;
  player._deathSrc = null;
  // Зональный эффект поверх общего burst выше.
  try { deathZoneFx(player); } catch (e) {}
  player.scene.handleDeath(player, killer, dsrc);
  player._deathZone = null;
}

// Эффект смерти по зоне добивания: голова — золотой фонтан вверх
// + надпись, тело — широкая красная вспышка, ноги — пыль и мало крови.
// Поверх общего burst (вспышка+кольцо+осколки) в die().
export function deathZoneFx(player) {
  try {
    const sc = player.scene;
    if (!sc || !sc.add || !sc.tweens) return;
    const zn = player._deathZone || 'body';
    if (zn === 'head') {
      const hx = player.x, hy = player.y - 62;
      const fl = sc.add.circle(hx, hy, 30, 0xffe27a, 0.95).setDepth(30);
      sc.tweens.add({
        targets: fl, scaleX: 0.25, scaleY: 0.25, alpha: 0, duration: 400,
        onComplete: () => { try { fl.destroy(); } catch (e) {} }
      });
      for (let i = 0; i < 10; i++) {
        try {
          // Фонтан вверх: угол в верхней полусфере.
          const a = -Math.PI / 2 + (Math.random() * 2 - 1) * 1.1;
          const dot = sc.add.circle(hx, hy, 2 + Math.random() * 3, i % 3 ? 0xff2222 : 0xffd24a, 1).setDepth(30);
          sc.tweens.add({
            targets: dot,
            x: hx + Math.cos(a) * (40 + Math.random() * 55),
            y: hy + Math.sin(a) * (50 + Math.random() * 60),
            alpha: 0, duration: 550 + Math.random() * 300,
            onComplete: () => { try { dot.destroy(); } catch (e) {} }
          });
        } catch (e) {}
      }
    } else if (zn === 'legs') {
      for (let i = 0; i < 5; i++) {
        try {
          const a = Math.random() * Math.PI * 2;
          const puff = sc.add.circle(
            player.x + (Math.random() * 2 - 1) * 14, player.y - 6,
            4 + Math.random() * 4, 0x9aa0a8, 0.55).setDepth(30);
          sc.tweens.add({
            targets: puff,
            x: puff.x + Math.cos(a) * 26, y: puff.y - 12 - Math.random() * 10,
            alpha: 0, duration: 500 + Math.random() * 200,
            onComplete: () => { try { puff.destroy(); } catch (e) {} }
          });
        } catch (e) {}
      }
      try {
        const d = sc.add.circle(player.x, player.y - 12, 14, 0xff3333, 0.7).setDepth(30);
        sc.tweens.add({
          targets: d, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: 300,
          onComplete: () => { try { d.destroy(); } catch (e) {} }
        });
      } catch (e) {}
    } else {
      // Тело: широкая красная вспышка поверх общей.
      try {
        const b = sc.add.circle(player.x, player.y - 30, 34, 0xff3333, 0.55).setDepth(30);
        sc.tweens.add({
          targets: b, scaleX: 1.7, scaleY: 1.7, alpha: 0, duration: 450,
          onComplete: () => { try { b.destroy(); } catch (e) {} }
        });
      } catch (e) {}
    }
  } catch (e) {}
}

export function heal(player, amount, src) {
  if (player.dead) return;
  const before = player.hp;
  player._healFrac = (player._healFrac || 0) + Number(amount) * (Number(player.healMult) || 1);
  if (!Number.isFinite(player._healFrac)) player._healFrac = 0;
  const whole = Math.floor(player._healFrac);
  player._healFrac -= whole;
  if (whole > 0) player.hp = Math.min(player.maxHp, player.hp + whole);
  if (player.hp > before) healPlus(player);
  // Вклад медика: реально восстановленное ХП союзнику (не себе).
  try {
    const got = player.hp - before;
    if (src && src !== player && got > 0 && src.team && src.team === player.team) {
      src.healedGiven = (src.healedGiven || 0) + got;
    }
  } catch (e) {}
}

// Зелёный плюсик над тем, кому прибавилось ХП (реже 250мс, чтобы аура
// 0.04/кадр не спамила).
export function healPlus(player) {
  try {
    const now = player.scene ? player.scene.time.now : 0;
    if (now - (player._plusAt || 0) < 250) return;
    player._plusAt = now;
    const t = player.scene.add.text(
      player.x + Phaser.Math.Between(-10, 10), player.y - 66, '+',
      { fontSize: '17px', color: '#44ff44', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(30);
    player.scene.tweens.add({
      targets: t, y: t.y - 26, alpha: 0, duration: 650,
      onComplete: () => t.destroy()
    });
  } catch (e) { /* плюсик не роняет игру */ }
}

export function restoreArmor(player, amount) {
  if (player.dead) return;
  player.armor = Math.min(player.maxArmor, player.armor + amount);
}

// Щит спавна 1с (k206/k208): взводит revive() и старт матча (см. GameScene).
// БЕЗ визуала на базе: база спрайта всегда невидима (alpha 0, риг —
// отдельные части), любой tween alpha её засвечивает командным
// прямоугольником позади модели. Молчаливый щит; индикатор — только
// отдельным кольцом (по запросу), не альфой тела.
export function applySpawnProt(player) {
  try {
    const now = player.scene ? player.scene.time.now : 0;
    player._spawnProtUntil = now + 1000;
  } catch (e) {}
}

export function revive(player, x, y) {
  player.dead = false;
  player.hp = player.maxHp;
  player.armor = player.maxArmor;    // Возрождение — чистый лист: сбрасываем баффы для надёжности
  // (die() уже сбросил, но ульта могла висеть на таймере).
  // Боты: множитель сложности переживает смерть (см. die()).
  player.damageMult = (player.isAI && player._diffDmgMult) || 1;
  player.damageTakenMult = 1;
  player.spreadMult = 1;
  player.fireRateMult = 1;
  try {
    (player.inventory || []).forEach(w => {
      if (!w) return;
      w.fireRateMult = 1;
      w.infiniteAmmo = !!w.isMelee;
    });
  } catch (e) {}
  player._healFrac = 0;
  player._deathSrc = null;
  player._throwT = -1;
  player._throwType = null;
  player.ultActive = false;
  player.forceWalk = false;
  if (player._ultActiveTimer) { try { player._ultActiveTimer.remove(); } catch (e) {} player._ultActiveTimer = null; }
  try { if (player._baseMoveSpeed) player.moveSpeed = player._baseMoveSpeed; } catch (e) {}
  // Гранаты — полный комплект по прокачке (людям) / базовый ботам:
  // потратил — умер — возродился — снова полный сток.
  if (player.isAI) {
    player.fragGrenades = 1;
    player.smokeGrenades = 1;
  } else {
    player.fragGrenades = fragMax();
    player.smokeGrenades = smokeMax();
  }
  player.inventory.forEach(w => w.resetAmmo());
  // Респаун — с основным оружием в руках, а не с пистолетом
  // (тот оставался после автосвитча при пустом основном).
  // Носильщику бомбы primary запрещён — selectWeapon сам откажет.
  try {
    const inv = player.inventory || [];
    const pi = inv.findIndex(w => w && w.category === 'primary' && !w.isMelee);
    if (pi >= 0) player.selectWeapon(pi);
  } catch (e) {}
  // Не появляемся внутри стены/ящика: иначе физика вышвыривает тело
  // (в т.ч. в небо). Ищем свободную точку выше. Радиус 30 (тело 56):
  // с меньшим низ застревает в грунте и приходится прыгать.
  // Глубина поиска 20 шагов (480px) — хватает и на толстый грунт.
  let nx = x, ny = y;
  try {
    const sc = player.scene;
    if (sc && typeof sc._inSolid === 'function') {
      let guard = 0;
      while (sc._inSolid(nx, ny, 30) && guard < 20) { ny -= 24; guard++; }
      if (sc._inSolid(nx, ny, 30)) { nx = x; ny = y; }
    }
  } catch (e) {}
  player.setPosition(nx, ny);
  player.setVelocity(0, 0);
  // k290: точка возрождения в журнал спавнов (карманы на спавне).
  try {
    if (player.scene && typeof player.scene._logSpawn === 'function') player.scene._logSpawn(player, nx, ny);
  } catch (e) {}
  player.setActive(true);
  player.setVisible(true);
  // База обязана остаться невидимой (alpha 0 как в конструкторе):
  // засвеченная база — командный прямоугольник позади модели (k208).
  // Лечит и тех, кого засветил tween щита k206.
  try { player.setAlpha(0); } catch (e) {}
  // Дотягиваем части к новой точке ДО показа: иначе кадр висит моделька
  // на месте смерти (позиции обновляются только в updateBars/updateGun).
  try { player.updateBars(); } catch (e) {}
  try { if (player.updateGun) player.updateGun(); } catch (e) {}
  // Возвращаем командный тинт футболки: после смерти/смены текстуры
  // висит сброшенный цвет (зелёный дефолт вместо синего/красного).
  // _partsTint — последний выданный тинт (команда со спавна).
  try { if (player._partsTint != null) player.setTint(player._partsTint); } catch (e) {}
  // Возрождаемся в рост: присел-умер-встал присевшим — хитбокс врёт.
  try { if (player.crouching) player.setCrouch(false); } catch (e) { player.crouching = false; }
  // Респаун без мгновенного выстрела: ИИ сбрасывает прицел,
  // ствол молчит первые полсекунды.
  const now = player.scene ? player.scene.time.now : 0;
  player._shootLockUntil = now + 500;
  // Щит спавна 1с (k206): самого факта возрождения под прицелом быть
  // не должно — секунду урон игнорит receiveDamage. Мигание — tween,
  // перфрейм-кода не требует.
  try { applySpawnProt(player); } catch (e) {}
  if (player.ai) {
    const ai = player.ai;
    // Канонический сброс (LOS/фланг/эскорт/навигация), иначе залипания.
    // Осмотр 0.5с после респауна по ТЗ — сразу тут, _wasDead-ветка
    // после revive уже не сработает (флаг сброшен).
    try {
      if (typeof ai.resetAfterDeath === 'function') ai.resetAfterDeath(now, now + 500);
    } catch (e) {}
    ai._abilityAt = 0;
  }

  if (player.aura) {
    player.aura.setVisible(true);
  }
  player._setGunVisible(true);
  player._setPartsVisible(true);
  // Сброс дымового госта: убили в дыму — возрождаемся видимым.
  // Базовый спрайт-заглушка остаётся спрятанным (alpha 0), как в конструкторе.
  try {
    player._smokeHidden = false;
    try { player.alpha = 0; } catch (e) {}
    const parts = (typeof player._smokeParts === 'function') ? player._smokeParts() : [];
    parts.forEach(o => {
      if (!o) return;
      try { if (player.scene) player.scene.tweens.killTweensOf(o); } catch (e) {}
      try { o.alpha = 1; } catch (e) {}
    });
  } catch (e) {}

  const showBars = player.isAI && player.team === 'blue';
  player.healthBar.setVisible(showBars);
  player.armorBar.setVisible(showBars);
  player.nameText.setVisible(true);
  player.head.setVisible(player.art && player.art.head ? false : true);
  player.neck.setVisible(true);
}
