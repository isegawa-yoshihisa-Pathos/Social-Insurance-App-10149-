import { PaymentListColumnKey } from '../payment-list/payment-list-columns';

export const PREMIUM_MONTHLY_PAYMENT_LIST_COLUMN_KEYS = [
  'standardRemunerationHealth',
  'standardRemunerationPension',
  'healthInsuranceEmployee',
  'healthInsuranceTotal',
  'careInsuranceEmployee',
  'careInsuranceTotal',
  'pensionInsuranceEmployee',
  'pensionInsuranceTotal',
] as const;

export const PREMIUM_BONUS_PAYMENT_LIST_COLUMN_KEYS = [
  'standardBonusHealth',
  'standardBonusPension',
  'bonusHealthInsuranceEmployee',
  'bonusHealthInsuranceTotal',
  'bonusCareInsuranceEmployee',
  'bonusCareInsuranceTotal',
  'bonusPensionInsuranceEmployee',
  'bonusPensionInsuranceTotal',
] as const;

export const PREMIUM_PAYMENT_LIST_COLUMN_KEYS = [
  ...PREMIUM_MONTHLY_PAYMENT_LIST_COLUMN_KEYS,
  ...PREMIUM_BONUS_PAYMENT_LIST_COLUMN_KEYS,
] as const;

export type PremiumMonthlyPaymentListColumnKey =
  (typeof PREMIUM_MONTHLY_PAYMENT_LIST_COLUMN_KEYS)[number];

export type PremiumBonusPaymentListColumnKey =
  (typeof PREMIUM_BONUS_PAYMENT_LIST_COLUMN_KEYS)[number];

export type PremiumPaymentListColumnKey = (typeof PREMIUM_PAYMENT_LIST_COLUMN_KEYS)[number];

export const BULK_EDITABLE_STANDARD_REMUNERATION_COLUMN_KEYS = [
  'standardRemunerationHealth',
  'standardRemunerationPension',
] as const;

export type BulkEditableStandardRemunerationColumnKey =
  (typeof BULK_EDITABLE_STANDARD_REMUNERATION_COLUMN_KEYS)[number];

const MONTHLY_PREMIUM_COLUMN_LABELS: Record<PremiumMonthlyPaymentListColumnKey, string> = {
  standardRemunerationHealth: '??????????',
  standardRemunerationPension: '??????????',
  healthInsuranceEmployee: '?????????',
  healthInsuranceTotal: '?????????',
  careInsuranceEmployee: '?????????',
  careInsuranceTotal: '?????????',
  pensionInsuranceEmployee: '?????????',
  pensionInsuranceTotal: '?????????',
};

const BONUS_PREMIUM_COLUMN_LABELS: Record<PremiumBonusPaymentListColumnKey, string> = {
  standardBonusHealth: '?????????',
  standardBonusPension: '?????????',
  bonusHealthInsuranceEmployee: '?????????',
  bonusHealthInsuranceTotal: '?????????',
  bonusCareInsuranceEmployee: '?????????',
  bonusCareInsuranceTotal: '?????????',
  bonusPensionInsuranceEmployee: '?????????',
  bonusPensionInsuranceTotal: '?????????',
};

export function isPremiumColumn(column: PaymentListColumnKey): column is PremiumPaymentListColumnKey {
  return (PREMIUM_PAYMENT_LIST_COLUMN_KEYS as readonly string[]).includes(column);
}

export function isBulkEditableStandardRemunerationColumn(
  column: PaymentListColumnKey,
): column is BulkEditableStandardRemunerationColumnKey {
  return (BULK_EDITABLE_STANDARD_REMUNERATION_COLUMN_KEYS as readonly string[]).includes(column);
}

export function getPremiumColumnLabel(column: PremiumPaymentListColumnKey): string {
  if ((PREMIUM_MONTHLY_PAYMENT_LIST_COLUMN_KEYS as readonly string[]).includes(column)) {
    return MONTHLY_PREMIUM_COLUMN_LABELS[column as PremiumMonthlyPaymentListColumnKey];
  }
  return BONUS_PREMIUM_COLUMN_LABELS[column as PremiumBonusPaymentListColumnKey];
}

export function getOptionalPremiumColumns(): { key: PremiumPaymentListColumnKey; label: string }[] {
  return PREMIUM_PAYMENT_LIST_COLUMN_KEYS.map((key) => ({
    key,
    label: getPremiumColumnLabel(key),
  }));
}
