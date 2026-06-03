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
    healthInsuranceEmployer: premium?.healthInsurance.employer ?? null,
    careInsuranceEmployee: premium?.careInsurance.employee ?? null,
    careInsuranceEmployer: premium?.careInsurance.employer ?? null,
    pensionInsuranceEmployee: premium?.pensionInsurance.employee ?? null,
    pensionInsuranceEmployer: premium?.pensionInsurance.employer ?? null,
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