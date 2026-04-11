export const getAdminFeeFromPence = (adminFeeInPence = 300) => Number(adminFeeInPence) / 100;

export const calculatePaymentBreakdown = (servicePrice: number, adminFeeInPence = 300) => {
  const parsedService = Number(servicePrice);
  const safeService = Number.isFinite(parsedService) ? parsedService : 0;

  const adminFeeRaw = Number(getAdminFeeFromPence(adminFeeInPence));
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

export const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP'
}).format(amount);

export const poundsToPence = (pounds: number) => {
  const n = Number(pounds);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

export const penceToPounds = (pence: number) => Number(pence) / 100;
