import { BonusAmountMap } from '../../bonus-document';
import type { PremiumAmountColumnKey } from '../../../../shared/social-insurance/premium/premium-manual-edit.util';
import { BONUS_NET_PAYMENT_COLUMN_KEY, BonusListColumnKey } from './bonus-list-columns';
import {
  BulkEditableStandardBonusColumnKey,
  isBulkEditablePremiumAmountColumn,
  isBulkEditableStandardBonusColumn,
  isPremiumColumn,
} from '../bonus-premium/bonus-premium-columns';

export type BulkEditableBonusColumn = Exclude<
  BonusListColumnKey,
  'displayName' | 'employeeId' | BulkEditableStandardBonusColumnKey | PremiumAmountColumnKey
>;

export type BulkEditableColumn =
  | BulkEditableBonusColumn
  | BulkEditableStandardBonusColumnKey
  | PremiumAmountColumnKey;

export type BulkEditValue = number | null;

export interface BulkEditTarget {
  eid: string;
  bonus: BonusAmountMap;
  healthInsuranceEmployee: number | null;
  healthInsuranceTotal: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceTotal: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceTotal: number | null;
}

export function isEditableColumn(column: BonusListColumnKey): column is BulkEditableColumn {
  if (column === 'displayName' || column === 'employeeId' || column === BONUS_NET_PAYMENT_COLUMN_KEY) {
    return false;
  }
  if (isBulkEditableStandardBonusColumn(column)) {
    return true;
  }
  if (isBulkEditablePremiumAmountColumn(column)) {
    return true;
  }
  return !isPremiumColumn(column);
}
