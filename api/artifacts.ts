import { setCors, ownerKeyOf, json } from './_lib/http';
import { errorStatus } from './_lib/errors';
import * as core from './_lib/core';

/**
 * Vercel adapter — /api/artifacts
 *   GET ?jobId=…&list=1          list artifacts for a build
 *   GET ?jobId=…&kind=apk|aab    stream the artifact ZIP (browser unzips)
 *   GET ?jobId=…&kind=keystore   decrypted keystore credentials JSON (owner only)
 */
export default async function handler(req: any, res: any): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  try {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end();
      return;
    }
    const jobId = req.query?.jobId as string;
    if (!jobId) throw new (await import('./_lib/errors')).HttpError(400, 'jobId is required');
    const kind = (req.query?.kind as string) || '';

    if (!kind || req.query?.list === '1') {
      json(res, 200, { artifacts: await core.listArtifacts(jobId, ownerKeyOf(req.headers)) });
      return;
    }

    const out = await core.downloadArtifact(jobId, ownerKeyOf(req.headers), kind);
    const contentType = out.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // keystore credentials — small JSON, send directly
      const text = await out.text();
      json(res, out.status, JSON.parse(text));
      return;
    }

    // stream the artifact zip to the browser
    res.statusCode = out.status;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${kind}-${jobId}.zip"`);
    const { Readable } = await import('node:stream');
    if (out.body) {
      Readable.fromWeb(out.body as any).pipe(res);
    } else {
      res.end();
    }
  } catch (e) {
    json(res, errorStatus(e), { error: e instanceof Error ? e.message : 'Internal error' });
  }
}
