export type MultiWorkplacePremiumAlertTrigger =
  | 'remuneration_change'
  | 'teiji'
  | 'bonus';

const TRIGGER_LABELS: Record<MultiWorkplacePremiumAlertTrigger, string> = {
  remuneration_change: '標準報酬月額の変更',
  teiji: '定時決定',
  bonus: '賞与支給',
};

export function buildMultiWorkplaceManualPremiumNotificationTitle(
  employeeDisplayName: string,
  trigger: MultiWorkplacePremiumAlertTrigger,
): string {
  return `【二以上事業所】${employeeDisplayName}様：${TRIGGER_LABELS[trigger]}に伴う保険料の手入力が必要です`;
}

export function buildMultiWorkplaceManualPremiumNotificationBody(
  employeeDisplayName: string,
  trigger: MultiWorkplacePremiumAlertTrigger,
  yyyyMm: string,
): string {
  const reason = TRIGGER_LABELS[trigger];
  return (
    `${employeeDisplayName}様は二以上事業所勤務のため、${reason}（${yyyyMm}）に伴い` +
    `合算による保険料の決定通知に基づく手入力が必要です。` +
    `自動計算された保険料をそのまま確定（ロック）せず、決定通知の金額を手入力してください。`
  );
}
