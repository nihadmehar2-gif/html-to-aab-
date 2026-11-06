/**
 * Minimal STORE-only ZIP writer (no compression).
 * Used to wrap a single uploaded HTML file into site.zip so that the
 * build workflow always receives the same, already-validated structure.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
}

export function buildStoreZip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x5921, 12); // mod date (2024-09-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed
    local.writeUInt32LE(size, 22); // uncompressed
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    parts.push(local, name, f.data);
    entries.push({ name, crc, size, offset });
    offset += local.length + name.length + size;
  }

  const cdStart = offset;
  for (const e of entries) {
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5921, 14);
    central.writeUInt32LE(e.crc, 16);
    central.writeUInt32LE(e.size, 20);
    central.writeUInt32LE(e.size, 24);
    central.writeUInt16LE(e.name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(e.offset, 42);
    parts.push(central, e.name);
    offset += central.length + e.name.length;
  }
  const cdSize = offset - cdStart;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  parts.push(eocd);

  return Buffer.concat(parts);
}
