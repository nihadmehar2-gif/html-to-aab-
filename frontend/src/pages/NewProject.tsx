import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bluetooth,
  Camera,
  Check,
  Eye,
  Fingerprint,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Map,
  MapPin,
  Mic,
  Nfc,
  Rocket,
  Smartphone,
  Vibrate,
  Wifi,
} from 'lucide-react';
import clsx from 'clsx';
import UploadZone from '../components/UploadZone';
import { Card, PageHeader, Toggle, Badge } from '../components/ui';
import { api, fileToBase64 } from '../lib/api';
import { PERMISSION_META, type BuildConfig, type PermissionKey, type RuntimeConfig } from '../lib/types';
import { rememberJobConfig, saveProject, suggestPackageId } from '../lib/format';
import { useToast } from '../context/ToastContext';

const PERM_ICONS: Record<string, any> = {
  globe: Globe,
  wifi: Wifi,
  camera: Camera,
  mic: Mic,
  mappin: MapPin,
  map: Map,
  image: ImageIcon,
  bell: Bell,
  vibrate: Vibrate,
  bluetooth: Bluetooth,
  nfc: Nfc,
  fingerprint: Fingerprint,
};

function defaultConfig(): BuildConfig {
  return {
    appName: '',
    packageId: '',
    version: '1.0.0',
    versionCode: 1,
    description: '',
    website: '',
    orientation: 'default',
    buildType: 'both',
    permissions: ['internet'],
    appearance: {
      iconBase64: null,
      themeColor: '#6D5EF8',
      statusBarColor: '#0B1120',
      navBarColor: '#0B1120',
      splashText: '',
      darkMode: 'system',
    },
    webview: {
      javascript: true,
      domStorage: true,
      fileUpload: true,
      allowMixedContent: false,
      safeBrowsing: true,
      downloads: false,
    },
    android: {
      minSdk: 23,
      fullscreen: false,
      immersive: false,
      edgeToEdge: false,
      wakeLock: false,
      backButton: 'history',
      externalLinks: 'system',
      customUserAgent: '',
      customScheme: '',
      deepLinks: { enabled: false, host: '' },
      debugBuild: false,
    },
    signing: { mode: 'none', storePassword: '', keyAlias: 'web2apk', keyPassword: '', keystoreBase64: null },
  };
}

const STEP_TITLES = ['Upload', 'Basic info', 'Appearance', 'Permissions & Android', 'Signing & build'];

