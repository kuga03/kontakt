'use strict';
// Packs ./www into a zip for Capacitor Updater OTA and prints sha256.
// Usage: node scripts/make-ota-zip.cjs [outZip]   (default: ota-bundle.zip)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'www');
const OUT = path.resolve(ROOT, process.argv[2] || 'ota-bundle.zip');

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
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1; // 1980-01-01

function walk(abs, rel, out) {
  let st;
  try { st = fs.statSync(abs); } catch (e) { return; }
  if (st.isDirectory()) {
    let entries = [];
    try { entries = fs.readdirSync(abs); } catch (e) { return; }
    entries.sort();
    for (const name of entries) {
      if (name === '.' || name === '..') continue;
      walk(path.join(abs, name), rel ? rel + '/' + name : name, out);
    }
  } else if (st.isFile()) out.push({ rel, abs });
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
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(DOS_TIME, 10);
    lfh.writeUInt16LE(DOS_DATE, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBytes.length, 26);
    lfh.writeUInt16LE(0, 28);
    chunks.push(lfh, nameBytes, payload);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10); cd.writeUInt16LE(DOS_TIME, 12); cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(payload.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBytes);
    offset += lfh.length + nameBytes.length + payload.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

if (!fs.existsSync(SRC)) { console.error('missing www/. Run build first.'); process.exit(1); }
const files = [];
walk(SRC, '', files);
if (!files.length) { console.error('www/ is empty'); process.exit(1); }
const buf = buildZip(files);
fs.writeFileSync(OUT, buf);
const sha = crypto.createHash('sha256').update(buf).digest('hex');
console.log(JSON.stringify({ out: OUT, files: files.length, bytes: buf.length, sha256: sha }));
