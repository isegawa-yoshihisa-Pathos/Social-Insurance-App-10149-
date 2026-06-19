import {
  BonusAmountMap,
  BonusTypeDefinition,
  BonusFormData,
} from '../../bonus-document';
import { bonusColumnKey, bonusTypeFromColumnKey } from './bonus-display.util';
import {
  isPremiumColumn,
  getPremiumColumnLabel,
  getOptionalPremiumColumns,
  PREMIUM_BONUS_LIST_COLUMN_KEYS,
  PREMIUM_BONUS_LIST_EMPLOYEE_COLUMN_KEYS,
  PremiumBonusListColumnKey,
  PremiumBonusListEmployeeColumnKey,
} from '../bonus-premium/bonus-premium-columns';

export type BonusFormColumnKey = keyof BonusFormData;

export const BONUS_NET_PAYMENT_COLUMN_KEY = 'netPayment' as const;
export const BONUS_TOTAL_PAYMENT_COLUMN_KEY = 'totalPayment' as const;

export type BonusSummaryColumnKey = typeof BONUS_NET_PAYMENT_COLUMN_KEY;
export type BonusEmployeeSummaryColumnKey = typeof BONUS_TOTAL_PAYMENT_COLUMN_KEY;

export type BonusColumnKey = `bonus-${number}`;

export type BonusListColumnKey =
  | BonusFormColumnKey
  | BonusColumnKey
  | BonusSummaryColumnKey
  | PremiumBonusListColumnKey;

export const BASE_BONUS_LIST_COLUMN_KEYS = [
  'displayName',
  'employeeId',
] as const;

export type BaseBonusListColumnKey = (typeof BASE_BONUS_LIST_COLUMN_KEYS)[number];

export const DEFAULT_BONUS_LIST_COLUMNS: BonusListColumnKey[] = [
  'displayName',
  'employeeId',
  'netPayment',
];

const STATIC_COLUMN_LABELS: Record<BaseBonusListColumnKey, string> = {
  displayName: '氏名',
  employeeId: '社員番号',
};

export function getAllBonusListColumnKeys(
  definitions: BonusTypeDefinition[],
): BonusListColumnKey[] {

  return [
    ...BASE_BONUS_LIST_COLUMN_KEYS,
    ...definitions.map((def) => bonusColumnKey(def.type)),
    ...PREMIUM_BONUS_LIST_COLUMN_KEYS,
    BONUS_NET_PAYMENT_COLUMN_KEY,
  ] as BonusListColumnKey[];
}

export function getOptionalBonusListColumns(
  definitions: BonusTypeDefinition[],
): { key: BonusListColumnKey; label: string }[] {
  const bonusColumns = definitions.map((def) => ({
    key: bonusColumnKey(def.type) as BonusListColumnKey,
    label: def.label,
  }));

  return [
    { key: 'displayName', label: '氏名' },
    { key: 'employeeId', label: '社員番号' },
    ...bonusColumns,
    ...getOptionalPremiumColumns(),
    { key: BONUS_NET_PAYMENT_COLUMN_KEY, label: '賞与総支払' },
  ];
}

export type BonusListColumnKeyForEmployee =
  | BonusColumnKey
  | PremiumBonusListEmployeeColumnKey
  | BonusEmployeeSummaryColumnKey;

export function getAllBonusListColumnKeysForEmployee(
  definitions: BonusTypeDefinition[],
): BonusListColumnKeyForEmployee[] {
  return [
    ...definitions.map((def) => bonusColumnKey(def.type)),
    ...PREMIUM_BONUS_LIST_EMPLOYEE_COLUMN_KEYS,
    BONUS_TOTAL_PAYMENT_COLUMN_KEY,
  ] as BonusListColumnKeyForEmployee[];
}

export function getBonusListColumnLabelForEmployee(
  column: BonusListColumnKeyForEmployee,
  definitions: BonusTypeDefinition[],
): string {
  if (column === BONUS_TOTAL_PAYMENT_COLUMN_KEY) {
    return '賞与総支払';
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    return definitions.find((def) => def.type === bonusType)?.label ?? column;
  }

  if ((PREMIUM_BONUS_LIST_EMPLOYEE_COLUMN_KEYS as readonly string[]).includes(column)) {
    return getPremiumColumnLabel(column as PremiumBonusListEmployeeColumnKey);
  }

  return column;
}

export function getBonusListColumnLabel(
  column: BonusListColumnKey,
  definitions: BonusTypeDefinition[],
): string {
  if (column === BONUS_NET_PAYMENT_COLUMN_KEY) {
    return '賞与総支払';
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    return definitions.find((def) => def.type === bonusType)?.label ?? column;
  }

  if (isPremiumColumn(column)) {
    return getPremiumColumnLabel(column);
  }

  return STATIC_COLUMN_LABELS[column as BaseBonusListColumnKey] ?? column;
}

export interface BonusListRow {
  eid: string;
  employeeId: string;
  displayName: string;
  bonus: BonusAmountMap;
  standardBonusHealth: number | null;
  standardBonusPension: number | null;
  healthInsuranceEmployee: number | null;
  healthInsuranceEmployer: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceEmployer: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceEmployer: number | null;
}

export interface BonusListRowForEmployee {
  totalPayment: number;
  bonus: BonusAmountMap;
  healthInsuranceEmployee: number | null;
  careInsuranceEmployee: number | null;
  pensionInsuranceEmployee: number | null;
}
