# Phase 4 Report — Stability, Monitoring, and Launch Hardening

Date: 2026-02-21

## A) Error tracking + alerting — FAIL (implementation complete, runtime config missing)

Status details:
- Implemented Sentry hooks for frontend and Netlify functions.
- Added monitoring test endpoint: /.netlify/functions/monitoring-test?throw=1

Evidence:
- Monitoring test trigger returned 500 with intentional error.
- Local env check shows SENTRY_DSN_SERVER and VITE_SENTRY_DSN are currently not set in runtime .env.

What is needed to pass:
- Configure Netlify env vars SENTRY_DSN_SERVER and VITE_SENTRY_DSN with real DSNs.
- Re-run test error and capture it in Sentry dashboard.

## B) Structured logging (server) — PASS

Status details:
- Added structured JSON request logs via shared wrapper.
- Logs include request_id, route, user_id, is_admin, status_code, duration_ms, environment, release.
- Added redaction for token/secret/email/phone-like keys.

Evidence sample:
- {"level":"info","type":"function_request","request_id":"...","route":"users","method":"GET","user_id":null,"is_admin":false,"status_code":429,"duration_ms":0,"environment":"dev","release":"..."}

## C) Health checks — FAIL (local PASS, production payload still old)

Status details:
- Health endpoint now returns app status, db connectivity (SELECT 1), stripe configured, build/version.
- Added GitHub scheduled uptime workflow every 5 minutes.

Evidence (local):
- npm run phase4:health => status 200, fields include app/db/stripe/runtime.

Evidence (production):
- https://findacoachtoday.com/.netlify/functions/health returns 200 but old payload shape (missing new app/db/stripe structure).

What is needed to pass:
- Deploy current branch so production health endpoint includes new fields.

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

## F) Data safety / backups — FAIL (runbook complete, restore test pending)

Status details:
- Added backup runbook with Neon branching + pg_dump strategy and restore steps.
- Added admin destructive-action audit table and write paths.

Evidence:
- admin_action_logs table and indexes created and verified.
- Runbook file exists with restore process.

What is needed to pass:
- Execute and record one staging restore test from backup artifact/branch restore.

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
- npm run phase4:headers against https://findacoachtoday.com returned:
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

Remaining to reach all PASS:
1) Configure real Sentry DSNs and verify dashboard capture for test error.
2) Deploy current branch so production /health includes new shape.
3) Execute and record one staging restore test from backup.
