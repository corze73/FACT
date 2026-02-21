# Phase 4 Backup & Restore Runbook (Neon)

## Strategy

FACT uses Neon Postgres. Backup strategy combines:

1. **Neon point-in-time restore / branching** for rapid incident recovery.
2. **Scheduled logical backups (`pg_dump`)** for portable offline recovery.
3. **Audit trail** for destructive admin actions via `admin_action_logs`.

## RPO/RTO Targets

- **Target RPO:** <= 15 minutes
- **Target RTO:** <= 60 minutes for staging restore, <= 2 hours for production cutover

## Daily Backup Procedure (`pg_dump`)

1. Ensure secure environment variables are loaded:
   - `DATABASE_URL`
   - `BACKUP_ENCRYPTION_KEY` (if encrypting artifacts)
2. Run backup:
   - `pg_dump "$DATABASE_URL" --format=custom --file="backups/fact-$(date +%F-%H%M).dump"`
3. Verify artifact:
   - `pg_restore --list backups/<latest>.dump >/dev/null`
4. Store artifact in encrypted object storage with retention policy.

## Neon Branch/Snapshot Recovery

1. In Neon Console, create restore branch from desired timestamp.
2. Run smoke validation against restored branch:
   - `SELECT COUNT(*) FROM profiles;`
   - `SELECT COUNT(*) FROM bookings;`
   - `SELECT COUNT(*) FROM messages;`
3. Update staging `DATABASE_URL` to restored branch and run app health check.
4. If valid, promote/cutover using deployment change window.

## Manual Restore Test (staging acceptable)

1. Restore latest dump into staging DB (or Neon restore branch).
2. Execute:
   - `node scripts/phase4-health-check.mjs`
   - `node test-db-connection.js`
3. Validate admin audit table exists and has recent entries:
   - `SELECT action, actor_user_id, target_user_id, created_at FROM admin_action_logs ORDER BY created_at DESC LIMIT 20;`
4. Record test date, operator, and outcome in release notes.

## Destructive Action Audit

The following actions are recorded in `admin_action_logs`:

- `user_deactivated`
- `user_hard_delete`
- `account_deletion_approved`
- `account_deletion_rejected`

Query template:

```sql
SELECT action, actor_user_id, target_user_id, metadata, created_at
FROM admin_action_logs
ORDER BY created_at DESC
LIMIT 100;
```

## Executed Restore Test (2026-02-21)

Operator: Cory Charles

Reasoning: Neon branch automation credentials were not present in runtime env (`NEON_API_KEY`/`NEON_PROJECT_ID` missing), so an isolated staging restore was executed on local PostgreSQL 17 to verify end-to-end backup/restore integrity.

Steps executed:

1. Installed PostgreSQL 17 client tooling (`pg_dump`/`pg_restore`).
2. Created backup from production `DATABASE_URL`:
    - Artifact: `backups/fact-20260221-162307.dump`
    - Manifest: `backups/fact-20260221-162307.list`
3. Restored into isolated staging DB:
    - Target: `local-postgresql17-staging-db` (`fact_staging_restore`)
4. Ran integrity queries on restored data:
    - orphan users/profiles checks
    - coach count
    - sample profile fetch

Outcome:

```json
{
   "dump_file": "/Users/corycharles/FACT/backups/fact-20260221-162307.dump",
   "dump_list_file": "/Users/corycharles/FACT/backups/fact-20260221-162307.list",
   "restore_timestamp_utc": "2026-02-21T16:23:09.647Z",
   "restore_target": "local-postgresql17-staging-db",
   "integrity": {
      "orphan_users": 0,
      "orphan_profiles": 0,
      "coach_count": 1
   },
   "sample_profile": {
      "id": "f82bdf6d-d167-4450-a8d1-1f784735ee58",
      "full_name": "Perf Temp User",
      "user_type": "client",
      "country": null,
      "city": null
   }
}
```
