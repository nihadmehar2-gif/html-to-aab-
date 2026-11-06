import crypto from 'node:crypto';

/**
 * Web2APK Studio — payload encryption.
 *
 * Every build payload (site files, config, signing material) is encrypted
 * with AES-256-GCM before it is stored anywhere. The key is derived with
 * HKDF from the browser owner key (random UUID in localStorage) and the
 * job id, and is delivered to the build runner exclusively through GitHub
 * Actions secrets. It is never committed, never logged and never exposed
 * to the frontend after the initial upload.
 */

const MAGIC = Buffer.from('W2A1');

export function deriveJobKey(ownerKey: string, jobId: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(ownerKey, 'utf8'),
      Buffer.from(jobId, 'utf8'),
      Buffer.from('web2apk-studio-v1', 'utf8'),
      32
    )
  );
}

/** Layout: "W2A1" | iv(12) | tag(16) | ciphertext */
export function encryptBuffer(plain: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ct]);
}

export function decryptBuffer(enc: Buffer, key: Buffer): Buffer {
  if (enc.length < MAGIC.length + 12 + 16 || !enc.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = enc.subarray(4, 16);
  const tag = enc.subarray(16, 32);
  const ct = enc.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function encryptJson(obj: unknown, key: Buffer): Buffer {
  return encryptBuffer(Buffer.from(JSON.stringify(obj), 'utf8'), key);
}

export function decryptJson<T>(enc: Buffer, key: Buffer): T {
  return JSON.parse(decryptBuffer(enc, key).toString('utf8')) as T;
}

export function sha256hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function secretNameForJob(jobId: string): string {
  return `W2A_KEY_${jobId.replace(/-/g, '').toUpperCase()}`;
}
