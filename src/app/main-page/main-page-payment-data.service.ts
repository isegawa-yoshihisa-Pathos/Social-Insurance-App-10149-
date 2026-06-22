import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
} from '@angular/fire/firestore';
import { BonusDocument } from '../bonus-document';
import { EmployeeDocument } from '../employee-document';
import { MonthlyDocument, PremiumData } from '../monthly-document';
import type { PaymentStatementDeliveryDocument } from '../../../shared/payment-statement-delivery-document';
import { BonusListRowForEmployee } from '../bonus-management/bonus-list/bonus-list-columns';
import { toBonusListRow } from '../bonus-management/bonus-list/bonus-list-row.mapper';
import { MonthlyListRowForEmployee } from '../monthly-management/monthly-list/monthly-list-columns';
import {
  toBonusListRowForEmployee,
  toMonthlyListRowForEmployeeFromPaymentRow,
} from './main-page-payment-row.mapper';
import { BonusManagementDataService } from '../bonus-management/bonus-management-data.service';
import { TenantSettingDataService } from '../tenant-setting/tenant-setting-data.service';
import { addMonths } from '../social-insurance/monthly/social-insurance-data.util';
import {
  buildMonthlyPremiumChangeReasons,
  buildBonusPremiumChangeReasons,
} from '../../../shared/social-insurance/premium/premium-change-reason';
import { employeeLeaveRecordsToPeriodInputs } from '../../../shared/social-insurance/premium/leave-premium-exemption';
import { resolvePaymentDisplaySourceMonths } from '../../../shared/social-insurance/payment/main-page-payment-display';
import {
  buildResignPremiumDisplayContext,
  resolvePaymentDisplayPremium,
} from '../../../shared/social-insurance/premium/payment-resign-premium-display';
import { toFormDate } from '../date-utils';
import { toPaymentListRow } from '../payment-management/payment-list/payment-list-row.mapper';
import {
  paymentListBonusNetPayment,
  paymentListMonthlyNetPayment,
} from '../payment-management/payment-list/payment-list-summary.util';

export type MainPagePaymentScope = 'monthly' | 'bonus';

export interface MainPagePaymentRowResult {
  row: MonthlyListRowForEmployee | BonusListRowForEmployee | null;
  changeReasons: string[];
}

export interface MainPagePaymentSummaryAmounts {
  monthly: number;
  bonus: number;
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class MainPagePaymentDataService {
  private readonly firestore = inject(Firestore);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly tenantSettingDataService = inject(TenantSettingDataService);

  async loadMonthlyDisplayMonths(tid: string, eid: string): Promise<string[]> {
    return this.loadDeliveredDisplayMonths(tid, eid, 'monthly');
  }

  async loadBonusDisplayMonths(tid: string, eid: string): Promise<string[]> {
    return this.loadDeliveredDisplayMonths(tid, eid, 'bonus');
  }

  async loadPaymentSummaryDisplayMonths(tid: string, eid: string): Promise<string[]> {
    return this.loadDeliveredDisplayMonths(tid, eid, 'all');
  }

  async loadMonthlyRow(
    tid: string,
    eid: string,
    displayYyyyMm: string,
    meta: { employeeId: string; displayName: string; birthDate?: Date | null },
  ): Promise<MainPagePaymentRowResult> {
    if (!(await this.isDisplayMonthDelivered(tid, eid, displayYyyyMm, 'monthly'))) {
      return { row: null, changeReasons: [] };
    }

    await this.ensureTenantSettings();
    const employee = await this.loadEmployee(tid, eid);
    const resignContext = this.buildResignContext(employee);
    const { salaryMonth, premiumMonth } = resolvePaymentDisplaySourceMonths(
      displayYyyyMm,
      this.payrollPaymentMonth,
      this.socialInsuranceCollectionMonth,
    );

    const [salarySnap, premiumSnap] = await Promise.all([
      getDoc(doc(this.firestore, 'tenants', tid, 'monthly-records', salaryMonth, 'employees', eid)),
      getDoc(doc(this.firestore, 'tenants', tid, 'monthly-records', premiumMonth, 'employees', eid)),
    ]);

    const salaryDoc = salarySnap.exists() ? (salarySnap.data() as Partial<MonthlyDocument>) : {};
    const premiumDoc = premiumSnap.exists() ? (premiumSnap.data() as Partial<MonthlyDocument>) : {};

    const premiumByMonth = await this.loadPremiumByMonthForResign(
      tid,
      eid,
      resignContext,
      premiumMonth,
      premiumDoc.premiumData,
    );

    const resolvedPremium = resolvePaymentDisplayPremium({
      displayYyyyMm,
      premiumMonthYyyyMm: premiumMonth,
      premiumFromFetchedMonth: premiumDoc.premiumData,
      premiumByMonth,
      resignContext,
    });

    const paymentRow = toPaymentListRow(
      eid,
      {
        ...salaryDoc,
        premiumData: resolvedPremium,
        calculationSnapshot: premiumDoc.calculationSnapshot,
      },
      undefined,
    );
    const row = toMonthlyListRowForEmployeeFromPaymentRow(paymentRow);

    const changeReasons = await this.buildMonthlyChangeReasons(
      tid,
      eid,
      displayYyyyMm,
      employee,
      meta.birthDate ?? null,
      premiumMonth,
      premiumDoc,
      resolvedPremium,
      resignContext,
      premiumByMonth,
    );

    return { row, changeReasons };
  }

  async loadBonusRow(
    tid: string,
    eid: string,
    displayYyyyMm: string,
    meta: { employeeId: string; displayName: string; birthDate?: Date | null },
  ): Promise<MainPagePaymentRowResult> {
    if (!(await this.isDisplayMonthDelivered(tid, eid, displayYyyyMm, 'bonus'))) {
      return { row: null, changeReasons: [] };
    }

    await this.ensureTenantSettings();
    await this.bonusManagementDataService.loadBonusSettings(tid);
    const bonusTypeDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();

    const snap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'bonus-records', displayYyyyMm, 'employees', eid),
    );
    if (!snap.exists()) {
      return { row: null, changeReasons: [] };
    }

