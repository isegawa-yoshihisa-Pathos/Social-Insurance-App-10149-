import type { PremiumData } from '../../monthly-document';
import { addMonths } from '../monthly/social-insurance-data.util';
import { type PayrollPaymentMonth } from '../payroll/payroll-payment-timing';
import {
  isInsurancePeriodTargetByLicenseEnd,
  lastPremiumMonthYyyyMm,
  licenseEndYyyyMm,
  resolveLicenseEndAt,
  resignPayMonthYyyyMm,
  toYyyyMmFromDate,
} from './insurance-period';

export type ResignPremiumCollectionType = 'bulk' | 'monthly';
export type SocialInsuranceCollectionMonth =
  | 'currentMonth'
  | 'nextMonth'
  | 'nextNextMonth';

/** 給与支払月から保険料対象月へのオフセット（payment-list と同じ符号） */
export function getPayToPremiumMonthOffset(
  collectionMonth: SocialInsuranceCollectionMonth | undefined,
): number {
  switch (collectionMonth) {
    case 'currentMonth':
      return 0;
    case 'nextNextMonth':
      return -2;
    case 'nextMonth':
    default:
      return -1;
  }
}

export function getPremiumToPayMonthDelay(
  collectionMonth: SocialInsuranceCollectionMonth | undefined,
): number {
  return -getPayToPremiumMonthOffset(collectionMonth);
}

export function shouldShowResignPremiumCollectionSetting(
  collectionMonth: SocialInsuranceCollectionMonth | undefined,
): boolean {
  return collectionMonth === 'nextMonth' || collectionMonth === 'nextNextMonth';
}

export function getScheduledPayMonthYyyyMm(
  premiumMonthYyyyMm: string,
  collectionMonth: SocialInsuranceCollectionMonth | undefined,
): string {
  return addMonths(premiumMonthYyyyMm, getPremiumToPayMonthDelay(collectionMonth));
}

/** 給与管理の表示月に、その月徴収する報酬に係る保険料が紐づく保険料対象月 */
export function getPremiumMonthForPaymentDisplay(
  displayYyyyMm: string,
  collectionMonth: SocialInsuranceCollectionMonth | undefined,
): string {
  return addMonths(displayYyyyMm, getPayToPremiumMonthOffset(collectionMonth));
}

/** 翌月支給の場合、保険料徴収「当月」は選択不可 */
export function isSocialInsuranceCollectionMonthAllowed(
  payrollPaymentMonth: PayrollPaymentMonth | undefined,
  collectionMonth: SocialInsuranceCollectionMonth,
): boolean {
  return !(payrollPaymentMonth === 'nextMonth' && collectionMonth === 'currentMonth');
}

export function normalizeSocialInsuranceCollectionMonth(
  payrollPaymentMonth: PayrollPaymentMonth | undefined,
  collectionMonth: SocialInsuranceCollectionMonth | undefined,
): SocialInsuranceCollectionMonth {
  const resolved = collectionMonth ?? 'nextMonth';
  if (!isSocialInsuranceCollectionMonthAllowed(payrollPaymentMonth, resolved)) {
    return 'nextMonth';
  }
  return resolved;
}

function addNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) {
    return null;
  }
  return (a ?? 0) + (b ?? 0);
}

function addPremiumPart(
  a: PremiumData['healthInsurance'] | undefined,
  b: PremiumData['healthInsurance'] | undefined,
): PremiumData['healthInsurance'] {
  return {
    total: addNullable(a?.total, b?.total),
    employee: addNullable(a?.employee, b?.employee),
  };
}

export function sumPremiumData(items: readonly PremiumData[]): PremiumData {
  return items.reduce<PremiumData>(
    (acc, item) => ({
      healthInsurance: addPremiumPart(acc.healthInsurance, item.healthInsurance),
      careInsurance: addPremiumPart(acc.careInsurance, item.careInsurance),
      pensionInsurance: addPremiumPart(acc.pensionInsurance, item.pensionInsurance),
    }),
    {
      healthInsurance: { total: null, employee: null },
      careInsurance: { total: null, employee: null },
      pensionInsurance: { total: null, employee: null },
    },
  );
}

