import {
  AllowanceData,
  AllowanceTypeDefinition,
  DEFAULT_ALLOWANCE_TYPE_DEFINITIONS,
} from '../../payment-document';

export interface WageSummaryInput {
  basicSalary: number;
  allowances: AllowanceData;
  retroactivePay: number | null;
}

export interface WageSummary {
  fixedWage: number;
  variableWage: number;
}

export function computeWageSummary(
  payroll: WageSummaryInput,
  definitions: AllowanceTypeDefinition[] = [...DEFAULT_ALLOWANCE_TYPE_DEFINITIONS],
): WageSummary {
  let fixedAllowances = 0;
  let variableAllowances = 0;

  for (const [type, amount] of Object.entries(payroll.allowances)) {
    if (typeof amount !== 'number' || amount === 0) continue;
    const def = definitions.find((item) => item.type === type);
    const category = def?.wageCategory ?? 'variable';
    if (category === 'fixed') {
      fixedAllowances += amount;
    } else {
      variableAllowances += amount;
    }
  }

  return {
    fixedWage: payroll.basicSalary + fixedAllowances,
    variableWage: variableAllowances,
  };
}

export function totalWageFromSummary(summary: WageSummary): number {
  return summary.fixedWage + summary.variableWage;
}
