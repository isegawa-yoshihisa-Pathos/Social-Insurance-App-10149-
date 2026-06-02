import { BonusAmountMap } from '../../monthly-document';
import { MonthlyListColumnKey } from './monthly-list-columns';
import { isPremiumColumn } from '../monthly-premium/monthly-premium-columns';

export type BulkEditableColumn = Exclude<MonthlyListColumnKey, 'displayName' | 'employeeId' | 'bonus'>;

export type BulkEditValue = number | null;

export interface BulkEditTarget {
  eid: string;
  bonus: BonusAmountMap;
}

export function isEditableColumn(column: MonthlyListColumnKey): column is BulkEditableColumn {
  return !isPremiumColumn(column) 
    && column !== 'displayName' 
    && column !== 'employeeId' 
    && column !== 'bonus';
}