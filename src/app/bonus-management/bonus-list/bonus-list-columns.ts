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
  PremiumBonusListColumnKey,
} from '../bonus-premium/bonus-premium-columns';

export type BonusFormColumnKey = keyof BonusFormData;

export type BonusColumnKey = `bonus-${number}`;

export type BonusListColumnKey =
  | BonusFormColumnKey
  | BonusColumnKey
  | PremiumBonusListColumnKey;

export const BASE_BONUS_LIST_COLUMN_KEYS = [
  'displayName',
  'employeeId',
  'bonus',
] as const;

export type BaseBonusListColumnKey = (typeof BASE_BONUS_LIST_COLUMN_KEYS)[number];

export const DEFAULT_BONUS_LIST_COLUMNS: BonusListColumnKey[] = [
  'displayName',
  'employeeId',
  'bonus',
];

const STATIC_COLUMN_LABELS: Record<BaseBonusListColumnKey, string> = {
  displayName: '氏名',
  employeeId: '社員番号',
  bonus: '賞与（合計）',
};

export function getAllBonusListColumnKeys(
  definitions: BonusTypeDefinition[],
): BonusListColumnKey[] {

  return [
    ...BASE_BONUS_LIST_COLUMN_KEYS,
    ...definitions.map((def) => bonusColumnKey(def.type)),
    ...PREMIUM_BONUS_LIST_COLUMN_KEYS,
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
    { key: 'bonus', label: '賞与（合計）' },
    ...bonusColumns,
    ...getOptionalPremiumColumns(),
  ];
}

export function getBonusListColumnLabel(
  column: BonusListColumnKey,
  definitions: BonusTypeDefinition[],
): string {
  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    return definitions.find((def) => def.type === bonusType)?.label ?? column;
  }

  if (isPremiumColumn(column)) {
    return getPremiumColumnLabel(column);
  }

  return STATIC_COLUMN_LABELS[column as BaseBonusListColumnKey];
}

export interface BonusListRow {
  eid: string;
  employeeId: string;
  displayName: string;
  bonus: BonusAmountMap;
  bonusDisplay: string;
  bonusTooltip: string;
  bonusTotal: number;
  standardBonusHealth: number | null;
  standardBonusPension: number | null;
  healthInsuranceEmployee: number | null;
  healthInsuranceEmployer: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceEmployer: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceEmployer: number | null;
}
