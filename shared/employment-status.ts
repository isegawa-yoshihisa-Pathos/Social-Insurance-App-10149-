import type { EmployeeDocument, EmployeeEmployInfo } from './employee-document';
import { toFormDate } from './date-utils';
import {
  employeeLeaveRecordsToPeriodInputs,
  normalizeCalendarDate,
} from './social-insurance/premium/leave-premium-exemption';

export type EmploymentStatus = EmployeeEmployInfo['status'];

export function isResignedAsOf(asOf: Date, resignAt: Date | null): boolean {
  if (!resignAt) {
    return false;
  }
  const today = normalizeCalendarDate(asOf).getTime();
  const resignDay = normalizeCalendarDate(resignAt).getTime();
  return today > resignDay;
}

export function isOnLeaveAsOf(
  asOf: Date,
  leaveRecords: ReturnType<typeof employeeLeaveRecordsToPeriodInputs>,
): boolean {
  const today = normalizeCalendarDate(asOf).getTime();
  for (const leave of leaveRecords) {
    if (!leave.startAt) {
      continue;
    }
    const start = normalizeCalendarDate(leave.startAt).getTime();
    if (today < start) {
      continue;
    }
    if (!leave.endAt) {
      return true;
    }
    const end = normalizeCalendarDate(leave.endAt).getTime();
    if (today <= end) {
      return true;
    }
  }
  return false;
}

export function resolveEmploymentStatusAsOf(
  employee: Pick<EmployeeDocument, 'employeeEmployInfo' | 'leaveInfo'>,
  asOf: Date,
): EmploymentStatus {
  const resignAt = toFormDate(employee.employeeEmployInfo?.resignAt);
  if (isResignedAsOf(asOf, resignAt)) {
    return 'resigned';
  }

  const leaveRecords = employeeLeaveRecordsToPeriodInputs(employee.leaveInfo);
  if (isOnLeaveAsOf(asOf, leaveRecords)) {
    return 'leave';
  }

  return 'active';
}
