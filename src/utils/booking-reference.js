/**
 * Booking Reference System
 * Generates unique, searchable reference codes for bookings
 */

/**
 * Generate a unique booking reference code
 * Format: FACT-YYYYMMDD-XXXX (e.g., FACT-20250924-A7B2)
 */
export const generateBookingReference = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Generate 4-character alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomCode = '';
  for (let i = 0; i < 4; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `FACT-${year}${month}${day}-${randomCode}`;
};

/**
 * Validate booking reference format
 */
export const validateBookingReference = (reference) => {
  const pattern = /^FACT-\d{8}-[A-Z0-9]{4}$/;
  return pattern.test(reference);
};

/**
 * Extract date from booking reference
 */
export const getDateFromReference = (reference) => {
  if (!validateBookingReference(reference)) {
    return null;
  }
  
  const datePart = reference.split('-')[1];
  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);
  
  return new Date(year, month - 1, day);
};

/**
 * Format booking reference for display
 */
export const formatBookingReference = (reference) => {
  if (!reference) return 'N/A';
  return reference.toUpperCase();
};

/**
 * Search-friendly version of reference (removes hyphens)
 */
export const getSearchableReference = (reference) => {
  return reference.replace(/-/g, '');
};