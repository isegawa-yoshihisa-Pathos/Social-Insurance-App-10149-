import { MonthlyFormData } from '../../monthly-document';
import { isPremiumColumn, getPremiumColumnLabel, getOptionalPremiumColumns, PREMIUM_MONTHLY_LIST_COLUMN_KEYS, PremiumMonthlyListColumnKey } from '../monthly-premium/monthly-premium-columns';

export type MonthlyFormColumnKey = keyof MonthlyFormData;

export type MonthlyListColumnKey = MonthlyFormColumnKey | PremiumMonthlyListColumnKey;

export const BASE_MONTHLY_LIST_COLUMN_KEYS = [
  'displayName',
  'employeeId',
  'totalPay',
  'basicSalary',
  'overtimePay',
  'commuterAllowance',
  'otherAllowance',
  'retroactivePay',
] as const;

export type BaseMonthlyListColumnKey = (typeof BASE_MONTHLY_LIST_COLUMN_KEYS)[number];

export const DEFAULT_MONTHLY_LIST_COLUMNS: MonthlyListColumnKey[] = [
  'displayName',
  'employeeId',
  'totalPay',
];

const STATIC_COLUMN_LABELS: Record<BaseMonthlyListColumnKey, string> = {
  displayName: '氏名',
  employeeId: '社員番号',
  totalPay: '総支給額',
  basicSalary: '基本給与',
  overtimePay: '残業手当',
  commuterAllowance: '通勤手当',
  otherAllowance: 'その他手当',
  retroactivePay: '遡及清算',
};

export function getAllMonthlyListColumnKeys(
): MonthlyListColumnKey[] {

  return [
    ...BASE_MONTHLY_LIST_COLUMN_KEYS,
    ...PREMIUM_MONTHLY_LIST_COLUMN_KEYS,
  ];
}

export function getOptionalMonthlyListColumns(
): { key: MonthlyListColumnKey; label: string }[] {

  return [
    { key: 'displayName', label: '氏名' },
    { key: 'employeeId', label: '社員番号' },
    { key: 'totalPay', label: '総支給額' },
    { key: 'basicSalary', label: '基本給与' },
    { key: 'overtimePay', label: '残業手当' },
    { key: 'commuterAllowance', label: '通勤手当' },
    { key: 'otherAllowance', label: 'その他手当' },
    { key: 'retroactivePay', label: '遡及清算' },
    ...getOptionalPremiumColumns(),
  ];
}

export function getMonthlyListColumnLabel(
  column: MonthlyListColumnKey,
): string {

  if (isPremiumColumn(column)) {
    return getPremiumColumnLabel(column);
  }

  return STATIC_COLUMN_LABELS[column as BaseMonthlyListColumnKey];
}

export interface MonthlyListRow {
  eid: string;
  employeeId: string;
  displayName: string;
  totalPay: number;
  basicSalary: number;
  overtimePay: number | null;
  commuterAllowance: number | null;
  otherAllowance: number | null;
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
