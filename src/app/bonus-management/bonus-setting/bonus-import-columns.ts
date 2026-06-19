import { BonusTypeDefinition, BonusFormData } from '../../bonus-document';

export type StaticBonusImportFieldKey = keyof Pick<
  BonusFormData,
  | 'displayName'
  | 'employeeId'
>;

/** 給与・氏名列、または賞与 type（例: bonus-1） */
export type BonusImportFieldKey = StaticBonusImportFieldKey | (string & {});

export interface BonusImportColumnDef {
  key: BonusImportFieldKey;
  label: string;
  defaultHeader: string;
  required?: boolean;
  kind: 'string' | 'number';
}

export const STATIC_BONUS_IMPORT_COLUMNS: BonusImportColumnDef[] = [
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
): BonusImportColumnDef[] {
  return definitions.map((def) => ({
    key: def.type,
    label: def.label,
    defaultHeader: defaultBonusImportHeader(def.type),
    kind: 'number' as const,
  }));
}

export const PREMIUM_STANDARD_BONUS_IMPORT_COLUMNS: BonusImportColumnDef[] = [
  {
    key: 'standardBonusHealth',
    label: '標準賞与額（健保）',
    defaultHeader: 'standardBonusHealth',
    kind: 'number',
  },
  {
    key: 'standardBonusPension',
    label: '標準賞与額（厚年）',
    defaultHeader: 'standardBonusPension',
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

export function buildBonusImportColumnDefs(
  definitions: BonusTypeDefinition[],
): BonusImportColumnDef[] {
  return [
    ...STATIC_BONUS_IMPORT_COLUMNS,
    ...buildBonusImportColumns(definitions),
    ...PREMIUM_STANDARD_BONUS_IMPORT_COLUMNS,
  ];
}

export function buildDefaultImportHeaders(
  definitions: BonusTypeDefinition[],
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const col of buildBonusImportColumnDefs(definitions)) {
    headers[col.key] = col.defaultHeader;
  }
  return headers;
}
