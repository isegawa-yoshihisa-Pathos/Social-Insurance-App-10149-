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
  if (trigger === 'bonus'){
    return `【二以上事業所】${employeeDisplayName}様：${TRIGGER_LABELS[trigger]}に伴う保険料の手入力が必要な可能性があります`;
  }
  return `【二以上事業所】${employeeDisplayName}様：${TRIGGER_LABELS[trigger]}に伴う保険料の手入力が必要です`;
}

export function buildMultiWorkplaceManualPremiumNotificationBody(
  employeeDisplayName: string,
  trigger: MultiWorkplacePremiumAlertTrigger,
  yyyyMm: string,
  isSelectedWorkplace?: boolean,
): string {
  const reason = TRIGGER_LABELS[trigger];
  if (trigger === 'bonus'){
    return (
      `${employeeDisplayName}様は二以上事業所勤務のため、${reason}（${yyyyMm}）に伴い` +
      `合算による保険料の決定通知に基づく手入力が必要な可能性があります。` +
      `自動計算された保険料をそのまま確定（ロック）せず、決定通知の金額を手入力してください。`+
      (!isSelectedWorkplace ? `保険料計算には${employeeDisplayName}様の「選択事業所」の保険料率が必要です。` : '')
    );
  }
  return (
    `${employeeDisplayName}様は二以上事業所勤務のため、${reason}（${yyyyMm}）に伴い` +
    `合算による保険料の決定通知に基づく手入力が必要です。` +
    `自動計算された保険料をそのまま確定（ロック）せず、決定通知の金額を手入力してください。`
  );
}
