// bullets.js — пули: спавн, свип-тест против туннелинга, урон по зонам, взрыв RPG.
// Было в GameScene (spawnBullet/_bulletHitWall/_sweepBullets/_hitZone/explodeRPG).
// Функции принимают сцену; вызовы LOS/звуков/эффектов — через сцену
// (обёртки с теми же именами), класс Bullet импортируем напрямую как в modes/trial.js.
import Bullet from '../entities/Bullet.js?v=169';
import { tintTracer, isAllyShot } from './fx.js?v=320';

export function spawnBullet(scene, owner, angle, damage, range, startX, startY, visual) {
  if (owner !== scene.player && scene.mode === 'CAMPAIGN') {
    damage *= 0.7;
  }
  // Выстрел слышно: боты рядом идут проверять.
  try {
    const bx = startX != null ? startX : owner.x;
    const by = startY != null ? startY : owner.y;
    scene._alertNoise(bx, by, 700);
  } catch (e) {}

  const bullet = new Bullet(
    scene,
    startX != null ? startX : owner.x + Math.cos(angle) * 25,
    startY != null ? startY : owner.y - 10 + Math.sin(angle) * 25,
    angle, damage, owner, range
  );

  bullet.hitApplied = false;
  // Старт пули для свип-теста и проверки LOS по ТРАЕКТОРИИ
  // (а не по линии «центр стрелка → центр цели»).
  bullet._sx = bullet.x;
  bullet._sy = bullet.y;

  // Визуал трассера ВМЕСТО спрайта пули: спрайт прячем (кроме ракеты),
  // линию рисует drawTracers одним Graphics за кадр. Стиль по классу:
  // снайперы — длинные тонкие холодные, пулемёты — длинные тёплые,
  // пистолеты — короткие, винтовки/автоматы — стандартные яркие,
  // дробь — короткие тусклые (3–5 видимых), ракета — толстая.
  // visual === false: дробинка без отрисовки (только урон).
  const w = owner.weapon || {};
  const pellets = w.pellets || 1;
  const isRocket = w.name === 'RPG';
  if (isRocket && scene.textures.exists('bullet_RPG')) {
    bullet.setTexture('bullet_RPG');
    bullet.setScale(1.4);
  } else if (!isRocket) {
    // Пулю не видно — только трассер (физика и урон как были).
    bullet.setVisible(false);
  }
  bullet._tracer = visual === false ? null : isRocket
    ? { len: 20, color: 0xffcc66, w: 3 }
    : pellets > 1
      ? { len: 10, color: 0xccbb88, w: 2 }
      : (w.range || 0) >= 1000
        ? { len: 34, color: 0xd8f4ff, w: 2 }
        : (w.name === 'minigun' || w.name === 'M249')
          ? { len: 22, color: 0xffd28a, w: 2 }
          : w.category === 'secondary'
            ? { len: 16, color: 0xffe9a8, w: 2 }
            : { len: 26, color: 0xfff2aa, w: 2 };
  // Свой/чужой: свои чуть синее, чужие чуть краснее (см. fx.js).
  try {
    if (bullet._tracer) bullet._tracer.color = tintTracer(bullet._tracer.color, isAllyShot(scene, owner));
  } catch (e) {}
  bullet.isRocket = isRocket;

  bullet._cols = [];
  // Реестр живых пуль для свип-теста против туннелинга (см. sweepBullets).
  // Попадания и столкновения со стенами обрабатывает sweepBullets вручную —
  // физические коллайдеры/оверлапы на пулю НЕ создаём: каждый из них (×N
  // игроков и ×2 группы статики) умножался на число пуль в полёте и давал
  // квадратичный рост стоимости физического шага (и spawnBullet был O(N)
  // на каждый выстрел). Это и было причиной просадки FPS при росте числа ботов.
  try {
    scene._bullets = scene._bullets || [];
    scene._bullets.push(bullet);
    if (scene._sawCounts) scene._sawCounts.bdSpawn = (scene._sawCounts.bdSpawn || 0) + 1;
  } catch (e) {}
  return bullet;
}

// ВСЕ коллайдеры пули складываем в bullet._cols: движок их сам НЕ чистит,
// без этого каждый выстрел навсегда оставлял ~3×N записей в мире физики
// (N = игроков) — список рос тысячами и FPS умирал. Чистятся в destroy().
// Попадание пули в стену: ракета взрывается, пуля даёт искры + пыль.
export function bulletHitWall(scene, bullet) {
  try {
    if (!bullet || !bullet.active) return;
    // k456: счётчики причины (стена). bdWallNear — стена поймала пулю
    // в 120px от живого врага (важный подозреваемый «не долетает»).
    try {
      if (scene && scene._sawCounts) {
        scene._sawCounts.bdWall = (scene._sawCounts.bdWall || 0) + 1;
        for (const t of (scene.players || [])) {
          if (!t || t === bullet.owner || t.dead || t.active === false) continue;
          if (t.team === (bullet.owner && bullet.owner.team)) continue;
          if (Math.hypot(t.x - bullet.x, t.y - bullet.y) < 120) {
            scene._sawCounts.bdWallNear = (scene._sawCounts.bdWallNear || 0) + 1;
            break;
          }
        }
      }
    } catch (eC) {}
  if (bullet.isRocket) {
    scene.explodeRPG(bullet);
  } else {
    // Стена: серая крошка + пыль (жёлтых искр больше нет — ТЗ попаданий).
    scene.spawnImpact(bullet.x, bullet.y, 0x8a8578, 3);
    scene.spawnDust(bullet.x, bullet.y);
  }
    bullet.destroy();
  } catch (e) {
    try { bullet.destroy(); } catch (e2) {}
  }
}

