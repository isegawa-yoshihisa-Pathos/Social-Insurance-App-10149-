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
  writeBatch,
} from '@angular/fire/firestore';
import { EmployeeDocument } from '../../employee-document';
import { MonthlyDocument, MonthlyPeriodDocument, PayrollData } from '../../monthly-document';
import { MonthlyListRow } from './monthly-list-columns';
import { toMonthlyListRow } from './monthly-list-row.mapper';
import { StandardRemunerationDataService } from '../../social-insurance/monthly/standard-remuneration-data.service';
import { addMonths } from '../../social-insurance/monthly/social-insurance-data.util';
import { AuditLogService } from '../../audit-log/audit-log.service';

/** 前月データ探索の上限（functions の getPreviousMonthlyDocument と同じ） */
const PRIOR_RECORD_LOOKBACK_LIMIT = 24;

export interface MonthlyDetailRow extends MonthlyListRow {  yyyyMm: string;
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
  private readonly auditLog = inject(AuditLogService);

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

    await this.auditLog.recordUpdate({
      tid,
      category: 'monthly.lock',
      summary: '報酬を締切',
      target: this.auditLog.monthlyTarget(yyyyMm),
      after: { locked: true, yyyyMm },
    });
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

  async loadPreviousBonusRelatedRemunerationMap(
    tid: string,
    yyyyMm: string,
  ): Promise<Map<string, number>> {
    const previousYyyyMm = addMonths(yyyyMm, -1);
    const previousRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      previousYyyyMm,
      'employees',
    );
    const snap = await getDocs(previousRef);
    const map = new Map<string, number>();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Partial<MonthlyDocument>;
      map.set(docSnap.id, data.bonusRelatedRemuneration ?? 0);
    }
    return map;
  }

  async enrichWithStandardRemuneration(
    tid: string,
    yyyyMm: string,
    rows: MonthlyListRow[],
  ): Promise<MonthlyListRow[]> {
    return Promise.all(
      rows.map(async (row) => {
        const doc = await this.standardRemunerationDataService.get(tid, row.eid, yyyyMm);
        if (doc?.source === 'manual') {
          return {
            ...row,
            standardRemunerationHealth: doc.standardRemuneration.health,
            standardRemunerationPension: doc.standardRemuneration.pension,
          };
        }
        if (
          row.standardRemunerationHealth != null &&
          row.standardRemunerationPension != null
        ) {
          return row;
        }
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

  async addEmployeesFromPreviousMonth(
    tid: string,
    yyyyMm: string,
    eids: readonly string[],
  ): Promise<number> {
    if (eids.length === 0) {
      return 0;
    }

    const lookup = await this.loadEmployeeLookup(tid);
    const batch = writeBatch(this.firestore);
    let created = 0;

    for (const eid of eids) {
      const employee = lookup.get(eid);
      if (!employee) {
        continue;
      }

      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        yyyyMm,
        'employees',
        eid,
      );
      const existing = await getDoc(employeeRef);
      if (existing.exists()) {
        continue;
      }

      const priorMonthly = await this.findPreviousMonthlyDocument(tid, eid, yyyyMm);

      batch.set(
        employeeRef,
        priorMonthly
          ? this.buildMonthlyFromPrevious(employee, priorMonthly)
          : this.buildEmptyMonthlyDocument(employee),
      );
      created++;
    }

    if (created === 0) {
      return 0;
    }

    this.touchPeriodInBatch(batch, tid, yyyyMm);
    await batch.commit();

    await this.auditLog.recordCreate({
      tid,
      category: 'monthly.add_employees',
      summary: '報酬データに従業員を追加',
      target: this.auditLog.monthlyTarget(yyyyMm),
      metadata: { created, eids: eids.slice(0, created) },
    });

    return created;
  }

  /** 対象月より前で、payrollData がある最も新しい報酬を返す */
  private async findPreviousMonthlyDocument(
    tid: string,
    eid: string,
    beforeYyyyMm: string,
  ): Promise<MonthlyDocument | null> {
    let ym = addMonths(beforeYyyyMm, -1);
    for (let i = 0; i < PRIOR_RECORD_LOOKBACK_LIMIT; i++) {
      const snap = await getDoc(
        doc(this.firestore, 'tenants', tid, 'monthly-records', ym, 'employees', eid),
      );
      if (snap.exists()) {
        const data = snap.data() as MonthlyDocument;
        if (data.payrollData) {
          return data;
        }
      }
      ym = addMonths(ym, -1);
    }
    return null;
  }

  private buildMonthlyFromPrevious(    employee: EmployeeLookupEntry,
    previous: MonthlyDocument,
  ): {
    uid: string;
    displayName: string;
    paymentBaseDays: number;
    bonusRelatedRemuneration: number;
    payrollData: PayrollData;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } {
    const payroll = previous.payrollData;
    return {
      uid: employee.uid,
      displayName: employee.displayName,
      paymentBaseDays: previous.paymentBaseDays ?? 0,
      bonusRelatedRemuneration: previous.bonusRelatedRemuneration ?? 0,
      payrollData: {
        basicSalary: payroll?.basicSalary ?? 0,
        fringeBenefits: payroll?.fringeBenefits ?? 0,
        fixedWage: payroll?.fixedWage ?? null,
        variableWage: payroll?.variableWage ?? null,
        allowances: { ...(payroll?.allowances ?? {}) },
        retroactivePay: payroll?.retroactivePay ?? null,
      },
      updatedAt: serverTimestamp(),
    };
  }

  private buildEmptyMonthlyDocument(employee: EmployeeLookupEntry): {
    uid: string;
    displayName: string;
    paymentBaseDays: number;
    bonusRelatedRemuneration: number;
    payrollData: PayrollData;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } {
    return {
      uid: employee.uid,
      displayName: employee.displayName,
      paymentBaseDays: 0,
      bonusRelatedRemuneration: 0,
      payrollData: {
        basicSalary: 0,
        fringeBenefits: 0,
        fixedWage: null,
        variableWage: null,
        allowances: {},
        retroactivePay: null,
      },
      updatedAt: serverTimestamp(),
    };
  }
}
