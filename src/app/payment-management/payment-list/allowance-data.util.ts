import { AllowanceData, AllowanceTypeDefinition } from '../../payment-document';

export function sumAllowanceAmounts(amounts: AllowanceData): number {
  return Object.values(amounts).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

export function extractAllowanceAmounts(allowanceData: AllowanceData): AllowanceData {
  const amounts: AllowanceData = {};
  for (const [key, value] of Object.entries(allowanceData)) {
    if (typeof value === 'number') {
      amounts[key] = value;
    }
  }
  return amounts;
}

export function buildAllowanceData(amounts: AllowanceData): AllowanceData | undefined {
  const filtered = Object.fromEntries(
    Object.entries(amounts).filter(([, amount]) => (amount ?? 0) !== 0),
  ) as AllowanceData;

  if (Object.keys(filtered).length === 0) {
    return undefined;
  }

  return {
    total: sumAllowanceAmounts(filtered),
    ...filtered,
  };
}
