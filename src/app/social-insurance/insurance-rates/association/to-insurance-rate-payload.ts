import type { EmployeeRateByInsurance, InsuranceRateSavePayload, RoundingByInsurance } from '../../monthly/social-insurance-document';
import { normalizeRoundingBy } from '../../monthly/social-insurance-document';
import { resolveAssociationRates } from './lookup';
import type { AssociationRateTableSet, PrefectureCode } from './types';
import { roundRate } from '../../premium/rounding';

export function buildAssociationInsuranceRatePayload(
  prefectureCode: PrefectureCode,
  table: AssociationRateTableSet,
  options?: {
    employeeRate?: EmployeeRateByInsurance;
    roundingBy?: RoundingByInsurance;
  },
): InsuranceRateSavePayload | null {
  const resolved = resolveAssociationRates(table, prefectureCode);
  if (!resolved) return null;

  return {
    effectiveFrom: resolved.effectiveFrom,
    label: `${resolved.label} ${resolved.prefectureName}`,
    rateSource: 'association_table',
    prefectureCode: resolved.prefectureCode,
    healthInsuranceRate: resolved.healthInsuranceRate,
    careInsuranceRate: resolved.careInsuranceRate,
    pensionInsuranceRate: resolved.pensionInsuranceRate,
    employeeRate: {
      healthInsurance: options?.employeeRate?.healthInsurance ?? roundRate(resolved.healthInsuranceRate / 2),
      careInsurance: options?.employeeRate?.careInsurance ?? roundRate(resolved.careInsuranceRate / 2),
      pensionInsurance: options?.employeeRate?.pensionInsurance ?? roundRate(resolved.pensionInsuranceRate / 2),
    },
    roundingBy: normalizeRoundingBy(options?.roundingBy),
  };
}