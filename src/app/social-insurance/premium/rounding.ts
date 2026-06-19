import {
  DEFAULT_ROUNDING_BOUNDARY_TYPE,
  normalizeRoundingBoundaryType,
  type RoundingBoundaryType,
} from '../monthly/social-insurance-document';

export const DEFAULT_ROUNDING_BY = 50;

export function normalizeRoundUp(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_ROUNDING_BY;
  return Math.min(99, Math.max(0, Math.trunc(value)));
}

export function roundPremium(
  amountYen: number,
  roundingBy: number,
  boundaryType: RoundingBoundaryType = DEFAULT_ROUNDING_BOUNDARY_TYPE,
): number {
  const normalizedRoundingBy = normalizeRoundUp(roundingBy);
  const normalizedBoundaryType = normalizeRoundingBoundaryType(boundaryType);
  const totalSen = Math.floor(amountYen * 100);
  const yenPart = Math.floor(totalSen / 100);
  const senPart = totalSen % 100;

  const shouldRoundUp =
    normalizedBoundaryType === 'lessThan'
      ? senPart >= normalizedRoundingBy
      : senPart > normalizedRoundingBy;

  return shouldRoundUp ? yenPart + 1 : yenPart;
}

export interface SplitPremiumResult {
  total: number;
  employer: number;
  employee: number;
}

export function premiumFromStandardRemuneration(
  standardRemuneration: number,
  rate: number,
  options?: {
    employeeRate?: number;
    roundingBy?: number;
    roundingBoundaryType?: RoundingBoundaryType;
  },
): SplitPremiumResult {
  const rawTotal = standardRemuneration * rate;
  const employeeRate = options?.employeeRate ?? rate / 2;
  const rawEmployee = standardRemuneration * employeeRate;
  const roundingBy = options?.roundingBy ?? DEFAULT_ROUNDING_BY;
  const roundingBoundaryType = normalizeRoundingBoundaryType(options?.roundingBoundaryType);
  const total = roundPremium(rawTotal, roundingBy, roundingBoundaryType);
  const employee = roundPremium(rawEmployee, roundingBy, roundingBoundaryType);
  const employer = roundPremium(rawTotal - employee, roundingBy, roundingBoundaryType);
  return { total, employee, employer };
}

export function roundRate(rate: number): number {
  return Number(rate.toFixed(7));
}

export function roundPercent(percent: number): number {
  return Number(percent.toFixed(5));
}
