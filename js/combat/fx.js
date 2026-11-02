// fx.js — вспышки, искры, пыль, гильзы, трассеры (было в GameScene).
// Принимают сцену, хранят только tracerGfx на сцене как раньше.

// Свой/чужой выстрел: свои (команда игрока) — чуть синее,
// чужие — чуть краснее. Только намёк (35% к синему/красному),
// классовый цвет трассера сохраняется.
export function isAllyShot(scene, owner) {
  try {
    if (!scene || !owner) return false;
    const me = scene.player;
    if (!me) return false;
    return owner === me || (owner.team != null && owner.team === me.team);
  } catch (e) { return false; }
}

export function tintTracer(base, ally) {
  try {
    const b = (base | 0) >>> 0;
    const r = (b >> 16) & 255, g = (b >> 8) & 255, bl = b & 255;
    const t = ally ? [106, 168, 255] : [255, 106, 90];
    const k = 0.35;
    const m = (c, i) => Math.max(0, Math.min(255, Math.round(c * (1 - k) + t[i] * k)));
    return (m(r, 0) << 16) | (m(g, 1) << 8) | m(bl, 2);
  } catch (e) { return base; }
}

export function spawnMuzzle(scene, x, y, angle) {
  const flash = scene.add.circle(x, y, 9, 0xfff2aa, 1).setDepth(19);
  scene.tweens.add({
    targets: flash,
    scaleX: 1.8,
    scaleY: 1.8,
    alpha: 0,
    duration: 110,
    onComplete: () => flash.destroy()
  });
  const smoke = scene.add.circle(
    x + Math.cos(angle) * 8, y + Math.sin(angle) * 8 - 4, 6, 0x9aa0a8, 0.45
  ).setDepth(19);
  scene.tweens.add({
    targets: smoke,
    y: smoke.y - 14,
    alpha: 0,
    duration: 650,
    onComplete: () => smoke.destroy()
  });
}

export function spawnImpact(scene, x, y, color, n) {
  const count = Math.max(1, Math.min(8, n || 4));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 8 + Math.random() * 18;
    const p = scene.add.rectangle(x, y, 3, 3, color, 1).setDepth(19);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d,
      alpha: 0,
      duration: 220 + Math.random() * 120,
      onComplete: () => p.destroy()
    });
  }
}

export function spawnDust(scene, x, y, PhaserRef) {
  const P = PhaserRef || ((typeof Phaser !== 'undefined') ? Phaser : null);
  const between = (a, b) => (P && P.Math && P.Math.Between)
    ? P.Math.Between(a, b)
    : (a + Math.random() * (b - a));
  // Только серая пыль (жёлтые искры убраны по ТЗ попаданий: никаких
  // вспышек, свечений и искр — только кровь, частицы, следы).
  for (let i = 0; i < 3; i++) {
    const px = x + between(-5, 5);
    const py = y + between(-5, 5);
    const p = scene.add.circle(px, py, 4 + Math.random() * 4, 0x9aa0a8, 0.5).setDepth(18);
    scene.tweens.add({
      targets: p,
      x: px + between(-24, 24),
      y: py - 10 - Math.random() * 16,
      alpha: 0,
      duration: 480 + Math.random() * 320,
      onComplete: () => p.destroy()
    });
  }
}

// Счётчик активных капель (анти-каша по ТЗ: при плотном огне новые
// попадания ужаты, а не копятся поверх).
function bloodTick(scene, d) {
  try {
    scene._bloodActive = Math.max(0, (scene._bloodActive | 0) + d);
  } catch (e) {}
}

