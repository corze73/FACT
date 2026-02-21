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
