import { AllowanceData } from '../../payment-document';
import { MONTHLY_NET_PAYMENT_COLUMN_KEY, MonthlyListColumnKey } from './monthly-list-columns';
import {
  BulkEditableStandardRemunerationColumnKey,
  isBulkEditableStandardRemunerationColumn,
  isPremiumColumn,
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
  paymentBaseDays: number;
  basicSalary: number;
  fringeBenefits: number;
  allowances: AllowanceData;
  retroactivePay: number | null;
  bonusRelatedRemuneration: number;
}

export function isEditableColumn(column: MonthlyListColumnKey): column is BulkEditableColumn {
  if (column === 'displayName' || column === 'employeeId') {
    return false;
  }
  if (column === MONTHLY_NET_PAYMENT_COLUMN_KEY) {
    return false;
  }
  if (column === 'fixedWage' || column === 'variableWage') {
    return false;
  }
  if (isPremiumColumn(column) && !isBulkEditableStandardRemunerationColumn(column)) {
    return false;
  }
  if (isBulkEditableStandardRemunerationColumn(column)) {
    return true;
  }
  if (allowanceTypeFromColumnKey(column)) {
    return true;
  }
  return column === 'basicSalary' ||
    column === 'fringeBenefits' ||
    column === 'paymentBaseDays' ||
    column === 'bonusRelatedRemuneration' ||
    column === 'retroactivePay';
}
