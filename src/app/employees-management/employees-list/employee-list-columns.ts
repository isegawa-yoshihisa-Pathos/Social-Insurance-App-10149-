import { EmployeeEmployInfo } from "../../employee-document";

export type EmployeeListColumnKey = 
    | 'employeeId'
    | 'displayName' 
    | 'role' 
    | keyof EmployeeEmployInfo;

export const DEFAULT_EMPLOYEE_LIST_COLUMNS: EmployeeListColumnKey[] = [
    'employeeId',
    'displayName',
    'role',
    'status',
];

export const OPTIONAL_EMPLOYEE_LIST_COLUMNS: {
    key: EmployeeListColumnKey;
    label: string;
}[] = [
    { key: 'displayName', label: '氏名' },
    { key: 'employeeId', label: '社員番号' },
    { key: 'role', label: '権限' },
    { key: 'position', label: '役職' },
    { key: 'department', label: '部署' },
    { key: 'payType', label: '給与区分' },
    { key: 'employmentType', label: '雇用形態' },
    { key: 'status', label: '勤務状況' },
    { key: 'joinedAt', label: '入社日' },
    { key: 'leaveAt', label: '休職日' },
    { key: 'returnAt', label: '復職日' },
    { key: 'resignAt', label: '退職日' },
    { key: 'licenseStartAt', label: '資格取得日' },
    { key: 'licenseEndAt', label: '資格喪失日' },
    { key: 'healthInsuranceRecordNumber', label: '健康保険整理番号' },
    { key: 'pensionInsuranceRecordNumber', label: '厚生年金整理番号' },
];

export const EMPLOYEE_LIST_COLUMN_LABELS: Record<EmployeeListColumnKey, string> = {
    employeeId: '社員番号',
    displayName: '氏名',
    role: '権限',
    position: '役職',
    department: '部署',
    payType: '給与区分',
    employmentType: '雇用形態',
    status: '勤務状況',
    joinedAt: '入社日',
    leaveAt: '休職日',
    returnAt: '復職日',
    resignAt: '退職日',
    licenseStartAt: '資格取得日',
    licenseEndAt: '資格喪失日',
    healthInsuranceRecordNumber: '健康保険整理番号',
    pensionInsuranceRecordNumber: '厚生年金整理番号',
};

export interface EmployeeListRow {
    eid: string;
    employeeId: string;
    displayName: string;
    role: 'admin' | 'member';
    position: string;
    department: string;
    payType: string;
    employmentType: string;
    status: string;
    joinedAt: string;
    leaveAt: string;
    returnAt: string;
    resignAt: string;
    licenseStartAt: string;
    licenseEndAt: string;
    healthInsuranceRecordNumber: string;
    pensionInsuranceRecordNumber: string;
  }