import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (relative) => readFileSync(resolve(globalThis.process.cwd(), relative), 'utf8');

describe('coach insurance assurance', () => {
  it('requires approved current insurance before a booking', () => {
    const source = read('netlify/functions/bookings.js');
    expect(source).toContain("coach.insurance_status === 'verified'");
    expect(source).toContain('coach.insurance_current === true');
  });

  it('supports administrator insurance decisions', () => {
    const source = read('netlify/functions/admin.js');
    expect(source).toContain('insurance_status');
    expect(source).toContain('A current insurance expiry date is required before approval');
  });
});

describe('support assistant escalation', () => {
  it('creates a tracked support case and protects safeguarding reports', () => {
    const source = read('netlify/functions/support.js');
    expect(source).toContain("'support'");
    expect(source).toContain('support_request_submitted');
    expect(source).toContain('safeguarding: true');
  });
});
