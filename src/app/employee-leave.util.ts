import {
  EmployeeLeaveFormData,
  EmployeeLeaveRecord,
  EmployeeLeaveType,
  EmployeeResignFormData,
} from './employee-document';
import { formatJapaneseDate, toFirestoreTimestamp, toFormDate } from './date-utils';

export const EMPLOYEE_LEAVE_TYPE_LABELS: Record<EmployeeLeaveType, string> = {
  maternity: '産前産後休業',
  childcare: '育児休業',
};

export function leaveTypeLabel(type: EmployeeLeaveType): string {
  return EMPLOYEE_LEAVE_TYPE_LABELS[type];
}

export function createEmptyLeaveForm(): EmployeeLeaveFormData {
  return {
    type: 'maternity',
    startAt: null,
    endAt: null,
    reason: '',
  };
}

export function createEmptyResignForm(): EmployeeResignFormData {
  return {
    resignAt: null,
    reason: '',
  };
}

export function employeeLeaveRecordsToForm(
  records?: EmployeeLeaveRecord[],
): EmployeeLeaveRecord[] {
  return [...(records ?? [])];
}

export function leaveRecordToForm(record: EmployeeLeaveRecord): EmployeeLeaveFormData {
  return {
    type: record.type,
    startAt: toFormDate(record.startAt),
    endAt: toFormDate(record.endAt),
    reason: record.reason ?? '',
  };
}

export function leaveFormToRecord(
  form: EmployeeLeaveFormData,
  applicationId?: string,
): EmployeeLeaveRecord {
  const record: EmployeeLeaveRecord = {
    type: form.type,
    startAt: toFirestoreTimestamp(form.startAt),
    endAt: toFirestoreTimestamp(form.endAt),
  };

  const reason = form.reason.trim();
  if (reason) {
    record.reason = reason;
  }
  if (applicationId) {
    record.applicationId = applicationId;
  }

  const createdAt = toFirestoreTimestamp(new Date());
  if (createdAt) {
    record.createdAt = createdAt;
  }

  return record;
}

export type EmployeeStatusTimelineKind =
  | 'joined'
  | 'leave'
  | 'resigned';

export interface EmployeeStatusTimelineItem {
  kind: EmployeeStatusTimelineKind;
  label: string;
  startAt: Date | null;
  endAt: Date | null;
  detail?: string;
}

export function buildEmployeeStatusTimeline(input: {
  joinedAt: Date | null;
  resignAt: Date | null;
  leaveRecords: EmployeeLeaveRecord[];
}): EmployeeStatusTimelineItem[] {
  const items: EmployeeStatusTimelineItem[] = [];

  if (input.joinedAt) {
    items.push({
      kind: 'joined',
      label: '入社',
      startAt: input.joinedAt,
      endAt: null,
    });
  }

  for (const record of input.leaveRecords) {
    items.push({
      kind: 'leave',
      label: leaveTypeLabel(record.type),
      startAt: toFormDate(record.startAt),
      endAt: toFormDate(record.endAt),
      detail: record.reason?.trim() || undefined,
    });
  }

  if (input.resignAt) {
    items.push({
      kind: 'resigned',
      label: '退職',
      startAt: input.resignAt,
      endAt: null,
    });
  }

  return items.sort((a, b) => {
    const aTime = a.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

export function formatLeavePeriod(startAt: Date | null, endAt: Date | null): string {
  const start = formatJapaneseDate(startAt);
  const end = formatJapaneseDate(endAt);
  if (start && end) return `${start} 〜 ${end}`;
  if (start) return `${start} 〜`;
  if (end) return `〜 ${end}`;
  return '';
}

export function employmentStatusLabel(status: 'active' | 'leave' | 'resigned'): string {
  switch (status) {
    case 'active':
      return '在職';
    case 'leave':
      return '休職';
    case 'resigned':
      return '退職';
  }
}
