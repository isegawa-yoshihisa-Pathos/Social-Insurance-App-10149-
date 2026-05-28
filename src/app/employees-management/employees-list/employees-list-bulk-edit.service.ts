import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  UpdateData,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { toFirestoreTimestamp } from '../../date-utils';
import {
  BulkEditableColumn,
  BulkEditValue,
  isDateBulkColumn,
} from './employees-bulk-edit.types';

@Injectable({
  providedIn: 'root',
})
export class EmployeesListBulkEditService {
  private readonly firestore = inject(Firestore);

  async applyBulkEdit(
    tid: string,
    targetEids: string[],
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): Promise<void> {
    if (targetEids.length === 0) return;

    const batch = writeBatch(this.firestore);
    const employeePayload = this.buildEmployeeUpdatePayload(column, value);

    for (const eid of targetEids) {
      const employeeRef = doc(this.firestore, 'tenants', tid, 'employees', eid);
      batch.update(employeeRef, employeePayload);
    }

    if (column === 'role' || column === 'status') {
      for (const eid of targetEids) {
        const employeeRef = doc(this.firestore, 'tenants', tid, 'employees', eid);
        const employeeSnap = await getDoc(employeeRef);
        if (!employeeSnap.exists()) continue;

        const uid = String(employeeSnap.data()?.['uid'] ?? '');
        if (!uid) continue;

        const affiliationRef = doc(this.firestore, 'affiliations', `${uid}_${tid}`);
        batch.set(affiliationRef, this.buildAffiliationUpdatePayload(column, value), {
          merge: true,
        });
      }
    }

    await batch.commit();
  }

  private buildEmployeeUpdatePayload(
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): UpdateData<DocumentData> {
    const normalized = isDateBulkColumn(column)
      ? toFirestoreTimestamp(value as Date | null)
      : value;

    if (column === 'role') {
      return {
        role: normalized,
        updatedAt: serverTimestamp(),
      };
    }

    return {
      [`employeeEmployInfo.${column}`]: normalized,
      updatedAt: serverTimestamp(),
    } as UpdateData<DocumentData>;
  }

  private buildAffiliationUpdatePayload(
    column: 'role' | 'status',
    value: BulkEditValue,
  ): Record<string, unknown> {
    if (column === 'role') {
      return {
        role: value,
        updatedAt: serverTimestamp(),
      };
    }

    return {
      status: this.mapEmployeeStatusToAffiliationStatus(String(value ?? 'active')),
      updatedAt: serverTimestamp(),
    };
  }

  private mapEmployeeStatusToAffiliationStatus(
    employeeStatus: string,
  ): 'active' | 'suspended' | 'archived' {
    switch (employeeStatus) {
      case 'leave':
        return 'suspended';
      case 'resigned':
        return 'archived';
      case 'active':
      default:
        return 'active';
    }
  }
}
