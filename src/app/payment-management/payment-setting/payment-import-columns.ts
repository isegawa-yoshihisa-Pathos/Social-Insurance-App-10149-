import { AllowanceTypeDefinition, PaymentFormData } from '../../payment-document';

export type StaticPaymentImportFieldKey = keyof Pick<
  PaymentFormData,
  | 'displayName'
  | 'employeeId'
  | 'basicSalary'
  | 'retroactivePay'
>;

/** 給与・氏名列、または手当 type（例: commuting-allowance） */
export type PaymentImportFieldKey = StaticPaymentImportFieldKey | (string & {});

export interface PaymentImportColumnDef {
  key: PaymentImportFieldKey;
  label: string;
  defaultHeader: string;
  required?: boolean;
  kind: 'string' | 'number';
}

export const STATIC_PAYMENT_IMPORT_COLUMNS: PaymentImportColumnDef[] = [
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
    key: 'retroactivePay',
    label: '遡及清算',
    defaultHeader: 'retroactivePay',
    kind: 'number',
  },
];

export function defaultAllowanceImportHeader(allowanceType: string): string {
  const match = /^allowance-(\d+)$/.exec(allowanceType);
  if (match) {
    return `allowance-type-${match[1]}`;
  }
  return allowanceType;
}

export function buildAllowanceImportColumns(
  definitions: AllowanceTypeDefinition[],
): PaymentImportColumnDef[] {
  return definitions.map((def) => ({
    key: def.type,
    label: def.label,
    defaultHeader: defaultAllowanceImportHeader(def.type),
    kind: 'number' as const,
  }));
}

export function buildPaymentImportColumnDefs(
  definitions: AllowanceTypeDefinition[],
): PaymentImportColumnDef[] {
  return [...STATIC_PAYMENT_IMPORT_COLUMNS, ...buildAllowanceImportColumns(definitions)];
}

export function buildDefaultImportHeaders(
  definitions: AllowanceTypeDefinition[],
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const col of buildPaymentImportColumnDefs(definitions)) {
    headers[col.key] = col.defaultHeader;
  }
  return headers;
}
