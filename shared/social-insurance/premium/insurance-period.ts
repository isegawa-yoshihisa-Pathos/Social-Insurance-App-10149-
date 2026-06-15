import { addMonths } from '../monthly/social-insurance-data.util';

export function toYyyyMmFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 退職日の翌日 = 資格喪失日 */
export function licenseEndAtFromResignAt(resignAt: Date): Date {
  const nextDay = new Date(resignAt.getTime());
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

/** 資格喪失日が属する月 */
export function licenseEndYyyyMm(licenseEndAt: Date): string {
  return toYyyyMmFromDate(licenseEndAt);
}

/** 最終保険料発生月（資格喪失月の前月） */
export function lastPremiumMonthYyyyMm(licenseEndAt: Date): string {
  return addMonths(licenseEndYyyyMm(licenseEndAt), -1);
}

/** 退職給与の支払月（退職日が属する月） */
export function resignPayMonthYyyyMm(resignAt: Date): string {
  return toYyyyMmFromDate(resignAt);
}

/**
 * 対象月 yyyyMm が社会保険料の算定対象期間かどうか。
 * 資格取得月 ～ 資格喪失日の前月まで。同月得喪は取得月のみ。
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
