import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { EmployeeDocument } from '../employee-document';
import { TenantDocument } from '../tenant-document';
import { toFormDate, toYyyyMmDd } from '../date-utils';
import {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingSavePayload,
  RegistrationFilingTenantSnapshot,
  RegistrationFormType,
  RegistrationMonthlyBreakdown,
  RegistrationStandardBonusPayload,
  RegistrationStandardRemunerationPayload,
} from '../../../shared/registration-filing-document';
import { RegistrationFormItem } from './registration-categories';
import { StandardRemunerationDataService } from '../social-insurance/monthly/standard-remuneration-data.service';
import { StandardBonusDataService } from '../social-insurance/bonus/standard-bonus-data.service';
import { MonthlyDocument } from '../monthly-document';
import { BonusDocument } from '../bonus-document';
import { sumBonusDataAmount } from '../../../shared/bonus-data.util';
import { addMonths, lastDayOfYyyyMm } from '../../../shared/social-insurance/monthly/social-insurance-data.util';

function formatDate(value: unknown): string | null {
  const date = toFormDate(value);
  if (!date) return null;
  return toYyyyMmDd(date);
}

function toEmployeeSnapshot(
  eid: string,
  data: EmployeeDocument,
): RegistrationFilingEmployeeSnapshot {
  const personal = data.employeePersonalInfo;
  const employ = data.employeeEmployInfo;
  return {
    eid,
    employeeId: employ.employeeId,
    displayName: personal.displayName,
    realName: personal.realName,
    birthDate: formatDate(personal.birthDate),
    basicPensionNumber: personal.basicPensionNumber,
    myNumber: personal.myNumber ?? '',
    zipcode: personal.zipcode ?? '',
    joinedAt: formatDate(employ.joinedAt),
    resignAt: formatDate(employ.resignAt),
    licenseStartAt: formatDate(employ.licenseStartAt),
    licenseEndAt: formatDate(employ.licenseEndAt),
    healthInsuranceRecordNumber: employ.healthInsuranceRecordNumber,
    pensionInsuranceRecordNumber: employ.pensionInsuranceRecordNumber,
    employmentType: employ.employmentType,
    payType: employ.payType,
    status: employ.status,
    hasDependents: personal.hasDependents,
    dependentsInfo: personal.dependentsInfo ?? [],
  };
}

function toTenantSnapshot(tenant: TenantDocument): RegistrationFilingTenantSnapshot {
  return {
    tenantName: tenant.tenantName,
    tenantNameKana: tenant.tenantNameKana,
    zipcode: tenant.zipcode,
    address: tenant.address,
    ownerName: tenant.ownerName,
    phoneNumber: tenant.phoneNumber,
    socialInsuranceSettings: (tenant.socialInsuranceSettings ?? {}) as Record<string, unknown>,
  };
}

function sumAllowances(allowances: Record<string, number> | undefined): number {
  return Object.values(allowances ?? {}).reduce(
    (sum, value) => sum + (typeof value === 'number' ? value : 0),
    0,
  );
}

function toMonthlyBreakdown(
  yyyyMm: string,
  monthly: MonthlyDocument,
): RegistrationMonthlyBreakdown {
  const payroll = monthly.payrollData;
  const bonusRelated = monthly.bonusRelatedRemuneration ?? 0;
  const inKindAmount = payroll.fringeBenefits ?? 0;
  const currencyAmount =
    (payroll.basicSalary ?? 0) +
    sumAllowances(payroll.allowances) +
    (payroll.variableWage ?? 0) +
    bonusRelated;
  return {
    yyyyMm,
    paymentBaseDays: monthly.paymentBaseDays ?? 0,
    currencyAmount,
    inKindAmount,
    totalAmount: currencyAmount + inKindAmount,
  };
}

function averageAmount(months: RegistrationMonthlyBreakdown[]): number {
  if (months.length === 0) {
    return 0;
  }
  const total = months.reduce((sum, month) => sum + month.totalAmount, 0);
  return Math.floor(total / months.length);
}

function detectRaiseDirection(
  months: RegistrationMonthlyBreakdown[],
): 'increase' | 'decrease' | undefined {
  if (months.length < 2) {
    return undefined;
  }
  const first = months[0].currencyAmount;
  const last = months[months.length - 1].currencyAmount;
  if (last > first) {
    return 'increase';
  }
  if (last < first) {
    return 'decrease';
  }
  return undefined;
}

