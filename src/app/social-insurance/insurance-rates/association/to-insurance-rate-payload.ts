import type { InsuranceRateSavePayload } from '../../social-insurance-document';
import type { RoundingRule } from '../../premium/rounding';
import { resolveAssociationRates } from './lookup';
import type { AssociationRateTableSet, PrefectureCode } from './types';

export function buildAssociationInsuranceRatePayload(
  prefectureCode: PrefectureCode,
  table: AssociationRateTableSet,
  options?: {
    employerShare?: number;
    roundingRule?: RoundingRule;
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
    employerShare: options?.employerShare ?? 0.5,
    roundingRule: options?.roundingRule ?? 'statutoryHalfYen',
  };
}