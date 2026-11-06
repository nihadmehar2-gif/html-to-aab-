import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Download,
  Globe,
  KeyRound,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import type { JobSummary, RuntimeConfig } from '../lib/types';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, Spinner, StateBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/format';

export default function Dashboard() {
  const [builds, setBuilds] = useState<JobSummary[]>([]);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([api.listBuilds(), api.config()]);
      setBuilds(b.builds);
      setConfig(c);
    } catch (e: any) {
      toast('error', e?.message || 'Failed to load builds');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  const active = builds.filter((b) => b.state === 'queued' || b.state === 'running').length;
  const success = builds.filter((b) => b.state === 'success').length;
  const failed = builds.filter((b) => b.state === 'failure').length;

  const stats = [
    { label: 'Total builds', value: builds.length, icon: Package, tone: 'text-brand-300' },
    { label: 'In progress', value: active, icon: Activity, tone: 'text-accent' },
    { label: 'Successful', value: success, icon: CheckCircle2, tone: 'text-emerald-400' },
    { label: 'Failed', value: failed, icon: XCircle, tone: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Convert any HTML or ZIP website into a real, installable Android app."
        actions={
          <>
            <button className="btn-ghost" onClick={refresh} aria-label="Refresh">
              <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Refresh</span>
            </button>
            <button className="btn-primary" onClick={() => navigate('/new')}>
              <Plus className="w-4 h-4" /> New build
            </button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.tone}`} />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2 tabular-nums">{loading ? '…' : s.value}</div>
          </Card>
        ))}
      </div>

      {/* Quick start */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-transparent to-accent/10 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-brand-300" /> Turn your website into an Android app
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Upload an HTML file or ZIP project, configure app name, icon, permissions and signing — real Gradle builds
              run on GitHub Actions and you download a genuine APK/AAB.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge tone="brand">
                <ShieldCheck className="w-3 h-3" /> Encrypted payloads
              </Badge>
              <Badge tone="brand">
                <Globe className="w-3 h-3" /> PWA & Chromebook ready
              </Badge>
              {config && <Badge tone="brand">{config.capacitorMajor >= 6 ? `Capacitor v${config.capacitorMajor}` : 'Capacitor'}</Badge>}
            </div>
          </div>
          <button className="btn-primary shrink-0" onClick={() => navigate('/new')}>
            <Plus className="w-4 h-4" /> Start building
          </button>
        </div>
      </Card>

      {/* Recent builds */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">Recent builds</h2>
          <Link to="/downloads" className="text-sm text-brand-300 hover:text-brand-200 font-medium flex items-center">
            Downloads <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <Card className="flex items-center justify-center py-10">
            <Spinner />
          </Card>
        ) : builds.length === 0 ? (
          <EmptyState
            icon={<Package className="w-7 h-7" />}
            title="No builds yet"
            description="Your build history will appear here. Start by uploading an HTML file or ZIP project."
            action={
              <button className="btn-primary mt-2" onClick={() => navigate('/new')}>
                <Plus className="w-4 h-4" /> Create your first build
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {builds.slice(0, 8).map((b) => (
              <Link key={b.jobId} to={`/build/${b.jobId}`} className="block">
                <Card hover className="!p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/25 to-accent/25 border border-white/10 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5 text-brand-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm font-mono">{b.jobId.slice(0, 8)}</span>
                        <StateBadge state={b.state} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(b.createdAt)}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                  </div>
                  {(b.state === 'queued' || b.state === 'running') && <ProgressBar value={b.state === 'queued' ? 3 : 45} className="mt-3" />}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/signing">
          <Card hover className="flex items-center gap-4 !p-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">Signing & keystore</div>
              <div className="text-xs text-slate-400">Manage keys, backups and Play App Signing</div>
            </div>
          </Card>
        </Link>
        <Link to="/help">
          <Card hover className="flex items-center gap-4 !p-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">How it works</div>
              <div className="text-xs text-slate-400">Architecture, limits and troubleshooting</div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
