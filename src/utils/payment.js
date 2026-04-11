import { DEFAULT_FIXED_ADMIN_FEE_PENCE } from '@fact/config';
import {
  calculatePaymentBreakdown as calculateSharedPaymentBreakdown,
  formatCurrency,
  getAdminFeeFromPence,
  penceToPounds,
  poundsToPence,
} from '@fact/domain';

const getConfiguredAdminFeePence = () => parseInt(
  import.meta.env.VITE_FIXED_ADMIN_FEE || String(DEFAULT_FIXED_ADMIN_FEE_PENCE),
  10,
);

export const getAdminFee = () => getAdminFeeFromPence(getConfiguredAdminFeePence());

export const calculatePaymentBreakdown = (servicePrice) => (
  calculateSharedPaymentBreakdown(servicePrice, getConfiguredAdminFeePence())
);

export { formatCurrency, poundsToPence, penceToPounds };