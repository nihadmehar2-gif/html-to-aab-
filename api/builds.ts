import { setCors, ownerKeyOf, json, readJsonBody } from './_lib/http';
import { errorStatus } from './_lib/errors';
import * as core from './_lib/core';

/**
 * Vercel adapter — /api/builds
 *   POST   create a build (file + config, encrypted server-side)
 *   GET    ?jobId=…       build status (+&logs=1 for logs)
 *   GET    (no jobId)     list this device's builds
 *   DELETE ?jobId=…&cancel=1   cancel the workflow run
 *   DELETE ?jobId=…       delete the build
 */
export default async function handler(req: any, res: any): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  try {
    if (req.method === 'POST') {
      const body = await readJsonBody(req, 12);
      json(res, 200, await core.createBuild(body, ownerKeyOf(req.headers)));
    } else if (req.method === 'GET') {
      const jobId = req.query?.jobId as string | undefined;
      if (jobId) {
        json(res, 200, await core.getStatus(jobId, ownerKeyOf(req.headers), req.query?.logs === '1'));
      } else {
        json(res, 200, { builds: await core.listBuilds(ownerKeyOf(req.headers)) });
      }
    } else if (req.method === 'DELETE') {
      const jobId = req.query?.jobId as string;
      if (!jobId) throw new (await import('./_lib/errors')).HttpError(400, 'jobId is required');
      if (req.query?.cancel === '1') {
        json(res, 200, await core.cancelBuild(jobId, ownerKeyOf(req.headers)));
      } else {
        json(res, 200, await core.deleteBuild(jobId, ownerKeyOf(req.headers)));
      }
    } else {
      res.statusCode = 405;
      res.end();
    }
  } catch (e) {
    json(res, errorStatus(e), { error: e instanceof Error ? e.message : 'Internal error' });
  }
}
