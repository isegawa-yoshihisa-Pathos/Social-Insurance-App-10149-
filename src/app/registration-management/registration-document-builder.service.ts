import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs } from '@angular/fire/firestore';
import { EmployeeDocument } from '../employee-document';
import { TenantDocument } from '../tenant-document';
import { toFormDate, toYyyyMmDd } from '../date-utils';
import {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingSavePayload,
  RegistrationFilingTenantSnapshot,
  RegistrationFormType,
} from '../../../shared/registration-filing-document';
import { RegistrationFormItem } from './registration-categories';
import { StandardRemunerationDataService } from '../social-insurance/monthly/standard-remuneration-data.service';
import { StandardBonusDataService } from '../social-insurance/bonus/standard-bonus-data.service';

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

  private async buildEmployeeFormPayload(
    tid: string,
    formType: RegistrationFormType,
    employee: RegistrationFilingEmployeeSnapshot,
  ): Promise<Record<string, unknown>> {
    switch (formType) {
      case 'qualification_acquisition':
        return {
          kind: 'qualification_acquisition',
          acquisitionDate: employee.licenseStartAt ?? employee.joinedAt,
        };
      case 'qualification_loss':
        return {
          kind: 'qualification_loss',
          lossDate: employee.resignAt,
        };
      case 'dependent_change':
        return {
          kind: 'dependent_change',
          dependentsInfo: employee.dependentsInfo,
        };
      case 'national_pension_type3':
        return {
          kind: 'national_pension_type3',
          dependentsInfo: employee.dependentsInfo,
        };
      case 'teiji_santei':
        return {
          kind: 'teiji_santei',
          standardRemuneration: await this.loadLatestStandardRemuneration(tid, employee.eid, 'teiji'),
        };
      case 'monthly_change':
        return {
          kind: 'monthly_change',
          standardRemuneration: await this.loadLatestStandardRemuneration(tid, employee.eid, 'zuiji'),
        };
      case 'bonus_payment':
        return {
          kind: 'bonus_payment',
          standardBonus: await this.loadLatestStandardBonus(tid, employee.eid),
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
        };
      default:
        return { kind: formType };
    }
  }

  private async loadLatestStandardRemuneration(
    tid: string,
    eid: string,
    source: 'teiji' | 'zuiji',
  ): Promise<Record<string, unknown> | null> {
    const history = await this.standardRemunerationData.listForEmployee(tid, eid);
    const found = history.find((item) => item.doc.source === source) ?? history[0];
    if (!found) return null;
    return {
      yyyyMm: found.yyyyMm,
      healthGrade: found.doc.healthGrade,
      pensionGrade: found.doc.pensionGrade,
      standardRemuneration: found.doc.standardRemuneration,
      source: found.doc.source,
      effectiveFrom: found.doc.effectiveFrom,
    };
  }

  private async loadLatestStandardBonus(
    tid: string,
    eid: string,
  ): Promise<Record<string, unknown> | null> {
    const history = await this.standardBonusData.listForEmployee(tid, eid);
    const found = history[0];
    if (!found) return null;
    return {
      yyyyMm: found.yyyyMm,
      standardBonus: found.doc.standardBonus,
      bonusAmount: found.doc.bonusAmount,
      effectiveFrom: found.doc.effectiveFrom,
      source: found.doc.source,
    };
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
