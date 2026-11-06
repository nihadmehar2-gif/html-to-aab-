/**
 * Netlify Functions v2 adapter — /api/config
 */
import * as core from '../../api/_lib/core';

export default async (): Promise<Response> => {
  return new Response(JSON.stringify(core.publicConfig()), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

export const config = { path: '/api/config' };
