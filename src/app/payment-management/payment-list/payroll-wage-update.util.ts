import { AllowanceTypeDefinition } from '../../payment-document';
import { computeWageSummary } from './wage-summary.util';

export interface PayrollWagePatchInput {
  basicSalary?: number;
  fringeBenefits?: number;
  allowances?: Record<string, number>;
  retroactivePay?: number | null;
}

/** 手当マスタに存在する種別のみを payrollData.allowances として残す */
export function filterPayrollAllowances(
  allowances: Record<string, number>,
  definitions: AllowanceTypeDefinition[],
): Record<string, number> {
  const allowedTypes = new Set(definitions.map((def) => def.type));
  const filtered: Record<string, number> = {};
  for (const [type, amount] of Object.entries(allowances)) {
    if (!allowedTypes.has(type) || typeof amount !== 'number') continue;
    filtered[type] = amount;
  }
  return filtered;
}

export function buildPayrollWageFields(
  current: {
    basicSalary: number;
    fringeBenefits: number;
    allowances: Record<string, number>;
    retroactivePay: number | null;
  },
  patch: PayrollWagePatchInput,
  definitions: AllowanceTypeDefinition[],
): { fixedWage: number; variableWage: number } {
  const mergedAllowances = filterPayrollAllowances(
    patch.allowances ?? current.allowances,
    definitions,
  );
  const merged = {
    basicSalary: patch.basicSalary ?? current.basicSalary,
    fringeBenefits: patch.fringeBenefits ?? current.fringeBenefits,
    allowances: mergedAllowances,
    retroactivePay:
      patch.retroactivePay !== undefined ? patch.retroactivePay : current.retroactivePay,
  };

  return computeWageSummary(merged, definitions);
}
