import type { PayrollData } from '../../monthly-document';
import { computeFixedWageFromPayroll } from './fixed-wage';
import {
  type MonthPaymentBaseInput,
} from './payment-base-days';

export interface MonthlyRemunerationSource {
  yyyyMm: string;
  hasMonthlyRecord: boolean;
  daysInMonth: number;
  payroll: PayrollData;
  paymentBaseDays: number;
}

export function toMonthPaymentBaseInput(source: MonthlyRemunerationSource): MonthPaymentBaseInput {
  const paymentBaseDays = source.paymentBaseDays;
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