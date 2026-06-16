import {
  bonusEmployerPremium,
  bonusNetPayment,
  monthlyEmployerPremium,
  monthlyNetPayment,
  totalEmployerPremium,
  totalNetPayment,
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
    healthInsuranceEmployer: row.healthInsuranceEmployer,
    careInsuranceEmployer: row.careInsuranceEmployer,
    pensionInsuranceEmployer: row.pensionInsuranceEmployer,
  };
}

export function toBonusPremiumInput(row: PaymentListRow) {
  return {
    bonus: row.bonus,
    bonusHealthInsuranceEmployee: row.bonusHealthInsuranceEmployee,
    bonusCareInsuranceEmployee: row.bonusCareInsuranceEmployee,
    bonusPensionInsuranceEmployee: row.bonusPensionInsuranceEmployee,
    bonusHealthInsuranceEmployer: row.bonusHealthInsuranceEmployer,
    bonusCareInsuranceEmployer: row.bonusCareInsuranceEmployer,
    bonusPensionInsuranceEmployer: row.bonusPensionInsuranceEmployer,
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

export function paymentListMonthlyEmployerBurden(row: PaymentListRow): number {
  return monthlyEmployerPremium(toMonthlyPremiumInput(row));
}

export function paymentListBonusEmployerBurden(row: PaymentListRow): number {
  return bonusEmployerPremium(toBonusPremiumInput(row));
}

export function paymentListTotalEmployerBurden(row: PaymentListRow): number {
  return totalEmployerPremium(toMonthlyPremiumInput(row), toBonusPremiumInput(row));
}
