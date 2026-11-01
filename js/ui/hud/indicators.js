import { getWeaponLabel } from '../../data/weapons.js?v=170';

import { getCrosshair, drawCrosshairFigure } from '../../data/crosshair.js?v=169';

import { gameW, BASE_CX } from '../layout.js?v=3';
export function drawAbilityCircle(scene, ready01) {
  const r = 22;

  const g = scene.abilityCircleBg;
  g.clear();

  g.fillStyle(scene.player.hasAbility ? 0x333355 : 0x222233, 1);
  g.fillCircle(0, 0, r);

  if (scene.player.hasAbility) {
    const P = (typeof Phaser !== 'undefined') ? Phaser : null;
    const clamp = (P && P.Math && P.Math.Clamp) ? P.Math.Clamp : (v, a, b) => Math.max(a, Math.min(b, v));
    const deg = (P && P.Math && P.Math.DegToRad) ? P.Math.DegToRad : (d) => d * Math.PI / 180;
    const pct = clamp(ready01, 0, 1);
    g.fillStyle(0x2266cc, 1);
    g.slice(0, 0, r, deg(-90), deg(-90 + 360 * pct), false);
  }

  g.lineStyle(2, 0x7799cc);
  g.strokeCircle(0, 0, r);

  const z = scene.cameras.main.zoom;
  // Та же компенсация, что у всего HUD (updateHudTransform): иначе при
  // зуме != 1 буква E уезжает, а круг остаётся — «круг уехал от буквы».
  // Центр — реальный (на 16:9 = 640, как было).
  const _acx = gameW(scene) / 2;
  g.setPosition(
    _acx + (scene.hudAbilityPt.x - BASE_CX) / z,
    360 + (scene.hudAbilityPt.y - 360) / z
  );
  g.setScale(1 / z);
}

export function drawCrosshair(scene) {
  const g = scene.crosshair;
  const z = scene.cameras.main.zoom;
  const pointer = scene.input.activePointer;

  g.clear();

  if (scene.player.dead) return;

  g.setPosition(
    gameW(scene) / 2 + (pointer.x - gameW(scene) / 2) / z,
    360 + (pointer.y - 360) / z
  );
  g.setScale(1 / z);

  const weapon = scene.player.weapon;
  // Радиус из настроек прицела: статика — всегда размер,
  // динамика — едет от разброса (дефолт size 8 = как было: 5 + t*15).
  const cross = getCrosshair();
  let targetR;
  if (!cross.dynamic) {
    targetR = cross.size;
  } else if (!weapon) {
    targetR = cross.size * 1.5;
  } else {
    const spreadMult = scene.player.spreadMult || 1;
    let spread = weapon.spreadDeg * spreadMult;
    if (Math.abs(scene.player.body?.velocity.x || 0) > 10) {
      spread *= 1.5;
    }
    if (!scene.player.body.blocked.down && !scene.player.body.touching.down) {
      spread *= 3;
    }

    const minSpread = weapon.spreadDeg * spreadMult;
    const maxSpread = weapon.spreadDeg * 4.5 * spreadMult;
    const P = (typeof Phaser !== 'undefined') ? Phaser : null;
    const clamp = (P && P.Math && P.Math.Clamp) ? P.Math.Clamp : (v, a, b) => Math.max(a, Math.min(b, v));
    const t = maxSpread > minSpread
      ? clamp((spread - minSpread) / (maxSpread - minSpread), 0, 1)
      : 0;
    targetR = cross.size * 0.625 + t * cross.size * 1.875;
  }

  if (scene.crosshairR == null) scene.crosshairR = 8;
  scene.crosshairR += (targetR - scene.crosshairR) * 0.12;
  const r = scene.crosshairR;

  drawCrosshairFigure(g, cross, r);

  if (weapon?.reloading) {
    const a = (scene.time.now / 320) % (Math.PI * 2);
    const rr = Math.max(r + 4, 14);
    const ax = Math.cos(a) * rr;
    const ay = Math.sin(a) * rr;
    g.lineStyle(2.5, 0xffaa33, 1);
    g.beginPath();
    g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
    g.lineTo(ax, ay);
    g.strokePath();
    const ta = a + Math.PI * 1.55;
    g.fillStyle(0xffaa33, 1);
    g.fillTriangle(
      ax, ay,
      ax + Math.cos(ta - Math.PI / 2) * 7,
      ay + Math.sin(ta - Math.PI / 2) * 7,
      ax + Math.cos(ta + Math.PI / 2) * 7,
      ay + Math.sin(ta + Math.PI / 2) * 7
    );
  }
}

export function drawReloadIcon(scene) {
  const g = scene.reloadIcon;
  g.clear();

  if (!scene.player.weapon?.reloading || scene.player.dead) return;

  // Круг — строго по центру активного слота (раньше были вбитые
  // координаты от старой раскладки и крутился мимо оружия).
  const idx = scene.player.activeWeaponIndex;
  const info = scene.weaponSlots[idx] || scene.weaponSlots[0];
  const cx = info ? info.sx : 78;
  const cy = info ? info.sy : 640;
  const r = 30;
  const a = (scene.time.now / 500) % (Math.PI * 2);

  g.lineStyle(3, 0xffcc66, 1);
  g.beginPath();
  g.arc(0, 0, r, a, a + Math.PI * 1.7, false);
  g.strokePath();

  const tipAngle = a + Math.PI * 1.7;
  const tipX = Math.cos(tipAngle) * r;
  const tipY = Math.sin(tipAngle) * r;
  g.fillStyle(0xffcc66, 1);
  g.fillTriangle(
    tipX, tipY,
    tipX + Math.cos(tipAngle - Math.PI / 2) * 7,
    tipY + Math.sin(tipAngle - Math.PI / 2) * 7,
    tipX + Math.cos(tipAngle + Math.PI / 2) * 7,
    tipY + Math.sin(tipAngle + Math.PI / 2) * 7
  );

  const z = scene.cameras.main.zoom;
  const _rcx = gameW(scene) / 2;
  g.setPosition(
    _rcx + (cx - BASE_CX) / z,
    360 + (cy - 360) / z
  );
  g.setScale(1 / z);
}

