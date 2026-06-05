import { PaymentListColumnKey } from '../payment-list/payment-list-columns';

export const PREMIUM_PAYMENT_LIST_COLUMN_KEYS = [
  'standardRemunerationHealth',
  'standardRemunerationPension',
  'healthInsuranceEmployee',
  'healthInsuranceEmployer',
  'careInsuranceEmployee',  
  'careInsuranceEmployer',
  'pensionInsuranceEmployee',
  'pensionInsuranceEmployer',
] as const;

export type PremiumPaymentListColumnKey = (typeof PREMIUM_PAYMENT_LIST_COLUMN_KEYS)[number];

export const BULK_EDITABLE_STANDARD_REMUNERATION_COLUMN_KEYS = [
  'standardRemunerationHealth',
  'standardRemunerationPension',
] as const;

export type BulkEditableStandardRemunerationColumnKey =
  (typeof BULK_EDITABLE_STANDARD_REMUNERATION_COLUMN_KEYS)[number];

const PREMIUM_COLUMN_LABELS: Record<PremiumPaymentListColumnKey, string> = {
  standardRemunerationHealth: '標準報酬月額（健保）',
  standardRemunerationPension: '標準報酬月額（厚年）',
  healthInsuranceEmployee: '健保（本人）',
  healthInsuranceEmployer: '健保（事業主）',
  careInsuranceEmployee: '介護（本人）',
  careInsuranceEmployer: '介護（事業主）',
  pensionInsuranceEmployee: '厚年（本人）',
  pensionInsuranceEmployer: '厚年（事業主）',
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
  return PREMIUM_COLUMN_LABELS[column];
}

export function getOptionalPremiumColumns(): { key: PremiumPaymentListColumnKey; label: string }[] {
  return PREMIUM_PAYMENT_LIST_COLUMN_KEYS.map((key) => ({
    key,
    label: PREMIUM_COLUMN_LABELS[key],
  }));
}