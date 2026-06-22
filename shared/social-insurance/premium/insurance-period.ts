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

/** 最終保険料発生月（資格喪失日が属する月の前月） */
export function lastPremiumMonthYyyyMm(licenseEndAt: Date): string {
  return addMonths(licenseEndYyyyMm(licenseEndAt), -1);
}

export function resolveLicenseEndAt(
  licenseEndAt: Date | null | undefined,
  resignAt: Date | null | undefined,
): Date | null {
  if (licenseEndAt) {
    return normalizeCalendarDate(licenseEndAt);
  }
  if (resignAt) {
    return licenseEndAtFromResignAt(resignAt);
  }
  return null;
}

export type PremiumCalculationSkipReason =
  | 'before_license_start'
  | 'after_license_end';

/**
 * 対象月が保険料算定対象外なら batch 計算をスキップする理由を返す。
 * 資格取得前・資格喪失後（最終保険料月の翌月以降）が対象。
 */
export function getPremiumCalculationSkipReason(
  licenceStartAt: Date | null | undefined,
  licenseEndAt: Date | null | undefined,
  resignAt: Date | null | undefined,
  yyyyMm: string,
): PremiumCalculationSkipReason | null {
  if (licenceStartAt) {
    const licenceStartYyyyMm = toYyyyMmFromDate(licenceStartAt);
    if (yyyyMm < licenceStartYyyyMm) {
      return 'before_license_start';
    }
  }

  const resolvedEnd = resolveLicenseEndAt(licenseEndAt, resignAt);
  if (!resolvedEnd) {
    return null;
  }
  if (!licenceStartAt) {
    return 'after_license_end';
  }
  if (
    !isInsurancePeriodTargetByLicenseEnd(
      licenceStartAt,
      resolvedEnd,
      yyyyMm,
    )
  ) {
    return 'after_license_end';
  }
  return null;
}

/**
 * 対象月が保険料算定対象外なら batch 計算をスキップする。
 * 最終保険料月までは false（計算する）。
 */
export function shouldSkipPremiumCalculationForResignedEmployee(
  licenceStartAt: Date | null | undefined,
  licenseEndAt: Date | null | undefined,
  resignAt: Date | null | undefined,
  yyyyMm: string,
): boolean {
  return getPremiumCalculationSkipReason(
    licenceStartAt,
    licenseEndAt,
    resignAt,
    yyyyMm,
  ) !== null;
}

/** 退職給与の支払月（退職日が属する月） */
export function resignPayMonthYyyyMm(resignAt: Date): string {
  return toYyyyMmFromDate(resignAt);
}

/** 暦上の月末日かどうか（JST 暦日） */
export function isLastDayOfMonth(date: Date): boolean {
  const normalized = normalizeCalendarDate(date);
  const lastDay = new Date(normalized.getFullYear(), normalized.getMonth() + 1, 0);
  return normalized.getDate() === lastDay.getDate();
}

/**
 * 退職月に支給される賞与の保険料徴収可否。
 * 原則として退職月の賞与には保険料は発生せず、退職日が月末の場合のみ発生する。
 */
export function getResignBonusPremiumSkipReason(
  resignAt: Date | null | undefined,
  bonusYyyyMm: string,
): string | null {
  if (!resignAt) {
    return null;
  }
  if (bonusYyyyMm !== resignPayMonthYyyyMm(resignAt)) {
    return null;
  }
  if (isLastDayOfMonth(resignAt)) {
    return null;
  }
  return '退職月に支給される賞与（月末退職以外）のため、賞与保険料は徴収対象外です';
}

export function isBonusPremiumTargetForResignation(
  resignAt: Date | null | undefined,
  bonusYyyyMm: string,
): boolean {
  return getResignBonusPremiumSkipReason(resignAt, bonusYyyyMm) === null;
}

/**
 * 対象月 yyyyMm が社会保険料の算定対象期間かどうか。
 * 資格取得月 ～ 資格喪失日が属する月の前月まで。同月得喪は取得月のみ。
 */
export function isInsurancePeriodTargetByLicenseEnd(
  licenceStartAt: Date | null | undefined,
  licenseEndAt: Date | null | undefined,
  yyyyMm: string,
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

  const lastPremium = lastPremiumMonthYyyyMm(licenseEndAt);
  return yyyyMm <= lastPremium;
}
