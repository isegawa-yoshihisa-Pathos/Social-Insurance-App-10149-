import type { MonthlyRemunerationSource } from './remuneration-month-input';
import {
  resolveBonusRelatedRemunerationForAverage,
  toMonthPaymentBaseInput,
} from './remuneration-month-input';

export type EmploymentType =
  | 'full-time'
  | 'short-time-worker'
  | 'short-time-labor';

export type PaymentBaseDaysTier = 'primary' | 'secondary' | 'none';

export interface PaymentBaseDaysThresholds {
  /** 第1段階の下限（一般・短時間就労者: 17、短時間労働者: 11） */
  primaryMinDays: number;
  /** 短時間就労者のみ: 15日以上17日未満 */
  secondaryMinDays?: number;
}

export interface MonthPaymentBaseInput {
  yyyyMm: string;
  paymentBaseDays: number;
  remuneration: number;
}

export interface RemunerationAverageSelectionResult {
  usedMonths: MonthPaymentBaseInput[];
  tier: PaymentBaseDaysTier;
  averageRemuneration: number;
}

export type RemunerationAverageSelectionOutcome =
  | { kind: 'calculated'; result: RemunerationAverageSelectionResult }
  | { kind: 'continue_previous'; reason: 'all_months_below_secondary' };

export function getPaymentBaseDaysThresholds(
  category: EmploymentType,
): PaymentBaseDaysThresholds {
  switch (category) {
    case 'short-time-labor':
      return { primaryMinDays: 11 };
    case 'short-time-worker':
      return { primaryMinDays: 17, secondaryMinDays: 15 };
    case 'full-time':
    default:
      return { primaryMinDays: 17 };
  }
}

/** 1ヶ月がどの段階に入るか（短時間就労者は secondary あり） */
export function classifyPaymentBaseDaysTier(
  category: EmploymentType,
  days: number,
): PaymentBaseDaysTier {
  const { primaryMinDays, secondaryMinDays } = getPaymentBaseDaysThresholds(category);

  if (days >= primaryMinDays) return 'primary';
  if (
    category === 'short-time-worker' &&
    secondaryMinDays != null &&
    days >= secondaryMinDays &&
    days < primaryMinDays
  ) {
    return 'secondary';
  }
  return 'none';
}

/** 支払基礎日数がどのtierに該当するか */
export function isMonthEligibleForAverage(
  category: EmploymentType,
  days: number,
  tier: PaymentBaseDaysTier,
): boolean {
  return classifyPaymentBaseDaysTier(category, days) === tier;
}

/**
 * 随時改定用: 3ヶ月すべてが primary 段階（一般・短時間就労者: 17日以上、短時間労働者: 11日以上）を満たす場合のみ平均。
 */
export function selectMonthsForZuijiAverage(
  category: EmploymentType,
  months: readonly MonthlyRemunerationSource[],
): RemunerationAverageSelectionOutcome {
  if (months.length !== 3) {
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }
  const allPrimary = months.every(
    (m) => {
      const paymentBaseDays = m.paymentBaseDays;
      return classifyPaymentBaseDaysTier(category, paymentBaseDays) === 'primary';
    }
  );
  if (!allPrimary) {
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }
  return {
    kind: 'calculated',
    result: buildPayrollAverage(months, 'primary'),
  };
}

/**
 * 産休・育休明けの標準報酬月額調整用。
 * - 復職後3カ月のうち、支払基礎日数が基準未満の月は平均から除外する。
 * - 3カ月いずれも基準未満の短時間就労者は、15日以上17日未満の月で平均する。
 */
export function selectMonthsForLeaveReturnAverage(
  category: EmploymentType,
  months: readonly MonthlyRemunerationSource[],
): RemunerationAverageSelectionOutcome {
  if (months.length !== 3) {
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }

  const primary = months.filter(
    (m) => classifyPaymentBaseDaysTier(category, m.paymentBaseDays) === 'primary',
  );
  if (primary.length > 0) {
    return {
      kind: 'calculated',
      result: buildPayrollAverage(primary, 'primary'),
    };
  }

  if (category === 'short-time-worker') {
    const secondary = months.filter(
      (m) => classifyPaymentBaseDaysTier(category, m.paymentBaseDays) === 'secondary',
    );
    if (secondary.length > 0) {
      return {
        kind: 'calculated',
        result: buildPayrollAverage(secondary, 'secondary'),
      };
    }
  }

  return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
}

/**
 * 定時決定用: 条件を満たす月が1ヶ月でもあればその月（複数ならそれら）で平均。months は通常 4・5・6 月。
 * 報酬月額 = 対象月の給与（固定＋変動）の平均 ＋ 賞与に係る報酬（月額1つ）。
 */
export function selectMonthsForRemunerationAverageSelection(
  category: EmploymentType,
  months: readonly MonthlyRemunerationSource[],
): RemunerationAverageSelectionOutcome {
  /** 4，5，6月の支払基礎日数が基準に満たない場合は前回の決定を継続 */
  if (months.length === 0) {
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }

  const primary = months.filter((m) =>
    isMonthEligibleForAverage(category, m.paymentBaseDays, 'primary'),
  );
  /** 4，5，6月の支払基礎日数がひと月でも基準（17日、11日以上）に満たす月があればその月で平均 */
  if (primary.length > 0) {
    return {
      kind: 'calculated',
      result: buildPayrollAverage(primary, 'primary'),
    };
  }

  /** 短時間就労者の場合は15日以上17日未満の月で平均（secondaryを考慮） */
  if (category === 'short-time-worker') {
    const secondary = months.filter((m) =>
      isMonthEligibleForAverage(category, m.paymentBaseDays, 'secondary'),
    );
    if (secondary.length > 0) {
      return {
        kind: 'calculated',
        result: buildPayrollAverage(secondary, 'secondary'),
      };
    }
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }

  return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
}

function buildPayrollAverage(
  usedMonths: readonly MonthlyRemunerationSource[],
  tier: PaymentBaseDaysTier,
): RemunerationAverageSelectionResult {
  const inputs = usedMonths.map((m) =>
    toMonthPaymentBaseInput(m, { includeVariable: true, includeBonusRelatedRemuneration: false }),
  );
  const payrollTotal = inputs.reduce((s, m) => s + m.remuneration, 0);
  const bonusRelatedRemuneration = resolveBonusRelatedRemunerationForAverage(usedMonths);
  return {
    usedMonths: inputs,
    tier,
    averageRemuneration: payrollTotal / usedMonths.length + bonusRelatedRemuneration,
  };
}