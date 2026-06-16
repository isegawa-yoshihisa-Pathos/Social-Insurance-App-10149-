export type EmployeeInputRequestField =
  | 'myNumber'
  | 'basicPensionNumber'
  | 'birthDate'
  | 'hasDependents';

export const EMPLOYEE_INPUT_REQUEST_FIELD_LABELS: Record<EmployeeInputRequestField, string> = {
  myNumber: 'マイナンバー',
  basicPensionNumber: '基礎年金番号',
  birthDate: '生年月日',
  hasDependents: '扶養家族',
};

export function buildEmployeeInputRequestNotificationTitle(
  field: EmployeeInputRequestField,
): string {
  const label = EMPLOYEE_INPUT_REQUEST_FIELD_LABELS[field];
  return `【入力依頼】${label}の入力をお願いします`;
}

export function buildEmployeeInputRequestNotificationBody(
  field: EmployeeInputRequestField,
): string {
  const label = EMPLOYEE_INPUT_REQUEST_FIELD_LABELS[field];
  if (field === 'hasDependents') {
    return `管理者より「${label}」情報の入力・更新が依頼されています。個人設定画面から申請してください。`;
  }
  return `管理者より「${label}」の入力が依頼されています。個人設定画面から入力・申請してください。`;
}
