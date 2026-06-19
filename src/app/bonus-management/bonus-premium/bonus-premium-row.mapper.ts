import { BonusDocument } from '../../bonus-document';
import { Format } from '../../format-number-jp';
import { BonusListRow } from '../bonus-list/bonus-list-columns';
import { PremiumBonusListColumnKey } from './bonus-premium-columns';

export function applyPremiumFieldsToRow(
  row: BonusListRow,
  data: Partial<BonusDocument>,
): BonusListRow {
  const premium = data.premiumData;
  const snapshot = data.calculationSnapshot;

  return {
    ...row,
    standardBonusHealth: snapshot?.standardBonus.health ?? null,
    standardBonusPension: snapshot?.standardBonus.pension ?? null,
    healthInsuranceEmployee: premium?.healthInsurance.employee ?? null,
    healthInsuranceTotal: premium?.healthInsurance.total ?? null,
    careInsuranceEmployee: premium?.careInsurance.employee ?? null,
    careInsuranceTotal: premium?.careInsurance.total ?? null,
    pensionInsuranceEmployee: premium?.pensionInsurance.employee ?? null,
    pensionInsuranceTotal: premium?.pensionInsurance.total ?? null,
  };
}

export function formatPremiumCellValue(row: BonusListRow, column: PremiumBonusListColumnKey): string {
  const value = row[column];
  if (value == null) return '';
  return Format(value);
}

export function premiumSortValue(row: BonusListRow, column: PremiumBonusListColumnKey): number {
  return row[column] ?? 0;
}

export function premiumSearchText(row: BonusListRow, column: PremiumBonusListColumnKey): string {
  return row[column] == null ? '' : formatPremiumCellValue(row, column);
}
