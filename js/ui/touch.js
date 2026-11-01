// touch.js — мобильное управление: стик / динамический стик / кнопки (WASD).
// Показывается ТОЛЬКО на телефонах (isTouchCombat), на ПК всё как было.
// Схема — из gameSettings.js (getControlScheme):
//   'fixed'   — два фиксированных стика (как было);
//   'dynamic' — стик появляется в точке касания (левый/правый по половине экрана);
//   'buttons' — слева D-pad из 4 кнопок (аналог WASD), справа прицел-стик.
// Левый стик — движение (X: -1..1, вниз — присесть), правый — прицел+огонь.
// Кнопки: прыг, перезарядка, смена оружия, способность, граната, присесть.
// Адаптив: стики/кнопки привязаны к краям реальной ширины (layout.js),
// перераскладка — по событию scale 'resize'.

import { getControlScheme } from '../data/gameSettings.js';

// ?touch=1 — принудительно показать (тест на ПК), ?touch=0 — скрыть.
function isTouchCombat() {
  try {
    const qs = (typeof window !== 'undefined' && window.location && window.location.search) || '';
    if (/[?&]touch=1\b/.test(qs)) return true;
    if (/[?&]touch=0\b/.test(qs)) return false;
  } catch (e) {}
  try {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod|Mobile|Touch/i.test(ua);
    const touchPts = (typeof navigator !== 'undefined' && navigator.maxTouchPoints) || 0;
    const hasTouch = ('ontouchstart' in window) || touchPts > 0;
    if (!hasTouch) return false;
    if (mobileUA) return true;
    // Тач-ноутбук: показываем только при грубом указателе и маленьком экране.
    let coarse = false;
    try { coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
    if (coarse) {
      try {
        const m = Math.min(window.screen.width || 9999, window.screen.height || 9999);
        if (m <= 820) return true;
      } catch (e) {}
    }
  } catch (e) {}
  return false;
}

function gameW(scene) {
  try {
    const w = scene && scene.scale && scene.scale.width;
    if (Number.isFinite(w) && w > 0) return w;
  } catch (e) {}
  return 1280;
}

// Раскладка от ширины W: левый стик/кнопки — слева, правый — справа у кромок.
// x < 0 — от правого края (x = W + x).
function layoutFor(W) {
  return {
    left: { x: 170, y: 540, r: 85, knob: 38 },
    right: { x: W - 210, y: 540, r: 85, knob: 38 },
    crouch: { x: 340, y: 600, r: 34 },
    jump: { x: W - 70, y: 600, r: 44 },
    reload: { x: W - 300, y: 400, r: 28 },
    weapon: { x: W - 220, y: 400, r: 28 },
    ability: { x: W - 140, y: 400, r: 28 },
    nade: { x: W - 60, y: 400, r: 28 },
    // D-pad (схема 'buttons'): ромб слева внизу.
    dpad_up: { x: 170, y: 500, r: 32 },
    dpad_down: { x: 170, y: 620, r: 32 },
    dpad_left: { x: 110, y: 560, r: 32 },
    dpad_right: { x: 230, y: 560, r: 32 }
  };
}

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createTouchControls(scene) {
  if (!isTouchCombat()) { scene._touch = null; return null; }
  destroyTouchControls(scene);
  try { scene.input.addPointer(3); } catch (e) {}
  // Чтобы страница не скроллилась/зумилась пальцами.
  try {
    if (scene.game && scene.game.canvas) scene.game.canvas.style.touchAction = 'none';
    if (document && document.body) document.body.style.touchAction = 'none';
  } catch (e) {}

  const scheme = getControlScheme();
  const T = {
    enabled: true,
    scheme,
    left: { id: null, dx: 0, dy: 0, bx: 0, by: 0 },
    right: { id: null, dx: 0, dy: 0, bx: 0, by: 0 },
    ownIds: new Set(),
    crouchHeldId: null,
    jumpQueued: false,
    dpad: { up: null, down: null, left: null, right: null },
    objs: [],
    btns: [],
    cfg: layoutFor(gameW(scene))
  };
  scene._touch = T;

  const depth = 1000;
  // Запомнить layout-позицию объекта (в ней же идёт хит-тест пальца).
  // Рисует на экран updateTouchTransform с компенсацией зума.
  const setL = (o, lx, ly) => {
    try { if (o) { o._lx = lx; o._ly = ly; } } catch (e) {}
  };
  const mkBase = (key, tint) => {
    const c0 = T.cfg[key];
    const base = scene.add.circle(c0.x, c0.y, c0.r, tint, 0.22).setScrollFactor(0).setDepth(depth);
    const ring = scene.add.circle(c0.x, c0.y, c0.r, tint, 0.0).setScrollFactor(0).setDepth(depth);
    try { ring.setStrokeStyle(3, tint, 0.5); } catch (e) {}
    const knob = scene.add.circle(c0.x, c0.y, c0.knob, tint, 0.55).setScrollFactor(0).setDepth(depth + 1);
    T.objs.push(base, ring, knob);
    setL(base, c0.x, c0.y); setL(ring, c0.x, c0.y); setL(knob, c0.x, c0.y);
    const G = { key, base, ring, knob, cx: c0.x, cy: c0.y };
    return G;
  };
  const moveBase = (G, x, y) => {
    G.cx = x; G.cy = y;
    G.base.setPosition(x, y); G.ring.setPosition(x, y);
    setL(G.base, x, y); setL(G.ring, x, y);
  };
  const showStick = (G, x, y) => { moveBase(G, x, y); G.base.setAlpha(0.22); G.knob.setAlpha(0.55); };
  const hideStick = (G) => { G.base.setAlpha(0); G.knob.setAlpha(0); };

  T.leftG = mkBase('left', 0x66aaff);
  T.rightG = mkBase('right', 0xff6666);
  // Динамическая схема: базы стиков скрыты, появляются в точке касания.
  if (scheme === 'dynamic') { hideStick(T.leftG); hideStick(T.rightG); }
  // Схема кнопок: левый стик не рисуем — вместо него D-pad.
  if (scheme === 'buttons') { hideStick(T.leftG); }

  const mkBtn = (key, label, tint, onDown, onUp) => {
    const c0 = T.cfg[key];
    const c = scene.add.circle(c0.x, c0.y, c0.r, tint, 0.35).setScrollFactor(0).setDepth(depth);
    try { c.setStrokeStyle(2, tint, 0.7); } catch (e) {}
    const t = scene.add.text(c0.x, c0.y, label, {
      fontSize: '14px', fontStyle: 'bold', color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    T.objs.push(c, t);
    setL(c, c0.x, c0.y); setL(t, c0.x, c0.y);
    const b = { key, x: c0.x, y: c0.y, r: c0.r, onDown, onUp, c, t };
    T.btns.push(b);
    return b;
  };

  const doJump = () => { T.jumpQueued = true; };
  const doReload = () => {
    try {
      const p = scene.player;
      if (!p || scene.isPaused || scene.gameOver) return;
      if (scene._demoBlock && scene._demoBlock()) return;
      if (p.weapon && p.weapon.reload) p.weapon.reload();
    } catch (e) {}
  };
  const doWeapon = () => {
    try {
      const p = scene.player;
      if (!p || scene.isPaused || scene.gameOver) return;
      if (scene._demoBlock && scene._demoBlock()) return;
      const n = (p.inventory || []).length;
      if (n <= 1) return;
      p.selectWeapon(((p.activeWeaponIndex | 0) + 1) % n);
    } catch (e) {}
  };
  const doAbility = () => {
    try {
      const p = scene.player;
      if (!p || scene.isPaused || scene.gameOver) return;
      if (scene._demoBlock && scene._demoBlock()) return;
      if (p.useAbility) p.useAbility(scene.time.now);
      if (scene.interact) scene.interact();
    } catch (e) {}
  };
  const doNade = () => {
    try {
      const p = scene.player;
      if (!p || scene.isPaused || scene.gameOver) return;
      if (scene._demoBlock && scene._demoBlock()) return;
      const ax = Number.isFinite(p.aimX) ? p.aimX : p.x + 200;
      const ay = Number.isFinite(p.aimY) ? p.aimY : p.y;
      if (p.throwGrenade) p.throwGrenade('frag', ax, ay);
    } catch (e) {}
  };

  // Раскладка: слева стик + присесть, справа стик + прыг, сверху ряд мелких.
  mkBtn('crouch', 'СЕСТЬ', 0x8899aa,
    (pid) => { T.crouchHeldId = pid; },
    (pid) => { if (T.crouchHeldId === pid) T.crouchHeldId = null; });
  mkBtn('jump', 'ПРЫГ', 0x33cc66, doJump, null);
  mkBtn('reload', 'R', 0xccaa33, doReload, null);
  mkBtn('weapon', 'ОРУЖ', 0x4488ff, doWeapon, null);
  mkBtn('ability', 'СПОС', 0xaa66ff, doAbility, null);
  mkBtn('nade', 'ГРН', 0xff8844, doNade, null);

  // D-pad для схемы 'buttons' (аналог WASD). Вверх — прыжок.
  if (scheme === 'buttons') {
    mkBtn('dpad_up', '▲', 0x66aaff,
      (pid) => { T.dpad.up = pid; T.jumpQueued = true; },
      (pid) => { if (T.dpad.up === pid) T.dpad.up = null; });
    mkBtn('dpad_down', '▼', 0x8899aa,
      (pid) => { T.dpad.down = pid; },
      (pid) => { if (T.dpad.down === pid) T.dpad.down = null; });
    mkBtn('dpad_left', '◀', 0x66aaff,
      (pid) => { T.dpad.left = pid; },
      (pid) => { if (T.dpad.left === pid) T.dpad.left = null; });
    mkBtn('dpad_right', '▶', 0x66aaff,
      (pid) => { T.dpad.right = pid; },
      (pid) => { if (T.dpad.right === pid) T.dpad.right = null; });
  }

  const redraw = () => {
    try {
      const lc = T.cfg.left, rc = T.cfg.right;
      const dynamic = T.scheme === 'dynamic';
      const l = T.left;
      const lx = (dynamic && l.bx) ? l.bx : T.leftG.cx;
      const ly = (dynamic && l.by) ? l.by : T.leftG.cy;
      setL(T.leftG.knob,
        lx + l.dx * (lc.r - lc.knob * 0.4),
        ly + l.dy * (lc.r - lc.knob * 0.4));
      const r = T.right;
      const rx = (dynamic && r.bx) ? r.bx : T.rightG.cx;
      const ry = (dynamic && r.by) ? r.by : T.rightG.cy;
      setL(T.rightG.knob,
        rx + r.dx * (rc.r - rc.knob * 0.4),
        ry + r.dy * (rc.r - rc.knob * 0.4));
    } catch (e) {}
  };

  // Перераскладка под новую ширину (ресайз/поворот): двигаем базы,
  // кнопки и активные ручки; захваченные стики сбрасываем в центр.
  const relayout = () => {
    try {
      T.cfg = layoutFor(gameW(scene));
      const apply = (G) => {
        const c = T.cfg[G.key];
        G.cx = c.x; G.cy = c.y;
        G.base.setRadius(c.r);
        G.ring.setRadius(c.r);
        G.base.setPosition(c.x, c.y); G.ring.setPosition(c.x, c.y);
        setL(G.base, c.x, c.y); setL(G.ring, c.x, c.y);
        if (T.scheme === 'dynamic') { G.base.setAlpha(0); G.knob.setAlpha(0); }
      };
      apply(T.leftG); apply(T.rightG);
      T.left.id = null; T.left.dx = 0; T.left.dy = 0; T.left.bx = 0; T.left.by = 0;
      T.right.id = null; T.right.dx = 0; T.right.dy = 0; T.right.bx = 0; T.right.by = 0;
      T.ownIds.clear();
      T.crouchHeldId = null;
      T.dpad.up = T.dpad.down = T.dpad.left = T.dpad.right = null;
      T.btns.forEach(b => {
        const c = T.cfg[b.key];
        b.x = c.x; b.y = c.y; b.r = c.r;
        b.c.setRadius(c.r);
        b.c.setPosition(c.x, c.y);
        setL(b.c, c.x, c.y); setL(b.t, c.x, c.y);
      });
      redraw();
    } catch (e) {}
  };
  T.relayout = relayout;

  const stickVec = (cfg, px, py) => {
    let dx = (px - cfg.x) / cfg.r;
    let dy = (py - cfg.y) / cfg.r;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    return { dx, dy };
  };

  const onDown = (pointer) => {
    if (!T.enabled) return;
    const px = pointer.x, py = pointer.y;
    // Кнопки — первым приоритетом.
    for (const b of T.btns) {
      if (dist(px, py, b.x, b.y) <= b.r + 8) {
        T.ownIds.add(pointer.id);
        try { if (b.onDown) b.onDown(pointer.id); } catch (e) {}
        return;
      }
    }
    const lc = T.cfg.left, rc = T.cfg.right;
    // Динамическая схема: стик появляется в точке касания (половина экрана).
    if (T.scheme === 'dynamic') {
      const half = gameW(scene) / 2;
      if (px < half) {
        if (T.left.id == null) {
          T.left.id = pointer.id; T.left.bx = px; T.left.by = py; T.left.dx = 0; T.left.dy = 0;
          T.ownIds.add(pointer.id);
          showStick(T.leftG, px, py);
          redraw();
        }
      } else if (T.right.id == null) {
        T.right.id = pointer.id; T.right.bx = px; T.right.by = py; T.right.dx = 0; T.right.dy = 0;
        T.ownIds.add(pointer.id);
        showStick(T.rightG, px, py);
        redraw();
      }
      return;
    }
    // Фиксированные стики.
    if (T.scheme !== 'buttons' && T.left.id == null && dist(px, py, lc.x, lc.y) <= lc.r * 1.6) {
      T.left.id = pointer.id;
      const v = stickVec(lc, px, py);
      T.left.dx = v.dx; T.left.dy = v.dy;
      T.ownIds.add(pointer.id);
      redraw();
      return;
    }
    if (T.right.id == null && dist(px, py, rc.x, rc.y) <= rc.r * 1.6) {
      T.right.id = pointer.id;
      const v = stickVec(rc, px, py);
      T.right.dx = v.dx; T.right.dy = v.dy;
      T.ownIds.add(pointer.id);
      redraw();
      return;
    }
  };

  const onMove = (pointer) => {
    if (!T.enabled) return;
    const dynamic = T.scheme === 'dynamic';
    if (T.left.id != null && pointer.id === T.left.id && pointer.isDown) {
      const bx = dynamic ? T.left.bx : T.cfg.left.x;
      const by = dynamic ? T.left.by : T.cfg.left.y;
      const r = T.cfg.left.r;
      let dx = (pointer.x - bx) / r, dy = (pointer.y - by) / r;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      T.left.dx = dx; T.left.dy = dy;
      redraw();
    }
    if (T.right.id != null && pointer.id === T.right.id && pointer.isDown) {
      const bx = dynamic ? T.right.bx : T.cfg.right.x;
      const by = dynamic ? T.right.by : T.cfg.right.y;
      const r = T.cfg.right.r;
      let dx = (pointer.x - bx) / r, dy = (pointer.y - by) / r;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      T.right.dx = dx; T.right.dy = dy;
      redraw();
    }
  };

  const onUp = (pointer) => {
    if (T.left.id != null && pointer.id === T.left.id) {
      T.left.id = null; T.left.dx = 0; T.left.dy = 0;
      if (T.scheme === 'dynamic') hideStick(T.leftG);
    }
    if (T.right.id != null && pointer.id === T.right.id) {
      T.right.id = null; T.right.dx = 0; T.right.dy = 0;
      if (T.scheme === 'dynamic') hideStick(T.rightG);
    }
    T.ownIds.delete(pointer.id);
    if (T.crouchHeldId === pointer.id) T.crouchHeldId = null;
    // Кнопкам с onUp (присесть, D-pad) — отпустить.
    try {
      for (const b of T.btns) { if (b.onUp) b.onUp(pointer.id); }
    } catch (e) {}
    redraw();
  };

  T._onDown = onDown; T._onMove = onMove; T._onUp = onUp;
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  try { scene.input.on('pointercancel', onUp); } catch (e) {}
  // Смена ширины (ресайз окна/поворот): перераскладка к кромкам.
  T._onResize = () => { try { relayout(); } catch (e) {} };
  try { scene.scale.on('resize', T._onResize); } catch (e) {}
  T._destroy = () => {
    try { scene.input.off('pointerdown', onDown); } catch (e) {}
    try { scene.input.off('pointermove', onMove); } catch (e) {}
    try { scene.input.off('pointerup', onUp); } catch (e) {}
    try { scene.input.off('pointerupoutside', onUp); } catch (e) {}
    try { scene.input.off('pointercancel', onUp); } catch (e) {}
    try { scene.scale.off('resize', T._onResize); } catch (e) {}
    try { T.objs.forEach(o => { if (o && o.destroy) o.destroy(); }); } catch (e) {}
    T.objs = []; T.btns = [];
  };
  redraw();
  return T;
}

export function destroyTouchControls(scene) {
  try {
    const T = scene && scene._touch;
    if (T && T._destroy) T._destroy();
  } catch (e) {}
  try { if (scene) scene._touch = null; } catch (e) {}
}

// Per-frame компенсация зума камеры — та же математика, что у HUD
// (updateHudTransform): иначе смена оружия (другая дальность → другой зум)
// уносит стики с места. Звать каждый кадр из update боевой сцены.
// На z=1/16:9 — тождество, как было.
export function updateTouchTransform(scene) {
  try {
    const T = scene && scene._touch;
    if (!T || !T.enabled || !T.objs) return;
    const z = (scene.cameras && scene.cameras.main && scene.cameras.main.zoom) || 1;
    const W = gameW(scene);
    const mx = W / 2, my = 360;
    for (let i = 0; i < T.objs.length; i++) {
      const o = T.objs[i];
      if (!o || !o.active) continue;
      const lx = (o._lx !== undefined) ? o._lx : o.x;
      const ly = (o._ly !== undefined) ? o._ly : o.y;
      if (o._tbsx === undefined) { o._tbsx = o.scaleX; o._tbsy = o.scaleY; }
      o.setPosition(mx + (lx - mx) / z, my + (ly - my) / z);
      o.setScale(o._tbsx / z, o._tbsy / z);
    }
  } catch (e) {}
}

// Этот pointer — палец на джойстике/кнопке? Тогда мышиным хендлерам его игнорить.
export function touchOwns(scene, pointer) {
  try {
    const T = scene && scene._touch;
    if (!T || !T.enabled) return false;
    if (!pointer) return false;
    return T.ownIds.has(pointer.id);
  } catch (e) { return false; }
}

// Движение левого стика / D-pad: { x: -1..1, crouch: bool }.
export function touchMove(scene) {
  try {
    const T = scene && scene._touch;
    if (!T || !T.enabled) return { x: 0, crouch: false };
    if (T.scheme === 'buttons') {
      const x = (T.dpad.right != null ? 1 : 0) - (T.dpad.left != null ? 1 : 0);
      return { x, crouch: T.dpad.down != null };
    }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    return {
      x: dz(T.left.dx || 0),
      crouch: (T.left.dy || 0) > 0.55 || T.crouchHeldId != null
    };
  } catch (e) { return { x: 0, crouch: false }; }
}

// Правый стик: { active, dx, dy }. Активен при отклонении за мёртвую зону.
function touchAim(scene) {
  try {
    const T = scene && scene._touch;
    if (!T || !T.enabled) return { active: false, dx: 0, dy: 0 };
    const dx = T.right.dx || 0, dy = T.right.dy || 0;
    const m = Math.hypot(dx, dy);
    if (m < 0.25) return { active: false, dx: 0, dy: 0 };
    return { active: true, dx, dy };
  } catch (e) { return { active: false, dx: 0, dy: 0 }; }
}

// Разовый прыжок с кнопки/D-pad (очередь — один update один прыжок).
export function consumeTouchJump(scene) {
  try {
    const T = scene && scene._touch;
    if (!T || !T.enabled) return false;
    if (T.jumpQueued) { T.jumpQueued = false; return true; }
  } catch (e) {}
  return false;
}

// Мировая точка прицела по правому стику: от игрока в сторону наклона.
export function touchAimWorld(scene, player, reach = 420) {
  try {
    const a = touchAim(scene);
    if (!a.active || !player) return null;
    return { x: player.x + a.dx * reach, y: player.y + a.dy * reach };
  } catch (e) { return null; }
}
