import type { PremiumData } from '../../monthly-document';
import {
  premiumFromStandardRemuneration,
  type RoundingRule,
  type SplitPremiumResult,
} from './rounding';

export interface InsuranceRatesInput {
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
}

export interface PremiumCalculationInput {
  yyyyMm: string;
  birthDate: Date | null;
  standardRemuneration: {
    health: number;
    pension: number;
  };
  rates: InsuranceRatesInput;
  /** 事業主負担割合（折半なら 0.5） */
  employerShare?: number;
  roundingRule?: RoundingRule;
}

function parseYyyyMm(yyyyMm: string): { year: number; month: number } {
  const year = Number(yyyyMm.slice(0, 4));
  const month = Number(yyyyMm.slice(4, 6));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid yyyyMm: ${yyyyMm}`);
  }
  return { year, month };
}

/** 当月末時点の満年齢 */
export function ageAtEndOfMonth(birthDate: Date, year: number, month: number): number {
  const lastDay = new Date(year, month, 0);
  let age = lastDay.getFullYear() - birthDate.getFullYear();
  const monthDiff = lastDay.getMonth() - birthDate.getMonth();
  const dayDiff = lastDay.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

/** 介護保険第2号被保険者（満40歳以上65歳未満） */
export function isCareInsuranceTarget(
  birthDate: Date | null,
  yyyyMm: string,
): boolean {
  if (!birthDate) {
    return false;
  }
  const { year, month } = parseYyyyMm(yyyyMm);
  const age = ageAtEndOfMonth(birthDate, year, month);
  return age >= 40 && age < 65;
}

function toPremiumPart(
  split: SplitPremiumResult,
): { employer: number; employee: number } {
  return { employer: split.employer, employee: split.employee };
}

/**
 * 標準報酬月額（健保・厚年）と料率から月次 premiumData を算出。
 * 協会けんぽの特定被保険者徴収などは第1フェーズでは未対応。
 */
export function calculateMonthlyPremium(input: PremiumCalculationInput): PremiumData {
  const { employerShare, roundingRule, rates, standardRemuneration, yyyyMm, birthDate } = input;
  const options = { employerShare, roundingRule };

  const health = premiumFromStandardRemuneration(
    standardRemuneration.health,
    rates.healthInsuranceRate,
    options,
  );

  const pension = premiumFromStandardRemuneration(
    standardRemuneration.pension,
    rates.pensionInsuranceRate,
    options,
  );

  let care: PremiumData['careInsurance'] = {
    employer: null,
    employee: null,
  };

  if (isCareInsuranceTarget(birthDate, yyyyMm)) {
    const careSplit = premiumFromStandardRemuneration(
      standardRemuneration.health,
      rates.careInsuranceRate,
      options,
    );
    care = toPremiumPart(careSplit);
  }

  return {
    healthInsurance: toPremiumPart(health),
    careInsurance: care,
    pensionInsurance: toPremiumPart(pension),
  };
}