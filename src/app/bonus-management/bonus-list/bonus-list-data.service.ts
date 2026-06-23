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
import { BonusDocument, BonusPeriodDocument } from '../../bonus-document';
import { BonusListRow } from './bonus-list-columns';
import { toBonusListRow } from './bonus-list-row.mapper';
import { BonusManagementDataService } from '../bonus-management-data.service';
import { StandardBonusDataService } from '../../social-insurance/bonus/standard-bonus-data.service';
import { addMonths } from '../../social-insurance/monthly/social-insurance-data.util';
import { AuditLogService } from '../../audit-log/audit-log.service';

/** 前月データ探索の上限（報酬追加と同じ） */
const PRIOR_RECORD_LOOKBACK_LIMIT = 24;

export interface BonusDetailRow extends BonusListRow {
  yyyyMm: string;
}

export interface EmployeeBonusHistoryResult {
  rows: BonusDetailRow[];
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
export class BonusListDataService {
  private readonly firestore = inject(Firestore);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly standardBonusDataService = inject(StandardBonusDataService);
  private readonly auditLog = inject(AuditLogService);

  periodRef(tid: string, yyyyMm: string) {
    return doc(this.firestore, 'tenants', tid, 'bonus-records', yyyyMm);
  }

  async getPeriod(tid: string, yyyyMm: string): Promise<BonusPeriodDocument | null> {
    const snap = await getDoc(this.periodRef(tid, yyyyMm));
    if (!snap.exists()) return null;
    return snap.data() as BonusPeriodDocument;
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
      category: 'bonus.lock',
      summary: '賞与を締切',
      target: this.auditLog.bonusTarget(yyyyMm),
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

  async enrichWithStandardBonus(
    tid: string,
    yyyyMm: string,
    rows: BonusListRow[],
  ): Promise<BonusListRow[]> {
    return Promise.all(
      rows.map(async (row) => {
        const doc = await this.standardBonusDataService.get(tid, row.eid, yyyyMm);
        if (doc?.source === 'manual') {
          return {
            ...row,
            standardBonusHealth: doc.standardBonus.health,
            standardBonusPension: doc.standardBonus.pension,
          };
        }
        if (row.standardBonusHealth != null && row.standardBonusPension != null) {
          return row;
        }
        if (!doc) return row;

        return {
          ...row,
          standardBonusHealth: row.standardBonusHealth ?? doc.standardBonus.health,
          standardBonusPension: row.standardBonusPension ?? doc.standardBonus.pension,
        };
      }),
    );
  }

  async loadEmployeeBonusHistory(
    tid: string,
    eid: string,
  ): Promise<EmployeeBonusHistoryResult> {
    await this.bonusManagementDataService.loadBonusSettings(tid);
    const bonusTypeDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();

    const employeeLookup = await this.loadEmployeeLookup(tid);
    const empMeta = employeeLookup.get(eid);

    const recordsRef = collection(this.firestore, 'tenants', tid, 'bonus-records');
    const recordsSnap = await getDocs(recordsRef);

    const detailRows = (
      await Promise.all(
        recordsSnap.docs.map(async (periodDoc) => {
          const yyyyMm = periodDoc.id;
          const empSnap = await getDoc(
            doc(this.firestore, 'tenants', tid, 'bonus-records', yyyyMm, 'employees', eid),
          );
          if (!empSnap.exists()) return null;

          const baseRow = toBonusListRow(
            eid,
            empSnap.data() as Partial<BonusDocument>,
            bonusTypeDefinitions,
          );
          const enrichedRow = this.mergeEmployeeMeta(baseRow, employeeLookup);
          return { ...enrichedRow, yyyyMm };
        }),
      )
    ).filter((row): row is BonusDetailRow => row !== null);

    detailRows.sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm));

    return {
      rows: detailRows,
      displayName: empMeta?.displayName || detailRows[0]?.displayName || '',
      employeeId: empMeta?.employeeId || detailRows[0]?.employeeId || '',
    };
  }

  mergeEmployeeMeta(
    row: BonusListRow,
    lookup: Map<string, EmployeeLookupEntry>,
  ): BonusListRow {
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

  async addEmployeesWithEmptyData(
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
        'bonus-records',
        yyyyMm,
        'employees',
        eid,
      );
      const existing = await getDoc(employeeRef);
      if (existing.exists()) {
        continue;
      }

      const priorBonus = await this.findPreviousBonusDocument(tid, eid, yyyyMm);

      batch.set(
        employeeRef,
        priorBonus
          ? this.buildBonusFromPrevious(employee, priorBonus)
          : this.buildEmptyBonusDocument(employee),
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
      category: 'bonus.add_employees',
      summary: '賞与データに従業員を追加',
      target: this.auditLog.bonusTarget(yyyyMm),
      metadata: { created, eids: eids.slice(0, created) },
    });

    return created;
  }

  /** 対象月より前で、bonusData がある最も新しい賞与報酬を返す */
  private async findPreviousBonusDocument(
    tid: string,
    eid: string,
    beforeYyyyMm: string,
  ): Promise<BonusDocument | null> {
    let ym = addMonths(beforeYyyyMm, -1);
    for (let i = 0; i < PRIOR_RECORD_LOOKBACK_LIMIT; i++) {
      const snap = await getDoc(
        doc(this.firestore, 'tenants', tid, 'bonus-records', ym, 'employees', eid),
      );
      if (snap.exists()) {
        const data = snap.data() as BonusDocument;
        if (data.bonusData) {
          return data;
        }
      }
      ym = addMonths(ym, -1);
    }
    return null;
  }

  private buildBonusFromPrevious(
    employee: EmployeeLookupEntry,
    previous: BonusDocument,
  ): {
    uid: string;
    displayName: string;
    bonusData?: BonusDocument['bonusData'];
    updatedAt: ReturnType<typeof serverTimestamp>;
  } {
    const doc: {
      uid: string;
      displayName: string;
      bonusData?: BonusDocument['bonusData'];
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: employee.uid,
      displayName: employee.displayName,
      updatedAt: serverTimestamp(),
    };
    if (previous.bonusData) {
      doc.bonusData = { ...previous.bonusData };
    }
    return doc;
  }

  private buildEmptyBonusDocument(employee: EmployeeLookupEntry): {
    uid: string;
    displayName: string;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } {
    return {
      uid: employee.uid,
      displayName: employee.displayName,
      updatedAt: serverTimestamp(),
    };
  }
}
