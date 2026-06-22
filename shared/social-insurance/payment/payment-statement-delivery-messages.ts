export function formatPaymentStatementDisplayMonthLabel(displayYyyyMm: string): string {
  const [year, month] = displayYyyyMm.split('-');
  return `${year}年${parseInt(month, 10)}月`;
}

export function buildPaymentStatementDeliveredEmployeeTitle(displayYyyyMm: string): string {
  return `【給与明細】${formatPaymentStatementDisplayMonthLabel(displayYyyyMm)}分が届きました`;
}

export function buildPaymentStatementDeliveredEmployeeBody(displayYyyyMm: string): string {
  return `${formatPaymentStatementDisplayMonthLabel(displayYyyyMm)}分の給与・賞与明細をマイページに送付しました。マイページからご確認ください。`;
}

export function buildPaymentStatementDeliveryAdminTitle(displayYyyyMm: string): string {
  return `【給与明細送付】${formatPaymentStatementDisplayMonthLabel(displayYyyyMm)}分を従業員へ送付しました`;
}

export function buildPaymentStatementDeliveryAdminBody(
  displayYyyyMm: string,
  delivered: number,
  skippedNoAccount: number,
): string {
  const label = formatPaymentStatementDisplayMonthLabel(displayYyyyMm);
  const skipped =
    skippedNoAccount > 0 ? `（アカウント未連携 ${skippedNoAccount} 名は通知のみ省略）` : '';
  return `${label}分の給与明細を ${delivered} 名の従業員マイページへ送付しました${skipped}。`;
}
