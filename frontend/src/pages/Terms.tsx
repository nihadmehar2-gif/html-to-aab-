import { Card, PageHeader } from '../components/ui';

export default function Terms() {
  return (
    <div className="space-y-6">
      <PageHeader title="Terms of service" subtitle="Last updated: November 2025" />
      <div className="space-y-4">
        <Card>
          <h3 className="font-bold text-white mb-2">1. The service</h3>
          <p className="text-sm text-slate-300">
            Web2APK Studio converts web projects (HTML or ZIP) into Android application packages by orchestrating builds on
            GitHub Actions. The service is provided "as is", without warranties of any kind. Build success depends on your
            input files and the free-tier quotas of the underlying platforms.
          </p>
        </Card>
        <Card>
          <h3 className="font-bold text-white mb-2">2. Your responsibilities</h3>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1.5">
            <li>You must own or have the rights to publish every file you upload.</li>
            <li>You are responsible for complying with Google Play policies when distributing AAB files.</li>
            <li>You are responsible for backing up generated keystores and passwords. Lost signing material can make app updates impossible.</li>
            <li>You must not upload malware, or content designed to abuse the build infrastructure (zip bombs, mining scripts, etc.). Abusive uploads are rejected automatically.</li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-bold text-white mb-2">3. Availability & limits</h3>
          <p className="text-sm text-slate-300">
            The free tier depends on GitHub Actions, artifact storage and the hosting platform's function limits. Builds may
            queue, slow down or fail when quotas are exhausted. Artifact retention is limited (default 14 days) — download
            and back up your results promptly.
          </p>
        </Card>
        <Card>
          <h3 className="font-bold text-white mb-2">4. Liability</h3>
          <p className="text-sm text-slate-300">
            To the maximum extent permitted by law, the operators of this deployment are not liable for data loss, lost
            profits, or damages arising from builds, signing keys or artifact expiration.
          </p>
        </Card>
      </div>
    </div>
  );
}
