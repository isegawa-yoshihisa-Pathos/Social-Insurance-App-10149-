import { BonusTypeDefinition } from '../../bonus-document';
import { PREMIUM_BONUS_LIST_COLUMN_KEYS } from '../bonus-premium/bonus-premium-columns';

const RESERVED_COLUMN_KEYS = new Set<string>([
  'displayName',
  'employeeId',
  'netPayment',
  ...PREMIUM_BONUS_LIST_COLUMN_KEYS,
]);

export function bonusColumnKey(type: string): string {
  return type;
}

export function bonusTypeFromColumnKey(column: string): string | null {
  if (RESERVED_COLUMN_KEYS.has(column)) {
    return null;
  }

  if (/^bonus-\d+$/.test(column)) {
    return column;
  }

  if (column.startsWith('bonus_')) {
    return column.slice('bonus_'.length);
  }
  return column;
}

export function isKnownBonusType(
  type: string,
  definitions: BonusTypeDefinition[],
): boolean {
  return definitions.some((def) => def.type === type);
}
