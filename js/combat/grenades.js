// grenades.js — гранаты: бросок, взрыв осколочной, дым, призрак в дыму.
// Было в GameScene (throwGrenade/explodeGrenade/emitSmoke/_setSmokeGhost).
// Функции принимают сцену; класс Grenade импортируем напрямую как в modes/trial.js.
import Grenade from '../entities/Grenade.js?v=172';

export function throwGrenade(scene, owner, type, angle) {
  // Бросок из приседа — из низкой руки (y-20), а не из стоячей (y-38):
  // иначе граната спавнится ВНУТРИ платформы над головой и
  // escapeGeometry выталкивает её НАВЕРХ яруса — бросок сквозь платформу.
  const crouch = !!(owner && owner.crouching);
  const spawnDy = crouch ? -20 : -38;
  let sx = owner.x + Math.cos(angle) * 30;
  let sy = owner.y + spawnDy;
  // Упор головой в плиту: точка спавна внутри неё — выводим ВНИЗ
  // к бросающему (до 80px), а не min-pen наружу: тонкая плита иначе
  // выталкивает наверх. Глубоко внутри — роняем к ногам.
  try {
    if (scene._inSolid(sx, sy, 6)) {
      let ny = sy;
      for (let i = 0; i < 10; i++) {
        ny += 8;
        if (!scene._inSolid(sx, ny, 6)) break;
      }
      if (!scene._inSolid(sx, ny, 6)) sy = ny;
      if (scene._inSolid(sx, sy, 6)) { sx = owner.x; sy = owner.y - 5; }
    }
  } catch (e) {}
  const grenade = new Grenade(
    scene,
    sx,
    sy,
    angle,
    type,
    owner
  );
  scene.grenades.add(grenade);
  scene._sfxAt('sfx_throw', owner.x, owner.y, 0.6);
}

// Мягкий спрайт для взрывов/дыма: радиальный градиент (плотное ядро →
// растворённые края). Печётся один раз, тонируется под задачу.
function _softTex(scene) {
  try {
    if (!scene.textures.exists('__smoke_soft')) {
      const S = 128;
      scene.textures.createCanvas('__smoke_soft', S, S);
      const sctx = scene.textures.get('__smoke_soft').getSourceImage().getContext('2d');
      const grd = sctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      sctx.fillStyle = grd;
      sctx.fillRect(0, 0, S, S);
      scene.textures.get('__smoke_soft').refresh();
    }
    return scene.textures.exists('__smoke_soft');
  } catch (e) { return false; }
}

