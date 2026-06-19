import {
  normalizeRoundingBoundaryType,
  normalizeRoundingBy,
  type RoundingBoundaryType,
  type RoundingByInsurance,
} from '../monthly/social-insurance-document';
import { roundPremium } from './rounding';

export interface PremiumPartValues {
  employee: number | null;
  total: number | null;
}

export interface AggregatePremiumRow {
  healthInsurance: PremiumPartValues;
  careInsurance: PremiumPartValues;
  pensionInsurance: PremiumPartValues;
}

export interface EmployerBurdenRoundingSettings {
  roundingBy: RoundingByInsurance;
  roundingBoundaryType: RoundingBoundaryType;
}

export function employerBurdenForInsurancePart(
  rows: readonly PremiumPartValues[],
  roundingBy: number,
  roundingBoundaryType: RoundingBoundaryType,
): number {
  const sumTotal = rows.reduce((sum, row) => sum + (row.total ?? 0), 0);
  const sumEmployee = rows.reduce((sum, row) => sum + (row.employee ?? 0), 0);
  return roundPremium(sumTotal - sumEmployee, roundingBy, roundingBoundaryType);
}

export function aggregateEmployerPremiumBurden(
  rows: readonly AggregatePremiumRow[],
  settings: EmployerBurdenRoundingSettings,
): number {
  if (rows.length === 0) {
    return 0;
  }

  const roundingBy = normalizeRoundingBy(settings.roundingBy);
  const roundingBoundaryType = normalizeRoundingBoundaryType(settings.roundingBoundaryType);

  return (
    employerBurdenForInsurancePart(
      rows.map((row) => row.healthInsurance),
      roundingBy.healthInsurance,
      roundingBoundaryType,
    )
    + employerBurdenForInsurancePart(
      rows.map((row) => row.careInsurance),
      roundingBy.careInsurance,
      roundingBoundaryType,
    )
    + employerBurdenForInsurancePart(
      rows.map((row) => row.pensionInsurance),
      roundingBy.pensionInsurance,
      roundingBoundaryType,
    )
  );
}
