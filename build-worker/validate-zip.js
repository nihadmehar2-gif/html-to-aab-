'use strict';

/**
 * Step 2a — authoritative ZIP security scan on the runner.
 * Mirrors api/_lib/zipscan.ts. Rejects path traversal, symlinks and
 * zip bombs BEFORE anything is extracted.
 */

const fs = require('fs');

function findEocd(buf) {
  const min = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('Invalid ZIP: end of central directory not found');
}

function parseCentralDirectory(buf) {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error('Invalid ZIP: corrupt central directory');
    }
    entries.push({
      method: buf.readUInt16LE(p + 10),
      compressedSize: buf.readUInt32LE(p + 20),
      uncompressedSize: buf.readUInt32LE(p + 24),
      nameLen: buf.readUInt16LE(p + 28),
      extraLen: buf.readUInt16LE(p + 30),
      commentLen: buf.readUInt16LE(p + 32),
      localOffset: buf.readUInt32LE(p + 42),
      externalAttrs: buf.readUInt32LE(p + 38),
      name: buf.subarray(p + 46, p + 46 + buf.readUInt16LE(p + 28)).toString('utf8'),
    });
    p += 46 + buf.readUInt16LE(p + 28) + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return entries;
}

function main() {
  const zipPath = process.argv[2];
  if (!zipPath || !fs.existsSync(zipPath)) {
    throw new Error('site.zip not found');
  }
  const buf = fs.readFileSync(zipPath);
  const entries = parseCentralDirectory(buf);

  if (entries.length > 20000) throw new Error(`Too many entries: ${entries.length} (max 20000)`);

  let total = 0;
  let hasIndexHtml = false;
  const topLevel = new Set();

  for (const e of entries) {
    const name = e.name;
    if (name.includes('\\') || name.startsWith('/') || name.includes('://')) {
      throw new Error(`Unsafe ZIP entry path: "${name.slice(0, 80)}"`);
    }
    const segments = name.split('/');
    if (segments.some((s) => s === '..')) {
      throw new Error(`Path traversal detected: "${name.slice(0, 80)}"`);
    }
    const fileType = (e.externalAttrs >>> 16) & 0xf000;
    if (fileType === 0xa000) throw new Error(`Symlink entries are not allowed: "${name.slice(0, 80)}"`);
    if (name.endsWith('/')) continue;
    if (segments.length > 1 && segments[0]) topLevel.add(segments[0]);

    total += e.uncompressedSize;
    if (total > 200 * 1024 * 1024) throw new Error('Uncompressed content exceeds 200MB');
    const ratio = e.compressedSize > 0 ? e.uncompressedSize / e.compressedSize : 1;
    if (ratio > 500 && e.uncompressedSize > 1024 * 1024) {
      throw new Error(`Zip bomb pattern in "${name.slice(0, 80)}"`);
    }
    if (name === 'index.html') hasIndexHtml = true;
  }

  let nestedRoot = null;
  if (!hasIndexHtml && topLevel.size === 1) {
    const root = [...topLevel][0];
    if (entries.some((e) => e.name === `${root}/index.html`)) {
      nestedRoot = root;
      hasIndexHtml = true;
    }
  }
  if (!hasIndexHtml) throw new Error('index.html not found at ZIP root (or in a single top-level folder)');

  fs.writeFileSync('work/zip-meta.json', JSON.stringify({ entries: entries.length, totalUncompressed: total, hasIndexHtml, nestedRoot }, null, 2));
  console.log(`ZIP OK: ${entries.length} entries, ${(total / 1024 / 1024).toFixed(2)}MB uncompressed${nestedRoot ? `, nested root "${nestedRoot}"` : ''}`);
}

main();
