// trial.js — режим Выживание (волны, рукопашные волны, боссы каждые 5 волн, полоса здоровья босса, перки и эвакуация)
import Assault from '../entities/Assault.js';
import Tank from '../entities/Tank.js';
import Medic from '../entities/Medic.js';
import Sniper from '../entities/Sniper.js';
import EnemyAI from '../ai/EnemyAI.js';
import { gameState, addCoins } from '../data/gameState.js';
import { addWeapon } from '../entities/player/guns.js';
import { gameW } from '../ui/layout.js';

const classMap = { Assault, Tank, Medic, Sniper };

export function isBossWave(wave) {
  return wave > 0 && wave % 5 === 0;
}

export function isMeleeWave(wave) {
  // Рукопашная скоростная волна: 3-я, 8-я, 13-я, 18-я (за 2 волны до босса)
  return wave > 0 && wave % 5 === 3;
}

export function trialWaveSize(wave) {
  if (isBossWave(wave)) return Math.min(2 + Math.floor(wave / 5), 6);
  if (isMeleeWave(wave)) return Math.min(5 + (wave - 1) * 2, 16);
  return Math.min(3 + (wave - 1) * 2, 14);
}

export function trialWaveHpMult(wave) {
  return 1 + (wave - 1) * 0.18;
}

export function trialWaveDmgMult(wave) {
  return Math.min(1 + (wave - 1) * 0.08, 1.8);
}

export function trialTypesForWave(wave) {
  if (isMeleeWave(wave)) {
    return ['Assault', 'Assault', 'Tank'];
  }
  const pool = ['Assault', 'Assault', 'Medic'];
  if (wave >= 2) pool.push('Tank');
  if (wave >= 3) pool.push('Sniper');
  if (wave >= 5) pool.push('Tank', 'Sniper');
  return pool;
}

export function spawnTrialEnemy(scene, isBoss = false) {
  const wave = scene.trialWave;
  const meleeOnly = isMeleeWave(wave) && !isBoss;
  const types = trialTypesForWave(wave);
  const type = isBoss ? 'Tank' : types[Math.floor(Math.random() * types.length)];
  const EnemyClass = classMap[type] || Assault;

  const p = scene.player;
  const side = (p.x > scene.mapWidth / 2) ? 0 : 1;
  const edgeX = side === 0 ? 60 : scene.mapWidth - 60;
  const groundY = scene.mapHeight - 80;
  let x = edgeX + (Math.random() - 0.5) * 60;
  let y = groundY;

  const inSolid = (tx, ty) => {
    const hit = group => {
      if (!group) return false;
      for (const o of group.getChildren()) {
        const b = o.body;
        if (!b || !b.enable) continue;
        const r = 16;
        const hw = b.width / 2, hh = b.height / 2;
        if (
          Math.abs(tx - (b.x + hw)) < hw + r &&
          Math.abs(ty - (b.y + hh)) < hh + r
        ) {
          return true;
        }
      }
      return false;
    };
    return hit(scene.covers) || hit(scene.platforms);
  };

  let guard = 0;
  while (inSolid(x, y) && guard < 8) {
    guard++;
    y -= 18;
    if (y < 360) {
      y = groundY;
      x += side === 0 ? 90 : -90;
    }
  }

  const strong = type === 'Tank' || type === 'Sniper';
  let botName = scene._botName();
  if (isBoss) {
    botName = `ДЖАГГЕРНАУТ [ВОЛНА ${wave}]`;
  } else if (meleeOnly) {
    botName = `БЕРСЕРК [ВОЛНА ${wave}]`;
  }

  const enemy = new EnemyClass(scene, x, y, {
    name: botName,
    team: 'red',
    isAI: true
  });
  enemy.setTexture('enemy');

  if (isBoss) {
    enemy.setTint(0xff2222);
    enemy.setScale(1.35);
    enemy._isBoss = true;
    enemy.maxHp = Math.round(enemy.maxHp * trialWaveHpMult(wave) * 4.5);
    enemy.hp = enemy.maxHp;
    enemy.damageMult = (enemy.damageMult || 1) * 1.3;
    try {
      enemy.inventory = [];
      addWeapon(enemy, 'minigun');
    } catch (e) {}
    scene._activeBoss = enemy;
    createBossHealthBar(scene, enemy);
  } else if (meleeOnly) {
    enemy.setTint(0xff8800);
    // Скоростной рукопашник: быстрее бегает, холодное оружие в руках
    enemy.speed = (enemy.speed || 240) * 1.35;
    enemy.maxHp = Math.round(enemy.maxHp * trialWaveHpMult(wave) * 0.9);
    enemy.hp = enemy.maxHp;
    try {
      enemy.inventory = [];
      const meleeW = Math.random() < 0.4 ? 'катана' : (Math.random() < 0.5 ? 'топор' : 'Knife');
      addWeapon(enemy, meleeW);
    } catch (e) {}
  } else {
    enemy.setTint(0xff5555);
    enemy.maxHp = Math.round(enemy.maxHp * trialWaveHpMult(wave) * (strong ? 1.3 : 1));
    enemy.hp = enemy.maxHp;
    enemy.damageMult = (enemy.damageMult || 1) * trialWaveDmgMult(wave) * (type === 'Sniper' ? 1.4 : 1);
  }

  enemy.spawn = { x, y };
  enemy.effectMult = trialWaveDmgMult(wave);

  scene.players.push(enemy);
  scene._bindFighter(enemy);
  scene.physics.add.collider(enemy, scene.platforms);
  scene.physics.add.collider(enemy, scene.covers);
  enemy.ai = new EnemyAI(enemy, scene);
  enemy.ai.leashDist = meleeOnly ? 2500 : 1600;
  scene._paintName(enemy);
  scene.trialEnemiesAlive++;
  return enemy;
}

