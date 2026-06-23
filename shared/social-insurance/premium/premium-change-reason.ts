import type { CalculationSnapshot as MonthlyCalculationSnapshot } from '../../monthly-document';
import type { CalculationSnapshot as BonusCalculationSnapshot } from '../../bonus-document';
import type { PremiumData } from '../../monthly-document';
import type { StandardRemunerationSource } from '../monthly/social-insurance-document';
import type { StandardBonusSource } from '../bonus/social-insurance-document';
import type { EmployeeLeaveType } from '../../employee-document';
import { getAgeAttainmentYyyyMm } from '../../date-utils';
import {
  detectAgePremiumTransitions,
  type AgePremiumTransitionKind,
  type DetectAgePremiumTransitionsInput,
} from './age-premium-transition';
import {
  detectLeavePremiumExemptions,
  type LeavePeriodInput,
} from './leave-premium-exemption';
import {
  hasCareInsuranceAgeDependent,
  isCareInsuranceTarget,
  isSpecificInsuranceCollectionEnabled,
} from './premium-calculator';

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

const LEAVE_TYPE_LABELS: Record<Extract<EmployeeLeaveType, 'maternity' | 'childcare'>, string> = {
  maternity: '産前産後休業',
  childcare: '育児休業等',
};

const AGE_TRANSITION_CHANGE_REASONS: Partial<Record<AgePremiumTransitionKind, string>> = {
  care_insurance_collection_start:
    '40歳到達により、介護保険第2号被保険者として介護保険料の徴収が開始されました。',
  care_insurance_collection_end:
    '65歳到達により、介護保険料の徴収が終了しました。',
  specific_care_insurance_collection_start:
    '特定被保険者に該当するため、介護保険料の徴収が開始されました。',
  specific_care_insurance_collection_end:
    '特定被保険者としての介護保険料徴収が終了しました。',
  health_insurance_end: '75歳到達により健康保険料の対象外となりました。',
  pension_insurance_end: '70歳到達により厚生年金保険料の対象外となりました。',
};

const AGE_MILESTONE_MESSAGES: ReadonlyArray<{ age: number; message: string }> = [
  { age: 40, message: '40歳到達により介護保険料の対象となりました。' },
  { age: 65, message: '65歳到達により介護保険料の対象外となりました。' },
  { age: 70, message: '70歳到達により厚生年金保険料の対象外となりました。' },
  { age: 75, message: '75歳到達により健康保険料の対象外となりました。' },
];

/** 保険料算定と同じ到達月（reachedMonth）基準で年齢 milestone を判定する */
function ageMilestoneReasonsForMonth(
  birthDate: Date | null,
  premiumMonthYyyyMm: string,
): string[] {
  if (!birthDate) {
    return [];
  }

  return AGE_MILESTONE_MESSAGES
    .filter(({ age }) => getAgeAttainmentYyyyMm(birthDate, age) === premiumMonthYyyyMm)
    .map(({ message }) => message);
}

function ageTransitionChangeReasons(
  premiumMonthYyyyMm: string,
  birthDate: Date | null,
  agePremiumContext?: Omit<DetectAgePremiumTransitionsInput, 'yyyyMm'>,
): string[] {
  if (!agePremiumContext) {
    return ageMilestoneReasonsForMonth(birthDate, premiumMonthYyyyMm);
  }

  return detectAgePremiumTransitions({
    ...agePremiumContext,
    yyyyMm: premiumMonthYyyyMm,
  })
    .map(({ kind }) => AGE_TRANSITION_CHANGE_REASONS[kind])
    .filter((message): message is string => !!message);
}

function leaveExemptionChangeReasons(
  premiumMonthYyyyMm: string,
  previousPremiumMonthYyyyMm: string | undefined,
  leaveRecords?: readonly LeavePeriodInput[],
): string[] {
  if (!leaveRecords?.length) {
    return [];
  }

  const reasons: string[] = [];
  const currentExemptions = detectLeavePremiumExemptions(
    premiumMonthYyyyMm,
    leaveRecords,
    'monthly',
  );

  for (const { leaveType } of currentExemptions) {
    reasons.push(
      `${LEAVE_TYPE_LABELS[leaveType]}の取得期間に該当するため、社会保険料は休業のため免除されています。`,
    );
  }

  if (previousPremiumMonthYyyyMm && currentExemptions.length === 0) {
    const previousExemptions = detectLeavePremiumExemptions(
      previousPremiumMonthYyyyMm,
      leaveRecords,
      'monthly',
    );
    if (previousExemptions.length > 0) {
      reasons.push('休業明けにより保険料免除が終了し、通常の保険料算定となりました。');
    }
  }

  return reasons;
}

