import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  UpdateData,
  doc,
  serverTimestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { BulkEditableColumn, BulkEditValue } from './monthly-bulk-edit.types';

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
    targetEids: string[],
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): Promise<void> {
    if (targetEids.length === 0) return;

    const batch = writeBatch(this.firestore);
    const monthlyPayload = this.buildUpdatePayload(column, value);

    for (const eid of targetEids) {
      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        yyyyMm,
        'employees',
        eid,
      );
      batch.update(employeeRef, monthlyPayload);
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

    const premiumField = this.resolvePremiumField(column);
    if (premiumField) {
      return {
        [premiumField]: value,
        updatedAt: serverTimestamp(),
      } as UpdateData<DocumentData>;
    }

    return { updatedAt: serverTimestamp() };
  }

  private resolvePremiumField(column: BulkEditableColumn): string | null {
    switch (column) {
      case 'healthInsurance_employer':
        return 'premiumData.healthInsurance.employer';
      case 'healthInsurance_employee':
        return 'premiumData.healthInsurance.employee';
      case 'careInsurance_employer':
        return 'premiumData.careInsurance.employer';
      case 'careInsurance_employee':
        return 'premiumData.careInsurance.employee';
      case 'pensionInsurance_employer':
        return 'premiumData.pensionInsurance.employer';
      case 'pensionInsurance_employee':
        return 'premiumData.pensionInsurance.employee';
      default:
        return null;
    }
  }
}
