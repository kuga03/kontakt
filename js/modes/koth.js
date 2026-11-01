// koth.js — режим «Захват точек» (было в GameScene).
// KOTH_NEED/KOTH_TIME живут здесь; GameScene берёт их отсюда (без циклов).
export const KOTH_NEED = 4000;
export const KOTH_TIME = 5 * 60 * 1000;

// Флаги CTF каждый кадр: подбор врагом, возврат своим касанием,
// доставка чужого флага на свою базу. Работает и для игрока, и для ботов.
// Точки KOTH каждый кадр (по ТЗ): захват одиночным присутствием 4с,
// спор (обе команды) — заморозка, 2+ своих ускоряют (×1.5/×2),
// уход — медленный распад, удержание капает очки (B — двойные).
export function updateKoth(scene, time) {
  if (scene.mode !== 'KOTH' || !scene.kothPoints) return;
  const dt = Math.min(100, Math.max(1, time - (scene._kothT || time)));
  scene._kothT = time;
  const R = 130;
  scene.kothPoints.forEach(pt => {
    let blue = 0, red = 0;
    scene.players.forEach(p => {
      if (!p || p.dead || !p.active) return;
      if (Math.abs(p.x - pt.x) > R || Math.abs(p.y - pt.y) > 70) return;
      if (p.team === 'blue') blue++;
      else if (p.team === 'red') red++;
    });
    const only = blue > 0 && red === 0 ? 'blue' : red > 0 && blue === 0 ? 'red' : null;
    const contested = blue > 0 && red > 0;
    const cur = contested ? 'contest' : (only ? 'cap' : 'idle');
    if (cur !== pt._st) {
      pt._st = cur;
      if (cur === 'contest') kothFx(scene, pt.x, pt.y, 'СПОР...', '#ffdd55');
      // ЗАХВАТ — только когда точку реально отжимают (стоит чужая),
      // на своей удерживаемой надписи не надо.
      else if (cur === 'cap' && pt.holder !== only) kothFx(scene, pt.x, pt.y, 'ЗАХВАТ...', only === 'blue' ? '#7db8ff' : '#ff6666');
    }
    if (contested && blue !== red) {
      // Спор неравными силами: большинство медленно дожимает (половина
      // темпа). Иначе вечная толкотня — точку не взять никогда.
      // Равные силы — честная заморозка до убийства.
      const side = blue > red ? 1 : -1;
      const k = (blue > red ? blue : red) > 1
        ? Math.min(2, 1 + 0.5 * ((blue > red ? blue : red) - 1))
        : 1;
      pt.prog += side * dt * 0.5 * k;
    } else if (contested) {
      // Заморозка: никто не захватывает, пока не убьёт противника.
    } else if (only) {
      const k = only === 'blue' ? blue : red;
      const mult = Math.min(2, 1 + 0.5 * (k - 1));
      pt.prog += (only === 'blue' ? 1 : -1) * dt * mult;
    } else if (pt.prog > 0) {
      pt.prog = Math.max(0, pt.prog - dt * 0.5);
    } else if (pt.prog < 0) {
      pt.prog = Math.min(0, pt.prog + dt * 0.5);
    }
    if (pt.holder === 'blue') pt.prog = Math.min(pt.prog, 0);
    else if (pt.holder === 'red') pt.prog = Math.max(pt.prog, 0);
    if (pt.prog >= KOTH_NEED && pt.holder !== 'blue') {
      pt.holder = 'blue';
      pt.prog = 0;
      pt.tick = 0;
      pt._st = 'cap';
      paintKoth(scene, pt);
      kothFx(scene, pt.x, pt.y, 'ЗАХВАЧЕНО!', '#7db8ff');
      try { scene._ctfBanner(`СОЮЗНИКИ ЗАХВАТИЛИ ТОЧКУ ${pt.name}!`, '#7db8ff', undefined, 14); } catch (e) {}
      try { scene._playFlagSfx('ally'); } catch (e) {}
      // Счётчик захватов — всем своим в зоне (звезда лучшего).
      try {
        (scene.players || []).forEach(p => {
          if (!p || p.dead || !p.active || p.team !== 'blue') return;
          if (Math.abs(p.x - pt.x) > 130 || Math.abs(p.y - pt.y) > 70) return;
          p.caps = (p.caps | 0) + 1;
        });
      } catch (eC) {}
      // Игрок был в зоне захвата — ему награда (потолок 5 = 100 монет/бой).
      try {
        const me = scene.player;
        if (me && !me._demoPuppet && me.team === 'blue' && !me.dead && me.active &&
            Math.abs(me.x - pt.x) <= 130 && Math.abs(me.y - pt.y) <= 70 &&
            (scene._kothCaps | 0) < 5 && scene._rewardObjectiveEvent) {
          scene._kothCaps = (scene._kothCaps | 0) + 1;
          scene._rewardObjectiveEvent(20, 10, 'cap');
        }
      } catch (eR) {}
      if (scene._kothOvertime) {
        scene.endGame('Синие победили', true);
        return;
      }
    } else if (pt.prog <= -KOTH_NEED && pt.holder !== 'red') {
      pt.holder = 'red';
      pt.prog = 0;
      pt.tick = 0;
      paintKoth(scene, pt);
      pt._st = 'cap';
      kothFx(scene, pt.x, pt.y, 'ЗАХВАЧЕНО!', '#ff8888');
      try { scene._ctfBanner(`ВРАГИ ЗАХВАТИЛИ ТОЧКУ ${pt.name}!`, '#ff6666', undefined, 14); } catch (e) {}
      try { scene._playFlagSfx('foe'); } catch (e) {}
      // Счётчик захватов — всем своим в зоне (звезда лучшего).
      try {
        (scene.players || []).forEach(p => {
          if (!p || p.dead || !p.active || p.team !== 'red') return;
          if (Math.abs(p.x - pt.x) > 130 || Math.abs(p.y - pt.y) > 70) return;
          p.caps = (p.caps | 0) + 1;
        });
      } catch (eC) {}
      // Игрок-красный был в зоне захвата — ему награда (потолок 5 = 100/бой).
      try {
        const me = scene.player;
        if (me && !me._demoPuppet && me.team === 'red' && !me.dead && me.active &&
            Math.abs(me.x - pt.x) <= 130 && Math.abs(me.y - pt.y) <= 70 &&
            (scene._kothCaps | 0) < 5 && scene._rewardObjectiveEvent) {
          scene._kothCaps = (scene._kothCaps | 0) + 1;
          scene._rewardObjectiveEvent(20, 10, 'cap');
        }
      } catch (eR) {}
      if (scene._kothOvertime) {
        scene.endGame('Красные победили', false);
        return;
      }
    }
    // Дуга прогресса — только при заметном сдвиге. Следим и за знаком,
    // и за точной долей: иначе при полном откате полоска застревает
    // в чужом цвете вместо возврата цвета владельца.
    const shown = Math.round(Math.abs(pt.prog) / KOTH_NEED * 20);
    const fracNow = Math.abs(pt.prog || 0) / KOTH_NEED;
    const signNow = Math.sign(pt.prog || 0);
    if (shown !== pt._shown || pt.holder !== pt._shownH ||
        Math.abs(fracNow - (pt._shownF || 0)) > 0.03 ||
        signNow !== (pt._shownS ?? null)) {
      pt._shown = shown;
      pt._shownH = pt.holder;
      pt._shownF = fracNow;
      pt._shownS = signNow;
      paintKoth(scene, pt);
    }
    if (pt.holder && !scene._kothOvertime) {
      pt.tick += dt;
      // +1 очко в секунду за точку, B — двойные.
      if (pt.tick >= 1000) {
        pt.tick = 0;
        const add = pt.name === 'Б' ? 2 : 1;
        scene.scores[pt.holder] = (scene.scores[pt.holder] || 0) + add;
        scene.checkVictory();
        if (scene.gameOver) return;
      }
    }
  });
}

