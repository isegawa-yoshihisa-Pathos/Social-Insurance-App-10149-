import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { StandardRemunerationDocument } from './social-insurance-document';
import { AuditLogService } from '../../audit-log/audit-log.service';

export type StandardRemunerationSavePayload = Omit<
  StandardRemunerationDocument,
  'createdAt' | 'updatedAt'
>;

export interface StandardRemunerationListItem {
  yyyyMm: string;
  doc: StandardRemunerationDocument;
}

@Injectable({ providedIn: 'root' })
export class StandardRemunerationDataService {
  private readonly firestore = inject(Firestore);
  private readonly auditLog = inject(AuditLogService);

  private subcollection(tid: string, eid: string) {
    return collection(
      this.firestore,
      'tenants',
      tid,
      'employees',
      eid,
      'standardRemuneration',
    );
  }

  private docRef(tid: string, eid: string, yyyyMm: string) {
    return doc(this.subcollection(tid, eid), yyyyMm);
  }

  async get(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<StandardRemunerationDocument | null> {
    const snap = await getDoc(this.docRef(tid, eid, yyyyMm));
    if (!snap.exists()) return null;
    return snap.data() as StandardRemunerationDocument;
  }

  async getLatest(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<StandardRemunerationSavePayload | null> {
    const history = await this.listForEmployee(tid, eid);
    const found = history.find((item) => item.yyyyMm <= yyyyMm);
    return found?.doc ?? null;
  }

  async listForEmployee(
    tid: string,
    eid: string,
  ): Promise<StandardRemunerationListItem[]> {
    const snap = await getDocs(this.subcollection(tid, eid));
    const items = snap.docs.map((d) => ({
      yyyyMm: d.id,
      doc: d.data() as StandardRemunerationDocument,
    }));
    return items.sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm));
  }

  async save(
    tid: string,
    eid: string,
    yyyyMm: string,
    payload: StandardRemunerationSavePayload,
  ): Promise<void> {
    const ref = this.docRef(tid, eid, yyyyMm);
    const existing = await getDoc(ref);
    await setDoc(ref, {
      ...payload,
      createdAt: existing.exists()
        ? (existing.data() as StandardRemunerationDocument).createdAt
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, {merge: true});

    await this.auditLog.record({
      tid,
      action: existing.exists() ? 'update' : 'create',
      category: 'standard_remuneration',
      summary: existing.exists() ? '標準報酬月額を更新' : '標準報酬月額を作成',
      target: this.auditLog.employeeTarget(eid, '', undefined, yyyyMm),
      metadata: { source: payload.source },
    });
  }
}