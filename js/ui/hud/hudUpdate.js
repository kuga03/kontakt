import { renderTeamsBoard, drawScoreDots } from './boards.js';
import { updateHudTransform } from './hudModal.js';
import { drawAbilityCircle, drawCrosshair, drawReloadIcon } from './indicators.js';
import { weaponIcon, weaponImage, weaponHudScale, getWeaponLabel, weaponHasMag } from '../../data/weapons.js';

import { getClassAbility, ultUnlocked } from '../../data/abilities.js';
import { gameState, expRequired } from '../../data/gameState.js';
import { getRank } from '../../data/ranks.js';

import { gameW, BASE_CX } from '../layout.js';
export function updateHud(scene, time, delta) {
  const P = (typeof Phaser !== 'undefined') ? Phaser : null;
  const clamp = (P && P.Math && P.Math.Clamp) ? P.Math.Clamp : (v, a, b) => Math.max(a, Math.min(b, v));
  const _dt = (typeof delta === 'number' && delta > 0) ? delta : 16.666;
  const k = Math.min(1, _dt / 16.666);
  const lerp12 = 1 - Math.pow(1 - 0.12, k);
  const lerp20 = 1 - Math.pow(1 - 0.2, k);

  // Бенчмарк: HUD скрыт — обновляем только трассеры и камеру (боевые визуалы).
  if (scene._benchmark) {
    scene.drawTracers();
    scene.updateCameraZoom();
    scene.updateCameraFollow();
    return;
  }

  drawCrosshair(scene);
  drawReloadIcon(scene);
  updateHudTransform(scene);

  const hpTarget = clamp(scene.player.hp, 0, scene.player.maxHp);
  scene.hpDisp += (hpTarget - scene.hpDisp) * lerp12;
  const hp01 = clamp(scene.hpDisp / Math.max(1, scene.player.maxHp), 0, 1);
  scene.hpBarFill.width = ((scene._hudBarW || 438) - 6) * hp01;
  scene.hpBarFill.setFillStyle(hp01 > 0.3 ? 0x55ff55 : 0xff4444, 1);
  scene.hpBarText.setText(`${Math.round(scene.hpDisp)}`);

  const armorMax = Math.max(1, scene.player.maxArmor);
  const armorTarget = clamp(scene.player.armor, 0, scene.player.maxArmor);
  scene.armorDisp += (armorTarget - scene.armorDisp) * lerp12;
  const armor01 = clamp(scene.armorDisp / armorMax, 0, 1);
  scene.armorBarFill.width = ((scene._hudBarW || 438) - 6) * armor01;
  scene.armorBarText.setText(`${Math.round(scene.armorDisp)}`);

  const abilityElapsed = scene.time.now - scene.player.lastAbilityAt;
  const abilityTarget = clamp(abilityElapsed / scene.player.abilityCooldown, 0, 1);
  scene.abilityDisp += (abilityTarget - scene.abilityDisp) * lerp20;
  drawAbilityCircle(scene, scene.abilityDisp);
  scene.abilityLabel.setText(scene.player.abilityName || '—');
  if (scene.player.hasAbility) {
    const leftMs = scene.player.lastAbilityAt + scene.player.abilityCooldown - scene.time.now;
    if (leftMs > 0) {
      scene.abilityCircleText.setText((leftMs / 1000).toFixed(1));
      scene.abilityCircleText.setColor('#ffffff');
    } else {
      scene.abilityCircleText.setText('E');
      scene.abilityCircleText.setColor('#aaffaa');
    }
  } else {
    scene.abilityCircleText.setText('—');
    scene.abilityCircleText.setColor('#667788');
  }

  // Счётчики ячеек гранат (пустая — серая иконка).
  try {
    (scene.grenSlots || []).forEach(gs => {
      const n = gs.type === 'frag' ? scene.player.fragGrenades : scene.player.smokeGrenades;
      if (gs.count) {
        gs.count.setText(String(n | 0));
        gs.count.setColor((n | 0) > 0 ? '#ffffff' : '#776666');
      }
      if (gs.icon) {
        gs.icon.setTint((n | 0) > 0 ? 0xffffff : 0x555555);
        gs.icon.setAlpha((n | 0) > 0 ? 1 : 0.6);
      }
    });
  } catch (e) {}

  const ultAb = getClassAbility(scene.player.constructor.name);
  if (ultAb) {
    const p = scene.player;
    if (!ultUnlocked(ultAb.id)) {
      scene.ultHud.setText(`X:${ultAb.name} — ур.${ultAb.unlockLevel}`);
      scene.ultHud.setColor('#888888');
    } else if (p.ultActive) {
      const left = Math.max(0, p.ultEndsAt - scene.time.now);
      scene.ultHud.setText(`X:${ultAb.name} ${Math.ceil(left / 1000)}с`);
      scene.ultHud.setColor('#ffddaa');
    } else if (p.ultCharge < p.ultMaxCharge) {
      scene.ultHud.setText(
        `X:${ultAb.name} — килы ${p.ultCharge}/${p.ultMaxCharge}`
      );
      scene.ultHud.setColor('#cccccc');
    } else {
      scene.ultHud.setText(`X:${ultAb.name} — ГОТОВО`);
      scene.ultHud.setColor('#aaffaa');
    }
  } else {
    scene.ultHud.setText('');
  }

  const expNeed = expRequired(gameState.level);
  const expTarget = clamp(gameState.experience, 0, expNeed);
  scene.expDisp += (expTarget - scene.expDisp) * lerp12;
  scene.expBarFill.width = 616 * Math.min(1, scene.expDisp / expNeed);
  scene.expRankText.setText(`${getRank(gameState.level)}  ·  ур. ${gameState.level}`);
  scene.expRelText.setText(`${gameState.experience}/${expNeed} оп.`);

  if (gameState.level > scene._prevLevel) {
    scene._prevLevel = gameState.level;
    scene.showLevelUpAura();
  }

  // Слоты статичны по категориям (основное/второе/холодное), а не по
  // порядку инвентаря: подобранный пистолет больше не прыгает в ячейку ножа.
  // В категории показываем активный ствол, иначе первый.
  const invList = scene.player.inventory || [];
  const activeW = invList[scene.player.activeWeaponIndex] || null;
  // Тот же порядок, что у клавиш 1/2/3 (selectWeaponSlot): первый в категории.
  const byCat = (pred) => invList.find(w => w && pred(w)) || null;
  const ordered = [
    byCat(w => w.category === 'primary' && !w.isMelee),
    byCat(w => w.category === 'secondary'),
    byCat(w => w.isMelee || w.category === 'melee')
  ];
  ordered.forEach((w, i) => {
    if (!w) {
      if (scene.weaponSlots[i]) {
        if (scene.weaponSlots[i].sel) scene.weaponSlots[i].sel.setVisible(false);
        scene.weaponSlots[i].selActive = null;
        if (scene.weaponSlotHits[i]) scene.weaponSlotHits[i].setVisible(false);
        scene.weaponSlotTexts[i].icon.setVisible(false);
        scene.weaponSlotTexts[i].label.setVisible(false);
        scene.weaponSlotTexts[i].ammoText.setVisible(false);
        if (scene.weaponSlotTexts[i].mags) scene.weaponSlotTexts[i].mags.setVisible(false);
      }
      return;
    }
    if (!scene.weaponSlots[i]) return;
    const active = activeW === w;
    const info = scene.weaponSlots[i];
    const sel = info.sel;
    if (scene.weaponSlotHits[i]) scene.weaponSlotHits[i].setVisible(true);
    // Контур только у выбранного; перерисовка при смене выбора.
    if (info.selActive !== active) {
      info.selActive = active;
      try {
        sel.clear();
        if (active) {
          const ow = info.iconW + 22, oh = info.iconH + 26;
          sel.lineStyle(3, 0xffee55, 1);
          sel.strokeRoundedRect(info.sx - ow / 2, info.sy - oh / 2, ow, oh, 10);
        }
      } catch (e) {}
    }
    sel.setVisible(true);
    const invZ = 1 / scene.cameras.main.zoom;
    const icon = scene.weaponSlotTexts[i].icon;
    icon.setVisible(true);
    // Нож и ближний бой — настоящий PNG, а не заглушка (п.14).
    const imgKey = (scene.textures.exists(weaponImage(w.name)) && weaponImage(w.name)) || weaponIcon(w.name);
    icon.setTexture(imgKey);
    // Иконка фитом в свой бокс — целиком внутри. Выбранность показывает
    // только контур вокруг (типт PNG одинаковый у всех).
    // Поправка weaponHudScale: поля исходников разные (револьвер впритык,
    // миниган с запасом) — без неё пропорции абсурдные.
    // Ближний бой: иконка чуть крупнее и левее центра (иначе мелкий
    // нож теряется в слоте), счётчика под ним нет вообще.
    // Позиция — с той же компенсацией зума, что updateHudTransform
    // (640+(x-640)/z): абсолютные координаты при зуме уводили иконку из слота.
    const meleeK = w.isMelee ? 1.3 : 1;
    const _hz = scene.cameras.main.zoom || 1;
    const _hdx = w.isMelee ? -12 : 0;
    icon.setScale(Math.min(info.iconW / icon.width, info.iconH / icon.height) * weaponHudScale(w.name) * invZ * meleeK);
    icon.setPosition(gameW(scene) / 2 + (info.sx + _hdx - BASE_CX) / _hz, 360 + (info.sy - 360) / _hz);
    icon.setTint(0xffffff);
    scene.weaponSlotTexts[i].label.setVisible(true);
    scene.weaponSlotTexts[i].label.setText(getWeaponLabel(w.name));
    scene.weaponSlotTexts[i].label.setColor(active ? '#ffff55' : '#cccccc');
    const ammoTxt = scene.weaponSlotTexts[i].ammoText;
    const mags = scene.weaponSlotTexts[i].mags;
    // Магазинное: число — патроны в текущем магазине, запас — пипсами.
    // Трубка (помпы/обрез/револьвер/RPG): как было, числом через дробь.
    const hasMag = !w.isMelee && weaponHasMag(w.name);
    if (w.isMelee) {
      ammoTxt.setVisible(false);
      if (mags) mags.setVisible(false);
    } else if (hasMag) {
      ammoTxt.setVisible(true);
      ammoTxt.setText(`${w.magazine}`);
      if (w.magazine <= 0) {
        ammoTxt.setColor('#ff4444');
      } else if (w.reloading) {
        ammoTxt.setColor('#ff8844');
      } else {
        ammoTxt.setColor(active ? '#ffffff' : '#dddddd');
      }
      if (mags) {
        mags.setVisible(true);
        try {
          const size = Math.max(1, w.magazineSize | 0);
          const res = Math.max(0, w.reserveAmmo | 0);
          mags.clear();
          for (let k = 0; k < 2; k++) {
            const px = 20 + k * 15, py = -3.5;
            mags.lineStyle(1, 0x444466, 1);
            mags.strokeRect(px, py, 12, 7);
            if (res >= (k + 1) * size) {
              mags.fillStyle(0xffcc44, 1);
              mags.fillRect(px + 1, py + 1, 10, 5);
            } else if (res > k * size) {
              // Початый магазин — тускло.
              mags.fillStyle(0x775522, 1);
              mags.fillRect(px + 1, py + 1, 10, 5);
            }
          }
        } catch (e) {}
      }
    } else {
      ammoTxt.setVisible(true);
      ammoTxt.setText(`${w.magazine}/${w.reserveAmmo}`);
      if (w.magazine <= 0) {
        ammoTxt.setColor('#ff4444');
      } else if (w.reloading) {
        ammoTxt.setColor('#ff8844');
      } else {
        ammoTxt.setColor(active ? '#ffffff' : '#dddddd');
      }
      if (mags) mags.setVisible(false);
    }
  });

  scene.updateCameraZoom();
  scene.updateCameraFollow();
  scene.drawTracers();

  // Фоновые дома стоят как вкопанные (параллакс выключен по просьбе:
  // при ходьбе ничего на заднем плане не едет).

  if (scene.mode === 'CAMPAIGN') return;

  if (scene.mode === 'FFA') {
    const rows = Object.entries(scene.scores)
      .sort((a, b) => b[1] - a[1])
      .map(([n, s], i) => `${i + 1}. ${n} — ${s}`);
    scene.scoreHud.setText(`До ${scene.scoreLimit | 0} фрагов\n` + rows.join('\n'));

    if (scene.keys.tab.isDown) {
      renderTeamsBoard(scene);
      scene.scoreboard.setVisible(true);
    } else {
      scene.scoreboard.setVisible(false);
    }
  } else if (scene.mode === 'TDM' || scene.mode === 'CTF' || scene.mode === 'KOTH' || scene.mode === 'BOMB') {
    if (scene.scoreBlue && scene.mode !== 'KOTH') {
      // CTF/BOMB с малым лимитом (до 10): чистые цифры + точки прогресса
      // под счётом (лимит читается по числу точек). Большой лимит и TDM —
      // как раньше дробью «счёт/лимит» (60 точек не нарисуешь).
      // KOTH свой ряд-канат рисует сам — этот пропускаем.
      // Ряд сам центрируется ниже — длинные числа не кренят.
      const _lim = Math.max(1, scene.scoreLimit | 0 || 1);
      const _dotsOn = (scene.mode === 'CTF' || scene.mode === 'BOMB') && _lim <= 10;
      // Таймер раунда переезжает в ряд вместо ":" (только режим точек,
      // иначе он живёт под счётом на y62). Домой (640,62) возвращаем,
      // если точки выключили (лимит сменился вверх — из лобби не бывает,
      // но перестраховка дешёвая).
      let _timerObj = null, _timerItem = null;
      if (_dotsOn) {
        scene.scoreBlue.setText(`${scene.scores.blue | 0}`);
        scene.scoreRed.setText(`${scene.scores.red | 0}`);
        try {
          _timerObj = scene.mode === 'CTF' ? scene.ctfTimerHud : scene.bombTimerHud;
          if (_timerObj) {
            _timerItem = scene.hudFixed.find(h => h.obj === _timerObj) || null;
            if (_timerItem && _timerItem._homeSx === undefined) {
              _timerItem._homeSx = _timerItem.sx;
              _timerItem._homeSy = _timerItem.sy;
            }
          }
        } catch (e) {}
        try { if (scene.scoreMid) scene.scoreMid.setVisible(false); } catch (e) {}
      } else {
        scene.scoreBlue.setText(`${scene.scores.blue | 0}/${_lim}`);
        scene.scoreRed.setText(`${scene.scores.red | 0}/${_lim}`);
        try { if (scene.scoreMid) scene.scoreMid.setVisible(true); } catch (e) {}
        try {
          const _tObj = scene.mode === 'CTF' ? scene.ctfTimerHud : scene.bombTimerHud;
          if (_tObj) {
            const _tItem = scene.hudFixed.find(h => h.obj === _tObj) || null;
            if (_tItem && _tItem._homeSx !== undefined) {
              _tItem.sx = _tItem._homeSx;
              _tItem.sy = _tItem._homeSy;
            }
          }
        } catch (e) {}
      }
      // Центрируем ряд вокруг реального центра экрана (на 16:9 = 640,
      // как было) с равными зазорами: при длинных числах ряд не кренится,
      // таймер/«:» всегда в середине. Все элементы — один y. Середина:
      // таймер (режим точек) или ":".
      try {
        const gap = 14;
        const z = scene.cameras.main.zoom || 1;
        const _cx = gameW(scene) / 2;
        // Ширины — в ЛОГИЧЕСКИХ единицах (displayWidth уже включает
        // контр-зум 1/z, умножаем обратно): иначе при отдалении ряд
        // разъезжается — бейджи уходят от цифр.
        const dw = o => (o && o.displayWidth ? o.displayWidth * z : 0);
        const bw = dw(scene.scoreBlue);
        const rw = dw(scene.scoreRed);
        const bbw = scene.scoreBadgeB ? dw(scene.scoreBadgeB) : 0;
        const rbw = scene.scoreBadgeR ? dw(scene.scoreBadgeR) : 0;
        const bbg = scene.scoreBadgeB ? gap : 0;
        const rbg = scene.scoreBadgeR ? gap : 0;
        const useTimer = !!(_dotsOn && _timerItem && _timerObj && _timerObj.active);
        // Таймер — в фиксированном слоте 70 (цифры пропорциональные:
        // замер живьём тряс весь ряд каждую секунду). Слот с запасом
        // («10:00» ~60px), таймер в нём по центру (origin 0.5).
        const midW = useTimer ? 70 : dw(scene.scoreMid);
        const total = bbw + bbg + bw + gap + midW + gap + rw + rbg + rbw;
        const x0 = _cx - total / 2;
        const place = (item, sx) => {
          if (!item) return;
          item.sx = sx;
          if (item.obj && item.obj.active) {
            item.obj.setPosition(_cx + (sx - _cx) / z, 360 + (10 - 360) / z);
          }
        };
        let x = x0;
        if (scene._scoreBadgeBItem) {
          place(scene._scoreBadgeBItem, x + bbw / 2);
          x += bbw + bbg;
        }
        place(scene._scoreBlueItem, x);
        x += bw + gap;
        if (useTimer) {
          // Таймер origin 0.5 — ставим центром на середину высоты плашек (y30).
          const mcx = x + midW / 2;
          _timerItem.sx = mcx;
          _timerObj.setPosition(_cx + (mcx - _cx) / z, 360 + (30 - 360) / z);
        } else {
          try { if (scene.scoreMid) scene.scoreMid.setVisible(true); } catch (e) {}
          place(scene._scoreMidItem, x + midW / 2);
        }
        x += midW + gap;
        place(scene._scoreRedItem, x);
        x += rw + rbg;
        if (scene._scoreBadgeRItem) place(scene._scoreBadgeRItem, x + rbw / 2);
      } catch (e) {}
      // Точки — после центрирования: им нужны свежие центры бейджей.
      drawScoreDots(scene);
    } else {
      scene.scoreHud.setText(
        `Синие: ${scene.scores.blue} : ${scene.scores.red} : Красные`
      );
    }
    if (scene.mode === 'KOTH') scene._updateKothHud(time);
    if (scene.mode === 'CTF') scene._updateCtfHud(time);
    if (scene.mode === 'TDM') scene._updateTdmHud(time);

    if (scene.keys.tab.isDown) {
      renderTeamsBoard(scene);
      scene.scoreboard.setVisible(true);
    } else {
      scene.scoreboard.setVisible(false);
    }
  } else if (scene.mode === 'BOMB') {
    // Счёт уехал наверх по центру; таймер — в своей плашке сверху.
    // Внизу справа в бомбе пусто.
    scene.scoreHud.setText('');
  } else {
    // Испытание и прочие: чужого командного счёта тут нет.
    scene.scoreHud.setText('');
  }
}

// Аура повышения уровня (было в GameScene.showLevelUpAura).
export function showLevelUpAura(scene) {
  const p = scene.player;
  const cx = p.x;
  const cy = p.y - 20;
  const colors = [0xffd700, 0xffaa00, 0xffff44, 0xff8800];
  const aura = scene.add.container(cx, cy).setDepth(15);
  for (let i = 0; i < 3; i++) {
    const r = 30 + i * 18;
    const circ = scene.add.circle(0, 0, r, colors[i % colors.length], 0.25 - i * 0.06);
    aura.add(circ);
  }
  const txt = scene.add.text(0, -50, `УРОВЕНЬ ${gameState.level}`, {
    fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 3
  }).setOrigin(0.5);
  aura.add(txt);
  scene.tweens.add({
    targets: aura,
    alpha: 0,
    scaleX: 2,
    scaleY: 2,
    duration: 2000,
    ease: 'Cubic.easeOut',
    onComplete: () => aura.destroy()
  });
}
