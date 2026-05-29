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
import { buildBonusData } from './bonus-data.util';
import { bonusTypeFromColumnKey } from './bonus-display.util';
import { BulkEditableColumn, BulkEditTarget, BulkEditValue } from './monthly-bulk-edit.types';
import { BonusAmountMap } from '../../monthly-document';

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

    const bonusType = bonusTypeFromColumnKey(column);
    const batch = writeBatch(this.firestore);

    for (const { eid, bonus } of targets) {
      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        yyyyMm,
        'employees',
        eid,
      );
      const payload = bonusType
        ? this.buildBonusUpdatePayload(bonus, bonusType, value)
        : this.buildUpdatePayload(column, value);
      batch.update(employeeRef, payload);
    }

    await batch.commit();
  }

  private buildBonusUpdatePayload(
    existing: BonusAmountMap,
    bonusType: string,
    value: BulkEditValue,
  ): UpdateData<DocumentData> {
    const amounts = { ...existing };
    if (value == null || value === 0) {
      delete amounts[bonusType];
    } else {
      amounts[bonusType] = value;
    }

    const bonusData = buildBonusData(amounts);
    return bonusData === undefined
      ? { bonusData: deleteField(), updatedAt: serverTimestamp() }
      : { bonusData, updatedAt: serverTimestamp() };
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
