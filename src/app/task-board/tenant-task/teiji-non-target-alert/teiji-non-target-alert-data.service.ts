import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
} from '@angular/fire/firestore';

export type TeijiNonTargetReason =
  | 'insufficient_payment_base_days'
  | 'on_leave_during_period'
  | 'grade_not_found'
  | 'license_start_after_june';

export interface TeijiNonTargetAlertItem {
  id: string;
  eid: string;
  teijiYear: number;
  screeningYyyyMm: string;
  effectiveYyyyMm: string;
  employeeDisplayName: string;
  reason: TeijiNonTargetReason;
}

const REASON_LABELS: Record<TeijiNonTargetReason, string> = {
  insufficient_payment_base_days:
    '4〜6月の支払基礎日数が算定基準を満たさないため、平均による定時決定ができません。従前の等級を継続します。',
  on_leave_during_period:
    '4〜6月に産休・育休等の休業があり、定時決定の対象外です。従前の等級を継続します。',
  grade_not_found: '4〜6月の報酬から等級を決定できませんでした。',
  license_start_after_june: '当年6月1日以降の資格取得のため、定時決定の対象外です。',
};

export function teijiNonTargetReasonLabel(reason: TeijiNonTargetReason): string {
  return REASON_LABELS[reason];
}

@Injectable({ providedIn: 'root' })
export class TeijiNonTargetAlertDataService {
  private readonly firestore = inject(Firestore);

  async listAlerts(tid: string): Promise<TeijiNonTargetAlertItem[]> {
    const ref = collection(this.firestore, 'tenants', tid, 'teijiNonTargetAlerts');
    const snap = await getDocs(ref);
    return snap.docs
      .map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()))
      .sort((a, b) => b.teijiYear - a.teijiYear || b.screeningYyyyMm.localeCompare(a.screeningYyyyMm));
  }

  async deleteAlert(tid: string, alertId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'tenants', tid, 'teijiNonTargetAlerts', alertId));
  }

  private mapDoc(id: string, data: Record<string, unknown>): TeijiNonTargetAlertItem {
    return {
      id,
      eid: String(data['eid'] ?? ''),
      teijiYear: Number(data['teijiYear'] ?? 0),
      screeningYyyyMm: String(data['screeningYyyyMm'] ?? ''),
      effectiveYyyyMm: String(data['effectiveYyyyMm'] ?? ''),
      employeeDisplayName: String(data['employeeDisplayName'] ?? ''),
      reason: (data['reason'] as TeijiNonTargetReason) ?? 'insufficient_payment_base_days',
    };
  }
}
