// diag_navcomp.mjs — ЧИСТАЯ ДИАГНОСТИКА: компоненты связности навграфа.
// Печатает размер и bbox каждого компонента + где лежат базы/флаги.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/diag_navcomp.mjs --seed 1337
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupDom, setupClock } from './dom.mjs';
import { stubAssets } from './assets.mjs';
import { gameState } from '../../js/data/gameState.js?v=171';

const SEED = parseInt(process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--seed') || '1337', 10);
setupDom(SEED);
const clock = setupClock();
globalThis.Phaser = createRequire(import.meta.url)('../../vendor/phaser.min.js');
const Phaser = globalThis.Phaser;
stubAssets(Phaser);
const { default: GameScene } = await import('../../js/scenes/GameScene.js');

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
  for (let i = 0; i < 20; i++) { t += 1000 / 60; clock.now = t; game.headlessStep(t, 1000 / 60); }
  const sc = game.scene.getScene('GameScene');
  const g = sc._navGraph;
  if (!g || !g.nodes || !g.nodes.length) { console.log('[nc] графа нет'); process.exit(0); }
  const n = g.nodes.length;
  const comp = new Int32Array(n).fill(-1);
  let nc = 0;
  const comps = [];
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue;
    const id = nc++;
    const q = [i]; comp[i] = id;
    const info = { id, size: 0, x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, sample: [] };
    for (let h = 0; h < q.length; h++) {
      const cur = q[h];
      const nd = g.nodes[cur];
      info.size++;
      info.x0 = Math.min(info.x0, nd.x); info.x1 = Math.max(info.x1, nd.x);
      info.y0 = Math.min(info.y0, nd.y); info.y1 = Math.max(info.y1, nd.y);
      if (info.sample.length < 5) info.sample.push(`${cur}:${Math.round(nd.x)},${Math.round(nd.y)}`);
      for (const nb of (g.links[cur] || [])) {
        if (comp[nb] < 0) { comp[nb] = id; q.push(nb); }
      }
    }
    comps.push(info);
  }
  comps.sort((a, b) => b.size - a.size);
  console.log('[nc] узлов', n, 'компонент', comps.length);
  const near = (x, y) => {
    let bi = -1, bd = 1e9;
    g.nodes.forEach((nd, i) => { const d = Math.abs(nd.x - x) + Math.abs(nd.y - y) * 0.5; if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  for (const c of comps) {
    console.log(`[nc] #${c.id}: ${c.size} узлов, x ${Math.round(c.x0)}..${Math.round(c.x1)}, y ${Math.round(c.y0)}..${Math.round(c.y1)} | ${c.sample.join(' ')}`);
  }
  const probes = [['ground@200', 200, 850], ['mid690', 1900, 690], ['blueflag', 170, 730], ['redflag', 3630, 730], ['top478', 1900, 478]];
  for (const [nm, x, y] of probes) {
    const i = near(x, y);
    console.log(`[nc] ${nm} -> узел ${i}:(${Math.round(g.nodes[i].x)},${Math.round(g.nodes[i].y)}) компонент #${comp[i]}`);
  }
  clearInterval(keep);
  process.exit(0);
});
