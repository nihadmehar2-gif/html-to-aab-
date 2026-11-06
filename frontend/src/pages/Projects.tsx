import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, FileJson, FolderKanban, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import { Card, ConfirmDialog, EmptyState, PageHeader } from '../components/ui';
import { deleteProject, loadProjects, saveProject } from '../lib/format';
import type { BuildConfig, ProjectRecord } from '../lib/types';
import { formatDate } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function Projects() {
  const [projects, setProjects] = useState<ProjectRecord[]>(loadProjects());
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  function persist(next: ProjectRecord[]) {
    setProjects(next);
    // keep storage in sync (deleteProject only removes one)
    const keep = new Set(next.map((p) => p.id));
    for (const p of loadProjects()) if (!keep.has(p.id)) deleteProject(p.id);
  }

  function rebuild(p: ProjectRecord) {
    sessionStorage.setItem('w2a.prefill', JSON.stringify(p.config));
    toast('info', 'Configuration loaded — attach your site file to build again.');
    navigate('/new');
  }

  function duplicate(p: ProjectRecord) {
    saveProject({ name: `${p.name} (copy)`, config: { ...p.config, versionCode: p.config.versionCode + 1 } });
    setProjects(loadProjects());
    toast('success', 'Project duplicated');
  }

  function exportJson(p: ProjectRecord) {
    const blob = new Blob([JSON.stringify({ name: p.name, config: p.config, savedAt: p.savedAt, jobs: p.jobs }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.config.packageId || 'project'}.web2apk.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function importJson(f: File | null) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data?.config?.packageId) throw new Error('Invalid project file');
      saveProject({ name: data.name || data.config.appName, config: data.config as BuildConfig });
      setProjects(loadProjects());
      toast('success', 'Project imported');
    } catch (e: any) {
      toast('error', e?.message || 'Import failed');
    }
  }

  const filtered = projects.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.config.packageId.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Saved configurations — rebuild, duplicate, export as JSON."
        actions={
          <>
            <button className="btn-ghost" onClick={() => importRef.current?.click()}>
              <Upload className="w-4 h-4" /> Import
            </button>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importJson(e.target.files?.[0] || null)} />
            <Link to="/new" className="btn-primary">
              <RotateCcw className="w-4 h-4" /> New build
            </Link>
          </>
        }
      />

      {projects.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input className="input !pl-10" placeholder="Search by name or package ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-7 h-7" />}
          title="No saved projects"
          description="Every build automatically saves its configuration here, so you can rebuild the same app with one click."
          action={
            <Link to="/new" className="btn-primary mt-2">
              Create your first project
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="w-7 h-7" />} title="No matches" description={`Nothing found for "${query}".`} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="!p-4 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate">{p.name}</h3>
                  <p className="text-xs text-slate-400 font-mono truncate">{p.config.packageId}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    v{p.config.version} ({p.config.versionCode}) · {p.config.buildType.toUpperCase()} · {formatDate(p.savedAt)}
                  </p>
                  {p.jobs.length > 0 && <p className="text-xs text-slate-500 mt-0.5">{p.jobs.length} build(s): {p.jobs.slice(-3).map((j) => j.slice(0, 8)).join(', ')}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-white/5">
                <button className="btn-ghost !px-3 !py-2 text-xs flex-1" onClick={() => rebuild(p)}>
                  <RotateCcw className="w-3.5 h-3.5" /> Rebuild
                </button>
                <button className="btn-ghost !px-2.5 !py-2" title="Duplicate" onClick={() => duplicate(p)}>
                  <Copy className="w-4 h-4" />
                </button>
                <button className="btn-ghost !px-2.5 !py-2" title="Export JSON" onClick={() => exportJson(p)}>
                  <FileJson className="w-4 h-4" />
                </button>
                <button className="btn-ghost !px-2.5 !py-2 !text-red-300 hover:!bg-red-500/10" title="Delete" onClick={() => setToDelete(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete project?"
        message="This removes the saved configuration from this device. Build history on GitHub stays until artifacts expire."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (toDelete) {
            deleteProject(toDelete);
            setProjects(loadProjects());
            toast('success', 'Project deleted');
          }
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
