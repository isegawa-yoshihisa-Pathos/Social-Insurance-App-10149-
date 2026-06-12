import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
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

export function remunerationConsentTypeLabel(type: RemunerationConsentReviewType): string {
  return TYPE_LABELS[type];
}

@Injectable({ providedIn: 'root' })
export class RemunerationConsentDataService {
  private readonly firestore = inject(Firestore);

  async listPendingEmployeeConsents(
    tid: string,
    eid: string,
  ): Promise<RemunerationConsentReviewItem[]> {
    const ref = collection(this.firestore, 'tenants', tid, 'remunerationConsentReviews');
    const snap = await getDocs(
      query(
        ref,
        where('eid', '==', eid),
        where('status', '==', 'pending_employee_consent'),
      ),
    );
    return snap.docs.map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()));
  }

  async listPendingAdminReviews(tid: string): Promise<RemunerationConsentReviewItem[]> {
    const ref = collection(this.firestore, 'tenants', tid, 'remunerationConsentReviews');
    const snap = await getDocs(
      query(ref, where('status', '==', 'pending_admin_review')),
    );
    return snap.docs
      .map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()))
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
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
