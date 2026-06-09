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
  | AllowanceColumnKey
  | BonusColumnKey
  | PremiumMonthlyPaymentListColumnKey
  | PremiumBonusPaymentListColumnKey;

export const DEFAULT_PAYMENT_LIST_COLUMNS: PaymentListColumnKey[] = [
  'displayName',
  'employeeId',
  'basicSalary',
  'fixedWage',
  'variableWage',
  'bonus',
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
    { key: 'displayName', label: '氏名' },
    { key: 'employeeId', label: '社員番号' },
    { key: 'paymentBaseDays', label: '支払基礎日数' },
    { key: 'basicSalary', label: '基本給与' },
    { key: 'fixedWage', label: '固定的賃金' },
    { key: 'variableWage', label: '非固定的賃金' },
    ...allowanceColumns,
    { key: 'retroactivePay', label: '遡及清算' },
    { key: 'bonus', label: '賞与合計' },
    ...bonusColumns,
    ...getOptionalPremiumColumns(),
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

  return STATIC_PAYMENT_LIST_COLUMN_LABELS[column as BasePaymentListColumnKey] ?? column;
}

export interface PaymentListRow {
  eid: string;
  employeeId: string;
  displayName: string;
  paymentBaseDays: number;
  basicSalary: number;
  fixedWage: number | null;
  variableWage: number | null;
  allowances: AllowanceData;
  retroactivePay: number | null;
  bonus: BonusAmountMap;
  bonusTotal: number;
  standardRemunerationHealth: number | null;
  standardRemunerationPension: number | null;
  healthInsuranceEmployee: number | null;
  healthInsuranceEmployer: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceEmployer: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceEmployer: number | null;
  standardBonusHealth: number | null;
  standardBonusPension: number | null;
  bonusHealthInsuranceEmployee: number | null;
  bonusHealthInsuranceEmployer: number | null;
  bonusCareInsuranceEmployee: number | null;
  bonusCareInsuranceEmployer: number | null;
  bonusPensionInsuranceEmployee: number | null;
  bonusPensionInsuranceEmployer: number | null;
}
