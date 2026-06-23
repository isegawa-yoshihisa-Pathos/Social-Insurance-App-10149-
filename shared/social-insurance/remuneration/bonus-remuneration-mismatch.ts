import { parseYyyyMm } from '../monthly/social-insurance-data.util';

/** 報酬計算 yyyyMm から賞与12等分算定（昨年7月〜当年6月）の定時決定対象年 */
export function teijiYearForBonusRemunerationLookback(yyyyMm: string): number {
  const { year, month } = parseYyyyMm(yyyyMm);
  return month >= 7 ? year + 1 : year;
}

export function hasBonusRelatedRemunerationMismatch(
  storedValue: number | undefined | null,
  computedValue: number,
): boolean {
  const stored = storedValue ?? 0;
  if (stored === computedValue) return false;
  return stored > 0 || computedValue > 0;
}

export function buildBonusRemunerationMismatchNotificationTitle(
  employeeDisplayName: string,
): string {
  return `【賞与に係る報酬】${employeeDisplayName}様 入力値と実績算定値の不一致`;
}

export function buildBonusRemunerationMismatchNotificationBody(
  employeeDisplayName: string,
  storedValue: number,
  computedValue: number,
  screeningYyyyMm: string,
): string {
  return (
    `${employeeDisplayName}様の${screeningYyyyMm}報酬計算（定時決定または7〜9月適用随時改定）において、` +
    `実績から算定した賞与に係る報酬（月額 ${computedValue.toLocaleString('ja-JP')} 円）と` +
    `現在の入力値（月額 ${storedValue.toLocaleString('ja-JP')} 円）が異なります。` +
    `タスクボードで判定に用いる値を選択し、${screeningYyyyMm} の計算を再実行してください。`
  );
}

export function bonusRemunerationMismatchReviewDocId(eid: string, teijiYear: number): string {
  return `${eid}_${teijiYear}`;
}
