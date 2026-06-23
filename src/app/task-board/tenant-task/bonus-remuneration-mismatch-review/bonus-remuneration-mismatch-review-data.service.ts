import { inject, Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
} from '@angular/fire/firestore';

export type BonusRemunerationMismatchReviewStatus =
  | 'pending_review'
  | 'resolved_computed'
  | 'resolved_stored'
  | 'resolved_custom';

export interface BonusRemunerationMismatchReviewItem {
  id: string;
  eid: string;
  teijiYear: number;
  screeningYyyyMm: string;
  employeeDisplayName: string;
  storedBonusRelatedRemuneration: number;
  computedBonusRelatedRemuneration: number;
  customBonusRelatedRemuneration?: number;
  qualifies: boolean;
  status: BonusRemunerationMismatchReviewStatus;
}

const STATUS_LABELS: Record<BonusRemunerationMismatchReviewStatus, string> = {
  pending_review: '未確認',
  resolved_computed: '実績値を適用済み',
  resolved_stored: '6月時点の入力値を適用済み',
  resolved_custom: '任意の値を適用済み',
};

export function bonusRemunerationMismatchStatusLabel(
  status: BonusRemunerationMismatchReviewStatus,
): string {
  return STATUS_LABELS[status];
}

@Injectable({ providedIn: 'root' })
export class BonusRemunerationMismatchReviewDataService {
  private readonly firestore = inject(Firestore);

  async listReviews(tid: string): Promise<BonusRemunerationMismatchReviewItem[]> {
    const ref = collection(
      this.firestore,
      'tenants',
      tid,
      'bonusRemunerationMismatchReviews',
    );
    const snap = await getDocs(ref);
    return snap.docs
      .map((docSnap) => this.mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
      .sort((a, b) => b.screeningYyyyMm.localeCompare(a.screeningYyyyMm));
  }

  async deleteReview(tid: string, reviewId: string): Promise<void> {
    await deleteDoc(
      doc(this.firestore, 'tenants', tid, 'bonusRemunerationMismatchReviews', reviewId),
    );
  }

  private mapDoc(
    id: string,
    data: Record<string, unknown>,
  ): BonusRemunerationMismatchReviewItem {
    return {
      id,
      eid: String(data['eid'] ?? ''),
      teijiYear: Number(data['teijiYear'] ?? 0),
      screeningYyyyMm: String(data['screeningYyyyMm'] ?? ''),
      employeeDisplayName: String(data['employeeDisplayName'] ?? ''),
      storedBonusRelatedRemuneration: Number(data['storedBonusRelatedRemuneration'] ?? 0),
      computedBonusRelatedRemuneration: Number(data['computedBonusRelatedRemuneration'] ?? 0),
      customBonusRelatedRemuneration:
        data['customBonusRelatedRemuneration'] == null
          ? undefined
          : Number(data['customBonusRelatedRemuneration']),
      qualifies: data['qualifies'] === true,
      status: (data['status'] as BonusRemunerationMismatchReviewStatus) ?? 'pending_review',
    };
  }
}
