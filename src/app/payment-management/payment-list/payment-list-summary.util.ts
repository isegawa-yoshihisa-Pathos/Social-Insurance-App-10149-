import {
  aggregateBonusEmployerPremium,
  aggregateMonthlyEmployerPremium,
  aggregateTotalEmployerPremium,
  paymentDisplayBonusNetPayment,
  paymentDisplayMonthlyNetPayment,
  paymentDisplayTotalNetPayment,
  type EmployerBurdenRoundingSettings,
} from '../../../../shared/payment-summary.util';
import { PaymentListRow } from './payment-list-columns';

/** 表示月に支給する給与（salaryMonth の payrollData） */
export function toMonthlyPayInput(row: PaymentListRow) {
  return {
    basicSalary: row.basicSalary,
    fringeBenefits: row.fringeBenefits,
    bonusRelatedRemuneration: row.bonusRelatedRemuneration,
    allowances: row.allowances,
    retroactivePay: row.retroactivePay,
  };
}

/** 表示月に徴収する月次保険料（premiumMonth の premiumData・本人負担） */
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

/** 表示月に支給する賞与と、その月に徴収する賞与保険料 */
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
  return paymentDisplayMonthlyNetPayment(toMonthlyPayInput(row), toMonthlyPremiumInput(row));
}

export function paymentListBonusNetPayment(row: PaymentListRow): number {
  return paymentDisplayBonusNetPayment(toBonusPremiumInput(row));
}

export function paymentListTotalNetPayment(row: PaymentListRow): number {
  return paymentDisplayTotalNetPayment(
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
