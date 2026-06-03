/** 健康保険：年度（4月～翌3月）の標準賞与額累計上限（円） */
export const HEALTH_STANDARD_BONUS_ANNUAL_CAP = 5_730_000;

/** 厚生年金：1回の賞与支給における標準賞与額上限（円） */
export const PENSION_STANDARD_BONUS_MONTHLY_CAP = 1_500_000;

/** 支給額の1,000円未満を切り捨てた標準賞与額（健保・厚年共通の算出基礎） */
export function floorToStandardBonusBase(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

export interface DetermineStandardBonusInput {
  /** 賞与支給額（合計） */
  bonusAmount: number;
  /** 当年度（4月～）における、当月より前に確定した健保標準賞与額の累計 */
  fiscalYearHealthStandardSum: number;
}

export interface DeterminedStandardBonus {
  bonusAmount: number;
  rawStandardBonus: number;
  standardBonus: { health: number; pension: number };
}

export function determineStandardBonus(
  input: DetermineStandardBonusInput,
): DeterminedStandardBonus {
  const rawStandardBonus = floorToStandardBonusBase(input.bonusAmount);
  const healthRemaining = Math.max(
    0,
    HEALTH_STANDARD_BONUS_ANNUAL_CAP - input.fiscalYearHealthStandardSum,
  );
  const health = Math.min(rawStandardBonus, healthRemaining);
  const pension = Math.min(rawStandardBonus, PENSION_STANDARD_BONUS_MONTHLY_CAP);

  return {
    bonusAmount: input.bonusAmount,
    rawStandardBonus,
    standardBonus: { health, pension },
  };
}
