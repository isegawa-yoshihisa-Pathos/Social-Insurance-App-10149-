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

/** 平均算定に加える「賞与に係る報酬」（月額1つ）。対象月で異なる場合は最新月を採用。 */
export function resolveBonusRelatedRemunerationForAverage(
  months: readonly Pick<MonthlyRemunerationSource, 'yyyyMm' | 'bonusRelatedRemuneration'>[],
): number {
  if (months.length === 0) return 0;
  const latest = [...months].sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm))[0];
  return latest.bonusRelatedRemuneration ?? 0;
}

export function toMonthPaymentBaseInput(
  source: MonthlyRemunerationSource,
  options?: { includeVariable?: boolean; includeBonusRelatedRemuneration?: boolean },
): MonthPaymentBaseInput {
  const base = options?.includeVariable
    ? (source.payroll.fixedWage ?? source.payroll.basicSalary + source.payroll.fringeBenefits) +
      (source.payroll.variableWage ?? 0)
    : computeFixedWageFromPayroll(source.payroll);
  const includeBonus = options?.includeBonusRelatedRemuneration !== false;
  return {
    yyyyMm: source.yyyyMm,
    paymentBaseDays: source.paymentBaseDays,
    remuneration: base + (includeBonus ? source.bonusRelatedRemuneration : 0),
  };
}