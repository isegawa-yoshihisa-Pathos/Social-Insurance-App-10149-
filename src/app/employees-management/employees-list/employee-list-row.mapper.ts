import { EmployeeDocument, EmployeeEmployInfo } from '../../employee-document';
import { EmployeeListRow } from './employee-list-columns';
import { toFormDate } from '../../date-utils';

function formatDate(value: unknown): string {
  const date = toFormDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toEmployeeListRow(
  eid: string,
  data: Partial<EmployeeDocument>,
): EmployeeListRow {
  const personal = data.employeePersonalInfo;
  const employ = data.employeeEmployInfo;

  return {
    eid,
    displayName: personal?.displayName ?? '',
    role: data.role ?? 'member',
    position: employ?.position ?? '',
    department: employ?.department ?? '',
    payType: employ?.payType ?? '',
    employmentType: employ?.employmentType ?? '',
    status: employ?.status ?? 'active',
    joinedAt: formatDate(employ?.joinedAt),
    leaveAt: formatDate(employ?.leaveAt),
    returnAt: formatDate(employ?.returnAt),
    resignAt: formatDate(employ?.resignAt),
    licenseStartAt: formatDate(employ?.licenseStartAt),
    licenseEndAt: formatDate(employ?.licenseEndAt),
    healthInsuranceRecordNumber: employ?.healthInsuranceRecordNumber ?? '',
    pensionInsuranceRecordNumber: employ?.pensionInsuranceRecordNumber ?? '',
  };
}

export function getEmployeeListCellInitialValue(
  column: keyof EmployeeEmployInfo | 'role',
  row: EmployeeListRow,
): unknown {
  if (
    column === 'joinedAt' ||
    column === 'leaveAt' ||
    column === 'returnAt' ||
    column === 'resignAt' ||
    column === 'licenseStartAt' ||
    column === 'licenseEndAt'
  ) {
    return null;
  }
  return row[column];
}
