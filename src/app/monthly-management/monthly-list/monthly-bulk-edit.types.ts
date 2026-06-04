import { MonthlyListColumnKey } from './monthly-list-columns';
import {
  BulkEditableStandardRemunerationColumnKey,
  isBulkEditableStandardRemunerationColumn,
  isPremiumColumn,
} from '../monthly-premium/monthly-premium-columns';

export type BulkEditablePayrollColumn = Exclude<
  MonthlyListColumnKey,
  'displayName' | 'employeeId' | BulkEditableStandardRemunerationColumnKey
>;

export type BulkEditableColumn =
  | BulkEditablePayrollColumn
  | BulkEditableStandardRemunerationColumnKey;

export type BulkEditValue = number | null;

export interface BulkEditTarget {
  eid: string;
}

export function isEditableColumn(column: MonthlyListColumnKey): column is BulkEditableColumn {
  if (column === 'displayName' || column === 'employeeId') {
    return false;
  }
  if (isBulkEditableStandardRemunerationColumn(column)) {
    return true;
  }
  return !isPremiumColumn(column);
}