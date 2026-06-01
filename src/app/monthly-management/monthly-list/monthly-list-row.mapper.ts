import { BonusTypeDefinition, MonthlyDocument } from '../../monthly-document';
import {
  buildBonusDisplayParts,
  bonusTypeFromColumnKey,
} from './bonus-display.util';
import { extractBonusAmounts } from './bonus-data.util';
import { BulkEditValue } from './monthly-bulk-edit.types';
import { MonthlyListColumnKey, MonthlyListRow } from './monthly-list-columns';
import { Format } from '../../format-number-jp';

export function toMonthlyListRow(
  eid: string,
  data: Partial<MonthlyDocument>,
  bonusTypeDefinitions: BonusTypeDefinition[],
): MonthlyListRow {
  const payroll = data.payrollData;
  const bonus = data.bonusData ? extractBonusAmounts(data.bonusData) : {};
  const bonusParts = buildBonusDisplayParts(bonus, bonusTypeDefinitions);

  return {
    eid,
    employeeId: '',
    displayName: data.displayName ?? '',
    totalPay: payroll?.totalPay ?? 0,
    basicSalary: payroll?.basicSalary ?? 0,
    overtimePay: payroll?.overtimePay ?? null,
    commuterAllowance: payroll?.commuterAllowance ?? null,
    otherAllowance: payroll?.otherAllowance ?? null,
    retroactivePay: payroll?.retroactivePay ?? null,
    bonus,
    bonusDisplay: bonusParts.display,
    bonusTooltip: bonusParts.tooltip,
    bonusTotal: bonusParts.total,
  };
}

export function getMonthlyListEditValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): BulkEditValue {
  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
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
): string {
  if (column === 'bonus') {
    return row.bonusTotal === 0 ? '' : Format(row.bonusTotal);
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : Format(amount);
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
  if (column === 'bonus') {
    return row.bonusTotal;
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    return row.bonus[bonusType] ?? 0;
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
  if (column === 'bonus') {
    return row.bonusDisplay;
  }
  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : formatMonthlyListCellValue(row, column);
  }
  const value = row[column as keyof MonthlyListRow];
  return value == null ? '' : String(value);
}