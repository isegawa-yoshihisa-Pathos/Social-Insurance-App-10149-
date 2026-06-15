import type { PayrollData } from '../../monthly-document';

export function computeFixedWageFromPayroll(payroll: PayrollData): number {
  if (payroll.fixedWage != null) {
    return payroll.fixedWage;
  }

  return payroll.basicSalary + payroll.fringeBenefits;
}
