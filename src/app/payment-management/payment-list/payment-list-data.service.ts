import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, getDoc, doc } from '@angular/fire/firestore';
import { EmployeeDocument } from '../../employee-document';
import { MonthlyDocument, PremiumData } from '../../monthly-document';
import { BonusDocument } from '../../bonus-document';
import { PaymentListRow } from './payment-list-columns';
import { StandardRemunerationDataService } from '../../social-insurance/monthly/standard-remuneration-data.service';
import { toPaymentListRow } from './payment-list-row.mapper';
import { TenantSettingDataService } from '../../tenant-setting/tenant-setting-data.service';
import { addMonths } from '../../social-insurance/monthly/social-insurance-data.util';
import { getTargetMonths } from '../../date-utils';
import { toFormDate } from '../../date-utils';
import {
  buildResignPremiumDisplayContext,
  resolvePaymentDisplayPremium,
  type ResignPremiumDisplayContext,
} from '../../../../shared/social-insurance/premium/payment-resign-premium-display';
import type {
  ResignPremiumCollectionType,
  SocialInsuranceCollectionMonth,
} from '../../../../shared/social-insurance/premium/resign-premium-collection';
import {
  getPaymentDisplayMonthForSalary,
  getPayrollPaymentMonthOffset,
  getSalaryMonthForPaymentDisplay,
  type PayrollPaymentMonth,
} from '../../../../shared/social-insurance/payroll/payroll-payment-timing';

export interface PaymentDetailRow extends PaymentListRow {
  yyyyMm: string;
}

export interface EmployeePaymentHistoryResult {
  rows: PaymentDetailRow[];
  displayName: string;
  employeeId: string;
}

export interface EmployeeLookupEntry {
  eid: string;
  employeeId: string;
  displayName: string;
  licenceStartAt: Date | null;
  licenseEndAt: Date | null;
  resignAt: Date | null;
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

  private get payrollPaymentMonth(): PayrollPaymentMonth {
    return this.tenantdata.form.socialInsuranceSettings.payrollPaymentMonth ?? 'currentMonth';
  }

  get payrollPaymentMonthOffset(): number {
    return getPayrollPaymentMonthOffset(this.payrollPaymentMonth);
  }

  private get socialInsuranceCollectionMonth(): SocialInsuranceCollectionMonth {
    return this.tenantdata.form.socialInsuranceSettings.socialInsuranceCollectionMonth ?? 'nextMonth';
  }

  private get resignPremiumCollection(): ResignPremiumCollectionType {
    return this.tenantdata.form.socialInsuranceSettings.resignPremiumCollection ?? 'monthly';
  }

  private buildResignContextForEmployee(
    employee: EmployeeLookupEntry | undefined,
  ): ResignPremiumDisplayContext | null {
    if (!employee) {
      return null;
    }
    return buildResignPremiumDisplayContext({
      licenceStartAt: employee.licenceStartAt,
      licenseEndAt: employee.licenseEndAt,
      resignAt: employee.resignAt,
      collectionMonth: this.socialInsuranceCollectionMonth,
      payrollPaymentMonth: this.payrollPaymentMonth,
      resignPremiumCollection: this.resignPremiumCollection,
    });
  }

  private async loadPremiumByMonthForBulk(
    tid: string,
    eid: string,
    bulkMonths: ReadonlySet<string>,
    seeded: ReadonlyMap<string, PremiumData | undefined>,
  ): Promise<Map<string, PremiumData | undefined>> {
    const premiumByMonth = new Map<string, PremiumData | undefined>();

    await Promise.all(
      [...bulkMonths].map(async (yyyyMm) => {
        if (seeded.has(yyyyMm)) {
          premiumByMonth.set(yyyyMm, seeded.get(yyyyMm));
          return;
        }
        const snap = await getDoc(
          doc(this.firestore, 'tenants', tid, 'monthly-records', yyyyMm, 'employees', eid),
        );
        premiumByMonth.set(
          yyyyMm,
          snap.exists() ? (snap.data() as Partial<MonthlyDocument>).premiumData : undefined,
        );
      }),
    );

    return premiumByMonth;
  }

