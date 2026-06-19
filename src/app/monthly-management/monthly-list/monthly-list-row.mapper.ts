import { MonthlyDocument } from '../../monthly-document';
import { AllowanceTypeDefinition } from '../../payment-document';
import { BulkEditValue } from './monthly-bulk-edit.types';
import { MonthlyListColumnKey, MonthlyListRow } from './monthly-list-columns';
import { Format } from '../../format-number-jp';
import { isPremiumColumn } from '../monthly-premium/monthly-premium-columns';
import { applyPremiumFieldsToRow, formatPremiumCellValue, premiumSortValue, premiumSearchText } from '../monthly-premium/monthly-premium-row.mapper';
import { allowanceTypeFromColumnKey } from '../../payment-management/payment-list/allowance-display.util';
import { MONTHLY_NET_PAYMENT_COLUMN_KEY } from './monthly-list-columns';
import { monthlyNetPayment } from '../../../../shared/payment-summary.util';

function monthlyRowNetPayment(row: MonthlyListRow): number {
  return monthlyNetPayment(row, row);
}

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
      paymentBaseDays: data.paymentBaseDays ?? 0,
      basicSalary: payroll?.basicSalary ?? 0,
      fringeBenefits: payroll?.fringeBenefits ?? 0,
      bonusRelatedRemuneration: data.bonusRelatedRemuneration ?? 0,
      fixedWage: payroll?.fixedWage ?? null,
      variableWage: payroll?.variableWage ?? null,
      allowances: payroll?.allowances ?? {},
      retroactivePay: payroll?.retroactivePay ?? null,
    } as MonthlyListRow, data),
  };
}

export function getMonthlyListEditValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): BulkEditValue {
  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    const amount = row.allowances[allowanceType] ?? 0;
    return amount === 0 ? null : amount;
  }

  const value = row[column as keyof MonthlyListRow];
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  return null;
}

export function formatMonthlyListCellValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
  allowanceDefinitions: AllowanceTypeDefinition[] = [],
): string {
  if (isPremiumColumn(column)) {
    return formatPremiumCellValue(row, column);
  }

  if (column === MONTHLY_NET_PAYMENT_COLUMN_KEY) {
    const amount = monthlyRowNetPayment(row);
    return amount === 0 ? '' : Format(amount);
  }

  if (column === 'displayName' || column === 'employeeId') {
    return String(row[column] ?? '');
  }

  if (column === 'fixedWage' || column === 'variableWage') {
    const value = row[column];
    return value == null ? '' : Format(value);
  }

  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    const amount = row.allowances[allowanceType] ?? 0;
    return amount === 0 ? '' : Format(amount);
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

  if (column === MONTHLY_NET_PAYMENT_COLUMN_KEY) {
    return monthlyRowNetPayment(row);
  }

  if (column === 'fixedWage' || column === 'variableWage') {
    return row[column] ?? 0;
  }

  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    return row.allowances[allowanceType] ?? 0;
  }

  const value = row[column as keyof MonthlyListRow];
  if (typeof value === 'number') return value;

  if (value == null) return '';
  return String(value);
}

export function monthlyListNumericValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): number | null {
  const value = monthlyListSortValue(row, column);
  return typeof value === 'number' ? value : null;
}

export function isSummableMonthlyListColumn(
  column: MonthlyListColumnKey,
): boolean {
  return column !== 'displayName' && column !== 'employeeId';
}

export type MonthlyDetailColumnKey = MonthlyListColumnKey | 'yyyyMm';

export function monthlyDetailSearchText(
  row: { yyyyMm: string } & MonthlyListRow,
  column: MonthlyDetailColumnKey,
): string {
  if (column === 'yyyyMm') {
    const [year, month] = row.yyyyMm.split('-');
    return `${row.yyyyMm} ${year}年${parseInt(month, 10)}月`;
  }
  return monthlyListSearchText(row, column);
}

export function monthlyListSearchText(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): string {
  if (isPremiumColumn(column)) {
    return premiumSearchText(row, column);
  }

  if (column === MONTHLY_NET_PAYMENT_COLUMN_KEY) {
    const amount = monthlyRowNetPayment(row);
    return amount === 0 ? '' : Format(amount);
  }

  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    const amount = row.allowances[allowanceType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  const value = row[column as keyof MonthlyListRow];
  return value == null ? '' : String(value);
}