// Киллфид (п.19): «кто кого» в правом верхнем углу, тает за 4 сек.
// Через hudFixed: иначе зум камеры уносит строки с угла экрана.
// src — честный источник (граната уже не маскируется под ствол в руках).
export function pushKillFeed(scene, killer, victim, src) {
  try {
    if (scene.mode === 'CAMPAIGN') return;
    scene._killFeed = scene._killFeed || [];
    const kn = killer ? (killer.playerName || '???') : '—';
    const vn = victim ? (victim.playerName || '???') : '—';
    const wname = src ? getWeaponLabel(src)
      : (killer?.weapon ? getWeaponLabel(killer.weapon.name) : '');
    // Хедшот — рисованный значок простреленной головы слева от строки
    // (зона добивания из receiveDamage). Текст и цвет строки — как у всех.
    const hs = victim && victim._deathZone === 'head';
    const line = scene.add.text(0, 0, '', {
      fontSize: '14px', color: '#ffffff', backgroundColor: 'rgba(17,17,51,0.85)', padding: 4,
      fixedWidth: 300, align: 'right'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(140);
    line.setText(`${kn} ✕ ${vn}${wname ? ' · ' + wname : ''}`);
    // Цвет строки — по команде убийцы: красная убила синего — красная.
    if (!killer) line.setColor('#cccccc');
    else if (killer.team === 'blue') line.setColor('#7db8ff');
    else if (killer.team === 'red') line.setColor('#ff8888');
    else line.setColor('#ffffff');
    const rowY = 44 + scene._killFeed.length * 24;
    let icon = null, iconItem = null;
    if (hs) {
      try {
        // scrollFactor(0) обязателен, как у строки: иначе иконка
        // скроллится с миром и улетает с экрана вместе с камерой.
        const g = scene.add.graphics().setScrollFactor(0).setDepth(140);
        // Голова в прицеле: золотая голова, красный прицел, дырка.
        g.fillStyle(0xffd24a, 1);
        g.fillCircle(0, 0, 6);
        g.lineStyle(2, 0xff2222, 1);
        g.strokeCircle(0, 0, 10);
        g.lineBetween(-13, 0, -7, 0);
        g.lineBetween(7, 0, 13, 0);
        g.lineBetween(0, -13, 0, -7);
        g.lineBetween(0, 7, 0, 13);
        g.fillStyle(0x991111, 1);
        g.fillCircle(2, -2, 2);
        icon = g;
        iconItem = { obj: g, sx: 950, sy: rowY + 11, counterScale: true, anchor: 'R' };
        scene.hudFixed.push(iconItem);
      } catch (e) { icon = null; iconItem = null; }
    }
    const item = { obj: line, icon, iconItem, sx: 1270, sy: rowY, counterScale: true, anchor: 'R' };
    scene.hudFixed.push(item);
    scene._killFeed.push(item);
    killFeedShift(scene);
    scene.time.delayedCall(4000, () => {
      const ix = scene._killFeed.indexOf(item);
      if (ix >= 0) scene._killFeed.splice(ix, 1);
      scene.hudFixed.splice(scene.hudFixed.indexOf(item), 1);
      if (item.iconItem) scene.hudFixed.splice(scene.hudFixed.indexOf(item.iconItem), 1);
      try {
        scene.tweens.add({ targets: line, alpha: 0, duration: 400, onComplete: () => line.destroy() });
      } catch (e) { try { line.destroy(); } catch (e2) {} }
      try { if (item.icon) item.icon.destroy(); } catch (e) {}
      killFeedShift(scene);
    });
  } catch (e) { /* киллфид не роняет игру */ }
}

// Перекладка строк киллфида + лимит 6 (старые удаляем сразу).
// Иконки хедшотов едут вместе со строками и чистятся с ними.
function killFeedShift(scene) {
  while (scene._killFeed.length > 6) {
    const old = scene._killFeed.shift();
    scene.hudFixed.splice(scene.hudFixed.indexOf(old), 1);
    try { old.obj.destroy(); } catch (e) {}
    if (old.iconItem) scene.hudFixed.splice(scene.hudFixed.indexOf(old.iconItem), 1);
    try { if (old.icon) old.icon.destroy(); } catch (e) {}
  }
  scene._killFeed.forEach((it, i) => {
    it.sy = 44 + i * 24;
    if (it.iconItem) it.iconItem.sy = 44 + i * 24 + 11;
  });
}

// Точки прогресса CTF/BOMB: две зеркальные группы на ФИКСИРОВАННЫХ якорях
// (внутренние края — всегда x640∓20, растут наружу). Раньше якорями были
// бейджи ряда — при лимите 10 группы налезали друг на друга в центре,
// а пересчёт ряда от ширины таймера возил точки туда-сюда каждую секунду.
// k-я от центра закрашена, если счёт команды > k (k=0 — у центра).
// Перерисовка только при смене счёта/лимита (сиг), не каждый кадр.