  private async resolveMonthlyPremiumForPaymentDisplay(
    tid: string,
    displayYyyyMm: string,
    premiumMonth: string,
    eid: string,
    premiumFromFetchedMonth: PremiumData | undefined,
    resignContext: ResignPremiumDisplayContext | null,
  ): Promise<PremiumData | undefined> {
    if (!resignContext?.isBulk || displayYyyyMm !== resignContext.finalPayrollDisplayMonth) {
      return resolvePaymentDisplayPremium({
        displayYyyyMm,
        premiumMonthYyyyMm: premiumMonth,
        premiumFromFetchedMonth,
        premiumByMonth: new Map([[premiumMonth, premiumFromFetchedMonth]]),
        resignContext,
      });
    }

    const premiumByMonth = await this.loadPremiumByMonthForBulk(
      tid,
      eid,
      resignContext.bulkMonths,
      new Map([[premiumMonth, premiumFromFetchedMonth]]),
    );

    return resolvePaymentDisplayPremium({
      displayYyyyMm,
      premiumMonthYyyyMm: premiumMonth,
      premiumFromFetchedMonth,
      premiumByMonth,
      resignContext,
    });
  }

  /** 最終月次データ月の保険料が給与管理に表示される対象月 */
  private maxPremiumDisplayMonthForSalaryData(maxSalaryMonth: string): string {
    return addMonths(maxSalaryMonth, -this.collectionMonth);
  }

  private resolvePaymentHistoryDisplayMonthRange(
    minSalaryMonth: string,
    maxSalaryMonth: string,
    minBonusMonth: string | undefined,
    maxBonusMonth: string | undefined,
  ): { minDisplayMonth: string; maxDisplayMonth: string } {
    const minDisplayMonth = [
      getPaymentDisplayMonthForSalary(minSalaryMonth, this.payrollPaymentMonth),
      minBonusMonth,
    ]
      .filter((month): month is string => !!month)
      .sort()[0];

    const maxDisplayMonth = [
      getPaymentDisplayMonthForSalary(maxSalaryMonth, this.payrollPaymentMonth),
      this.maxPremiumDisplayMonthForSalaryData(maxSalaryMonth),
      maxBonusMonth ? addMonths(maxBonusMonth, -this.collectionMonth) : undefined,
    ]
      .filter((month): month is string => !!month)
      .sort()
      .at(-1)!;

    return { minDisplayMonth, maxDisplayMonth };
  }

  async loadEmployeeLookup(tid: string): Promise<Map<string, EmployeeLookupEntry>> {
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    const lookup = new Map<string, EmployeeLookupEntry>();

    for (const snap of employees.docs) {
      const data = snap.data() as Partial<EmployeeDocument>;
      const employ = data.employeeEmployInfo;
      lookup.set(snap.id, {
        eid: snap.id,
        employeeId: employ?.employeeId ?? '',
        displayName: data.employeePersonalInfo?.displayName ?? '',
        licenceStartAt: toFormDate(employ?.licenseStartAt),
        licenseEndAt: toFormDate(employ?.licenseEndAt),
        resignAt: toFormDate(employ?.resignAt),
      });
    }

    return lookup;
  }

  async loadAggregatedRows(
    tid: string,
    yyyyMm: string,
  ): Promise<PaymentListRow[]> {
    const salaryMonth = getSalaryMonthForPaymentDisplay(yyyyMm, this.payrollPaymentMonth);
    const premiumMonth = addMonths(yyyyMm, this.collectionMonth);
    const monthlySalaryRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      salaryMonth,
      'employees',
    );
    const monthlyPremiumRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      premiumMonth,
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
    const rows = await Promise.all(
      [...eids].map(async (eid) => {
        const monthlySalaryDoc = monthlySalaryByEid.get(eid) || {};
        const monthlyPremiumDoc = monthlyPremiumByEid.get(eid) || {};
        const employee = employeeLookup.get(eid);
        const resignContext = this.buildResignContextForEmployee(employee);
        const resolvedPremium = await this.resolveMonthlyPremiumForPaymentDisplay(
          tid,
          yyyyMm,
          premiumMonth,
          eid,
          monthlyPremiumDoc.premiumData,
          resignContext,
        );
        const mergedMonthlyDoc = {
          ...monthlySalaryDoc,
          calculationSnapshot: monthlyPremiumDoc.calculationSnapshot,
          premiumData: resolvedPremium,
        };
        const row = toPaymentListRow(
          eid,
          mergedMonthlyDoc,
          bonusByEid.get(eid),
        );
        return this.mergeEmployeeMeta(row, employeeLookup);
      }),
    );

    return this.enrichWithStandardRemuneration(tid, premiumMonth, rows);
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

