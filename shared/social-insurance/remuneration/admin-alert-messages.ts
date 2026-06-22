import type { LeavePeriodInput } from '../premium/leave-premium-exemption';
import { daysInMonth, parseYyyyMm } from '../monthly/social-insurance-data.util';
import { formatZuijiEffectiveMonthLabel } from './may-june-zuiji';

export type TeijiNonTargetReason =
  | 'insufficient_payment_base_days'
  | 'on_leave_during_period'
  | 'grade_not_found'
  | 'license_start_after_june';

const TEIJI_NON_TARGET_REASON_LABELS: Record<TeijiNonTargetReason, string> = {
  insufficient_payment_base_days:
    '4〜6月のいずれも支払基礎日数が算定基準を満たさないため、平均による定時決定ができません。従前の等級を継続します。',
  on_leave_during_period:
    '4〜6月に産休・育休等の休業があり、支払基礎日数が算定基準を満たさないため定時決定の対象外です。従前の等級を継続します。',
  grade_not_found: '4〜6月の報酬から等級表に該当する標準報酬月額を決定できませんでした。',
  license_start_after_june: '当年6月1日以降に資格を取得したため、定時決定の対象外です。',
};

export function teijiNonTargetReasonLabel(reason: TeijiNonTargetReason): string {
  return TEIJI_NON_TARGET_REASON_LABELS[reason];
}

function monthRange(yyyyMm: string): { start: Date; end: Date } {
  const { year, month } = parseYyyyMm(yyyyMm);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month - 1, daysInMonth(yyyyMm)),
  };
}

function leaveOverlapsMonth(leave: LeavePeriodInput, yyyyMm: string): boolean {
  if (!leave.startAt) {
    return false;
  }
  const { start, end } = monthRange(yyyyMm);
  const leaveEnd = leave.endAt ?? new Date(9999, 11, 31);
  return leave.startAt <= end && leaveEnd >= start;
}

export function refineTeijiNonTargetReason(
  baseReason: TeijiNonTargetReason,
  leaveRecords: readonly LeavePeriodInput[],
  teijiMonthKeys: readonly string[],
): TeijiNonTargetReason {
  if (baseReason !== 'insufficient_payment_base_days') {
    return baseReason;
  }

  const hasLeaveDuringPeriod = leaveRecords.some(
    (leave) =>
      (leave.type === 'maternity' || leave.type === 'childcare') &&
      teijiMonthKeys.some((yyyyMm) => leaveOverlapsMonth(leave, yyyyMm)),
  );
  return hasLeaveDuringPeriod ? 'on_leave_during_period' : baseReason;
}

export function buildTeijiNonTargetNotificationTitle(
  employeeName: string,
  teijiYear: number,
): string {
  return `【定時決定・対象外】${employeeName}様（${teijiYear}年9月適用）`;
}

export function buildTeijiNonTargetNotificationBody(
  employeeName: string,
  teijiYear: number,
  reason: TeijiNonTargetReason,
): string {
  return (
    `${employeeName}様は${teijiYear}年の定時決定（算定基礎届）の自動算定対象外です。` +
    `${teijiNonTargetReasonLabel(reason)}` +
    '算定基礎届の提出要否を確認してください。'
  );
}

export function buildStandardZuijiApplicableNotificationTitle(
  employeeName: string,
  effectiveYyyyMm: string,
): string {
  const effectiveLabel = formatZuijiEffectiveMonthLabel(effectiveYyyyMm);
  return `【随時改定確定】${employeeName}様（${effectiveLabel}適用・${effectiveYyyyMm}）`;
}

export function buildStandardZuijiApplicableNotificationBody(
  employeeName: string,
  changeMonthYyyyMm: string,
  effectiveYyyyMm: string,
  previousHealthGrade: number,
  previousPensionGrade: number,
  newHealthGrade: number,
  newPensionGrade: number,
): string {
  const changeMonth = Number(changeMonthYyyyMm.slice(5, 7));
  const effectiveLabel = formatZuijiEffectiveMonthLabel(effectiveYyyyMm);
  return (
    `${employeeName}様は${changeMonth}月の固定的賃金変動から3ヶ月間の支払基礎日数を満たし、` +
    '随時改定（月額変更届）の要件（2等級以上の変更等）を満たしました。' +
    `健保 ${previousHealthGrade}→${newHealthGrade}等級、厚年 ${previousPensionGrade}→${newPensionGrade}等級。` +
    `${effectiveLabel}（${effectiveYyyyMm}）から適用されます。月額変更届の提出を確認してください。`
  );
}