function ongoingSpecificCareCollectionReason(
  premiumMonthYyyyMm: string,
  currentPremium: PremiumData | undefined,
  agePremiumContext?: Omit<DetectAgePremiumTransitionsInput, 'yyyyMm'>,
): string | null {
  if (!agePremiumContext || !currentPremium) {
    return null;
  }

  const careAmount = currentPremium.careInsurance.employee ?? 0;
  if (careAmount <= 0) {
    return null;
  }

  if (!isSpecificInsuranceCollectionEnabled(agePremiumContext.specificInsuranceCollectionType)) {
    return null;
  }

  if (isCareInsuranceTarget(agePremiumContext.birthDate ?? null, premiumMonthYyyyMm)) {
    return null;
  }

  if (
    !hasCareInsuranceAgeDependent(
      agePremiumContext.dependentsInfo,
      premiumMonthYyyyMm,
      agePremiumContext.hasDependents,
    )
  ) {
    return null;
  }

  return '特定被保険者に該当するため、介護保険料が徴収されています。';
}

function appendSpecificCareCollectionReason(
  reasons: string[],
  premiumMonthYyyyMm: string,
  currentPremium: PremiumData | undefined,
  agePremiumContext?: Omit<DetectAgePremiumTransitionsInput, 'yyyyMm'>,
): void {
  const hasSpecificTransition = reasons.some((reason) => reason.includes('特定被保険者'));
  if (hasSpecificTransition) {
    return;
  }

  const ongoingReason = ongoingSpecificCareCollectionReason(
    premiumMonthYyyyMm,
    currentPremium,
    agePremiumContext,
  );
  if (ongoingReason) {
    reasons.push(ongoingReason);
  }
}

function hasCareInsuranceTransitionReasons(reasons: string[]): boolean {
  return reasons.some(
    (reason) =>
      reason.includes('介護保険料')
      || reason.includes('特定被保険者'),
  );
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
  /** 給与明細の表示月。指定時は前回の支払明細との比較として扱う */
  displayYyyyMm?: string;
  /** 表示されている保険料の算定月（報酬管理） */
  premiumMonthYyyyMm: string;
  /** 前回明細で参照した保険料の算定月 */
  previousPremiumMonthYyyyMm?: string;
  birthDate: Date | null;
  leaveRecords?: readonly LeavePeriodInput[];
  agePremiumContext?: Omit<DetectAgePremiumTransitionsInput, 'yyyyMm'>;
  current?: MonthlyCalculationSnapshot;
  previous?: MonthlyCalculationSnapshot;
  currentPremium?: PremiumData;
  previousPremium?: PremiumData;
}): string[] {
  const {
    displayYyyyMm,
    premiumMonthYyyyMm,
    previousPremiumMonthYyyyMm,
    birthDate,
    leaveRecords,
    agePremiumContext,
    current,
    previous,
    currentPremium,
    previousPremium,
  } = params;
  const reasons: string[] = [
    ...leaveExemptionChangeReasons(
      premiumMonthYyyyMm,
      previousPremiumMonthYyyyMm,
      leaveRecords,
    ),
    ...ageTransitionChangeReasons(premiumMonthYyyyMm, birthDate, agePremiumContext),
  ];
  appendSpecificCareCollectionReason(
    reasons,
    premiumMonthYyyyMm,
    currentPremium,
    agePremiumContext,
  );

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
  if (
    !hasCareInsuranceTransitionReasons(reasons)
    && prevCareRate === 0
    && currentCareRate > 0
  ) {
    reasons.push('介護保険料の負担が発生しました。');
  } else if (
    !hasCareInsuranceTransitionReasons(reasons)
    && prevCareRate > 0
    && currentCareRate === 0
  ) {
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
    reasons.push(
      displayYyyyMm
        ? '前回の支払明細と比べて保険料算定に大きな変更はありません。'
        : '前月と比べて保険料算定に大きな変更はありません。',
    );
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
  const reasons: string[] = [...ageMilestoneReasonsForMonth(birthDate, yyyyMm)];

  if (!current) {
    if (reasons.length === 0) {
      reasons.push('賞与に係る保険料の算定情報がありません。');
    }
    return reasons;
  }

  if (current.skipReason) {
    reasons.push(`賞与に係る保険料は徴収対象外です（${current.skipReason}）。`);
    return reasons;
  }

  if (!previous) {
    reasons.push('通常の賞与に係る保険料算定です。');
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
      `本人負担の賞与に係る保険料合計が ${prevTotal.toLocaleString()}円 から ${currentTotal.toLocaleString()}円 に変動しました。`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('前回と比べて賞与に係る保険料算定に大きな変更はありません。');
  }

  return reasons;
}
