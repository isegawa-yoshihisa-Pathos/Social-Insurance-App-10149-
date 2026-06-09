import { MonthlyFormData } from '../../monthly-document';
import { AllowanceTypeDefinition } from '../../payment-document';
import { allowanceColumnKey, allowanceTypeFromColumnKey } from '../../payment-management/payment-list/allowance-display.util';
import {
  isPremiumColumn,
  getPremiumColumnLabel,
  getOptionalPremiumColumns,
  PREMIUM_MONTHLY_LIST_COLUMN_KEYS,
  PremiumMonthlyListColumnKey,
} from '../monthly-premium/monthly-premium-columns';
import { AllowanceData } from '../../payment-document';

export type MonthlyFormColumnKey = keyof MonthlyFormData;

export type AllowanceColumnKey = string;

export type MonthlyListColumnKey =
  | MonthlyFormColumnKey
  | 'fixedWage'
  | 'variableWage'
  | AllowanceColumnKey
  | PremiumMonthlyListColumnKey;

export const BASE_MONTHLY_LIST_COLUMN_KEYS = [
  'displayName',
  'employeeId',
  'paymentBaseDays',
  'basicSalary',
  'fixedWage',
  'variableWage',
  'retroactivePay',
] as const;

export type BaseMonthlyListColumnKey = (typeof BASE_MONTHLY_LIST_COLUMN_KEYS)[number];

export const DEFAULT_MONTHLY_LIST_COLUMNS: MonthlyListColumnKey[] = [
  'displayName',
  'employeeId',
  'paymentBaseDays',
  'basicSalary',
];

const STATIC_COLUMN_LABELS: Record<BaseMonthlyListColumnKey, string> = {
  displayName: '氏名',
  employeeId: '社員番号',
  paymentBaseDays: '支払基礎日数',
  basicSalary: '基本給与',
  fixedWage: '固定的賃金',
  variableWage: '非固定的賃金',
  retroactivePay: '遡及清算',
};

export function getAllMonthlyListColumnKeys(
  definitions: AllowanceTypeDefinition[],
): MonthlyListColumnKey[] {
  return [
    ...BASE_MONTHLY_LIST_COLUMN_KEYS,
    ...definitions.map((def) => allowanceColumnKey(def.type)),
    ...PREMIUM_MONTHLY_LIST_COLUMN_KEYS,
  ];
}

export function getOptionalMonthlyListColumns(
  definitions: AllowanceTypeDefinition[],
): { key: MonthlyListColumnKey; label: string }[] {
  const allowanceColumns = definitions.map((def) => ({
    key: allowanceColumnKey(def.type) as MonthlyListColumnKey,
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
    ...getOptionalPremiumColumns(),
  ];
}

export function getMonthlyListColumnLabel(
  column: MonthlyListColumnKey,
  definitions: AllowanceTypeDefinition[],
): string {
  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    return definitions.find((def) => def.type === allowanceType)?.label ?? column;
  }

  if (isPremiumColumn(column)) {
    return getPremiumColumnLabel(column);
  }

  return STATIC_COLUMN_LABELS[column as BaseMonthlyListColumnKey] ?? column;
}

export interface MonthlyListRow {
  eid: string;
  employeeId: string;
  displayName: string;
  paymentBaseDays: number;
  basicSalary: number;
  fixedWage: number | null;
  variableWage: number | null;
  allowances: AllowanceData;
  retroactivePay: number | null;
  standardRemunerationHealth: number | null;
  standardRemunerationPension: number | null;
  healthInsuranceEmployee: number | null;
  healthInsuranceEmployer: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceEmployer: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceEmployer: number | null;
}
