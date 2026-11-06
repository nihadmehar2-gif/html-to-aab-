import sodium from 'libsodium-wrappers';
import { GhError } from './errors';

/**
 * Minimal GitHub REST client used by the serverless functions.
 * Runs ONLY server-side — the token never reaches the browser.
 */

const API = 'https://api.github.com';

export interface GhEnv {
  token: string;
  owner: string;
  repo: string;
  jobsBranch: string;
}

export function ghEnv(): GhEnv {
  const token = process.env.GH_TOKEN;
  const owner = process.env.GH_OWNER;
  const repo = process.env.GH_REPO;
  const jobsBranch = process.env.JOBS_BRANCH || 'jobs';
  if (!token || !owner || !repo) {
    throw new GhError(500, 'Server not configured: GH_TOKEN, GH_OWNER and GH_REPO are required');
  }
  return { token, owner, repo, jobsBranch };
}

function url(path: string): string {
  return path.startsWith('http') ? path : `${API}${path}`;
}

export async function ghFetch(path: string, init: RequestInit = {}, raw = false): Promise<Response> {
  const env = ghEnv();
  return fetch(url(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${env.token}`,
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'web2apk-studio',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
}

async function assertOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  let detail = '';
  try {
    const body = await res.json();
    detail = body && body.message ? ` — ${body.message}` : '';
  } catch {
    /* ignore */
  }
  throw new GhError(res.status, `GitHub ${action} failed (${res.status})${detail}`);
}

export async function ghJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await ghFetch(path, init);
  await assertOk(res, path);
  return (await res.json()) as T;
}

export async function ghRaw(path: string): Promise<Buffer> {
  const res = await ghFetch(path, {}, true);
  await assertOk(res, path);
  return Buffer.from(await res.arrayBuffer());
}

let defaultBranchCache: string | null = null;

export async function defaultBranch(): Promise<string> {
  if (defaultBranchCache) return defaultBranchCache;
  const repo = await ghJson<{ default_branch: string }>(`/repos/${ghEnv().owner}/${ghEnv().repo}`);
  defaultBranchCache = repo.default_branch || 'main';
  return defaultBranchCache;
}

/** Create the jobs branch (copy of default branch) if it does not exist yet. */
export async function ensureJobsBranch(): Promise<void> {
  const env = ghEnv();
  try {
    await ghJson(`/repos/${env.owner}/${env.repo}/git/ref/heads/${env.jobsBranch}`);
    return;
  } catch (e) {
    if (!(e instanceof GhError && e.status === 404)) throw e;
  }
  const base = await ghJson<{ object: { sha: string } }>(
    `/repos/${env.owner}/${env.repo}/git/ref/heads/${await defaultBranch()}`
  );
  await ghJson(`/repos/${env.owner}/${env.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${env.jobsBranch}`, sha: base.object.sha }),
  });
}

async function getContentSha(path: string): Promise<string | undefined> {
  try {
    const cur = await ghJson<{ sha: string }>(`/repos/${ghEnv().owner}/${ghEnv().repo}/contents/${path}?ref=${ghEnv().jobsBranch}`);
    return cur.sha;
  } catch (e) {
    if (e instanceof GhError && e.status === 404) return undefined;
    throw e;
  }
}

/** Create or update a file on the jobs branch via the Contents API. */
export async function putFile(path: string, content: Buffer, message: string): Promise<void> {
  const env = ghEnv();
  const sha = await getContentSha(path);
  await ghJson(`/repos/${env.owner}/${env.repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: content.toString('base64'),
      branch: env.jobsBranch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function getRaw(path: string): Promise<Buffer> {
  const env = ghEnv();
  return ghRaw(`/repos/${env.owner}/${env.repo}/contents/${path}?ref=${env.jobsBranch}`);
}

export async function deleteFile(path: string): Promise<void> {
  const env = ghEnv();
  try {
    const sha = await getContentSha(path);
    if (!sha) return;
    await ghJson(`/repos/${env.owner}/${env.repo}/contents/${path}`, {
      method: 'DELETE',
      body: JSON.stringify({ message: `web2apk: remove ${path}`, sha, branch: env.jobsBranch }),
    });
  } catch (e) {
    if (e instanceof GhError && e.status === 404) return;
    throw e;
  }
}

export async function listDir(path: string): Promise<{ name: string; type: string }[]> {
  const env = ghEnv();
  try {
    const items = await ghJson<{ name: string; type: string }[]>(
      `/repos/${env.owner}/${env.repo}/contents/${path}?ref=${env.jobsBranch}`
    );
    return Array.isArray(items) ? items : [];
  } catch (e) {
    if (e instanceof GhError && e.status === 404) return [];
    throw e;
  }
}

export async function dispatchWorkflow(jobId: string, secretName: string): Promise<void> {
  const env = ghEnv();
  const res = await ghFetch(`/repos/${env.owner}/${env.repo}/actions/workflows/android-build.yml/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: await defaultBranch(), inputs: { jobId, secretName } }),
  });
  if (res.status === 204) return;
  await assertOk(res, 'workflow dispatch (check that the token has Actions: Read and write)');
}

/** Latest workflow run whose run-name contains the job id. */
export async function getLatestRunForJob(jobId: string): Promise<{ id: number; status: string; conclusion: string | null } | null> {
  const env = ghEnv();
  try {
    const data = await ghJson<{ workflow_runs: { id: number; name: string; status: string; conclusion: string | null; created_at: string }[] }>(
      `/repos/${env.owner}/${env.repo}/actions/runs?per_page=30`
    );
    const matches = (data.workflow_runs || []).filter((r) => (r.name || '').includes(jobId));
    if (!matches.length) return null;
    const run = matches[0];
    return { id: run.id, status: run.status, conclusion: run.conclusion };
  } catch {
    return null;
  }
}

export async function cancelRun(runId: number): Promise<void> {
  const env = ghEnv();
  const res = await ghFetch(`/repos/${env.owner}/${env.repo}/actions/runs/${runId}/cancel`, { method: 'POST' });
  if (!res.ok && res.status !== 202 && res.status !== 409) await assertOk(res, 'cancel run');
}

export interface ActionsArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
}

export async function listArtifacts(): Promise<ActionsArtifact[]> {
  const env = ghEnv();
  const data = await ghJson<{ artifacts: ActionsArtifact[] }>(
    `/repos/${env.owner}/${env.repo}/actions/artifacts?per_page=100`
  );
  return data.artifacts || [];
}

/** Raw (streaming) download of an artifact zip. Caller pipes/streams it. */
export async function downloadArtifactZip(artifactId: number): Promise<Response> {
  const env = ghEnv();
  const res = await ghFetch(`/repos/${env.owner}/${env.repo}/actions/artifacts/${artifactId}/zip`);
  await assertOk(res, 'artifact download');
  return res;
}

/** Write the per-job payload key into repo Actions secrets (server-side only). */
export async function setJobKeySecret(secretName: string, key: Buffer): Promise<void> {
  const env = ghEnv();
  await sodium.ready;
  const pk = await ghJson<{ key_id: string; key: string }>(
    `/repos/${env.owner}/${env.repo}/actions/secrets/public-key`
  );
  const sealed = sodium.crypto_box_seal(new Uint8Array(key), Buffer.from(pk.key, 'base64') as unknown as Uint8Array);
  await ghJson(`/repos/${env.owner}/${env.repo}/actions/secrets/${secretName}`, {
    method: 'PUT',
    body: JSON.stringify({ encrypted_value: Buffer.from(sealed).toString('base64'), key_id: pk.key_id }),
  });
}

export async function deleteActionsSecret(secretName: string): Promise<void> {
  const env = ghEnv();
  try {
    await ghJson(`/repos/${env.owner}/${env.repo}/actions/secrets/${secretName}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof GhError && (e.status === 404 || e.status === 403 || e.status === 401)) return;
    throw e;
  }
}