  async loadEmployeePaymentHistory(
    tid: string,
    eid: string,
  ): Promise<EmployeePaymentHistoryResult> {
    const employeeLookup = await this.loadEmployeeLookup(tid);
    const empMeta = employeeLookup.get(eid);

    const [recordsSnap, bonusRecordsSnap] = await Promise.all([
      getDocs(collection(this.firestore, 'tenants', tid, 'monthly-records')),
      getDocs(collection(this.firestore, 'tenants', tid, 'bonus-records')),
    ]);

    const minSalaryMonth = recordsSnap.docs[0]?.id;
    const maxSalaryMonth = recordsSnap.docs[recordsSnap.docs.length - 1]?.id;
    const minBonusMonth = bonusRecordsSnap.docs[0]?.id;
    const maxBonusMonth = bonusRecordsSnap.docs[bonusRecordsSnap.docs.length - 1]?.id;

    if (!minSalaryMonth || !maxSalaryMonth) {
      return {
        rows: [],
        displayName: empMeta?.displayName || '',
        employeeId: empMeta?.employeeId || '',
      };
    }

    const { minDisplayMonth, maxDisplayMonth } = this.resolvePaymentHistoryDisplayMonthRange(
      minSalaryMonth,
      maxSalaryMonth,
      minBonusMonth,
      maxBonusMonth,
    );

    const resignContext = this.buildResignContextForEmployee(empMeta);
    const premiumByMonth = new Map<string, PremiumData | undefined>();
    await Promise.all(
      recordsSnap.docs.map(async (periodDoc) => {
        const snap = await getDoc(
          doc(this.firestore, 'tenants', tid, 'monthly-records', periodDoc.id, 'employees', eid),
        );
        if (!snap.exists()) {
          return;
        }
        const data = snap.data() as Partial<MonthlyDocument>;
        premiumByMonth.set(periodDoc.id, data.premiumData);
      }),
    );

    const targetMonths = getTargetMonths(minDisplayMonth, maxDisplayMonth);

    const detailRows = (
      await Promise.all(
        [...targetMonths].map(async (yyyyMm) => {
          const salaryMonth = getSalaryMonthForPaymentDisplay(yyyyMm, this.payrollPaymentMonth);
          const premiumMonth = addMonths(yyyyMm, this.collectionMonth);

          const [monthlySalarySnap, monthlyPremiumSnap, bonusSnap] = await Promise.all([
            getDoc(
              doc(this.firestore, 'tenants', tid, 'monthly-records', salaryMonth, 'employees', eid),
            ),
            getDoc(
              doc(this.firestore, 'tenants', tid, 'monthly-records', premiumMonth, 'employees', eid),
            ),
            getDoc(
              doc(this.firestore, 'tenants', tid, 'bonus-records', yyyyMm, 'employees', eid),
            ),
          ]);

          const hasSalary = monthlySalarySnap.exists();
          const hasPremium = monthlyPremiumSnap.exists();
          const hasBonus = bonusSnap.exists();
          if (!hasSalary && !hasPremium && !hasBonus) return null;

          const monthlySalaryDoc = hasSalary
            ? (monthlySalarySnap.data() as Partial<MonthlyDocument>)
            : {};
          const monthlyPremiumDoc = hasPremium
            ? (monthlyPremiumSnap.data() as Partial<MonthlyDocument>)
            : {};

          const resolvedPremium = resolvePaymentDisplayPremium({
            displayYyyyMm: yyyyMm,
            premiumMonthYyyyMm: premiumMonth,
            premiumFromFetchedMonth: monthlyPremiumDoc.premiumData,
            premiumByMonth,
            resignContext,
          });

          const mergedMonthlyDoc = {
            ...monthlySalaryDoc,
            calculationSnapshot: monthlyPremiumDoc.calculationSnapshot,
            premiumData: resolvedPremium,
          };
          const bonusDoc = hasBonus
            ? (bonusSnap.data() as Partial<BonusDocument>)
            : undefined;

          const baseRow = toPaymentListRow(eid, mergedMonthlyDoc, bonusDoc);
          const enrichedRow = this.mergeEmployeeMeta(baseRow, employeeLookup);
          return { ...enrichedRow, yyyyMm };
        }),
      )
    ).filter((row): row is PaymentDetailRow => row !== null);

    const finalRows = await Promise.all(
      detailRows.map(async (row) => {
        const premiumMonth = addMonths(row.yyyyMm, this.collectionMonth);
        const enriched = await this.enrichWithStandardRemuneration(tid, premiumMonth, [row]);
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
