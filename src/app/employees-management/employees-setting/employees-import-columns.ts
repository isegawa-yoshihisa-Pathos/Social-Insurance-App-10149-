import { EmployeeListColumnKey } from '../employees-list/employee-list-columns';

export type EmployeesImportFieldKey = EmployeeListColumnKey;

export interface EmployeesImportColumnDef {
  key: EmployeesImportFieldKey;
  label: string;
  defaultHeader: string;
  kind: 'string' | 'number' | 'date';
}

export const EMPLOYEES_IMPORT_COLUMNS: EmployeesImportColumnDef[] = [
  { key: 'employeeId', label: '社員番号', defaultHeader: 'employeeId', kind: 'string' },
  { key: 'displayName', label: '氏名', defaultHeader: 'displayName', kind: 'string' },
  { key: 'role', label: '権限', defaultHeader: 'role', kind: 'string' },
  { key: 'position', label: '役職', defaultHeader: 'position', kind: 'string' },
  { key: 'department', label: '部署', defaultHeader: 'department', kind: 'string' },
  { key: 'payType', label: '給与区分', defaultHeader: 'payType', kind: 'string' },
  { key: 'employmentType', label: '雇用形態', defaultHeader: 'employmentType', kind: 'string' },
  { key: 'status', label: '勤務状況', defaultHeader: 'status', kind: 'string' },
  { key: 'joinedAt', label: '入社日', defaultHeader: 'joinedAt', kind: 'date' },
  { key: 'leaveAt', label: '休職日', defaultHeader: 'leaveAt', kind: 'date' },
  { key: 'returnAt', label: '復職日', defaultHeader: 'returnAt', kind: 'date' },
  { key: 'resignAt', label: '退職日', defaultHeader: 'resignAt', kind: 'date' },
  { key: 'licenseStartAt', label: '資格取得日', defaultHeader: 'licenseStartAt', kind: 'date' },
  { key: 'licenseEndAt', label: '資格喪失日', defaultHeader: 'licenseEndAt', kind: 'date' },
  { key: 'healthInsuranceRecordNumber', label: '健康保険整理番号', defaultHeader: 'healthInsuranceRecordNumber', kind: 'string' },
  { key: 'pensionInsuranceRecordNumber', label: '厚生年金整理番号', defaultHeader: 'pensionInsuranceRecordNumber', kind: 'string' },
];

export function buildEmployeesImportColumnDefs(): EmployeesImportColumnDef[] {
  return [...EMPLOYEES_IMPORT_COLUMNS];
}

export function buildDefaultEmployeesImportHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const col of EMPLOYEES_IMPORT_COLUMNS) {
    headers[col.key] = col.defaultHeader;
  }
  return headers;
}