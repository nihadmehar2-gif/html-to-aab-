# Security & keystore guide

## Threat model

| Asset | Where it lives | Protection |
| --- | --- | --- |
| GitHub token (`GH_TOKEN`) | Serverless env vars only | Never sent to the browser; least-privilege fine-grained PAT scoped to one repo |
| Site payload (HTML/ZIP, config) | `jobs` branch, `payload.enc` | AES-256-GCM; key = HKDF(deviceKey, jobId); deleted after build |
| Build status & logs | `jobs` branch, `status.enc` | AES-256-GCM; readable only via the API with the original device key |
| Per-job payload key | GitHub Actions secret `W2A_KEY_<jobId>` | Sealed-box encrypted at creation; **auto-deleted** when the build finishes |
| Keystores (uploaded or generated) | Encrypted payload → runner memory/disk | Used once, wiped from the runner, never committed; generated keys returned encrypted via artifact |
| APK/AAB artifacts | Actions artifact store | Downloadable only through the API after an ownership check |
| Uploaded websites | GitHub Actions runner | **Never executed on the app server.** Only unpacked (with traversal/bomb defenses) inside the ephemeral runner |

## Why the frontend cannot leak credentials

- There is no token, no password and no keystore in any frontend bundle. `grep -r "github_pat" frontend/` returns nothing by construction.
- The browser generates a random **device key** (`crypto.randomUUID()` in localStorage). All API calls carry it in the `x-owner-key` header; the server compares its SHA-256 hash against the job's `ownerKeyHash`. Another device (or an attacker) cannot read your builds.
- The workflow dispatch is server-side only.

## ZIP safety (defense in depth)

The same checks run twice — first in the API (`api/_lib/zipscan.ts`), then authoritatively on the runner (`build-worker/validate-zip.js` + hardened `extract.js`):

- reject `../` segments, absolute paths, backslashes, `scheme://`
- reject symlinks and special files
- reject >20,000 entries, >200MB uncompressed, per-entry compression ratio > 500×
- require `index.html` at root (or a single top-level folder)
- pure-Node extractor with `path.resolve` prefix assertion on every file

## Keystore lifecycle

### Mode: `generate`
1. Runner creates a 2048-bit RSA key, 10,000-day validity via `keytool` (passwords passed through env vars, never echoed into logs).
2. Gradle signs the release with it.
3. The keystore + passwords are encrypted with your job key and uploaded as `w2a-keystore-<jobId>`.
4. Download center returns the decrypted `.jks` + `credentials.txt` **only to the creating device**.
5. `BACK UP BOTH FILES IMMEDIATELY` — the artifact expires (default 14 days) and the payload is deleted.

### Mode: `upload`
Your `.jks` is encrypted client→server→storage, decrypted on the runner, used, and wiped. It is never committed and never appears in artifacts.

### Mode: `secret` (recommended for repeated builds)
Store repo Actions secrets once:

| Secret | Meaning |
| --- | --- |
| `KEYSTORE_BASE64` | base64 of your .jks |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias |
| `KEY_PASSWORD` | key password (optional, defaults to keystore password) |

Nothing transits the app at all in this mode.

### Golden rules

- **One package ID = one key forever.** Google Play rejects updates signed with a different key.
- Back up: `.jks` + passwords in a password manager AND secure cloud storage.
- Losing the key = losing the ability to update that app (see Play App Signing below).

## Google Play App Signing (how resets work)

When you publish an AAB, Play re-signs with the **app signing key** it holds; your key is the **upload key**.

- Lose the **upload key**? Play Console → Setup → App signing → request **upload key reset**. Google verifies your identity and registers a new upload key. Your users keep updating seamlessly.
- Lose the **app signing key** (only possible if you opted out of Play App Signing)? There is no reset — treat that key as irreplaceable.

## Incident response

| Situation | Action |
| --- | --- |
| GitHub token leaked | Revoke immediately (Settings → Developer settings), create a new scoped one, update hosting env vars, redeploy |
| Keystore password exposed | Anyone with the .jks AND password can sign apps as you — for Play: upload-key reset; for side-loaded apps: treat the identity as burned, ship a new package ID |
| Payload key suspicion | The key auto-deletes post-build; to force-invalidate, delete the `W2A_KEY_*` secret and the `jobs/<jobId>/payload.enc` file |
| Malicious upload report | Delete the job (`DELETE /api/builds?jobId=…`), inspect `jobs/<jobId>/status.enc` via API with the device key |
