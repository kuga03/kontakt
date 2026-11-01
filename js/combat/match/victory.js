import { gameState, addCoins, addExperience, advanceCampaignLevel, getPass, unlockWeapon, hasWeapon } from '../../data/gameState.js?v=171';
import { campaignLevels } from '../../data/levels.js?v=171';

import { gameW } from '../../ui/layout.js?v=3';

import { flushPlayTime } from './activity.js';
import { recordMatch } from './endGame.js';
export function checkVictory(scene) {
  if (scene.gameOver) return;

  if (scene.mode === 'CAMPAIGN') {
    const enemiesAlive = scene.players.filter(
      p => p !== scene.player && !p.dead && p.team === 'red'
    ).length;
    if (enemiesAlive === 0) {
      completeCampaignLevel(scene);
      return;
    }
    // Кампания: демо-режим или простой 180с — победа красной команды.
    if (gameState.demoMode || (scene._idleSecs || 0) >= 180) {
      scene.endGame('Красная команда победила', false);
    }
    return;
  }

  if (scene.campaignMission) {
    // Кампания (миссия режима): демо или простой — победа красной команды.
    if (gameState.demoMode || (scene._idleSecs || 0) >= 180) {
      scene.endGame('Красная команда победила', false);
      return;
    }
  }

  if (scene.mode === 'TDM') {
    // Овертайм: первый кил решает (счёт уже не равен — килл только что был).
    if (scene._tdmOvertime && scene.scores.blue !== scene.scores.red) {
      console.info('[TDM] end by overtime first kill scores=' + JSON.stringify(scene.scores) + ' limit=' + scene.scoreLimit);
      scene.endGame(
        scene.scores.blue > scene.scores.red ? 'Синие победили' : 'Красные победили',
        scene.scores.blue > scene.scores.red
      );
      return;
    }
    if (scene.scores.blue >= scene.scoreLimit || scene.scores.red >= scene.scoreLimit) {
      console.info('[TDM] end by score limit scores=' + JSON.stringify(scene.scores) + ' limit=' + scene.scoreLimit);
      scene.endGame(
        scene.scores.blue >= scene.scoreLimit ? 'Синие победили' : 'Красные победили',
        scene.scores.blue >= scene.scoreLimit
      );
      return;
    }
  }

  if (scene.mode === 'CTF') {
    // Захват флага: победа за N доставок (лимит из лобби, обычно 3).
    if (scene.scores.blue >= scene.scoreLimit || scene.scores.red >= scene.scoreLimit) {
      scene.endGame(
        scene.scores.blue >= scene.scoreLimit ? 'Синие победили' : 'Красные победили',
        scene.scores.blue >= scene.scoreLimit
      );
    }
    return;
  }

  // BOMB: победа за N установок любой командой (лимит 1/3/5 из лобби).
  if (scene.mode === 'BOMB') {
    if ((scene.scores.blue || 0) >= scene.scoreLimit) {
      scene.endGame('Синие победили', true);
    } else if ((scene.scores.red || 0) >= scene.scoreLimit) {
      scene.endGame('Красные победили', false);
    }
    return;
  }

  // KOTH: победа за N очков удержания точек.
  if (scene.mode === 'KOTH') {
    if (scene.scores.blue >= scene.scoreLimit || scene.scores.red >= scene.scoreLimit) {
      scene.endGame(
        scene.scores.blue >= scene.scoreLimit ? 'Синие победили' : 'Красные победили',
        scene.scores.blue >= scene.scoreLimit
      );
    }
    return;
  }

  if (!scene._bordersDrawn) {
    scene._bordersDrawn = true;
    const bD = 93;
    // Рамки-края — тоже HUD: регистрируем, иначе зум уносит их с краёв.
    // Адаптив: верх/низ на всю ширину, бока — по якорям к кромкам.
    const _bw = gameW(scene);
    scene.addHudElement(scene.add.rectangle(640, 1, _bw, 2, 0x000000).setScrollFactor(0).setDepth(bD), 640, 1);
    scene.addHudElement(scene.add.rectangle(640, 719, _bw, 2, 0x000000).setScrollFactor(0).setDepth(bD), 640, 719);
    scene.addHudElement(scene.add.rectangle(1, 360, 2, 720, 0x000000).setScrollFactor(0).setDepth(bD), 1, 360, true, 'L');
    scene.addHudElement(scene.add.rectangle(1279, 360, 2, 720, 0x000000).setScrollFactor(0).setDepth(bD), 1279, 360, true, 'R');
  }

  if (scene.mode === 'FFA') {
    const winner = Object.entries(scene.scores).find(([, s]) => s >= scene.scoreLimit);
    if (winner) {
      scene.endGame(`${winner[0]} победил`, winner[0] === scene.player.playerName);
    }
  }
}

