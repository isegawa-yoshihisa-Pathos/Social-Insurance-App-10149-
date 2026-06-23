import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { omitUndefinedFields } from '../../../../shared/omit-undefined-fields';
import { StandardBonusDocument } from './social-insurance-document';
import { AuditLogService } from '../../audit-log/audit-log.service';

export type StandardBonusSavePayload = Omit<
  StandardBonusDocument,
  'createdAt' | 'updatedAt'
>;

export interface StandardBonusListItem {
  yyyyMm: string;
  doc: StandardBonusDocument;
}

@Injectable({ providedIn: 'root' })
export class StandardBonusDataService {
  private readonly firestore = inject(Firestore);
  private readonly auditLog = inject(AuditLogService);

  private subcollection(tid: string, eid: string) {
    return collection(
      this.firestore,
      'tenants',
      tid,
      'employees',
      eid,
      'standardBonus',
    );
  }

  private docRef(tid: string, eid: string, yyyyMm: string) {
    return doc(this.subcollection(tid, eid), yyyyMm);
  }

  async get(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<StandardBonusDocument | null> {
    const snap = await getDoc(this.docRef(tid, eid, yyyyMm));
    if (!snap.exists()) return null;
    return snap.data() as StandardBonusDocument;
  }

  async listForEmployee(
    tid: string,
    eid: string,
  ): Promise<StandardBonusListItem[]> {
    const snap = await getDocs(this.subcollection(tid, eid));
    const items = snap.docs.map((d) => ({
      yyyyMm: d.id,
      doc: d.data() as StandardBonusDocument,
    }));
    return items.sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm));
  }

  async save(
    tid: string,
    eid: string,
    yyyyMm: string,
    payload: StandardBonusSavePayload,
  ): Promise<void> {
    const ref = this.docRef(tid, eid, yyyyMm);
    const existing = await getDoc(ref);
    await setDoc(
      ref,
      omitUndefinedFields({
        ...payload,
        createdAt: existing.exists()
          ? (existing.data() as StandardBonusDocument).createdAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      { merge: true },
    );

    await this.auditLog.record({
      tid,
      action: existing.exists() ? 'update' : 'create',
      category: 'standard_bonus',
      summary: existing.exists() ? '標準賞与額を更新' : '標準賞与額を作成',
      target: this.auditLog.employeeTarget(eid, '', undefined, yyyyMm),
      metadata: { source: payload.source },
    });
  }
}