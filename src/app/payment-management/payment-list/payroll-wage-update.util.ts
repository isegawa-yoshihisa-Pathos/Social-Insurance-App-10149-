import { AllowanceTypeDefinition } from '../../payment-document';
import { computeWageSummary } from './wage-summary.util';

export interface PayrollWagePatchInput {
  basicSalary?: number;
  allowances?: Record<string, number>;
  retroactivePay?: number | null;
}

export function buildPayrollWageFields(
  current: {
    basicSalary: number;
    allowances: Record<string, number>;
    retroactivePay: number | null;
  },
  patch: PayrollWagePatchInput,
  definitions: AllowanceTypeDefinition[],
): { fixedWage: number; variableWage: number } {
  const merged = {
    basicSalary: patch.basicSalary ?? current.basicSalary,
    allowances: patch.allowances ?? current.allowances,
    retroactivePay:
      patch.retroactivePay !== undefined ? patch.retroactivePay : current.retroactivePay,
  };

  return computeWageSummary(merged, definitions);
}
