'use strict';

/**
 * Step 2b — safe ZIP extraction.
 * Pure Node implementation: only validated entries, no symlinks, no
 * absolute paths, no ".." segments, hardened output-path check.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function findEocd(buf) {
  const min = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('Invalid ZIP');
}

function parseCentralDirectory(buf) {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt central directory');
    const nameLen = buf.readUInt16LE(p + 28);
    entries.push({
      method: buf.readUInt16LE(p + 10),
      compressedSize: buf.readUInt32LE(p + 20),
      uncompressedSize: buf.readUInt32LE(p + 24),
      nameLen,
      extraLen: buf.readUInt16LE(p + 30),
      commentLen: buf.readUInt16LE(p + 32),
      localOffset: buf.readUInt32LE(p + 42),
      name: buf.subarray(p + 46, p + 46 + nameLen).toString('utf8'),
    });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return entries;
}

function assertSafeTarget(outDir, relative) {
  const target = path.resolve(outDir, relative);
  const base = path.resolve(outDir) + path.sep;
  if (!target.startsWith(base) && target !== path.resolve(outDir)) {
    throw new Error(`Blocked extraction outside output dir: ${relative}`);
  }
  return target;
}

function main() {
  const zipPath = process.argv[2];
  const outDir = process.argv[3] || 'site';
  const meta = JSON.parse(fs.readFileSync('work/zip-meta.json', 'utf8'));
  const prefix = meta.nestedRoot ? `${meta.nestedRoot}/` : '';

  const buf = fs.readFileSync(zipPath);
  const entries = parseCentralDirectory(buf);
  fs.mkdirSync(outDir, { recursive: true });

  let written = 0;
  for (const e of entries) {
    if (e.name.endsWith('/')) continue;
    const name = prefix && e.name.startsWith(prefix) ? e.name.slice(prefix.length) : e.name;
    if (!name || name.includes('..') || name.startsWith('/')) continue;

    const target = assertSafeTarget(outDir, name);
    const local = e.localOffset;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Bad local header');
    const nameLen = buf.readUInt16LE(local + 26);
    const extraLen = buf.readUInt16LE(local + 28);
    const dataStart = local + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + e.compressedSize);

    let content;
    if (e.method === 0) content = Buffer.from(data);
    else if (e.method === 8) content = zlib.inflateRawSync(data);
    else throw new Error(`Unsupported compression method ${e.method} in "${name}"`);

    if (content.length !== e.uncompressedSize) throw new Error(`Size mismatch in "${name}"`);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, { mode: 0o644 });
    written++;
  }
  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    throw new Error('Extraction finished but index.html is missing');
  }
  console.log(`Extracted ${written} files to ${outDir}/`);
}

main();
