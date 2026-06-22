import { AllowanceTypeDefinition } from '../../payment-document';
import { MonthlyFormData } from '../../monthly-document';

export type StaticMonthlyImportFieldKey = keyof Pick<
  MonthlyFormData,
  | 'displayName'
  | 'employeeId'
  | 'paymentBaseDays'
  | 'basicSalary'
  | 'fringeBenefits'
  | 'bonusRelatedRemuneration'
  | 'retroactivePay'
>;

/** 給与・氏名列、または手当 type */
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
    kind: 'string',
  },
  {
    key: 'paymentBaseDays',
    label: '支払基礎日数',
    defaultHeader: 'paymentBaseDays',
    kind: 'number',
  },
  {
    key: 'basicSalary',
    label: '基本給与',
    defaultHeader: 'basicSalary',
    kind: 'number',
  },
  {
    key: 'fringeBenefits',
    label: '現物給与',
    defaultHeader: 'fringeBenefits',
    kind: 'number',
  },
  {
    key: 'bonusRelatedRemuneration',
    label: '（賞与に係る報酬）',
    defaultHeader: 'bonusRelatedRemuneration',
    kind: 'number',
  },
  {
    key: 'retroactivePay',
    label: '遡及支払',
    defaultHeader: 'retroactivePay',
    kind: 'number',
  },
];

function defaultAllowanceImportHeader(allowanceType: string): string {
  const match = /^allowance-(\d+)$/.exec(allowanceType);
  if (match) {
    return `allowance-type-${match[1]}`;
  }
  return allowanceType;
}

export function buildAllowanceImportColumns(
  definitions: AllowanceTypeDefinition[],
): MonthlyImportColumnDef[] {
  return definitions.map((def) => ({
    key: def.type,
    label: def.label,
    defaultHeader: defaultAllowanceImportHeader(def.type),
    kind: 'number' as const,
  }));
}

export const PREMIUM_STANDARD_MONTHLY_IMPORT_COLUMNS: MonthlyImportColumnDef[] = [
  {
    key: 'standardRemunerationHealth',
    label: '標準報酬月額（健保）',
    defaultHeader: 'standardRemunerationHealth',
    kind: 'number',
  },
  {
    key: 'standardRemunerationPension',
    label: '標準報酬月額（厚年）',
    defaultHeader: 'standardRemunerationPension',
    kind: 'number',
  },
  {
    key: 'healthInsuranceEmployee',
    label: '健保（本人）',
    defaultHeader: 'healthInsuranceEmployee',
    kind: 'number',
  },
  {
    key: 'healthInsuranceTotal',
    label: '健保（合計）',
    defaultHeader: 'healthInsuranceTotal',
    kind: 'number',
  },
  {
    key: 'careInsuranceEmployee',
    label: '介護（本人）',
    defaultHeader: 'careInsuranceEmployee',
    kind: 'number',
  },
  {
    key: 'careInsuranceTotal',
    label: '介護（合計）',
    defaultHeader: 'careInsuranceTotal',
    kind: 'number',
  },
  {
    key: 'pensionInsuranceEmployee',
    label: '厚年（本人）',
    defaultHeader: 'pensionInsuranceEmployee',
    kind: 'number',
  },
  {
    key: 'pensionInsuranceTotal',
    label: '厚年（合計）',
    defaultHeader: 'pensionInsuranceTotal',
    kind: 'number',
  },
];

export function buildMonthlyImportColumnDefs(
  definitions: AllowanceTypeDefinition[],
): MonthlyImportColumnDef[] {
  return [
    ...STATIC_MONTHLY_IMPORT_COLUMNS,
    ...buildAllowanceImportColumns(definitions),
    ...PREMIUM_STANDARD_MONTHLY_IMPORT_COLUMNS,
  ];
}

export function buildDefaultImportHeaders(
  definitions: AllowanceTypeDefinition[],
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const col of buildMonthlyImportColumnDefs(definitions)) {
    headers[col.key] = col.defaultHeader;
  }
  return headers;
}
