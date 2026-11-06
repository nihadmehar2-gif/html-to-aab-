/**
 * Netlify Functions v2 adapter — /api/artifacts
 */
import * as core from '../../api/_lib/core';
import { errorStatus, HttpError } from '../../api/_lib/errors';

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-owner-key',
      'Cache-Control': 'no-store',
    },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  const url = new URL(req.url);
  const ownerKey = req.headers.get('x-owner-key');
  try {
    const jobId = url.searchParams.get('jobId');
    if (!jobId) throw new HttpError(400, 'jobId is required');
    const kind = url.searchParams.get('kind') || '';

    if (!kind || url.searchParams.get('list') === '1') {
      return jsonResponse(200, { artifacts: await core.listArtifacts(jobId, ownerKey) });
    }

    const out = await core.downloadArtifact(jobId, ownerKey, kind);
    const contentType = out.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return new Response(await out.text(), {
        status: out.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    return new Response(out.body, {
      status: out.status,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${kind}-${jobId}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return jsonResponse(errorStatus(e), { error: e instanceof Error ? e.message : 'Internal error' });
  }
};

export const config = { path: '/api/artifacts' };
