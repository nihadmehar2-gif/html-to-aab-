import type { BuildConfig, JobSummary } from './types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function elapsedSince(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

export function suggestPackageId(appName: string): string {
  const clean = slugify(appName) || 'app';
  return `com.web2apk.${clean}`;
}

/** localStorage-backed project manager. */
const PROJECTS_KEY = 'w2a.projects';
const JOBCONFIG_KEY = 'w2a.jobconfig';
const KEYSTORES_KEY = 'w2a.keystores';

export function loadProjects(): { id: string; name: string; savedAt: string; config: BuildConfig; jobs: string[] }[] {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveProject(record: { name: string; config: BuildConfig; jobId?: string }): { id: string; name: string; savedAt: string; config: BuildConfig; jobs: string[] } {
  const projects = loadProjects();
  const existing = projects.find((p) => p.config.packageId === record.config.packageId);
  if (existing) {
    existing.name = record.name;
    existing.savedAt = new Date().toISOString();
    existing.config = record.config;
    if (record.jobId && !existing.jobs.includes(record.jobId)) existing.jobs.push(record.jobId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return existing;
  }
  const created = {
    id: crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`,
    name: record.name,
    savedAt: new Date().toISOString(),
    config: record.config,
    jobs: record.jobId ? [record.jobId] : [],
  };
  projects.unshift(created);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  return created;
}

export function deleteProject(id: string): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(loadProjects().filter((p) => p.id !== id)));
}

export function rememberJobConfig(jobId: string, config: BuildConfig): void {
  try {
    const all = JSON.parse(localStorage.getItem(JOBCONFIG_KEY) || '{}');
    all[jobId] = { config, savedAt: new Date().toISOString() };
    // keep last 20
    const keys = Object.keys(all);
    if (keys.length > 20) delete all[keys[0]];
    localStorage.setItem(JOBCONFIG_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function recallJobConfig(jobId: string): BuildConfig | null {
  try {
    const all = JSON.parse(localStorage.getItem(JOBCONFIG_KEY) || '{}');
    return all[jobId]?.config || null;
  } catch {
    return null;
  }
}

export function loadKeystoreProfiles() {
  try {
    return JSON.parse(localStorage.getItem(KEYSTORES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveKeystoreProfile(profile: { packageId: string; alias: string; storePassword: string; keyPassword: string; backedUp?: boolean }): void {
  const profiles = loadKeystoreProfiles();
  const existing = profiles.findIndex((p: any) => p.packageId === profile.packageId);
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`,
    createdAt: new Date().toISOString(),
    backedUp: false,
    ...profile,
  };
  if (existing >= 0) profiles[existing] = { ...profiles[existing], ...record, id: profiles[existing].id, createdAt: profiles[existing].createdAt };
  else profiles.unshift(record);
  localStorage.setItem(KEYSTORES_KEY, JSON.stringify(profiles));
}

export function markKeystoreBackedUp(id: string): void {
  const profiles = loadKeystoreProfiles();
  const idx = profiles.findIndex((p: any) => p.id === id);
  if (idx >= 0) {
    profiles[idx].backedUp = true;
    localStorage.setItem(KEYSTORES_KEY, JSON.stringify(profiles));
  }
}

export function deleteKeystoreProfile(id: string): void {
  localStorage.setItem(KEYSTORES_KEY, JSON.stringify(loadKeystoreProfiles().filter((p: any) => p.id !== id)));
}

export function stateLabel(state: JobSummary['state']): string {
  switch (state) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Building';
    case 'success':
      return 'Success';
    case 'failure':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return state;
  }
}