export function paintKoth(scene, pt) {
  try {
    const col = pt.holder === 'blue' ? 0x4488ff : pt.holder === 'red' ? 0xff4444 : 0x888899;
    const baseY = pt.y;
    // Овалов зон нет (убраны): граница невидима, логика та же.
    if (pt.zone) {
      try { pt.zone.clear(); } catch (e) {}
    }
    // Флаг-арт по владельцу (игрок всегда за синих): синий — свой,
    // красный — вражеский, нейтральный — ничей. Красный зеркалим,
    // чтобы полотнища смотрели в разные стороны.
    // Низ флага вбит в землю (gy), позиция обновляется на случай сдвига.
    if (pt.flagImg) {
      try {
        const key = pt.holder === 'blue' ? 'flag_ally'
          : pt.holder === 'red' ? 'flag_foe' : 'flag_neutral';
        if (scene.textures.exists(key)) pt.flagImg.setTexture(key);
        pt.flagImg.setFlipX(pt.holder === 'red');
        pt.flagImg.setPosition(pt.x, (pt.gy != null ? pt.gy : baseY) + 2);
        pt.flagImg.setVisible(true);
      } catch (e) {}
    }
    // Флаг: основание + древко + навершие + полотнище в цвет владельца.
    // (Запасной вектор — только если нет артов; низ на земле gy.)
    if (pt.flag) {
      const g = pt.flag;
      g.clear();
      const gy = pt.gy != null ? pt.gy : baseY;
      const topY = gy - 104;
      g.fillStyle(0x1a1a2e, 1);
      g.fillRect(pt.x - 12, gy - 4, 24, 8);
      g.lineStyle(1.5, col, 1);
      g.strokeRect(pt.x - 12, gy - 4, 24, 8);
      g.fillStyle(0x8a6f4d, 1);
      g.fillRect(pt.x - 2, topY, 5, gy - topY);
      g.lineStyle(1, 0x4a3a28, 1);
      g.strokeRect(pt.x - 2, topY, 5, gy - topY);
      g.fillStyle(col, 1);
      g.fillCircle(pt.x + 0.5, topY - 4, 4);
      const cx0 = pt.x + 3, cy0 = topY + 2;
      g.fillStyle(col, 1);
      g.beginPath();
      g.moveTo(cx0, cy0);
      g.lineTo(cx0 + 46, cy0 + 7);
      g.lineTo(cx0 + 30, cy0 + 15);
      g.lineTo(cx0 + 46, cy0 + 23);
      g.lineTo(cx0, cy0 + 30);
      g.closePath();
      g.fillPath();
      g.lineStyle(1.5, 0x000000, 0.35);
      g.strokePath();
    }
    // Полоса захвата — чётко ПОД флагом (с зазором под основанием),
    // а не на одном уровне с ним: иначе древко проходит сквозь бар.
    // B — на своей платформе (её gy).
    if (pt.bar) {
      const b = pt.bar;
      b.clear();
      const bw = 120, bh = 12;
      const gyB = (pt.gy != null ? pt.gy : baseY);
      const bx = pt.x - bw / 2, by = gyB + 8;
      b.fillStyle(0x0a0a18, 0.85);
      b.fillRect(bx, by, bw, bh);
      b.lineStyle(1.5, col, 1);
      b.strokeRect(bx, by, bw, bh);
      const frac = Math.min(1, Math.abs(pt.prog || 0) / KOTH_NEED);
      let fillCol = col, fillFrac = 0;
      if (frac > 0.02) {
        fillCol = (pt.prog || 0) >= 0 ? 0x4488ff : 0xff4444;
        fillFrac = frac;
      } else if (pt.holder) {
        fillCol = col;
        fillFrac = 1;
      }
      if (fillFrac > 0) {
        b.fillStyle(fillCol, 1);
        b.fillRect(bx + 2, by + 2, Math.max(1, Math.round((bw - 4) * fillFrac)), bh - 4);
      }
    }
    pt.lbl.setColor(pt.holder === 'blue' ? '#7db8ff' : pt.holder === 'red' ? '#ff8888' : '#ffffff');
  } catch (e) {}
}

