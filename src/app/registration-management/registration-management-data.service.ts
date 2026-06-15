import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from '@angular/fire/firestore';
import { EmployeeDocument } from '../employee-document';
import { RegistrationFilingSavePayload } from '../../../shared/registration-filing-document';
import { RegistrationFormItem } from './registration-categories';
import type { RegistrationFormType } from '../../../shared/registration-filing-document';
import { RegistrationDocumentBuilderService } from './registration-document-builder.service';
import { RegistrationCsvExportService } from './registration-csv-export.service';
import {
  RegistrationEligibilityService,
  RegistrationEmployeeRow,
} from './registration-eligibility.service';
import { isRegistrationCsvFormType } from '../../../shared/registration-filing-document';
import { omitUndefinedFields } from '../../../shared/omit-undefined-fields';
import { AuditLogService } from '../audit-log/audit-log.service';
import { toEmployeeListRow } from '../employees-management/employees-list/employee-list-row.mapper';
import { EmployeeListRow } from '../employees-management/employees-list/employee-list-columns';

export interface CreatedRegistrationFiling {
  id: string;
  payload: RegistrationFilingSavePayload;
}

@Injectable({ providedIn: 'root' })
export class RegistrationManagementDataService {
  private readonly firestore = inject(Firestore);
  private readonly documentBuilder = inject(RegistrationDocumentBuilderService);
  private readonly csvExport = inject(RegistrationCsvExportService);
  private readonly eligibilityService = inject(RegistrationEligibilityService);
  private readonly auditLog = inject(AuditLogService);

  async listEmployees(tid: string): Promise<EmployeeListRow[]> {
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    return employees.docs.map((snap) =>
      toEmployeeListRow(snap.id, snap.data() as Partial<EmployeeDocument>),
    );
  }

  async listEmployeesForForm(
    tid: string,
    formType: RegistrationFormType,
  ): Promise<RegistrationEmployeeRow[]> {
    const rows = await this.listEmployees(tid);
    return this.eligibilityService.assessAll(tid, formType, rows);
  }

  async createFilings(
    tid: string,
    categoryId: number,
    form: RegistrationFormItem,
    eids: string[],
    createdBy: string,
  ): Promise<CreatedRegistrationFiling[]> {
    const payloads = await this.documentBuilder.buildFilings(
      tid,
      categoryId,
      form,
      eids,
      createdBy,
    );
    const filingsRef = collection(this.firestore, 'tenants', tid, 'registrationFilings');
    const created: CreatedRegistrationFiling[] = [];

    for (const payload of payloads) {
      const docRef = await addDoc(
        filingsRef,
        omitUndefinedFields({
          ...payload,
          createdAt: serverTimestamp(),
        }),
      );
      created.push({
        id: docRef.id,
        payload,
      });

      if (payload.employees[0]) {
        const employee = payload.employees[0];
        await this.auditLog.recordCreate({
          tid,
          category: 'registration.filing',
          summary: `${payload.formLabel}を作成`,
          target: this.auditLog.employeeTarget(
            employee.eid,
            employee.displayName,
            employee.employeeId,
            docRef.id,
          ),
          metadata: {
            formType: payload.formType,
            filingId: docRef.id,
          },
        });
      }
    }

    return created;
  }

  downloadFilings(filings: CreatedRegistrationFiling[], formLabel: string): void {
    const payloads = filings.map((filing) => filing.payload);
    const formType = payloads[0]?.formType;

    if (formType && isRegistrationCsvFormType(formType)) {
      this.csvExport.downloadCsv(payloads, formLabel);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = filings.map((filing) => ({
      id: filing.id,
      ...filing.payload,
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${formLabel}_${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
