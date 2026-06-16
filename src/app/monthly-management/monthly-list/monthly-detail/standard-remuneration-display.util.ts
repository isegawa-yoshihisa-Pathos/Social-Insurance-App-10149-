import { Timestamp } from '@angular/fire/firestore';
import { StandardRemunerationSource } from '../../../social-insurance/monthly/social-insurance-document';
import {
  RemunerationConsentReviewItem,
  remunerationConsentTypeLabel,
} from '../../../task-board/remuneration-consent-data.service';
import {
  RetroactiveRemunerationReviewItem,
  retroactiveReviewTypeLabel,
} from '../../../task-board/retroactive-remuneration-data.service';

const BASE_SOURCE_LABELS: Record<StandardRemunerationSource, string> = {
  initial: '初回決定',
  teiji: '定時決定',
  zuiji: '随時改定',
  provisional_zuiji: '暫定随時改定',
  manual: '手動設定',
  carried: '従前標準報酬月額の継続',
};

export function formatYyyyMmLabel(yyyyMm: string): string {
  if (!yyyyMm || yyyyMm.length < 7) return yyyyMm;
  const [year, month] = yyyyMm.split('-');
  return `${year}年${parseInt(month, 10)}月`;
}

export function formatFirestoreTimestamp(
  value: Timestamp | { toDate?: () => Date } | null | undefined,
): string {
  if (!value) return '';
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleString('ja-JP');
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('ja-JP');
  }
  return '';
}

export function resolveDeterminationLabel(
  effectiveFrom: string,
  source: StandardRemunerationSource,
  healthGrade: number,
  pensionGrade: number,
  consentReviews: RemunerationConsentReviewItem[],
  retroactiveReviews: RetroactiveRemunerationReviewItem[],
): string {
  const approvedConsent = consentReviews.find(
    (review) =>
      review.status === 'approved' &&
      review.effectiveFrom === effectiveFrom &&
      review.proposedHealthGrade === healthGrade &&
      review.proposedPensionGrade === pensionGrade,
  );
  if (approvedConsent) {
    return remunerationConsentTypeLabel(approvedConsent.type);
  }

  const retroactive = retroactiveReviews.find(
    (review) =>
      review.status === 'recalculated' &&
      review.proposedGrades?.effectiveFrom === effectiveFrom &&
      review.proposedGrades?.healthGrade === healthGrade &&
      review.proposedGrades?.pensionGrade === pensionGrade,
  );
  if (retroactive) {
    return retroactiveReviewTypeLabel(retroactive.type);
  }

  return BASE_SOURCE_LABELS[source];
}

export function inferCalculationYyyyMm(
  source: StandardRemunerationSource,
  effectiveFrom: string,
): string | null {
  if (source === 'teiji') {
    const year = effectiveFrom.slice(0, 4);
    return `${year}-07`;
  }
  if (source === 'initial' || source === 'zuiji' || source === 'provisional_zuiji' || source === 'manual') {
    return effectiveFrom;
  }
  return null;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('ja-JP');
}
