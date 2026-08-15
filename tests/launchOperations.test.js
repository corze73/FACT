import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('launch operations readiness', () => {
  it('reports database, Stripe and email readiness', () => {
    const health = read('netlify/functions/health.js');
    expect(health).toContain('smtpConfigured');
    expect(health).toContain('db.connected && stripeConfigured && !stripeModeMismatch && smtpConfigured');
  });

  it('fails monitoring when a critical dependency is degraded', () => {
    const monitor = read('.github/workflows/health-monitor.yml');
    expect(monitor).toContain('.status == "ok"');
    expect(monitor).toContain('.db.connected == true');
    expect(monitor).toContain('.email.configured == true');
  });

  it('includes repeatable SMTP and password-reset checks', () => {
    expect(read('scripts/verify-email-readiness.mjs')).toContain('transporter.verify()');
    expect(read('scripts/password-reset-e2e.mjs')).toContain('Reset token was reusable');
  });

  it('verifies that a backup archive can be read and contains critical tables', () => {
    const backup = read('scripts/verify-backup-readiness.mjs');
    expect(backup).toContain("'--schema-only'");
    expect(backup).toContain("'pg_restore'");
    expect(backup).toContain("['profiles', 'users', 'bookings', 'payments', 'messages']");
  });
});