export function explodeGrenade(scene, grenade, owner) {
  const cx = grenade.x;
  const cy = grenade.y;
  const radius = 195;
  const maxDamage = 120;

  grenade.destroy();
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
  scene._sfxAt('sfx_boom', cx, cy, 0.55);
  try { scene._alertNoise(cx, cy, 1000); } catch (e) {}

  // --- По ТЗ осколочной: вспышка → огненный шар → осколки/искры → грязный дым.
  // Всё быстро и жёстко (не медленная завеса): вспышка 140мс, шар ~450мс,
  // искры ~600мс, дым ~2.2с. Урон и тряска ниже — без изменений.
  const hasSoft = _softTex(scene);
  // 1. Ослепительное ядро + тёплая заливка вокруг (аддитив — светится).
  if (hasSoft) {
    try {
      const flash = scene.add.image(cx, cy, '__smoke_soft').setDepth(20).setTint(0xffffff).setAlpha(1);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      flash.setScale(0.6);
      scene.tweens.add({
        targets: flash, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 140,
        onComplete: () => { try { flash.destroy(); } catch (e) {} }
      });
      const wash = scene.add.image(cx, cy, '__smoke_soft').setDepth(19).setTint(0xffbe78).setAlpha(0.55);
      wash.setBlendMode(Phaser.BlendModes.ADD);
      wash.setScale(0.8);
      scene.tweens.add({
        targets: wash, scaleX: 3.2, scaleY: 3.2, alpha: 0, duration: 220, ease: 'Cubic.Out',
        onComplete: () => { try { wash.destroy(); } catch (e) {} }
      });
    } catch (e) {}
  }
  // 2. Огненный шар: рваный, от бело-жёлтого в центре к тёмно-красному
  // по краям; быстро расширяется и тут же гаснет.
  {
    const tints = [0xfff6d8, 0xffe27a, 0xffb13c, 0xff7a2a, 0xe04a1a, 0x7a2a12];
    for (let i = 0; i < 6; i++) {
      try {
        const key = hasSoft ? '__smoke_soft' : null;
        const s = key
          ? scene.add.image(cx + Phaser.Math.Between(-30, 30), cy + Phaser.Math.Between(-20, 20), key).setDepth(19).setTint(tints[i % tints.length]).setAlpha(0.9)
          : scene.add.circle(cx, cy, 30, tints[i % tints.length], 0.9).setDepth(19);
        const r1 = 90 + Math.random() * 70;
        const g1 = key ? (r1 * 2) / 128 : r1 / 30;
        s.setScale(0.4);
        scene.tweens.add({
          targets: s, scaleX: g1, scaleY: g1 * 0.85, alpha: 0,
          x: '+=' + Phaser.Math.Between(-40, 40), y: '-=' + Phaser.Math.Between(10, 50),
          duration: 380 + Math.random() * 180, ease: 'Cubic.Out',
          onComplete: () => { try { s.destroy(); } catch (e) {} }
        });
      } catch (e) {}
    }
  }
  // 3. Искры: яркие точки с аддитивом, разлёт с затуханием.
  for (let i = 0; i < 10; i++) {
    try {
      const a = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 130;
      const sp = scene.add.circle(cx, cy, 2.5, (i % 2) ? 0xffe9a8 : 0xff9a3c, 1).setDepth(21);
      try { sp.setBlendMode(Phaser.BlendModes.ADD); } catch (e) {}
      scene.tweens.add({
        targets: sp,
        x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist * 0.7 - Math.random() * 40,
        alpha: 0, duration: 280 + Math.random() * 320, ease: 'Cubic.Out',
        onComplete: () => { try { sp.destroy(); } catch (e) {} }
      });
    } catch (e) {}
  }
  // 4. Обломки: тёмные куски вверх-в стороны, падают и гаснут.
  for (let i = 0; i < 8; i++) {
    try {
      const a = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 110;
      const db = scene.add.rectangle(cx, cy, 3 + Math.random() * 5, 2 + Math.random() * 4, 0x2a2018, 1).setDepth(18);
      const upX = cx + Math.cos(a) * dist, upY = cy - Math.abs(Math.sin(a)) * dist - 20;
      scene.tweens.add({
        targets: db, x: upX, y: upY, angle: Phaser.Math.Between(-540, 540),
        duration: 200 + Math.random() * 120, ease: 'Cubic.Out',
        onComplete: () => {
          try {
            scene.tweens.add({
              targets: db, y: upY + 120 + Math.random() * 60, alpha: 0,
              duration: 380 + Math.random() * 120, ease: 'Quad.easeIn',
              onComplete: () => { try { db.destroy(); } catch (e) {} }
            });
          } catch (e) { try { db.destroy(); } catch (e2) {} }
        }
      });
    } catch (e) {}
  }
  // 5. Грязный дым и пыль: тёмные, стелются по земле, живут ~2.2с.
  for (let i = 0; i < 6; i++) {
    try {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 90;
      const tx = cx + Math.cos(a) * r;
      const ty = cy + Math.abs(Math.sin(a)) * r * 0.45 + 6;
      const tint = [0x4a4038, 0x5a4a3a, 0x3a332c][i % 3];
      const key = hasSoft ? '__smoke_soft' : null;
      const s = key
        ? scene.add.image(cx, cy - 10, key).setDepth(8).setTint(tint).setAlpha(0)
        : scene.add.circle(cx, cy - 10, 40, tint, 0).setDepth(8);
      const endR = 40 + Math.random() * 30;
      s.setScale(0.15);
      const g1 = key ? (endR * 2) / 128 : endR / 40;
      scene.tweens.add({
        targets: s, delay: 120 + i * 60,
        x: tx, y: ty - 30, scaleX: g1, scaleY: g1 * 0.7, alpha: 0.5,
        duration: 900, ease: 'Cubic.Out'
      });
      scene.tweens.add({
        targets: s, delay: 1400,
        alpha: 0, duration: 800,
        onComplete: () => { try { s.destroy(); } catch (e) {} }
      });
    } catch (e) {}
  }
  scene.cameras.main.shake(180, 0.008);

  scene.players.forEach(target => {
    if (target.dead || target.team === owner.team) return;
    const d = Phaser.Math.Distance.Between(cx, cy, target.x, target.y);
    if (d > radius) return;
    // Стены/перекрытия режут взрыв: урон — только если видна хоть голова.
    // Строго по геометрии (без льготы платформы под гранатой) и без дыма:
    // дым скрывает, но от осколков не защищает.
    // Плита между (я под платформой, граната на ней: прыгнул и упёрся
    // головой — урона НЕТ) — всегда блок, луч через край не считается.
    // Точки приседания ниже: в приседе голова не там, где стоя.
    if (scene._blastBlockedBySlab(cx, cy, target.x, target.y)) return;
    const cr2 = !!(target && target.crouching);
    const tBody2 = target.y - (cr2 ? 15 : 28);
    const tHead2 = target.y - (cr2 ? 30 : 62);
    if (!scene.hasBlastLos(cx, cy, target.x, tBody2) &&
        !scene.hasBlastLos(cx, cy, target.x, tHead2)) return;
    const falloff = 1 - (d / radius) * 0.55;
    // Стекло (п.14.2): взрывы тоже ×2.
    let gDmg = Math.round(maxDamage * falloff);
    try {
      if (scene && Array.isArray(scene.mutators) && scene.mutators.includes('glass')) gDmg *= 2;
    } catch (e) {}
    target.receiveDamage(gDmg, owner, 'frag');
  });
}

