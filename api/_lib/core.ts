import crypto from 'node:crypto';
import { HttpError, GhError } from './errors';
import { deriveJobKey, encryptJson, decryptJson, sha256hex, secretNameForJob } from './crypto';
import * as gh from './github';
import { normalizeConfig, validateSigning, NormalizedConfig, SigningConfig } from './validate';
import { buildStoreZip } from './zipwriter';
import { scanZip, readZipEntry } from './zipscan';

/**
 * Shared business logic — used by both the Vercel adapters (api/*.ts) and
 * the Netlify adapters (netlify/functions/*.mts).
 *
 * Security model:
 *  - The GitHub token lives ONLY in serverless env vars.
 *  - Build payloads (site files, config, signing material) are encrypted
 *    with AES-256-GCM. The key is derived from the browser owner key and
 *    handed to the runner exclusively through GitHub Actions secrets.
 *  - Status files are encrypted the same way, so nothing about a build
 *    (not even the app name) lands in a public repo in plain text.
 *  - Ownership: every request carries x-owner-key; only the browser that
 *    created a job can read its status, logs or artifacts.
 */

export interface StepInfo {
  id: number;
  key: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: string;
  endedAt?: string;
}

export const STEPS: { key: string; name: string }[] = [
  { key: 'receive', name: 'Receive & stage build payload' },
  { key: 'validate', name: 'Validate & extract web assets' },
  { key: 'prepare', name: 'Prepare Capacitor project' },
  { key: 'platform', name: 'Add Android platform & sync' },
  { key: 'assets', name: 'Generate icon & splash' },
  { key: 'manifest', name: 'Apply permissions & manifest' },
  { key: 'signing', name: 'Configure Gradle signing' },
  { key: 'apk', name: 'Compile APK (Gradle)' },
  { key: 'aab', name: 'Compile AAB (Gradle)' },
  { key: 'verify', name: 'Sign & verify artifacts' },
  { key: 'upload', name: 'Upload build artifacts' },
  { key: 'report', name: 'Finalize build status' },
  { key: 'cleanup', name: 'Clean up sensitive data' },
];

export const STEP_PERCENT = [5, 12, 20, 28, 36, 44, 50, 62, 74, 84, 92, 98, 100];

function maxUploadMb(): number {
  const v = parseInt(process.env.MAX_UPLOAD_MB || '3', 10);
  return Number.isFinite(v) && v > 0 ? v : 3;
}

export function publicConfig() {
  return {
    maxUploadMb: maxUploadMb(),
    retentionDays: parseInt(process.env.ARTIFACT_RETENTION_DAYS || '14', 10) || 14,
    capacitorMajor: parseInt(process.env.CAPACITOR_VERSION || '6', 10) || 6,
    steps: STEPS.map((s, i) => ({ id: i + 1, key: s.key, name: s.name })),
  };
}

