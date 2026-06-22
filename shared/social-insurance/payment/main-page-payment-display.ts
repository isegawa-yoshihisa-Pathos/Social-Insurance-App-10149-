import {
  getSalaryMonthForPaymentDisplay,
  type PayrollPaymentMonth,
} from '../payroll/payroll-payment-timing';
import {
  getPremiumMonthForPaymentDisplay,
  type SocialInsuranceCollectionMonth,
} from '../premium/resign-premium-collection';

export interface PaymentDisplaySourceMonths {
  displayYyyyMm: string;
  salaryMonth: string;
  premiumMonth: string;
}

/** 給与管理表示月から、参照する月次給与・保険料のデータ月を解決する */
export function resolvePaymentDisplaySourceMonths(
  displayYyyyMm: string,
  payrollPaymentMonth: PayrollPaymentMonth | undefined,
  collectionMonth: SocialInsuranceCollectionMonth | undefined,
): PaymentDisplaySourceMonths {
  return {
    displayYyyyMm,
    salaryMonth: getSalaryMonthForPaymentDisplay(displayYyyyMm, payrollPaymentMonth),
    premiumMonth: getPremiumMonthForPaymentDisplay(displayYyyyMm, collectionMonth),
  };
}
