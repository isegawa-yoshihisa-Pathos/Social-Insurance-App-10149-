import { MonthlyListColumnKey } from './monthly-list-columns';

export type BulkEditableColumn = Exclude<
  MonthlyListColumnKey,
  'displayName' | 'bonus' | `bonus_${string}`
>;

export type BulkEditValue = number | null;

const NUMERIC_BULK_COLUMNS: readonly BulkEditableColumn[] = [
  'totalPay',
  'basicSalary',
  'overtimePay',
  'commuterAllowance',
  'otherAllowance',
  'retroactivePay',
  'healthInsurance_employer',
  'healthInsurance_employee',
  'careInsurance_employer',
  'careInsurance_employee',
  'pensionInsurance_employer',
  'pensionInsurance_employee',
] as const;

export function isNumericBulkColumn(column: BulkEditableColumn): boolean {
  return NUMERIC_BULK_COLUMNS.includes(column);
}
