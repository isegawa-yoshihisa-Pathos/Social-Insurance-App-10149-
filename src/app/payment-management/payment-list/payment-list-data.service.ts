import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { EmployeeDocument } from '../../employee-document';
import { MonthlyDocument } from '../../monthly-document';
import { BonusDocument } from '../../bonus-document';
import { PaymentListRow } from './payment-list-columns';
import { StandardRemunerationDataService } from '../../social-insurance/monthly/standard-remuneration-data.service';
import { toPaymentListRow } from './payment-list-row.mapper';
import { BonusTypeDefinition } from '../../bonus-document';

export interface EmployeeLookupEntry {
  eid: string;
  employeeId: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentListDataService {
  private readonly firestore = inject(Firestore);
  private readonly standardRemunerationDataService = inject(StandardRemunerationDataService);

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

  async loadAggregatedRows(
    tid: string,
    yyyyMm: string,
    bonusTypeDefinitions: BonusTypeDefinition[],
  ): Promise<PaymentListRow[]> {
    const monthlyRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      yyyyMm,
      'employees',
    );
    const bonusRef = collection(
      this.firestore,
      'tenants',
      tid,
      'bonus-records',
      yyyyMm,
      'employees',
    );

    const [monthlySnap, bonusSnap, employeeLookup] = await Promise.all([
      getDocs(monthlyRef),
      getDocs(bonusRef),
      this.loadEmployeeLookup(tid),
    ]);

    const monthlyByEid = new Map(
      monthlySnap.docs.map((snap) => [snap.id, snap.data() as Partial<MonthlyDocument>]),
    );
    const bonusByEid = new Map(
      bonusSnap.docs.map((snap) => [snap.id, snap.data() as Partial<BonusDocument>]),
    );

    const eids = new Set([...monthlyByEid.keys(), ...bonusByEid.keys()]);
    const rows = [...eids].map((eid) => {
      const row = toPaymentListRow(
        eid,
        monthlyByEid.get(eid),
        bonusByEid.get(eid),
        bonusTypeDefinitions,
      );
      return this.mergeEmployeeMeta(row, employeeLookup);
    });

    return this.enrichWithStandardRemuneration(tid, yyyyMm, rows);
  }

  async enrichWithStandardRemuneration(
    tid: string,
    yyyyMm: string,
    rows: PaymentListRow[],
  ): Promise<PaymentListRow[]> {
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

  mergeEmployeeMeta(
    row: PaymentListRow,
    lookup: Map<string, EmployeeLookupEntry>,
  ): PaymentListRow {
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
