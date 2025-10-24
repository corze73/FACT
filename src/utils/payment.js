/**
 * Payment utility functions for calculating fees and amounts
 */

/**
 * Get the fixed admin fee from environment variables
 * @returns {number} Admin fee in pounds (e.g., 3.00)
 */
export const getAdminFee = () => {
  const adminFeeInPence = parseInt(import.meta.env.VITE_FIXED_ADMIN_FEE || '300');
  return adminFeeInPence / 100; // Convert pence to pounds
};

/**
 * Calculate payment breakdown for a booking
 * @param {number} servicePrice - The coach's service price in pounds
 * @returns {object} Payment breakdown with all amounts
 */
export const calculatePaymentBreakdown = (servicePrice) => {
  // Coerce to a safe number to avoid "toFixed is not a function" on strings/null
  const parsedService = Number(servicePrice);
  const safeService = Number.isFinite(parsedService) ? parsedService : 0;

  const adminFeeRaw = Number(getAdminFee());
  const adminFee = Number.isFinite(adminFeeRaw) ? adminFeeRaw : 0;

  const coachAmount = safeService;
  const totalAmount = safeService + adminFee;

  return {
    servicePrice: Number(coachAmount.toFixed(2)),
    adminFee: Number(adminFee.toFixed(2)),
    coachAmount: Number(coachAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2))
  };
};

/**
 * Format currency for display (GBP)
 * @param {number} amount - Amount in pounds
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
};

/**
 * Convert pounds to pence for Stripe (Stripe uses smallest currency unit)
 * @param {number} pounds - Amount in pounds
 * @returns {number} Amount in pence
 */
export const poundsToPence = (pounds) => {
  const n = Number(pounds);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

/**
 * Convert pence to pounds
 * @param {number} pence - Amount in pence
 * @returns {number} Amount in pounds
 */
export const penceToPounds = (pence) => {
  return pence / 100;
};