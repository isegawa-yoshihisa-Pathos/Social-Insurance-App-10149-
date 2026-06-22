import type { EmployeeLeaveRecord, EmployeeLeaveType } from '../../employee-document';
import { getCalendarDateInTimeZone, JAPAN_TIME_ZONE, toFormDate } from '../../date-utils';
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
  const normalized = normalizeCalendarDate(date);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}`;
}

export function normalizeCalendarDate(date: Date): Date {
  return getCalendarDateInTimeZone(JAPAN_TIME_ZONE, date);
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
  return normalizeCalendarDate(new Date(year, month, 0));
}

/**
 * 賞与にかかる保険料: 賞与支給月の末日が休業期間に含まれ、
 * かつ当該末日を含む休業が1カ月を超える場合に免除。
 */
function isBonusPremiumExemptForLeavePeriod(
  bonusYyyyMm: string,
  startAt: Date,
  endAt: Date | null,
): boolean {
  const monthEnd = lastDayOfMonthDate(bonusYyyyMm);
  const start = normalizeCalendarDate(startAt);

  if (endAt) {
    if (!dateInLeavePeriod(monthEnd, startAt, endAt)) {
      return false;
    }
  } else if (normalizeCalendarDate(monthEnd).getTime() < start.getTime()) {
    return false;
  }

  const startMonth = dateToYyyyMm(startAt);
  const endMonth = dateToYyyyMm(endAt ?? monthEnd);
  return monthsBetweenInclusive(startMonth, endMonth) > 1;
}

/**
 * 産前産後休業・育児休業等: 賞与支給月の末日を含む1カ月超の休業がある場合、
 * 当該賞与に係る保険料を免除する。
 */
export function isBonusPremiumExemptForLeave(
  bonusYyyyMm: string,
  leaveRecords?: readonly LeavePeriodInput[],
): boolean {
  if (!leaveRecords?.length) {
    return false;
  }

  for (const leave of leaveRecords) {
    if (!leave.startAt) {
      continue;
    }
    if (leave.type !== 'maternity' && leave.type !== 'childcare') {
      continue;
    }
    if (isBonusPremiumExemptForLeavePeriod(bonusYyyyMm, leave.startAt, leave.endAt)) {
      return true;
    }
  }

  return false;
}

/** @deprecated isBonusPremiumExemptForLeave を使用 */
export function isBonusPremiumExemptForChildcareLeave(
  bonusYyyyMm: string,
  leaveRecords?: readonly LeavePeriodInput[],
): boolean {
  return isBonusPremiumExemptForLeave(bonusYyyyMm, leaveRecords);
}

export function getBonusPremiumLeaveExemptReason(
  bonusYyyyMm: string,
  leaveRecords?: readonly LeavePeriodInput[],
): string | null {
  if (!isBonusPremiumExemptForLeave(bonusYyyyMm, leaveRecords)) {
    return null;
  }
  return '産前産後休業または育児休業等の取得により、当該賞与に係る保険料は免除されます';
}

export type LeavePremiumExemptionAlert = {
  leaveType: Extract<EmployeeLeaveType, 'maternity' | 'childcare'>;
  yyyyMm: string;
};

/** 月次・賞与それぞれ、当該月に保険料免除が適用される休業種別を返す。 */
export function detectLeavePremiumExemptions(
  yyyyMm: string,
  leaveRecords: readonly LeavePeriodInput[] | undefined,
  premiumKind: 'monthly' | 'bonus',
): LeavePremiumExemptionAlert[] {
  if (!leaveRecords?.length) {
    return [];
  }

  const results: LeavePremiumExemptionAlert[] = [];

  for (const leave of leaveRecords) {
    if (!leave.startAt) {
      continue;
    }
    if (leave.type !== 'maternity' && leave.type !== 'childcare') {
      continue;
    }

    const exempt =
      premiumKind === 'monthly'
        ? leave.type === 'maternity'
          ? isMonthlyPremiumExemptForMaternityLeave(yyyyMm, leave.startAt, leave.endAt)
          : isMonthlyPremiumExemptForChildcareLeave(yyyyMm, leave.startAt, leave.endAt)
        : isBonusPremiumExemptForLeavePeriod(yyyyMm, leave.startAt, leave.endAt);

    if (exempt) {
      results.push({ leaveType: leave.type, yyyyMm });
    }
  }

  return results;
}
