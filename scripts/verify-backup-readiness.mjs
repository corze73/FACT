import 'dotenv/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} failed: ${stderr.trim()}`)));
});

const commandFrom = async (candidates) => {
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try next */ }
  }
  return candidates[candidates.length - 1];
};

const pgDump = await commandFrom([
  '/opt/homebrew/opt/postgresql@17/bin/pg_dump',
  '/opt/homebrew/opt/libpq/bin/pg_dump',
  'pg_dump'
]);
const pgRestore = await commandFrom([
  '/opt/homebrew/opt/postgresql@17/bin/pg_restore',
  '/opt/homebrew/opt/libpq/bin/pg_restore',
  'pg_restore'
]);

const directory = await mkdtemp(join(tmpdir(), 'fact-backup-check-'));
const archive = join(directory, 'schema.backup');
const listing = join(directory, 'restore.list');

try {
  await run(pgDump, [
    '--schema-only', '--format=custom', '--no-owner', '--no-privileges',
    `--file=${archive}`, process.env.DATABASE_URL
  ]);
  await run(pgRestore, [`--list`, `--file=${listing}`, archive]);
  const contents = await readFile(listing, 'utf8');
  const requiredTables = ['profiles', 'users', 'bookings', 'payments', 'messages'];
  const missing = requiredTables.filter((table) => !contents.includes(`TABLE public ${table}`));
  if (missing.length) throw new Error(`Backup archive is missing required tables: ${missing.join(', ')}`);

  console.log(JSON.stringify({
    passed: true,
    checks: ['schema backup created', 'backup archive readable by pg_restore', 'critical tables present'],
    data_exported: false,
    required_tables: requiredTables
  }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
