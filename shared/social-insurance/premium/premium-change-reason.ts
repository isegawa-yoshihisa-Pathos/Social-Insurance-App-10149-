import type { CalculationSnapshot as MonthlyCalculationSnapshot } from '../../monthly-document';
import type { CalculationSnapshot as BonusCalculationSnapshot } from '../../bonus-document';
import type { PremiumData } from '../../monthly-document';
import type { StandardRemunerationSource } from '../monthly/social-insurance-document';
import type { StandardBonusSource } from '../bonus/social-insurance-document';
import { addMonths } from '../monthly/social-insurance-data.util';

const STANDARD_REMUNERATION_SOURCE_LABELS: Record<StandardRemunerationSource, string> = {
  initial: '初回算定',
  teiji: '定時決定',
  zuiji: '随時改定',
  provisional_zuiji: '暫定随時改定',
  manual: '手入力',
  carried: '繰越',
};

const STANDARD_BONUS_SOURCE_LABELS: Record<StandardBonusSource, string> = {
  calculated: '算定',
  manual: '手入力',
};

function ageAtEndOfMonth(birthDate: Date, yyyyMm: string): number {
  const [year, month] = yyyyMm.split('-').map((v) => parseInt(v, 10));
  const endOfMonth = new Date(year, month, 0);
  let age = endOfMonth.getFullYear() - birthDate.getFullYear();
  const monthDiff = endOfMonth.getMonth() - birthDate.getMonth();
  const dayDiff = endOfMonth.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

function ageMilestoneReasons(
  birthDate: Date | null,
  yyyyMm: string,
  previousYyyyMm: string,
): string[] {
  if (!birthDate) {
    return [];
  }

  const reasons: string[] = [];
  const currentAge = ageAtEndOfMonth(birthDate, yyyyMm);
  const previousAge = ageAtEndOfMonth(birthDate, previousYyyyMm);

  if (previousAge < 40 && currentAge >= 40) {
    reasons.push('40歳到達により介護保険料の対象となりました。');
  }
  if (previousAge < 65 && currentAge >= 65) {
    reasons.push('65歳到達により介護保険料の対象外となりました。');
  }
  if (previousAge < 70 && currentAge >= 70) {
    reasons.push('70歳到達により厚生年金保険料の対象外となりました。');
  }
  if (previousAge < 75 && currentAge >= 75) {
    reasons.push('75歳到達により健康保険料の対象外となりました。');
  }

  return reasons;
}

function premiumTotal(premium?: PremiumData): number | null {
  if (!premium) {
    return null;
  }
  const health = premium.healthInsurance.employee ?? 0;
  const care = premium.careInsurance.employee ?? 0;
  const pension = premium.pensionInsurance.employee ?? 0;
  return health + care + pension;
}

export function buildMonthlyPremiumChangeReasons(params: {
  yyyyMm: string;
  birthDate: Date | null;
  current?: MonthlyCalculationSnapshot;
  previous?: MonthlyCalculationSnapshot;
  currentPremium?: PremiumData;
  previousPremium?: PremiumData;
}): string[] {
  const { yyyyMm, birthDate, current, previous, currentPremium, previousPremium } = params;
  const previousYyyyMm = addMonths(yyyyMm, -1);
  const reasons: string[] = [...ageMilestoneReasons(birthDate, yyyyMm, previousYyyyMm)];

  if (!current) {
    if (reasons.length === 0) {
      reasons.push('保険料の算定情報がありません。');
    }
    return reasons;
  }

  if (!previous) {
    reasons.push('初回の保険料算定です。');
    if (current.source) {
      reasons.push(`標準報酬の根拠: ${STANDARD_REMUNERATION_SOURCE_LABELS[current.source] ?? current.source}`);
    }
    return reasons;
  }

  if (current.source !== previous.source) {
    const currentLabel = STANDARD_REMUNERATION_SOURCE_LABELS[current.source] ?? current.source;
    const previousLabel = STANDARD_REMUNERATION_SOURCE_LABELS[previous.source] ?? previous.source;
    reasons.push(`標準報酬の根拠が「${previousLabel}」から「${currentLabel}」に変更されました。`);
  } else if (current.source === 'teiji') {
    reasons.push('定時決定により標準報酬月額が見直されました。');
  } else if (current.source === 'zuiji' || current.source === 'provisional_zuiji') {
    reasons.push('報酬変動により随時改定が適用されました。');
  }

  if (
    current.standardRemuneration.health !== previous.standardRemuneration.health
    || current.standardRemuneration.pension !== previous.standardRemuneration.pension
  ) {
    reasons.push(
      `標準報酬月額が変更されました（健保: ${previous.standardRemuneration.health.toLocaleString()}円 → ${current.standardRemuneration.health.toLocaleString()}円、年金: ${previous.standardRemuneration.pension.toLocaleString()}円 → ${current.standardRemuneration.pension.toLocaleString()}円）。`,
    );
  }

  if (
    current.healthGrade !== previous.healthGrade
    || current.pensionGrade !== previous.pensionGrade
  ) {
    reasons.push(
      `等級が変更されました（健保: ${previous.healthGrade}級 → ${current.healthGrade}級、年金: ${previous.pensionGrade}級 → ${current.pensionGrade}級）。`,
    );
  }

  if (current.rateId !== previous.rateId || current.effectiveFrom !== previous.effectiveFrom) {
    reasons.push('適用保険料率が変更されました。');
  }

  const prevCareRate = previous.employeeRate.care ?? 0;
  const currentCareRate = current.employeeRate.care ?? 0;
  if (prevCareRate === 0 && currentCareRate > 0) {
    reasons.push('介護保険料の負担が発生しました。');
  } else if (prevCareRate > 0 && currentCareRate === 0) {
    reasons.push('介護保険料の負担が終了しました。');
  }

  const prevTotal = premiumTotal(previousPremium);
  const currentTotal = premiumTotal(currentPremium);
  if (prevTotal != null && currentTotal != null && prevTotal !== currentTotal) {
    reasons.push(
      `本人負担の社会保険料合計が ${prevTotal.toLocaleString()}円 から ${currentTotal.toLocaleString()}円 に変動しました。`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('前月と比べて保険料算定に大きな変更はありません。');
  }

  return reasons;
}

export function buildBonusPremiumChangeReasons(params: {
  yyyyMm: string;
  birthDate: Date | null;
  current?: BonusCalculationSnapshot;
  previous?: BonusCalculationSnapshot;
  currentPremium?: PremiumData;
  previousPremium?: PremiumData;
}): string[] {
  const { yyyyMm, birthDate, current, previous, currentPremium, previousPremium } = params;
  const previousYyyyMm = addMonths(yyyyMm, -1);
  const reasons: string[] = [...ageMilestoneReasons(birthDate, yyyyMm, previousYyyyMm)];

  if (!current) {
    if (reasons.length === 0) {
      reasons.push('賞与保険料の算定情報がありません。');
    }
    return reasons;
  }

  if (current.skipReason) {
    reasons.push(`賞与保険料は徴収対象外です（${current.skipReason}）。`);
    return reasons;
  }

  if (!previous) {
    reasons.push('初回の賞与保険料算定です。');
    if (current.source) {
      reasons.push(`標準賞与額の根拠: ${STANDARD_BONUS_SOURCE_LABELS[current.source] ?? current.source}`);
    }
    return reasons;
  }

  if (current.source !== previous.source) {
    const currentLabel = STANDARD_BONUS_SOURCE_LABELS[current.source] ?? current.source;
    const previousLabel = STANDARD_BONUS_SOURCE_LABELS[previous.source] ?? previous.source;
    reasons.push(`標準賞与額の根拠が「${previousLabel}」から「${currentLabel}」に変更されました。`);
  }

  if (
    current.standardBonus.health !== previous.standardBonus.health
    || current.standardBonus.pension !== previous.standardBonus.pension
  ) {
    reasons.push(
      `標準賞与額が変更されました（健保: ${previous.standardBonus.health.toLocaleString()}円 → ${current.standardBonus.health.toLocaleString()}円、年金: ${previous.standardBonus.pension.toLocaleString()}円 → ${current.standardBonus.pension.toLocaleString()}円）。`,
    );
  }

  if (current.bonusAmount !== previous.bonusAmount) {
    reasons.push(
      `賞与支給額が ${previous.bonusAmount.toLocaleString()}円 から ${current.bonusAmount.toLocaleString()}円 に変更されました。`,
    );
  }

  if (current.rateId !== previous.rateId || current.effectiveFrom !== previous.effectiveFrom) {
    reasons.push('適用保険料率が変更されました。');
  }

  const prevTotal = premiumTotal(previousPremium);
  const currentTotal = premiumTotal(currentPremium);
  if (prevTotal != null && currentTotal != null && prevTotal !== currentTotal) {
    reasons.push(
      `本人負担の賞与保険料合計が ${prevTotal.toLocaleString()}円 から ${currentTotal.toLocaleString()}円 に変動しました。`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('前回と比べて賞与保険料算定に大きな変更はありません。');
  }

  return reasons;
}
