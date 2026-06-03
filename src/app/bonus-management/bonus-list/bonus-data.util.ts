import { BonusAmountMap, BonusData } from '../../bonus-document';

export const BONUS_DATA_TOTAL_KEY = 'total';

export function sumBonusAmounts(amounts: BonusAmountMap): number {
  return Object.values(amounts).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

export function extractBonusAmounts(bonusData: BonusData): BonusAmountMap {
  const amounts: BonusAmountMap = {};
  for (const [key, value] of Object.entries(bonusData)) {
    if (key === BONUS_DATA_TOTAL_KEY) continue;
    if (typeof value === 'number') {
      amounts[key] = value;
    }
  }
  return amounts;
}

export function buildBonusData(amounts: BonusAmountMap): BonusData | undefined {
  const filtered = Object.fromEntries(
    Object.entries(amounts).filter(([, amount]) => (amount ?? 0) !== 0),
  ) as BonusAmountMap;

  if (Object.keys(filtered).length === 0) {
    return undefined;
  }

  return {
    total: sumBonusAmounts(filtered),
    ...filtered,
  };
}
