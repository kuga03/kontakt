// shoot.js — стрельба и ближний бой (было в Player).
// Функции принимают игрока первым аргументом; в классе остались тонкие
// обёртки с теми же именами. Внутри модуля зовём друг друга напрямую,
// методы класса (aimAngle/_getSide/_gunOffset/...) — через player.*.
import { weaponImage } from '../../data/weapons.js?v=170';
import { playSynthSwing } from '../../data/gunSynth.js?v=5';

export function drawGun(player) {
  const g = player.gun;
  g.clear();
  const w = player.weapon;
  const name = w ? w.name : '';
  const isSniper = ['SSG', 'LAR', 'Barrett_M82', 'Remington_700', 'Winchester'].includes(name);
  const isShotgun = name === 'Benelli_M4';
  const isPistol = ['Makarov', 'Glock', 'M1911', 'Deagle', 'revolver'].includes(name);

  if (isSniper) {
    g.lineStyle(4, 0x555555, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(28, 0);
    g.strokePath();
    g.fillStyle(0x444444, 1);
    g.fillRect(-2, -3, 5, 8);
    g.fillStyle(0x333333, 1);
    g.fillRect(24, -2, 8, 4);
  } else if (isShotgun) {
    g.lineStyle(5, 0x555555, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(14, 0);
    g.strokePath();
    g.fillStyle(0x444444, 1);
    g.fillRect(-2, -3, 5, 8);
  } else if (isPistol) {
    g.lineStyle(3, 0x555555, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(12, 0);
    g.strokePath();
    g.fillStyle(0x444444, 1);
    g.fillRect(-1, -2, 4, 6);
  } else {
    g.lineStyle(4, 0x555555, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(20, 0);
    g.strokePath();
    g.fillStyle(0x444444, 1);
    g.fillRect(-2, -3, 5, 8);
  }
}

// Фаза анимации перезарядки (0..1 по РЕАЛЬНОМУ прогрессу:
// reloadTime оружия × reloadMult скиллов). Возвращает наклон ствола,
// тряску и экскурс передней руки к магазину — ствол (updateGun) и руки
// (_poseArm) берут значения из одного места и не расходятся.
// null — не перезаряжаемся (руки/ствол как обычно).
export function reloadAnim(player) {
  const w = player.weapon;
  if (!w || !w.reloading || w.isMelee) return null;
  const total = (Number(w.reloadTime) || 0) * (Number(w.reloadMult) || 1);
  if (!(total > 0)) return null;
  let now = 0;
  try { now = (player.scene && player.scene.time && player.scene.time.now) || 0; } catch (e) {}
  if (!now) now = Date.now();
  const endsAt = Number(w._reloadEndsAt) || 0;
  if (!(endsAt > 0)) return null;
  let p = 1 - (endsAt - now) / total;
  if (!Number.isFinite(p)) return null;
  p = Math.max(0, Math.min(1, p));
  const ss = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
    return t * t * (3 - 2 * t);
  };
  // Наклон: въезд 4–22%, держим, возврат 80–97%.
  const tilt = ss(0.04, 0.22, p) * (1 - ss(0.80, 0.97, p));
  const mid = Math.sin(Math.PI * p);
  const dipR = 0.45 * tilt;
  const dipY = 7 * tilt + Math.sin(now * 0.035) * 1.5 * tilt * (0.3 + 0.7 * mid);
  // Передняя рука: уход с цевья к магазину (28–44%), возврат (62–80%).
  const magEnv = ss(0.28, 0.44, p) * (1 - ss(0.62, 0.80, p));
  return { p, tilt, dipR, dipY, magEnv };
}

export function updateGun(player) {
  if (player.dead || !player.gun) return;
  const curName = player.weapon ? player.weapon.name : null;
  if (player._lastGunName !== curName) {
    player._lastGunName = curName;
    drawGun(player);

    const imgKey = curName ? weaponImage(curName) : null;
    const hasTex = imgKey && player.scene.textures.exists(imgKey);

    if (hasTex) {
      if (!player.gunImg) {
        player.gunImg = player.scene.add.image(0, 0, imgKey).setDepth(4.2);
        if (player.scene.uiCam) {
          player.gunImg.cameraFilter = player.scene.uiCam.id;
        }
      } else {
        player.gunImg.setTexture(imgKey);
      }
      player.gunImg.setOrigin(0.15, 0.5);
      player.gunImg.setScale(1);
      player._gunImgKey = imgKey;
      const TARGET_W = 44 * player._gunFullScale(curName);
      const rawW = player.gunImg.frame ? (player.gunImg.frame.realWidth || 0) : 0;
      player._gunRawW = rawW > 0 ? rawW : 1;
      player._gunBaseScale = TARGET_W / player._gunRawW;
    } else {
      if (player.gunImg) player.gunImg.setVisible(false);
      player._gunImgKey = null;
      player._gunBaseScale = 1;
    }
  }

  if (!player._gunImgKey && player.gunImg) {
    player.gunImg.setVisible(false);
  }

  const hw = player._handWorld || { x: player.x + 12, y: player.y - 18 };
  const side = player._getSide();
  const worldA = player.aimAngle();
  const rot = side < 0 ? worldA + Math.PI : worldA;
  const allowed = player._gunAllowed !== false;
  const useImg = allowed && !!player._gunImgKey;

  // Перезарядка: ствол клюёт вниз по фазе (см. reloadAnim) + лёгкая
  // тряска в середине. Руки дотягиваются следом в _poseArm — ствол
  // и кисти едут одним движением, оружие из рук не выпадает.
  let dipY = 0;
  let dipR = 0;
  const _ra = player._reloadAnim ? reloadAnim(player) : null;
  if (_ra) {
    dipY = _ra.dipY;
    dipR = _ra.dipR;
  }

  // Сдвиг ствола (СтвX/СтвY) — в рамке ПРИЦЕЛА: X вперёд по стволу,
  // Y вниз по оружию (зеркалится). В рамке поворота картинки тот же +X
  // при развороте влево уводил ствол назад — теперь симметрично.
  const goA = player._gunOffset(curName);
  const goAx = Math.cos(worldA), goAy = Math.sin(worldA);
  const goSgn = side < 0 ? -1 : 1;
  const goX = goA.x * goAx + goA.y * (-goAy) * goSgn;
  const goY = goA.x * goAy + goA.y * goAx * goSgn;
  // Миниган — поверх ног (иначе ближняя нога режет его корпус).
  // Остальное оружие — как было, под руками (руки обхватывают сверху).
  const gunDepth = curName === 'minigun' ? 4.7 : 4.2;
  // Взмах: ствол едет вместе с руками — та же мировая дуга вокруг плеча.
  let swW = 0;
  let swPx = 0, swPy = 0;
  try {
    swW = swingRot(player);
    if (swW && player.armGun) { swPx = player.armGun.x; swPy = player.armGun.y; }
    else swW = 0;
  } catch (e) { swW = 0; }
  const swC = Math.cos(swW), swS = Math.sin(swW);
  // Отдача ствола: назад по оси прицела + чуть вверх по экрану.
  // Кисти уже отъехали туда же в _poseArm — оружие из рук не выпадает.
  const _rkick = player._recoilKick();
  const _rkx = -Math.cos(worldA) * _rkick.back;
  const _rky = -Math.sin(worldA) * _rkick.back - _rkick.up;
  if (player.gunImg) {
    player.gunImg.setVisible(useImg);
    if (useImg) {
      const gr = rot + dipR + swW;
      let gx = hw.x + goX + _rkx, gy = hw.y + dipY + goY + _rky;
      if (swW) {
        const dx = gx - swPx, dy = gy - swPy;
        gx = swPx + dx * swC - dy * swS;
        gy = swPy + dx * swS + dy * swC;
      }
      player.gunImg.setPosition(gx, gy);
      player.gunImg.rotation = gr;
      const s = player._gunBaseScale || 1;
      player.gunImg.scaleX = (side < 0 ? -1 : 1) * s;
      player.gunImg.scaleY = s;
      player.gunImg.setDepth(gunDepth);
    }
  }
  if (player.gun) {
    const gr2 = rot + dipR + swW;
    player.gun.setVisible(allowed && !useImg);
    let gx2 = hw.x + goX + _rkx, gy2 = hw.y + dipY + goY + _rky;
    if (swW) {
      const dx = gx2 - swPx, dy = gy2 - swPy;
      gx2 = swPx + dx * swC - dy * swS;
      gy2 = swPy + dx * swS + dy * swC;
    }
    player.gun.setPosition(gx2, gy2);
    player.gun.rotation = gr2;
    player.gun.scaleX = side < 0 ? -1 : 1;
    player.gun.setDepth(gunDepth);
  }
}

export function shoot(player, time, targetX, targetY) {
  if (player.dead || !player.weapon) {
    return;
  }
  // Замок после респауна: только что появившийся не стреляет мгновенно.
  if (player._shootLockUntil && time < player._shootLockUntil) {
    return;
  }
  // Стрелять можно всегда: пересечения с геометрией больше нет
  // (жёсткие рамки движения в _clampFighterMotion), гасить выстрел нечем.

  // Холд-детект для трубки (см. handleEmpty): одиночные клики идут
  // редко, зажатый спуск дёргает shoot каждый кадр (~16мс).
  const _gap = time - (player._lastShootCallAt || 0);
  player._shootHeld = !!(player._lastShootCallAt && _gap < 60);
  player._lastShootCallAt = time;

  // Трубка без магазина: выстрел прерывает дозарядку — бьём тем,
  // что уже заряжено (как у дробовиков). Пустая трубка — ждём патрон.
  if (player.weapon.reloading && player.weapon.noMag && player.weapon.magazine > 0) {
    player.weapon.cancelReload();
    // Флаг для handleEmpty: прерванную выстрелом трубку на зажатом
    // спуске не перезапускаем (иначе вечный цикл «выстрел–перезапуск»
    // по одному патрону — трубка не заряжается никогда, баг револьвера).
    player.weapon._tubeInterrupted = true;
  }

  if (!player.weapon.shoot(time)) {
    handleEmpty(player);
    return;
  }

  // Очередь (SIG SG 543): первый патрон сразу, остальные догоняют
  // за время звука выстрела (см. startBurst).
  const burstN = (!player.weapon.isMelee && player.weapon.burst > 1)
    ? Math.max(2, Math.floor(player.weapon.burst)) : 1;
  fireVolley(player, targetX, targetY, true);
  if (burstN > 1) startBurst(player, targetX, targetY, burstN - 1, player.weapon.name);
}

export function handleEmpty(player) {
  const w = player.weapon;
  if (!w) return;
  if (w.magazine <= 0 && !w.reloading && w.reserveAmmo > 0) {
    // Прерванную выстрелом трубку на зажатом спуске не перезапускаем
    // (см. выше). Отпустил спуск — следующий нажмите перезапустит.
    if (w.noMag && w._tubeInterrupted && player._shootHeld) return;
    w._tubeInterrupted = false;
    w.reload();
  } else if (w.magazine <= 0 && w.reserveAmmo <= 0 && !w.isMelee && !w.reloading) {
    // Пусто полностью (0/0) — переключаемся сами, а не щёлкаем вхолостую.
    player._autoSwitchWeapon();
  }
}

// Один залп: звук (опционально), вспышка, гильза, пули с разбросом.
export function fireVolley(player, targetX, targetY, playSound) {
  const angle = Phaser.Math.Angle.Between(
    player.x, player.y, targetX, targetY
  );

  if (player.weapon.isMelee) {
    player.setFlipX(targetX < player.x);
    meleeSwing(player, angle);
    return;
  }

  const muzzleRaw = muzzleWorld(player, angle);
  const effAngle = muzzleRaw ? player.aimAngle() : angle;
  // Твёрдость дула: не даём закинуть точку вылета за платформу —
  // упираем отрезок плечо→дуло в первую статику (см. _clampMuzzle).
  let mz = muzzleRaw;
  try {
    const sc = player.scene;
    if (mz && sc && typeof sc._clampMuzzle === 'function') {
      const bx = (player.armGun && player.armGun.x) || player.x;
      const by = (player.armGun && player.armGun.y) || (player.y - 16);
      mz = sc._clampMuzzle(bx, by, mz.x, mz.y);
    }
  } catch (e) {}
  const muzzle = mz;

  // Звук выстрела — только у первого патрона очереди (остальные летят
  // за время этого же звука). Сцена решает: файл shot_<Имя>.
  if (playSound && player.scene && typeof player.scene.sfxShot === 'function') {
    player.scene.sfxShot(player.weapon.name, player.weapon.magazine, muzzle ? muzzle.x : player.x, muzzle ? muzzle.y : player.y);
  }

  // Вспышка из ствола (сцена решает).
  if (muzzle && player.scene && typeof player.scene.spawnMuzzle === 'function') {
    player.scene.spawnMuzzle(muzzle.x, muzzle.y, effAngle);
  }
  // Вылет гильзы вбок-вверх.
  if (player.scene && typeof player.scene.spawnShell === 'function') {
    player.scene.spawnShell(
      muzzle ? muzzle.x : player.x, muzzle ? muzzle.y : player.y - 10,
      targetX < player.x ? -1 : 1
    );
  }

  let spread = player.weapon.spreadDeg;
  if (Math.abs(player.body?.velocity.x || 0) > 10) {
    spread *= 1.5;
  }
  if (!player.body?.blocked?.down && !player.body?.touching?.down) {
    spread *= 3;
  }
  spread *= player.spreadMult;

  const pellets = player.weapon.pellets || 1;
  let jitter = spread;
  if (pellets > 1) {
    jitter = player.weapon.pelletSpreadDeg != null
      ? player.weapon.pelletSpreadDeg
      : spread * 3;
  }
  const jitterRad = Phaser.Math.DegToRad(jitter);

  player.setFlipX(targetX < player.x);
  player._recoilT = player._recoilDur;

  const half = (pellets - 1) / 2;
  const perp = effAngle - Math.PI / 2;

  const ox = muzzle ? muzzle.x : player.x;
  const oy = muzzle ? muzzle.y : player.y - 10;

  // Конус дроби: видно 3–5 коротких трассеров, остальные дробинки
  // только наносят урон без отрисовки (без спама линиями).
  const visualN = pellets > 1 ? Math.min(pellets, 3 + Math.floor(Math.random() * 3)) : 1;
  for (let i = 0; i < pellets; i++) {
    const pelletAngle = effAngle + (Math.random() * 2 - 1) * jitterRad;
    const off = (i - half) * 4;
    const px = ox + Math.cos(effAngle) * (muzzle ? 0 : 25) + Math.cos(perp) * off;
    const py = oy + Math.sin(effAngle) * (muzzle ? 0 : 25) + Math.sin(perp) * off;

    const bullet = player.scene.spawnBullet(
      player,
      pelletAngle,
      (player.weapon.pelletDamage || player.weapon.damage) * player.damageMult,
      player.weapon.range * player.rangeMult,
      px, py, i < visualN
    );
    if (bullet && pellets > 1) {
      bullet.setScale(0.6);
      bullet.body.setCircle(2);
    }
  }
}

// Хвост очереди: оставшиеся патроны — без гейта темпа (очередь уже
// оплачена первым нажатием), каждый жрёт патрон из магазина.
// Смерть, смена ствола или пустой магазин очередь обрывают.
export function startBurst(player, targetX, targetY, remaining, wname) {
  if (!player.scene || !player.scene.time || typeof player.scene.time.delayedCall !== 'function') return;
  const gap = burstGap(player, wname);
  for (let i = 1; i <= remaining; i++) {
    try {
      player.scene.time.delayedCall(gap * i, () => {
        try {
          if (player.dead || !player.active || !player.weapon || player.weapon.isMelee) return;
          if (player.weapon.name !== wname) return;
          if (player.weapon.reloading) return;
          if (!player.weapon.infiniteAmmo) {
            if (player.weapon.magazine <= 0) {
              handleEmpty(player);
              return;
            }
            player.weapon.magazine -= 1;
          }
          fireVolley(player, targetX, targetY, false);
        } catch (e) {}
      });
    } catch (e) { break; }
  }
}

// Пауза между пулями очереди: звук выстрела делим на число промежутков,
// чтобы все пули вылетали за время его звучания. Длительность берём
// из живого сэмпла (кэш аудио), запасной вариант — 90мс.
export function burstGap(player, wname) {
  try {
    const w = player.weapon;
    if (w && w.burstGapMs > 0) return w.burstGapMs;
    player._burstGapCache = player._burstGapCache || {};
    if (player._burstGapCache[wname] > 0) return player._burstGapCache[wname];
    let ms = 90;
    const sc = player.scene;
    if (sc && sc.cache && sc.cache.audio && sc.cache.audio.exists('shot_' + wname)) {
      const entry = sc.cache.audio.get('shot_' + wname);
      const data = entry && (entry.data !== undefined ? entry.data : entry);
      const dur = data && (data.duration || (data.buffer && data.buffer.duration));
      if (Number.isFinite(dur) && dur > 0.05 && dur < 5) {
        ms = (dur * 1000 * 0.85) / 2;
      }
    }
    ms = Math.min(200, Math.max(40, ms));
    player._burstGapCache[wname] = ms;
    return ms;
  } catch (e) { return 90; }
}

// Мировой угол доворота рук и ствола за взмахом (0 — покой).
// Кривая: замах назад (0–30%), рубящий пронос (30–65%), возврат.
// Направление чередуется каждый удар (вверх-вниз / вниз-вверх).
export function swingRot(player) {
  try {
    if (!player._swingT || !player._swingDur) return 0;
    const p = Phaser.Math.Clamp(1 - player._swingT / player._swingDur, 0, 1);
    const d = player._swingDir || 1;
    const ease = v => v * v * (3 - 2 * v);
    if (p < 0.3) return -0.55 * d * ease(p / 0.3);
    if (p < 0.65) return d * (-0.55 + 1.75 * ease((p - 0.3) / 0.35));
    return d * 1.2 * (1 - ease((p - 0.65) / 0.35));
  } catch (e) { return 0; }
}

export function meleeSwing(player, angle) {
  player._recoilT = player._recoilDur;
  // Старт взмаха для анимации рук/ствола (см. swingRot).
  player._swingT = player._swingDur;
  player._swingDir = -(player._swingDir || 1);
  const range = player.weapon.range;
  const dmg = player.weapon.damage * player.damageMult;
  const arc = Math.PI * 0.6;
  // Взмах ближнего боя (п.28): у катаны/мачете свои файлы,
  // у ножа/топора — синтез свиста (записей нет).
  try {
    const sc = player.scene;
    const wn = (player.weapon && player.weapon.name) || '';
    const key = wn === 'катана' ? 'sfx_swing_katana' : wn === 'мачете' ? 'sfx_swing_machete' : null;
    if (key && sc && !sc.sound.locked && sc.cache.audio.exists(key)) {
      sc.sound.play(key, { volume: 0.35 });
    } else if ((wn === 'Knife' || wn === 'топор') && sc && !sc.sound.locked) {
      try { playSynthSwing(sc, wn, 0.35); } catch (e2) {}
    }
  } catch (e) {}
  const targets = player.scene.players || [];
  // След клинка: дуга вдоль сектора удара, гаснет за ~180мс.
  // Дешевле спрайтов со стрелками — одна graphics на взмах.
  try {
    const g = player.scene.add.graphics().setDepth(15);
    const r = range * 0.62;
    g.lineStyle(6, 0xffffff, 0.5);
    g.beginPath();
    g.arc(player.x, player.y, r, angle - arc, angle + arc, false);
    g.strokePath();
    g.lineStyle(2, 0xffffcc, 0.85);
    g.beginPath();
    g.arc(player.x, player.y, r, angle - arc * 0.8, angle + arc * 0.8, false);
    g.strokePath();
    player.scene.tweens.add({
      targets: g, alpha: 0, duration: 110,
      onComplete: () => { try { g.destroy(); } catch (e) {} }
    });
  } catch (e) {}
  targets.forEach(e => {
    if (e === player || !e.active || e.dead) return;
    if (e.team === player.team) return;
    const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
    if (d > range) return;
    const aTo = Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y);
    let diff = aTo - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= arc) {
      // Стена между мной и целью — урона нет (как у пуль: строгий hasWallLos).
      // След клинка выше уже нарисован — остаётся.
      try {
        const _scM = player.scene;
        if (_scM && typeof _scM.hasWallLos === 'function' && !_scM.hasWallLos(player.x, player.y, e.x, e.y, true)) return;
      } catch (_eM) {}
      // Ближний бой — без зональности (тело x1), киллфид по оружию.
      // Хук сетевой сцены (только она его задаёт): взмах по кукле
      // уходит серверу отдельным melee. В одиночке хука нет — как было.
      try {
        if (player.scene && typeof player.scene.onMeleeHit === 'function') player.scene.onMeleeHit(player, e, dmg);
      } catch (err) {}
      e.receiveDamage(dmg, player, undefined, 'body');
    }
  });
}

export function muzzleWorld(player, angle) {
  if (!player._handWorld) return null;
  // точка всегда есть: своя у оружия, иначе из «Точки вылета» в редакторе
  const wh = player._weaponHands();
  const m = (wh && wh.muzzle) || (player._rcfg && player._rcfg.muzzle) || { x: 60, y: -3 };
  // при зеркале (scaleX=-1) локальная ось Y руки инвертируется в мировом кадре
  const my = player._getSide() < 0 ? -m.y : m.y;
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  // Сдвиг ствола (СтвX/СтвY) двигает и точку вылета — она на стволе.
  // Та же рамка прицела, что в updateGun: X вперёд, Y вниз по оружию.
  const go = player._gunOffset(player.weapon && player.weapon.name);
  const goSgn = player._getSide() < 0 ? -1 : 1;
  const hx = player._handWorld.x + go.x * cs + go.y * (-sn) * goSgn;
  const hy = player._handWorld.y + go.x * sn + go.y * cs * goSgn;
  return {
    x: hx + m.x * cs - my * sn,
    y: hy + m.x * sn + my * cs
  };
}

export function throwGrenade(player, type, aimX, aimY) {
  if (player.dead) return;
  if (player._throwT >= 0) return;

  // Сток — per-life счётчики (выдаются по прокачке на бой/возрождение).
  // Персистентный склад магазина упразднён: не трогаем (только боты
  // раньше уходили в bypass, теперь тратят честно — им consume нельзя).
  if (type === 'frag') {
    if (player.fragGrenades <= 0) return;
    player.fragGrenades -= 1;
  } else if (type === 'smoke') {
    if (player.smokeGrenades <= 0) return;
    player.smokeGrenades -= 1;
  } else {
    return;
  }

  // бросок с анимацией: рука делает замах и кидает (спавн на релизе в updateThrowAnim)
  player._throwType = type;
  player._throwAimX = aimX;
  player._throwAimY = aimY;
  player._throwT = 0;
}

// продвижение анимации броска; на релизе (после замаха) спавнится граната
export function updateThrowAnim(player) {
  if (player._throwT < 0) return;
  const dt = (player.scene.game.loop && player.scene.game.loop.delta) || 16;
  const prev = player._throwT;
  player._throwT += dt;
  const wind = player._throwWind || 0.38;
  if (prev < player._throwDur * wind && player._throwT >= player._throwDur * wind && player._throwType) {
    const angle = Phaser.Math.Angle.Between(player.x, player.y, player._throwAimX, player._throwAimY);
    try {
      player.scene.throwGrenade(player, player._throwType, angle);
    } catch (e) {
      console.warn('[GRENADE] throw failed:', e);
    }
    player._throwType = null;
  }
  if (player._throwT >= player._throwDur) {
    player._throwT = -1;
    player._throwType = null;
  }
}
