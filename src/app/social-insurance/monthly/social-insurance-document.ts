import { Timestamp } from '@angular/fire/firestore';
import type { InsuranceRatesInput } from '../premium/premium-calculator';

export interface EmployeeRateByInsurance {
  healthInsurance: number;
  careInsurance: number;
  pensionInsurance: number;
}

export interface RoundingByInsurance {
  healthInsurance: number;
  careInsurance: number;
  pensionInsurance: number;
}

export const DEFAULT_ROUNDING_BY: RoundingByInsurance = {
  healthInsurance: 50,
  careInsurance: 50,
  pensionInsurance: 50,
};

export function normalizeEmployeeRate(
  value: EmployeeRateByInsurance | undefined,
): EmployeeRateByInsurance {
  return {
    healthInsurance: value?.healthInsurance ?? 0,
    careInsurance: value?.careInsurance ?? 0,
    pensionInsurance: value?.pensionInsurance ?? 0,
  };
}

export function normalizeRoundingBy(
  value: RoundingByInsurance | undefined,
): RoundingByInsurance {
  if (value == null) return {...DEFAULT_ROUNDING_BY};
  return {
    healthInsurance: value.healthInsurance,
    careInsurance: value.careInsurance,
    pensionInsurance: value.pensionInsurance,
  };
}

export interface InsuranceRateDocument {
  effectiveFrom: string;
  label?: string;
  rateSource: InsuranceRateSource;
  prefectureCode?: string;
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
  employeeRate: EmployeeRateByInsurance;
  roundingBy: RoundingByInsurance;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type InsuranceRateSavePayload = Omit<
  InsuranceRateDocument,
  'createdAt' | 'updatedAt'
>;

export interface ResolvedInsuranceRate {
  rateId: string;
  effectiveFrom: string;
  label?: string;

  rates: InsuranceRatesInput;
  employeeRate: EmployeeRateByInsurance;
  roundingBy: RoundingByInsurance;
}

export function toResolvedInsuranceRate(
  rateId: string,
  doc: InsuranceRateDocument,
): ResolvedInsuranceRate {
  return {
    rateId,
    effectiveFrom: doc.effectiveFrom,
    label: doc.label,
    rates: {
      healthInsuranceRate: doc.healthInsuranceRate,
      careInsuranceRate: doc.careInsuranceRate,
      pensionInsuranceRate: doc.pensionInsuranceRate,
    },
    employeeRate: doc.employeeRate,
    roundingBy: doc.roundingBy,
  };
}

export type InsuranceRateSource =
  | 'association_table'
  | 'combination_import'
  | 'combination_manual'
  | 'manual'

export type StandardRemunerationSource = 'initial' | 'teiji' | 'zuiji' | 'manual' | 'carried';

export interface StandardRemunerationDocument {
  healthGrade: number;
  pensionGrade: number;
  standardRemuneration: { health: number; pension: number };
  source: StandardRemunerationSource;
  effectiveFrom: string;
  remuneration?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}