function createBossHealthBar(scene, boss) {
  destroyBossHealthBar(scene);
  const cx = 640;
  const barY = 95;
  const W = 360, H = 16;

  const bg = scene.add.rectangle(cx, barY, W + 4, H + 4, 0x000000, 0.8)
    .setScrollFactor(0).setDepth(150).setStrokeStyle(2, 0xff3333, 1);
  const fill = scene.add.rectangle(cx - W / 2, barY, W, H, 0xff2222, 1)
    .setOrigin(0, 0.5).setScrollFactor(0).setDepth(151);
  const title = scene.add.text(cx, barY - 14, `БОСС: ДЖАГГЕРНАУТ`, {
    fontSize: '13px', color: '#ffaaaa', fontStyle: 'bold'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(152);

  scene._bossBarElems = { bg, fill, title, maxW: W };
}

function updateBossHealthBar(scene) {
  if (!scene._bossBarElems) return;
  const boss = scene._activeBoss;
  if (!boss || boss.dead || boss.hp <= 0) {
    destroyBossHealthBar(scene);
    return;
  }
  const pct = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  scene._bossBarElems.fill.width = Math.round(scene._bossBarElems.maxW * pct);
}

function destroyBossHealthBar(scene) {
  if (scene._bossBarElems) {
    try {
      scene._bossBarElems.bg.destroy();
      scene._bossBarElems.fill.destroy();
      scene._bossBarElems.title.destroy();
    } catch (e) {}
    scene._bossBarElems = null;
  }
}

export function updateTrial(scene, time) {
  const p = scene.player;
  if (p.dead) {
    destroyBossHealthBar(scene);
    return;
  }

  if (scene._choosingPerk) return;

  updateBossHealthBar(scene);

  if (scene.trialWave === 0) {
    scene.trialNeedWave = false;
    startTrialWave(scene, time);
  } else if (scene.trialEnemiesAlive <= 0 && scene.trialSpawnQueue.length === 0 && !scene.trialNeedWave) {
    scene.trialNeedWave = true;
    scene.trialInterWave = time + 2500;
    // Если волна босса только что пройдена — открываем выбор перков и опцию эвакуации
    if (scene.trialWave > 0 && isBossWave(scene.trialWave) && !scene._wavePerkOffered) {
      scene._wavePerkOffered = true;
      destroyBossHealthBar(scene);
      openPerkSelection(scene);
      return;
    }
  }

  if (scene.trialNeedWave && time >= scene.trialInterWave) {
    scene.trialNeedWave = false;
    scene._wavePerkOffered = false;
    startTrialWave(scene, time);
  }

  while (scene.trialSpawnQueue.length && scene.trialSpawnQueue[0] <= time) {
    scene.trialSpawnQueue.shift();
    const isBoss = scene._bossPending;
    scene._bossPending = false;
    spawnTrialEnemy(scene, isBoss);
  }

  if (scene.trialHud) {
    const secs = Math.floor((time - scene.trialStart) / 1000);
    const mm = Math.floor(secs / 60);
    const ss = String(secs % 60).padStart(2, '0');
    const bossW = isBossWave(scene.trialWave);
    const meleeW = isMeleeWave(scene.trialWave);

    let waveLabel = `ВОЛНА ${scene.trialWave}`;
    if (bossW) waveLabel = `ВОЛНА ${scene.trialWave} (БОСС)`;
    else if (meleeW) waveLabel = `ВОЛНА ${scene.trialWave} (НАБЕГ)`;

    scene.trialHud.setText(`${waveLabel}\nФраги: ${scene.trialKills}   Время: ${mm}:${ss}`);
    if (bossW) scene.trialHud.setColor('#ff4444');
    else if (meleeW) scene.trialHud.setColor('#ff9933');
    else scene.trialHud.setColor('#ffe08a');
  }

  if (scene.trialBestHud) {
    scene.trialBestHud.setText(
      `Рекорд  |  Фраги: ${gameState.trialBestKills}\nВремя: ${Math.floor(gameState.trialBestTime / 60)}:${String(gameState.trialBestTime % 60).padStart(2, '0')}`
    );
  }
}

export function startTrialWave(scene, time) {
  scene.trialWave++;
  const bossW = isBossWave(scene.trialWave);
  const meleeW = isMeleeWave(scene.trialWave);
  const n = trialWaveSize(scene.trialWave);
  const delay = meleeW ? 240 : 350;

  if (bossW) {
    scene._bossPending = true;
    scene.trialSpawnQueue.push(time + 200);
    for (let i = 1; i < n; i++) {
      scene.trialSpawnQueue.push(time + 200 + i * delay);
    }
  } else {
    for (let i = 0; i < n; i++) {
      scene.trialSpawnQueue.push(time + i * delay);
    }
  }

  let title = `ВОЛНА ${scene.trialWave}`;
  let color = '#ffdd77';
  if (bossW) {
    title = `БОСС: ВОЛНА ${scene.trialWave}!`;
    color = '#ff3333';
  } else if (meleeW) {
    title = `НАБЕГ БЕРСЕРКОВ!`;
    color = '#ff9933';
  }

  const waveText = scene.add.text(scene.player.x, scene.player.y - 170, title, {
    fontSize: bossW ? '38px' : '34px',
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(60);

  scene.tweens.add({
    targets: waveText,
    alpha: 0,
    y: scene.player.y - 230,
    duration: 1600,
    onComplete: () => waveText.destroy()
  });
}

// Пул перков выживания
const PERKS_POOL = [
  {
    id: 'vampirism',
    title: 'ВАМПИРИЗМ',
    desc: '+20 HP за каждое убийство',
    color: '#ff4444',
    apply: (scene) => {
      scene._survivalPerks = scene._survivalPerks || {};
      scene._survivalPerks.vampirism = true;
    }
  },
  {
    id: 'berserk',
    title: 'БЕРСЕРК',
    desc: '+25% к урону оружия',
    color: '#ff8822',
    apply: (scene) => {
      if (scene.player) scene.player.damageMult = (scene.player.damageMult || 1) * 1.25;
    }
  },
  {
    id: 'speed',
    title: 'СПРИНТЕР',
    desc: '+25% к скорости передвижения',
    color: '#33ddff',
    apply: (scene) => {
      if (scene.player) scene.player.speed = (scene.player.speed || 250) * 1.25;
    }
  },
  {
    id: 'armor_plate',
    title: 'ТИХАЯ БРОНЯ',
    desc: '+50 к максимальной броне и полное восстановление',
    color: '#88aaff',
    apply: (scene) => {
      if (scene.player) {
        scene.player.maxArmor = (scene.player.maxArmor || 100) + 50;
        scene.player.armor = scene.player.maxArmor;
      }
    }
  },
  {
    id: 'rapid_fire',
    title: 'БЫСТРЫЕ РУКИ',
    desc: 'Перезарядка на 35% быстрее',
    color: '#ffee44',
    apply: (scene) => {
      if (scene.player) {
        scene.player.reloadMult = (scene.player.reloadMult || 1) * 0.65;
        (scene.player.inventory || []).forEach(w => { if (w) w.reloadMult = scene.player.reloadMult; });
      }
    }
  },
  {
    id: 'regen',
    title: 'НАНО-РЕГЕНЕРАЦИЯ',
    desc: '+6 HP в секунду постоянно',
    color: '#44ff77',
    apply: (scene) => {
      if (scene.player) scene.player.passiveRegen = (scene.player.passiveRegen || 0) + 6;
    }
  }
];

export function openPerkSelection(scene) {
  scene._choosingPerk = true;
  scene.physics.pause();

  const cx = 640;
  const cy = 360;
  const elems = [];

  const overlay = scene.add.rectangle(cx, cy, gameW(scene), 720, 0x000000, 0.82)
    .setScrollFactor(0).setDepth(350).setInteractive();
  elems.push(overlay);

  const header = scene.add.text(cx, 110, 'БОСС ПОВЕРЖЕН!', {
    fontSize: '28px', color: '#ffdd44', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5
  }).setOrigin(0.5).setScrollFactor(0).setDepth(351);
  elems.push(header);

  const sub = scene.add.text(cx, 145, 'Выберите постоянное усиление или эвакуируйтесь с повышенной наградой:', {
    fontSize: '15px', color: '#ccd6ee'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(351);
  elems.push(sub);

  // Перемешиваем и выбираем 3 перка
  const shuffled = [...PERKS_POOL].sort(() => 0.5 - Math.random());
  const choices = shuffled.slice(0, 3);

  const cardW = 270, cardH = 240;
  const startX = cx - ((choices.length - 1) * (cardW + 24)) / 2;

  choices.forEach((perk, i) => {
    const px = startX + i * (cardW + 24);
    const py = 310;

    const bg = scene.add.rectangle(px, py, cardW, cardH, 0x161c36, 0.95)
      .setStrokeStyle(3, 0x3d4b7a, 1).setScrollFactor(0).setDepth(352)
      .setInteractive({ useHandCursor: true });

    const pTitle = scene.add.text(px, py - 70, perk.title, {
      fontSize: '19px', color: perk.color, fontStyle: 'bold', align: 'center', wordWrap: { width: cardW - 20 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(353);

    const pDesc = scene.add.text(px, py - 10, perk.desc, {
      fontSize: '14px', color: '#ffffff', align: 'center', wordWrap: { width: cardW - 30 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(353);

    const pBtn = scene.add.text(px, py + 70, 'ВЫБРАТЬ', {
      fontSize: '15px', color: '#000000', backgroundColor: perk.color,
      padding: { left: 22, right: 22, top: 7, bottom: 7 }, fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(353);

    elems.push(bg, pTitle, pDesc, pBtn);

    const onSelect = () => {
      perk.apply(scene);
      elems.forEach(el => el.destroy());
      scene._choosingPerk = false;
      scene.physics.resume();
      scene.trialNeedWave = true;
      scene.trialInterWave = (scene.time ? scene.time.now : 0) + 1500;
    };

    bg.on('pointerdown', onSelect);
    pBtn.setInteractive({ useHandCursor: true }).on('pointerdown', onSelect);

    bg.on('pointerover', () => {
      bg.setStrokeStyle(3, 0xffff55, 1);
      bg.fillColor = 0x242d55;
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(3, 0x3d4b7a, 1);
      bg.fillColor = 0x161c36;
    });
  });

  // Кнопка Эвакуации: забрать куш с множителем x1.5 монет
  const evacEarned = Math.round((scene.matchCoins || (scene.trialKills * 30)) * 1.5) + (scene.trialWave * 200);
  const evacBtn = scene.add.text(cx, 500, `🚁 ЭВАКУИРОВАТЬСЯ (+${evacEarned} монет и победа)`, {
    fontSize: '17px', color: '#ffffff', backgroundColor: '#2a6a3a',
    padding: { left: 28, right: 28, top: 12, bottom: 12 }, fontStyle: 'bold'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(353).setInteractive({ useHandCursor: true });
  elems.push(evacBtn);

  evacBtn.on('pointerover', () => evacBtn.setStyle({ color: '#aaffaa', backgroundColor: '#338848' }));
  evacBtn.on('pointerout', () => evacBtn.setStyle({ color: '#ffffff', backgroundColor: '#2a6a3a' }));
  evacBtn.on('pointerdown', () => {
    addCoins(evacEarned);
    elems.forEach(el => el.destroy());
    scene._choosingPerk = false;
    scene.physics.resume();
    const secs = trialEndedTime(scene);
    const timeStr = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    scene.endGame(
      `УСПЕШНАЯ ЭВАКУАЦИЯ!\n` +
      `Пройдено волн: ${scene.trialWave}\nФраги: ${scene.trialKills}   Время: ${timeStr}\nБонус за эвакуацию: +${evacEarned} монет`,
      true
    );
  });
}

export function trialEndedTime(scene) {
  return Math.floor(((Number.isFinite(scene._loopNow) ? scene._loopNow : scene.time.now) - scene.trialStart) / 1000);
}

export function buyTrialAlly(scene) {
  const cost = 300;
  if (gameState.coins < cost) {
    const toast = scene.add.text(640, 560, 'Недостаточно монет (300)!', {
      fontSize: '20px', color: '#ff7777'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(305);
    scene.time.delayedCall(1500, () => toast.destroy());
    return;
  }
  if (scene.trialAllies >= 3) {
    const warn = scene.add.text(640, 560, 'Максимум 3 сокомандника', {
      fontSize: '20px', color: '#ffcc77'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(305);
    scene.time.delayedCall(2000, () => { if (warn && warn.active) warn.destroy(); });
    return;
  }
  gameState.coins -= cost;
  try {
    if (scene.cache.audio.exists('sfx_buy') && !scene.sound.locked) {
      scene.sound.play('sfx_buy', { volume: 0.4 });
    }
  } catch (e) { /* noop */ }
  const side = scene.player.aimX >= scene.player.x ? 1 : -1;
  let ax = scene.player.x + side * 80, ay = scene.player.y - 20;
  try {
    if (scene._inSolid && scene._inSolid(ax, ay, 30)) ay = scene._groundSpawnY(ax);
    const esc = scene._escapeSolid ? scene._escapeSolid(ax, ay, 30) : { x: ax, y: ay };
    ax = esc.x; ay = esc.y;
  } catch (e) {}
  const ally = new Assault(scene, ax, ay, {
    name: scene._botName(),
    team: 'blue',
    isAI: true
  });
  ally.setTexture('enemy');
  ally.setTint(0x44ccff);
  ally.maxHp = 25 * 100;
  ally.hp = ally.maxHp;
  ally.spawn = { x: ally.x, y: ally.y };
  scene.players.push(ally);
  scene._bindFighter(ally);
  scene.physics.add.collider(ally, scene.platforms);
  scene.physics.add.collider(ally, scene.covers);
  ally.ai = new EnemyAI(ally, scene);
  ally.ai.leashDist = 1400;
  scene._paintName(ally);
  scene.trialAllies++;
}
