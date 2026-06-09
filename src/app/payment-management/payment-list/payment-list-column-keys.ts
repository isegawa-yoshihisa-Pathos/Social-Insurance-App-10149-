export const BASE_PAYMENT_LIST_COLUMN_KEYS = [
  'displayName',
  'employeeId',
  'paymentBaseDays',
  'basicSalary',
  'fixedWage',
  'variableWage',
  'retroactivePay',
  'bonus',
] as const;

export type BasePaymentListColumnKey = (typeof BASE_PAYMENT_LIST_COLUMN_KEYS)[number];

export const STATIC_PAYMENT_LIST_COLUMN_LABELS: Record<BasePaymentListColumnKey, string> = {
  displayName: '氏名',
  employeeId: '社員番号',
  paymentBaseDays: '支払基礎日数',
  basicSalary: '基本給与',
  fixedWage: '固定的賃金',
  variableWage: '非固定的賃金',
  retroactivePay: '遡及清算',
  bonus: '賞与合計',
};
