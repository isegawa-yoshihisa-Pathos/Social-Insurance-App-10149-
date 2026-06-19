import { BonusAmountMap } from '../../bonus-document';
import { BONUS_NET_PAYMENT_COLUMN_KEY, BonusListColumnKey } from './bonus-list-columns';
import { isPremiumColumn } from '../bonus-premium/bonus-premium-columns';

export type BulkEditableColumn = Exclude<BonusListColumnKey, 'displayName' | 'employeeId'>;

export type BulkEditValue = number | null;

export interface BulkEditTarget {
  eid: string;
  bonus: BonusAmountMap;
}

export function isEditableColumn(column: BonusListColumnKey): column is BulkEditableColumn {
  return !isPremiumColumn(column)
    && column !== 'displayName'
    && column !== 'employeeId'
    && column !== BONUS_NET_PAYMENT_COLUMN_KEY;
}