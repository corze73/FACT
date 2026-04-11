export const generateBookingReference = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomCode = '';
  for (let i = 0; i < 4; i += 1) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `FACT-${year}${month}${day}-${randomCode}`;
};

export const validateBookingReference = (reference: string) => /^FACT-\d{8}-[A-Z0-9]{4}$/.test(reference);

export const getDateFromReference = (reference: string) => {
  if (!validateBookingReference(reference)) return null;

  const datePart = reference.split('-')[1];
  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);

  return new Date(Number(year), Number(month) - 1, Number(day));
};

export const formatBookingReference = (reference?: string | null) => {
  if (!reference) return 'N/A';
  return reference.toUpperCase();
};

export const getSearchableReference = (reference: string) => reference.replace(/-/g, '');
