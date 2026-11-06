# Web2APK Studio

**Convert HTML / ZIP websites into real, installable Android APKs and Google-Play-ready AABs — from your phone or Chromebook.**

No simulation. No fake progress bars. Builds run on **GitHub Actions** runners with JDK 17 + Android SDK + Gradle; the web app mirrors the *actual* workflow run, step by step, with live encrypted logs.

---

## ✨ What it does

| Area | Highlights |
| --- | --- |
| **Dashboard** | Stats, recent builds, quick start, live state badges |
| **Upload** | Drag & drop `.html` / `.zip`, client + server validation, size checks |
| **Configuration** | App name, package ID, version/code, orientation, build type (APK/AAB/both) |
| **Appearance** | Custom PNG icon → adaptive icons, splash screen, theme/status/nav colors, dark mode |
| **Permissions** | 12 selectable permissions (only chosen ones reach the manifest) |
| **Advanced** | minSdk, fullscreen/immersive/edge-to-edge, wake lock, back-button behavior, external links, custom UA, custom scheme + deep links, download manager, safe browsing |
| **Signing** | Generate / upload / repo-secrets / unsigned modes, keystore backup flow |
| **Build screen** | Real 13-step pipeline, live logs, cancel, retry, error surfacing |
| **Download center** | Verified APK/AAB/debug APK + encrypted keystore download |
| **Projects** | Auto-saved configs, rebuild, duplicate, JSON import/export |
| **Extras** | PWA (installable), Chromebook-ready, search, FAQ/Help/Privacy/Terms, toasts, empty states |

## 🏗 Architecture

```
Browser (React + Vite SPA)
   │  1. POST /api/builds  { site file, config }  + x-owner-key header
   ▼
Serverless functions (Vercel / Netlify)  ← GH_TOKEN lives ONLY here
   │  2. Validates & sanitizes config (packageId, permissions, colors…)
   │  3. Scans ZIP for path traversal / zip bombs / symlinks
   │  4. AES-256-GCM encrypts the whole payload (key = HKDF(ownerKey, jobId))
   │  5. Puts payload.enc + index.json on the `jobs` branch
   │  6. Stores the payload key as a GitHub Actions SECRET (never committed)
   │  7. workflow_dispatch → android-build.yml { jobId, secretName }
   ▼
GitHub Actions runner (ubuntu-latest)
   8.  Fetches + decrypts payload            (step 1/13)
   9.  Re-validates ZIP, safe-extracts       (step 2/13)
   10. npm i @capacitor/* → cap add android  (steps 3–4/13)
   11. sharp + @capacitor/assets → icons/splash (step 5/13)
   12. Manifest/permissions/styles patches   (step 6/13)
   13. Keystore provision + Gradle signing   (step 7/13)
   14. gradlew assembleRelease/bundleRelease (steps 8–9/13)
   15. apksigner/jarsigner verify            (step 10/13)
   16. Upload artifacts (w2a-apk|aab|keystore-<jobId>)  (step 11/13)
   17. Encrypted status.enc rewritten after EVERY step   (all steps)
   18. Wipe keystores/payload from runner; API removes payload.enc + secret
   ▼
Browser polls GET /api/builds?jobId=…  →  decrypted real status
Browser GET  /api/artifacts?jobId=…&kind=apk  →  artifact zip, unzipped in-browser
```

**Security model (summary — full version in [docs/SECURITY.md](docs/SECURITY.md)):**

- 🔐 GitHub token: server-side env only, never in frontend code or bundles
- 🔐 Payloads, status and logs: AES-256-GCM encrypted at rest
- 🔐 Per-job key delivered via Actions **secrets**, auto-deleted after the build
- 🔐 Keystores: never committed, wiped from runners, artifacts encrypted
- 🔐 Uploaded sites: **never executed** on the app server — only unpacked on the ephemeral runner
- 🔐 Job isolation: every request carries a device key; you can only read your own builds

## 🚀 Quick start (deploy your own)

1. **Push this repository to GitHub** (you are probably reading it there).
2. **Create a fine-grained PAT** — repository access: *only this repo*; permissions: **Contents: RW**, **Actions: RW**, **Metadata: R**. ([guide](docs/DEPLOYMENT.md#1-create-the-github-token))
3. **Enable Actions** in the repo (Settings → Actions → Allow all).
4. **Deploy to Vercel or Netlify** and set the env vars from [.env.example](.env.example).
5. Open the app → upload an HTML/ZIP → Start build → download your APK. 🎉

Full step-by-step: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## 📦 Repository layout

```
├── frontend/                 React + Vite + TypeScript + Tailwind SPA
│   └── src/
│       ├── pages/            Dashboard, NewProject (5-step wizard), BuildDetail,
│       │                     Downloads, Projects, Signing, Help, FAQ, legal pages
│       ├── components/       Layout (sidebar + bottom nav), UI kit, StepProgress, UploadZone
│       ├── lib/              api client, types, formatting, localStorage stores
│       └── context/          Toast system
├── api/                      Serverless functions (Vercel style, shared core)
│   ├── builds.ts             create / status+logs / list / delete / cancel
│   ├── artifacts.ts          list / stream download / keystore decrypt
│   ├── config.ts             public runtime limits
│   └── _lib/                 core.ts, github.ts, crypto.ts, validate.ts,
│                             zipscan.ts (traversal & bomb defense), zipwriter.ts
├── netlify/functions/        Thin Netlify adapters over the same core
├── build-worker/             Scripts that run on the Actions runner
│   ├── fetch-job.js          decrypt payload
│   ├── validate-zip.js       authoritative zip safety scan
│   ├── extract.js            hardened pure-node extractor
│   ├── create-project.js     Capacitor project + config
│   ├── generate-assets.js    sharp icons/splash + @capacitor/assets
│   ├── apply-android.js      manifest/permissions/styles/MainActivity patches
│   ├── apply-signing.js      keystore + gradle signing config
│   ├── collect-artifacts.js  verify + rename + encrypt keystore
│   └── report.js             encrypted real-status reporter (no fake progress)
├── .github/workflows/
│   └── android-build.yml     the 13-step real build pipeline
├── docs/                     DEPLOYMENT · SECURITY · FREE-TIER-LIMITS
├── vercel.json · netlify.toml · .env.example
```

## 🧪 Local development

```bash
# frontend only (API calls will fail without deployed functions)
npm run dev

# full stack locally
npm i -g vercel && vercel dev        # runs frontend + /api functions together
```

Type-check the API: `npm run typecheck:api`

## ⚠️ Honest limitations

- Upload size is capped by serverless request limits (~3–5MB) — keep heavy assets on CDNs.
- Builds take ~8–15 minutes (real Gradle compiles, not pretend progress).
- Artifacts expire (default 14 days) — download and back up your APK/AAB/keystore.
- The `jobs` branch keeps small encrypted status files as build history.

## 📚 Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub + Vercel + Netlify setup, token creation, first build
- [docs/SECURITY.md](docs/SECURITY.md) — threat model, keystore lifecycle, incident response, Play App Signing
- [docs/FREE-TIER-LIMITS.md](docs/FREE-TIER-LIMITS.md) — Actions minutes, artifact storage, function limits, quota math

## License

MIT
