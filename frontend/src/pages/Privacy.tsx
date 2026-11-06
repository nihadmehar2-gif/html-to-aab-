import { Card, PageHeader } from '../components/ui';

export default function Privacy() {
  return (
    <div className="space-y-6">
      <PageHeader title="Privacy policy" subtitle="Last updated: November 2025" />
      <div className="space-y-4">
        <Card>
          <h3 className="font-bold text-white mb-2">What we store</h3>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1.5">
            <li><strong>Your site files & config</strong> — encrypted with AES-256-GCM on the jobs branch of the build repository; deleted automatically when a build finishes.</li>
            <li><strong>Build status & logs</strong> — encrypted; kept so you can review past builds and troubleshoot failures.</li>
            <li><strong>A device key</strong> — a random ID in your browser's localStorage that identifies your builds. It never leaves your device except in request headers.</li>
            <li><strong>Keystore profiles</strong> you save on the Signing page live only in your browser's localStorage.</li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-bold text-white mb-2">What we never do</h3>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1.5">
            <li>We never store or log your GitHub token in the frontend — it exists only in server environment variables.</li>
            <li>We never commit keystores or passwords to the repository. Uploaded keystores are encrypted, used once, and wiped from build storage.</li>
            <li>We never execute your uploaded website on the app server — it is only unpacked inside the isolated GitHub Actions runner.</li>
            <li>We never sell or share your data. There are no third-party analytics scripts in this app.</li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-bold text-white mb-2">Build artifacts</h3>
          <p className="text-sm text-slate-300">
            APK/AAB artifacts live in GitHub Actions artifact storage for a limited retention period (default 14 days) and
            count against the repository's storage quota. Generated keystores are stored encrypted and are only decryptable
            by the device that created the build. You are responsible for backing up your keystore after downloading it.
          </p>
        </Card>
      </div>
    </div>
  );
}
