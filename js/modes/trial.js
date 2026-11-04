// trial.js — режим Испытание (волны) + покупной союзник (было в GameScene).
// Функции принимают сцену; классы импортируем напрямую из entities.
import Assault from '../entities/Assault.js';
import Tank from '../entities/Tank.js';
import Medic from '../entities/Medic.js';
import Sniper from '../entities/Sniper.js';
import EnemyAI from '../ai/EnemyAI.js';
import { gameState } from '../data/gameState.js';

const classMap = { Assault, Tank, Medic, Sniper };

export function trialWaveSize(wave) {
  return Math.min(3 + (wave - 1) * 2, 14);
}

export function trialWaveHpMult(wave) {
  return 1 + (wave - 1) * 0.18;
}

export function trialWaveDmgMult(wave) {
  return Math.min(1 + (wave - 1) * 0.08, 1.8);
}

export function trialTypesForWave(wave) {
  const pool = ['Assault', 'Assault', 'Medic'];
  if (wave >= 2) pool.push('Tank');
  if (wave >= 3) pool.push('Sniper');
  if (wave >= 5) pool.push('Tank', 'Sniper');
  return pool;
}

export function spawnTrialEnemy(scene) {
  const wave = scene.trialWave;
  const types = trialTypesForWave(wave);
  const type = types[Math.floor(Math.random() * types.length)];
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
  const enemy = new EnemyClass(scene, x, y, {
    name: scene._botName(),
    team: 'red',
    isAI: true
  });
  enemy.setTexture('enemy');
  enemy.setTint(0xff5555);
  enemy.maxHp = Math.round(enemy.maxHp * trialWaveHpMult(wave) * (strong ? 1.3 : 1));
  enemy.hp = enemy.maxHp;

  enemy.spawn = { x, y };
  enemy.damageMult = (enemy.damageMult || 1) * trialWaveDmgMult(wave) * (type === 'Sniper' ? 1.4 : 1);
  enemy.effectMult = trialWaveDmgMult(wave);

  scene.players.push(enemy);
  scene._bindFighter(enemy);
  scene.physics.add.collider(enemy, scene.platforms);
  scene.physics.add.collider(enemy, scene.covers);
  enemy.ai = new EnemyAI(enemy, scene);
  enemy.ai.leashDist = 1400;
  // Без applyBotDifficulty: волны уже масштабируют HP/урон сами,
  // иначе ветеран множит поверх волн. Поведение ИИ (реакция/точность)
  // от сложности работает через botDifficulty всё равно.
  scene._paintName(enemy);
  scene.trialEnemiesAlive++;
  return enemy;
}

export function updateTrial(scene, time) {
  const p = scene.player;
  if (p.dead) return;

  if (scene.trialWave === 0) {
    // Первая волна: сбрасываем флаг, иначе в том же кадре срабатывает ветка
    // ниже (trialNeedWave=true с инициализации, trialInterWave=2500 уже
    // прошло) и стартуют сразу ДВЕ волны с двумя баннерами.
    scene.trialNeedWave = false;
    startTrialWave(scene, time);
  } else if (scene.trialEnemiesAlive <= 0 && scene.trialSpawnQueue.length === 0 && !scene.trialNeedWave) {
    scene.trialNeedWave = true;
    scene.trialInterWave = time + 2500;
  }

  if (scene.trialNeedWave && time >= scene.trialInterWave) {
    scene.trialNeedWave = false;
    startTrialWave(scene, time);
  }

  while (scene.trialSpawnQueue.length && scene.trialSpawnQueue[0] <= time) {
    scene.trialSpawnQueue.shift();
    spawnTrialEnemy(scene);
  }

  if (scene.trialHud) {
    const secs = Math.floor((time - scene.trialStart) / 1000);
    const mm = Math.floor(secs / 60);
    const ss = String(secs % 60).padStart(2, '0');
    scene.trialHud.setText(`ВОЛНА ${scene.trialWave}\nФраги: ${scene.trialKills}   Время: ${mm}:${ss}`);
  }
  if (scene.trialBestHud) {
    scene.trialBestHud.setText(
      `Рекорд  |  Фраги: ${gameState.trialBestKills}\nВремя: ${Math.floor(gameState.trialBestTime / 60)}:${String(gameState.trialBestTime % 60).padStart(2, '0')}`
    );
  }
}

export function startTrialWave(scene, time) {
  scene.trialWave++;
  const n = trialWaveSize(scene.trialWave);
  const delay = 320;
  for (let i = 0; i < n; i++) {
    scene.trialSpawnQueue.push(time + i * delay);
  }
  const waveText = scene.add.text(scene.player.x, scene.player.y - 170, `ВОЛНА ${scene.trialWave}`, {
    fontSize: '34px',
    color: '#ffdd77',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(60);
  scene.tweens.add({
    targets: waveText,
    alpha: 0,
    y: scene.player.y - 230,
    duration: 1400,
    onComplete: () => waveText.destroy()
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
  // Покупной союзник — та же сложность, что у врагов.
  scene.applyBotDifficulty(ally);
  scene._paintName(ally);
  scene.trialAllies++;
}
