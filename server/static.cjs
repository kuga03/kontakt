'use strict';
const fs = require('fs');
const path = require('path');
const GAME_ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res) {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(GAME_ROOT, urlPath));
    if (!file.startsWith(GAME_ROOT)) {
      res.writeHead(403); res.end('forbidden');
      return;
    }
    // Не отдаём служебное: историю git (.git — там весь исходный код),
    // зависимости (node_modules), код сервера/доки и любые dot-файлы.
    // Отвечаем 404, чтобы не палить существование.
    try {
      const rel = path.relative(GAME_ROOT, file);
      const parts = rel.split(path.sep);
      const ext = path.extname(file).toLowerCase();
      const DENY_TOP = ['server', 'docs', 'android', 'android-build', 'node_modules'];
      const DENY_FILE = ['package.json', 'package-lock.json', 'capacitor.config.json', 'start-server.cmd', 'skins_list.txt'];
      const DENY_EXT = ['.cjs', '.mjs', '.md', '.cmd', '.bat'];
      if (
        parts.some(p => p.startsWith('.')) ||
        parts.includes('node_modules') ||
        parts.includes('.git') ||
        DENY_TOP.includes(parts[0]) ||
        DENY_FILE.includes(rel) ||
        DENY_EXT.includes(ext)
      ) {
        res.writeHead(404); res.end('not found');
        return;
      }
    } catch (e) {
      res.writeHead(404); res.end('not found');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404); res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        // Версионные URL (?v=.. — весь код и арты) immutable: браузер берёт
        // их из кэша и повторный заход быстрый. Без версии — как раньше
        // no-store (иначе гости видят старую сборку). Смена версии в URL
        // сама инвалидирует кэш, чистка вручную не нужна.
        'Cache-Control': req.url.includes('?v=')
          ? 'public, max-age=31536000, immutable'
          : 'no-store',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500); res.end('error');
  }
}

module.exports = { MIME, serveStatic };

