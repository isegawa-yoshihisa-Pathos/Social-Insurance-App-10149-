import { addMonths } from '../monthly/social-insurance-data.util';

export type PayrollPaymentMonth = 'currentMonth' | 'nextMonth';

/**
 * 給与管理の表示月から報酬データの参照月へのオフセット。
 * 翌月払いの場合は -1（表示月 n+1 → 報酬データ n）。
 */
export function getPayrollPaymentMonthOffset(
  payrollPaymentMonth: PayrollPaymentMonth | undefined,
): number {
  switch (payrollPaymentMonth) {
    case 'nextMonth':
      return -1;
    case 'currentMonth':
    default:
      return 0;
  }
}

/** 給与管理の表示月に対応する報酬データの年月 */
export function getSalaryMonthForPaymentDisplay(
  displayYyyyMm: string,
  payrollPaymentMonth: PayrollPaymentMonth | undefined,
): string {
  return addMonths(displayYyyyMm, getPayrollPaymentMonthOffset(payrollPaymentMonth));
}

/** 報酬データの年月に対応する給与管理の表示月 */
export function getPaymentDisplayMonthForSalary(
  salaryYyyyMm: string,
  payrollPaymentMonth: PayrollPaymentMonth | undefined,
): string {
  return addMonths(salaryYyyyMm, -getPayrollPaymentMonthOffset(payrollPaymentMonth));
}
