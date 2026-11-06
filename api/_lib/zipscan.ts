import { HttpError } from './errors';

/**
 * ZIP security scanner.
 *
 * Protects the build worker against:
 *  - path traversal entries ("../", absolute paths, backslashes)
 *  - symlink entries
 *  - zip bombs (per-entry ratio, total uncompressed size, entry count)
 *
 * The same checks are mirrored in build-worker/lib-zip.js which runs on the
 * GitHub Actions runner — the API-side scan is the first gate, the runner
 * scan is the authoritative one.
 */

export interface ZipScan {
  entries: number;
  totalUncompressed: number;
  hasIndexHtml: boolean;
  nestedRoot: string | null;
  names: string[];
}

interface CdEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  localOffset: number;
  externalAttrs: number;
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new HttpError(400, 'Invalid ZIP: end of central directory not found');
}

export function parseCentralDirectory(buf: Buffer): CdEntry[] {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries: CdEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) {
      throw new HttpError(400, 'Invalid ZIP: corrupt central directory');
    }
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    entries.push({ name, compressedSize, uncompressedSize, method, localOffset, externalAttrs });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function scanZip(buf: Buffer, opts?: { maxEntries?: number; maxTotalMb?: number }): ZipScan {
  const maxEntries = opts?.maxEntries ?? 20000;
  const maxTotal = (opts?.maxTotalMb ?? 200) * 1024 * 1024;

  const entries = parseCentralDirectory(buf);
  if (entries.length > maxEntries) {
    throw new HttpError(400, `ZIP contains too many entries (${entries.length}, max ${maxEntries})`);
  }

  let totalUncompressed = 0;
  let hasIndexHtml = false;
  const topLevel = new Set<string>();
  const names: string[] = [];

  for (const e of entries) {
    const name = e.name;
    if (name.includes('\\') || name.startsWith('/') || name.includes('://')) {
      throw new HttpError(400, `Unsafe ZIP entry path: ${name.slice(0, 80)}`);
    }
    const segments = name.split('/');
    if (segments.some((s) => s === '..' || s === '' && segments.length > 1)) {
      throw new HttpError(400, `Path traversal detected in ZIP entry: ${name.slice(0, 80)}`);
    }
    // symlink check — unix file type in high 16 bits of external attrs
    const fileType = (e.externalAttrs >>> 16) & 0xf000;
    if (fileType === 0xa000) {
      throw new HttpError(400, `Symlink entries are not allowed: ${name.slice(0, 80)}`);
    }
    if (name.endsWith('/')) continue; // directory entry
    if (segments.length > 1 && segments[0]) topLevel.add(segments[0]);

    totalUncompressed += e.uncompressedSize;
    if (totalUncompressed > maxTotal) {
      throw new HttpError(400, `ZIP uncompressed content too large (max ${maxTotal / 1024 / 1024}MB)`);
    }
    const ratio = e.compressedSize > 0 ? e.uncompressedSize / e.compressedSize : 1;
    if (ratio > 500 && e.uncompressedSize > 1_000_000) {
      throw new HttpError(400, `Zip bomb pattern detected in entry: ${name.slice(0, 80)}`);
    }
    const clean = name;
    names.push(clean);
    if (clean === 'index.html') hasIndexHtml = true;
  }

  let nestedRoot: string | null = null;
  if (!hasIndexHtml && topLevel.size === 1) {
    const root = [...topLevel][0];
    const innerName = `${root}/index.html`;
    if (entries.some((e) => e.name === innerName)) {
      nestedRoot = root;
      hasIndexHtml = true;
    }
  }

  return { entries: entries.length, totalUncompressed, hasIndexHtml, nestedRoot, names };
}

/** Read a single file out of a zip buffer (used for keystore.enc artifacts). */
export function readZipEntry(buf: Buffer, nameEndsWith: string): Buffer {
  const entries = parseCentralDirectory(buf);
  const entry = entries.find((e) => !e.name.endsWith('/') && e.name.endsWith(nameEndsWith));
  if (!entry) throw new HttpError(404, `Entry *${nameEndsWith} not found in artifact`);
  const local = entry.localOffset;
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new HttpError(400, 'Invalid ZIP: bad local header');
  const nameLen = buf.readUInt16LE(local + 26);
  const extraLen = buf.readUInt16LE(local + 28);
  const dataStart = local + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const zlib = require('zlib') as typeof import('zlib');
    return zlib.inflateRawSync(data);
  }
  throw new HttpError(400, `Unsupported ZIP compression method ${entry.method}`);
}
