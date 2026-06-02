import type { PayrollData } from '../../monthly-document';

export interface FixedWageInput {
  basicSalary: number;
  commuterAllowance: number | null;
  otherAllowance: number | null;
}

export function computeFixedWage(input: FixedWageInput): number {
  return (
    input.basicSalary +
    (input.commuterAllowance ?? 0) +
    (input.otherAllowance ?? 0)
  );
}

export function computeFixedWageFromPayroll(payroll: PayrollData): number {
  return computeFixedWage(payroll);
}