export async function createBuild(body: any, ownerKey: string | null): Promise<{ jobId: string; state: string }> {
  if (!ownerKey) throw new HttpError(401, 'Missing owner key');
  if (!body || typeof body !== 'object') throw new HttpError(400, 'JSON body required');
  const { fileName, fileBase64, config } = body;
  if (!fileName || !fileBase64 || !config) throw new HttpError(400, 'fileName, fileBase64 and config are required');

  const lower = String(fileName).toLowerCase();
  if (!lower.endsWith('.zip') && !lower.endsWith('.html') && !lower.endsWith('.htm')) {
    throw new HttpError(400, 'Only .html or .zip files are supported');
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(String(fileBase64), 'base64');
  } catch {
    throw new HttpError(400, 'fileBase64 is not valid base64');
  }
  if (buf.length === 0) throw new HttpError(400, 'Uploaded file is empty');
  const limitMb = maxUploadMb();
  if (buf.length > limitMb * 1024 * 1024) {
    throw new HttpError(413, `File too large — max ${limitMb}MB on this deployment`);
  }

  const cfg: NormalizedConfig = normalizeConfig(config);
  const signing: SigningConfig = validateSigning(config.signing);

  const files: Record<string, string> = {};
  let fileMeta: Record<string, unknown>;
  if (lower.endsWith('.zip')) {
    if (!(buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b)) {
      throw new HttpError(400, 'Not a valid ZIP archive');
    }
    const scan = scanZip(buf);
    if (!scan.hasIndexHtml) {
      throw new HttpError(400, 'ZIP must contain index.html at its root (or inside a single top-level folder)');
    }
    files['site.zip'] = buf.toString('base64');
    fileMeta = { kind: 'zip', name: String(fileName), size: buf.length, entries: scan.entries, nestedRoot: scan.nestedRoot };
  } else {
    files['site.zip'] = buildStoreZip([{ name: 'index.html', data: buf }]).toString('base64');
    fileMeta = { kind: 'html', name: String(fileName), size: buf.length };
  }
  if (cfg.appearance.iconBase64) files['icon.png'] = cfg.appearance.iconBase64;
  if (signing.mode === 'upload' && signing.keystoreBase64) files['keystore.jks'] = signing.keystoreBase64;

  const jobId = crypto.randomUUID();
  const key = deriveJobKey(ownerKey, jobId);
  const payload = encryptJson({ config: cfg, signing, files }, key);

  await gh.ensureJobsBranch();
  try {
    await gh.setJobKeySecret(secretNameForJob(jobId), key);
  } catch (e) {
    if (e instanceof GhError && (e.status === 403 || e.status === 404)) {
      throw new HttpError(
        502,
        'The GitHub token cannot write Actions secrets. Add the "Secrets: Read and write" repository permission to the fine-grained PAT (Settings → Developer settings → Personal access tokens), then retry.'
      );
    }
    throw e;
  }
  await gh.putFile(`jobs/${jobId}/payload.enc`, payload, `web2apk: stage payload for ${jobId}`);
  await gh.putFile(
    `jobs/${jobId}/index.json`,
    Buffer.from(
      JSON.stringify({
        jobId,
        createdAt: new Date().toISOString(),
        ownerKeyHash: sha256hex(ownerKey),
        state: 'queued',
        cleaned: false,
      }),
      'utf8'
    ),
    `web2apk: index for ${jobId}`
  );
  await gh.dispatchWorkflow(jobId, secretNameForJob(jobId));
  return { jobId, state: 'queued' };
}

async function readIndex(jobId: string): Promise<any> {
  try {
    return JSON.parse((await gh.getRaw(`jobs/${jobId}/index.json`)).toString('utf8'));
  } catch (e) {
    if (e instanceof GhError && e.status === 404) return null;
    throw e;
  }
}

async function assertOwner(jobId: string, ownerKey: string | null): Promise<any> {
  if (!ownerKey) throw new HttpError(401, 'Missing owner key');
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new HttpError(400, 'Invalid jobId');
  const idx = await readIndex(jobId);
  if (!idx) throw new HttpError(404, 'Build not found');
  if (idx.ownerKeyHash !== sha256hex(ownerKey)) throw new HttpError(403, 'This build belongs to another device');
  return idx;
}

async function readStatus(jobId: string, ownerKey: string): Promise<any> {
  const key = deriveJobKey(ownerKey, jobId);
  try {
    const enc = await gh.getRaw(`jobs/${jobId}/status.enc`);
    return decryptJson<any>(enc, key);
  } catch (e) {
    if (e instanceof GhError && e.status === 404) return null;
    throw e;
  }
}

/** After a build is finished, remove the payload + the per-job secret. */
async function maybeCleanup(jobId: string): Promise<void> {
  try {
    const idx = await readIndex(jobId);
    if (!idx || idx.cleaned) return;
    await gh.deleteActionsSecret(secretNameForJob(jobId));
    await gh.deleteFile(`jobs/${jobId}/payload.enc`);
    idx.cleaned = true;
    await gh.putFile(`jobs/${jobId}/index.json`, Buffer.from(JSON.stringify(idx), 'utf8'), `web2apk: cleanup ${jobId}`);
  } catch {
    /* best effort — the workflow also cleans up locally */
  }
}

export async function getStatus(jobId: string, ownerKey: string | null, includeLogs: boolean): Promise<any> {
  const idx = await assertOwner(jobId, ownerKey);
  const ownerKeyStr = ownerKey as string;
  let status = await readStatus(jobId, ownerKeyStr);

  if (!status) {
    status = {
      jobId,
      state: idx.state || 'queued',
      progress: idx.state === 'queued' ? 2 : 0,
      currentStep: 0,
      steps: STEPS.map((s, i) => ({ id: i + 1, key: s.key, name: s.name, status: 'pending' })),
      logs: [],
      startedAt: idx.createdAt,
    };
  }

  // Cross-check against the workflow run (detects cancellation & stale runs)
  const run = await gh.getLatestRunForJob(jobId);
  if (run) {
    if (run.status === 'completed' && ['queued', 'running'].includes(status.state)) {
      status.state = run.conclusion === 'success' ? 'success' : run.conclusion === 'cancelled' ? 'cancelled' : 'failure';
      if (status.state === 'failure' && !status.error) status.error = 'Build failed — check the step list and logs.';
      status.progress = status.state === 'success' ? 100 : status.progress;
    } else if (run.status !== 'completed' && status.state === 'queued') {
      status.state = 'running';
    }
  }

  if (['success', 'failure', 'cancelled'].includes(status.state)) {
    await maybeCleanup(jobId);
  }

  const out = { ...status, steps: status.steps || STEPS.map((s, i) => ({ id: i + 1, key: s.key, name: s.name, status: 'pending' })) };
  if (includeLogs) {
    out.logs = (status.logs || []).slice(-200);
  } else {
    delete out.logs;
  }
  return out;
}

