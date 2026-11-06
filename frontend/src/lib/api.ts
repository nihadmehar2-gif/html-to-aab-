import { unzipSync, strFromU8 } from 'fflate';
import type { ArtifactInfo, BuildConfig, JobStatus, JobSummary, RuntimeConfig } from './types';

const OWNER_KEY_STORAGE = 'w2a.ownerKey';

export function getOwnerKey(): string {
  let key = localStorage.getItem(OWNER_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID ? crypto.randomUUID() : `ok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(OWNER_KEY_STORAGE, key);
  }
  return key;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-owner-key': getOwnerKey(),
      ...(init.headers || {}),
    },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface CreateBuildPayload {
  fileName: string;
  fileBase64: string;
  config: BuildConfig;
}

export const api = {
  config(): Promise<RuntimeConfig> {
    return request<RuntimeConfig>('/config');
  },

  createBuild(payload: CreateBuildPayload): Promise<{ jobId: string; state: string }> {
    return request('/builds', { method: 'POST', body: JSON.stringify(payload) });
  },

  getStatus(jobId: string, includeLogs = false): Promise<JobStatus> {
    return request(`/builds?jobId=${encodeURIComponent(jobId)}${includeLogs ? '&logs=1' : ''}`);
  },

  listBuilds(): Promise<{ builds: JobSummary[] }> {
    return request('/builds');
  },

  deleteBuild(jobId: string): Promise<{ ok: boolean }> {
    return request(`/builds?jobId=${encodeURIComponent(jobId)}`, { method: 'DELETE' });
  },

  cancelBuild(jobId: string): Promise<{ ok: boolean; cancelled: boolean }> {
    return request(`/builds?jobId=${encodeURIComponent(jobId)}&cancel=1`, { method: 'DELETE' });
  },

  listArtifacts(jobId: string): Promise<{ artifacts: ArtifactInfo[] }> {
    return request(`/artifacts?jobId=${encodeURIComponent(jobId)}&list=1`);
  },

  /** Fetch an artifact zip, unzip it in the browser and return the inner file(s). */
  async downloadArtifact(jobId: string, kind: 'apk' | 'aab' | 'debug'): Promise<{ name: string; blob: Blob }[]> {
    const res = await fetch(`/api/artifacts?jobId=${encodeURIComponent(jobId)}&kind=${kind}`, {
      headers: { 'x-owner-key': getOwnerKey() },
    });
    if (!res.ok) {
      let msg = `Download failed (${res.status})`;
      try {
        msg = (await res.json()).error || msg;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, msg);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const files = unzipSync(buf);
    const out: { name: string; blob: Blob }[] = [];
    for (const name of Object.keys(files)) {
      if (name.endsWith('/')) continue;
      const inner = strFromU8(files[name], true);
      out.push({
        name: name.split('/').pop() || name,
        blob: new Blob([inner], { type: kind === 'aab' ? 'application/octet-stream' : 'application/vnd.android.package-archive' }),
      });
    }
    if (!out.length) throw new ApiError(500, 'Artifact archive was empty');
    return out;
  },

  /** Keystore: server returns decrypted credentials JSON (owner only). */
  async downloadKeystore(jobId: string): Promise<{ keystoreBase64: string; storePassword: string; keyAlias: string; keyPassword: string; packageId: string; notice?: string }> {
    const res = await fetch(`/api/artifacts?jobId=${encodeURIComponent(jobId)}&kind=keystore`, {
      headers: { 'x-owner-key': getOwnerKey() },
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) throw new ApiError(res.status, data?.error || 'Keystore download failed');
    return data;
  },
};

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
