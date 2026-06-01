import type { PayrollData } from '../../monthly-document';
import { computeFixedWageFromPayroll } from './fixed-wage';
import {
  estimatePaymentBaseDaysCalendarMonth,
  type MonthPaymentBaseInput,
} from './payment-base-days';

/** 月次から報酬月額・支払基礎日数を組み立てる入力 */
export interface MonthlyRemunerationSource {
  yyyyMm: string;
  hasMonthlyRecord: boolean;
  daysInMonth: number;
  payroll: PayrollData;
  paymentBaseDays?: number;
}

export function toMonthPaymentBaseInput(source: MonthlyRemunerationSource): MonthPaymentBaseInput {
  const paymentBaseDays =
    source.paymentBaseDays ??
    estimatePaymentBaseDaysCalendarMonth(source.hasMonthlyRecord, source.daysInMonth);
  return {
    yyyyMm: source.yyyyMm,
    paymentBaseDays,
    remuneration: computeFixedWageFromPayroll(source.payroll),
  };
}

export function toMonthPaymentBaseInputs(
  sources: readonly MonthlyRemunerationSource[],
): MonthPaymentBaseInput[] {
  return sources.map(toMonthPaymentBaseInput);
}