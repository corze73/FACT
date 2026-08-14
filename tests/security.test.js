import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateBookingPrice } from '../netlify/functions/lib/bookingPricing.js';
import { getPasswordResetBaseUrl, verifyGoogleAccessToken } from '../netlify/functions/users.js';
import { signAuthToken, verifyAuthToken } from '../netlify/functions/lib/auth.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('application authentication tokens', () => {
  it('accepts only FACT authenticated-audience tokens with UUID subjects', () => {
    vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-for-tests');
    const token = signAuthToken({ sub: '693edb55-7c22-4e4d-a828-4808de33239e' });

    expect(verifyAuthToken(token)).toMatchObject({
      sub: '693edb55-7c22-4e4d-a828-4808de33239e',
      aud: 'authenticated',
    });
  });

  it('rejects tokens for another audience or an invalid subject', () => {
    vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-for-tests');
    expect(verifyAuthToken(signAuthToken({ sub: 'not-a-user' }))).toBeNull();
    expect(verifyAuthToken(signAuthToken({
      sub: '693edb55-7c22-4e4d-a828-4808de33239e',
      aud: 'another-service',
    }))).toBeNull();
  });

  it('can issue a replacement token strictly after a session revocation', () => {
    vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-for-tests');
    const token = signAuthToken(
      { sub: '693edb55-7c22-4e4d-a828-4808de33239e' },
      { issuedAtSeconds: 1_786_665_601 }
    );

    expect(verifyAuthToken(token)).toMatchObject({ iat: 1_786_665_601 });
  });
});

describe('server-authoritative booking pricing', () => {
  it('calculates price from the stored hourly rate and duration', () => {
    expect(calculateBookingPrice({ hourlyRate: 50, durationMinutes: 90 })).toEqual({
      servicePrice: 75,
      adminFee: 3,
      totalPrice: 78,
    });
  });

  it('rejects invalid rates and durations', () => {
    expect(() => calculateBookingPrice({ hourlyRate: 0, durationMinutes: 60 })).toThrow('Invalid hourly rate');
    expect(() => calculateBookingPrice({ hourlyRate: 50, durationMinutes: 5 })).toThrow('Invalid duration');
  });
});

describe('Google identity verification', () => {
  it('uses the provider response instead of caller-supplied identity data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: 'google-user', email: 'verified@example.com', email_verified: true }),
    }));

    await expect(verifyGoogleAccessToken('valid-token')).resolves.toMatchObject({
      email: 'verified@example.com',
      email_verified: true,
    });
  });

  it('rejects unverified or expired identities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(verifyGoogleAccessToken('expired-token')).rejects.toThrow('invalid or expired');
  });
});

describe('password reset link origin', () => {
  it('uses the configured HTTPS application origin', () => {
    vi.stubEnv('APP_BASE_URL', 'https://findacoachtoday.com/path-that-must-not-leak');
    expect(getPasswordResetBaseUrl()).toBe('https://findacoachtoday.com');
  });

  it('falls back to FACT for invalid or insecure configuration', () => {
    vi.stubEnv('APP_BASE_URL', 'https://attacker.example@');
    expect(getPasswordResetBaseUrl()).toBe('https://findacoachtoday.com');
    vi.stubEnv('APP_BASE_URL', 'http://attacker.example');
    expect(getPasswordResetBaseUrl()).toBe('https://findacoachtoday.com');
  });
});
