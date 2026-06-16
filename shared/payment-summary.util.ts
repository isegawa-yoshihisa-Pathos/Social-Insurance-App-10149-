import type { AllowanceData } from './payment-document';
import type { BonusAmountMap } from './bonus-document';

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
  healthInsuranceEmployer: number | null;
  careInsuranceEmployer: number | null;
  pensionInsuranceEmployer: number | null;
}

export interface BonusPremiumInput {
  bonus: BonusAmountMap;
  bonusHealthInsuranceEmployee: number | null;
  bonusCareInsuranceEmployee: number | null;
  bonusPensionInsuranceEmployee: number | null;
  bonusHealthInsuranceEmployer: number | null;
  bonusCareInsuranceEmployer: number | null;
  bonusPensionInsuranceEmployer: number | null;
}

export function monthlyGrossPay(input: MonthlyPayInput): number {
  return (
    input.basicSalary
    + input.fringeBenefits
    + (input.bonusRelatedRemuneration ?? 0)
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

export function monthlyEmployerPremium(input: MonthlyPremiumInput): number {
  return (
    premiumAmount(input.healthInsuranceEmployer)
    + premiumAmount(input.careInsuranceEmployer)
    + premiumAmount(input.pensionInsuranceEmployer)
  );
}

export function monthlyNetPayment(
  pay: MonthlyPayInput,
  premium: MonthlyPremiumInput,
): number {
  return monthlyGrossPay(pay) - monthlyEmployeePremium(premium);
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

export function bonusEmployerPremium(input: BonusPremiumInput): number {
  return (
    premiumAmount(input.bonusHealthInsuranceEmployer)
    + premiumAmount(input.bonusCareInsuranceEmployer)
    + premiumAmount(input.bonusPensionInsuranceEmployer)
  );
}

export function bonusNetPayment(input: BonusPremiumInput): number {
  return bonusGrossPay(input.bonus) - bonusEmployeePremium(input);
}

export function totalNetPayment(
  pay: MonthlyPayInput,
  monthlyPremium: MonthlyPremiumInput,
  bonusPremium: BonusPremiumInput,
): number {
  return monthlyNetPayment(pay, monthlyPremium) + bonusNetPayment(bonusPremium);
}

export function totalEmployerPremium(
  monthlyPremium: MonthlyPremiumInput,
  bonusPremium: BonusPremiumInput,
): number {
  return monthlyEmployerPremium(monthlyPremium) + bonusEmployerPremium(bonusPremium);
}
