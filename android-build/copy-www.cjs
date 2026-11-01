// copy-www.cjs — собирает папку www/ для Capacitor-APK.
// Копируем ТОЛЬКО рантайм игры (allowlist), без server/, docs/,
// preview/, .git, node_modules и прочего мусора.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname + '\\..';
const WWW = path.join(ROOT, 'www');
const ITEMS = ['index.html', 'js', 'assets', 'vendor', 'maps', 'favicon.ico', 'version.json'];

if (!fs.existsSync(ROOT)) throw new Error('no root');
if (fs.existsSync(WWW)) fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

for (const name of ITEMS) {
  const src = path.join(ROOT, name);
  const dst = path.join(WWW, name);
  if (!fs.existsSync(src)) {
    console.warn('[copy-www] skip missing: ' + name);
    continue;
  }
  fs.cpSync(src, dst, { recursive: true });
  console.log('[copy-www] ok: ' + name);
}
console.log('[copy-www] done -> www/');
