import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle, Mail } from 'lucide-react';
import clsx from 'clsx';
import { Card, PageHeader } from '../components/ui';

const TOPICS = [
  {
    title: 'How the conversion actually works',
    body: 'Your HTML/ZIP is encrypted in your browser session, stored encrypted on the jobs branch, and a GitHub Actions workflow checks it out on a real Linux runner. There, a genuine Capacitor + Gradle Android project is generated, compiled, signed and uploaded as artifacts. Nothing is faked in the browser — the progress screen mirrors the actual workflow run.',
  },
  {
    title: 'Which files should I upload?',
    body: 'Either a single index.html (all CSS/JS inline or via CDN) or a .zip containing your site with index.html at its root (or inside one top-level folder). Maximum size depends on your hosting plan (see the limit shown in the upload step). Relative paths between your files work — absolute file paths do not.',
  },
  {
    title: 'Why is my upload limited to a few MB?',
    body: 'Serverless functions (Vercel/Netlify free tier) cap request body size (~4.5–6MB). Keep heavy assets on a CDN and reference them by URL. The APK itself can still contain your site uncompressed.',
  },
  {
    title: 'What is the difference between APK and AAB?',
    body: 'APK installs directly on any Android device (enable "Install unknown apps"). AAB is the Google Play upload format — Play converts it into device-optimized APKs. Choose "both" and you always have the right one.',
  },
  {
    title: 'A build failed — what now?',
    body: 'Open the build detail page: the failing step and live log show the real error. Common causes: ZIP without index.html, huge assets, invalid package ID, or a wrong keystore password. Fix the cause and hit Rebuild. Your original config is saved in Projects.',
  },
  {
    title: 'Are my tokens and passwords safe?',
    body: 'The GitHub token lives only in server environment variables — it is never sent to the browser. Build payloads and status are AES-256-GCM encrypted; the key travels through GitHub Actions secrets and is deleted after each build. Keystores are wiped from the runner and build storage after signing.',
  },
  {
    title: 'Install & Chromebook notes',
    body: 'The app itself is installable (PWA) on Android and Chromebook from your browser menu ("Add to Home screen / Install app"). Built APKs install on Android phones, tablets and Chromebooks (Google Play on Chrome OS supports sideloading via developer mode).',
  },
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-6">
      <PageHeader title="Help & documentation" subtitle="Everything about building real Android apps from web projects." />

      <div className="space-y-2">
        {TOPICS.map((t, i) => (
          <Card key={t.title} className="!p-0 overflow-hidden">
            <button className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left" onClick={() => setOpen(open === i ? null : i)}>
              <span className="font-semibold text-white text-sm">{t.title}</span>
              <ChevronDown className={clsx('w-4 h-4 text-slate-400 transition-transform', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="px-5 pb-5 text-sm text-slate-300 leading-relaxed">{t.body}</p>}
          </Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/faq">
          <Card hover className="flex items-center gap-4 !p-4">
            <HelpCircle className="w-6 h-6 text-brand-300" />
            <div>
              <div className="font-semibold text-white text-sm">FAQ</div>
              <div className="text-xs text-slate-400">Short answers to common questions</div>
            </div>
          </Card>
        </Link>
        <Card className="flex items-center gap-4 !p-4">
          <Mail className="w-6 h-6 text-emerald-300" />
          <div>
            <div className="font-semibold text-white text-sm">Contact & error reports</div>
            <div className="text-xs text-slate-400">support@web2apk.example — include the job ID shown on the build page</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
