import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
} from '@angular/fire/firestore';

export type MayJuneZuijiReviewStatus = 'pending_review' | 'approved' | 'rejected';

export interface MayJuneZuijiReviewItem {
  id: string;
  eid: string;
  raiseMonthYyyyMm: string;
  effectiveYyyyMm: string;
  screeningYyyyMm: string;
  employeeDisplayName: string;
  status: MayJuneZuijiReviewStatus;
}

const STATUS_LABELS: Record<MayJuneZuijiReviewStatus, string> = {
  pending_review: '確認待ち',
  approved: '承認済み',
  rejected: '却下',
};

export function mayJuneZuijiStatusLabel(status: MayJuneZuijiReviewStatus): string {
  return STATUS_LABELS[status];
}

@Injectable({ providedIn: 'root' })
export class MayJuneZuijiReviewDataService {
  private readonly firestore = inject(Firestore);

  async listReviews(tid: string): Promise<MayJuneZuijiReviewItem[]> {
    const ref = collection(this.firestore, 'tenants', tid, 'mayJuneZuijiReviews');
    const snap = await getDocs(ref);
    return snap.docs
      .map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()))
      .sort((a, b) => {
        const pendingOrder =
          (a.status === 'pending_review' ? 0 : 1) - (b.status === 'pending_review' ? 0 : 1);
        if (pendingOrder !== 0) return pendingOrder;
        return b.raiseMonthYyyyMm.localeCompare(a.raiseMonthYyyyMm);
      });
  }

  /** @deprecated listReviews を使用 */
  async listPendingReviews(tid: string): Promise<MayJuneZuijiReviewItem[]> {
    return this.listReviews(tid);
  }

  async deleteReview(tid: string, reviewId: string): Promise<void> {
    await deleteDoc(
      doc(this.firestore, 'tenants', tid, 'mayJuneZuijiReviews', reviewId),
    );
  }

  private mapDoc(id: string, data: Record<string, unknown>): MayJuneZuijiReviewItem {
    return {
      id,
      eid: String(data['eid'] ?? ''),
      raiseMonthYyyyMm: String(data['raiseMonthYyyyMm'] ?? ''),
      effectiveYyyyMm: String(data['effectiveYyyyMm'] ?? ''),
      screeningYyyyMm: String(data['screeningYyyyMm'] ?? ''),
      employeeDisplayName: String(data['employeeDisplayName'] ?? ''),
      status: (data['status'] as MayJuneZuijiReviewStatus) ?? 'pending_review',
    };
  }
}
