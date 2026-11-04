// reachmap.mjs — КАРТА ПРОХОДИМОСТИ: прогоняет физикой переходы между всеми
// поверхностями карты и печатает только РЕАЛЬНО работающие рёбра.
// Ничего в игре не меняет. ИИ ботов выключен (быстро, без боя).
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/reachmap.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js';

setupDom(1337);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');
const { default: Player } = await import('../../js/entities/Player.js');

let t = 0;
function step(n = 1) { for (let i = 0; i < n; i++) { t += 1000 / 60; clock.now = t; game.headlessStep(t, 1000 / 60); } }

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
  step(20);
  const sc = game.scene.getScene('GameScene');
  for (const q of sc.players) { try { q.ai = null; } catch (e) {} }

  // Все поверхности (верх): из карты + земля.
  const surf = [];
  const mapData = JSON.parse(readFileSync('maps/ctf.json', 'utf8'));
  for (const o of mapData.objects) {
    if (o.type !== 'platform' && o.type !== 'cover' && o.type !== 'ground') continue;
    surf.push({ L: o.x - o.w / 2, R: o.x + o.w / 2, T: o.y - o.h / 2, kind: o.type });
  }
  // Уникализируем по (T, L, R) и сортируем сверху вниз.
  const uniq = [];
  for (const s of surf) {
    if (!uniq.some(u => Math.abs(u.T - s.T) < 1 && Math.abs(u.L - s.L) < 1 && Math.abs(u.R - s.R) < 1)) uniq.push(s);
  }
  uniq.sort((a, b) => a.T - b.T);
  console.log('[rm] поверхностей:', uniq.length);

  const tryJump = (sx, topA, vx) => {
    const p = new Player(sc, sx, topA - 82, { name: 'X', team: 'blue', isAI: false });
    try { sc.physics.add.collider(p, sc.platforms); } catch (e) {}
    try { sc.physics.add.collider(p, sc.covers); } catch (e) {}
    p.body.setVelocity(0, 0);
    for (let k = 0; k < 50; k++) { step(1); if (p.body.blocked.down || p.body.touching.down) break; }
    const feet0 = Math.round(p.body.y + p.body.height);
    if (Math.abs(feet0 - Math.round(topA)) > 2) { p.destroy(); return null; }
    p.body.setVelocity(vx, -470);
    let used2 = false, res = null;
    for (let k = 0; k < 220; k++) {
      step(1);
      const b = p.body;
      if (!used2 && b.velocity.y >= 0) { used2 = true; b.setVelocity(vx, -420); }
      if (b.blocked.down || b.touching.down) { res = { feet: Math.round(b.y + b.height), x: Math.round(p.x) }; break; }
    }
    p.destroy();
    return res;
  };

  const edges = [];
  const MAXDY = 230, MAXGAP = 200;
  for (const A of uniq) {
    for (const B of uniq) {
      if (A === B) continue;
      const dy = B.T - A.T;                       // <0 — вверх
      if (Math.abs(dy) > MAXDY) continue;
      const gap = Math.max(0, Math.max(A.L, B.L) - Math.min(A.R, B.R));
      const overlap = Math.min(A.R, B.R) - Math.max(A.L, B.L);
      if (overlap <= 0 && gap > MAXGAP) continue;
      const toRight = B.L >= A.L;
      // k491: пробуем НЕСКОЛЬКО точек отрыва. Одна точка у кромки часто
      // попадает под нависающую плиту и даёт ложный «нельзя»: проверено
      // отладкой (base 730 → 620 ledge: с x=610 прыжок садится на 620,
      // а с x=630 тело задевает кромку). Берём 3 позиции вглубь своей
      // поверхности.
      const vxSign = toRight ? 1 : -1;
      const baseX = toRight ? B.L - 30 : B.R + 30;
      const starts = [];
      for (const off of [0, -35, -70, -110]) {
        const x = toRight ? baseX + off : baseX - off;
        const clamped = Math.max(A.L + 15, Math.min(A.R - 15, x));
        if (!starts.includes(Math.round(clamped))) starts.push(Math.round(clamped));
      }
      let found = false;
      for (const sx0 of starts) {
        for (const mag of [60, 120, 180, 240]) {
          const r = tryJump(sx0, A.T, vxSign * mag);
          if (r && Math.abs(r.feet - Math.round(B.T)) <= 2 && r.x >= B.L - 8 && r.x <= B.R + 8) {
            edges.push({ from: A, to: B, sx: sx0, vx: vxSign * mag, land: r.x, dy: Math.round(dy) });
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  }
  console.log('[rm] рёбер найдено:', edges.length);
  try {
    mkdirSync('tmp', { recursive: true });
    writeFileSync('tmp/edges.json', JSON.stringify(edges, null, 1));
    console.log('[rm] записано tmp/edges.json');
  } catch (e) { console.log('[rm] write fail', e.message); }
  for (const e of edges) {
    console.log('[rm] ' + Math.round(e.from.T) + '@' + Math.round(e.from.L) + '..' + Math.round(e.from.R) +
      '  ->  ' + Math.round(e.to.T) + '@' + Math.round(e.to.L) + '..' + Math.round(e.to.R) +
      '   старт x=' + e.sx + ' vx=' + e.vx + ' (Δy=' + e.dy + ', сел x=' + e.land + ')');
  }
  clearInterval(keep);
  process.exit(0);
});
