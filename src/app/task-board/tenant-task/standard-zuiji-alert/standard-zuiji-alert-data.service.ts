import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
} from '@angular/fire/firestore';

export interface StandardZuijiAlertItem {
  id: string;
  eid: string;
  changeMonthYyyyMm: string;
  effectiveYyyyMm: string;
  screeningYyyyMm: string;
  employeeDisplayName: string;
  previousHealthGrade: number;
  previousPensionGrade: number;
  newHealthGrade: number;
  newPensionGrade: number;
}

@Injectable({ providedIn: 'root' })
export class StandardZuijiAlertDataService {
  private readonly firestore = inject(Firestore);

  async listAlerts(tid: string): Promise<StandardZuijiAlertItem[]> {
    const ref = collection(this.firestore, 'tenants', tid, 'standardZuijiAlerts');
    const snap = await getDocs(ref);
    return snap.docs
      .map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()))
      .sort((a, b) => b.changeMonthYyyyMm.localeCompare(a.changeMonthYyyyMm));
  }

  async deleteAlert(tid: string, alertId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'tenants', tid, 'standardZuijiAlerts', alertId));
  }

  private mapDoc(id: string, data: Record<string, unknown>): StandardZuijiAlertItem {
    return {
      id,
      eid: String(data['eid'] ?? ''),
      changeMonthYyyyMm: String(data['changeMonthYyyyMm'] ?? ''),
      effectiveYyyyMm: String(data['effectiveYyyyMm'] ?? ''),
      screeningYyyyMm: String(data['screeningYyyyMm'] ?? ''),
      employeeDisplayName: String(data['employeeDisplayName'] ?? ''),
      previousHealthGrade: Number(data['previousHealthGrade'] ?? 0),
      previousPensionGrade: Number(data['previousPensionGrade'] ?? 0),
      newHealthGrade: Number(data['newHealthGrade'] ?? 0),
      newPensionGrade: Number(data['newPensionGrade'] ?? 0),
    };
  }
}
