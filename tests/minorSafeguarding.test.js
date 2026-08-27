/* eslint-env node */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('guardian-managed minor safeguarding', () => {
  it('enforces adult account age on both client and coach registration', () => {
    const register = read('apps/web/src/pages/Register.jsx');
    const users = read('netlify/functions/users.js');
    expect(register).toContain('date_of_birth');
    expect(register).toContain('adultCutoff');
    expect(users).toContain('age < 18');
    expect(users).toContain('parent or legal guardian');
  });

  it('stores children under a guardian account, never as login accounts', () => {
    const migration = read('migrations/20260826_add_guardian_managed_minor_participants.sql');
    const participants = read('netlify/functions/participants.js');
    expect(migration).toContain('guardian_id UUID NOT NULL REFERENCES profiles');
    expect(migration).toContain('guardian_consent_at');
    expect(participants).toContain("age >= 18");
    expect(participants).toContain('auth.userId');
  });

  it('requires participant ownership and guardian supervision for child bookings', () => {
    const bookings = read('netlify/functions/bookings.js');
    expect(bookings).toContain('minor_participant_id');
    expect(bookings).toContain('guardian_id = $2');
    expect(bookings).toContain('guardian_attendance_confirmed !== true');
  });

  it('blocks Stripe onboarding unless the coach is recorded as an adult', () => {
    const stripe = read('netlify/functions/stripe.js');
    expect(stripe).toContain("INTERVAL '18 years'");
    expect(stripe).toContain('Coach age must be recorded and verified');
  });
});
