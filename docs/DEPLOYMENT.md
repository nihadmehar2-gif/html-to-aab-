# Deployment guide

Deploy Web2APK Studio with **GitHub Actions as the build worker**. Vercel/Netlify
serve the SPA + serverless API; they **cannot** run Gradle themselves — that is
exactly why the pipeline dispatches to GitHub Actions.

---

## 1. Create the GitHub token

1. Go to <https://github.com/settings/personal-access-tokens/new> (fine-grained PAT).
2. **Repository access → Only select repositories** → pick your Web2APK repo.
3. **Permissions**:
   | Permission | Level | Why |
   | --- | --- | --- |
   | Contents | Read and write | push encrypted payloads to the `jobs` branch, run workflow |
   | Actions | Read and write | dispatch workflow, cancel runs, read artifacts |
   | Secrets | Read and write | deliver the per-job payload key as an Actions secret (never readable via API, only by the workflow) |
   | Metadata | Read | default |
4. Generate, copy the token (`github_pat_…`). **You will paste it only into your hosting platform's env vars — never into code.**

> Security tip: a fine-grained PAT scoped to this single repo is least-privilege.
> Rotate it periodically. If a token ever leaks, revoke immediately
> (Settings → Personal access tokens → delete).

## 2. Enable GitHub Actions

- Repo → **Settings → Actions → General** → allow all actions; enable **Workflow permissions = Read and write** if your org defaults differ (the workflow also declares its own `permissions:`).
- Confirm `.github/workflows/android-build.yml` exists on the **default branch**.
- The workflow file must be on the default branch because `workflow_dispatch` resolves workflows from the ref you dispatch (the API always dispatches the default branch).

## 3. Deploy on Vercel (recommended)

1. Push this repository to GitHub.
2. <https://vercel.com/new> → import the repo.
3. Framework preset: **Other** (the included `vercel.json` wires everything).
4. Environment variables (Production + Preview):

   | Key | Value |
   | --- | --- |
   | `GH_TOKEN` | your PAT |
   | `GH_OWNER` | e.g. `nihadmehar2-gif` |
   | `GH_REPO` | e.g. `html-to-aab-` |
   | `JOBS_BRANCH` | `jobs` (default) |
   | `MAX_UPLOAD_MB` | `3` (Hobby request-body limit ≈ 4.5MB) |
   | `ARTIFACT_RETENTION_DAYS` | `14` |
   | `ALLOWED_ORIGIN` | `*` or your domain |

5. Deploy. Open the URL → upload a test site → build.

## 4. Deploy on Netlify (alternative)

1. Netlify → **Add new site → Import from Git**.
2. Build settings come from `netlify.toml` (base `frontend/`, functions `netlify/functions`).
3. Same environment variables as above, but `MAX_UPLOAD_MB=5` (Netlify allows ~6MB bodies).
4. Deploy. Routes `/api/*` map to the functions via redirects.

## 5. First end-to-end test

1. Open the deployed app → **New build**.
2. Upload a minimal `index.html`:
   ```html
   <!doctype html><html><body style="font-family:sans-serif;background:#0B1120;color:#fff;display:grid;place-items:center;height:100vh"><h1>Hello from Android 👋</h1></body></html>
   ```
3. Configure: app name `Hello Test`, package `com.example.hellotest`, build **APK only**, signing **generate**.
4. Start build → watch the 13 steps with live logs.
5. When finished: download the **APK** (install on your phone) and the **keystore** (back it up!).

## 6. Operations

- **Where do secrets live?** Only in hosting env vars + GitHub Actions secrets.
- **How do I rotate the token?** Update `GH_TOKEN` in Vercel/Netlify and redeploy.
- **How do I clear build history?** Delete the `jobs` branch (encrypted status files live there) — old artifacts expire automatically.
- **Scaling up?** Concurrency is unlimited-ish on free public repos; on private repos you share 2000 min/month.
