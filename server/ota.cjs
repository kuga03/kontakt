'use strict';
// OTA-раздача игрового бандла для Capacitor-приложения (плагин @capgo/capacitor-updater).
//
//   POST/GET /ota/updates     -> { version, url, checksum }  (манифест для плагина)
//   GET      /ota/bundle.zip  -> zip клиентских файлов
//
// Набор файлов — тот же рантайм-allowlist, что кладётся в www/
// (см. android-build/copy-www.cjs), поэтому OTA-бандл совпадает с APK-сборкой.
//
// Zip собирается вручную (zlib + CRC32) — внешних зависимостей нет, чтобы
// не тянуть ничего на Render. Версия берётся из index.html (?v=N) -> 1.0.N.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const GAME_ROOT = path.resolve(__dirname, '..');
const ITEMS = ['index.html', 'js', 'assets', 'vendor', 'maps', 'favicon.ico'];

// ---- CRC32 (для заголовков zip) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Фиксированные DOS-дата/время — zip получается детерминированным
// (одинаковые файлы -> одинаковый checksum).
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1; // 1980-01-01

function walk(abs, rel, out) {
  let st;
  try { st = fs.statSync(abs); } catch (e) { return; }
  if (st.isDirectory()) {
    let entries;
    try { entries = fs.readdirSync(abs); } catch (e) { return; }
    entries.sort();
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      walk(path.join(abs, name), rel ? rel + '/' + name : name, out);
    }
  } else if (st.isFile()) {
    out.push({ rel, abs });
  }
}

function collectFiles() {
  const out = [];
  for (const name of ITEMS) {
    const abs = path.join(GAME_ROOT, name);
    if (!fs.existsSync(abs)) continue;
    walk(abs, name, out);
  }
  return out;
}

function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? deflated : data;
    const nameBytes = Buffer.from(f.rel, 'utf8');
    const crc = crc32(data);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);       // version needed
    lfh.writeUInt16LE(0x0800, 6);   // флаг: имена в UTF-8
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(DOS_TIME, 10);
    lfh.writeUInt16LE(DOS_DATE, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBytes.length, 26);
    lfh.writeUInt16LE(0, 28);       // extra length
    chunks.push(lfh, nameBytes, payload);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);        // version made by
    cd.writeUInt16LE(20, 6);        // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);        // extra
    cd.writeUInt16LE(0, 32);        // comment
    cd.writeUInt16LE(0, 34);        // disk number
    cd.writeUInt16LE(0, 36);        // internal attrs
    cd.writeUInt32LE(0, 38);        // external attrs
    cd.writeUInt32LE(offset, 42);   // offset of local header
    central.push(cd, nameBytes);

    offset += lfh.length + nameBytes.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);         // disk
  eocd.writeUInt16LE(0, 6);         // cd disk
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);        // comment length

  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// Версия игры = счётчик ?v=N из index.html -> semver 1.0.N.
function readVersion() {
  try {
    const html = fs.readFileSync(path.join(GAME_ROOT, 'index.html'), 'utf8');
    const m = html.match(/\?v=(\d+)/);
    if (m) return '1.0.' + m[1];
  } catch (e) {}
  return '1.0.0';
}

let cache = null; // { version, buffer, checksum, files, builtAt }

function getBundle(force) {
  const version = readVersion();
  if (!force && cache && cache.version === version) return cache;
  const files = collectFiles();
  const buffer = buildZip(files);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  cache = { version, buffer, checksum, files: files.length, builtAt: Date.now() };
  try {
    console.log(`[ota] bundle v${version}: ${files.length} files, ${(buffer.length / 1048576).toFixed(1)} MB, sha256=${checksum.slice(0, 12)}`);
  } catch (e) {}
  return cache;
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };
}

function handleUpdates(req, res) {
  let body = '';
  req.on('data', (d) => { body += d; if (body.length > 1e6) { try { req.destroy(); } catch (e) {} } });
  const respond = () => {
    let info;
    try {
      info = getBundle(/[?&]rebuild=1/.test(req.url || ''));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...cors() });
      res.end(JSON.stringify({ error: 'bundle build failed' }));
      return;
    }
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
      || (req.socket && req.socket.encrypted ? 'https' : 'http');
    const host = req.headers.host || ('127.0.0.1:' + (process.env.PORT || 8081));
    const json = JSON.stringify({
      version: info.version,
      url: `${proto}://${host}/ota/bundle.zip?v=${info.version}`,
      checksum: info.checksum
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json), ...cors() });
    res.end(json);
  };
  req.on('end', respond);
  req.on('error', respond);
}

function handleBundle(req, res) {
  let info;
  try {
    info = getBundle(/[?&]rebuild=1/.test(req.url || ''));
  } catch (e) {
    res.writeHead(500, { ...cors() });
    res.end('bundle error');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Length': info.buffer.length,
    'Cache-Control': 'no-store',
    'ETag': '"' + info.checksum + '"',
    ...cors()
  });
  res.end(info.buffer);
}

// true, если запрос наш (обработан здесь) — иначе отдаём дальше статике.
function handleOta(req, res) {
  const p = (req.url || '').split('?')[0];
  if (p !== '/ota/updates' && p !== '/ota/updates/' && p !== '/ota/bundle.zip') return false;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    res.end();
    return true;
  }
  if (p === '/ota/bundle.zip') handleBundle(req, res);
  else handleUpdates(req, res);
  return true;
}

module.exports = { handleOta, getBundle, readVersion };
