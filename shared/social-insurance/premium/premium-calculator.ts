import type { PremiumData } from '../../monthly-document';
import {
  premiumFromStandardRemuneration,
  type SplitPremiumResult,
} from './rounding';
import { EmployeeRateByInsurance, normalizeEmployeeRate, normalizeRoundingBy, RoundingByInsurance } from '../monthly/social-insurance-document';
import {
  isBonusPremiumExemptForChildcareLeave,
  isMonthlyPremiumExemptForLeave,
  type LeavePeriodInput,
} from './leave-premium-exemption';

export interface InsuranceRatesInput {
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
}

export interface PremiumCalculationInput {
  yyyyMm: string;
  birthDate: Date | null;
  licenceStartAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  leaveRecords?: readonly LeavePeriodInput[];
  applyLeavePremiumExemption?: boolean;
  standardRemuneration: {
    health: number;
    pension: number;
  };
  rates: InsuranceRatesInput;
  employeeRate?: EmployeeRateByInsurance;
  roundingBy?: RoundingByInsurance;
}

export function isInsurancePeriodTarget(
  licenceStartAt: Date | null | undefined,
  resignAt: Date | null | undefined,
  yyyyMm: string
): boolean {
  if (!licenceStartAt) {
    return false;
  }

  const licenceStartYyyyMm = `${licenceStartAt.getFullYear()}-${String(licenceStartAt.getMonth() + 1).padStart(2, '0')}`;
  if (yyyyMm < licenceStartYyyyMm) {
    return false;
  }

  if (resignAt) {
    const licenceEndAt = new Date(resignAt.getTime());
    licenceEndAt.setDate(licenceEndAt.getDate() + 1);

    const isSameMonthLicenceStartAndEnd =
      licenceStartAt.getFullYear() === licenceEndAt.getFullYear() &&
      licenceStartAt.getMonth() === licenceEndAt.getMonth();

    if (isSameMonthLicenceStartAndEnd) {
      return yyyyMm === licenceStartYyyyMm;
    }
  }
  return true;
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

  const birthday40 = new Date(birthDate.getTime());
  birthday40.setFullYear(birthDate.getFullYear() + 40);
  const start = reachedMonth(birthday40);
  const startYyyyMm = `${start.yyyy}-${String(start.mm).padStart(2, '0')}`;

  const birthday65 = new Date(birthDate.getTime());
  birthday65.setFullYear(birthDate.getFullYear() + 65);
  const end = reachedMonth(birthday65);
  const endYyyyMm = `${end.yyyy}-${String(end.mm).padStart(2, '0')}`;

  return startYyyyMm <= yyyyMm && yyyyMm < endYyyyMm;
}

export function isHealthInsuranceTarget(
  birthDate: Date | null,
  yyyyMm: string,
): boolean {
  if (!birthDate) {
    return false;
  }

  const birthday75 = new Date(birthDate.getTime());
  birthday75.setFullYear(birthDate.getFullYear() + 75);
  const end = reachedMonth(birthday75);
  const endYyyyMm = `${end.yyyy}-${String(end.mm).padStart(2, '0')}`;

  return yyyyMm < endYyyyMm;
}

export function isPensionInsuranceTarget(
  birthDate: Date | null,
  yyyyMm: string,
): boolean {
  if (!birthDate) {
    return false;
  }
  
  const birthday70 = new Date(birthDate.getTime());
  birthday70.setFullYear(birthDate.getFullYear() + 70);
  const end = reachedMonth(birthday70);
  const endYyyyMm = `${end.yyyy}-${String(end.mm).padStart(2, '0')}`;

  return yyyyMm < endYyyyMm;
}

export function reachedMonth(date: Date): { yyyy: number; mm: number } {
  const previousDay = new Date(date.getTime());
  previousDay.setDate(previousDay.getDate() - 1);
  const yyyy = previousDay.getFullYear();
  const mm = previousDay.getMonth() + 1;
  return {yyyy, mm};
}

function toPremiumPart(
  split: SplitPremiumResult,
): { employer: number; employee: number } {
  return { employer: split.employer, employee: split.employee };
}

export interface BonusPremiumCalculationInput {
  yyyyMm: string;
  birthDate: Date | null;
  licenceStartAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  leaveRecords?: readonly LeavePeriodInput[];
  standardBonus: {
    health: number;
    pension: number;
  };
  rates: InsuranceRatesInput;
  employeeRate?: EmployeeRateByInsurance;
  roundingBy?: RoundingByInsurance;
}

function emptyPremiumData(): PremiumData {
  return {
    healthInsurance: { employer: null, employee: null },
    careInsurance: { employer: null, employee: null },
    pensionInsurance: { employer: null, employee: null },
  };
}

export function calculateBonusPremium(input: BonusPremiumCalculationInput): PremiumData {
  if (isBonusPremiumExemptForChildcareLeave(input.yyyyMm, input.leaveRecords)) {
    return emptyPremiumData();
  }

  return calculateMonthlyPremium({
    yyyyMm: input.yyyyMm,
    birthDate: input.birthDate,
    licenceStartAt: input.licenceStartAt,
    resignAt: input.resignAt,
    applyLeavePremiumExemption: false,
    standardRemuneration: input.standardBonus,
    rates: input.rates,
    employeeRate: input.employeeRate,
    roundingBy: input.roundingBy,
  });
}

export function calculateMonthlyPremium(input: PremiumCalculationInput): PremiumData {
  const { rates, standardRemuneration, yyyyMm, birthDate, licenceStartAt, resignAt } = input;
  const rate = normalizeEmployeeRate(input.employeeRate);
  const rounding = normalizeRoundingBy(input.roundingBy);

  let health: PremiumData['healthInsurance'] = {
    employer: null,
    employee: null,
  };

  let pension: PremiumData['pensionInsurance'] = {
    employer: null,
    employee: null,
  };

  let care: PremiumData['careInsurance'] = {
    employer: null,
    employee: null,
  };

  if (
    input.applyLeavePremiumExemption !== false &&
    isMonthlyPremiumExemptForLeave(yyyyMm, input.leaveRecords)
  ) {
    return emptyPremiumData();
  }

  if (isInsurancePeriodTarget(licenceStartAt, resignAt, yyyyMm)) {
    if (isHealthInsuranceTarget(birthDate, yyyyMm)) {
      const healthSplit = premiumFromStandardRemuneration(
        standardRemuneration.health,
        rates.healthInsuranceRate,
        { 
          employeeRate: rate.healthInsurance,
          roundingBy: rounding.healthInsurance,
        },
      );
      health = toPremiumPart(healthSplit);
    }

    if (isPensionInsuranceTarget(birthDate, yyyyMm)) {
      const pensionSplit = premiumFromStandardRemuneration(
        standardRemuneration.pension,
        rates.pensionInsuranceRate,
        { 
          employeeRate: rate.pensionInsurance,
          roundingBy: rounding.pensionInsurance,
        },
      );
      pension = toPremiumPart(pensionSplit);
    }

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
  }

  return {
    healthInsurance: health,
    careInsurance: care,
    pensionInsurance: pension,
  };
}