import type { AllowanceData } from './payment-document';
import type { BonusAmountMap } from './bonus-document';
import {
  aggregateEmployerPremiumBurden,
  type AggregatePremiumRow,
  type EmployerBurdenRoundingSettings,
} from './social-insurance/premium/employer-premium-aggregate';

export function premiumAmount(value: number | null | undefined): number {
  return value ?? 0;
}

function sumAllowanceAmounts(amounts: AllowanceData): number {
  return Object.values(amounts).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

function sumBonusAmounts(amounts: BonusAmountMap): number {
  return Object.values(amounts).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

export interface MonthlyPayInput {
  basicSalary: number;
  fringeBenefits: number;
  bonusRelatedRemuneration?: number;
  allowances?: AllowanceData;
  retroactivePay?: number | null;
}

export interface MonthlyPremiumInput {
  healthInsuranceEmployee: number | null;
  careInsuranceEmployee: number | null;
  pensionInsuranceEmployee: number | null;
  healthInsuranceTotal: number | null;
  careInsuranceTotal: number | null;
  pensionInsuranceTotal: number | null;
}

export interface BonusPremiumInput {
  bonus: BonusAmountMap;
  bonusHealthInsuranceEmployee: number | null;
  bonusCareInsuranceEmployee: number | null;
  bonusPensionInsuranceEmployee: number | null;
  bonusHealthInsuranceTotal: number | null;
  bonusCareInsuranceTotal: number | null;
  bonusPensionInsuranceTotal: number | null;
}

export function toAggregatePremiumRow(input: {
  healthInsuranceEmployee: number | null;
  healthInsuranceTotal: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceTotal: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceTotal: number | null;
}): AggregatePremiumRow {
  return {
    healthInsurance: {
      employee: input.healthInsuranceEmployee,
      total: input.healthInsuranceTotal,
    },
    careInsurance: {
      employee: input.careInsuranceEmployee,
      total: input.careInsuranceTotal,
    },
    pensionInsurance: {
      employee: input.pensionInsuranceEmployee,
      total: input.pensionInsuranceTotal,
    },
  };
}

export function monthlyGrossPay(input: MonthlyPayInput): number {
  return (
    input.basicSalary
    + input.fringeBenefits
    + sumAllowanceAmounts(input.allowances ?? {})
    + (input.retroactivePay ?? 0)
  );
}

export function monthlyEmployeePremium(input: MonthlyPremiumInput): number {
  return (
    premiumAmount(input.healthInsuranceEmployee)
    + premiumAmount(input.careInsuranceEmployee)
    + premiumAmount(input.pensionInsuranceEmployee)
  );
}

export function aggregateMonthlyEmployerPremium(
  rows: readonly MonthlyPremiumInput[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return aggregateEmployerPremiumBurden(
    rows.map((row) => toAggregatePremiumRow(row)),
    settings,
  );
}

export function monthlyNetPayment(
  pay: MonthlyPayInput,
  premium: MonthlyPremiumInput,
): number {
  return monthlyGrossPay(pay) - monthlyEmployeePremium(premium);
}

/** 給与管理: 表示月に支給する給与 − その月に徴収する月次保険料（本人負担） */
export function paymentDisplayMonthlyNetPayment(
  pay: MonthlyPayInput,
  premium: MonthlyPremiumInput,
): number {
  return monthlyNetPayment(pay, premium);
}

export function bonusGrossPay(bonus: BonusAmountMap): number {
  return sumBonusAmounts(bonus);
}

export function bonusEmployeePremium(input: BonusPremiumInput): number {
  return (
    premiumAmount(input.bonusHealthInsuranceEmployee)
    + premiumAmount(input.bonusCareInsuranceEmployee)
    + premiumAmount(input.bonusPensionInsuranceEmployee)
  );
}

export function aggregateBonusEmployerPremium(
  rows: readonly BonusPremiumInput[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return aggregateEmployerPremiumBurden(
    rows.map((row) => toAggregatePremiumRow({
      healthInsuranceEmployee: row.bonusHealthInsuranceEmployee,
      healthInsuranceTotal: row.bonusHealthInsuranceTotal,
      careInsuranceEmployee: row.bonusCareInsuranceEmployee,
      careInsuranceTotal: row.bonusCareInsuranceTotal,
      pensionInsuranceEmployee: row.bonusPensionInsuranceEmployee,
      pensionInsuranceTotal: row.bonusPensionInsuranceTotal,
    })),
    settings,
  );
}

export function bonusNetPayment(input: BonusPremiumInput): number {
  return bonusGrossPay(input.bonus) - bonusEmployeePremium(input);
}

/** 給与管理: 表示月に支給する賞与 − その月に徴収する賞与保険料（本人負担） */
export function paymentDisplayBonusNetPayment(input: BonusPremiumInput): number {
  return bonusNetPayment(input);
}

export function totalNetPayment(
  pay: MonthlyPayInput,
  monthlyPremium: MonthlyPremiumInput,
  bonusPremium: BonusPremiumInput,
): number {
  return monthlyNetPayment(pay, monthlyPremium) + bonusNetPayment(bonusPremium);
}

/** 給与管理: 月次総支払 + 賞与総支払 */
export function paymentDisplayTotalNetPayment(
  pay: MonthlyPayInput,
  monthlyPremium: MonthlyPremiumInput,
  bonusPremium: BonusPremiumInput,
): number {
  return paymentDisplayMonthlyNetPayment(pay, monthlyPremium)
    + paymentDisplayBonusNetPayment(bonusPremium);
}

export function aggregateTotalEmployerPremium(
  monthlyRows: readonly MonthlyPremiumInput[],
  bonusRows: readonly BonusPremiumInput[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return (
    aggregateMonthlyEmployerPremium(monthlyRows, settings)
    + aggregateBonusEmployerPremium(bonusRows, settings)
  );
}

export type { EmployerBurdenRoundingSettings };
