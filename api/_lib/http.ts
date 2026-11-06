import { HttpError } from './errors';

/** CORS + small request/response helpers shared by all adapters. */

export function setCors(res: { setHeader: (k: string, v: string) => void }): void {
  const allow = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-owner-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
}

export function ownerKeyOf(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers['x-owner-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.length >= 8 ? value : null;
}

export function json(res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void }, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function readJsonBody(req: { on: (ev: string, cb: (chunk?: Buffer) => void) => void }, limitMb = 10): Promise<any> {
  const limit = limitMb * 1024 * 1024;
  const chunks: Buffer[] = [];
  let size = 0;
  return new Promise((resolve, reject) => {
    req.on('data', (chunk?: Buffer) => {
      size += chunk ? chunk.length : 0;
      if (size > limit) {
        reject(new HttpError(413, `Request body too large (max ${limitMb}MB)`));
        return;
      }
      if (chunk) chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON body'));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'Failed to read request body')));
  });
}