export function mergePremiumData(
  regular?: PremiumData | null,
  bulk?: PremiumData | null,
): PremiumData | undefined {
  if (!regular && !bulk) {
    return undefined;
  }
  if (!regular) {
    return bulk ?? undefined;
  }
  if (!bulk) {
    return regular;
  }
  return sumPremiumData([regular, bulk]);
}

export function isPremiumDataEmpty(premium: PremiumData | undefined | null): boolean {
  if (!premium) {
    return true;
  }
  const parts = [
    premium.healthInsurance,
    premium.careInsurance,
    premium.pensionInsurance,
  ];
  return parts.every(
    (part) => part.total == null && part.employee == null,
  );
}

export interface ResignBulkPremiumScheduleInput {
  licenceStartAt: Date | null | undefined;
  licenseEndAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  collectionMonth: SocialInsuranceCollectionMonth | undefined;
  payrollPaymentMonth?: PayrollPaymentMonth;
  resignPremiumCollection: ResignPremiumCollectionType | undefined;
}

export interface ResignBulkPremiumInput extends ResignBulkPremiumScheduleInput {
  premiumByMonth: ReadonlyMap<string, PremiumData | undefined>;
}


/**
 * 一括徴収の対象となる保険料対象月（yyyyMm）を列挙する。
 * 通常徴収予定月が退職月より後の報酬に係る保険料を、退職月の給与管理表示でまとめて徴収する。
 */
export function listBulkCollectedPremiumMonths(
  input: ResignBulkPremiumScheduleInput,
): string[] {
  if (input.resignPremiumCollection !== 'bulk') {
    return [];
  }
  if (!shouldShowResignPremiumCollectionSetting(input.collectionMonth)) {
    return [];
  }
  if (!input.resignAt || !input.licenceStartAt) {
    return [];
  }

  const licenseEndAt = resolveLicenseEndAt(input.licenseEndAt, input.resignAt);
  if (!licenseEndAt) {
    return [];
  }

  const resignPayMonth = resignPayMonthYyyyMm(input.resignAt);
  const licenceStartYyyyMm = toYyyyMmFromDate(input.licenceStartAt);
  const lastPremium = lastPremiumMonthYyyyMm(licenseEndAt);

  const months: string[] = [];
  let cursor = licenceStartYyyyMm;
  while (cursor <= lastPremium) {
    if (
      isInsurancePeriodTargetByLicenseEnd(
        input.licenceStartAt,
        licenseEndAt,
        cursor,
      )
    ) {
      const scheduledPayMonth = getScheduledPayMonthYyyyMm(
        cursor,
        input.collectionMonth,
      );
      if (scheduledPayMonth > resignPayMonth) {
        months.push(cursor);
      }
    }
    cursor = addMonths(cursor, 1);
  }

  return months;
}

/**
 * 退職月給与で一括徴収する保険料を算出する。
 * 通常徴収予定月が退職月より後の保険料対象月分を合算する。
 * （例: 7月末退職・翌月給与・翌月徴収の場合、7月表示で6月分給与に加え、
 *  通常8月徴収予定だった7月分保険料を7月表示で一括徴収。8月表示は7月分給与のみ）
 */
export function computeResignBulkPremiumData(
  input: ResignBulkPremiumInput,
): PremiumData | undefined {
  const bulkItems = listBulkCollectedPremiumMonths(input)
    .map((month) => input.premiumByMonth.get(month))
    .filter((premium): premium is PremiumData => !!premium && !isPremiumDataEmpty(premium));

  if (bulkItems.length === 0) {
    return undefined;
  }
  return sumPremiumData(bulkItems);
}

/** licenseEndAt 以降の報酬に係る保険料をクリアすべきか */
export function shouldClearPremiumForMonth(
  licenseEndAt: Date | null | undefined,
  yyyyMm: string,
  resignAt?: Date | null | undefined,
): boolean {
  const resolved = resolveLicenseEndAt(licenseEndAt, resignAt);
  if (!resolved) {
    return false;
  }
  return yyyyMm > lastPremiumMonthYyyyMm(resolved);
}

/** 同月得喪の資格喪失月（表示・検証用） */
export function isSameMonthLicenceStartAndEnd(
  licenceStartAt: Date,
  licenseEndAt: Date,
): boolean {
  return licenseEndYyyyMm(licenseEndAt) === toYyyyMmFromDate(licenceStartAt);
}
