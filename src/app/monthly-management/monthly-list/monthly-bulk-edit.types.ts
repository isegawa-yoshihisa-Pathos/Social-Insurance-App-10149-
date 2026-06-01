import { BonusAmountMap } from '../../monthly-document';
import { MonthlyListColumnKey } from './monthly-list-columns';

export type BulkEditableColumn = Exclude<MonthlyListColumnKey, 'displayName' | 'employeeId' | 'bonus'>;

export type BulkEditValue = number | null;

export interface BulkEditTarget {
  eid: string;
  bonus: BonusAmountMap;
}

export function isEditableColumn(column: MonthlyListColumnKey): column is BulkEditableColumn {
  return column !== 'displayName' && column !== 'employeeId' && column !== 'bonus';
}
