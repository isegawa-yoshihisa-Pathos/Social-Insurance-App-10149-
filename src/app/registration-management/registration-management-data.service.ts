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
import { RegistrationDocumentBuilderService } from './registration-document-builder.service';
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

  async listEmployees(tid: string): Promise<EmployeeListRow[]> {
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    return employees.docs.map((snap) =>
      toEmployeeListRow(snap.id, snap.data() as Partial<EmployeeDocument>),
    );
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
      const docRef = await addDoc(filingsRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
      created.push({
        id: docRef.id,
        payload,
      });
    }

    return created;
  }

  downloadFilings(filings: CreatedRegistrationFiling[], formLabel: string): void {
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
