import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download as DownloadIcon, FileArchive, Package, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { Badge, Card, EmptyState, PageHeader, Spinner, StateBadge } from '../components/ui';
import { api, saveBlob } from '../lib/api';
import type { ArtifactInfo, JobSummary } from '../lib/types';
import { formatBytes, formatDate } from '../lib/format';
import { useToast } from '../context/ToastContext';

interface Row extends JobSummary {
  artifacts?: ArtifactInfo[];
}

export default function Downloads() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const { builds } = await api.listBuilds();
      const done = builds.filter((b) => b.state === 'success');
      const withArtifacts: Row[] = [];
      for (const b of done.slice(0, 12)) {
        try {
          const { artifacts } = await api.listArtifacts(b.jobId);
          withArtifacts.push({ ...b, artifacts });
        } catch {
          withArtifacts.push(b);
        }
      }
      setRows(withArtifacts);
    } catch (e: any) {
      toast('error', e?.message || 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function grab(jobId: string, kind: 'apk' | 'aab' | 'debug') {
    setBusy(`${jobId}:${kind}`);
    try {
      const files = await api.downloadArtifact(jobId, kind);
      for (const f of files) saveBlob(f.blob, f.name);
      toast('success', `Saved ${files[0]?.name || kind}`);
    } catch (e: any) {
      toast('error', e?.message || 'Download failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Downloads" subtitle="APK, AAB and keystore files from your successful builds." />

      {loading ? (
        <Card className="flex items-center justify-center py-12">
          <Spinner />
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<DownloadIcon className="w-7 h-7" />}
          title="Nothing to download yet"
          description="Successful builds appear here with their APK/AAB artifacts. Artifacts are kept for a limited time — download and back them up."
          action={
            <Link to="/new" className="btn-primary mt-2">
              <Package className="w-4 h-4" /> Create a build
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.jobId} className="!p-4">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <FileArchive className="w-5 h-5 text-brand-300" />
                <span className="font-mono text-sm text-slate-300 font-semibold">{r.jobId.slice(0, 8)}</span>
                <StateBadge state={r.state} />
                {r.artifacts?.some((a) => a.kind === 'keystore') && (
                  <Badge tone="warn">
                    <ShieldCheck className="w-3 h-3" /> keystore available
                  </Badge>
                )}
                <span className="text-xs text-slate-500 ml-auto">{formatDate(r.createdAt)}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {(r.artifacts || []).map((a) => (
                  <button
                    key={a.id}
                    className={clsx(
                      'flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left hover:border-brand-400/40 transition',
                      busy === `${r.jobId}:${a.kind}` && 'opacity-60'
                    )}
                    onClick={() => (a.kind === 'keystore' ? window.open(`/api/artifacts?jobId=${r.jobId}&kind=keystore`, '_blank') : grab(r.jobId, a.kind as any))}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white uppercase">{a.kind}</span>
                      <span className="block text-xs text-slate-400">{formatBytes(a.sizeBytes)}</span>
                    </span>
                    <DownloadIcon className="w-4 h-4 text-brand-300" />
                  </button>
                ))}
                {(!r.artifacts || r.artifacts.length === 0) && (
                  <p className="text-xs text-slate-500 sm:col-span-2">Artifacts expired or not found — rebuild this project to get new files.</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
