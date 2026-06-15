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
  bonusRelatedRemuneration: number;
}

export function toMonthPaymentBaseInput(
  source: MonthlyRemunerationSource,
  options?: { includeVariable?: boolean },
): MonthPaymentBaseInput {
  const base = options?.includeVariable
    ? (source.payroll.fixedWage ?? source.payroll.basicSalary + source.payroll.fringeBenefits) +
      (source.payroll.variableWage ?? 0)
    : computeFixedWageFromPayroll(source.payroll);
  return {
    yyyyMm: source.yyyyMm,
    paymentBaseDays: source.paymentBaseDays,
    remuneration: base + source.bonusRelatedRemuneration,
  };
}