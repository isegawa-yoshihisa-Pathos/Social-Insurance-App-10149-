import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import type {
  RetroactivePayReviewItem,
  RetroactiveRemunerationProposedGrades,
  RetroactiveRemunerationReviewDocument,
  RetroactiveRemunerationReviewStatus,
  RetroactiveRemunerationReviewType,
} from '../../../shared/retroactive-remuneration-review-document';
import { normalizeRetroactiveReviewItems } from '../../../shared/social-insurance/remuneration/retroactive-remuneration';

export interface RetroactiveRemunerationReviewItem {
  id: string;
  type: RetroactiveRemunerationReviewType;
  eid: string;
  employeeDisplayName: string;
  status: RetroactiveRemunerationReviewStatus;
  teijiYear: number;
  screeningYyyyMm: string;
  windowMonthKeys: string[];
  calculationMonthKeys: string[];
  items: RetroactivePayReviewItem[];
  originalGrades?: RetroactiveRemunerationProposedGrades;
  proposedGrades?: RetroactiveRemunerationProposedGrades;
}

const TYPE_LABELS: Record<RetroactiveRemunerationReviewType, string> = {
  teiji: '定時決定',
  teiji_annual_average: '定時決定・年間平均算定',
};

const STATUS_LABELS: Record<RetroactiveRemunerationReviewStatus, string> = {
  pending_admin: '配分・再計算待ち',
  recalculated: '再計算済み',
  skipped: 'スキップ',
};

export function retroactiveReviewTypeLabel(type: RetroactiveRemunerationReviewType): string {
  return TYPE_LABELS[type];
}

export function retroactiveReviewStatusLabel(status: RetroactiveRemunerationReviewStatus): string {
  return STATUS_LABELS[status];
}

function sortReviews(a: RetroactiveRemunerationReviewItem, b: RetroactiveRemunerationReviewItem): number {
  const activeOrder =
    (a.status === 'pending_admin' ? 0 : 1) - (b.status === 'pending_admin' ? 0 : 1);
  if (activeOrder !== 0) return activeOrder;
  return b.screeningYyyyMm.localeCompare(a.screeningYyyyMm);
}

@Injectable({ providedIn: 'root' })
export class RetroactiveRemunerationDataService {
  private readonly firestore = inject(Firestore);

  private reviewsRef(tid: string) {
    return collection(this.firestore, 'tenants', tid, 'retroactiveRemunerationReviews');
  }

  async listAdminReviews(tid: string): Promise<RetroactiveRemunerationReviewItem[]> {
    const snap = await getDocs(this.reviewsRef(tid));
    return snap.docs.map((docSnap) => this.mapDoc(docSnap.id, docSnap.data())).sort(sortReviews);
  }

  async listEmployeeReviews(
    tid: string,
    eid: string,
  ): Promise<RetroactiveRemunerationReviewItem[]> {
    const snap = await getDocs(query(this.reviewsRef(tid), where('eid', '==', eid)));
    return snap.docs.map((docSnap) => this.mapDoc(docSnap.id, docSnap.data())).sort(sortReviews);
  }

  async getReview(tid: string, reviewId: string): Promise<RetroactiveRemunerationReviewItem | null> {
    const snap = await getDoc(doc(this.reviewsRef(tid), reviewId));
    if (!snap.exists()) return null;
    return this.mapDoc(snap.id, snap.data());
  }

  async deleteReview(tid: string, reviewId: string): Promise<void> {
    await deleteDoc(doc(this.reviewsRef(tid), reviewId));
  }

  private mapDoc(id: string, data: Record<string, unknown>): RetroactiveRemunerationReviewItem {
    const docData = data as unknown as RetroactiveRemunerationReviewDocument;
    return {
      id,
      type: docData.type ?? 'teiji',
      eid: String(docData.eid ?? ''),
      employeeDisplayName: String(docData.employeeDisplayName ?? ''),
      status: docData.status ?? 'pending_admin',
      teijiYear: Number(docData.teijiYear ?? 0),
      screeningYyyyMm: String(docData.screeningYyyyMm ?? ''),
      windowMonthKeys: Array.isArray(docData.windowMonthKeys) ? [...docData.windowMonthKeys] : [],
      calculationMonthKeys: Array.isArray(docData.calculationMonthKeys)
        ? [...docData.calculationMonthKeys]
        : [],
      items: Array.isArray(docData.items)
        ? normalizeRetroactiveReviewItems(structuredClone(docData.items))
        : [],
      originalGrades: docData.originalGrades,
      proposedGrades: docData.proposedGrades,
    };
  }
}
