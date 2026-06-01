import type { PayrollData } from '../../monthly-document';

export interface FixedWageInput {
  basicSalary: number;
  overtimePay: number | null;
  commuterAllowance: number | null;
  otherAllowance: number | null;
}

export function computeFixedWage(input: FixedWageInput): number {
  return (
    input.basicSalary +
    (input.overtimePay ?? 0) +
    (input.commuterAllowance ?? 0) +
    (input.otherAllowance ?? 0)
  );
}

export function computeFixedWageFromPayroll(payroll: PayrollData): number {
  return computeFixedWage(payroll);
}