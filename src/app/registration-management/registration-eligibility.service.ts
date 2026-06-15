import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import type { RegistrationFormType } from '../../../shared/registration-filing-document';
import { addMonths } from '../../../shared/social-insurance/monthly/social-insurance-data.util';
import { EmployeeDocument } from '../employee-document';
import { EmployeeListRow } from '../employees-management/employees-list/employee-list-columns';
import { MonthlyDocument } from '../monthly-document';
import { StandardRemunerationDataService } from '../social-insurance/monthly/standard-remuneration-data.service';
import { StandardBonusDataService } from '../social-insurance/bonus/standard-bonus-data.service';

export interface RegistrationEligibility {
  eligible: boolean;
  label: '該当' | '非該当';
  detail: string;
}

export interface RegistrationEmployeeRow extends EmployeeListRow {
  eligibility: RegistrationEligibility;
}

@Injectable({ providedIn: 'root' })
export class RegistrationEligibilityService {
  private readonly firestore = inject(Firestore);
  private readonly standardRemunerationData = inject(StandardRemunerationDataService);
  private readonly standardBonusData = inject(StandardBonusDataService);

  async assessAll(
    tid: string,
    formType: RegistrationFormType,
    rows: EmployeeListRow[],
  ): Promise<RegistrationEmployeeRow[]> {
    const assessed = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        eligibility: await this.assess(tid, formType, row),
      })),
    );
    return assessed.sort((left, right) => {
      if (left.eligibility.eligible !== right.eligibility.eligible) {
        return left.eligibility.eligible ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName, 'ja');
    });
  }

  async assess(
    tid: string,
    formType: RegistrationFormType,
    row: EmployeeListRow,
  ): Promise<RegistrationEligibility> {
    switch (formType) {
      case 'teiji_santei':
        return this.assessTeijiSantei(tid, row.eid);
      case 'monthly_change':
        return this.assessMonthlyChange(tid, row.eid);
      case 'bonus_payment':
        return this.assessBonusPayment(tid, row.eid);
      case 'qualification_acquisition':
        return this.assessQualificationAcquisition(row);
      case 'qualification_loss':
        return this.assessQualificationLoss(row);
      case 'national_pension_type3':
        return this.assessNationalPensionType3(row);
      case 'maternity_leave':
        return this.assessLeave(tid, row.eid, 'maternity');
      case 'childcare_leave':
        return this.assessLeave(tid, row.eid, 'childcare');
      case 'dependent_change':
        return eligible('在籍中の従業員');
      default:
        return eligible('選択可能');
    }
  }

  private async assessTeijiSantei(tid: string, eid: string): Promise<RegistrationEligibility> {
    const history = await this.standardRemunerationData.listForEmployee(tid, eid);
    const teiji = history.find((item) => item.doc.source === 'teiji');
    if (!teiji) {
      return ineligible('定時決定の標準報酬履歴がありません（6月の保険料計算が未実行、または定時決定対象外）');
    }

    const teijiYear = Number(teiji.doc.effectiveFrom.slice(0, 4));
    const monthKeys = [`${teijiYear}-04`, `${teijiYear}-05`, `${teijiYear}-06`] as const;
    const monthCount = await this.countMonthlyRecords(tid, eid, monthKeys);
    if (monthCount === 0) {
      return ineligible(`${teijiYear}年4〜6月の月次給与データがありません`);
    }
    if (monthCount < 3) {
      return ineligible(`${teijiYear}年4〜6月の月次給与が${monthCount}ヶ月分のみ（3ヶ月必要）`);
    }

    return eligible(
      `${teijiYear}年定時決定（健保${teiji.doc.healthGrade}等級・改定${teiji.doc.effectiveFrom.slice(0, 7)}〜）`,
    );
  }

  private async assessMonthlyChange(tid: string, eid: string): Promise<RegistrationEligibility> {
    const history = await this.standardRemunerationData.listForEmployee(tid, eid);
    const zuiji =
      history.find((item) => item.doc.source === 'zuiji') ??
      history.find((item) => item.doc.source === 'provisional_zuiji');
    if (!zuiji) {
      return ineligible('随時改定の標準報酬履歴がありません');
    }

    const effectiveYyyyMm = zuiji.doc.effectiveFrom.slice(0, 7);
    const changeMonthYyyyMm = addMonths(effectiveYyyyMm, -3);
    const monthKeys = [
      changeMonthYyyyMm,
      addMonths(changeMonthYyyyMm, 1),
      addMonths(changeMonthYyyyMm, 2),
    ] as const;
    const monthCount = await this.countMonthlyRecords(tid, eid, monthKeys);
    if (monthCount < 3) {
      return ineligible(`改定前3ヶ月（${changeMonthYyyyMm}〜）の月次給与が${monthCount}ヶ月分のみ`);
    }

    const sourceLabel = zuiji.doc.source === 'provisional_zuiji' ? '暫定随時改定' : '随時改定';
    return eligible(
      `${sourceLabel}（健保${zuiji.doc.healthGrade}等級・改定${effectiveYyyyMm}〜）`,
    );
  }

  private async assessBonusPayment(tid: string, eid: string): Promise<RegistrationEligibility> {
    const history = await this.standardBonusData.listForEmployee(tid, eid);
    const latest = history[0];
    if (!latest) {
      return ineligible('標準賞与額の履歴がありません（賞与の保険料計算が未実行）');
    }

    return eligible(
      `${latest.yyyyMm} 賞与（標準賞与額 ${latest.doc.standardBonus.health.toLocaleString('ja-JP')}円）`,
    );
  }

  private assessQualificationAcquisition(row: EmployeeListRow): RegistrationEligibility {
    if (row.status === 'resigned') {
      return ineligible('退職済み');
    }
    if (!row.licenseStartAt) {
      return ineligible('資格取得日が未登録');
    }
    return eligible(`資格取得日 ${row.licenseStartAt}`);
  }

  private assessQualificationLoss(row: EmployeeListRow): RegistrationEligibility {
    if (row.resignAt) {
      return eligible(`退職日 ${row.resignAt}`);
    }
    if (row.licenseEndAt) {
      return eligible(`資格喪失日 ${row.licenseEndAt}`);
    }
    if (row.status === 'resigned') {
      return eligible('退職済み（退職日未登録）');
    }
    return ineligible('退職日・資格喪失日が未登録');
  }

  private assessNationalPensionType3(row: EmployeeListRow): RegistrationEligibility {
    if (!row.hasDependents) {
      return ineligible('扶養家族が未登録');
    }
    return eligible('扶養家族あり');
  }

  private async assessLeave(
    tid: string,
    eid: string,
    type: 'maternity' | 'childcare',
  ): Promise<RegistrationEligibility> {
    const snap = await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid));
    if (!snap.exists()) {
      return ineligible('従業員データなし');
    }
    const data = snap.data() as EmployeeDocument;
    const records = (data.leaveInfo ?? []).filter((record) => record.type === type);
    if (records.length === 0) {
      return ineligible(type === 'maternity' ? '産休記録なし' : '育休記録なし');
    }
    return eligible(`${records.length}件の休業記録あり`);
  }

  private async countMonthlyRecords(
    tid: string,
    eid: string,
    monthKeys: readonly string[],
  ): Promise<number> {
    let count = 0;
    for (const yyyyMm of monthKeys) {
      const snap = await getDoc(
        doc(this.firestore, 'tenants', tid, 'monthly-records', yyyyMm, 'employees', eid),
      );
      if (!snap.exists()) {
        continue;
      }
      const monthly = snap.data() as MonthlyDocument;
      if (monthly.payrollData) {
        count += 1;
      }
    }
    return count;
  }
}

function eligible(detail: string): RegistrationEligibility {
  return { eligible: true, label: '該当', detail };
}

function ineligible(detail: string): RegistrationEligibility {
  return { eligible: false, label: '非該当', detail };
}
