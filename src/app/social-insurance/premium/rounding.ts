/**
 * 社会保険料の端数処理（第1フェーズ）。
 *
 * - statutoryHalfYen: 50銭未満切捨て・50銭以上1円未満切上げ（法令端数）
 * - roundDown: 円未満切捨て（事業所独自・簡易）
 */

export type RoundingRule = 'statutoryHalfYen' | 'roundDown';

/** 法令の50銭端数（円単位の小数を想定） */
export function roundStatutoryHalfYen(amountYen: number): number {
  if (!Number.isFinite(amountYen) || amountYen <= 0) {
    return 0;
  }

  const totalSen = Math.round(amountYen * 100);
  const yenPart = Math.floor(totalSen / 100);
  const senPart = totalSen % 100;

  if (senPart < 50) {
    return yenPart;
  }
  return yenPart + 1;
}

export function applyRoundingRule(amountYen: number, rule: RoundingRule): number {
  if (amountYen <= 0) {
    return 0;
  }
  switch (rule) {
    case 'roundDown':
      return Math.floor(amountYen);
    case 'statutoryHalfYen':
    default:
      return roundStatutoryHalfYen(amountYen);
  }
}

export interface SplitPremiumResult {
  total: number;
  employer: number;
  employee: number;
}

/**
 * 保険料総額を労使で按分（既定は折半）。
 * 本人分を端数処理後、事業主分 = 総額 - 本人分 で総額を一致させる。
 */
export function splitPremiumEmployerEmployee(
  totalPremiumYen: number,
  options?: {
    employerShare?: number;
    roundingRule?: RoundingRule;
  },
): SplitPremiumResult {
  const employerShare = options?.employerShare ?? 0.5;
  const roundingRule = options?.roundingRule ?? 'statutoryHalfYen';

  if (totalPremiumYen <= 0) {
    return { total: 0, employer: 0, employee: 0 };
  }

  const total = applyRoundingRule(totalPremiumYen, roundingRule);
  const employeeShare = 1 - employerShare;
  const employee = applyRoundingRule(total * employeeShare, roundingRule);
  const employer = total - employee;

  return { total, employer, employee };
}

/** 標準報酬月額 × 料率 → 総額 → 折半 */
export function premiumFromStandardRemuneration(
  standardRemuneration: number,
  rate: number,
  options?: {
    employerShare?: number;
    roundingRule?: RoundingRule;
  },
): SplitPremiumResult {
  const rawTotal = standardRemuneration * rate;
  return splitPremiumEmployerEmployee(rawTotal, options);
}