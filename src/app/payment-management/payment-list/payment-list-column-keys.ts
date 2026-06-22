export const PAYMENT_SUMMARY_COLUMN_KEYS = [
  'monthlyNetPayment',
  'bonusNetPayment',
  'totalNetPayment',
] as const;

export type PaymentSummaryColumnKey = (typeof PAYMENT_SUMMARY_COLUMN_KEYS)[number];

export const PAYMENT_SUMMARY_COLUMN_LABELS: Record<PaymentSummaryColumnKey, string> = {
  monthlyNetPayment: '月次総支払',
  bonusNetPayment: '賞与総支払',
  totalNetPayment: '合計総支払',
};

export function isPaymentSummaryColumn(column: string): column is PaymentSummaryColumnKey {
  return (PAYMENT_SUMMARY_COLUMN_KEYS as readonly string[]).includes(column);
}

export const BASE_PAYMENT_LIST_COLUMN_KEYS = [
  'displayName',
  'employeeId',
  'paymentBaseDays',
  'basicSalary',
  'fringeBenefits',
  'bonusRelatedRemuneration',
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
  fringeBenefits: '現物給与',
  bonusRelatedRemuneration: '（賞与に係る報酬）',
  fixedWage: '固定的賃金',
  variableWage: '非固定的賃金',
  retroactivePay: '遡及支払',
  bonus: '賞与合計',
};
