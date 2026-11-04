// diag_heal.mjs — ЧИСТАЯ ДИАГНОСТИКА «залипания на лечении» (src=heal).
// Ищем ботов, которые в heal почти не двигаются >3с, и печатаем: hp, позицию,
// ближайшую аптечку (координаты/дистанцию/команду/перекрытие тела), цель
// moveToward и dy до кита. Только чтения.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_heal.mjs --seed 514
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const SEED = parseInt(arg('seed', '514'), 10);
const TICKS = parseInt(arg('ticks', '18000'), 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
try { if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]); } catch (e) {}

const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { default: EnemyAI } = await import('../../js/ai/EnemyAI.js');

const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene],
});
gameState.demoMode = true;

const R = (v) => (Number.isFinite(v) ? Math.round(v) : '-');
const P = EnemyAI.prototype;
const oMV = P.moveToward;
P.moveToward = function (time, tx) {
  this.__mvT = tx;
  this.__mvAt = time;
  try {
    const st = (new Error().stack || '').split('\n');
    for (let i = 2; i < st.length; i++) {
      const m = st[i].match(/([A-Za-z0-9_]+\.js):(\d+):/);
      if (m && !/diag_heal/.test(m[1])) { this.__mvSite = m[1] + ':' + m[2]; break; }
    }
  } catch (e) {}
  return oMV.call(this, time, tx);
};
// Важно: _dbgSrc может быть УСТАРЕВШИМ (ветки, которые не ставят src,
// оставляют прошлое значение). Поэтому метим фактический вызов seekHeal.
const oSH = P._seekHeal;
P._seekHeal = function (time) {
  const r = oSH.call(this, time);
  if (r) this.__healT = time;
  return r;
};

const streaks = new Map(); // name -> {t0, x0, y0, logged}
const nomove = new Map(); // name -> {since, logged}

game.events.on('ready', () => {
  try {
    const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
  } catch (e) {}
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });
  let t = 0;
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    const sc = game.scene.getScene('GameScene');
    if (!sc || !sc.players) continue;
    for (const p of sc.players) {
      if (!p || p.dead || !p.ai) continue;
      const ai = p.ai;
      // [NOMOVE]: ИИ вообще не зовёт движение — «никто не взял управление».
      // Это и есть настоящие длинные стоянки (src при этом УСТАРЕВШИЙ).
      const _mvAgo = t - (ai.__mvAt || 0);
      const ns = (nomove.get(p.playerName) || { since: t, logged: 0 });
      if (_mvAgo < 400) { nomove.delete(p.playerName); }
      else {
        if (!nomove.has(p.playerName)) { ns.since = t; ns.logged = 0; nomove.set(p.playerName, ns); }
        const dur = t - ns.since;
        if (dur > 3000 && Math.round(dur / 3000) > ns.logged) {
          ns.logged = Math.round(dur / 3000);
          let seenN = 0, seenD = null, seenLos = null;
          try {
            const sn = ai.collectSeen() || [];
            seenN = sn.length;
            if (sn.length) {
              seenD = Math.round(sn[0].d);
              if (typeof sc.hasLineOfSight === 'function') seenLos = sc.hasLineOfSight(p.x, p.y, sn[0].t.x, sn[0].t.y - 28, true) ? 1 : 0;
            }
          } catch (eS) {}
          console.log(`[NOMOVE] t=${R(t)} ${p.playerName}(${p.team}) x=${R(p.x)} y=${R(p.y)} ft=${R(p.body && p.body.y + p.body.height)} ` +
            `hp=${R(p.hp)}/${R(p.maxHp)} src=${ai._dbgSrc} seen=${seenN}${seenD != null ? '@' + seenD : ''} los=${seenLos == null ? '-' : seenLos} ` +
            `mvAgo=${R(_mvAgo)} still=${R(dur / 1000)}s`);
        }
      }
      const st = streaks.get(p.playerName) || null;
      if (ai._dbgSrc !== 'heal') { if (st) streaks.delete(p.playerName); continue; }
      const _healFresh = (t - (ai.__healT || 0)) < 100;
      const v = Math.abs((p.body && p.body.velocity && p.body.velocity.x) || 0);
      if (!st) { streaks.set(p.playerName, { t0: t, x0: p.x, y0: p.y, logged: 0, still: 0 }); continue; }
      if (v > 12) { st.x0 = p.x; st.y0 = p.y; st.t0 = t; st.logged = 0; continue; }
      const dur = t - (st.t0 || t);
      if (dur > 3000 && st.logged < 3 && Math.round(dur / 3000) > st.logged) {
        st.logged = Math.round(dur / 3000);
        let kit = null, kd = 1e9;
        try {
          for (const pk of sc.pickups.getChildren()) {
            if (!pk || !pk.active || pk.pickupType !== 'medkit') continue;
            const d = Math.hypot(pk.x - p.x, pk.y - p.y);
            if (d < kd) { kd = d; kit = pk; }
          }
        } catch (e) {}
        let overlap = 0;
        try {
          const b = p.body, kb = kit && kit.body;
          if (b && kb && b.x < kb.x + kb.width && b.x + b.width > kb.x && b.y < kb.y + kb.height && b.y + b.height > kb.y) overlap = 1;
        } catch (e) {}
        console.log(`[HEAL] t=${R(t)} ${p.playerName}(${p.team}) x=${R(p.x)} y=${R(p.y)} ft=${R(p.body && p.body.y + p.body.height)} ` +
          `hp=${R(p.hp)}/${R(p.maxHp)} src=${ai._dbgSrc} mv=${R(ai.__mvT)} ` +
          `kit=${kit ? R(kit.x) + ',' + R(kit.y) : '-'} d=${kit ? R(kd) : '-'} kitTeam=${kit ? (kit.team || '-') : '-'} overlap=${overlap} ` +
          `healFresh=${_healFresh ? 1 : 0} mvSite=${ai.__mvSite || '-'} still=${R(dur / 1000)}s`);
      }
    }
  }
  process.exit(0);
});

setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);
