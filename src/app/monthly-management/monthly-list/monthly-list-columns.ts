import {
  BonusAmountMap,
  BonusTypeDefinition,
  MonthlyFormData,
} from '../../monthly-document';
import { bonusColumnKey, bonusTypeFromColumnKey } from './bonus-display.util';

export type MonthlyFormColumnKey = keyof MonthlyFormData;

export type BonusColumnKey = `bonus-${number}`;

export type MonthlyListColumnKey = MonthlyFormColumnKey | BonusColumnKey | string;

export const BASE_MONTHLY_LIST_COLUMN_KEYS = [
  'displayName',
  'totalPay',
  'basicSalary',
  'overtimePay',
  'commuterAllowance',
  'otherAllowance',
  'retroactivePay',
  'bonus',
] as const;

export type BaseMonthlyListColumnKey = (typeof BASE_MONTHLY_LIST_COLUMN_KEYS)[number];

export const DEFAULT_MONTHLY_LIST_COLUMNS: MonthlyListColumnKey[] = [
  'displayName',
  'totalPay',
];

const STATIC_COLUMN_LABELS: Record<BaseMonthlyListColumnKey, string> = {
  displayName: '氏名',
  totalPay: '総支給額',
  basicSalary: '基本給与',
  overtimePay: '残業手当',
  commuterAllowance: '通勤手当',
  otherAllowance: 'その他手当',
  retroactivePay: '遡及清算',
  bonus: '賞与（合計）',
};

export function getAllMonthlyListColumnKeys(
  definitions: BonusTypeDefinition[],
): MonthlyListColumnKey[] {

  return [
    ...BASE_MONTHLY_LIST_COLUMN_KEYS,
    ...definitions.map((def) => bonusColumnKey(def.type)),
  ];
}

export function getOptionalMonthlyListColumns(
  definitions: BonusTypeDefinition[],
): { key: Exclude<MonthlyListColumnKey, 'displayName'>; label: string }[] {
  const bonusColumns = definitions.map((def) => ({
    key: bonusColumnKey(def.type) as Exclude<MonthlyListColumnKey, 'displayName'>,
    label: def.label,
  }));

  return [
    { key: 'totalPay', label: '総支給額' },
    { key: 'basicSalary', label: '基本給与' },
    { key: 'overtimePay', label: '残業手当' },
    { key: 'commuterAllowance', label: '通勤手当' },
    { key: 'otherAllowance', label: 'その他手当' },
    { key: 'retroactivePay', label: '遡及清算' },
    { key: 'bonus', label: '賞与（合計）' },
    ...bonusColumns,
  ];
}

export function getMonthlyListColumnLabel(
  column: MonthlyListColumnKey,
  definitions: BonusTypeDefinition[],
): string {
  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    return definitions.find((def) => def.type === bonusType)?.label ?? column;
  }

  return STATIC_COLUMN_LABELS[column as BaseMonthlyListColumnKey];
}

export interface MonthlyListRow {
  eid: string;
  displayName: string;
  totalPay: number;
  basicSalary: number;
  overtimePay: number | null;
  commuterAllowance: number | null;
  otherAllowance: number | null;
  retroactivePay: number | null;
  bonus: BonusAmountMap;
  bonusDisplay: string;
  bonusTooltip: string;
  bonusTotal: number;
}