export async function listBuilds(ownerKey: string | null): Promise<any[]> {
  if (!ownerKey) throw new HttpError(401, 'Missing owner key');
  const hash = sha256hex(ownerKey);
  const dirs = await gh.listDir('jobs');
  const out: any[] = [];
  for (const d of dirs.filter((x) => x.type === 'dir').slice(0, 40)) {
    try {
      const idx = JSON.parse((await gh.getRaw(`jobs/${d.name}/index.json`)).toString('utf8'));
      if (idx.ownerKeyHash !== hash) continue;
      out.push({ jobId: idx.jobId, createdAt: idx.createdAt, state: idx.state, cleaned: !!idx.cleaned });
    } catch {
      /* skip unreadable entries */
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

export async function deleteBuild(jobId: string, ownerKey: string | null): Promise<{ ok: boolean }> {
  await assertOwner(jobId, ownerKey);
  await gh.deleteActionsSecret(secretNameForJob(jobId));
  await gh.deleteFile(`jobs/${jobId}/payload.enc`);
  await gh.deleteFile(`jobs/${jobId}/status.enc`);
  await gh.deleteFile(`jobs/${jobId}/index.json`);
  return { ok: true };
}

export async function cancelBuild(jobId: string, ownerKey: string | null): Promise<{ ok: boolean; cancelled: boolean }> {
  await assertOwner(jobId, ownerKey);
  const run = await gh.getLatestRunForJob(jobId);
  if (run && run.status !== 'completed') {
    await gh.cancelRun(run.id);
    return { ok: true, cancelled: true };
  }
  return { ok: true, cancelled: false };
}

export interface ArtifactInfo {
  id: number;
  name: string;
  sizeBytes: number;
  kind: 'apk' | 'aab' | 'keystore' | 'debug';
}

export async function listArtifacts(jobId: string, ownerKey: string | null): Promise<ArtifactInfo[]> {
  await assertOwner(jobId, ownerKey);
  const all = await gh.listArtifacts();
  const mapped: ArtifactInfo[] = all
    .filter((a) => a.name.startsWith('w2a-') && a.name.endsWith(`-${jobId}`) && !a.expired)
    .map((a) => ({
      id: a.id,
      name: a.name,
      sizeBytes: a.size_in_bytes,
      kind: a.name.startsWith('w2a-apk-')
        ? ('apk' as const)
        : a.name.startsWith('w2a-aab-')
        ? ('aab' as const)
        : a.name.startsWith('w2a-keystore-')
        ? ('keystore' as const)
        : ('debug' as const),
    }));
  return mapped.sort((a, b) => a.kind.localeCompare(b.kind));
}

/**
 * Download an artifact.
 *  - apk/aab/debug: streams the artifact ZIP through (the browser unzips it).
 *  - keystore: decrypts keystore.enc and returns the credentials JSON
 *    (keystoreBase64, storePassword, keyAlias, keyPassword) to the owner only.
 */
export async function downloadArtifact(jobId: string, ownerKey: string | null, kind: string): Promise<Response> {
  if (!['apk', 'aab', 'keystore', 'debug'].includes(kind)) throw new HttpError(400, 'Unknown artifact kind');
  const arts = await listArtifacts(jobId, ownerKey);
  const art = arts.find((a) => a.kind === kind);
  if (!art) throw new HttpError(404, `No ${kind} artifact available (not produced or expired)`);

  const upstream = await gh.downloadArtifactZip(art.id);
  if (kind !== 'keystore') return upstream;

  const zipBuf = Buffer.from(await upstream.arrayBuffer());
  const enc = readZipEntry(zipBuf, '.enc');
  const key = deriveJobKey(ownerKey as string, jobId);
  const payload = decryptJson<any>(enc, key);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export { GhError };
export type { NormalizedConfig, SigningConfig };
