import { MonthlyFormData } from '../../monthly-document';

export type StaticMonthlyImportFieldKey = keyof Pick<
  MonthlyFormData,
  | 'displayName'
  | 'employeeId'
  | 'basicSalary'
  | 'overtimePay'
  | 'commuterAllowance'
  | 'otherAllowance'
  | 'retroactivePay'
>;

/** 給与・氏名列 */
export type MonthlyImportFieldKey = StaticMonthlyImportFieldKey | (string & {});

export interface MonthlyImportColumnDef {
  key: MonthlyImportFieldKey;
  label: string;
  defaultHeader: string;
  required?: boolean;
  kind: 'string' | 'number';
}

export const STATIC_MONTHLY_IMPORT_COLUMNS: MonthlyImportColumnDef[] = [
  {
    key: 'employeeId',
    label: '社員番号（照合用）',
    defaultHeader: 'employeeId',
    kind: 'string',
  },
  {
    key: 'displayName',
    label: '氏名（照合用）',
    defaultHeader: 'displayName',
    required: true,
    kind: 'string',
  },
  {
    key: 'basicSalary',
    label: '基本給与',
    defaultHeader: 'basicSalary',
    kind: 'number',
  },
  {
    key: 'overtimePay',
    label: '残業手当',
    defaultHeader: 'overtimePay',
    kind: 'number',
  },
  {
    key: 'commuterAllowance',
    label: '通勤手当',
    defaultHeader: 'commuterAllowance',
    kind: 'number',
  },
  {
    key: 'otherAllowance',
    label: 'その他手当',
    defaultHeader: 'otherAllowance',
    kind: 'number',
  },
  {
    key: 'retroactivePay',
    label: '遡及清算',
    defaultHeader: 'retroactivePay',
    kind: 'number',
  },
];

export function buildMonthlyImportColumnDefs(
): MonthlyImportColumnDef[] {
  return [...STATIC_MONTHLY_IMPORT_COLUMNS];
}

export function buildDefaultImportHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const col of buildMonthlyImportColumnDefs()) {
    headers[col.key] = col.defaultHeader;
  }
  return headers;
}