@Injectable({ providedIn: 'root' })
export class RegistrationDocumentBuilderService {
  private readonly firestore = inject(Firestore);
  private readonly standardRemunerationData = inject(StandardRemunerationDataService);
  private readonly standardBonusData = inject(StandardBonusDataService);

  async buildFilings(
    tid: string,
    categoryId: number,
    form: RegistrationFormItem,
    eids: string[],
    createdBy: string,
  ): Promise<RegistrationFilingSavePayload[]> {
    const tenantSnap = await getDoc(doc(this.firestore, 'tenants', tid));
    if (!tenantSnap.exists()) {
      throw new Error('事業所が見つかりません。');
    }
    const tenant = tenantSnap.data() as TenantDocument;
    const tenantSnapshot = toTenantSnapshot(tenant);

    if (!form.requiresEmployeeSelection) {
      return [
        this.buildPayload(
          categoryId,
          form,
          [],
          tenantSnapshot,
          { kind: 'tenant_only' },
          createdBy,
        ),
      ];
    }

    const employees = await this.loadEmployees(tid, eids);
    if (employees.length === 0) {
      throw new Error('従業員が選択されていません。');
    }

    if (form.batchOfficeForm) {
      return [
        this.buildPayload(
          categoryId,
          form,
          employees,
          tenantSnapshot,
          {
            kind: 'office_batch',
            acquisitionDates: employees.map((employee) => ({
              eid: employee.eid,
              employeeId: employee.employeeId,
              displayName: employee.displayName,
              licenseStartAt: employee.licenseStartAt,
              joinedAt: employee.joinedAt,
            })),
          },
          createdBy,
        ),
      ];
    }

    const filings: RegistrationFilingSavePayload[] = [];
    for (const employee of employees) {
      const formPayload = await this.buildEmployeeFormPayload(tid, form.formType, employee);
      filings.push(
        this.buildPayload(categoryId, form, [employee], tenantSnapshot, formPayload, createdBy),
      );
    }
    return filings;
  }

  private buildPayload(
    categoryId: number,
    form: RegistrationFormItem,
    employees: RegistrationFilingEmployeeSnapshot[],
    tenantSnapshot: RegistrationFilingTenantSnapshot,
    formPayload: Record<string, unknown>,
    createdBy: string,
  ): RegistrationFilingSavePayload {
    return {
      formType: form.formType,
      formLabel: form.label,
      categoryId,
      status: 'created',
      eids: employees.map((employee) => employee.eid),
      employees,
      tenantSnapshot,
      formPayload,
      createdBy,
    };
  }

