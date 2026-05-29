import { BonusTypeDefinition, MonthlyFormData } from '../../monthly-document';

export type StaticMonthlyImportFieldKey = keyof Pick<
  MonthlyFormData,
  | 'displayName'
  | 'totalPay'
  | 'basicSalary'
  | 'overtimePay'
  | 'commuterAllowance'
  | 'otherAllowance'
  | 'retroactivePay'
>;

/** 給与・氏名列、または賞与 type（例: bonus-1） */
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
    key: 'displayName',
    label: '氏名',
    defaultHeader: 'displayName',
    required: true,
    kind: 'string',
  },
  {
    key: 'totalPay',
    label: '総支給額',
    defaultHeader: 'totalPay',
    kind: 'number',
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

export function defaultBonusImportHeader(bonusType: string): string {
  const match = /^bonus-(\d+)$/.exec(bonusType);
  if (match) {
    return `bonus-type-${match[1]}`;
  }
  return bonusType;
}

export function buildBonusImportColumns(
  definitions: BonusTypeDefinition[],
): MonthlyImportColumnDef[] {
  return definitions.map((def) => ({
    key: def.type,
    label: def.label,
    defaultHeader: defaultBonusImportHeader(def.type),
    kind: 'number' as const,
  }));
}

export function buildMonthlyImportColumnDefs(
  definitions: BonusTypeDefinition[],
): MonthlyImportColumnDef[] {
  return [...STATIC_MONTHLY_IMPORT_COLUMNS, ...buildBonusImportColumns(definitions)];
}

export function buildDefaultImportHeaders(
  definitions: BonusTypeDefinition[],
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const col of buildMonthlyImportColumnDefs(definitions)) {
    headers[col.key] = col.defaultHeader;
  }
  return headers;
}
