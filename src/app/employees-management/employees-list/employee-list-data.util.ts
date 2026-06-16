export function formatEmployeeListValue(value: string): string {
  switch (value) {
    case '':
      return '';
    case 'admin':
      return '管理者';
    case 'member':
      return '一般';
    case 'full-time':
      return '正社員';
    case 'short-time-worker':
      return '短時間就労者';
    case 'short-time-labor':
      return '短時間労働者';
    case 'active':
      return '在職';
    case 'leave':
      return '休職';
    case 'resigned':
      return '退職';
    case 'monthly':
      return '完全月給';
    case 'daily-monthly':
      return '日給月給';
    case 'weekly':
      return '週給';
    case 'daily':
      return '日給';
    case 'hourly':
      return '時給';
    default:
      return value;
  }
}

export interface EmployeeLookupEntry {
  uid: string;
  eid: string;
  employeeId: string;
  displayName: string;
}