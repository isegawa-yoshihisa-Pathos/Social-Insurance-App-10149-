import type { PremiumData } from '../../monthly-document';
import { toFormDate } from '../../date-utils';
import type { DependentInfo } from '../../personal-document';
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
import {
  isInsurancePeriodTargetByLicenseEnd,
  licenseEndAtFromResignAt,
} from './insurance-period';

export interface InsuranceRatesInput {
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
}

export interface CareInsuranceCollectionInput {
  specificInsuranceCollectionType?: string | boolean;
  hasDependents?: boolean;
  dependentsInfo?: readonly Pick<DependentInfo, 'birthDate'>[];
}

export interface PremiumCalculationInput extends CareInsuranceCollectionInput {
  yyyyMm: string;
  birthDate: Date | null;
  licenceStartAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  licenseEndAt?: Date | null | undefined;
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
  yyyyMm: string,
  licenseEndAt?: Date | null | undefined,
): boolean {
  const resolvedLicenseEndAt =
    licenseEndAt ?? (resignAt ? licenseEndAtFromResignAt(resignAt) : null);
  return isInsurancePeriodTargetByLicenseEnd(
    licenceStartAt,
    resolvedLicenseEndAt,
    yyyyMm,
  );
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

export function isSpecificInsuranceCollectionEnabled(
  value: string | boolean | undefined,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return value === 'true';
}

export function hasCareInsuranceAgeDependent(
  dependentsInfo: readonly Pick<DependentInfo, 'birthDate'>[] | undefined,
  yyyyMm: string,
  hasDependents?: boolean,
): boolean {
  if (!hasDependents || !dependentsInfo?.length) {
    return false;
  }

  return dependentsInfo.some((dependent) =>
    isCareInsuranceTarget(toFormDate(dependent.birthDate), yyyyMm),
  );
}

export function shouldCollectCareInsurance(
  input: {
    yyyyMm: string;
    birthDate: Date | null;
  } & CareInsuranceCollectionInput,
): boolean {
  if (isCareInsuranceTarget(input.birthDate, input.yyyyMm)) {
    return true;
  }

  if (!isSpecificInsuranceCollectionEnabled(input.specificInsuranceCollectionType)) {
    return false;
  }

  return hasCareInsuranceAgeDependent(
    input.dependentsInfo,
    input.yyyyMm,
    input.hasDependents,
  );
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

export interface BonusPremiumCalculationInput extends CareInsuranceCollectionInput {
  yyyyMm: string;
  birthDate: Date | null;
  licenceStartAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  licenseEndAt?: Date | null | undefined;
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
    licenseEndAt: input.licenseEndAt,
    applyLeavePremiumExemption: false,
    specificInsuranceCollectionType: input.specificInsuranceCollectionType,
    hasDependents: input.hasDependents,
    dependentsInfo: input.dependentsInfo,
    standardRemuneration: input.standardBonus,
    rates: input.rates,
    employeeRate: input.employeeRate,
    roundingBy: input.roundingBy,
  });
}

export function calculateMonthlyPremium(input: PremiumCalculationInput): PremiumData {
  const {
    rates,
    standardRemuneration,
    yyyyMm,
    birthDate,
    licenceStartAt,
    resignAt,
    licenseEndAt,
  } = input;
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

  if (isInsurancePeriodTarget(licenceStartAt, resignAt, yyyyMm, licenseEndAt)) {
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

    if (shouldCollectCareInsurance({
      yyyyMm,
      birthDate,
      specificInsuranceCollectionType: input.specificInsuranceCollectionType,
      hasDependents: input.hasDependents,
      dependentsInfo: input.dependentsInfo,
    })) {
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