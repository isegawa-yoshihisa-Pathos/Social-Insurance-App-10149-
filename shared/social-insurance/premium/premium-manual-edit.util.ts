import type { PremiumData } from '../../monthly-document';

export const PREMIUM_AMOUNT_COLUMN_KEYS = [
  'healthInsuranceEmployee',
  'healthInsuranceTotal',
  'careInsuranceEmployee',
  'careInsuranceTotal',
  'pensionInsuranceEmployee',
  'pensionInsuranceTotal',
] as const;

export type PremiumAmountColumnKey = (typeof PREMIUM_AMOUNT_COLUMN_KEYS)[number];

export function isPremiumAmountColumn(column: string): column is PremiumAmountColumnKey {
  return (PREMIUM_AMOUNT_COLUMN_KEYS as readonly string[]).includes(column);
}

export function emptyPremiumData(): PremiumData {
  return {
    healthInsurance: { employee: null, total: null },
    careInsurance: { employee: null, total: null },
    pensionInsurance: { employee: null, total: null },
  };
}

export function premiumDataFromRow(row: {
  healthInsuranceEmployee: number | null;
  healthInsuranceTotal: number | null;
  careInsuranceEmployee: number | null;
  careInsuranceTotal: number | null;
  pensionInsuranceEmployee: number | null;
  pensionInsuranceTotal: number | null;
}): PremiumData {
  return {
    healthInsurance: {
      employee: row.healthInsuranceEmployee,
      total: row.healthInsuranceTotal,
    },
    careInsurance: {
      employee: row.careInsuranceEmployee,
      total: row.careInsuranceTotal,
    },
    pensionInsurance: {
      employee: row.pensionInsuranceEmployee,
      total: row.pensionInsuranceTotal,
    },
  };
}

export function applyPremiumAmountColumn(
  premium: PremiumData | undefined,
  column: PremiumAmountColumnKey,
  value: number | null,
): PremiumData {
  const base = premium ?? emptyPremiumData();
  const resolved = value === null ? null : value;

  switch (column) {
    case 'healthInsuranceEmployee':
      return {
        ...base,
        healthInsurance: { ...base.healthInsurance, employee: resolved },
      };
    case 'healthInsuranceTotal':
      return {
        ...base,
        healthInsurance: { ...base.healthInsurance, total: resolved },
      };
    case 'careInsuranceEmployee':
      return {
        ...base,
        careInsurance: { ...base.careInsurance, employee: resolved },
      };
    case 'careInsuranceTotal':
      return {
        ...base,
        careInsurance: { ...base.careInsurance, total: resolved },
      };
    case 'pensionInsuranceEmployee':
      return {
        ...base,
        pensionInsurance: { ...base.pensionInsurance, employee: resolved },
      };
    case 'pensionInsuranceTotal':
      return {
        ...base,
        pensionInsurance: { ...base.pensionInsurance, total: resolved },
      };
  }
}

export function mergePremiumAmountFields(
  premium: PremiumData | undefined,
  fields: Partial<Record<PremiumAmountColumnKey, number>>,
): PremiumData {
  let result = premium ?? emptyPremiumData();
  for (const [column, amount] of Object.entries(fields) as [PremiumAmountColumnKey, number][]) {
    if (amount == null) continue;
    result = applyPremiumAmountColumn(result, column, amount);
  }
  return result;
}
