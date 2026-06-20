import { BonusTypeDefinition } from '../../bonus-document';
import { AllowanceTypeDefinition, PaymentFormData } from '../../payment-document';
import { allowanceColumnKey, allowanceTypeFromColumnKey } from './allowance-display.util';
import { bonusColumnKey, bonusTypeFromColumnKey } from '../../bonus-management/bonus-list/bonus-display.util';
import {
  isPremiumColumn,
  getPremiumColumnLabel,
  getOptionalPremiumColumns,
  PREMIUM_PAYMENT_LIST_COLUMN_KEYS,
  PremiumBonusPaymentListColumnKey,
  PremiumMonthlyPaymentListColumnKey,
} from '../payment-premium/payment-premium-columns';
import { AllowanceData } from '../../payment-document';
import { BonusAmountMap } from '../../bonus-document';
import {
  BASE_PAYMENT_LIST_COLUMN_KEYS,
  BasePaymentListColumnKey,
  STATIC_PAYMENT_LIST_COLUMN_LABELS,
  PAYMENT_SUMMARY_COLUMN_KEYS,
  PAYMENT_SUMMARY_COLUMN_LABELS,
  isPaymentSummaryColumn,
  PaymentSummaryColumnKey,
} from './payment-list-column-keys';

export { BASE_PAYMENT_LIST_COLUMN_KEYS } from './payment-list-column-keys';
export type { BasePaymentListColumnKey } from './payment-list-column-keys';

export type PaymentFormColumnKey = keyof PaymentFormData;

export type AllowanceColumnKey = string;

export type BonusColumnKey = string;

export type PaymentListColumnKey =
  | PaymentFormColumnKey
  | 'fixedWage'
  | 'variableWage'
  | 'bonus'
  | PaymentSummaryColumnKey
  | AllowanceColumnKey
  | BonusColumnKey
  | PremiumMonthlyPaymentListColumnKey
  | PremiumBonusPaymentListColumnKey;

export const DEFAULT_PAYMENT_LIST_COLUMNS: PaymentListColumnKey[] = [
  'displayName',
  'employeeId',
  'basicSalary',
  'fringeBenefits',
  'bonusRelatedRemuneration',
  'fixedWage',
  'variableWage',
  'bonus',
  'monthlyNetPayment',
  'bonusNetPayment',
  'totalNetPayment',
];

export function getAllPaymentListColumnKeys(
  allowanceDefinitions: AllowanceTypeDefinition[],
  bonusDefinitions: BonusTypeDefinition[],
): PaymentListColumnKey[] {
  return [
    ...BASE_PAYMENT_LIST_COLUMN_KEYS,
    ...allowanceDefinitions.map((def) => allowanceColumnKey(def.type)),
    ...bonusDefinitions.map((def) => bonusColumnKey(def.type)),
    ...PREMIUM_PAYMENT_LIST_COLUMN_KEYS,
    ...PAYMENT_SUMMARY_COLUMN_KEYS,
  ] as PaymentListColumnKey[];
}

export function getOptionalPaymentListColumns(
  allowanceDefinitions: AllowanceTypeDefinition[],
  bonusDefinitions: BonusTypeDefinition[],
): { key: PaymentListColumnKey; label: string }[] {
  const allowanceColumns = allowanceDefinitions.map((def) => ({
    key: allowanceColumnKey(def.type) as PaymentListColumnKey,
    label: def.label,
  }));
  const bonusColumns = bonusDefinitions.map((def) => ({
    key: bonusColumnKey(def.type) as PaymentListColumnKey,
    label: def.label,
  }));

  return [
    ...BASE_PAYMENT_LIST_COLUMN_KEYS.slice(0, 7).map((key) => ({
      key: key as PaymentListColumnKey,
      label: STATIC_PAYMENT_LIST_COLUMN_LABELS[key],
    })),
    ...allowanceColumns,
    {
      key: 'retroactivePay' as PaymentListColumnKey,
      label: STATIC_PAYMENT_LIST_COLUMN_LABELS.retroactivePay,
    },
    {
      key: 'bonus' as PaymentListColumnKey,
      label: STATIC_PAYMENT_LIST_COLUMN_LABELS.bonus,
    },
    ...bonusColumns,
    ...getOptionalPremiumColumns(),
    ...PAYMENT_SUMMARY_COLUMN_KEYS.map((key) => ({
      key: key as PaymentListColumnKey,
      label: PAYMENT_SUMMARY_COLUMN_LABELS[key],
    })),
  ];
}

export function bonusTypeForPaymentColumn(
  column: string,
  bonusDefinitions: BonusTypeDefinition[],
): string | null {
  if (bonusDefinitions.some((def) => def.type === column)) {
    return column;
  }

  const resolved = bonusTypeFromColumnKey(column);
  if (resolved && bonusDefinitions.some((def) => def.type === resolved)) {
    return resolved;
  }

  return null;
}

export function allowanceTypeForPaymentColumn(
  column: string,
  allowanceDefinitions: AllowanceTypeDefinition[],
): string | null {
  if (allowanceDefinitions.some((def) => def.type === column)) {
    return column;
  }

  const resolved = allowanceTypeFromColumnKey(column);
  if (resolved && allowanceDefinitions.some((def) => def.type === resolved)) {
    return resolved;
  }

  return null;
}

export function getPaymentListColumnLabel(
  column: PaymentListColumnKey,
  allowanceDefinitions: AllowanceTypeDefinition[],
  bonusDefinitions: BonusTypeDefinition[],
): string {
  const bonusType = bonusTypeForPaymentColumn(column, bonusDefinitions);
  if (bonusType) {
    return bonusDefinitions.find((def) => def.type === bonusType)?.label ?? column;
  }

  const allowanceType = allowanceTypeForPaymentColumn(column, allowanceDefinitions);
  if (allowanceType) {
    return allowanceDefinitions.find((def) => def.type === allowanceType)?.label ?? column;
  }

  if (isPremiumColumn(column)) {
    return getPremiumColumnLabel(column);
  }

  if (isPaymentSummaryColumn(column)) {
    return PAYMENT_SUMMARY_COLUMN_LABELS[column];
  }

  return STATIC_PAYMENT_LIST_COLUMN_LABELS[column as BasePaymentListColumnKey] ?? column;
}

export interface PaymentListRow {
  eid: string;
  employeeId: string;
  displayName: string;
  paymentBaseDays: number;
  basicSalary: number;
  fringeBenefits: number;
  bonusRelatedRemuneration: number;
  fixedWage: number | null;
  variableWage: number | null;
  allowances: AllowanceData;
  retroactivePay: number | null;
  bonus: BonusAmountMap;
  bonusTotal: number;
  standardRemunerationHealth: number | null;
  standardRemunerationPension: number | null;
  healthInsuranceEmployee: number | null;
  healthInsuranceTotal: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceTotal: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceTotal: number | null;
  standardBonusHealth: number | null;
  standardBonusPension: number | null;
  bonusHealthInsuranceEmployee: number | null;
  bonusHealthInsuranceTotal: number | null;
  bonusCareInsuranceEmployee: number | null;
  bonusCareInsuranceTotal: number | null;
  bonusPensionInsuranceEmployee: number | null;
  bonusPensionInsuranceTotal: number | null;
}
