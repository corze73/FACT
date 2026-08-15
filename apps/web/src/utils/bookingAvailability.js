import { format } from 'date-fns';

const LEGACY_TIME_SLOTS = Array.from({ length: 12 }, (_, index) => {
  const hour = index + 9;
  return `${String(hour).padStart(2, '0')}:00`;
});

export function getCoachHourlyRate(coach) {
  const value = coach?.hourly_rate ?? coach?.coach_profile?.hourly_rate;
  const rate = Number(value);

  return Number.isFinite(rate) && rate >= 0 ? rate : 0;
}

export function calculateSessionPrice(hourlyRate, durationMinutes) {
  const rate = Number(hourlyRate);
  const duration = Number(durationMinutes);

  if (!Number.isFinite(rate) || !Number.isFinite(duration) || rate < 0 || duration <= 0) {
    return 0;
  }

  return Math.round((rate * duration / 60) * 100) / 100;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || '').slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function coversDate(record, dateKey) {
  const start = String(record?.start_date || '').slice(0, 10);
  const end = String(record?.end_date || '').slice(0, 10);
  return start && end && start <= dateKey && dateKey <= end;
}

export function isCoachDateAvailable(date, recurringAvailability = [], dateAvailability = []) {
  if (!date) return false;

  const dateKey = format(date, 'yyyy-MM-dd');
  const dateOverride = dateAvailability.find((record) => coversDate(record, dateKey));

  if (dateOverride && dateOverride.is_available === false) return false;
  if (recurringAvailability.length === 0) return true;

  return recurringAvailability.some((record) => (
    record.is_active !== false && Number(record.day_of_week) === date.getDay()
  ));
}

export function buildAvailableTimeSlots({
  date,
  durationMinutes,
  recurringAvailability = [],
  dateAvailability = [],
}) {
  if (!isCoachDateAvailable(date, recurringAvailability, dateAvailability)) return [];

  if (recurringAvailability.length === 0) return LEGACY_TIME_SLOTS;

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const periods = recurringAvailability.filter((record) => (
    record.is_active !== false && Number(record.day_of_week) === date.getDay()
  ));

  const slots = new Set();
  periods.forEach((period) => {
    const start = timeToMinutes(period.start_time);
    const end = timeToMinutes(period.end_time);
    if (start === null || end === null || end <= start) return;

    for (let minutes = start; minutes + duration <= end; minutes += 30) {
      slots.add(minutesToTime(minutes));
    }
  });

  return [...slots].sort();
}

