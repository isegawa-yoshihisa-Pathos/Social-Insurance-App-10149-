import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { EmployeeDocument } from '../../employee-document';
import { MonthlyDocument } from '../../monthly-document';
import { BonusDocument } from '../../bonus-document';
import { PaymentListRow } from './payment-list-columns';
import { StandardRemunerationDataService } from '../../social-insurance/monthly/standard-remuneration-data.service';
import { toPaymentListRow } from './payment-list-row.mapper';
import { BonusTypeDefinition } from '../../bonus-document';
import { TenantSettingDataService } from '../../tenant-setting/tenant-setting-data.service';
import { addMonths } from '../../social-insurance/monthly/social-insurance-data.util';

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
  private readonly tenantdata = inject(TenantSettingDataService);

  get collectionMonth(): number {
    switch (this.tenantdata.form.socialInsuranceSettings.socialInsuranceCollectionMonth) {
      case 'nextMonth':
        return -1;
      case 'currentMonth':
        return 0;
      case 'nextNextMonth':
        return -2;
      default:
        return -1;
    }
  }

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
    const collectionMonth = addMonths(yyyyMm, this.collectionMonth);
    const monthlySalaryRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      yyyyMm,
      'employees',
    );
    const monthlyPremiumRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      collectionMonth,
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

    const [monthlySalarySnap, monthlyPremiumSnap, bonusSnap, employeeLookup] = await Promise.all([
      getDocs(monthlySalaryRef),
      getDocs(monthlyPremiumRef),
      getDocs(bonusRef),
      this.loadEmployeeLookup(tid),
    ]);

    const monthlySalaryByEid = new Map(
      monthlySalarySnap.docs.map((snap) => [snap.id, snap.data() as Partial<MonthlyDocument>]),
    );
    const monthlyPremiumByEid = new Map(
      monthlyPremiumSnap.docs.map((snap) => [snap.id, snap.data() as Partial<MonthlyDocument>]),
    );
    const bonusByEid = new Map(
      bonusSnap.docs.map((snap) => [snap.id, snap.data() as Partial<BonusDocument>]),
    );

    const eids = new Set([...monthlySalaryByEid.keys(), ...monthlyPremiumByEid.keys(), ...bonusByEid.keys()]);
    const rows = [...eids].map((eid) => {
      const monthlySalaryDoc = monthlySalaryByEid.get(eid) || {};
      const monthlyPremiumDoc = monthlyPremiumByEid.get(eid) || {};
      const mergedMonthlyDoc = {
        ...monthlySalaryDoc,
        calculationSnapshot: monthlyPremiumDoc.calculationSnapshot,
        premiumData: monthlyPremiumDoc.premiumData,
      };
      const row = toPaymentListRow(
        eid,
        mergedMonthlyDoc,
        bonusByEid.get(eid),
        bonusTypeDefinitions,
      );
      return this.mergeEmployeeMeta(row, employeeLookup);
    });

    return this.enrichWithStandardRemuneration(tid, collectionMonth, rows);
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
