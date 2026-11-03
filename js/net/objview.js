// objview.js — отрисовка сетевых объективов (флаги/бомбы/точки KOTH).
// Было в NetGameScene (_buildObjVisuals/_carrierXY/_supportTop/_drawObj).
// Только ВИЗУАЛ по серверному снапшоту (scene._obj): геометрию мира
// и протокол (net.*) не трогаем — они остаются в сцене.
// Функции принимают сцену; в классе остались тонкие обёртки.
import { NET_ARENA } from './arena.js?v=169';
import { gameState } from '../data/gameState.js?v=175';

export function buildObjVisuals(scene) {
  scene._objLetters = [];
  scene._objGfx = null;
  scene._objGfxBack = null;
  scene._baseLabels = [];
  try {
    if (scene.mode === 'KOTH') {
      (NET_ARENA.points || []).forEach(pt => {
        const t = scene.add.text(pt.x, pt.y - 100, pt.name, {
          fontSize: '22px', fontStyle: 'bold', color: '#888899'
        }).setOrigin(0.5).setDepth(3);
        scene._objLetters.push(t);
      });
      scene._objGfx = scene.add.graphics().setDepth(6);
    } else if (scene.mode === 'CTF' || scene.mode === 'BOMB') {
      scene._objGfx = scene.add.graphics().setDepth(6);
      // Задний слой объективов (флаги/бомбы ЗА персонажем, под торсом).
      scene._objGfxBack = scene.add.graphics().setDepth(3.5);
      // Подписи баз как в одиночке (БАЗА С / БАЗА К) — видно, куда нести.
      try {
        const bb = (NET_ARENA.bases || {});
        [['blue', 'БАЗА С', '#6db4ff'], ['red', 'БАЗА К', '#ff8888']].forEach(([tm, label, color]) => {
          const bs = bb[tm];
          if (!bs) return;
          const t = scene.add.text(bs.x, bs.y - 100, label, {
            fontSize: '14px', fontStyle: 'bold', color
          }).setOrigin(0.5).setDepth(3);
          scene._baseLabels.push(t);
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// Живая позиция носильщика для плавных объективов: сервер шлёт флаг
// и бомбу 4Гц по серверной точке — без доводки они телепортируются
// за спиной несущего. Рисуем от отрисованного бойца (плавно),
// данные сервера — запасной вариант. Возврат: {x, y: ступни, live}.
export function carrierXY(scene, id, fx, fy) {
  try {
    if (id == null) return { x: fx, y: fy, live: false };
    let f = null;
    if (id === scene.myId) f = scene.player;
    else {
      const rec = scene._puppets.get(id);
      if (rec && rec.f) f = rec.f;
    }
    if (f && f.active && !f.dead && Number.isFinite(f.x) && Number.isFinite(f.y)) {
      let feet = f.y + 30;
      try {
        if (f.body && Number.isFinite(f.body.bottom)) feet = f.body.bottom;
      } catch (e) {}
      return { x: f.x, y: feet, live: true };
    }
  } catch (e) {}
  return { x: fx, y: fy, live: false };
}

export function supportTop(scene, x, approxY) {
  try {
    const y0 = (approxY | 0) - 8, y1 = (approxY | 0) + 200;
    let best = null;
    const groups = [scene.platforms, scene.covers];
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];
      if (!grp) continue;
      const kids = grp.getChildren();
      for (let i = 0; i < kids.length; i++) {
        const b = kids[i] && kids[i].body;
        if (!b || !b.enable) continue;
        if (x < b.x - 2 || x > b.x + b.width + 2) continue;
        const top = b.y;
        if (top < y0 || top > y1) continue;
        if (best == null || top < best) best = top;
      }
    }
    return best;
  } catch (e) {}
  return null;
}

export function drawObj(scene) {
  try {
    const o = scene._obj;
    if (scene.mode === 'KOTH') {
      const pts = (o && o.points) || [];
      (scene._objLetters || []).forEach((t, i) => {
        const pt = pts[i];
        if (!t) return;
        t.setColor(!pt ? '#888899' : pt.holder === 'blue' ? '#6db4ff' : pt.holder === 'red' ? '#ff6666' : '#ffffff');
      });
      const g = scene._objGfx;
      if (!g) return;
      g.clear();
      pts.forEach(pt => {
        if (!pt || !(pt.prog > 50) && !(pt.prog < -50)) return;
        const frac = Math.min(1, Math.abs(pt.prog) / 4000);
        const W = 100;
        g.fillStyle(0x0a0a2a, 0.85);
        g.fillRect(pt.x - W / 2 - 1, pt.y - 78, W + 2, 8);
        g.fillStyle(pt.prog > 0 ? 0x4488ff : 0xff4444, 1);
        g.fillRect(pt.x - W / 2, pt.y - 78, W * frac, 6);
      });
    } else if (scene.mode === 'CTF') {
      const g = scene._objGfx;
      if (!g) return;
      g.clear();
      try { if (scene._objGfxBack) scene._objGfxBack.clear(); } catch (e) {}
      const fl = (o && o.flags) || {};
      ['blue', 'red'].forEach(team => {
        const f = fl[team];
        if (!f) return;
        const col = team === 'blue' ? 0x4488ff : 0xff4444;
        // Флаг ×2. Лежащий/домашний — древко от земли (опора, не точка:
        // серверная y гуляет с k рига). Носимый — на спине носильщика
        // (ступни − 70), плавно за ним (иначе телепорты 4Гц).
        let fx = f.x, fy = f.y;
        if (f.state === 'carried') {
          const cp = carrierXY(scene, f.carrier, f.x, f.y);
          fx = cp.x; fy = cp.live ? cp.y - 70 : f.y;
        } else {
          try {
            const st = supportTop(scene, f.x, f.y);
            if (st != null) fy = st;
          } catch (e) {}
        }
        // Рисуем слоем ЗА персонажем (см. _objGfxBack).
        const bg = scene._objGfxBack || g;
        bg.lineStyle(6, 0xdddddd, 1);
        bg.lineBetween(fx, fy, fx, fy - 80);
        bg.fillStyle(col, 1);
        bg.fillTriangle(fx, fy - 80, fx + 44, fy - 66, fx, fy - 52);
      });
    } else if (scene.mode === 'BOMB') {
      const g = scene._objGfx;
      if (!g) return;
      g.clear();
      try { if (scene._objGfxBack) scene._objGfxBack.clear(); } catch (e) {}
      const bb = (o && o.bombs) || {};
      // Статусы зарядов как в одиночке: НЕСЁТ ник / ОБЕЗВРЕЖИВАЮТ /
      // ЛЕЖИТ / ДОМА. Тексты — разово, дальше только текст/цвет.
      try {
        if (!scene._bombBlueTxt || !scene._bombBlueTxt.active) {
          scene._bombBlueTxt = scene.addHudElement(scene.add.text(452, 110, '', {
            fontSize: '14px', fontStyle: 'bold', color: '#88dd88',
            backgroundColor: '#0d0d22cc', padding: 5
          }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96), 452, 110);
        }
        if (!scene._bombRedTxt || !scene._bombRedTxt.active) {
          scene._bombRedTxt = scene.addHudElement(scene.add.text(744, 110, '', {
            fontSize: '14px', fontStyle: 'bold', color: '#88dd88',
            backgroundColor: '#0d0d22cc', padding: 5
          }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96), 744, 110);
        }
        const stOf = (b) => {
          if (!b) return ['—', '#667788'];
          if (b.state === 'carried' && b.carrier != null) {
            let nm = '?';
            try {
              const inf = scene._matchInfo(b.carrier);
              if (inf && inf.name) nm = String(inf.name).slice(0, 8);
              else if (b.carrier === scene.myId) nm = String((scene.net && scene.net.myName) || gameState.playerName || 'Игрок').slice(0, 8);
            } catch (e) {}
            return [`НЕСЁТ ${nm}`, '#ffd24a'];
          }
          if (b.state !== 'home') {
            if ((b.defuse | 0) > 0) return ['ОБЕЗВРЕЖИВАЮТ', '#7dff9a'];
            return ['ЛЕЖИТ', '#ff8844'];
          }
          return ['ДОМА', '#88dd88'];
        };
        const [tb, cb] = stOf(bb.blue);
        const [tr, cr] = stOf(bb.red);
        try { scene._bombBlueTxt.setText(tb).setColor(cb); } catch (e) {}
        try { scene._bombRedTxt.setText(tr).setColor(cr); } catch (e) {}
      } catch (e) {}
      ['blue', 'red'].forEach(team => {
        const b = bb[team];
        if (!b) return;
        // Якорь: носимая — на спине носильщика (ступни − 64, плавно),
        // лежащая/домашняя — кругом на опоре (земля, не точка сервера).
        let ax = b.x, ay = b.y - 14;
        if (b.state === 'carried') {
          const cp = carrierXY(scene, b.carrier, b.x, b.y);
          ax = cp.x; ay = cp.live ? cp.y - 64 : b.y - 14;
        } else {
          try {
            const st = supportTop(scene, b.x, b.y);
            if (st != null) ay = st - 10;
          } catch (e) {}
        }
        // Бомба-прямоугольник с проводочками (как СВУ): тёмный корпус,
        // цветная полоска команды, три провода, красный глазок мигает.
        // Рисуем слоем ЗА персонажем (см. _objGfxBack).
        const bg2 = scene._objGfxBack || g;
        const blink = (scene.time ? (Math.floor(scene.time.now / 400) % 2 === 0) : true);
        bg2.fillStyle(0x222233, 1);
        bg2.fillRoundedRect(ax - 13, ay - 9, 26, 18, 3);
        bg2.lineStyle(2, 0x555566, 1);
        bg2.strokeRoundedRect(ax - 13, ay - 9, 26, 18, 3);
        bg2.fillStyle(team === 'blue' ? 0x4488ff : 0xff4444, 1);
        bg2.fillRect(ax - 13, ay - 9, 26, 4);
        bg2.lineStyle(2, 0xff2222, 1);
        bg2.lineBetween(ax - 9, ay - 2, ax + 9, ay + 2);
        bg2.lineStyle(2, 0x22ff44, 1);
        bg2.lineBetween(ax - 9, ay + 3, ax + 9, ay - 1);
        bg2.lineStyle(2, 0xeeeeee, 1);
        bg2.lineBetween(ax - 9, ay + 7, ax + 9, ay + 7);
        if (blink) {
          bg2.fillStyle(0xff2222, 1);
          bg2.fillCircle(ax + 9, ay - 5, 2.5);
        }
        if (b.state === 'carried' && b.plant > 0) {
          const frac = Math.min(1, b.plant / 5);
          g.fillStyle(0x0a0a2a, 0.85);
          g.fillRect(ax - 61, ay - 52, 122, 10);
          g.fillStyle(0xffd24a, 1);
          g.fillRect(ax - 60, ay - 51, 120 * frac, 8);
        }
        // Прогресс разминирования лежащей — той же полосой, синим.
        if (b.state === 'dropped' && (b.defuse | 0) > 0) {
          const frac = Math.min(1, (b.defuse || 0) / 5);
          g.fillStyle(0x0a0a2a, 0.85);
          g.fillRect(ax - 61, ay - 66, 122, 10);
          g.fillStyle(0x55aaff, 1);
          g.fillRect(ax - 60, ay - 65, 120 * frac, 8);
        }
      });
    }
  } catch (e) {}
}
