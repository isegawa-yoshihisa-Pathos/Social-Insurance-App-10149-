import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';

export type RemunerationConsentReviewType =
  | 'teiji_annual_average'
  | 'zuiji_annual_average'
  | 'leave_return';

export type RemunerationConsentReviewStatus =
  | 'pending_employee_consent'
  | 'employee_declined'
  | 'pending_admin_review'
  | 'approved'
  | 'rejected';

export interface RemunerationConsentReviewItem {
  id: string;
  type: RemunerationConsentReviewType;
  eid: string;
  employeeDisplayName: string;
  status: RemunerationConsentReviewStatus;
  effectiveFrom: string;
  proposedHealthGrade: number;
  proposedPensionGrade: number;
  proposedRemuneration: number;
  summaryBody: string;
}

const TYPE_LABELS: Record<RemunerationConsentReviewType, string> = {
  teiji_annual_average: '定時決定・年間平均算定',
  zuiji_annual_average: '随時改定・年間平均算定',
  leave_return: '休業明け標準報酬月額調整',
};

const STATUS_LABELS: Record<RemunerationConsentReviewStatus, string> = {
  pending_employee_consent: '本人同意待ち',
  employee_declined: '本人不同意',
  pending_admin_review: '管理者承認待ち',
  approved: '承認済み',
  rejected: '却下',
};

const ACTIVE_STATUSES: RemunerationConsentReviewStatus[] = [
  'pending_employee_consent',
  'pending_admin_review',
];

export function remunerationConsentTypeLabel(type: RemunerationConsentReviewType): string {
  return TYPE_LABELS[type];
}

export function remunerationConsentStatusLabel(status: RemunerationConsentReviewStatus): string {
  return STATUS_LABELS[status];
}

function isActiveConsentStatus(status: RemunerationConsentReviewStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function sortConsentReviews(a: RemunerationConsentReviewItem, b: RemunerationConsentReviewItem): number {
  const activeOrder =
    (isActiveConsentStatus(a.status) ? 0 : 1) - (isActiveConsentStatus(b.status) ? 0 : 1);
  if (activeOrder !== 0) return activeOrder;
  const adminFirst =
    (a.status === 'pending_admin_review' ? 0 : 1) -
    (b.status === 'pending_admin_review' ? 0 : 1);
  if (adminFirst !== 0) return adminFirst;
  return a.effectiveFrom.localeCompare(b.effectiveFrom);
}

@Injectable({ providedIn: 'root' })
export class RemunerationConsentDataService {
  private readonly firestore = inject(Firestore);

  private reviewsRef(tid: string) {
    return collection(this.firestore, 'tenants', tid, 'remunerationConsentReviews');
  }

  async listEmployeeConsents(
    tid: string,
    eid: string,
  ): Promise<RemunerationConsentReviewItem[]> {
    const snap = await getDocs(
      query(this.reviewsRef(tid), where('eid', '==', eid)),
    );
    return snap.docs
      .map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()))
      .sort(sortConsentReviews);
  }

  /** @deprecated listEmployeeConsents を使用 */
  async listPendingEmployeeConsents(
    tid: string,
    eid: string,
  ): Promise<RemunerationConsentReviewItem[]> {
    return this.listEmployeeConsents(tid, eid);
  }

  async listAdminReviews(tid: string): Promise<RemunerationConsentReviewItem[]> {
    const snap = await getDocs(this.reviewsRef(tid));
    return snap.docs
      .map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()))
      .sort(sortConsentReviews);
  }

  /** @deprecated listAdminReviews を使用 */
  async listPendingAdminReviews(tid: string): Promise<RemunerationConsentReviewItem[]> {
    return this.listAdminReviews(tid);
  }

  /** @deprecated listAdminReviews を使用 */
  async listActiveAdminConsentStatuses(tid: string): Promise<RemunerationConsentReviewItem[]> {
    return this.listAdminReviews(tid);
  }

  async deleteReview(tid: string, reviewId: string): Promise<void> {
    await deleteDoc(doc(this.reviewsRef(tid), reviewId));
  }

  private mapDoc(id: string, data: Record<string, unknown>): RemunerationConsentReviewItem {
    return {
      id,
      type: (data['type'] as RemunerationConsentReviewType) ?? 'teiji_annual_average',
      eid: String(data['eid'] ?? ''),
      employeeDisplayName: String(data['employeeDisplayName'] ?? ''),
      status: (data['status'] as RemunerationConsentReviewStatus) ?? 'pending_employee_consent',
      effectiveFrom: String(data['effectiveFrom'] ?? ''),
      proposedHealthGrade: Number(data['proposedHealthGrade'] ?? 0),
      proposedPensionGrade: Number(data['proposedPensionGrade'] ?? 0),
      proposedRemuneration: Number(data['proposedRemuneration'] ?? 0),
      summaryBody: String(data['summaryBody'] ?? ''),
    };
  }
}
