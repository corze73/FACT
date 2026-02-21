# Phase 4 Report — Stability, Monitoring, and Launch Hardening

Date: 2026-02-21

## A) Error tracking + alerting — FAIL (DSN credential blocker)

Status details:

- Provider integrated: **Sentry** (`@sentry/node`, `@sentry/browser`).
- Runtime log line added: `Sentry enabled: true/false` (no secret output).
- Monitoring trigger endpoint deployed: `/.netlify/functions/monitoring-test?throw=1`.

Evidence:

- Netlify production env list currently has no DSN keys (`SENTRY_DSN`/`SENTRY_DSN_SERVER`/`VITE_SENTRY_DSN`) configured.
- Local runtime also reports DSN absent (`hasServerDsn=false`, `hasClientDsn=false`).
- Trigger call result (production): `GET /.netlify/functions/monitoring-test?throw=1` returns controlled error (`502` with `Phase 4 monitoring test error`).

What is needed to pass:

- Add real DSNs in Netlify production env:
  - `SENTRY_DSN_SERVER` (or `SENTRY_DSN`)
  - `VITE_SENTRY_DSN`
- Re-trigger error and capture dashboard screenshot showing environment + release tags.

## B) Structured logging (server) — PASS

Status details:

- Added structured JSON request logs via shared wrapper.
- Logs include request_id, route, user_id, is_admin, status_code, duration_ms, environment, release.
- Added redaction for token/secret/email/phone-like keys.

Evidence sample:

- {"level":"info","type":"function_request","request_id":"...","route":"users","method":"GET","user_id":null,"is_admin":false,"status_code":429,"duration_ms":0,"environment":"dev","release":"..."}

## C) Health checks — PASS

Status details:

- Deployed to production successfully.
- Production health endpoint now returns required new fields: `status`, `app(build+environment)`, `db`, `stripe`, `runtime`.
- Uptime monitor workflow added at `.github/workflows/health-monitor.yml`.

Evidence:

- Deploy ID: `6999d942b8cb8d065615e084`
- Production health output:

```json
{
  "status": "ok",
  "timestamp": "2026-02-21T16:12:54.307Z",
  "app": {
    "name": "fact",
    "build": "c41b814",
    "environment": "production"
  },
  "db": {
    "configured": true,
    "connected": true
  },
  "stripe": {
    "configured": true
  },
  "env": {
    "database_url": "present",
    "stripe_secret_key": "present",
    "stripe_webhook_secret": "present",
    "publishable_key": "present"
  },
  "runtime": {
    "node": "v24.13.0"
  }
}
```

## D) Rate limiting & abuse protection — PASS

Status details:

- Public list endpoint and auth endpoints are rate limited server-side.
- 429 behavior confirmed under burst testing.

Evidence:

- npm run phase4:rate-limit => total_requests 130, summary {200:100, 429:30}, saw_429 true.
- Auth endpoint burst test against POST /.netlify/functions/users returned 429 responses.

## E) Auth token lifecycle — PASS

Status details:

- Token TTL enforced in verifier (exp check).
- Refresh strategy is explicit re-login (no silent refresh token flow).
- Frontend now clears session and routes to / on 401 responses.

Evidence:

- npm run phase4:auth-expiry => status 401, passes true.

## F) Data safety / backups — PASS (restore test completed)

Status details:

- Added backup runbook with explicit executed restore section and results.
- Completed one end-to-end backup and restore test on isolated staging DB (`local-postgresql17-staging-db`).
- Added admin destructive-action audit table and indexes.

Evidence:

- Backup artifact: `backups/fact-20260221-162307.dump`
- Restore manifest: `backups/fact-20260221-162307.list`
- Restore timestamp UTC: `2026-02-21T16:23:09.647Z`
- Integrity results on restored DB:
  - `orphan_users = 0`
  - `orphan_profiles = 0`
  - `coach_count = 1`
  - sample profile fetch returned valid JSON row
- Full procedure and outputs recorded in `PHASE_4_BACKUP_RUNBOOK.md`.

## G) Deployment hardening — PASS

Status details:

- Expanded env validation for local and CI.
- Updated .env.example to include monitoring and build metadata vars.
- Added deploy hardening checklist.
- Added CI workflow to run check-env in CI mode.

Evidence:

- npm run check-env passed with full var set.
- npm run check-env:ci passed with CI-mode var set.

## H) Security headers + CSP sanity — PASS

Status details:

- Confirmed required security headers present.
- CSP includes frame-ancestors 'none'.

Evidence:

- `npm run phase4:headers` against <https://findacoachtoday.com> returned:
  - strict-transport-security
  - x-content-type-options
  - referrer-policy
  - content-security-policy
  - x-frame-options

## New/Updated Assets

- Monitoring + logs
  - netlify/functions/lib/observability.js
  - src/lib/monitoring.js
  - netlify/functions/monitoring-test.js
- Function hardening
  - netlify/functions/health.js
  - netlify/functions/users.js
  - netlify/functions/bookings.js
  - netlify/functions/messages.js
  - netlify/functions/stripe.js
  - netlify/functions/account-deletion-requests.js
- Audit / migrations
  - migrations/20260221_add_admin_action_logs.sql
- Env + CI + runbooks
  - .env.example
  - check-env.js
  - .github/workflows/env-validation.yml
  - .github/workflows/health-monitor.yml
  - PHASE_4_BACKUP_RUNBOOK.md
  - PHASE_4_DEPLOY_CHECKLIST.md
- Verification scripts
  - scripts/phase4-health-check.mjs
  - scripts/phase4-rate-limit-test.mjs
  - scripts/phase4-auth-expiry-test.mjs
  - scripts/phase4-security-headers.mjs

## Stop Condition

Current state: NOT MET.

Remaining blocker:

1) **A only** — Configure real Sentry DSNs and attach dashboard screenshot showing captured event with `environment` + `release` tags.
