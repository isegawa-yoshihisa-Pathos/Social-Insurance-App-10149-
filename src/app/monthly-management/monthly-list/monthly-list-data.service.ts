import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, writeBatch, doc, serverTimestamp } from '@angular/fire/firestore';
import { EmployeeDocument } from '../../employee-document';
import { PayrollData } from '../../monthly-document';
import { MonthlyListRow } from './monthly-list-columns';

export interface EmployeeLookupEntry {
  eid: string;
  employeeId: string;
  displayName: string;
}

const EMPTY_PAYROLL_DATA: PayrollData = {
  totalPay: 0,
  basicSalary: 0,
  overtimePay: 0,
  commuterAllowance: 0,
  otherAllowance: 0,
  retroactivePay: 0,
};

@Injectable({
  providedIn: 'root',
})
export class MonthlyListDataService {
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

  async initializeMonthlyRecords(tid: string, yyyyMm: string): Promise<number> {
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
          'monthly-records',
          yyyyMm,
          'employees',
          snap.id,
        );
        batch.set(ref, {
          uid: data.uid ?? '',
          displayName: data.employeePersonalInfo?.displayName ?? '',
          payrollData: EMPTY_PAYROLL_DATA,
          updatedAt: serverTimestamp(),
        });
        created++;
      }
      await batch.commit();
    }
    return created;
  }
}