  private async loadEmployees(
    tid: string,
    eids: string[],
  ): Promise<RegistrationFilingEmployeeSnapshot[]> {
    const employees: RegistrationFilingEmployeeSnapshot[] = [];
    for (const eid of eids) {
      const snap = await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid));
      if (!snap.exists()) continue;
      employees.push(toEmployeeSnapshot(eid, snap.data() as EmployeeDocument));
    }
    return employees;
  }

  private async loadMonthlyDocument(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<MonthlyDocument | null> {
    const snap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'monthly-records', yyyyMm, 'employees', eid),
    );
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as MonthlyDocument;
  }

  private async loadBonusDocument(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<BonusDocument | null> {
    const snap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'bonus-records', yyyyMm, 'employees', eid),
    );
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as BonusDocument;
  }

  private async loadMonthlyBreakdowns(
    tid: string,
    eid: string,
    monthKeys: readonly string[],
  ): Promise<RegistrationMonthlyBreakdown[]> {
    const months: RegistrationMonthlyBreakdown[] = [];
    for (const yyyyMm of monthKeys) {
      const monthly = await this.loadMonthlyDocument(tid, eid, yyyyMm);
      if (!monthly?.payrollData) {
        continue;
      }
      months.push(toMonthlyBreakdown(yyyyMm, monthly));
    }
    return months;
  }

  private async buildEmployeeFormPayload(
    tid: string,
    formType: RegistrationFormType,
    employee: RegistrationFilingEmployeeSnapshot,
  ): Promise<Record<string, unknown>> {
    switch (formType) {
      case 'qualification_acquisition': {
        const acquisitionDate = employee.licenseStartAt ?? employee.joinedAt;
        let currencyAmount = 0;
        let inKindAmount = 0;
        if (acquisitionDate) {
          const yyyyMm = acquisitionDate.slice(0, 7);
          const monthly = await this.loadMonthlyDocument(tid, employee.eid, yyyyMm);
          if (monthly?.payrollData) {
            const breakdown = toMonthlyBreakdown(yyyyMm, monthly);
            currencyAmount = breakdown.currencyAmount;
            inKindAmount = breakdown.inKindAmount;
          }
        }
        return {
          kind: 'qualification_acquisition',
          acquisitionDate,
          currencyAmount,
          inKindAmount,
          totalAmount: currencyAmount + inKindAmount,
          hasDependents: employee.hasDependents,
        };
      }
      case 'qualification_loss':
        return {
          kind: 'qualification_loss',
          lossDate: employee.resignAt,
          resignDate: employee.resignAt,
          lossReason: '4',
        };
      case 'dependent_change':
        return {
          kind: 'dependent_change',
          changeType: '1',
          dependentsInfo: employee.dependentsInfo,
        };
      case 'national_pension_type3':
        return {
          kind: 'national_pension_type3',
          changeType: '1',
          dependentsInfo: employee.dependentsInfo,
        };
      case 'teiji_santei':
        return {
          kind: 'teiji_santei',
          ...(await this.buildTeijiPayload(tid, employee.eid)),
        };
      case 'monthly_change':
        return {
          kind: 'monthly_change',
          ...(await this.buildMonthlyChangePayload(tid, employee.eid)),
        };
      case 'bonus_payment':
        return {
          kind: 'bonus_payment',
          ...(await this.buildBonusPayload(tid, employee.eid)),
        };
      case 'maternity_leave':
        return {
          kind: 'maternity_leave',
          leaveRecords: await this.loadLeaveRecords(tid, employee.eid, 'maternity'),
        };
      case 'childcare_leave':
        return {
          kind: 'childcare_leave',
          leaveRecords: await this.loadLeaveRecords(tid, employee.eid, 'childcare'),
          dependentsInfo: employee.dependentsInfo,
        };
      default:
        return { kind: formType };
    }
  }

  private async buildTeijiPayload(
    tid: string,
    eid: string,
  ): Promise<RegistrationStandardRemunerationPayload> {
    const history = await this.standardRemunerationData.listForEmployee(tid, eid);
    const teiji = history.find((item) => item.doc.source === 'teiji') ?? history[0];
    if (!teiji) {
      throw new Error('定時決定の標準報酬履歴がありません。6月の保険料計算を実行してください。');
    }

    const teijiYear = Number(teiji.doc.effectiveFrom.slice(0, 4));
    const monthKeys = [`${teijiYear}-04`, `${teijiYear}-05`, `${teijiYear}-06`] as const;
    const months = await this.loadMonthlyBreakdowns(tid, eid, monthKeys);
    if (months.length === 0) {
      throw new Error(`${teijiYear}年4〜6月の月次給与データがありません。`);
    }

    const prior = history.find(
      (item) => item.yyyyMm < `${teijiYear}-04` && item.doc.source !== 'carried',
    );
    const raiseMonthYyyyMm = this.detectRaiseMonth(months);
    const retro = await this.findRetroactiveInMonths(tid, eid, monthKeys);

    return {
      yyyyMm: teiji.yyyyMm,
      healthGrade: teiji.doc.healthGrade,
      pensionGrade: teiji.doc.pensionGrade,
      standardRemuneration: teiji.doc.standardRemuneration,
      source: teiji.doc.source,
      effectiveFrom: teiji.doc.effectiveFrom,
      remuneration: teiji.doc.remuneration,
      previousHealthGrade: prior?.doc.healthGrade,
      previousPensionGrade: prior?.doc.pensionGrade,
      previousEffectiveFrom: prior?.doc.effectiveFrom,
      raiseMonthYyyyMm,
      raiseDirection: detectRaiseDirection(months),
      retroactivePayMonth: retro?.month,
      retroactivePayAmount: retro?.amount,
      months,
      totalRemuneration: months.reduce((sum, month) => sum + month.totalAmount, 0),
      averageRemuneration: averageAmount(months),
    };
  }

  private async buildMonthlyChangePayload(
    tid: string,
    eid: string,
  ): Promise<RegistrationStandardRemunerationPayload> {
    const history = await this.standardRemunerationData.listForEmployee(tid, eid);
    const zuiji =
      history.find((item) => item.doc.source === 'zuiji') ??
      history.find((item) => item.doc.source === 'provisional_zuiji');
    if (!zuiji) {
      throw new Error('随時改定の標準報酬履歴がありません。');
    }

    const effectiveYyyyMm = zuiji.doc.effectiveFrom.slice(0, 7);
    const changeMonthYyyyMm = addMonths(effectiveYyyyMm, -3);
    const monthKeys = [
      changeMonthYyyyMm,
      addMonths(changeMonthYyyyMm, 1),
      addMonths(changeMonthYyyyMm, 2),
    ] as const;
    const months = await this.loadMonthlyBreakdowns(tid, eid, monthKeys);
    if (months.length < 3) {
      throw new Error('随時改定に必要な3ヶ月分の月次給与データがありません。');
    }

    const prior = history.find(
      (item) => item.yyyyMm < changeMonthYyyyMm && item.doc.source !== 'carried',
    );
    const retro = await this.findRetroactiveInMonths(tid, eid, monthKeys);

    return {
      yyyyMm: zuiji.yyyyMm,
      healthGrade: zuiji.doc.healthGrade,
      pensionGrade: zuiji.doc.pensionGrade,
      standardRemuneration: zuiji.doc.standardRemuneration,
      source: zuiji.doc.source,
      effectiveFrom: zuiji.doc.effectiveFrom,
      remuneration: zuiji.doc.remuneration,
      previousHealthGrade: prior?.doc.healthGrade,
      previousPensionGrade: prior?.doc.pensionGrade,
      previousEffectiveFrom: prior?.doc.effectiveFrom,
      raiseMonthYyyyMm: changeMonthYyyyMm,
      raiseDirection: detectRaiseDirection(months),
      retroactivePayMonth: retro?.month,
      retroactivePayAmount: retro?.amount,
      months,
      totalRemuneration: months.reduce((sum, month) => sum + month.totalAmount, 0),
      averageRemuneration: averageAmount(months),
    };
  }

  private async buildBonusPayload(
    tid: string,
    eid: string,
  ): Promise<RegistrationStandardBonusPayload> {
    const history = await this.standardBonusData.listForEmployee(tid, eid);
    const latest = history[0];
    if (!latest) {
      throw new Error('標準賞与額の履歴がありません。賞与の保険料計算を実行してください。');
    }

    const bonusDoc = await this.loadBonusDocument(tid, eid, latest.yyyyMm);
    const bonusAmount = latest.doc.bonusAmount
      ?? (bonusDoc?.bonusData ? sumBonusDataAmount(bonusDoc.bonusData) : 0);
    const inKindAmount = 0;
    const currencyAmount = bonusAmount;

    return {
      yyyyMm: latest.yyyyMm,
      standardBonus: latest.doc.standardBonus,
      bonusAmount,
      rawStandardBonus: latest.doc.rawStandardBonus,
      effectiveFrom: latest.doc.effectiveFrom,
      source: latest.doc.source,
      currencyAmount,
      inKindAmount,
      paymentDate: lastDayOfYyyyMm(latest.yyyyMm),
    };
  }

  private detectRaiseMonth(months: RegistrationMonthlyBreakdown[]): string | undefined {
    if (months.length < 2) {
      return undefined;
    }
    for (let index = 1; index < months.length; index += 1) {
      if (months[index].currencyAmount !== months[index - 1].currencyAmount) {
        return months[index].yyyyMm;
      }
    }
    return undefined;
  }

  private async findRetroactiveInMonths(
    tid: string,
    eid: string,
    monthKeys: readonly string[],
  ): Promise<{ month: string; amount: number } | undefined> {
    for (const yyyyMm of monthKeys) {
      const monthly = await this.loadMonthlyDocument(tid, eid, yyyyMm);
      const retro = monthly?.payrollData?.retroactivePay;
      if (retro != null && retro > 0) {
        return { month: yyyyMm.slice(5, 7), amount: retro };
      }
    }
    return undefined;
  }

  private async loadLeaveRecords(
    tid: string,
    eid: string,
    type: 'maternity' | 'childcare',
  ): Promise<unknown[]> {
    const snap = await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid));
    if (!snap.exists()) return [];
    const data = snap.data() as EmployeeDocument;
    return (data.leaveInfo ?? [])
      .filter((record) => record.type === type)
      .map((record) => ({
        type: record.type,
        startAt: formatDate(record.startAt),
        endAt: formatDate(record.endAt),
        reason: record.reason ?? '',
      }));
  }
}
