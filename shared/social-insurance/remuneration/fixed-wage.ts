import type { PayrollData } from '../../monthly-document';

export function computeFixedWageFromPayroll(payroll: PayrollData): number {
  if (payroll.fixedWage != null) {
    return payroll.fixedWage;
  }
  return payroll.basicSalary;
}

export function computeTotalRemunerationFromPayroll(payroll: PayrollData): number {
  const fixed = payroll.fixedWage ?? payroll.basicSalary ?? 0;
  const variable = payroll.variableWage ?? 0;
  return fixed + variable;
}

export function computeVariableWageFromPayroll(payroll: PayrollData): number {
  return payroll.variableWage ?? 0;
}

export function computeFixedWageFromPayrollOrThrow(payroll: PayrollData): number {
  return computeFixedWageFromPayroll(payroll);
}