// Свип-тест пуль против туннелинга: 1700px/s = ~28px/кадр, тонкие
// платформы (8–16) и маленькие круги головы сидящего (Ø ~16-18)
// пролетаются между физшагами. Проверяем отрезок prev→cur каждого
// кадра вместо точечной коллизии — и по стенам, и по бойцам.
// Кто ближе по отрезку (стена или боец) — тот и ловит пулю:
// иначе гонка оверлапа/коллайдера в одном физшаге давала урон
// сквозь платформу или, наоборот, гасила пулю стеной при честном
// попадании во врага перед ней («летит мимо у платформ»).
export function sweepBullets(scene) {
  const arr = scene._bullets;
  if (!arr || !arr.length) return;
  let rects = null;
  try {
    rects = [];
    [scene.platforms, scene.covers].forEach(group => {
      if (!group) return;
      group.getChildren().forEach(o => {
        const b = o.body;
        if (!b || !b.enable) return;
        rects.push({ L: b.x, R: b.x + b.width, T: b.y, B: b.y + b.height });
      });
    });
    if (!rects.length && !(scene.players && scene.players.length)) return;
  } catch (e) { return; }
  for (let i = arr.length - 1; i >= 0; i--) {
    const b = arr[i];
    try {
      if (!b || !b.active) {
        if (!b || (b && !b.active)) arr.splice(i, 1);
        continue;
      }
      if (b.hitApplied) continue;
      const px = (typeof b._sweepX === 'number') ? b._sweepX : b.x;
      const py = (typeof b._sweepY === 'number') ? b._sweepY : b.y;
      b._sweepX = b.x;
      b._sweepY = b.y;
      if (px === b.x && py === b.y) continue;
      const segMinX = Math.min(px, b.x), segMaxX = Math.max(px, b.x);
      const segMinY = Math.min(py, b.y), segMaxY = Math.max(py, b.y);
      // Ближайший боец по отрезку (тело-прямоугольник + голова/шея-круги).
      let bestFoe = null, bestFoeT = 1e9, bestZone = 'body', bestHs = false;
      try {
        const list = scene.players || [];
        for (let pi = 0; pi < list.length; pi++) {
          const t = list[pi];
          if (!t || t === b.owner || t.dead || !t.active) continue;
          if (t.team === (b.owner && b.owner.team)) continue;
          const tb = t.body;
          if (tb && tb.enable !== false) {
            if (!(tb.x + tb.width < segMinX - 4 || tb.x > segMaxX + 4 ||
                  tb.y + tb.height < segMinY - 4 || tb.y > segMaxY + 4)) {
              const ht = scene._segRectT(px, py, b.x, b.y, tb.x, tb.y, tb.x + tb.width, tb.y + tb.height);
              if (ht != null && ht < bestFoeT) {
                bestFoe = t; bestFoeT = ht;
                bestHs = false; bestZone = scene._hitZone(t, py + (b.y - py) * ht);
              }
            }
          }
          // Голова и шея — круги (ловят туннелинг мимо Ø16 за 28px/кадр).
          const heads = [];
          try {
            if (t.head && t.head.body && t.head.body.enable !== false) {
              const hb = t.head.body;
              const hr = Math.max(4, (hb.width || 14) / 2);
              heads.push({ x: t.head.x, y: t.head.y, r: hr + 2, hs: true, zone: 'head' });
            }
            if (t.neck && t.neck.body && t.neck.body.enable !== false) {
              heads.push({ x: t.neck.x, y: t.neck.y, r: 10, hs: false, zone: 'body' });
            }
          } catch (e2) {}
          for (let hi = 0; hi < heads.length; hi++) {
            const hc = heads[hi];
            if (hc.x + hc.r < segMinX - 2 || hc.x - hc.r > segMaxX + 2 ||
                hc.y + hc.r < segMinY - 2 || hc.y - hc.r > segMaxY + 2) continue;
            const ht2 = scene._segCircleT(px, py, b.x, b.y, hc.x, hc.y, hc.r);
            if (ht2 != null && ht2 < bestFoeT) {
              bestFoe = t; bestFoeT = ht2; bestHs = hc.hs; bestZone = hc.zone;
            }
          }
        }
      } catch (e2) {}
      // Ближайшая стена по отрезку.
      let wallT = 1e9;
      for (let k = 0; k < rects.length; k++) {
        const rc = rects[k];
        if (rc.R < segMinX || rc.L > segMaxX || rc.B < segMinY || rc.T > segMaxY) continue;
        // Старт внутри солида (дуло в стене) — стена в нуле.
        const startIn = px + 2 > rc.L && px - 2 < rc.R && py + 2 > rc.T && py - 2 < rc.B;
        if (startIn) { wallT = -1; break; }
        const wt = scene._segRectT(px, py, b.x, b.y, rc.L, rc.T, rc.R, rc.B);
        if (wt != null && wt < wallT) wallT = wt;
      }
      if (bestFoe && bestFoeT <= wallT) {
        // Боец ближе стены (или стены нет): честное попадание.
        // Тот же урон, что в оверлапе: голова x2 + headshotMult.
        try {
          b.hitApplied = true;
          try { if (scene._sawCounts) scene._sawCounts.bdHit = (scene._sawCounts.bdHit || 0) + 1; } catch (eC2) {}
          const owner = b.owner;
  if (b.isRocket) { scene.explodeRPG(b); }
  else {
    // Кровь веером по направлению (в голову — больше).
    let _ang2 = 0;
    try {
      const _bv2 = b.body && b.body.velocity;
      if (_bv2) _ang2 = Math.atan2(_bv2.y, _bv2.x);
    } catch (e) {}
    try {
      if (typeof scene.spawnBlood === 'function') scene.spawnBlood(b.x, b.y, _ang2, !!bestHs);
      else scene.spawnImpact(b.x, b.y, 0xff3333, 4);
    } catch (e) {}
    bestFoe.receiveDamage(
      b.damage * (bestHs ? (owner.headshotMult || 1) : 1),
      owner, undefined, bestZone || 'body');
    b.destroy();
  }
        } catch (e2) { try { b.destroy(); } catch (e3) {} }
      } else if (wallT < 1e9) {
        scene._bulletHitWall(b);
      }
    } catch (e) {}
  }
}

