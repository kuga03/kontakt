import { gameState, addCoins, addExperience, setTrialRecord, saveGameState } from '../../data/gameState.js?v=171';

import { trialEndedTime } from '../../modes/trial.js?v=206';

import { reapplyGlassOnRevive } from '../../data/mutators.js?v=2';
import { gameW } from '../../ui/layout.js?v=3';
import { bumpObj } from '../score.js';
import { flushPlayTime, recordPlayerKill, killXP, rewardObjectiveEvent } from './activity.js';
import { recordMatch } from './endGame.js';
// База своей команды (игрок в одиночке всегда за синих).
function _teamBaseX(scene) {
  return scene.mode === 'CTF' ? 220
    : scene.mode === 'TDM' ? 180
    : scene.mode === 'BOMB' ? 220
    : scene.mode === 'KOTH' ? 220 : 260;
}

// Кандидаты точки возрождения игрока. Место смерти в них не входит:
// берём спавны карты/базы (командные режимы) или разброс по арене (FFA).
function _playerRespawnCandidates(scene) {
  const out = [];
  const seen = new Set();
  const push = (x, y) => {
    if (!Number.isFinite(x)) return;
    const key = Math.round(x) + ':' + (Number.isFinite(y) ? Math.round(y) : '');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y: Number.isFinite(y) ? y : null });
  };
  try {
    const cs = scene.campaignSpawns || {};
    if (scene.mode === 'FFA') {
      // FFA: равномерный разброс + готовые точки арены.
      if (cs.player) push(cs.player.x, cs.player.y);
      (scene.ffaSpawns || []).forEach(s => { if (s) push(s.x, s.y); });
      const W = scene.mapWidth || 3000;
      const lo = Math.max(80, Math.min(380, W - 80));
      const hi = Math.max(lo, W - 380);
      for (let i = 0; i < 10; i++) {
        const x = (typeof Phaser !== 'undefined' && Phaser.Math)
          ? Phaser.Math.Between(lo, hi)
          : lo + Math.random() * Math.max(1, hi - lo);
        push(x, null);
      }
    } else {
      // Командные режимы: точки карты (team/player) — они и есть своя база.
      (cs.team || []).forEach(s => { if (s) push(s.x, s.y); });
      if (cs.player) push(cs.player.x, cs.player.y);
      const baseX = _teamBaseX(scene);
      // Запас по своей стороне: даже если умер на базе — встанем рядом,
      // но не в ту же точку. ±80 — тот же разброс, что был у старой базы.
      [-80, 0, 80, 140, 280, 420].forEach(dx => push(baseX + dx, null));
    }
  } catch (e) {}
  return out;
}

