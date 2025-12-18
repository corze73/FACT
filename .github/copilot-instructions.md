# Copilot / AI Agent Instructions for FACT (Find A Coach Today)

This document gives focused, actionable guidance so an AI coding agent can be immediately productive in this repo.

## Big picture
- Full‑stack React app (Vite) with Netlify serverless functions (located in `netlify/functions`) that act as the API.
- DB is Neon (Postgres). Row-Level Security (RLS) is used extensively with a session context key `app.current_user_id`.
- Frontend never talks directly to the DB in production — it uses Netlify functions (`/.netlify/functions/*`). In dev it may use `VITE_DATABASE_URL` for limited tooling only.

## Key files & locations (quick reference)
- Frontend API client: `src/api/apiClient.js` (calls `/.netlify/functions/*`; dev base is `http://localhost:8888/.netlify/functions`).
- Direct DB helper (dev-only): `src/api/databaseClient.js` (calls `neon()` only when `import.meta.env.DEV`)
- Serverless functions: `netlify/functions/*.js` (DB access via `netlify/functions/lib/db.js`)
- Local server for testing webhooks / Express routes: `server.js` and `src/api/stripe-routes.js`
- Migrations & RLS SQL: `migrations/*.sql` and `neon-schema.sql`
- Debug & maintenance scripts: `debug-rls-detailed.js`, `test-db-connection.js`, `migrate-booking-references.js`, `launch-readiness-check.sh`

## Environment & secrets
- Dev vs server envs matter:
  - Client/dev DB: `VITE_DATABASE_URL` (used by dev-only scripts and client DB helper)
  - Server/Netlify functions: `DATABASE_URL` (required by `netlify/functions` and many maintenance scripts)
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY` or `STRIPE_PUBLISHABLE_KEY`
- Always validate envs with `node test-db-connection.js` and `netlify/functions/health.js` (the `health` function returns presence/absence of these envs).

## Running & debugging (common commands)
- Install deps: `npm install`
- Local dev (Netlify functions + web via Netlify CLI): `npm run dev` (uses `netlify dev`, dev port 5173; API proxied to `http://localhost:8888/.netlify/functions`)
- Run frontend only (Vite): `npm run dev:vite` or `vite`
- Local server (Express routes / webhook dev): `npm run server` (runs `node server.js`)
- Run both server & netlify dev concurrently: `npm run dev:full`
- Build for production: `npm run build`
- Run ad‑hoc tests / debug scripts:
  - `node test-db-connection.js` — checks DB & tables
  - `node debug-rls-detailed.js` — validates RLS behavior with real DB users
  - `node tests/integration.test.js` — crude integration checks (ad‑hoc script)
  - `./launch-readiness-check.sh` — pre-flight readiness checklist

Note: README references `npm run web` (outdated). Prefer `npm run dev` / `npm run dev:full`.

## DB / RLS conventions (critical)
- The repo relies on Postgres RLS with a single per‑transaction setting: `app.current_user_id`.
- Two established patterns to set context:
  1) Per-session or before multiple queries (used by `src/api/databaseClient.js`):
     await sql.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId])
  2) Single-query transactional context (used in Netlify functions):
     `WITH __ctx AS (SELECT set_config('app.current_user_id', '<UUID>', true)) <your-query>`
  Use the latter if you need to set context without shifting prepared statement placeholders.
- IDs are UUIDs (36-char with dashes). Functions often perform a basic UUID allowlist check before injecting into SQL.
- When adding or changing access rules, check `migrations/*_add_rls_*.sql` and `debug-rls-detailed.js` to validate expected behavior.

## Netlify function patterns
- DB connection helper: `netlify/functions/lib/db.js` — normalizes `DATABASE_URL` and exposes `executeQuery` / `executeQueryOne` helpers.
- Functions respond with consistent JSON structures and include explicit CORS headers (look at `users.js` header block).
- For safe body parsing: functions handle base64 encoded bodies (`event.isBase64Encoded`) — follow that pattern when adding webhooks or large payloads.
- Stripe integration lives in `netlify/functions/stripe.js` — uses `STRIPE_SECRET_KEY` and verifies webhook signatures using `STRIPE_WEBHOOK_SECRET`.

## Development patterns / gotchas
- Production does not allow client-side DB queries — `src/api/databaseClient.js` returns `null` for `sql` in prod. If you need DB access in production, add/modify netlify function instead.
- Keep queries safe: prefer parameterized queries and minimal string interpolation. When absolutely necessary to inject a UUID for `set_config` CTE, ensure it is sanitized (existing helpers check a basic regex).
- When making changes that affect RLS, include a debug script or update `debug-rls-detailed.js` to cover the new policy and run it against a test DB.
- The repo uses ESM (`"type": "module"` in `package.json`): use `import` / `export`, not `require`.

## Examples (copy/paste snippets)
- Set transaction-level context safely (Netlify functions):
  const sql = `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safeId}', true)) SELECT * FROM profiles WHERE id = $1`;
- Set context for dev DB helper (multiple queries):
  await sql.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
- Frontend API example: `apiClient.createBooking({ ... })` calls `/bookings` Netlify function which enforces RLS server-side.

## Tests & CI notes
- There is no Jest/Mocha harness: tests are ad‑hoc node scripts (see `tests/` and top-level scripts like `test-notifications.js`).
- Use `node <script>` to run these; they usually require `DATABASE_URL` or `VITE_DATABASE_URL` to be set.

## When you are changing behaviour
- Update / add a migration in `migrations/` and/or SQL in `neon-schema.sql`.
- Add or update a short debug script (pattern: `debug-rls-detailed.js`) to validate RLS semantics against example user IDs.
- When altering API surface, mirror changes in `netlify/functions/*` and `src/api/apiClient.js` and ensure `netlify.toml` routes still apply.

---
If anything above is ambiguous or you'd like additional examples (e.g., a short test harness for RLS changes, or a checklist to run locally for Stripe webhook tests), tell me what you'd like and I will iterate. ✅