export function emitSmoke(scene, grenade) {
  const cx = grenade.x;
  const cy = grenade.y;
  // Владельца забираем до destroy (оттенок дыма — по его команде).
  const ownerTeam = grenade.owner && grenade.owner.team;
  grenade.destroy();
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
  scene._sfxAt('sfx_boom_smoke', cx, cy, 0.45);

  // Визуал растёт из точки ВЗРЫВА и только вверх: низ клубов не уходит
  // под землю (gy выше cy, дрейф вверх усилен).
  const gy = cy - 22;

  // Оттенки по владельцу (смотрит viewer): два яруса — дальний темнее
  // и спокойнее, передний светлее и подвижнее (глубина по ТЗ дыма).
  let backTint = 0xa3a3a3, frontTint = 0xdbdbdb;
  try {
    const myTeam = scene.player && scene.player.team;
    const ally = (ownerTeam && myTeam) ? (ownerTeam === myTeam) : (ownerTeam === 'blue');
    if (ownerTeam) {
      backTint = ally ? 0x93a3cf : 0xcf9c8a;
      frontTint = ally ? 0xccd9f7 : 0xffd3c2;
    }
  } catch (e) {}
  // Мягкий спрайт клуба (общий со взрывом, см. _softTex выше).
  _softTex(scene);
  // Рождение: мягкий хлопок (не вспышка) — резкий выброс в стороны и вверх.
  try {
    const pop = scene.add.image(cx, gy, '__smoke_soft').setDepth(8).setTint(frontTint).setAlpha(0.35);
    pop.setScale(0.25);
    scene.tweens.add({
      targets: pop, scaleX: 1.5, scaleY: 1.1, alpha: 0, duration: 380, ease: 'Cubic.Out',
      onComplete: () => { try { pop.destroy(); } catch (e) {} }
    });
  } catch (e) {}
  // Масса: 14 клубов — 7 внутренних плотных + 7 внешних рваных.
  // Облако приплюснуто (ry × 0.62) и жмётся к земле; края разрежены.
  // Чётные — дальний ярус (темнее, медленнее), нечётные — передний.
  const radius = 95;
  const playR = radius + 40;
  const clouds = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const inner = i < 7;
    const frac = (((i % 7) + 0.5) / 7);
    const rr = inner ? 0.55 : 1.0;
    const r = playR * Math.sqrt(frac) * 0.92 * rr;
    const a = i * 2.399963 + Math.random() * 0.5;
    const tx = cx + Math.cos(a) * r;
    const ty = cy + Math.sin(a) * r * 0.62 - 8;
    const endR = inner ? 55 + Math.random() * 20 : 42 + Math.random() * 18;
    const back = (i % 2 === 0);
    // Два этажа против драки твинов: держатель едет и растёт (подъём),
    // круг внутри блуждает с первой секунды; скейл круга — только ужатие.
    const holder = scene.add.container(cx, gy).setDepth(back ? 7 : 9);
    const puff = scene.add.image(0, 0, '__smoke_soft');
    try { puff.setTint(back ? backTint : frontTint); } catch (e) {}
    puff.setAlpha(0);
    holder.add(puff);
    puff._holder = holder;
    clouds.push(puff);
    const growTo = (endR * 2) / 128;
    holder.setScale(0.125);
    const riseEnd = i * 70 + 1100;
    scene.tweens.add({
      targets: holder, delay: i * 70,
      x: tx + Phaser.Math.Between(-24, 24), y: ty - 44,
      scaleX: growTo, scaleY: growTo, duration: 1100, ease: 'Cubic.Out'
    });
    scene.tweens.add({
      targets: puff, delay: i * 70,
      alpha: inner ? 0.5 : 0.3, duration: 900
    });
    const wx = Phaser.Math.Between(back ? 12 : 18, back ? 20 : 30) * (Math.random() < 0.5 ? -1 : 1);
    const wy = Math.round(Phaser.Math.Between(-22, 10) * (back ? 0.6 : 1));
    scene.tweens.add({
      targets: puff, delay: i * 70,
      x: '+=' + wx, y: '+=' + wy,
      duration: (back ? 1400 : 1000) + Math.random() * 800, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1
    });
    // Внешние отрываются: после подъёма держатель медленно ползёт наружу.
    if (!inner) {
      scene.tweens.add({
        targets: holder, delay: riseEnd,
        x: '+=' + Math.round(Math.cos(a) * 34), y: '+=' + Math.round(Math.sin(a) * 16 - 8),
        duration: 2200, ease: 'Sine.easeInOut'
      });
    }
    // Ужатие к концу действия (6.5с) — клуб сжимается полностью в точку.
    scene.tweens.add({
      targets: puff, delay: i * 70,
      scaleX: 0, scaleY: 0, duration: Math.max(600, 6500 - i * 70),
      ease: 'Sine.easeIn'
    });
  }

  scene.smokeClouds.push({ x: cx, y: cy, radius: radius + 40 });

  // Рассеивание за 1.2с до конца (вместо резкого пропадания).
  // Fade — только альфа: с ужатием и блужданием не конфликтует
  // (разные поля), они дотухают сами к финалу ниже.
  scene.time.delayedCall(5300, () => {
    clouds.forEach(c => {
      if (!c || !c.active) return;
      try {
        scene.tweens.add({
          targets: c, alpha: 0, duration: 1200,
          onComplete: () => {
            try { c.destroy(); } catch (e) {}
            try { if (c._holder) c._holder.destroy(); } catch (e2) {}
          }
        });
      } catch (e) {
        try { c.destroy(); } catch (e2) {}
        try { if (c && c._holder) c._holder.destroy(); } catch (e3) {}
      }
    });
  });
  scene.time.delayedCall(6500, () => {
    // Сначала глушим твины цели, потом сносим: fade-твин кончается
    // в этот же тик (5300+1200) — без killTweensOf он пишет
    // в уже уничтоженный круг и роняет игру.
    clouds.forEach(c => {
      try { if (c) scene.tweens.killTweensOf(c); } catch (e) {}
      try { if (c && c._holder) scene.tweens.killTweensOf(c._holder); } catch (e) {}
      try { c.destroy(); } catch (e) {}
      try { if (c && c._holder) c._holder.destroy(); } catch (e) {}
    });
    const idx = scene.smokeClouds.findIndex(s => s.x === cx && s.y === cy);
    if (idx >= 0) scene.smokeClouds.splice(idx, 1);
  });
}

// Плавное скрытие/возврат бота в дыму (220мс): ВСЯ тушка через
// _smokeParts (тело — отдельные картинки, не базовый спрайт) + полоски
// и тень. Без этого враг остаётся виден, а от полосок висел красный
// прямоугольник. Через alpha (не visible): не конфликтует с updateBars/revive.
export function setSmokeGhost(scene, p, hide) {
  try {
    if (!p) return;
    const objs = (typeof p._smokeParts === 'function')
      ? p._smokeParts()
      : [p, p.nameText, p.gunImg, p.healthBar, p.armorBar, p._shadow].filter(o => o && o.active !== false);
    objs.forEach(o => { try { scene.tweens.killTweensOf(o); } catch (e) {} });
    const a = hide ? 0 : 1;
    objs.forEach(o => {
      try {
        if (o.alpha !== a) scene.tweens.add({ targets: o, alpha: a, duration: 220 });
      } catch (e) {
        try { o.alpha = a; } catch (e2) {}
      }
    });
  } catch (e) {}
}
