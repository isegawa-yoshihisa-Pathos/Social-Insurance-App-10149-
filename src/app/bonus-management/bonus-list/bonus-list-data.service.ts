import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, writeBatch, doc, serverTimestamp } from '@angular/fire/firestore';
import { EmployeeDocument } from '../../employee-document';
import { BonusListRow } from './bonus-list-columns';

export interface EmployeeLookupEntry {
  eid: string;
  employeeId: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root',
})
export class BonusListDataService {
  private readonly firestore = inject(Firestore);

  async loadEmployeeLookup(tid: string): Promise<Map<string, EmployeeLookupEntry>> {
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    const lookup = new Map<string, EmployeeLookupEntry>();

    for (const snap of employees.docs) {
      const data = snap.data() as Partial<EmployeeDocument>;
      lookup.set(snap.id, {
        eid: snap.id,
        employeeId: data.employeeEmployInfo?.employeeId ?? '',
        displayName: data.employeePersonalInfo?.displayName ?? '',
      });
    }

    return lookup;
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

  async initializeBonusRecords(tid: string, yyyyMm: string): Promise<number> {
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const snapshot = await getDocs(employeesRef);
    const targets = snapshot.docs.filter((snap) => {
      const data = snap.data() as Partial<EmployeeDocument>;
      const status = data.employeeEmployInfo?.status;
      return status !== 'resigned';
    });
    if (targets.length === 0) return 0;
    const BATCH_SIZE = 500;
    let created = 0;
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const chunk = targets.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(this.firestore);
      for (const snap of chunk) {
        const data = snap.data() as Partial<EmployeeDocument>;
        const ref = doc(
          this.firestore,
          'tenants',
          tid,
          'bonus-records',
          yyyyMm,
          'employees',
          snap.id,
        );
        batch.set(ref, {
          uid: data.uid ?? '',
          displayName: data.employeePersonalInfo?.displayName ?? '',
          updatedAt: serverTimestamp(),
        });
        created++;
      }
      await batch.commit();
    }
    return created;
  }
}
