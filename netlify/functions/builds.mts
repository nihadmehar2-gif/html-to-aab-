/**
 * Netlify Functions v2 adapter — /api/builds
 * Thin wrapper over api/_lib/core.ts (same core as the Vercel adapter).
 */
import * as core from '../../api/_lib/core';
import { errorStatus } from '../../api/_lib/errors';

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-owner-key',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Cache-Control': 'no-store',
    },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  const url = new URL(req.url);
  const ownerKey = req.headers.get('x-owner-key');
  try {
    if (req.method === 'POST') {
      const body = await req.json();
      return jsonResponse(200, await core.createBuild(body, ownerKey));
    }
    if (req.method === 'GET') {
      const jobId = url.searchParams.get('jobId');
      if (jobId) {
        return jsonResponse(200, await core.getStatus(jobId, ownerKey, url.searchParams.get('logs') === '1'));
      }
      return jsonResponse(200, { builds: await core.listBuilds(ownerKey) });
    }
    if (req.method === 'DELETE') {
      const jobId = url.searchParams.get('jobId');
      if (!jobId) return jsonResponse(400, { error: 'jobId is required' });
      if (url.searchParams.get('cancel') === '1') {
        return jsonResponse(200, await core.cancelBuild(jobId, ownerKey));
      }
      return jsonResponse(200, await core.deleteBuild(jobId, ownerKey));
    }
    return new Response(null, { status: 405 });
  } catch (e) {
    return jsonResponse(errorStatus(e), { error: e instanceof Error ? e.message : 'Internal error' });
  }
};

export const config = { path: '/api/builds' };
