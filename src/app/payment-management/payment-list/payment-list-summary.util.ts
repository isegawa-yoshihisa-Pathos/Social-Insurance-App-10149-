import {
  aggregateBonusEmployerPremium,
  aggregateMonthlyEmployerPremium,
  aggregateTotalEmployerPremium,
  bonusNetPayment,
  monthlyNetPayment,
  totalNetPayment,
  type EmployerBurdenRoundingSettings,
} from '../../../../shared/payment-summary.util';
import { PaymentListRow } from './payment-list-columns';

export function toMonthlyPayInput(row: PaymentListRow) {
  return {
    basicSalary: row.basicSalary,
    fringeBenefits: row.fringeBenefits,
    bonusRelatedRemuneration: row.bonusRelatedRemuneration,
    allowances: row.allowances,
    retroactivePay: row.retroactivePay,
  };
}

export function toMonthlyPremiumInput(row: PaymentListRow) {
  return {
    healthInsuranceEmployee: row.healthInsuranceEmployee,
    careInsuranceEmployee: row.careInsuranceEmployee,
    pensionInsuranceEmployee: row.pensionInsuranceEmployee,
    healthInsuranceTotal: row.healthInsuranceTotal,
    careInsuranceTotal: row.careInsuranceTotal,
    pensionInsuranceTotal: row.pensionInsuranceTotal,
  };
}

export function toBonusPremiumInput(row: PaymentListRow) {
  return {
    bonus: row.bonus,
    bonusHealthInsuranceEmployee: row.bonusHealthInsuranceEmployee,
    bonusCareInsuranceEmployee: row.bonusCareInsuranceEmployee,
    bonusPensionInsuranceEmployee: row.bonusPensionInsuranceEmployee,
    bonusHealthInsuranceTotal: row.bonusHealthInsuranceTotal,
    bonusCareInsuranceTotal: row.bonusCareInsuranceTotal,
    bonusPensionInsuranceTotal: row.bonusPensionInsuranceTotal,
  };
}

export function paymentListMonthlyNetPayment(row: PaymentListRow): number {
  return monthlyNetPayment(toMonthlyPayInput(row), toMonthlyPremiumInput(row));
}

export function paymentListBonusNetPayment(row: PaymentListRow): number {
  return bonusNetPayment(toBonusPremiumInput(row));
}

export function paymentListTotalNetPayment(row: PaymentListRow): number {
  return totalNetPayment(
    toMonthlyPayInput(row),
    toMonthlyPremiumInput(row),
    toBonusPremiumInput(row),
  );
}

export function paymentListMonthlyEmployerBurden(
  rows: readonly PaymentListRow[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return aggregateMonthlyEmployerPremium(rows.map((row) => toMonthlyPremiumInput(row)), settings);
}

export function paymentListBonusEmployerBurden(
  rows: readonly PaymentListRow[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return aggregateBonusEmployerPremium(rows.map((row) => toBonusPremiumInput(row)), settings);
}

export function paymentListTotalEmployerBurden(
  rows: readonly PaymentListRow[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return aggregateTotalEmployerPremium(
    rows.map((row) => toMonthlyPremiumInput(row)),
    rows.map((row) => toBonusPremiumInput(row)),
    settings,
  );
}

export type { EmployerBurdenRoundingSettings };
