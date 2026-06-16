import { addMonths } from '../monthly/social-insurance-data.util';
import { normalizeCalendarDate } from './leave-premium-exemption';

export function toYyyyMmFromDate(date: Date): string {
  const normalized = normalizeCalendarDate(date);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}`;
}

/** 退職日の翌日 = 資格喪失日 */
export function licenseEndAtFromResignAt(resignAt: Date): Date {
  const nextDay = normalizeCalendarDate(resignAt);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

/** 資格喪失日が属する月 */
export function licenseEndYyyyMm(licenseEndAt: Date): string {
  return toYyyyMmFromDate(licenseEndAt);
}

/** 最終保険料発生月（退職日が属する月。資格喪失日の前日まで被保険者） */
export function lastPremiumMonthYyyyMm(
  licenseEndAt: Date,
  resignAt?: Date | null | undefined,
): string {
  if (resignAt) {
    return resignPayMonthYyyyMm(resignAt);
  }
  return addMonths(licenseEndYyyyMm(licenseEndAt), -1);
}

export function resolveLicenseEndAt(
  licenseEndAt: Date | null | undefined,
  resignAt: Date | null | undefined,
): Date | null {
  if (resignAt) {
    return licenseEndAtFromResignAt(resignAt);
  }
  if (licenseEndAt) {
    return normalizeCalendarDate(licenseEndAt);
  }
  return null;
}

/**
 * 退職済み従業員について、対象月が保険料算定対象外なら batch 計算をスキップする。
 * 最終保険料月までは false（計算する）。
 */
export function shouldSkipPremiumCalculationForResignedEmployee(
  licenceStartAt: Date | null | undefined,
  licenseEndAt: Date | null | undefined,
  resignAt: Date | null | undefined,
  yyyyMm: string,
): boolean {
  const resolvedEnd = resolveLicenseEndAt(licenseEndAt, resignAt);
  if (!resolvedEnd) {
    return false;
  }
  if (!licenceStartAt) {
    return true;
  }
  return !isInsurancePeriodTargetByLicenseEnd(
    licenceStartAt,
    resolvedEnd,
    yyyyMm,
    resignAt,
  );
}

/** 退職給与の支払月（退職日が属する月） */
export function resignPayMonthYyyyMm(resignAt: Date): string {
  return toYyyyMmFromDate(resignAt);
}

/**
 * 対象月 yyyyMm が社会保険料の算定対象期間かどうか。
 * 資格取得月 ～ 退職月（最終保険料月）まで。同月得喪は取得月のみ。
 */
export function isInsurancePeriodTargetByLicenseEnd(
  licenceStartAt: Date | null | undefined,
  licenseEndAt: Date | null | undefined,
  yyyyMm: string,
  resignAt?: Date | null | undefined,
): boolean {
  if (!licenceStartAt) {
    return false;
  }

  const licenceStartYyyyMm = toYyyyMmFromDate(licenceStartAt);
  if (yyyyMm < licenceStartYyyyMm) {
    return false;
  }

  if (!licenseEndAt) {
    return true;
  }

  const licenceEndYyyyMmValue = licenseEndYyyyMm(licenseEndAt);
  if (licenceStartYyyyMm === licenceEndYyyyMmValue) {
    return yyyyMm === licenceStartYyyyMm;
  }

  const lastPremium = lastPremiumMonthYyyyMm(licenseEndAt, resignAt);
  return yyyyMm <= lastPremium;
}
