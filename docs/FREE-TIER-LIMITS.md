# Free-tier limits & quota math

Everything is designed to run on free plans — with honest ceilings:

## GitHub Actions

| Item | Free quota | Notes |
| --- | --- | --- |
| Build minutes (private repo) | **2,000 min/month** | A typical build = 8–15 min → **~130–250 builds/month**. Public repos: **unlimited** Linux minutes. |
| Concurrent jobs (private) | 20 | effectively unlimited for personal use |
| Artifact storage | **500 MB** (private) / larger on public | APK+AAP+keystore ≈ 10–40MB per build → keep `ARTIFACT_RETENTION_DAYS` modest (14) |
| Artifact retention | configurable | default in this app: 14 days |
| API requests (PAT) | 5,000/hour | status polling ≈ 12 requests/min while watching a build |

**Tip:** make the repo **public** → unlimited build minutes; payloads are encrypted anyway.

## Vercel (Hobby)

| Item | Limit | Consequence |
| --- | --- | --- |
| Function request body | ~4.5 MB | set `MAX_UPLOAD_MB=3` (base64 inflates ~33%) |
| Function execution | 10s default (60s max Hobby) | status reads + artifact streaming are short; fine |
| Bandwidth | 100 GB/month | SPA + artifact downloads — plenty for personal use |

## Netlify (Free)

| Item | Limit | Consequence |
| --- | --- | --- |
| Function payload | ~6 MB | set `MAX_UPLOAD_MB=5` |
| Function execution | 10s | same as Vercel |
| Build minutes | 300/month | one-time per deploy (~2 min) |

## GitHub API (payload storage)

| Item | Limit | Notes |
| --- | --- | --- |
| Contents API file size | 100 MB | payloads are ≤ ~7 MB |
| Branch count / file count | no practical limit at this scale | `jobs` branch keeps small encrypted status files as history |

## What happens when a quota runs out?

- **Actions minutes exhausted (private repo)** → new builds queue forever. Fix: make the repo public or wait for the monthly reset.
- **Artifact storage full** → old artifacts become unavailable ("expired" in the download center). Rebuild or delete old artifacts.
- **Rate limit hit** → the API returns a clear error; the app surfaces it. Polling is throttled automatically because status only changes on step transitions.

## Cost control checklist

- [ ] Repo public (unlimited Actions minutes) *or* accept ~200 builds/month private
- [ ] `ARTIFACT_RETENTION_DAYS=14` (or lower) to cap artifact storage
- [ ] `MAX_UPLOAD_MB` matched to platform (3 Vercel / 5 Netlify)
- [ ] Delete the `jobs` branch occasionally to prune encrypted history
