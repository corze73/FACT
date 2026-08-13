export const calculateBookingPrice = ({ hourlyRate, durationMinutes, adminFee = 3 }) => {
  const rate = Number(hourlyRate);
  const duration = Number(durationMinutes);
  const fee = Number(adminFee);

  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid hourly rate');
  if (!Number.isInteger(duration) || duration < 30 || duration > 240) throw new Error('Invalid duration');
  if (!Number.isFinite(fee) || fee < 0) throw new Error('Invalid administration fee');

  const servicePrice = Math.round(rate * (duration / 60) * 100) / 100;
  const totalPrice = Math.round((servicePrice + fee) * 100) / 100;
  return { servicePrice, adminFee: fee, totalPrice };
};
