import { describe, expect, it } from 'vitest';
import {
  buildAvailableTimeSlots,
  calculateSessionPrice,
  getCoachHourlyRate,
  isCoachDateAvailable,
} from '../apps/web/src/utils/bookingAvailability.js';

describe('booking availability helpers', () => {
  it('uses the same top-level hourly rate shown on coach cards', () => {
    expect(getCoachHourlyRate({ hourly_rate: 20, coach_profile: { hourly_rate: 50 } })).toBe(20);
  });

  it('supports nested coach profile rates', () => {
    expect(getCoachHourlyRate({ coach_profile: { hourly_rate: '35' } })).toBe(35);
  });

  it('calculates the price for the selected duration', () => {
    expect(calculateSessionPrice(20, 30)).toBe(10);
    expect(calculateSessionPrice(20, 90)).toBe(30);
  });

  it('only returns starts that fit inside the recurring period', () => {
    const monday = new Date(2026, 7, 17);
    const slots = buildAvailableTimeSlots({
      date: monday,
      durationMinutes: 60,
      recurringAvailability: [
        { day_of_week: 1, start_time: '10:00', end_time: '12:00', is_active: true },
        { day_of_week: 2, start_time: '09:00', end_time: '17:00', is_active: true },
      ],
    });

    expect(slots).toEqual(['10:00', '10:30', '11:00']);
  });

  it('blocks an explicitly unavailable date', () => {
    const monday = new Date(2026, 7, 17);
    const datedAvailability = [{
      start_date: '2026-08-17',
      end_date: '2026-08-17',
      is_available: false,
    }];

    expect(isCoachDateAvailable(monday, [], datedAvailability)).toBe(false);
    expect(buildAvailableTimeSlots({
      date: monday,
      durationMinutes: 60,
      dateAvailability: datedAvailability,
    })).toEqual([]);
  });

  it('keeps legacy hours when no recurring schedule has been configured', () => {
    const monday = new Date(2026, 7, 17);
    expect(buildAvailableTimeSlots({ date: monday, durationMinutes: 60 })).toContain('09:00');
  });
});
