// diag_dmg.mjs вЂ” Р§РРЎРўРђРЇ Р”РРђР“РќРћРЎРўРРљРђ Р¶Р°Р»РѕР±С‹ В«Р±РѕС‚ РЅРµ СЂРµР°РіРёСЂСѓРµС‚ РЅР° СѓСЂРѕРЅ, С…РѕС‚СЏ
// СЏ РІ РїСЂСЏРјРѕР№ РІРёРґРёРјРѕСЃС‚РёВ». РќР° РєР°Р¶РґРѕРµ РїРѕРїР°РґР°РЅРёРµ РїРѕ Р±РѕС‚Сѓ СЃРјРѕС‚СЂРёРј, С‡С‚Рѕ Р±РѕС‚ РґРµР»Р°РµС‚
// РІ СЃР»РµРґСѓСЋС‰РёРµ 600РјСЃ: РІР·СЏР» Р»Рё Р°С‚Р°РєСѓСЋС‰РµРіРѕ С†РµР»СЊСЋ Рё СЃС‚СЂРµР»СЏР» Р»Рё РІ РЅРµРіРѕ.
// Р—Р°РїСѓСЃРє: node --import ./tools/headless/register.mjs ./tools/headless/diag_dmg.mjs --seed 1337
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

const TICKS = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--ticks') || '18000', 10);
const SEED = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--seed') || '1337', 10);

setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
if (Phaser.Math && Phaser.Math.RND && Phaser.Math.RND.seed) Phaser.Math.RND.seed([SEED, SEED + 1]);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { default: EnemyAI } = await import('../../js/ai/EnemyAI.js?v=194');

const S = {
  hits: 0, withLos: 0, reacted: 0, reactedLos: 0, shotBack: 0,
  noReact: [], bySrc: {},
};
const pend = new Map();   // ai -> {t, attacker, los, src, hp}

const _onShot = EnemyAI.prototype.onShot;
EnemyAI.prototype.onShot = function (attacker, time) {
  try {
    if (attacker && attacker !== this.player && this.player && !this.player.dead) {
      let los = false;
      try {
        const sc = this.scene, me = this.player;
        los = !!sc.hasLineOfSight(me.x, me.y, attacker.x, attacker.y - 28, true);
      } catch (e) {}
      S.hits++;
      if (los) S.withLos++;
      const src = this._dbgSrc || '?';
      S.bySrc[src] = (S.bySrc[src] || 0) + 1;
      pend.set(this, { t: clock.now, attacker, los, src, hp: Math.round(this.player.hp), name: this.player.playerName });
    }
  } catch (e) {}
  return _onShot.call(this, attacker, time);
};

const _ts = EnemyAI.prototype._tryShoot;
EnemyAI.prototype._tryShoot = function (time, x, y, target) {
  const r = _ts.call(this, time, x, y, target);
  try {
    if (r && target) { const p = pend.get(this); if (p && p.attacker === target) p.shot = true; }
  } catch (e) {}
  return r;
};

let t = 0;
const game = new Phaser.Game({
  type: Phaser.HEADLESS, width: 1280, height: 720, audio: { noAudio: true }, banner: false,
  dom: { createContainer: false }, fps: { forceSetTimeOut: true, target: 60 },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: [GameScene],
});
gameState.demoMode = true;
const keep = setInterval(() => {}, 1000);
setTimeout(() => { if (!game.isRunning) { try { game.texturesReady(); } catch (e) {} } }, 700);

game.events.on('ready', () => {
  try {
    const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
    game.cache.json.add('modeMap_CTF', mapData);
    const sc0 = game.scene.getScene('GameScene');
    if (sc0 && sc0.cache && sc0.cache.json) sc0.cache.json.add('modeMap_CTF', mapData);
  } catch (e) {}
  try { game.scene.stop('GameScene'); } catch (e) {}
  game.scene.start('GameScene', { mode: 'CTF', selectedClass: 'Assault', playerName: 'Headless', scoreLimit: 3, suddenStart: false });
  setImmediate(loop);
});

function loop() {
  const sc = game.scene.getScene('GameScene');
  if (!sc || !sc.players || !sc.players.length) { setImmediate(loop); return; }
  for (let i = 0; i < TICKS; i++) {
    t += 1000 / 60;
    clock.now = t;
    game.headlessStep(t, 1000 / 60);
    if (sc.gameOver) break;
    for (const [ai, p] of pend) {
      const dt = t - p.t;
      // РІР·СЏР» Р»Рё Р°С‚Р°РєСѓСЋС‰РµРіРѕ С†РµР»СЊСЋ
      let tgt = null;
      try { tgt = ai._modeTgt || ai._lastTarget || null; } catch (e) {}
      if (tgt === p.attacker && !p.reactedAt) p.reactedAt = t;
      if (dt >= 600) {
        const reacted = !!p.reactedAt;
        if (reacted) { S.reacted++; if (p.los) S.reactedLos++; }
        if (p.shot) S.shotBack++;
        if (!reacted && S.noReact.length < 12) S.noReact.push({ t: Math.round(p.t), bot: p.name, src: p.src, los: p.los, hp: p.hp, aim: Math.round(ai.player.aimX) });
        pend.delete(ai);
      }
    }
  }
  console.log('[dm] seed', SEED, 'РїРѕРїР°РґР°РЅРёР№ РїРѕ Р±РѕС‚Р°Рј:', S.hits, '| РёР· РЅРёС… СЃ LOS РґРѕ СЃС‚СЂРµР»РєР°:', S.withLos);
  console.log('[dm] РІР·СЏР»Рё СЃС‚СЂРµР»РєР° С†РµР»СЊСЋ Р·Р° 600РјСЃ:', S.reacted, '(РёР· РЅРёС… СЃ LOS:', S.reactedLos + ')',
    '| РІС‹СЃС‚СЂРµР»РёР»Рё РІ РЅРµРіРѕ:', S.shotBack);
  console.log('[dm] РїРѕ СЂРµР¶РёРјР°Рј (src РІ РјРѕРјРµРЅС‚ РїРѕРїР°РґР°РЅРёСЏ):', JSON.stringify(S.bySrc));
  for (const e of S.noReact) console.log('[dm]  РќР• РѕС‚СЂРµР°РіРёСЂРѕРІР°Р»: ' + JSON.stringify(e));
  clearInterval(keep);
  process.exit(0);
}

