import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
} from '@angular/fire/firestore';
import { BonusDocument, BonusPeriodDocument } from '../bonus-document';
import { MonthlyDocument, MonthlyPeriodDocument } from '../monthly-document';
import { BonusListRow } from '../bonus-management/bonus-list/bonus-list-columns';
import { toBonusListRow } from '../bonus-management/bonus-list/bonus-list-row.mapper';
import { MonthlyListRow } from '../monthly-management/monthly-list/monthly-list-columns';
import { toMonthlyListRow } from '../monthly-management/monthly-list/monthly-list-row.mapper';
import { BonusManagementDataService } from '../bonus-management/bonus-management-data.service';
import { addMonths } from '../social-insurance/monthly/social-insurance-data.util';
import {
  buildBonusPremiumChangeReasons,
  buildMonthlyPremiumChangeReasons,
} from '../../../shared/social-insurance/premium/premium-change-reason';

export type MainPagePaymentScope = 'monthly' | 'bonus';

export interface MainPagePaymentRowResult {
  row: MonthlyListRow | BonusListRow | null;
  changeReasons: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MainPagePaymentDataService {
  private readonly firestore = inject(Firestore);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);

  async loadLockedPeriods(
    tid: string,
    eid: string,
    scope: MainPagePaymentScope,
  ): Promise<string[]> {
    const collectionName = scope === 'monthly' ? 'monthly-records' : 'bonus-records';
    const periodsSnap = await getDocs(
      collection(this.firestore, 'tenants', tid, collectionName),
    );

    const lockedPeriods: string[] = [];
    for (const periodDoc of periodsSnap.docs) {
      const period = periodDoc.data() as Partial<MonthlyPeriodDocument | BonusPeriodDocument>;
      if (period.locked !== true) {
        continue;
      }

      const employeeSnap = await getDoc(
        doc(
          this.firestore,
          'tenants',
          tid,
          collectionName,
          periodDoc.id,
          'employees',
          eid,
        ),
      );
      if (employeeSnap.exists()) {
        lockedPeriods.push(periodDoc.id);
      }
    }

    lockedPeriods.sort((a, b) => b.localeCompare(a));
    return lockedPeriods;
  }

  async loadMonthlyRow(
    tid: string,
    eid: string,
    yyyyMm: string,
    meta: { employeeId: string; displayName: string; birthDate?: Date | null },
  ): Promise<MainPagePaymentRowResult> {
    const snap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'monthly-records', yyyyMm, 'employees', eid),
    );
    if (!snap.exists()) {
      return { row: null, changeReasons: [] };
    }

    const data = snap.data() as Partial<MonthlyDocument>;
    const row = toMonthlyListRow(eid, data);
    const enrichedRow: MonthlyListRow = {
      ...row,
      employeeId: meta.employeeId,
      displayName: meta.displayName || row.displayName,
    };

    const previousYyyyMm = addMonths(yyyyMm, -1);
    const previousSnap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'monthly-records', previousYyyyMm, 'employees', eid),
    );
    const previousData = previousSnap.exists()
      ? (previousSnap.data() as Partial<MonthlyDocument>)
      : undefined;

    const changeReasons = buildMonthlyPremiumChangeReasons({
      yyyyMm,
      birthDate: meta.birthDate ?? null,
      current: data.calculationSnapshot,
      previous: previousData?.calculationSnapshot,
      currentPremium: data.premiumData,
      previousPremium: previousData?.premiumData,
    });

    return { row: enrichedRow, changeReasons };
  }

  async loadBonusRow(
    tid: string,
    eid: string,
    yyyyMm: string,
    meta: { employeeId: string; displayName: string; birthDate?: Date | null },
  ): Promise<MainPagePaymentRowResult> {
    await this.bonusManagementDataService.loadBonusSettings(tid);
    const bonusTypeDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();

    const snap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'bonus-records', yyyyMm, 'employees', eid),
    );
    if (!snap.exists()) {
      return { row: null, changeReasons: [] };
    }

    const data = snap.data() as Partial<BonusDocument>;
    const row = toBonusListRow(eid, data, bonusTypeDefinitions);
    const enrichedRow: BonusListRow = {
      ...row,
      employeeId: meta.employeeId,
      displayName: meta.displayName || row.displayName,
    };

    const previousYyyyMm = addMonths(yyyyMm, -1);
    const previousSnap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'bonus-records', previousYyyyMm, 'employees', eid),
    );
    const previousData = previousSnap.exists()
      ? (previousSnap.data() as Partial<BonusDocument>)
      : undefined;

    const changeReasons = buildBonusPremiumChangeReasons({
      yyyyMm,
      birthDate: meta.birthDate ?? null,
      current: data.calculationSnapshot,
      previous: previousData?.calculationSnapshot,
      currentPremium: data.premiumData,
      previousPremium: previousData?.premiumData,
    });

    return { row: enrichedRow, changeReasons };
  }
}

export function formatPaymentPeriodLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  return `${year}年${parseInt(month, 10)}月`;
}
