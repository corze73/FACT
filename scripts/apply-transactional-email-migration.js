import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const migrationUrl = new URL('../migrations/20260815_add_transactional_email_idempotency.sql', import.meta.url);
const migrationSql = await readFile(migrationUrl, 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(migrationSql);

  const column = await client.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'event_key'
  `);
  const index = await client.query(`
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'email_logs' AND indexname = 'idx_email_logs_event_key_unique'
  `);

  if (column.rowCount !== 1 || index.rowCount !== 1) {
    throw new Error('Transactional email migration verification failed');
  }
  console.log('Transactional email idempotency migration applied and verified.');
} finally {
  await client.end().catch(() => {});
}
