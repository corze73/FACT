# Phase 4 Deployment Hardening Checklist

## Preflight

- [ ] `npm run check-env` passes locally
- [ ] `npm run check-env:ci` passes in CI
- [ ] `npm run phase4:health` returns status 200 and required fields
- [ ] `npm run phase4:headers` confirms required security headers
- [ ] `npm run phase4:auth-expiry` confirms expired tokens return 401
- [ ] `npm run phase4:rate-limit` confirms 429 is emitted under burst

## Monitoring

- [ ] `SENTRY_DSN_SERVER` configured in Netlify
- [ ] `VITE_SENTRY_DSN` configured for frontend
- [ ] Dashboard receives test error from `/.netlify/functions/monitoring-test?throw=1`
- [ ] Health monitor workflow secret `HEALTHCHECK_URL` is set

## Runtime

- [ ] `/health` returns build + environment + db + stripe fields
- [ ] Netlify logs show structured JSON with `request_id`, `route`, `status_code`, `duration_ms`
- [ ] No tokens/emails/phones logged in plaintext

## Data Safety

- [ ] Backup procedure completed and artifact validated
- [ ] Staging restore test completed and documented
- [ ] `admin_action_logs` migration applied
- [ ] Destructive admin actions produce audit entries