    const data = snap.data() as Partial<BonusDocument>;
    const paymentRow = toPaymentListRow(eid, undefined, data);
    const adminRow = toBonusListRow(eid, data, bonusTypeDefinitions);
    const row: BonusListRowForEmployee = {
      ...toBonusListRowForEmployee(adminRow),
      totalPayment: paymentListBonusNetPayment(paymentRow),
    };

    const previousYyyyMm = addMonths(displayYyyyMm, -1);
    const previousSnap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'bonus-records', previousYyyyMm, 'employees', eid),
    );
    const previousData = previousSnap.exists()
      ? (previousSnap.data() as Partial<BonusDocument>)
      : undefined;

    const changeReasons = buildBonusPremiumChangeReasons({
      yyyyMm: displayYyyyMm,
      birthDate: meta.birthDate ?? null,
      current: data.calculationSnapshot,
      previous: previousData?.calculationSnapshot,
      currentPremium: data.premiumData,
      previousPremium: previousData?.premiumData,
    });

    return { row, changeReasons };
  }

  async loadPaymentSummaryAmounts(
    tid: string,
    eid: string,
    displayYyyyMm: string,
    meta: { birthDate?: Date | null } = {},
  ): Promise<MainPagePaymentSummaryAmounts> {
    const rowMeta = { employeeId: '', displayName: '', birthDate: meta.birthDate ?? null };
    const [monthlyResult, bonusResult] = await Promise.all([
      this.loadMonthlyRow(tid, eid, displayYyyyMm, rowMeta),
      this.loadBonusRow(tid, eid, displayYyyyMm, rowMeta),
    ]);

    const monthly = monthlyResult.row?.totalPayment ?? 0;
    const bonus = bonusResult.row?.totalPayment ?? 0;
    return { monthly, bonus, total: monthly + bonus };
  }

  async loadDeliveryStatus(
    tid: string,
    displayYyyyMm: string,
  ): Promise<{ deliveredCount: number; lastDeliveredAt: Date | null } | null> {
    const snap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'paymentStatementDeliveryStatus', displayYyyyMm),
    );
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      deliveredCount: (data?.['deliveredCount'] as number) ?? 0,
      lastDeliveredAt: data?.['lastDeliveredAt']?.toDate?.() ?? null,
    };
  }

  private async loadDeliveredDisplayMonths(
    tid: string,
    eid: string,
    scope: 'monthly' | 'bonus' | 'all',
  ): Promise<string[]> {
    const snap = await getDocs(
      collection(this.firestore, 'tenants', tid, 'employees', eid, 'paymentStatementDeliveries'),
    );

    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as PaymentStatementDeliveryDocument) }))
      .filter((delivery) => {
        if (scope === 'monthly') return delivery.hasMonthly;
        if (scope === 'bonus') return delivery.hasBonus;
        return delivery.hasMonthly || delivery.hasBonus;
      })
      .map((delivery) => delivery.displayYyyyMm ?? delivery.id)
      .sort((a, b) => b.localeCompare(a));
  }

  private async isDisplayMonthDelivered(
    tid: string,
    eid: string,
    displayYyyyMm: string,
    scope: 'monthly' | 'bonus',
  ): Promise<boolean> {
    const snap = await getDoc(
      doc(
        this.firestore,
        'tenants',
        tid,
        'employees',
        eid,
        'paymentStatementDeliveries',
        displayYyyyMm,
      ),
    );
    if (!snap.exists()) {
      return false;
    }
    const data = snap.data() as PaymentStatementDeliveryDocument;
    return scope === 'monthly' ? !!data.hasMonthly : !!data.hasBonus;
  }

  private async loadPremiumByMonthForResign(
    tid: string,
    eid: string,
    resignContext: ReturnType<typeof this.buildResignContext>,
    premiumMonth: string,
    premiumFromFetchedMonth: PremiumData | undefined,
  ): Promise<Map<string, PremiumData | undefined>> {
    const premiumByMonth = new Map<string, PremiumData | undefined>([
      [premiumMonth, premiumFromFetchedMonth],
    ]);

    if (!resignContext?.isBulk) {
      return premiumByMonth;
    }

    await Promise.all(
      [...resignContext.bulkMonths].map(async (yyyyMm) => {
        if (premiumByMonth.has(yyyyMm)) {
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

  private async buildMonthlyChangeReasons(
    tid: string,
    eid: string,
    displayYyyyMm: string,
    employee: Partial<EmployeeDocument>,
    birthDate: Date | null,
    premiumMonth: string,
    premiumDoc: Partial<MonthlyDocument>,
    resolvedPremium: PremiumData | undefined,
    resignContext: ReturnType<typeof this.buildResignContext>,
    premiumByMonth: Map<string, PremiumData | undefined>,
  ): Promise<string[]> {
    const previousDisplayYyyyMm = addMonths(displayYyyyMm, -1);
    const { premiumMonth: previousPremiumMonth } = resolvePaymentDisplaySourceMonths(
      previousDisplayYyyyMm,
      this.payrollPaymentMonth,
      this.socialInsuranceCollectionMonth,
    );

    const previousSnap = await getDoc(
      doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        previousPremiumMonth,
        'employees',
        eid,
      ),
    );
    const previousPremiumDoc = previousSnap.exists()
      ? (previousSnap.data() as Partial<MonthlyDocument>)
      : undefined;
    if (!premiumByMonth.has(previousPremiumMonth)) {
      premiumByMonth.set(previousPremiumMonth, previousPremiumDoc?.premiumData);
    }

    const previousResolvedPremium = resolvePaymentDisplayPremium({
      displayYyyyMm: previousDisplayYyyyMm,
      premiumMonthYyyyMm: previousPremiumMonth,
      premiumFromFetchedMonth: previousPremiumDoc?.premiumData,
      premiumByMonth,
      resignContext,
    });

    const personal = employee.employeePersonalInfo;
    const employ = employee.employeeEmployInfo;
    const resolvedBirthDate = birthDate ?? toFormDate(personal?.birthDate) ?? null;

    return buildMonthlyPremiumChangeReasons({
      displayYyyyMm,
      premiumMonthYyyyMm: premiumMonth,
      previousPremiumMonthYyyyMm: previousPremiumMonth,
      birthDate: resolvedBirthDate,
      leaveRecords: employeeLeaveRecordsToPeriodInputs(employee.leaveInfo),
      agePremiumContext: {
        birthDate: resolvedBirthDate,
        licenceStartAt: toFormDate(employ?.licenseStartAt),
        resignAt: toFormDate(employ?.resignAt),
        licenseEndAt: toFormDate(employ?.licenseEndAt),
        specificInsuranceCollectionType:
          this.tenantSettingDataService.form.socialInsuranceSettings.specificInsuranceCollectionType,
        hasDependents: personal?.hasDependents,
        dependentsInfo: personal?.dependentsInfo,
      },
      current: premiumDoc.calculationSnapshot,
      previous: previousPremiumDoc?.calculationSnapshot,
      currentPremium: resolvedPremium,
      previousPremium: previousResolvedPremium,
    });
  }

  private async loadEmployee(tid: string, eid: string): Promise<Partial<EmployeeDocument>> {
    const snap = await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid));
    return snap.exists() ? (snap.data() as Partial<EmployeeDocument>) : {};
  }

  private buildResignContext(employee: Partial<EmployeeDocument>) {
    const employ = employee.employeeEmployInfo;
    return buildResignPremiumDisplayContext({
      licenceStartAt: toFormDate(employ?.licenseStartAt),
      licenseEndAt: toFormDate(employ?.licenseEndAt),
      resignAt: toFormDate(employ?.resignAt),
      collectionMonth: this.socialInsuranceCollectionMonth,
      payrollPaymentMonth: this.payrollPaymentMonth,
      resignPremiumCollection: this.resignPremiumCollection,
    });
  }

  private async ensureTenantSettings(): Promise<void> {
    if (!this.tenantSettingDataService.loaded) {
      await this.tenantSettingDataService.loadAll();
    }
  }

  private get payrollPaymentMonth() {
    return this.tenantSettingDataService.form.socialInsuranceSettings.payrollPaymentMonth
      ?? 'currentMonth';
  }

  private get socialInsuranceCollectionMonth() {
    return this.tenantSettingDataService.form.socialInsuranceSettings.socialInsuranceCollectionMonth
      ?? 'nextMonth';
  }

  private get resignPremiumCollection() {
    return this.tenantSettingDataService.form.socialInsuranceSettings.resignPremiumCollection
      ?? 'monthly';
  }
}

export function formatPaymentPeriodLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  return `${year}年${parseInt(month, 10)}月`;
}
