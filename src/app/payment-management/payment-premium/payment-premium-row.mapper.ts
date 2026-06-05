import { BonusDocument } from '../../bonus-document';
import { MonthlyDocument } from '../../monthly-document';
import { Format } from '../../format-number-jp';
import { PaymentListRow } from '../payment-list/payment-list-columns';
import { PremiumPaymentListColumnKey } from './payment-premium-columns';

export function applyMonthlyPremiumFieldsToRow(
  row: PaymentListRow,
  data: Partial<MonthlyDocument>,
): PaymentListRow {
  const premium = data.premiumData;
  const snapshot = data.calculationSnapshot;

  return {
    ...row,
    standardRemunerationHealth: snapshot?.standardRemuneration.health ?? null,
    standardRemunerationPension: snapshot?.standardRemuneration.pension ?? null,
    healthInsuranceEmployee: premium?.healthInsurance.employee ?? null,
    healthInsuranceEmployer: premium?.healthInsurance.employer ?? null,
    careInsuranceEmployee: premium?.careInsurance.employee ?? null,
    careInsuranceEmployer: premium?.careInsurance.employer ?? null,
    pensionInsuranceEmployee: premium?.pensionInsurance.employee ?? null,
    pensionInsuranceEmployer: premium?.pensionInsurance.employer ?? null,
  };
}

export function applyBonusPremiumFieldsToRow(
  row: PaymentListRow,
  data: Partial<BonusDocument>,
): PaymentListRow {
  const premium = data.premiumData;
  const snapshot = data.calculationSnapshot;

  return {
    ...row,
    standardBonusHealth: snapshot?.standardBonus.health ?? null,
    standardBonusPension: snapshot?.standardBonus.pension ?? null,
    bonusHealthInsuranceEmployee: premium?.healthInsurance.employee ?? null,
    bonusHealthInsuranceEmployer: premium?.healthInsurance.employer ?? null,
    bonusCareInsuranceEmployee: premium?.careInsurance.employee ?? null,
    bonusCareInsuranceEmployer: premium?.careInsurance.employer ?? null,
    bonusPensionInsuranceEmployee: premium?.pensionInsurance.employee ?? null,
    bonusPensionInsuranceEmployer: premium?.pensionInsurance.employer ?? null,
  };
}

export function formatPremiumCellValue(row: PaymentListRow, column: PremiumPaymentListColumnKey): string {
  const value = row[column];
  if (value == null) return '';
  return Format(value);
}

export function premiumSortValue(row: PaymentListRow, column: PremiumPaymentListColumnKey): number {
  return row[column] ?? 0;
}

export function premiumSearchText(row: PaymentListRow, column: PremiumPaymentListColumnKey): string {
  return row[column] == null ? '' : formatPremiumCellValue(row, column);
}
