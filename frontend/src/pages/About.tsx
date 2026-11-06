import { Github, Layers, Lock, Smartphone, Zap } from 'lucide-react';
import { Card, PageHeader } from '../components/ui';

export default function About() {
  return (
    <div className="space-y-6">
      <PageHeader title="About Web2APK Studio" subtitle="A real HTML/ZIP → Android APK/AAB conversion platform." />

      <Card>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent flex items-center justify-center text-white font-extrabold text-xl shadow-glow shrink-0">
            &lt;/&gt;
          </div>
          <div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Web2APK Studio wraps your web project in a native Android shell (Capacitor + system WebView), compiles it with
              Gradle on GitHub Actions runners and hands you real, installable APK and Play-ready AAB files — including proper
              signing, icons, splash screens and permissions. It is designed mobile-first and works great on Chromebooks.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { icon: Zap, title: 'Real builds, no theater', text: 'Progress, logs and artifacts come from the actual GitHub Actions run.' },
          { icon: Lock, title: 'Security first', text: 'Encrypted payloads, server-only tokens, per-job secrets, automatic cleanup.' },
          { icon: Layers, title: 'Free-tier native', text: 'Runs on Vercel/Netlify free hosting + GitHub free Actions minutes.' },
          { icon: Smartphone, title: 'Installable app', text: 'PWA manifest — install the studio itself on Android & Chromebook.' },
        ].map((f) => (
          <Card key={f.title} className="!p-4">
            <f.icon className="w-5 h-5 text-brand-300 mb-2" />
            <h3 className="font-bold text-white text-sm">{f.title}</h3>
            <p className="text-xs text-slate-400 mt-1">{f.text}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="font-bold text-white mb-2 flex items-center gap-2">
          <Github className="w-5 h-5" /> Version
        </h3>
        <p className="text-sm text-slate-300">
          Web2APK Studio v1.0.0 — Capacitor 6 · JDK 17 · Gradle (AGP from template) · Android SDK 34. Source code and full
          deployment documentation live in the repository (README.md, docs/SECURITY.md, docs/FREE-TIER-LIMITS.md).
        </p>
      </Card>
    </div>
  );
}
