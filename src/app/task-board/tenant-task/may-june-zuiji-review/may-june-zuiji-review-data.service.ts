import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
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

@Injectable({ providedIn: 'root' })
export class MayJuneZuijiReviewDataService {
  private readonly firestore = inject(Firestore);

  async listPendingReviews(tid: string): Promise<MayJuneZuijiReviewItem[]> {
    const ref = collection(this.firestore, 'tenants', tid, 'mayJuneZuijiReviews');
    const snap = await getDocs(query(ref, where('status', '==', 'pending_review')));
    return snap.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          eid: String(data['eid'] ?? ''),
          raiseMonthYyyyMm: String(data['raiseMonthYyyyMm'] ?? ''),
          effectiveYyyyMm: String(data['effectiveYyyyMm'] ?? ''),
          screeningYyyyMm: String(data['screeningYyyyMm'] ?? ''),
          employeeDisplayName: String(data['employeeDisplayName'] ?? ''),
          status: (data['status'] as MayJuneZuijiReviewStatus) ?? 'pending_review',
        };
      })
      .sort((a, b) => a.effectiveYyyyMm.localeCompare(b.effectiveYyyyMm));
  }
}
