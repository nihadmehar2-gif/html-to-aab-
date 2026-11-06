import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { Card, PageHeader } from '../components/ui';

const FAQS: [string, string][] = [
  ['Is this a real converter or a simulation?', 'Real. Builds run on GitHub Actions runners with JDK 17, the Android SDK and Gradle. The progress, logs and artifacts you see come from the actual workflow run — if the runner fails, the app shows a failure.'],
  ['Do I need a Google Play developer account?', 'Only if you want to publish on Google Play ($25 one-time). APKs built here can be installed directly on any device for free.'],
  ['Can I update my app later?', 'Yes — open Projects → Rebuild, bump the versionCode and version, and sign with the SAME keystore. This is why backing up your keystore matters.'],
  ['Why does the first build take 8–15 minutes?', 'The runner installs Capacitor, generates the Android project, downloads Gradle and compiles twice (APK + AAB). Later builds are similar since runners are ephemeral.'],
  ['Where are my site files stored?', 'Encrypted (AES-256-GCM) on the jobs branch of the build repository, and deleted automatically after the build finishes. Status files stay so you can review past builds.'],
  ['Who can see my builds?', 'Status and logs are encrypted. Only the browser that created a build (via its device key) can decrypt and read them through the API.'],
  ['What Android features are supported?', 'App icon + adaptive icon, splash screen, orientation lock, status/navigation bar colors, immersive/fullscreen modes, 12 permissions, deep links with custom schemes, download manager, custom user agent, dark mode and debug builds.'],
  ['Can the app open external links?', 'By default external http(s) links open in the system browser; you can switch to keeping them in the WebView per build.'],
  ['Does it work on iPhone/iOS?', 'This tool targets Android only. iOS builds require Apple certificates and macOS runners.'],
  ['What are the free-tier limits?', 'GitHub Actions: 2000 build minutes/month on private repos (unlimited for public repos). Artifact storage ~500MB with 14-day retention by default. See Free-tier limits in the docs folder of the repository.'],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-6">
      <PageHeader title="FAQ" subtitle="Quick answers." />
      <div className="space-y-2">
        {FAQS.map(([q, a], i) => (
          <Card key={q} className="!p-0 overflow-hidden">
            <button className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left" onClick={() => setOpen(open === i ? null : i)}>
              <span className="font-semibold text-white text-sm">{q}</span>
              <ChevronDown className={clsx('w-4 h-4 text-slate-400 transition-transform', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="px-5 pb-5 text-sm text-slate-300 leading-relaxed">{a}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
