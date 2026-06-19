import { MonthlyFormData } from '../../monthly-document';
import { AllowanceTypeDefinition } from '../../payment-document';
import { allowanceColumnKey, allowanceTypeFromColumnKey } from '../../payment-management/payment-list/allowance-display.util';
import {
  isPremiumColumn,
  getPremiumColumnLabel,
  getOptionalPremiumColumns,
  PREMIUM_MONTHLY_LIST_COLUMN_KEYS,
  PREMIUM_MONTHLY_LIST_EMPLOYEE_COLUMN_KEYS,
  PremiumMonthlyListColumnKey,
  PremiumMonthlyListEmployeeColumnKey,
} from '../monthly-premium/monthly-premium-columns';
import { AllowanceData } from '../../payment-document';

export type MonthlyFormColumnKey = keyof MonthlyFormData;

export const MONTHLY_NET_PAYMENT_COLUMN_KEY = 'netPayment' as const;
export const MONTHLY_TOTAL_PAYMENT_COLUMN_KEY = 'totalPayment' as const;

export type MonthlySummaryColumnKey = typeof MONTHLY_NET_PAYMENT_COLUMN_KEY;
export type MonthlyEmployeeSummaryColumnKey = typeof MONTHLY_TOTAL_PAYMENT_COLUMN_KEY;

export type AllowanceColumnKey = string;

export type MonthlyListColumnKey =
  | MonthlyFormColumnKey
  | 'fixedWage'
  | 'variableWage'
  | MonthlySummaryColumnKey
  | AllowanceColumnKey
  | PremiumMonthlyListColumnKey;

export const BASE_MONTHLY_LIST_COLUMN_KEYS = [
  'displayName',
  'employeeId',
  'paymentBaseDays',
  'basicSalary',
  'fringeBenefits',
  'bonusRelatedRemuneration',
  'fixedWage',
  'variableWage',
  'retroactivePay',
] as const;

export type BaseMonthlyListColumnKey = (typeof BASE_MONTHLY_LIST_COLUMN_KEYS)[number];

export const BASE_MONTHLY_LIST_EMPLOYEE_COLUMN_KEYS = [
  'basicSalary',
  'fringeBenefits',
  'bonusRelatedRemuneration',
  'retroactivePay',
] as const;

export type BaseMonthlyListEmployeeColumnKey =
  (typeof BASE_MONTHLY_LIST_EMPLOYEE_COLUMN_KEYS)[number];

export type MonthlyListColumnKeyForEmployee =
  | BaseMonthlyListEmployeeColumnKey
  | AllowanceColumnKey
  | PremiumMonthlyListEmployeeColumnKey
  | MonthlyEmployeeSummaryColumnKey;

const STATIC_EMPLOYEE_COLUMN_LABELS: Record<BaseMonthlyListEmployeeColumnKey, string> = {
  basicSalary: '基本給与',
  fringeBenefits: '現物給与',
  bonusRelatedRemuneration: '賞与にかかる報酬',
  retroactivePay: '遡及支払',
};

export const DEFAULT_MONTHLY_LIST_COLUMNS: MonthlyListColumnKey[] = [
  'displayName',
  'employeeId',
  'paymentBaseDays',
  'basicSalary',
  'fringeBenefits',
  'bonusRelatedRemuneration',
  'netPayment',
];

const STATIC_COLUMN_LABELS: Record<BaseMonthlyListColumnKey, string> = {
  displayName: '氏名',
  employeeId: '社員番号',
  paymentBaseDays: '支払基礎日数',
  basicSalary: '基本給与',
  fringeBenefits: '現物給与',
  bonusRelatedRemuneration: '賞与にかかる報酬',
  fixedWage: '固定的賃金',
  variableWage: '非固定的賃金',
  retroactivePay: '遡及支払',
};

export function getAllMonthlyListColumnKeys(
  definitions: AllowanceTypeDefinition[],
): MonthlyListColumnKey[] {
  return [
    ...BASE_MONTHLY_LIST_COLUMN_KEYS,
    ...definitions.map((def) => allowanceColumnKey(def.type)),
    ...PREMIUM_MONTHLY_LIST_COLUMN_KEYS,
    MONTHLY_NET_PAYMENT_COLUMN_KEY,
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
    { key: 'fringeBenefits', label: '現物給与' },
    { key: 'bonusRelatedRemuneration', label: '賞与にかかる報酬' },
    { key: 'fixedWage', label: '固定的賃金' },
    { key: 'variableWage', label: '非固定的賃金' },
    ...allowanceColumns,
    { key: 'retroactivePay', label: '遡及支払' },
    ...getOptionalPremiumColumns(),
    { key: MONTHLY_NET_PAYMENT_COLUMN_KEY, label: '月次総支払' },
  ];
}

export function getAllMonthlyListColumnKeysForEmployee(
  definitions: AllowanceTypeDefinition[],
): MonthlyListColumnKeyForEmployee[] {
  return [
    ...BASE_MONTHLY_LIST_EMPLOYEE_COLUMN_KEYS,
    ...definitions.map((def) => allowanceColumnKey(def.type)),
    ...PREMIUM_MONTHLY_LIST_EMPLOYEE_COLUMN_KEYS,
    MONTHLY_TOTAL_PAYMENT_COLUMN_KEY,
  ] as MonthlyListColumnKeyForEmployee[];
}

export function getMonthlyListColumnLabelForEmployee(
  column: MonthlyListColumnKeyForEmployee,
  definitions: AllowanceTypeDefinition[],
): string {
  if (column === MONTHLY_TOTAL_PAYMENT_COLUMN_KEY) {
    return '月次総支払';
  }

  if (Object.hasOwn(STATIC_EMPLOYEE_COLUMN_LABELS, column)) {
    return STATIC_EMPLOYEE_COLUMN_LABELS[column as BaseMonthlyListEmployeeColumnKey];
  }

  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    return definitions.find((def) => def.type === allowanceType)?.label ?? column;
  }

  if ((PREMIUM_MONTHLY_LIST_EMPLOYEE_COLUMN_KEYS as readonly string[]).includes(column)) {
    return getPremiumColumnLabel(column as PremiumMonthlyListEmployeeColumnKey);
  }

  return column;
}

export function getMonthlyListColumnLabel(
  column: MonthlyListColumnKey,
  definitions: AllowanceTypeDefinition[],
): string {
  if (column === MONTHLY_NET_PAYMENT_COLUMN_KEY) {
    return '月次総支払';
  }

  if (Object.hasOwn(STATIC_COLUMN_LABELS, column)) {
    return STATIC_COLUMN_LABELS[column as BaseMonthlyListColumnKey];
  }

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
  fringeBenefits: number;
  bonusRelatedRemuneration: number;
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

export interface MonthlyListRowForEmployee {
  totalPayment: number;
  basicSalary: number;
  fringeBenefits: number;
  bonusRelatedRemuneration: number;
  allowances: AllowanceData;
  retroactivePay: number | null;
  healthInsuranceEmployee: number | null;
  careInsuranceEmployee: number | null;
  pensionInsuranceEmployee: number | null;
}
