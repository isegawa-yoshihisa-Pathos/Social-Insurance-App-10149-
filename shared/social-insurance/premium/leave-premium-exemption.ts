import type { EmployeeLeaveRecord, EmployeeLeaveType } from '../../employee-document';
import { toFormDate } from '../../date-utils';
import { addMonths, parseYyyyMm } from '../monthly/social-insurance-data.util';

export interface LeavePeriodInput {
  type: EmployeeLeaveType;
  startAt: Date | null;
  endAt: Date | null;
}

export function employeeLeaveRecordsToPeriodInputs(
  records?: readonly EmployeeLeaveRecord[],
): LeavePeriodInput[] {
  return (records ?? []).map((record) => ({
    type: record.type,
    startAt: toFormDate(record.startAt),
    endAt: toFormDate(record.endAt),
  }));
}

export function dateToYyyyMm(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function normalizeCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dayAfter(date: Date): Date {
  const next = normalizeCalendarDate(date);
  next.setDate(next.getDate() + 1);
  return next;
}

export function leaveDaysInclusive(startAt: Date, endAt: Date): number {
  const start = normalizeCalendarDate(startAt);
  const end = normalizeCalendarDate(endAt);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

export function monthsBetweenInclusive(startYyyyMm: string, endYyyyMm: string): number {
  const start = parseYyyyMm(startYyyyMm);
  const end = parseYyyyMm(endYyyyMm);
  return (end.year - start.year) * 12 + (end.month - start.month) + 1;
}

export function isYyyyMmInRange(
  yyyyMm: string,
  startYyyyMm: string,
  endYyyyMm: string,
): boolean {
  return startYyyyMm <= yyyyMm && yyyyMm <= endYyyyMm;
}

/**
 * 産前産後休業: 開始月 〜 終了日の翌日が属する月の前月まで免除。
 */
export function isMonthlyPremiumExemptForMaternityLeave(
  yyyyMm: string,
  startAt: Date,
  endAt: Date | null,
): boolean {
  const startMonth = dateToYyyyMm(startAt);
  if (!endAt) {
    return yyyyMm >= startMonth;
  }

  const exemptionEndMonth = addMonths(dateToYyyyMm(dayAfter(endAt)), -1);
  return isYyyyMmInRange(yyyyMm, startMonth, exemptionEndMonth);
}

const CHILDCARE_SAME_MONTH_MIN_DAYS = 14;

/**
 * 育児休業等: 開始月 〜 終了日の翌日が属する月の前月まで免除。
 * 開始月と終了日の翌日が同一の月に属する場合は、14日以上取得時のみ当該月を免除。
 */
export function isMonthlyPremiumExemptForChildcareLeave(
  yyyyMm: string,
  startAt: Date,
  endAt: Date | null,
): boolean {
  const startMonth = dateToYyyyMm(startAt);
  if (!endAt) {
    return yyyyMm >= startMonth;
  }

  const endPlusOneMonth = dateToYyyyMm(dayAfter(endAt));
  if (startMonth === endPlusOneMonth) {
    return yyyyMm === startMonth && leaveDaysInclusive(startAt, endAt) >= CHILDCARE_SAME_MONTH_MIN_DAYS;
  }

  const exemptionEndMonth = addMonths(endPlusOneMonth, -1);
  return isYyyyMmInRange(yyyyMm, startMonth, exemptionEndMonth);
}

export function isMonthlyPremiumExemptForLeave(
  yyyyMm: string,
  leaveRecords?: readonly LeavePeriodInput[],
): boolean {
  if (!leaveRecords?.length) {
    return false;
  }

  for (const leave of leaveRecords) {
    if (!leave.startAt) {
      continue;
    }

    if (leave.type === 'maternity') {
      if (isMonthlyPremiumExemptForMaternityLeave(yyyyMm, leave.startAt, leave.endAt)) {
        return true;
      }
      continue;
    }

    if (isMonthlyPremiumExemptForChildcareLeave(yyyyMm, leave.startAt, leave.endAt)) {
      return true;
    }
  }

  return false;
}

function dateInLeavePeriod(target: Date, startAt: Date, endAt: Date): boolean {
  const value = normalizeCalendarDate(target).getTime();
  const start = normalizeCalendarDate(startAt).getTime();
  const end = normalizeCalendarDate(endAt).getTime();
  return start <= value && value <= end;
}

function lastDayOfMonthDate(yyyyMm: string): Date {
  const { year, month } = parseYyyyMm(yyyyMm);
  return new Date(year, month, 0);
}

/**
 * 賞与にかかる保険料: 賞与月の末日が育児休業等に含まれ、
 * かつ当該末日を含む連続した1カ月超の育児休業等がある場合のみ免除。
 */
export function isBonusPremiumExemptForChildcareLeave(
  bonusYyyyMm: string,
  leaveRecords?: readonly LeavePeriodInput[],
): boolean {
  if (!leaveRecords?.length) {
    return false;
  }

  const monthEnd = lastDayOfMonthDate(bonusYyyyMm);

  for (const leave of leaveRecords) {
    if (leave.type !== 'childcare' || !leave.startAt || !leave.endAt) {
      continue;
    }

    if (!dateInLeavePeriod(monthEnd, leave.startAt, leave.endAt)) {
      continue;
    }

    const startMonth = dateToYyyyMm(leave.startAt);
    const endMonth = dateToYyyyMm(leave.endAt);
    if (monthsBetweenInclusive(startMonth, endMonth) <= 1) {
      continue;
    }

    return true;
  }

  return false;
}
