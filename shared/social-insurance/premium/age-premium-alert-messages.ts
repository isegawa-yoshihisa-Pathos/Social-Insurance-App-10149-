import type { AgePremiumTransitionKind } from './age-premium-transition';

export type AgePremiumAlertPremiumKind = 'monthly' | 'bonus';

const PREMIUM_KIND_LABELS: Record<AgePremiumAlertPremiumKind, string> = {
  monthly: '報酬',
  bonus: '賞与',
};

const TRANSITION_LABELS: Record<AgePremiumTransitionKind, string> = {
  care_insurance_collection_start: '介護保険料の徴収開始（第2号被保険者）',
  care_insurance_collection_end: '介護保険料の徴収終了（第2号被保険者）',
  specific_care_insurance_collection_start: '介護保険料の徴収開始（特定被保険者）',
  specific_care_insurance_collection_end: '介護保険料の徴収終了（特定被保険者）',
  health_insurance_end: '健康保険料の徴収終了',
  pension_insurance_end: '厚生年金保険料の徴収終了',
};

const TRANSITION_DETAILS: Record<AgePremiumTransitionKind, string> = {
  care_insurance_collection_start:
    '介護保険第2号被保険者として介護保険料の徴収が開始されました。',
  care_insurance_collection_end:
    '65歳到達に伴い、介護保険第2号被保険者としての介護保険料徴収が終了しました。',
  specific_care_insurance_collection_start:
    '特定被保険者に該当する配偶者等の年齢到達により、特定被保険者として介護保険料の徴収が開始されました。',
  specific_care_insurance_collection_end:
    '特定被保険者に該当する配偶者等の年齢到達の終了等により、特定被保険者としての介護保険料徴収が終了しました。',
  health_insurance_end:
    '75歳到達（後期高齢者医療制度への移行）に伴い、健康保険料の徴収が終了しました。',
  pension_insurance_end:
    '70歳到達（70歳以上被用者該当）に伴い、厚生年金保険料の徴収が終了しました。',
};

export function buildAgePremiumTransitionNotificationTitle(
  employeeDisplayName: string,
  kind: AgePremiumTransitionKind,
  yyyyMm: string,
  premiumKind: AgePremiumAlertPremiumKind,
): string {
  return (
    `【保険料変更】${employeeDisplayName}様 ${TRANSITION_LABELS[kind]}` +
    `（${yyyyMm}・${PREMIUM_KIND_LABELS[premiumKind]}）`
  );
}

export function buildAgePremiumTransitionNotificationBody(
  employeeDisplayName: string,
  kind: AgePremiumTransitionKind,
  yyyyMm: string,
  premiumKind: AgePremiumAlertPremiumKind,
): string {
  return (
    `${employeeDisplayName}様の${yyyyMm}月分${PREMIUM_KIND_LABELS[premiumKind]}保険料計算において、` +
    `${TRANSITION_DETAILS[kind]}` +
    '給与・手続きへの反映を確認してください。'
  );
}
