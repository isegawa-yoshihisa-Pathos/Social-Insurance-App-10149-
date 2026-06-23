import type { EmployeeLeaveType } from '../../employee-document';

export type LeavePremiumAlertPremiumKind = 'monthly' | 'bonus';

const PREMIUM_KIND_LABELS: Record<LeavePremiumAlertPremiumKind, string> = {
  monthly: '報酬',
  bonus: '賞与',
};

const LEAVE_TYPE_LABELS: Record<Extract<EmployeeLeaveType, 'maternity' | 'childcare'>, string> = {
  maternity: '産前産後休業',
  childcare: '育児休業等',
};

export function buildLeavePremiumExemptionNotificationTitle(
  employeeDisplayName: string,
  leaveType: Extract<EmployeeLeaveType, 'maternity' | 'childcare'>,
  yyyyMm: string,
  premiumKind: LeavePremiumAlertPremiumKind,
): string {
  return (
    `【保険料免除】${employeeDisplayName}様 ${LEAVE_TYPE_LABELS[leaveType]}による` +
    `${PREMIUM_KIND_LABELS[premiumKind]}保険料免除（${yyyyMm}）`
  );
}

export function buildLeavePremiumExemptionNotificationBody(
  employeeDisplayName: string,
  leaveType: Extract<EmployeeLeaveType, 'maternity' | 'childcare'>,
  yyyyMm: string,
  premiumKind: LeavePremiumAlertPremiumKind,
): string {
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType];
  const premiumLabel = PREMIUM_KIND_LABELS[premiumKind];
  const detail =
    premiumKind === 'monthly'
      ? `${leaveLabel}の取得期間に該当するため、${yyyyMm}月分の${premiumLabel}保険料（労使双方）は免除（0円）として計算されました。`
      : `${leaveLabel}の取得に該当するため、${yyyyMm}月分${premiumLabel}の保険料は免除（0円）として計算されました。`;
  return `${employeeDisplayName}様の${detail}給与・手続きへの反映を確認してください。`;
}