// Точка возрождения игрока: сначала подальше от места смерти, затем —
// от живых врагов (анти-спавн-килл). Возвращает {x,y}.
function _pickPlayerRespawn(scene, victim, deathX, deathY) {
  const valid = [];
  for (const c of _playerRespawnCandidates(scene)) {
    let x = c.x, y = c.y;
    try {
      if (!Number.isFinite(y)) y = scene._groundSpawnY(x);
      if (scene._inSolid && scene._inSolid(x, y, 30)) y = scene._groundSpawnY(x);
      const sv = scene._validateSpawn(x, y);
      x = sv.x; y = sv.y;
    } catch (e) { continue; }
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    valid.push({ x, y });
  }
  if (!valid.length) {
    const bx = _teamBaseX(scene);
    const by = scene._groundSpawnY ? scene._groundSpawnY(bx) : (scene.mapHeight ? scene.mapHeight - 120 : 750);
    return { x: bx, y: by };
  }
  const minDist = scene.mode === 'FFA' ? 400 : 180;
  let pool = valid.filter(p => Math.hypot(p.x - deathX, p.y - deathY) >= minDist);
  if (!pool.length) {
    // Если все спавны оказались ближе minDist к месту смерти (умерли прямо на базе),
    // отфильтровываем хотя бы точную точку смерти, но не падаем на смерть!
    pool = valid.filter(p => Math.hypot(p.x - deathX, p.y - deathY) > 20);
    if (!pool.length) pool = valid;
  }
  const enemies = (scene.players || []).filter(p =>
    p && p !== victim && !p.dead && p.active && p.team && p.team !== victim.team
  );
  // В командных режимах база — дом: из подходящих точек берём ближайшую
  // к своей базе (но не место смерти). В FFA базы нет — уходим от смерти.
  const anchorX = _teamBaseX(scene);
  if (scene.mode !== 'FFA') {
    // В командных режимах база — главный приоритет.
    // Сначала ищем точки кандидатов у базы (|x - anchorX| <= 100).
    const home = pool.filter(c => Math.abs(c.x - anchorX) <= 100);
    if (home.length) {
      const i = (typeof Phaser !== 'undefined' && Phaser.Math)
        ? Phaser.Math.Between(0, home.length - 1)
        : (Math.random() * home.length) | 0;
      return home[i];
    }
    // Если точек в радиусе 100 нет (например, все точки у базы отсеклись как deathX),
    // берем ближайшую к базе точку из пула, а не точку смерти
    pool.sort((a, b) => Math.abs(a.x - anchorX) - Math.abs(b.x - anchorX));
    return pool[0];
  }
  let best = pool[0], bestScore = -Infinity;
  for (const c of pool) {
    const d = Math.hypot(c.x - deathX, c.y - deathY);
    let clear = 1000;
    for (const e of enemies) {
      const ed = Math.hypot(c.x - e.x, c.y - e.y);
      if (ed < clear) clear = ed;
    }
    const score = (scene.mode === 'FFA')
      ? d + Math.min(clear, 600) * 0.35
      : -Math.abs(c.x - anchorX) + Math.min(clear, 400) * 0.08;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

export function handleDeath(scene, victim, killer, src) {
  // После конца матча долетевший урон/счёт не считаем,
  // но несомые флаг/бомбу роняем: иначе висят на трупе.
  if (scene.gameOver) {
    try {
      [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag].forEach(f => {
        if (f && f.carrier === victim) f.drop();
      });
      [scene.blueBomb, scene.redBomb].forEach(b => {
        if (b && b.carrier === victim) b.drop();
      });
      try { if (scene._turret && scene._turret.carrier === victim) scene._dropTurret(); } catch (e) {}
    } catch (e) {}
    return;
  }
  // Киллфид как в CS:GO (п.19): везде, кроме кампании, правый верхний угол.
  // src — честный источник (граната/ракета), иначе текущее оружие убийцы.
  scene._pushKillFeed(killer, victim, src);
  victim.deaths = (victim.deaths | 0) + 1;
  // Первая кровь матча: чей первый фраг — тому и медаль (проверка в итогах).
  try {
    if (!scene._fbDone && killer && killer !== victim) {
      scene._fbDone = true;
      if (killer === scene.player && !(scene.player && scene.player._demoPuppet)) scene._fbMine = true;
    }
  } catch (e) {}
  // Смерти человека — в персистентную статистику для K/D в меню.
  if (victim === scene.player && !victim.isAI) {
    try {
      const st = gameState.stats;
      if (st) {
        st.deaths = (st.deaths | 0) + 1;
        scene._statSaveTick = (scene._statSaveTick | 0) + 1;
        if (scene._statSaveTick % 25 === 0) saveGameState();
      }
    } catch (e) {}
  }
  // Метка смерти для задержки респауна (не мгновенно; часы цикла — см. scene._loopNow).
  try { victim.diedAt = (Number.isFinite(scene._loopNow) ? scene._loopNow : scene.time.now); } catch (e) {}
  // Нёс флаг/бомбу — падает на месте смерти.
  [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag].forEach(f => {
    if (f && f.carrier === victim) {
      f.drop();
      scene._ctfFlagLostBanner(f, victim);
    }
  });
  [scene.blueBomb, scene.redBomb].forEach(b => {
    if (b && b.carrier === victim) {
      b.drop();
      // Носильщик был наш — плохо (foe), вражеский — хорошо (ally).
      scene._playFlagSfx(victim.team === 'blue' ? 'foe' : 'ally');
    }
  });
  // Нёс овертайм-турель — падает на месте смерти.
  try { if (scene._turret && scene._turret.carrier === victim) scene._dropTurret(); } catch (e) {}
  if (victim === scene.player && scene.mode === 'CAMPAIGN') {
    // Пауза НЕ сразу: секунду видно как ХП упало в ноль и тело падает,
    // и только потом стоп-кадр. Иначе кажется, что раунд кончился просто так.
    scene.time.delayedCall(1000, () => {
      if (!victim.dead || scene.gameOver) return;
      scene.gameOver = true;
      // Поражение тоже пишется в статистику (как победа): иначе
      // losses/timeByClass за провальный уровень терялись.
      try {
        const st = gameState.stats;
        if (st) st.losses = (st.losses | 0) + 1;
      } catch (e) {}
      // Поражение кампании — тоже в историю боёв.
      recordMatch(scene, false);
      flushPlayTime(scene);
      saveGameState();
      scene._resetCamForModal();
      scene.physics.pause();
      scene.input.setDefaultCursor('default');

      const S = 360;
      const overlay = scene.add.rectangle(
        640, 360, gameW(scene), 720, 0x000000, 0.82
      ).setScrollFactor(0).setDepth(300);

      const bg = scene.add.rectangle(640, 360, S, S, 0x0d0d2a, 0.96)
        .setStrokeStyle(3, 0xff5555, 1)
        .setScrollFactor(0).setDepth(301);
      const bgInner = scene.add.rectangle(640, 360, S - 16, S - 16, 0x0d0d2a, 0)
        .setStrokeStyle(1, 0xaa4455, 0.4)
        .setScrollFactor(0).setDepth(302);

      const titleText = scene.add.text(640, 244, 'ПОРАЖЕНИЕ', {
        fontSize: '32px',
        color: '#ff5555',
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(303);

      const subText = scene.add.text(640, 320, 'Вы погибли.\nУровень провален.', {
        fontSize: '24px',
        color: '#ffaaaa',
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(303);

      const retryBtn = scene.add.text(640, 408, 'Начать заново', {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#287a45',
        padding: 14
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302);

      retryBtn.setInteractive({ useHandCursor: true });
      retryBtn.on('pointerover', () => { retryBtn.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
      retryBtn.on('pointerout', () => retryBtn.setStyle({ color: '#ffffff' }));
      retryBtn.on('pointerdown', () => {
        scene.scene.start('GameScene', {
          mode: 'CAMPAIGN',
          selectedClass: scene.selectedClass,
          levelIndex: scene.levelIndex,
          playerName: scene.playerName
        });
      });

      const menuBtn = scene.add.text(640, 488, 'Выйти в меню', {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#553333',
        padding: 12
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302);

      menuBtn.setInteractive({ useHandCursor: true });
      menuBtn.on('pointerover', () => { menuBtn.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
      menuBtn.on('pointerout', () => menuBtn.setStyle({ color: '#ffffff' }));
      menuBtn.on('pointerdown', () => scene.scene.start('MenuScene'));

      scene.victoryElems = [overlay, bg, bgInner, titleText, subText, retryBtn, menuBtn];
      scene._trackModalElems(scene.victoryElems);
    });
    return;
  }

  if (victim === scene.player && scene.mode === 'TRIAL') {
    // Та же секундная задержка перед таблом: ХП успевает в ноль.
    scene.time.delayedCall(1000, () => {
      if (!victim.dead || scene.gameOver) return;
      const secs = trialEndedTime(scene);
      const timeStr = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const newBest = setTrialRecord(scene.trialKills, secs);
      // Для истории: волна/фраги/рекорд (поражения в испытании нет —
      // там в любом случае умираешь).
      scene._trialResult = {
        wave: scene.trialWave, kills: scene.trialKills,
        time: timeStr, newBest: !!newBest
      };
      scene.endGame(
        `ИСПЫТАНИЕ — ВОЛНА ${scene.trialWave}\n` +
        `Фраги: ${scene.trialKills}\nВремя: ${timeStr}\n${newBest ? 'НОВЫЙ РЕКОРД!' : ''}`,
        false
      );
    });
    return;
  }

  if (victim === scene.player) {
    // KOTH: игрок встаёт волной — берём общий respawnDelay (в кампании
    // он короче), а не захардкоженные 10с.
    // _respawnAt — для счётчика «ДО ВОЗРОЖДЕНИЯ» (те же часы, что ревайв).
    // BOMB: адаптивная задержка (см. _bombRespawnDelay).
    // CTF: +3с (5.4с вместо 2.4с).
    const rdl = scene.mode === 'KOTH' ? (scene.respawnDelay || 10000)
      : scene.mode === 'BOMB' ? scene._bombRespawnDelay('blue')
      : scene.mode === 'CTF' ? 5400
      : 2400;
    // Запоминаем место смерти до таймера: тело может сместиться/упасть,
    // а респаун должен знать, откуда выбирать точку подальше.
    const deathX = victim.x, deathY = victim.y;
    scene._respawnAt = (Number.isFinite(scene._loopNow) ? scene._loopNow : scene.time.now) + rdl;
    scene.time.delayedCall(rdl, () => {
      // Пока тикал таймер — могли реснуть, закончить матч или встать на паузу:
      // второй ревайв живого посреди боя / ревайв за модалкой запрещены.
      if (!victim.dead || scene.gameOver) return;
      // Точка — спавн своей стороны, подальше от места смерти. Раньше
      // в командных режимах брали фиксированную базу, а в FFA — случайный
      // x: и в том, и в другом боёвка у спавна давала вставание ровно
      // там, где убили. Теперь место смерти исключено, если есть альтернатива.
      const rp = _pickPlayerRespawn(scene, victim, deathX, deathY);
      victim.revive(rp.x, rp.y);
      // Стекло: revive сбрасывает damageMult игрока — вернуть ×2.
      try { reapplyGlassOnRevive(victim, scene.mutators); } catch (e) {}
      // Камера не должна ползти к базе с места смерти: снимок сразу.
      try { scene.cameras.main.centerOn(rp.x, rp.y); } catch (e) {}
      // Якорь патруля/лиша ИИ — на новый спавн (иначе вокруг старой точки).
      try {
        if (victim.ai) {
          victim.ai.spawnX = rp.x;
          victim.ai.spawnY = rp.y;
          victim.ai.patrolTarget = null;
        }
      } catch (e) {}
    });
  }

  if (killer) {
    killer.kills = (killer.kills || 0) + 1;
    // Боты тоже копят ульту килами (лимит 5 — см. applyBotDifficulty):
    // раньше заряд капал только игроку, и боты не ультовали никогда.
    if (killer.isAI && killer !== scene.player) {
      try { killer.addUltCharge(1); } catch (e) {}
    }
    // Демо-марионетка профиль не фармит: только счёт матча.
    if (killer === scene.player && !scene.player._demoPuppet) {
      recordPlayerKill(scene, killer);
      scene.player.addUltCharge(1);
      // Песочница: фраги тикают, но монет и опыта нет.
      if (!scene.botDifficulty || scene.botDifficulty.id !== 'sandbox') {
        scene.matchCoins += 30;
        addCoins(30);
        const diffId = scene.botDifficulty?.id;
        if (diffId === 'experienced' || diffId === 'veteran' || diffId === 'novice') {
          const xp0 = killXP(scene, killer);
          // Ветеран: +10% к опыту за фраги (подпись в лобби).
          // Новичок качается вчетверо медленнее (25%), но качается.
          const xp = diffId === 'veteran' ? Math.round(xp0 * 1.1) : (diffId === 'novice' ? Math.max(1, Math.round(xp0 * 0.25)) : xp0);
          if (xp > 0) {
            addExperience(xp);
            scene.matchXP = (scene.matchXP || 0) + xp;
          }
        }
      }
      // Убийство вора: жертва-враг несла флаг/бомбу. Счётчик — всем,
      // выплата и калибровка — только себе (оборона оплачивается).
      try {
        if (victim && killer && victim !== killer && (victim.team || null) !== (killer.team || null)) {
          const carried = [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag, scene.blueBomb, scene.redBomb]
            .some(f => f && f.carrier === victim);
          if (carried) {
            killer.carrierKills = (killer.carrierKills | 0) + 1;
            if (killer === scene.player && !scene.player._demoPuppet) {
              rewardObjectiveEvent(scene, 50, 15);
              bumpObj(scene, 'thief');
            }
          }
        }
      } catch (e) {}
    }
  }

  if (scene.mode === 'TRIAL') {
    if (victim !== scene.player && victim.team === 'red' && (killer?.team === 'blue')) {
      scene.trialKills++;
      if (Math.random() < 0.85) {
        scene.spawnPickup(Math.random() < 0.5 ? 'medkit' : 'armor', victim.x, victim.y - 20);
      }
    }
    scene.trialEnemiesAlive = Math.max(0, scene.trialEnemiesAlive - (victim.team === 'red' ? 1 : 0));
  }

  if (scene.mode === 'TDM') {
    // Фраг без убийцы (окружение) — ничьё очко, а не красным из воздуха.
    if (killer) scene.scores[killer.team || 'red'] += 1;
  } else if (scene.mode === 'KOTH' && killer &&
      (killer.team === 'blue' || killer.team === 'red')) {
    // Награда за убийство в точках: +1 очко команде (по ТЗ).
    scene.scores[killer.team] += 1;
  } else if (scene.mode === 'FFA' && killer) {
    scene.scores[killer.playerName] = (scene.scores[killer.playerName] || 0) + 1;
  }

  scene.checkVictory();
}
