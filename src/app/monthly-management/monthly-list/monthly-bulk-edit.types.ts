import { AllowanceData } from '../../payment-document';
import { MonthlyListColumnKey } from './monthly-list-columns';
import {
  BulkEditableStandardRemunerationColumnKey,
  isBulkEditableStandardRemunerationColumn,
} from '../monthly-premium/monthly-premium-columns';
import { allowanceTypeFromColumnKey } from '../../payment-management/payment-list/allowance-display.util';

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
  basicSalary: number;
  allowances: AllowanceData;
  retroactivePay: number | null;
}

export function isEditableColumn(column: MonthlyListColumnKey): column is BulkEditableColumn {
  if (column === 'displayName' || column === 'employeeId') {
    return false;
  }
  if (isBulkEditableStandardRemunerationColumn(column)) {
    return true;
  }
  if (allowanceTypeFromColumnKey(column)) {
    return true;
  }
  if (column === 'fixedWage' || column === 'variableWage') {
    return false;
  }
  return column === 'basicSalary' ||
    column === 'paymentBaseDays' ||
    column === 'bonusRelatedRemuneration' ||
    column === 'retroactivePay';
}
