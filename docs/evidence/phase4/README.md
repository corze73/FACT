# Phase 4 Sentry Evidence Pack

Date: 2026-02-21

Store the following screenshots in this folder:

1. `phase4_sentry_backend_prod_release.png`
   - Project: `fact-backend`
   - Filters: `Environment=production`, `Time=Last 1 hour`
   - Must show: issue title, timestamp, environment, release tag, event id (if visible)

2. `phase4_sentry_frontend_prod_release.png`
   - Project: `fact-frontend`
   - Filters: `Environment=production`, `Time=Last 1 hour`
   - Must show: issue title, timestamp, environment, release tag

3. `phase4_sentry_release_overview.png` (optional)
   - Sentry Releases page
   - Search release id used by current test run
   - Must show release present with associated events

Current run metadata:

- Latest production deploy: `6999f2966c04034b2afa1c73`
- Configured server release (`SENTRY_RELEASE`): `6999f1528418db53c0ada450`
- Configured frontend release (`VITE_SENTRY_RELEASE` at build time): `6999f1528418db53c0ada450`
- Backend proof event trigger time (UTC): `2026-02-21T18:00:25Z`
- Frontend proof event trigger: `https://findacoachtoday.com/?sentry_test=1`

Notes:

- Use Chrome Incognito for capture.
- After adding screenshots, attach them to the PR or keep this folder in-repo as archival proof.
