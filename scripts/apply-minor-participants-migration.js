import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const normalizeDatabaseUrl = (raw) => {
  let value = String(raw).trim();
  if (value.toLowerCase().startsWith('psql ')) value = value.slice(5).trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1).trim();
  }
  return value;
};

const migrationUrl = new URL('../migrations/20260826_add_guardian_managed_minor_participants.sql', import.meta.url);
const migrationSql = await readFile(migrationUrl, 'utf8');
const client = new pg.Client({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL) });

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(migrationSql);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      checksum VARCHAR(64),
      execution_time_ms INTEGER,
      success BOOLEAN DEFAULT true,
      error_message TEXT
    )
  `);
  await client.query(`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES ('20260826', 'add_guardian_managed_minor_participants', NOW())
    ON CONFLICT (version) DO NOTHING
  `);
  await client.query('COMMIT');

  const { rows } = await client.query(`
    SELECT
      to_regclass('public.minor_participants') IS NOT NULL AS participant_table,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'date_of_birth'
      ) AS profile_dob,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'minor_participant_id'
      ) AS booking_participant
  `);
  const verified = rows[0];
  if (!verified?.participant_table || !verified?.profile_dob || !verified?.booking_participant) {
    throw new Error('Migration verification failed');
  }
  console.log('Minor participant migration applied and verified.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
