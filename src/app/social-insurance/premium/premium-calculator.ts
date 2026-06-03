import type { PremiumData } from '../../monthly-document';
import {
  premiumFromStandardRemuneration,
  type SplitPremiumResult,
} from './rounding';
import { EmployeeRateByInsurance, normalizeEmployeeRate, normalizeRoundingBy, RoundingByInsurance } from '../monthly/social-insurance-document';
import { parseYyyyMm } from '../monthly/social-insurance-data.util';

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
  employeeRate?: EmployeeRateByInsurance;
  roundingBy?: RoundingByInsurance;
}

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

export interface BonusPremiumCalculationInput {
  yyyyMm: string;
  birthDate: Date | null;
  standardBonus: {
    health: number;
    pension: number;
  };
  rates: InsuranceRatesInput;
  employeeRate?: EmployeeRateByInsurance;
  roundingBy?: RoundingByInsurance;
}

export function calculateBonusPremium(input: BonusPremiumCalculationInput): PremiumData {
  return calculateMonthlyPremium({
    yyyyMm: input.yyyyMm,
    birthDate: input.birthDate,
    standardRemuneration: input.standardBonus,
    rates: input.rates,
    employeeRate: input.employeeRate,
    roundingBy: input.roundingBy,
  });
}

export function calculateMonthlyPremium(input: PremiumCalculationInput): PremiumData {
  const { rates, standardRemuneration, yyyyMm, birthDate } = input;
  const rate = normalizeEmployeeRate(input.employeeRate);
  const rounding = normalizeRoundingBy(input.roundingBy);

  const health = premiumFromStandardRemuneration(
    standardRemuneration.health,
    rates.healthInsuranceRate,
    { 
      employeeRate: rate.healthInsurance,
      roundingBy: rounding.healthInsurance,
    },
  );

  const pension = premiumFromStandardRemuneration(
    standardRemuneration.pension,
    rates.pensionInsuranceRate,
    { 
      employeeRate: rate.pensionInsurance,
      roundingBy: rounding.pensionInsurance,
    },
  );

  let care: PremiumData['careInsurance'] = {
    employer: null,
    employee: null,
  };

  if (isCareInsuranceTarget(birthDate, yyyyMm)) {
    const careSplit = premiumFromStandardRemuneration(
      standardRemuneration.health,
      rates.careInsuranceRate,
      { 
        employeeRate: rate.careInsurance,
        roundingBy: rounding.careInsurance,
      },
    );
    care = toPremiumPart(careSplit);
  }

  return {
    healthInsurance: toPremiumPart(health),
    careInsurance: care,
    pensionInsurance: toPremiumPart(pension),
  };
}