import type { MonthlyListRow } from './monthly-list-columns';
import {
  aggregateMonthlyEmployerPremium,
  type EmployerBurdenRoundingSettings,
  type MonthlyPremiumInput,
} from '../../../../shared/payment-summary.util';

export function toMonthlyPremiumInput(row: MonthlyListRow): MonthlyPremiumInput {
  return {
    healthInsuranceEmployee: row.healthInsuranceEmployee,
    careInsuranceEmployee: row.careInsuranceEmployee,
    pensionInsuranceEmployee: row.pensionInsuranceEmployee,
    healthInsuranceTotal: row.healthInsuranceTotal,
    careInsuranceTotal: row.careInsuranceTotal,
    pensionInsuranceTotal: row.pensionInsuranceTotal,
  };
}

export function monthlyListEmployerBurden(
  rows: readonly MonthlyListRow[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return aggregateMonthlyEmployerPremium(rows.map((row) => toMonthlyPremiumInput(row)), settings);
}

export type { EmployerBurdenRoundingSettings };
