import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge, Card, ConfirmDialog, EmptyState, PageHeader } from '../components/ui';
import { deleteKeystoreProfile, loadKeystoreProfiles, markKeystoreBackedUp, saveKeystoreProfile } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/format';

export default function Signing() {
  const [profiles, setProfiles] = useState(loadKeystoreProfiles());
  const [form, setForm] = useState({ packageId: '', alias: 'web2apk', storePassword: '', keyPassword: '' });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { toast } = useToast();

  function refresh() {
    setProfiles(loadKeystoreProfiles());
  }

  function save() {
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,4}$/.test(form.packageId)) {
      toast('error', 'Package ID must look like com.company.app');
      return;
    }
    if (form.storePassword.length < 6) {
      toast('error', 'Keystore password must be at least 6 characters');
      return;
    }
    saveKeystoreProfile({ ...form, keyPassword: form.keyPassword || form.storePassword });
    refresh();
    setForm({ packageId: '', alias: 'web2apk', storePassword: '', keyPassword: '' });
    toast('success', 'Keystore profile saved locally (passwords never leave this device)');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Signing & Keystore" subtitle="Manage Android signing keys for your apps." />

      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Golden rules of Android signing</p>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-amber-200/90">
            <li>Same package ID <strong>must</strong> always be signed with the same key — Google Play rejects updates signed differently.</li>
            <li>Back up the .jks + passwords in at least two places (password manager + secure cloud).</li>
            <li>Never commit a .jks to a repository — Web2APK encrypts it and deletes it from build storage after every build.</li>
          </ul>
        </div>
      </div>

      <Card>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-brand-300" /> Remember a keystore locally
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Saved only in this browser's localStorage — never uploaded. Use these credentials when building the matching package ID.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Package ID</label>
            <input className="input font-mono" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value.toLowerCase() })} placeholder="com.company.app" />
          </div>
          <div>
            <label className="label">Key alias</label>
            <input className="input font-mono" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
          </div>
          <div>
            <label className="label">Keystore password</label>
            <input type="password" className="input" value={form.storePassword} onChange={(e) => setForm({ ...form, storePassword: e.target.value })} />
          </div>
          <div>
            <label className="label">Key password</label>
            <input type="password" className="input" value={form.keyPassword} onChange={(e) => setForm({ ...form, keyPassword: e.target.value })} placeholder="defaults to keystore password" />
          </div>
        </div>
        <button className="btn-primary mt-4" onClick={save}>
          <KeyRound className="w-4 h-4" /> Save profile
        </button>
      </Card>

      {profiles.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="w-7 h-7" />}
          title="No keystore profiles yet"
          description="When you build with “Generate a new keystore”, save its credentials here so future builds of the same app reuse the same key."
        />
      ) : (
        <div className="space-y-2">
          {profiles.map((p: any) => (
            <Card key={p.id} className="!p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white text-sm font-mono">{p.packageId}</p>
                  <p className="text-xs text-slate-400">
                    alias: {p.alias} · saved {formatDate(p.createdAt)}
                  </p>
                </div>
                {p.backedUp ? (
                  <Badge tone="success">
                    <CheckCircle2 className="w-3 h-3" /> backed up
                  </Badge>
                ) : (
                  <button
                    className="btn-ghost !px-3 !py-2 text-xs"
                    onClick={() => {
                      markKeystoreBackedUp(p.id);
                      refresh();
                      toast('success', 'Marked as backed up — stay safe out there');
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> Mark backed up
                  </button>
                )}
                <button className="btn-ghost !px-2.5 !py-2 !text-red-300 hover:!bg-red-500/10" onClick={() => setConfirmId(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <h3 className="font-bold text-white mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-300" /> Google Play App Signing
        </h3>
        <div className="text-sm text-slate-300 space-y-2">
          <p>
            Google Play uses <strong>Play App Signing</strong>: you upload an AAB signed with your <em>upload key</em>, and Google
            re-signs it with the actual app key it stores for you. Your .jks from Web2APK is the upload key.
          </p>
          <p>
            Lost your upload key? You can request a <strong>reset with Google</strong> (Play Console → Setup → App signing) —
            they verify your identity and register a new upload key. The app signing key itself never leaves Google.
          </p>
          <p className="text-slate-400 text-xs">
            For direct APK distribution (outside Play), the .jks <em>is</em> the signing key — there is no reset, only a new app
            identity. Back it up.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmId !== null}
        title="Remove keystore profile?"
        message="This only removes the locally stored credentials from this browser. It does not delete any key."
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (confirmId) {
            deleteKeystoreProfile(confirmId);
            refresh();
            toast('success', 'Profile removed');
          }
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
