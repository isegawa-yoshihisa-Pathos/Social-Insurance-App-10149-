import { MonthlyDocument } from '../../monthly-document';
import { Format } from '../../format-number-jp';
import { MonthlyListRow } from '../monthly-list/monthly-list-columns';
import { PremiumMonthlyListColumnKey } from './monthly-premium-columns';

export function applyPremiumFieldsToRow(
  row: MonthlyListRow,
  data: Partial<MonthlyDocument>,
): MonthlyListRow {
  const premium = data.premiumData;
  const snapshot = data.calculationSnapshot;

  return {
    ...row,
    standardRemunerationHealth: snapshot?.standardRemuneration.health ?? null,
    standardRemunerationPension: snapshot?.standardRemuneration.pension ?? null,
    healthInsuranceEmployee: premium?.healthInsurance.employee ?? null,
    healthInsuranceTotal: premium?.healthInsurance.total ?? null,
    careInsuranceEmployee: premium?.careInsurance.employee ?? null,
    careInsuranceTotal: premium?.careInsurance.total ?? null,
    pensionInsuranceEmployee: premium?.pensionInsurance.employee ?? null,
    pensionInsuranceTotal: premium?.pensionInsurance.total ?? null,
  };
}

export function formatPremiumCellValue(row: MonthlyListRow, column: PremiumMonthlyListColumnKey): string {
  const value = row[column];
  if (value == null) return '';
  return Format(value);
}

export function premiumSortValue(row: MonthlyListRow, column: PremiumMonthlyListColumnKey): number {
  return row[column] ?? 0;
}

export function premiumSearchText(row: MonthlyListRow, column: PremiumMonthlyListColumnKey): string {
  return row[column] == null ? '' : formatPremiumCellValue(row, column);
}
