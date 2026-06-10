import type { BonusTypeDefinition, BonusData } from '../../bonus-document';

/** 健康保険：年度（4月～翌3月）の標準賞与額累計上限（円） */
export const HEALTH_STANDARD_BONUS_ANNUAL_CAP = 5_730_000;

/** 厚生年金：1回の賞与支給における標準賞与額上限（円） */
export const PENSION_STANDARD_BONUS_MONTHLY_CAP = 1_500_000;

/** 支給額の1,000円未満を切り捨てた標準賞与額（健保・厚年共通の算出基礎） */
export function floorToStandardBonusBase(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

export interface BonusPremiumEligibility {
  shouldCalculatePremium: boolean;
  taxableBonusAmount: number;
  reason?: string;
}

export interface DetermineStandardBonusInput {
  /** 賞与支給額（合計。表示・記録用） */
  bonusAmount: number;
  /** 当年度（4月～）における、当月より前に確定した健保標準賞与額の累計 */
  fiscalYearHealthStandardSum: number;
  eligibility?: BonusPremiumEligibility;
}

export interface DeterminedStandardBonus {
  bonusAmount: number;
  rawStandardBonus: number;
  standardBonus: { health: number; pension: number };
}

export interface BonusPremiumEligibilityOptions {
  /**
   * 定時決定で12等分され報酬月額に組み込まれた賞与種別（type キー）。
   * この Set に含まれる low 種別のみ都度徴収をスキップする。
   */
  teijiIncludedBonusTypes?: ReadonlySet<string>;
}

/**
 * 都度徴収の要否を判定する（種別ごと）。
 * - non-labor: 徴収しない
 * - high（マスタ）: 定時決定ルートのため都度徴収しない
 * - low（マスタ）: 通常は都度徴収。定時12等分対象種別のみスキップ
 */
export function evaluateBonusPremiumEligibility(
  bonusData: BonusData,
  defs: readonly BonusTypeDefinition[],
  options?: BonusPremiumEligibilityOptions,
): BonusPremiumEligibility {
  let taxableBonusAmount = 0;
  const skipReasons: string[] = [];

  for (const [type, amount] of Object.entries(bonusData)) {
    if (type === 'total' || typeof amount !== 'number' || amount <= 0) continue;
    const def = defs.find((d) => d.type === type);
    if (!def) continue;

    if (def.target === 'non-labor') {
      skipReasons.push(`${def.label}は労働の対価ではないため徴収対象外`);
      continue;
    }

    if (def.bonusFrequency === 'high') {
      skipReasons.push(
        `${def.label}は年4回以上（high）のため定時決定で月次徴収`,
      );
      continue;
    }

    if (options?.teijiIncludedBonusTypes?.has(type)) {
      skipReasons.push(
        `${def.label}は定時決定で12等分され報酬月額に組み込まれたため都度徴収対象外`,
      );
      continue;
    }

    taxableBonusAmount += amount;
  }

  if (taxableBonusAmount <= 0) {
    return {
      shouldCalculatePremium: false,
      taxableBonusAmount: 0,
      reason: skipReasons.join(' / ') || '徴収対象の賞与がありません',
    };
  }

  return { shouldCalculatePremium: true, taxableBonusAmount };
}

export function determineStandardBonus(
  input: DetermineStandardBonusInput,
): DeterminedStandardBonus {
  if (input.eligibility && !input.eligibility.shouldCalculatePremium) {
    return {
      bonusAmount: input.bonusAmount,
      rawStandardBonus: 0,
      standardBonus: { health: 0, pension: 0 },
    };
  }

  const amount = input.eligibility?.taxableBonusAmount ?? input.bonusAmount;
  const rawStandardBonus = floorToStandardBonusBase(amount);
  const healthRemaining = Math.max(
    0,
    HEALTH_STANDARD_BONUS_ANNUAL_CAP - input.fiscalYearHealthStandardSum,
  );
  const health = Math.min(rawStandardBonus, healthRemaining);
  const pension = Math.min(rawStandardBonus, PENSION_STANDARD_BONUS_MONTHLY_CAP);

  return {
    bonusAmount: amount,
    rawStandardBonus,
    standardBonus: { health, pension },
  };
}
