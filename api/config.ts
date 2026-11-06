import { setCors, json } from './_lib/http';
import * as core from './_lib/core';

/** Vercel adapter — /api/config : public runtime limits for the frontend. */
export default async function handler(req: any, res: any): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  json(res, 200, core.publicConfig());
}
