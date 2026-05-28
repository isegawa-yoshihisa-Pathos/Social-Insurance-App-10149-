import { MonthlyDocument } from '../../monthly-document';
import {
  buildBonusDisplayParts,
  bonusTypeFromColumnKey,
  formatBonusAmount,
  normalizeBonusMap,
} from './bonus-display.util';
import { MonthlyListColumnKey, MonthlyListRow } from './monthly-list-columns';

export function toMonthlyListRow(
  eid: string,
  data: Partial<MonthlyDocument>,
): MonthlyListRow {
  const payroll = data.payrollData;
  const premium = data.premiumData;
  const bonus = normalizeBonusMap(data.bonusData?.bonus);
  const bonusParts = buildBonusDisplayParts(bonus);

  return {
    eid,
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
    healthInsurance_employer: premium?.healthInsurance?.employer ?? 0,
    healthInsurance_employee: premium?.healthInsurance?.employee ?? 0,
    careInsurance_employer: premium?.careInsurance?.employer ?? null,
    careInsurance_employee: premium?.careInsurance?.employee ?? null,
    pensionInsurance_employer: premium?.pensionInsurance?.employer ?? 0,
    pensionInsurance_employee: premium?.pensionInsurance?.employee ?? 0,
  };
}

export function formatMonthlyListCellValue(
  row: MonthlyListRow,
  column: MonthlyListColumnKey,
): string {
  if (column === 'bonus') {
    return row.bonusDisplay;
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : formatBonusAmount(amount);
  }

  const value = row[column as keyof MonthlyListRow];
  if (value == null) return '';
  return String(value);
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