// Зона попадания по телу для пуль: ниже верха ног — 'legs' (x0.7),
// иначе 'body' (x1). Голова — отдельным оверлапом. Ног как тел нет,
// поэтому срез по живому низу хитбокса и длине ног из рига.
export function hitZone(scene, target, bulletY) {
  try {
    const b = target && target.body;
    if (!b) return 'body';
    let legLen = (target._legThigh || 12) + (target._legShin || 12) + (target._shoeH || 8);
    // В приседе ноги поджаты: срез ног ниже, иначе почти весь
    // выросший до 38 хитбокс считался бы ногами x0.7 и сидящий
    // становился бы губкой. Половина длины ног — честно.
    if (target.crouching) legLen *= 0.55;
    if (bulletY >= b.bottom - legLen) return 'legs';
  } catch (e) {}
  return 'body';
}

// Взрыв ракеты: радиус = половина гранаты, урон 100% в центре → 30% на краю.
// Прямое попадание (120) сносит стокового бота.
export function explodeRPG(scene, bullet) {
  const cx = bullet.x;
  const cy = bullet.y;
  const owner = bullet.owner;
  const R = 98;
  const base = 120;
  bullet.destroy();
  scene._sfxAt('sfx_boom_rpg', cx, cy, 0.55);
  try { scene._alertNoise(cx, cy, 1000); } catch (e) {}

  const boom = scene.add.circle(cx, cy, 14, 0xffcc44, 1).setDepth(20);
  scene.tweens.add({
    targets: boom,
    radius: R,
    alpha: 0,
    duration: 350,
    onComplete: () => boom.destroy()
  });
  const flash = scene.add.circle(cx, cy, 26, 0xffffff, 0.9).setDepth(21);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scaleX: 0.3,
    scaleY: 0.3,
    duration: 140,
    onComplete: () => flash.destroy()
  });
  scene.cameras.main.shake(220, 0.012);

  scene.players.forEach(target => {
    if (target.dead || target.team === (owner && owner.team)) return;
    const d = Phaser.Math.Distance.Between(cx, cy, target.x, target.y - 20);
    if (d > R) return;
    // Стены/перекрытия режут взрыв: урон — только если видна хоть голова.
    // Строго по геометрии, дым не защищает. Плита между (я под платформой,
    // граната/ракета на ней) — всегда блок, даже если луч чиркнул край.
    // Точки приседания ниже: в приседе голова не там, где стоя.
    if (scene._blastBlockedBySlab(cx, cy, target.x, target.y)) return;
    const cr = !!(target && target.crouching);
    const tBodyY = target.y - (cr ? 15 : 28);
    const tHeadY = target.y - (cr ? 30 : 62);
    if (!scene.hasBlastLos(cx, cy, target.x, tBodyY) &&
        !scene.hasBlastLos(cx, cy, target.x, tHeadY)) return;
    const dmg = base * (1 - 0.7 * (d / R));
    // Стекло (п.14.2): взрывы тоже ×2.
    try {
      if (scene && Array.isArray(scene.mutators) && scene.mutators.includes('glass')) {
        target.receiveDamage(dmg * 2, owner, 'RPG');
      } else target.receiveDamage(dmg, owner, 'RPG');
    } catch (e) { target.receiveDamage(dmg, owner, 'RPG'); }
  });
}