// Всплывающий статус точки (захват/спор/захвачено). Компактный шрифт,
// чтобы не перекрывать бой.
export function kothFx(scene, x, y, text, color) {
  try {
    const t = scene.add.text(x, y - 110, text, {
      fontSize: '14px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(15);
    scene.tweens.add({
      targets: t, y: y - 160, alpha: 0, duration: 1200,
      onComplete: () => t.destroy()
    });
  } catch (e) {}
}

export function updateKothHud(scene, time) {
  try {
    if (scene.kothTimerHud) {
      if (scene._kothOvertime) {
        scene.kothTimerHud.setText('ОТ').setColor('#ffd24a');
      } else {
        const left = scene._matchLeft(scene._kothDur, time);
        if (left == null) return;
        const mm = Math.floor(left / 60000);
        const ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
        scene.kothTimerHud.setText(`${mm}:${ss}`);
      }
    }
    (scene.kothLetters || []).forEach((t, i) => {
      const pt = (scene.kothPoints || [])[i];
      if (!t || !pt) return;
      t.setColor(pt.holder === 'blue' ? '#6db8ff' : pt.holder === 'red' ? '#ff6666' : '#888899');
    });
    // Канат: полосы ползут от краёв, числа — внутри полос, лимит — между.
    try {
      const lim = Math.max(1, scene.scoreLimit | 0 || 1);
      const b = scene.scores.blue | 0, r = scene.scores.red | 0;
      const P = (typeof Phaser !== 'undefined') ? Phaser : null;
      const clamp = (P && P.Math && P.Math.Clamp) ? P.Math.Clamp : (v, a, b2) => Math.max(a, Math.min(b2, v));
      if (scene._kRowBlueFill) scene._kRowBlueFill.scaleX = Math.max(0.0001, clamp(b / lim, 0, 1));
      if (scene._kRowRedFill) scene._kRowRedFill.scaleX = Math.max(0.0001, clamp(r / lim, 0, 1));
      if (scene._kRowBlueNum) scene._kRowBlueNum.setText(`${b}`);
      if (scene._kRowRedNum) scene._kRowRedNum.setText(`${r}`);
      if (scene._kRowLimNum && scene._kRowLimShown !== lim) {
        scene._kRowLimShown = lim;
        scene._kRowLimNum.setText(`${lim}`);
      }
    } catch (e2) {}
  } catch (e) {}
}
