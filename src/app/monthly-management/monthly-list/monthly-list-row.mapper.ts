import { MonthlyDocument } from '../../monthly-document';
import { BulkEditValue } from './monthly-bulk-edit.types';
import { MonthlyListColumnKey, MonthlyListRow } from './monthly-list-columns';
import { Format } from '../../format-number-jp';
import { isPremiumColumn } from '../monthly-premium/monthly-premium-columns';
import { applyPremiumFieldsToRow, formatPremiumCellValue, premiumSortValue, premiumSearchText } from '../monthly-premium/monthly-premium-row.mapper';

export function toMonthlyListRow(
  eid: string,
  data: Partial<MonthlyDocument>,
): MonthlyListRow {
  const payroll = data.payrollData;

  return {
    ...applyPremiumFieldsToRow({
      eid,
      employeeId: '',
      displayName: data.displayName ?? '',
      basicSalary: payroll?.basicSalary ?? 0,
      overtimePay: payroll?.overtimePay ?? null,
      commuterAllowance: payroll?.commuterAllowance ?? null,
      otherAllowance: payroll?.otherAllowance ?? null,
      retroactivePay: payroll?.retroactivePay ?? null,
    } as MonthlyListRow, data),
  };
}

export function getMonthlyListEditValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): BulkEditValue {

  const value = row[column as keyof MonthlyListRow];
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  return null;
}

export function formatMonthlyListCellValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): string {
  if (isPremiumColumn(column)) {
    return formatPremiumCellValue(row, column);
  }

  if (column === 'displayName' || column === 'employeeId') {
    return String(row[column] ?? '');
  }

  const value = row[column as keyof MonthlyListRow];
  if (value == null) return '';
  return Format(value as number);
}

export function monthlyListSortValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): string | number {
  if (isPremiumColumn(column)) {
    return premiumSortValue(row, column);
  }

  const value = row[column as keyof MonthlyListRow];
  if (typeof value === 'number') return value;

  if (value == null) return '';
  return String(value);
}

export function monthlyListSearchText(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): string {
  if (isPremiumColumn(column)) {
    return premiumSearchText(row, column);
  }

  const value = row[column as keyof MonthlyListRow];
  return value == null ? '' : String(value);
}