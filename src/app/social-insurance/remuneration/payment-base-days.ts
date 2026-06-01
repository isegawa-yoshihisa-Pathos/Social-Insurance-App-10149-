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
  /** 平均に使った月 */
  usedMonths: MonthPaymentBaseInput[];
  /** 採用した段階 */
  tier: PaymentBaseDaysTier;
  /** 平均報酬月額（端数は teiji-determination 側で等級表へ） */
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

export function isMonthEligibleForAverage(
  category: EmploymentType,
  days: number,
  tier: PaymentBaseDaysTier,
): boolean {
  return classifyPaymentBaseDaysTier(category, days) === tier;
}

/**
 * 定時決定用: 対象月リストから算定に使う月と平均報酬を決める。
 * months は通常 4・5・6 月。remuneration は固定的賃金等で事前計算済み。
 */
export function selectMonthsForRemunerationAverageSelection(
  category: EmploymentType,
  months: readonly MonthPaymentBaseInput[],
): RemunerationAverageSelectionOutcome {
  if (months.length === 0) {
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }

  const primary = months.filter((m) =>
    isMonthEligibleForAverage(category, m.paymentBaseDays, 'primary'),
  );
  if (primary.length > 0) {
    return {
      kind: 'calculated',
      result: buildAverage(primary, 'primary'),
    };
  }

  if (category === 'short-time-worker') {
    const secondary = months.filter((m) =>
      isMonthEligibleForAverage(category, m.paymentBaseDays, 'secondary'),
    );
    if (secondary.length > 0) {
      return {
        kind: 'calculated',
        result: buildAverage(secondary, 'secondary'),
      };
    }
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }

  if (category === 'short-time-labor') {
    return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
  }

  // 一般・その他: 17日以上の月が無ければ算定不可（呼び出し側で従前継続）
  return { kind: 'continue_previous', reason: 'all_months_below_secondary' };
}

function buildAverage(
  usedMonths: readonly MonthPaymentBaseInput[],
  tier: PaymentBaseDaysTier,
): RemunerationAverageSelectionResult {
  const total = usedMonths.reduce((s, m) => s + m.remuneration, 0);
  return {
    usedMonths: [...usedMonths],
    tier,
    averageRemuneration: total / usedMonths.length,
  };
}

/** 簡易: 月次レコードあり＋月給想定で暦日数 */
export function estimatePaymentBaseDaysCalendarMonth(
  hasMonthlyRecord: boolean,
  daysInMonth: number,
): number {
  return hasMonthlyRecord ? daysInMonth : 0;
}