export default function NewProject() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [keystoreFile, setKeystoreFile] = useState<File | null>(null);
  const [config, setConfig] = useState<BuildConfig>(defaultConfig);
  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const prefill = sessionStorage.getItem('w2a.prefill');
    if (prefill) {
      try {
        const parsed = JSON.parse(prefill);
        if (parsed?.packageId) setConfig({ ...defaultConfig(), ...parsed });
      } catch {
        /* ignore malformed prefill */
      }
      sessionStorage.removeItem('w2a.prefill');
    }
  }, []);

  useEffect(() => {
    api
      .config()
      .then(setRuntime)
      .catch(() => toast('error', 'Could not reach the API — is the backend deployed?'));
  }, [toast]);

  const maxMb = runtime?.maxUploadMb ?? 3;
  const set = (patch: Partial<BuildConfig>) => setConfig((c) => ({ ...c, ...patch }));

  function pickAppName(name: string) {
    set({
      appName: name,
      packageId: config.packageId && config.packageId !== suggestPackageId(config.appName) ? config.packageId : suggestPackageId(name),
    });
  }

  async function onIcon(f: File | null) {
    setIconFile(f);
    if (f) {
      try {
        const b64 = await fileToBase64(f);
        setConfig((c) => ({ ...c, appearance: { ...c.appearance, iconBase64: b64 } }));
      } catch {
        toast('error', 'Could not read icon file');
      }
    } else {
      setConfig((c) => ({ ...c, appearance: { ...c.appearance, iconBase64: null } }));
    }
  }

  async function onKeystore(f: File | null) {
    setKeystoreFile(f);
    if (f) {
      const b64 = await fileToBase64(f);
      setConfig((c) => ({ ...c, signing: { ...c.signing, keystoreBase64: b64 } }));
    } else {
      setConfig((c) => ({ ...c, signing: { ...c.signing, keystoreBase64: null } }));
    }
  }

  function togglePermission(key: PermissionKey, value: boolean) {
    if (key === 'internet') return;
    setConfig((c) => ({
      ...c,
      permissions: value ? [...new Set([...c.permissions, key])] : c.permissions.filter((p) => p !== key),
    }));
  }

  function validateStep(s: number): string | null {
    if (s === 0 && !file) return 'Upload an .html or .zip file first';
    if (s === 1) {
      if (!config.appName.trim()) return 'App name is required';
      if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,4}$/.test(config.packageId)) return 'Package ID must look like com.company.app';
    }
    if (s === 4) {
      if (config.signing.mode === 'generate' && config.signing.storePassword.length < 6) return 'Keystore password must be at least 6 characters';
      if (config.signing.mode === 'upload' && (!config.signing.keystoreBase64 || config.signing.storePassword.length < 6)) return 'Upload a .jks keystore and enter its password';
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast('error', err);
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
    window.scrollTo({ top: 0 });
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function startBuild() {
    const err = validateStep(1) || validateStep(4);
    if (err) {
      toast('error', err);
      return;
    }
    if (!file) return;
    setSubmitting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const payload = { fileName: file.name, fileBase64, config };
      const res = await api.createBuild(payload);
      rememberJobConfig(res.jobId, config);
      saveProject({ name: config.appName, config, jobId: res.jobId });
      toast('success', 'Build queued — the GitHub Actions runner is picking it up');
      navigate(`/build/${res.jobId}`);
    } catch (e: any) {
      toast('error', e?.message || 'Failed to queue build');
    } finally {
      setSubmitting(false);
    }
  }

  const stepValid = useMemo(() => !validateStep(step), [step, file, config]);

  return (
    <div className="space-y-6">
      <PageHeader title="New build" subtitle="Upload → configure → build on GitHub Actions → download a real APK/AAB." />

      {/* Stepper */}
      <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto pb-1">
        {STEP_TITLES.map((t, i) => (
          <button
            key={t}
            onClick={() => i < step && setStep(i)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition',
              i === step && 'bg-gradient-to-r from-brand-500 to-accent text-white border-transparent',
              i < step && 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25',
              i > step && 'text-slate-400 border-white/10'
            )}
          >
            {i < step ? <Check className="w-3.5 h-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
            <span className="hidden sm:inline">{t}</span>
          </button>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <UploadZone file={file} onFile={setFile} maxMb={maxMb} />
          <p className="text-xs text-slate-500 mt-4">
            Files are encrypted (AES-256-GCM) before they leave the API and are deleted from storage after the build.
          </p>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <div>
            <label className="label">App name *</label>
            <input className="input" value={config.appName} onChange={(e) => pickAppName(e.target.value)} placeholder="My Awesome App" maxLength={40} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Package ID (applicationId) *</label>
              <input className="input font-mono" value={config.packageId} onChange={(e) => set({ packageId: e.target.value.toLowerCase() })} placeholder="com.web2apk.myapp" />
              <p className="text-xs text-slate-500 mt-1">Changing this later = a different app on Google Play.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Version</label>
                <input className="input" value={config.version} onChange={(e) => set({ version: e.target.value })} placeholder="1.0.0" />
              </div>
              <div>
                <label className="label">Version code</label>
                <input className="input" type="number" min={1} value={config.versionCode} onChange={(e) => set({ versionCode: parseInt(e.target.value || '1', 10) })} />
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Description</label>
              <input className="input" value={config.description} onChange={(e) => set({ description: e.target.value })} placeholder="What does your app do?" maxLength={200} />
            </div>
            <div>
              <label className="label">Website (optional)</label>
              <input className="input" value={config.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://example.com" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Screen orientation</label>
              <select className="input" value={config.orientation} onChange={(e) => set({ orientation: e.target.value as any })}>
                <option value="default">Auto (sensor)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <label className="label">Build output</label>
              <select className="input" value={config.buildType} onChange={(e) => set({ buildType: e.target.value as any })}>
                <option value="both">APK + AAB (recommended)</option>
                <option value="apk">APK only</option>
                <option value="aab">AAB only (Google Play)</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="shrink-0">
              <label className="label">App icon (PNG)</label>
              <label className="cursor-pointer inline-flex items-center gap-2 glass !rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-brand-400/40">
                <ImageIcon className="w-4 h-4 text-brand-300" />
                {iconFile ? 'Replace icon' : 'Choose PNG…'}
                <input type="file" accept="image/png" className="hidden" onChange={(e) => onIcon(e.target.files?.[0] || null)} />
              </label>
              {config.appearance.iconBase64 && (
                <img src={`data:image/png;base64,${config.appearance.iconBase64}`} alt="icon preview" className="w-16 h-16 rounded-xl border border-white/10 mt-3" />
              )}
            </div>
            {!config.appearance.iconBase64 && (
              <div className="text-xs text-slate-500 max-w-xs">
                No icon? A branded default icon (gradient + <span className="font-mono">&lt;/&gt;</span>) is generated automatically. A 1024×1024 PNG looks best.
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { key: 'themeColor' as const, label: 'Theme color' },
              { key: 'statusBarColor' as const, label: 'Status bar color' },
              { key: 'navBarColor' as const, label: 'Navigation bar color' },
            ].map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer p-1"
                    value={config.appearance[f.key]}
                    onChange={(e) => set({ appearance: { ...config.appearance, [f.key]: e.target.value } })}
                  />
                  <input className="input font-mono" value={config.appearance[f.key]} onChange={(e) => set({ appearance: { ...config.appearance, [f.key]: e.target.value } })} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Splash text</label>
              <input className="input" value={config.appearance.splashText} onChange={(e) => set({ appearance: { ...config.appearance, splashText: e.target.value } })} placeholder="Shown on the launch screen" maxLength={30} />
            </div>
            <div>
              <label className="label">Dark mode</label>
              <select className="input" value={config.appearance.darkMode} onChange={(e) => set({ appearance: { ...config.appearance, darkMode: e.target.value as any } })}>
                <option value="system">Follow system</option>
                <option value="light">Always light</option>
                <option value="dark">Always dark</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-white mb-1">Android permissions</h3>
            <p className="text-xs text-slate-400 mb-4">Only the permissions you enable are added to AndroidManifest.xml. Dangerous permissions trigger runtime prompts inside the WebView.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {PERMISSION_META.map((perm) => {
                const Icon = PERM_ICONS[perm.icon] || Globe;
                const checked = config.permissions.includes(perm.key);
                return (
                  <button
                    key={perm.key}
                    onClick={() => togglePermission(perm.key, !checked)}
                    className={clsx(
                      'flex items-start gap-3 p-3 rounded-xl border text-left transition',
                      checked ? 'border-brand-400/40 bg-brand-500/10' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    )}
                  >
                    <Icon className={clsx('w-5 h-5 mt-0.5 shrink-0', checked ? 'text-brand-300' : 'text-slate-500')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                        {perm.label}
                        {perm.key === 'internet' && <Badge tone="neutral">required</Badge>}
                        {perm.dangerous && <Badge tone="warn">runtime</Badge>}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">{perm.description}</span>
                    </span>
                    <span className={clsx('w-5 h-5 rounded-md border flex items-center justify-center shrink-0', checked ? 'bg-brand-500 border-brand-400' : 'border-white/20')}>
                      {checked && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-white mb-4">Android options</h3>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="label">Minimum SDK</label>
                <select className="input" value={config.android.minSdk} onChange={(e) => set({ android: { ...config.android, minSdk: parseInt(e.target.value, 10) } })}>
                  {[22, 23, 24, 26, 28, 30].map((v) => (
                    <option key={v} value={v}>
                      API {v}+ ({v === 22 ? 'Android 5.1' : v === 23 ? 'Android 6.0' : v === 24 ? 'Android 7.0' : v === 26 ? 'Android 8.0' : v === 28 ? 'Android 9' : 'Android 11'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Back button</label>
                <select className="input" value={config.android.backButton} onChange={(e) => set({ android: { ...config.android, backButton: e.target.value as any } })}>
                  <option value="history">WebView history, exit at start</option>
                  <option value="confirm">Ask before exit</option>
                  <option value="exit">Exit immediately</option>
                </select>
              </div>
              <div>
                <label className="label">External links</label>
                <select className="input" value={config.android.externalLinks} onChange={(e) => set({ android: { ...config.android, externalLinks: e.target.value as any } })}>
                  <option value="system">Open in system browser</option>
                  <option value="webview">Keep in app WebView</option>
                </select>
              </div>
              <div>
                <label className="label">Custom user agent suffix</label>
                <input className="input" value={config.android.customUserAgent} onChange={(e) => set({ android: { ...config.android, customUserAgent: e.target.value } })} placeholder="e.g. MyApp/1.0" maxLength={200} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
              {[
                { key: 'fullscreen' as const, label: 'Fullscreen', desc: 'Hide the status bar' },
                { key: 'immersive' as const, label: 'Immersive mode', desc: 'Hide status + nav bars until swiped' },
                { key: 'edgeToEdge' as const, label: 'Edge-to-edge', desc: 'Transparent navigation bar' },
                { key: 'wakeLock' as const, label: 'Keep screen on', desc: 'WAKE_LOCK permission' },
                { key: 'debugBuild' as const, label: 'Debug build', desc: 'Extra debuggable APK + WebView inspection (dev only)' },
              ].map((o) => (
                <label key={o.key} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <span>
                    <span className="block text-sm font-semibold text-slate-200">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.desc}</span>
                  </span>
                  <Toggle checked={(config.android as any)[o.key]} onChange={(v) => set({ android: { ...config.android, [o.key]: v } })} label={o.label} />
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-white mb-4">WebView settings</h3>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {[
                { key: 'domStorage' as const, label: 'DOM storage / localStorage', desc: 'Persist data inside the app' },
                { key: 'fileUpload' as const, label: 'File upload inputs', desc: 'Support <input type="file">' },
                { key: 'safeBrowsing' as const, label: 'Safe Browsing', desc: 'Block dangerous sites (recommended)' },
                { key: 'allowMixedContent' as const, label: 'Mixed content (http)', desc: 'Allow insecure http resources — not recommended' },
                { key: 'downloads' as const, label: 'Download manager', desc: 'Send downloads to Android DownloadManager' },
              ].map((o) => (
                <label key={o.key} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <span>
                    <span className="block text-sm font-semibold text-slate-200">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.desc}</span>
                  </span>
                  <Toggle
                    checked={(config.webview as any)[o.key]}
                    onChange={(v) => set({ webview: { ...config.webview, [o.key]: v } })}
                    label={o.label}
                  />
                </label>
              ))}
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02] opacity-60">
                <span>
                  <span className="block text-sm font-semibold text-slate-200">JavaScript</span>
                  <span className="block text-xs text-slate-500">Always enabled — required for web apps</span>
                </span>
                <Toggle checked disabled onChange={() => undefined} label="JavaScript" />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="label">Custom URL scheme (deep links)</label>
                <input className="input font-mono" value={config.android.customScheme} onChange={(e) => set({ android: { ...config.android, customScheme: e.target.value.toLowerCase() } })} placeholder="myapp" maxLength={20} />
              </div>
              <div>
                <label className="label">Deep link host</label>
                <input className="input font-mono" value={config.android.deepLinks.host} onChange={(e) => set({ android: { ...config.android, deepLinks: { ...config.android.deepLinks, host: e.target.value } } })} placeholder="open" maxLength={100} />
              </div>
            </div>
            {config.android.customScheme && (
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02] mt-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-200">Register scheme in manifest</span>
                  <span className="block text-xs text-slate-500">{config.android.customScheme}://{config.android.deepLinks.host || 'open'} will open your app</span>
                </span>
                <Toggle checked={config.android.deepLinks.enabled} onChange={(v) => set({ android: { ...config.android, deepLinks: { ...config.android.deepLinks, enabled: v } } })} label="Deep links" />
              </label>
            )}
          </Card>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-300" /> Signing
            </h3>
            <div className="space-y-2">
              {[
                { mode: 'none' as const, title: 'No signing (unsigned APK/AAB)', desc: 'Fine for testing — Android will block installation until signed' },
                { mode: 'generate' as const, title: 'Generate a new keystore for me', desc: 'We create a 25-year key, sign the build and hand it back encrypted' },
                { mode: 'upload' as const, title: 'I already have a .jks keystore', desc: 'Upload it now — it is encrypted in transit and at rest' },
                { mode: 'secret' as const, title: 'Use repo secrets (recommended for teams)', desc: 'Set KEYSTORE_BASE64 / KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD in the GitHub repo' },
              ].map((o) => (
                <label
                  key={o.mode}
                  className={clsx(
                    'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition',
                    config.signing.mode === o.mode ? 'border-brand-400/40 bg-brand-500/10' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                  )}
                >
                  <input
                    type="radio"
                    name="signing"
                    className="mt-1 accent-[#6D5EF8]"
                    checked={config.signing.mode === o.mode}
                    onChange={() => set({ signing: { ...config.signing, mode: o.mode } })}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-200">{o.title}</span>
                    <span className="block text-xs text-slate-500">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {(config.signing.mode === 'generate' || config.signing.mode === 'upload') && (
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <div className={config.signing.mode === 'upload' ? 'sm:col-span-2' : ''}>
                  <label className="label">Keystore password *</label>
                  <input type="password" className="input" value={config.signing.storePassword} onChange={(e) => set({ signing: { ...config.signing, storePassword: e.target.value } })} placeholder="min 6 characters" />
                </div>
                <div>
                  <label className="label">Key alias</label>
                  <input className="input font-mono" value={config.signing.keyAlias} onChange={(e) => set({ signing: { ...config.signing, keyAlias: e.target.value } })} />
                </div>
                {config.signing.mode === 'upload' && (
                  <div className="sm:col-span-3">
                    <label className="label">Keystore file (.jks) *</label>
                    <input
                      type="file"
                      accept=".jks,.keystore"
                      className="input file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                      onChange={(e) => onKeystore(e.target.files?.[0] || null)}
                    />
                    {keystoreFile && <p className="text-xs text-emerald-300 mt-1">✓ {keystoreFile.name}</p>}
                  </div>
                )}
              </div>
            )}

            {config.signing.mode === 'generate' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3.5 mt-4 text-sm text-amber-200">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  After the build you can download the generated .jks + passwords <strong>once</strong> (artifact retention:{' '}
                  {runtime?.retentionDays ?? 14} days). <strong>Back them up immediately</strong> — losing them means you can never update this app on Google Play.
                </span>
              </div>
            )}
            {config.signing.mode === 'upload' && (
              <p className="text-xs text-slate-500 mt-3">
                Your keystore is encrypted before storage and deleted from build storage after the build. It is never committed to the repository.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-bold text-white mb-3">Review</h3>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              {[
                ['App', config.appName || '—'],
                ['Package', config.packageId || '—'],
                ['Version', `${config.version} (${config.versionCode})`],
                ['Output', config.buildType.toUpperCase()],
                ['Orientation', config.orientation],
                ['Min SDK', `API ${config.android.minSdk}`],
                ['Permissions', `${config.permissions.length} selected`],
                ['Icon', config.appearance.iconBase64 ? 'Custom PNG' : 'Auto-generated'],
                ['Signing', config.signing.mode],
                ['File', file ? file.name : '—'],
              ].map(([k, v]) => (
                <div key={k} className="py-1.5 border-b border-white/5">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="text-slate-200 font-medium truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <button className="btn-primary w-full !py-3.5 text-base" disabled={submitting || !file} onClick={startBuild}>
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Encrypting & queuing…
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" /> Start build on GitHub Actions
              </>
            )}
          </button>
        </div>
      )}

      {/* Wizard nav */}
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={back} disabled={step === 0 || submitting}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> Step {step + 1} of 5
        </span>
        {step < 4 ? (
          <button className="btn-primary" onClick={next} disabled={submitting}>
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-[92px]" />
        )}
      </div>
    </div>
  );
}
