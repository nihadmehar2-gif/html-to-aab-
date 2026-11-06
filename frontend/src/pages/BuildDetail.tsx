import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Download as DownloadIcon,
  FileArchive,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Square,
} from 'lucide-react';
import clsx from 'clsx';
import StepProgress from '../components/StepProgress';
import { Badge, Card, ConfirmDialog, PageHeader, Spinner, StateBadge } from '../components/ui';
import { api, saveBlob } from '../lib/api';
import type { ArtifactInfo, JobStatus } from '../lib/types';
import { formatBytes, formatDuration, recallJobConfig } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function BuildDetail() {
  const { jobId = '' } = useParams();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [keystoreNotice, setKeystoreNotice] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const terminal = status && ['success', 'failure', 'cancelled'].includes(status.state);

  const load = useCallback(
    async (withLogs: boolean) => {
      try {
        const s = await api.getStatus(jobId, withLogs);
        setStatus(s);
        if (s.state === 'success') {
          api
            .listArtifacts(jobId)
            .then((r) => setArtifacts(r.artifacts))
            .catch(() => setArtifacts([]));
        }
      } catch (e: any) {
        if (e?.status === 404) setNotFound(true);
        else toast('error', e?.message || 'Failed to load build status');
      }
    },
    [jobId, toast]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    if (terminal) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [terminal, load]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.logs?.length]);

  async function download(kind: 'apk' | 'aab' | 'debug') {
    setDownloading(kind);
    try {
      const files = await api.downloadArtifact(jobId, kind);
      for (const f of files) saveBlob(f.blob, f.name);
      toast('success', `Saved ${files.map((f) => f.name).join(', ')}`);
    } catch (e: any) {
      toast('error', e?.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadKeystore() {
    setDownloading('keystore');
    try {
      const ks = await api.downloadKeystore(jobId);
      const binary = atob(ks.keystoreBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      saveBlob(new Blob([bytes], { type: 'application/octet-stream' }), `${ks.packageId || 'app'}.jks`);
      saveBlob(
        new Blob(
          [
            `Web2APK Studio — keystore credentials\n\nPackage: ${ks.packageId}\nAlias: ${ks.keyAlias}\nKeystore password: ${ks.storePassword}\nKey password: ${ks.keyPassword}\nGenerated: ${new Date().toLocaleString()}\n\n${ks.notice || ''}\n`,
          ],
          { type: 'text/plain' }
        ),
        `${ks.packageId || 'app'}-keystore-credentials.txt`
      );
      setKeystoreNotice(true);
      toast('success', 'Keystore + passwords downloaded — back them up NOW');
    } catch (e: any) {
      toast('error', e?.message || 'Keystore download failed');
    } finally {
      setDownloading(null);
    }
  }

  async function retry() {
    const config = recallJobConfig(jobId);
    if (!config) {
      toast('info', 'Rebuild needs the original config — open Projects and rebuild from there.');
      navigate('/projects');
      return;
    }
    toast('info', 'Queueing a rebuild — re-attach your site file on the next screen.');
    navigate('/new');
  }

  async function cancel() {
    setConfirmCancel(false);
    try {
      await api.cancelBuild(jobId);
      toast('success', 'Cancellation requested');
      load(true);
    } catch (e: any) {
      toast('error', e?.message || 'Could not cancel');
    }
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <PageHeader title="Build not found" />
        <Card>
          <p className="text-slate-300 text-sm">This build does not exist or belongs to another device.</p>
          <Link to="/" className="btn-ghost mt-4 inline-flex">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </Card>
      </div>
    );
  }

  if (!status) {
    return (
      <Card className="flex items-center justify-center py-16">
        <Spinner className="w-6 h-6" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Build ${jobId.slice(0, 8)}`}
        subtitle="Live status from the GitHub Actions runner — never simulated."
        actions={
          <>
            <button className="btn-ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
            </button>
            {!terminal && (
              <button className="btn-ghost !text-red-300 hover:!bg-red-500/10" onClick={() => setConfirmCancel(true)}>
                <Square className="w-4 h-4" /> Cancel
              </button>
            )}
            {terminal && (
              <button className="btn-ghost" onClick={retry}>
                <RotateCcw className="w-4 h-4" /> Rebuild
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={status.state} />
        {status.signed === true && (
          <Badge tone="success">
            <ShieldCheck className="w-3 h-3" /> Signed
          </Badge>
        )}
        {status.signed === false && <Badge tone="warn">Unsigned</Badge>}
        {status.durationSec ? <Badge tone="neutral">{formatDuration(status.durationSec)}</Badge> : null}
        {status.state === 'success' && status.progress === 100 && <Badge tone="success">100%</Badge>}
      </div>

      {status.state === 'failure' && status.error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{status.error}</p>
            <p className="text-xs text-red-300/80 mt-1">
              Open the failing step below. Common fixes: invalid ZIP (no index.html), unsupported web APIs, or Gradle issues — see Help & FAQ.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <StepProgress steps={status.steps} progress={status.progress} currentStep={status.currentStep} />
        </Card>

        <Card className="!p-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="font-bold text-white text-sm">Live log</h3>
            <Badge tone="neutral">{status.logs?.length || 0} lines</Badge>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-slate-300 bg-navy-950/60 max-h-[420px] min-h-[240px]">
            {(status.logs || []).length === 0 ? (
              <p className="text-slate-500">Waiting for the runner to report…</p>
            ) : (
              (status.logs || []).map((line, i) => (
                <div key={i} className={clsx(line.includes('✔') && 'text-emerald-300', line.includes('✖') && 'text-red-300', line.includes('▶') && 'text-brand-300')}>
                  {line}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Download center for this build */}
      {status.state === 'success' && (
        <Card>
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <DownloadIcon className="w-5 h-5 text-brand-300" /> Download center
          </h3>
          {artifacts.length === 0 ? (
            <p className="text-sm text-slate-400">Artifacts are being indexed…</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {artifacts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  {a.kind === 'keystore' ? (
                    <KeyRound className="w-8 h-8 text-amber-300 shrink-0" />
                  ) : (
                    <FileArchive className="w-8 h-8 text-accent shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm uppercase">{a.kind}</p>
                    <p className="text-xs text-slate-400">
                      {formatBytes(a.sizeBytes)} ·{' '}
                      {a.kind === 'keystore' ? 'encrypted .jks + credentials' : 'verified & ready to install'}
                    </p>
                  </div>
                  <button
                    className={clsx('btn-primary !px-3 !py-2 text-xs', downloading === a.kind && 'opacity-60')}
                    onClick={() => (a.kind === 'keystore' ? downloadKeystore() : download(a.kind as any))}
                    disabled={downloading !== null}
                  >
                    {downloading === a.kind ? <Spinner className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-4 flex items-start gap-1.5">
            <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            APK: enable “Install unknown apps” for your browser, then open the file. AAB: upload to Google Play. Artifacts auto-expire — keep your own backup.
          </p>
        </Card>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this build?"
        message="The GitHub Actions run will be cancelled. You can rebuild later from Projects."
        confirmLabel="Cancel build"
        danger
        onConfirm={cancel}
        onCancel={() => setConfirmCancel(false)}
      />
      <ConfirmDialog
        open={keystoreNotice}
        title="Back up your keystore"
        message="Files were saved to your device. Store the .jks and the passwords in a safe place (password manager + cloud). If you lose them, you can never update this app on Google Play."
        confirmLabel="I saved them"
        onConfirm={() => setKeystoreNotice(false)}
        onCancel={() => setKeystoreNotice(false)}
      />
    </div>
  );
}
