import type { PremiumData } from '../../monthly-document';
import {
  getPaymentDisplayMonthForSalary,
  type PayrollPaymentMonth,
} from '../payroll/payroll-payment-timing';
import {
  computeResignBulkPremiumData,
  listBulkCollectedPremiumMonths,
  mergePremiumData,
  resignLastPayrollMonthYyyyMm,
  shouldShowResignPremiumCollectionSetting,
  type ResignPremiumCollectionType,
  type ResignBulkPremiumScheduleInput,
  type SocialInsuranceCollectionMonth,
} from './resign-premium-collection';

export interface ResignPremiumDisplayContext {
  scheduleInput: ResignBulkPremiumScheduleInput;
  bulkMonths: ReadonlySet<string>;
  finalPayrollDisplayMonth: string;
  isBulk: boolean;
}

export interface BuildResignPremiumDisplayContextInput {
  licenceStartAt: Date | null | undefined;
  licenseEndAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  collectionMonth: SocialInsuranceCollectionMonth | undefined;
  payrollPaymentMonth?: PayrollPaymentMonth;
  resignPremiumCollection: ResignPremiumCollectionType | undefined;
}

export function buildResignPremiumDisplayContext(
  input: BuildResignPremiumDisplayContextInput,
): ResignPremiumDisplayContext | null {
  if (!input.resignAt) {
    return null;
  }

  const scheduleInput: ResignBulkPremiumScheduleInput = {
    licenceStartAt: input.licenceStartAt,
    licenseEndAt: input.licenseEndAt,
    resignAt: input.resignAt,
    collectionMonth: input.collectionMonth,
    payrollPaymentMonth: input.payrollPaymentMonth,
    resignPremiumCollection: input.resignPremiumCollection ?? 'monthly',
  };

  const isBulk =
    scheduleInput.resignPremiumCollection === 'bulk' &&
    shouldShowResignPremiumCollectionSetting(scheduleInput.collectionMonth);
  const bulkMonths = new Set(listBulkCollectedPremiumMonths(scheduleInput));
  const lastPayrollMonth = resignLastPayrollMonthYyyyMm(
    input.resignAt,
    scheduleInput.payrollPaymentMonth,
  );
  const finalPayrollDisplayMonth = getPaymentDisplayMonthForSalary(
    lastPayrollMonth,
    scheduleInput.payrollPaymentMonth,
  );

  return {
    scheduleInput,
    bulkMonths,
    finalPayrollDisplayMonth,
    isBulk,
  };
}

export interface ResolvePaymentDisplayPremiumInput {
  displayYyyyMm: string;
  premiumMonthYyyyMm: string;
  premiumFromFetchedMonth: PremiumData | undefined;
  premiumByMonth: ReadonlyMap<string, PremiumData | undefined>;
  resignContext: ResignPremiumDisplayContext | null;
}

/**
 * 給与管理の表示月に対する月次保険料を解決する。
 * 退職時一括徴収設定では、通常表示月から保険料を除き、最終給与表示月に合算する。
 */
export function resolvePaymentDisplayPremium(
  input: ResolvePaymentDisplayPremiumInput,
): PremiumData | undefined {
  const {
    displayYyyyMm,
    premiumMonthYyyyMm,
    premiumFromFetchedMonth,
    premiumByMonth,
    resignContext,
  } = input;

  if (!resignContext?.isBulk || resignContext.bulkMonths.size === 0) {
    return premiumFromFetchedMonth;
  }

  if (displayYyyyMm === resignContext.finalPayrollDisplayMonth) {
    const regularPremium = resignContext.bulkMonths.has(premiumMonthYyyyMm)
      ? undefined
      : premiumFromFetchedMonth;
    const bulkPremium = computeResignBulkPremiumData({
      ...resignContext.scheduleInput,
      premiumByMonth,
    });
    return mergePremiumData(regularPremium, bulkPremium);
  }

  if (resignContext.bulkMonths.has(premiumMonthYyyyMm)) {
    return undefined;
  }

  return premiumFromFetchedMonth;
}
