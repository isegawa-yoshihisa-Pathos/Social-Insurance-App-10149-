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

export function buildBonusImportColumnDefs(
  definitions: BonusTypeDefinition[],
): BonusImportColumnDef[] {
  return [...STATIC_BONUS_IMPORT_COLUMNS, ...buildBonusImportColumns(definitions)];
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