export function completeCampaignLevel(scene) {
  scene.gameOver = true;
  try {
    const st = gameState.stats;
    if (st) {
      st.campaignWins = (st.campaignWins | 0) + 1;
      st.wins = (st.wins | 0) + 1;
      const ps = getPass();
      ps.wins = (ps.wins | 0) + 1;
    }
  } catch (e) {}
  recordMatch(scene, true);
  flushPlayTime(scene);
  scene._resetCamForModal();
  scene.physics.pause();

  const cl = scene.campaignLevel;
  // Кастом без reward (старые ручные сейвы) — нули вместо краша.
  addCoins((cl.reward && cl.reward.coins) || 0);
  addExperience((cl.reward && cl.reward.experience) || 0);
  // LAR — награда за 1 уровень кампании (тихо, без строк).
  // Повторы не дублируют: у кого уже есть — мимо.
  try {
    if (!cl.custom && cl.id === 1 && !hasWeapon('LAR')) {
      unlockWeapon('LAR');
    }
  } catch (e) {}
  // Свои уровни кампанию не двигают: после встроенной кампании
  // (20 миссий) финала в «Мои уровни» нет, они живут отдельно.
  if (!cl.custom) advanceCampaignLevel();

  scene.showStory(
    cl.storyOutro || `Ты прошёл «${cl.name}»!\nЭто твой собственный уровень.`,
    () => {
      scene.input.setDefaultCursor('default');

      // Финал встроенной кампании — по встроенным (свои уровни идут
      // отдельно через «Мои уровни» и сюда не ведут).
      const isLast = scene.levelIndex >= campaignLevels.length - 1;
      const coinAmt = cl.reward.coins;
      const xpAmt = cl.reward.experience;
      const S = 360;

      const overlay = scene.add.rectangle(
        640, 360, gameW(scene), 720, 0x000000, 0.82
      ).setScrollFactor(0).setDepth(300);

      const bg = scene.add.rectangle(640, 360, S, S, 0x0d0d2a, 0.96)
        .setStrokeStyle(3, 0xffd700, 1)
        .setScrollFactor(0).setDepth(301);
      const bgInner = scene.add.rectangle(640, 360, S - 16, S - 16, 0x0d0d2a, 0)
        .setStrokeStyle(1, 0x4466aa, 0.4)
        .setScrollFactor(0).setDepth(302);

      const titleText = scene.add.text(640, 244, isLast ? 'КАМПАНИЯ ПРОЙДЕНА!' : 'ПОБЕДА!', {
        fontSize: '32px',
        color: '#ffff55',
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(303);
      // Длинный заголовок ужимаем в блок (макс. 320).
      let _cfs = 32;
      while (titleText.displayWidth > 320 && _cfs > 18) {
        _cfs -= 2;
        titleText.setFontSize(_cfs);
      }

      const coinText = scene.add.text(640, 320, '', {
        fontSize: '26px',
        color: '#ffee88'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(303);

      const xpText = scene.add.text(640, 360, '', {
        fontSize: '26px',
        color: '#88ccff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(303);

      const coinCounter = { v: 0 };
      const xpCounter = { v: 0 };

      scene.tweens.add({
        targets: coinCounter,
        v: coinAmt,
        duration: 1800,
        ease: 'Cubic.Out',
        onUpdate: () => {
          coinText.setText(`+${Math.round(coinCounter.v)} монет`);
        }
      });

      scene.tweens.add({
        targets: xpCounter,
        v: xpAmt,
        duration: 1800,
        ease: 'Cubic.Out',
        delay: 400,
        onUpdate: () => {
          xpText.setText(`+${Math.round(xpCounter.v)} опыта`);
        }
      });

      const nextLabel = isLast ? 'В меню' : 'Следующий уровень';
      const nextBtn = scene.add.text(640, 408, nextLabel, {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#287a45',
        padding: 14
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302);

      nextBtn.setInteractive({ useHandCursor: true });
      nextBtn.on('pointerover', () => { nextBtn.setStyle({ color: '#ffff55' }); scene._hoverSfx(); });
      nextBtn.on('pointerout', () => nextBtn.setStyle({ color: '#ffffff' }));
      nextBtn.on('pointerdown', () => {
        if (isLast) {
          scene.scene.start('MenuScene');
        } else {
          scene.scene.start('GameScene', {
            mode: 'CAMPAIGN',
            selectedClass: scene.selectedClass,
            levelIndex: scene.levelIndex + 1
          });
        }
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

      scene.victoryElems = [overlay, bg, bgInner, titleText, coinText, xpText, nextBtn, menuBtn];
      scene._trackModalElems(scene.victoryElems);
    },
    'ДАЛЕЕ'
  );
}

// Рисование медалей — в ui/medalsView.js (общее с полкой профиля).
