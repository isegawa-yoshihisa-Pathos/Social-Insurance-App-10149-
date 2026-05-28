import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { CurrentTenantService } from '../../current-tenant.service';
import { EmployeeDocument } from '../../employee-document';
import {
  MONTHLY_SEED_EIDS,
  MONTHLY_SEED_MONTHS,
  buildMonthlySeedPayload,
} from './monthly-records-seed.data';

@Injectable({
  providedIn: 'root',
})
export class MonthlyRecordsSeedService {
  private readonly firestore = inject(Firestore);
  private readonly currentTenantService = inject(CurrentTenantService);

  /**
   * ログイン済みユーザーの認証で Firestore に書き込む（gcloud 不要）。
   * @param tid 省略時は currentTid
   */
  async seedSampleMonthlyRecords(tid?: string): Promise<number> {
    const resolvedTid = tid ?? this.currentTenantService.currentTid();
    if (!resolvedTid) {
      throw new Error('テナントが選択されていません。');
    }

    const batch = writeBatch(this.firestore);
    let writeCount = 0;

    for (const yyyyMm of MONTHLY_SEED_MONTHS) {
      for (let i = 0; i < MONTHLY_SEED_EIDS.length; i++) {
        const eid = MONTHLY_SEED_EIDS[i];
        const { displayName, uid } = await this.resolveEmployeeMeta(resolvedTid, eid, i);
        const payload = buildMonthlySeedPayload(displayName, uid, i, yyyyMm);
        const ref = doc(
          this.firestore,
          'tenants',
          resolvedTid,
          'monthly-records',
          yyyyMm,
          'employees',
          eid,
        );
        batch.set(
          ref,
          {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        writeCount++;
      }
    }

    await batch.commit();
    return writeCount;
  }

  private async resolveEmployeeMeta(
    tid: string,
    eid: string,
    index: number,
  ): Promise<{ displayName: string; uid: string }> {
    const snap = await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid));
    if (!snap.exists()) {
      return { displayName: `サンプル社員${index + 1}`, uid: '' };
    }
    const data = snap.data() as Partial<EmployeeDocument>;
    return {
      displayName: data.employeePersonalInfo?.displayName ?? `サンプル社員${index + 1}`,
      uid: data.uid ?? '',
    };
  }
}
