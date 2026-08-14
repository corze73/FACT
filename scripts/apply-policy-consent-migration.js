import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const migrationUrl = new URL('../migrations/20260814_add_policy_consent_records.sql', import.meta.url);
const migrationSql = await readFile(migrationUrl, 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(migrationSql);
  const { rows } = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE (table_name = 'profiles' AND column_name IN (
      'terms_version', 'terms_accepted_at', 'privacy_version',
      'privacy_acknowledged_at', 'adult_account_confirmed_at'
    )) OR (table_name = 'bookings' AND column_name IN (
      'policy_version', 'cancellation_policy_accepted_at'
    ))
    ORDER BY table_name, column_name
  `);
  if (rows.length !== 7) throw new Error(`Expected 7 policy columns, found ${rows.length}`);
  console.log('Policy consent migration applied and all 7 columns verified.');
} finally {
  await client.end().catch(() => {});
}
