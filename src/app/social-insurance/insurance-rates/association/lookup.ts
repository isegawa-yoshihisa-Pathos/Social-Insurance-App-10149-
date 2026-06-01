import type { AssociationPrefectureRateRow, AssociationRateTableSet, PrefectureCode } from './types';

export interface ResolvedAssociationRates {
  prefectureCode: PrefectureCode;
  prefectureName: string;
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
  effectiveFrom: string;
  label: string;
}

export function resolveAssociationRates(
  table: AssociationRateTableSet,
  prefectureCode: PrefectureCode,
): ResolvedAssociationRates | null {
  const row = table.prefectures.find((p) => p.prefectureCode === prefectureCode);
  if (!row) return null;

  return {
    prefectureCode,
    prefectureName: row.prefectureName,
    healthInsuranceRate: row.healthInsuranceRate,
    careInsuranceRate: table.careInsuranceRate,
    pensionInsuranceRate: table.pensionInsuranceRate,
    effectiveFrom: table.effectiveFrom,
    label: table.label,
  };
}