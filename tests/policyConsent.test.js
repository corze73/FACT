import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('launch policy consent', () => {
  it('uses a fixed, shared policy version', () => {
    const constants = read('apps/web/src/lib/policyConstants.js');
    const terms = read('apps/web/src/pages/Terms.jsx');
    const privacy = read('apps/web/src/pages/PrivacyPolicy.jsx');

    expect(constants).toContain("POLICY_VERSION = '2026-08-26'");
    expect(terms).toContain('POLICY_VERSION');
    expect(privacy).toContain('POLICY_VERSION');
    expect(terms).not.toContain('new Date()');
    expect(privacy).not.toContain('new Date()');
  });

  it('requires adult, terms and privacy confirmations at registration', () => {
    const register = read('apps/web/src/pages/Register.jsx');
    const users = read('netlify/functions/users.js');

    expect(register).toContain('adult_account_confirmed');
    expect(register).toContain('terms_accepted');
    expect(register).toContain('privacy_acknowledged');
    expect(users).toContain('All current policy confirmations are required');
  });

  it('requires and records cancellation policy acceptance for bookings', () => {
    const modal = read('apps/web/src/components/booking/BookingModal.jsx');
    const bookings = read('netlify/functions/bookings.js');

    expect(modal).toContain('cancellation_policy_accepted: true');
    expect(bookings).toContain('Accept the current cancellation and no-show policy before booking');
    expect(bookings).toContain('cancellation_policy_accepted_at');
  });

  it('provides public safeguarding guidance and reporting access', () => {
    const routes = read('apps/web/src/pages/index.jsx');
    const policy = read('apps/web/src/pages/SafeguardingPolicy.jsx');

    expect(routes).toContain('path="/safeguardingpolicy"');
    expect(policy).toContain('call 999');
    expect(policy).toContain('0800 169 1863');
    expect(policy).toContain('SafeguardingReport');
  });

  it('ships additive consent database fields', () => {
    const migration = read('migrations/20260814_add_policy_consent_records.sql');

    expect(migration).toContain('terms_accepted_at');
    expect(migration).toContain('privacy_acknowledged_at');
    expect(migration).toContain('adult_account_confirmed_at');
    expect(migration).toContain('cancellation_policy_accepted_at');
  });
});
