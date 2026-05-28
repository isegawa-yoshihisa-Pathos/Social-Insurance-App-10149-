import { EmployeeListColumnKey } from './employee-list-columns';

export type BulkEditableColumn = Exclude<EmployeeListColumnKey, 'displayName'>;
export type BulkEditValue = string | Date | null;

const DATE_BULK_COLUMNS: readonly BulkEditableColumn[] = [
  'joinedAt',
  'leaveAt',
  'returnAt',
  'resignAt',
  'licenseStartAt',
  'licenseEndAt',
] as const;

export function isDateBulkColumn(column: BulkEditableColumn): boolean {
  return DATE_BULK_COLUMNS.includes(column);
}