// Попадание: короткий веер брызг в сторону полёта пули, капли разного
// размера (крупные дальше), росчерк по направлению, пара частиц ткани/пыли.
// Всё быстро гаснет; следующее попадание не наслаивается.
export function spawnBlood(scene, x, y, angle, big) {
  try {
    if (!scene || !scene.add) return;
    const busy = (scene._bloodActive | 0) > 25;
    const n = big ? (busy ? 6 : 11) : (busy ? 3 : 7);
    const spread = 0.7;
    for (let i = 0; i < n; i++) {
      if ((scene._bloodActive | 0) >= 40) break;
      const large = (i === 0) || (big && i < 4) || Math.random() < 0.25;
      const r = large ? 2.5 + Math.random() * 2 : 1.2 + Math.random() * 1.3;
      const a = angle + (Math.random() - 0.5) * 2 * spread + (Math.random() < 0.15 ? (Math.random() - 0.5) * 2 : 0);
      const d = large ? 20 + Math.random() * 22 : 8 + Math.random() * 12;
      const col = Math.random() < 0.7 ? 0xa01818 : 0x6a0d0d;
      const drop = scene.add.circle(x, y, r, col, 1).setDepth(19);
      bloodTick(scene, 1);
      scene.tweens.add({
        targets: drop,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d * 0.7 + 4 + Math.random() * 5,
        alpha: 0,
        duration: large ? 300 + Math.random() * 150 : 180 + Math.random() * 120,
        ease: 'Cubic.Out',
        onComplete: () => { try { drop.destroy(); } catch (e) {} bloodTick(scene, -1); }
      });
    }
    // росчерк по направлению выстрела
    try {
      const len = big ? 26 + Math.random() * 10 : 16 + Math.random() * 8;
      const st = scene.add.rectangle(x, y, len, 2, 0x8a1414, 0.8).setDepth(19);
      try { st.setOrigin(0, 0.5); st.rotation = angle; } catch (e) {}
      bloodTick(scene, 1);
      scene.tweens.add({
        targets: st, alpha: 0, duration: 200,
        onComplete: () => { try { st.destroy(); } catch (e) {} bloodTick(scene, -1); }
      });
    } catch (e) {}
    // пара частиц: ткань/пыль
    for (let i = 0; i < 2; i++) {
      try {
        const c = scene.add.rectangle(x, y, 3, 2, i ? 0x8a7a5c : 0x6a6a6a, 1).setDepth(19);
        bloodTick(scene, 1);
        const a2 = angle + (Math.random() - 0.5) * 1.6;
        scene.tweens.add({
          targets: c, x: x + Math.cos(a2) * (10 + Math.random() * 14), y: y + Math.sin(a2) * 10 - 4,
          angle: Math.random() * 180, alpha: 0, duration: 350 + Math.random() * 150,
          onComplete: () => { try { c.destroy(); } catch (e) {} bloodTick(scene, -1); }
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// Поиск горизонтальной поверхности строго под точкой (земля/ярус/ящик).
// Стены и потолки выше точки игнорируем. Нет поверхности в пределах
// падения — null (пятно не ставим, в воздухе лужи не висят).
function groundBelow(scene, x, y, maxFall) {
  let best = null;
  const groups = [];
  try { if (scene.platforms && scene.platforms.getChildren) groups.push(scene.platforms.getChildren()); } catch (e) {}
  try { if (scene.covers && scene.covers.getChildren) groups.push(scene.covers.getChildren()); } catch (e) {}
  groups.forEach(kids => {
    (kids || []).forEach(o => {
      try {
        if (!o || o.active === false) return;
        const bw = o.displayWidth || o.width, bh = o.displayHeight || o.height;
        if (!(bw > 4 && bh > 2)) return;
        if (x < o.x - bw / 2 - 4 || x > o.x + bw / 2 + 4) return;
        const top = (o.body && typeof o.body.top === 'number') ? o.body.top : o.y - bh / 2;
        if (top < y - 4) return;
        if (top - y > (maxFall || 600)) return;
        if (best == null || top < best) best = top;
      } catch (e) {}
    });
  });
  return best;
}

// Пятно крови на земле: остаётся как след боя, медленно сохнет и плавно исчезает через 20 секунд.
export function spawnStain(scene, x, y, s) {
  try {
    if (!scene || !scene.add) return;
    const gy = groundBelow(scene, x, y, 600);
    if (gy == null) return;
    x = Math.round(x); y = Math.round(gy + 3);
    scene._bloodStains = scene._bloodStains || [];
    
    // Генерируем уникальную форму каждого пятна (случайный размер, брызги, асимметрия)
    const seed = Math.random();
    const dotsCount = 2 + Math.floor(Math.random() * 4);
    const dots = [];
    for (let i = 0; i < dotsCount; i++) {
      dots.push({
        offsetX: (Math.random() - 0.5) * 44,
        offsetY: (Math.random() - 0.5) * 12,
        r: 1.2 + Math.random() * 2.8
      });
    }

    const stainObj = {
      x, y,
      w: (18 + Math.random() * 18) * (s || 1),
      h: 6 + Math.random() * 7,
      rot: (Math.random() - 0.5) * 0.5,
      alpha: 0.65,
      dots,
      createdAt: scene.time ? scene.time.now : Date.now()
    };

    scene._bloodStains.push(stainObj);
    if (scene._bloodStains.length > 25) scene._bloodStains.shift();

    // Создаем выделенный графический объект для этого пятна со своей твинью затухания
    const g = scene.add.graphics().setDepth(1);
    stainObj.gfx = g;

    const drawStain = () => {
      try {
        g.clear();
        g.fillStyle(0x7a1414, stainObj.alpha);
        g.fillEllipse(stainObj.x, stainObj.y, stainObj.w, stainObj.h);
        g.fillStyle(0x610f0f, stainObj.alpha);
        for (let d = 0; d < stainObj.dots.length; d++) {
          const dot = stainObj.dots[d];
          g.fillCircle(stainObj.x + dot.offsetX, stainObj.y + dot.offsetY, dot.r);
        }
      } catch (e) {}
    };

    drawStain();

    // 20 секунд плавного затухания и удаления
    scene.tweens.add({
      targets: stainObj,
      alpha: 0,
      duration: 5000,
      delay: 15000, // первые 15 секунд держится, последние 5 секунд плавно исчезает
      onUpdate: () => drawStain(),
      onComplete: () => {
        try {
          g.destroy();
          if (scene._bloodStains) {
            const idx = scene._bloodStains.indexOf(stainObj);
            if (idx >= 0) scene._bloodStains.splice(idx, 1);
          }
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// Смерть: усиленный, но читаемый выброс — веер во все стороны, обломки
// брони/ткани, облачко пыли и пятно на земле. Без перегруза.
export function spawnDeath(scene, x, y) {
  try {
    if (!scene || !scene.add) return;
    for (let i = 0; i < 12; i++) {
      if ((scene._bloodActive | 0) >= 48) break;
      const large = i < 4;
      const r = large ? 2.5 + Math.random() * 2.5 : 1.2 + Math.random() * 1.5;
      const a = Math.random() * Math.PI * 2;
      const d = large ? 22 + Math.random() * 26 : 8 + Math.random() * 14;
      const col = Math.random() < 0.65 ? 0xa01818 : 0x6a0d0d;
      const drop = scene.add.circle(x, y - 6, r, col, 1).setDepth(19);
      bloodTick(scene, 1);
      scene.tweens.add({
        targets: drop, x: x + Math.cos(a) * d, y: y - 6 + Math.sin(a) * d * 0.7 + 5,
        alpha: 0, duration: large ? 380 + Math.random() * 180 : 220 + Math.random() * 140,
        ease: 'Cubic.Out',
        onComplete: () => { try { drop.destroy(); } catch (e) {} bloodTick(scene, -1); }
      });
    }
    // обломки: броня/ткань/грязь
    const debrisCols = [0x4a4a52, 0x8a7a5c, 0x5a4a38, 0x3a3a3a];
    for (let i = 0; i < 4; i++) {
      try {
        const s = scene.add.rectangle(x, y - 6, 3 + Math.random() * 3, 2 + Math.random() * 2, debrisCols[i % debrisCols.length], 1).setDepth(19);
        const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 20;
        scene.tweens.add({
          targets: s, x: x + Math.cos(a) * d, y: y - 6 + Math.sin(a) * d * 0.6 + 8,
          angle: Math.random() * 270, alpha: 0, duration: 500 + Math.random() * 200,
          onComplete: () => { try { s.destroy(); } catch (e) {} }
        });
      } catch (e) {}
    }
    try { spawnDust(scene, x, y - 10); } catch (e) {}
    try { spawnStain(scene, x, y + 26, 1); } catch (e) {}
  } catch (e) {}
}

export function spawnShell(scene, x, y, dir) {
  const s = scene.add.rectangle(x, y, 5, 3, 0xd8a920, 1).setDepth(19);
  const side = Math.random() < 0.78 ? dir : -dir;
  const dx = side * (18 + Math.random() * 60);
  const peak = y - 10 - Math.random() * 26;
  const spin = (Math.random() * 2 - 1) * 5;
  const upT = 130 + Math.random() * 80;
  scene.tweens.add({
    targets: s,
    x: x + dx * 0.6,
    y: peak,
    rotation: spin,
    duration: upT,
    ease: 'Cubic.Out',
    onComplete: () => {
      if (!s.active) return;
      scene.tweens.add({
        targets: s,
        x: x + dx,
        y: peak + 40 + Math.random() * 14,
        alpha: 0,
        rotation: spin * 2,
        duration: 260 + Math.random() * 120,
        ease: 'Cubic.In',
        onComplete: () => s.destroy()
      });
    }
  });
}

export function drawTracers(scene) {
  if (!scene.tracerGfx) {
    scene.tracerGfx = scene.add.graphics().setDepth(3.9);
  }
  const g = scene.tracerGfx;
  g.clear();
  if (!scene.children) return;
  const list = scene.children.list;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (!o || !o.active || !o._tracer) continue;
    const t = o._tracer;
    const a = o.rotation || 0;
    g.lineStyle(t.w || 2, t.color || 0xfff2aa, 0.9);
    g.lineBetween(o.x, o.y, o.x - Math.cos(a) * t.len, o.y - Math.sin(a) * t.len);
  }
}
