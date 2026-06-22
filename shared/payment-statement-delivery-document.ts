import type { FirestoreTimestamp } from './firestore-types';

/** 従業員ごとの給与明細送付（表示月単位） */
export interface PaymentStatementDeliveryDocument {
  displayYyyyMm: string;
  hasMonthly: boolean;
  hasBonus: boolean;
  deliveredAt: FirestoreTimestamp;
  deliveredByUid: string;
}

/** 月次データ参照権限（salaryMonth / premiumMonth） */
export interface DeliveredSourceMonthDocument {
  displayYyyyMm: string;
  deliveredAt: FirestoreTimestamp;
}

/** 賞与データ参照権限 */
export interface DeliveredBonusMonthDocument {
  displayYyyyMm: string;
  deliveredAt: FirestoreTimestamp;
}

/** テナント単位の送付状況（管理者向け） */
export interface PaymentStatementDeliveryStatusDocument {
  displayYyyyMm: string;
  deliveredCount: number;
  skippedNoAccount: number;
  lastDeliveredAt: FirestoreTimestamp;
  lastDeliveredByUid: string;
}

export interface DeliverPaymentStatementsResult {
  delivered: number;
  skippedNoAccount: number;
  skippedNoData: number;
}
