import { readFile } from 'node:fs/promises'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const migrationUrl = new URL('../migrations/20260813_add_connect_and_payment_lifecycle.sql', import.meta.url)
const migrationSql = await readFile(migrationUrl, 'utf8')
const client = new pg.Client({ connectionString: databaseUrl })

try {
  await client.connect()
  await client.query('BEGIN')
  await client.query(migrationSql)
  await client.query('COMMIT')
  console.log('Launch payment migration applied successfully.')
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  throw error
} finally {
  await client.end().catch(() => {})
}
