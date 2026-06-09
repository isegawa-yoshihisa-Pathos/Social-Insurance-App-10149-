import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  WriteBatch,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { EmployeeDocument } from '../../employee-document';
import { MonthlyDocument, MonthlyPeriodDocument } from '../../monthly-document';
import { MonthlyListRow } from './monthly-list-columns';
import { toMonthlyListRow } from './monthly-list-row.mapper';
import { StandardRemunerationDataService } from '../../social-insurance/monthly/standard-remuneration-data.service';

export interface MonthlyDetailRow extends MonthlyListRow {
  yyyyMm: string;
}

export interface EmployeeMonthlyHistoryResult {
  rows: MonthlyDetailRow[];
  displayName: string;
  employeeId: string;
}

export interface EmployeeLookupEntry {
  uid: string;
  eid: string;
  employeeId: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root',
})
export class MonthlyListDataService {
  private readonly firestore = inject(Firestore);
  private readonly standardRemunerationDataService = inject(StandardRemunerationDataService);

  periodRef(tid: string, yyyyMm: string) {
    return doc(this.firestore, 'tenants', tid, 'monthly-records', yyyyMm);
  }

  async getPeriod(tid: string, yyyyMm: string): Promise<MonthlyPeriodDocument | null> {
    const snap = await getDoc(this.periodRef(tid, yyyyMm));
    if (!snap.exists()) return null;
    return snap.data() as MonthlyPeriodDocument;
  }

  async isPeriodLocked(tid: string, yyyyMm: string): Promise<boolean> {
    const period = await this.getPeriod(tid, yyyyMm);
    return period?.locked === true;
  }

  async lockPeriod(tid: string, yyyyMm: string): Promise<void> {
    await setDoc(
      this.periodRef(tid, yyyyMm),
      {
        yyyyMm,
        locked: true,
        lockedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  /** 期間ドキュメントが無い場合のみ作成する（既存の locked は変更しない） */
  async ensurePeriodDocument(tid: string, yyyyMm: string): Promise<void> {
    const existing = await this.getPeriod(tid, yyyyMm);
    if (existing) return;
    await setDoc(this.periodRef(tid, yyyyMm), {
      yyyyMm,
      locked: false,
      updatedAt: serverTimestamp(),
    });
  }

  touchPeriodInBatch(batch: WriteBatch, tid: string, yyyyMm: string): void {
    batch.set(
      this.periodRef(tid, yyyyMm),
      {
        yyyyMm,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async loadEmployeeLookup(tid: string): Promise<Map<string, EmployeeLookupEntry>> {
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    const lookup = new Map<string, EmployeeLookupEntry>();

    for (const snap of employees.docs) {
      const data = snap.data() as Partial<EmployeeDocument>;
      lookup.set(snap.id, {
        uid: data.uid ?? '',
        eid: snap.id,
        employeeId: data.employeeEmployInfo?.employeeId ?? '',
        displayName: data.employeePersonalInfo?.displayName ?? '',
      });
    }

    return lookup;
  }

  async enrichWithStandardRemuneration(
    tid: string,
    yyyyMm: string,
    rows: MonthlyListRow[],
  ): Promise<MonthlyListRow[]> {
    return Promise.all(
      rows.map(async (row) => {
        if (
          row.standardRemunerationHealth != null &&
          row.standardRemunerationPension != null
        ) {
          return row;
        }

        const doc = await this.standardRemunerationDataService.get(tid, row.eid, yyyyMm);
        if (!doc) return row;

        return {
          ...row,
          standardRemunerationHealth:
            row.standardRemunerationHealth ?? doc.standardRemuneration.health,
          standardRemunerationPension:
            row.standardRemunerationPension ?? doc.standardRemuneration.pension,
        };
      }),
    );
  }

  async loadEmployeeMonthlyHistory(
    tid: string,
    eid: string,
  ): Promise<EmployeeMonthlyHistoryResult> {
    const employeeLookup = await this.loadEmployeeLookup(tid);
    const empMeta = employeeLookup.get(eid);

    const recordsRef = collection(this.firestore, 'tenants', tid, 'monthly-records');
    const recordsSnap = await getDocs(recordsRef);

    const detailRows = (
      await Promise.all(
        recordsSnap.docs.map(async (periodDoc) => {
          const yyyyMm = periodDoc.id;
          const empSnap = await getDoc(
            doc(this.firestore, 'tenants', tid, 'monthly-records', yyyyMm, 'employees', eid),
          );
          if (!empSnap.exists()) return null;

          const baseRow = toMonthlyListRow(eid, empSnap.data() as Partial<MonthlyDocument>);
          const enrichedRow = this.mergeEmployeeMeta(baseRow, employeeLookup);
          return { ...enrichedRow, yyyyMm };
        }),
      )
    ).filter((row): row is MonthlyDetailRow => row !== null);

    const finalRows = await Promise.all(
      detailRows.map(async (row) => {
        const enriched = await this.enrichWithStandardRemuneration(tid, row.yyyyMm, [row]);
        return { ...enriched[0], yyyyMm: row.yyyyMm };
      }),
    );

    finalRows.sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm));

    return {
      rows: finalRows,
      displayName: empMeta?.displayName || finalRows[0]?.displayName || '',
      employeeId: empMeta?.employeeId || finalRows[0]?.employeeId || '',
    };
  }

  mergeEmployeeMeta(
    row: MonthlyListRow,
    lookup: Map<string, EmployeeLookupEntry>,
  ): MonthlyListRow {
    const employee = lookup.get(row.eid);
    if (!employee) return row;

    return {
      ...row,
      employeeId: employee.employeeId,
      displayName: employee.displayName || row.displayName,
    };
  }

  buildMatchMaps(lookup: Map<string, EmployeeLookupEntry>): {
    eidByEmployeeId: Map<string, string>;
    eidsByDisplayName: Map<string, string[]>;
  } {
    const eidByEmployeeId = new Map<string, string>();
    const eidsByDisplayName = new Map<string, string[]>();

    for (const entry of lookup.values()) {
      const empId = entry.employeeId.trim().toLowerCase();
      if (empId) eidByEmployeeId.set(empId, entry.eid);

      const name = entry.displayName.trim().toLowerCase();
      if (name) {
        const arr = eidsByDisplayName.get(name) ?? [];
        arr.push(entry.eid);
        eidsByDisplayName.set(name, arr);
      }
    }

    return { eidByEmployeeId, eidsByDisplayName };
  }
}
