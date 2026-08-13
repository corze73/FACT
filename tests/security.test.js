import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateBookingPrice } from '../netlify/functions/lib/bookingPricing.js';
import { verifyGoogleAccessToken } from '../netlify/functions/users.js';

afterEach(() => {
  vi.unstubAllGlobals();
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
