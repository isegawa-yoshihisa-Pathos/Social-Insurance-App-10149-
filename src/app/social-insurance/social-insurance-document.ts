import { Timestamp } from '@angular/fire/firestore';
import type { RoundingRule } from '../social-insurance/premium/rounding';
import type { InsuranceRatesInput } from '../social-insurance/premium/premium-calculator';

export interface InsuranceRateDocument {
  /** 適用開始日（この日を含む）例: "2026-04-01" */
  effectiveFrom: string;

  /** 画面用メモ（任意）例: "令和8年度 東京都" */
  label?: string;

  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;

  employerShare: number;

  roundingRule: RoundingRule;

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
  employerShare: number;
  roundingRule: RoundingRule;
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
    employerShare: doc.employerShare,
    roundingRule: doc.roundingRule,
  };
}

export type InsuranceRateSource =
  | 'association_table'
  | 'combination_import'
  | 'combination_manual'
  | 'manual';

export interface InsuranceRateDocument {
  effectiveFrom: string;
  label?: string;

  rateSource: InsuranceRateSource;

  prefectureCode?: string;

  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
  employerShare: number;
  roundingRule: RoundingRule;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}