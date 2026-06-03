import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  UpdateData,
  doc,
  serverTimestamp,
  writeBatch,
  deleteField,
} from '@angular/fire/firestore';
import { BulkEditableColumn, BulkEditTarget, BulkEditValue } from './monthly-bulk-edit.types';

const PAYROLL_COLUMNS: readonly BulkEditableColumn[] = [
  'totalPay',
  'basicSalary',
  'overtimePay',
  'commuterAllowance',
  'otherAllowance',
  'retroactivePay',
] as const;

@Injectable({
  providedIn: 'root',
})
export class MonthlyListBulkEditService {
  private readonly firestore = inject(Firestore);

  async applyBulkEdit(
    tid: string,
    yyyyMm: string,
    targets: BulkEditTarget[],
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): Promise<void> {
    if (targets.length === 0) return;

    const batch = writeBatch(this.firestore);

    for (const { eid } of targets) {
      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        yyyyMm,
        'employees',
        eid,
      );
    const payload = this.buildUpdatePayload(column, value);
    batch.update(employeeRef, payload);
    }

    await batch.commit();
  }

  private buildUpdatePayload(
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): UpdateData<DocumentData> {
    if (PAYROLL_COLUMNS.includes(column)) {
      return {
        [`payrollData.${column}`]: value,
        updatedAt: serverTimestamp(),
      } as UpdateData<DocumentData>;
    }

    return { updatedAt: serverTimestamp() };
  }
}
