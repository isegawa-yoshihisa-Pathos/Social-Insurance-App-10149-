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
import {
  BulkEditableColumn,
  BulkEditablePayrollColumn,
  BulkEditTarget,
  BulkEditValue,
} from './monthly-bulk-edit.types';
import {
  BulkEditableStandardRemunerationColumnKey,
  isBulkEditableStandardRemunerationColumn,
} from '../monthly-premium/monthly-premium-columns';
import {
  StandardRemunerationDataService,
  StandardRemunerationSavePayload,
} from '../../social-insurance/monthly/standard-remuneration-data.service';
import { StandardRemunerationDocument } from '../../social-insurance/monthly/social-insurance-document';
import {
  CURRENT_GRADE_TABLE,
  resolveGradeFromStandardAmount,
} from '../../social-insurance/remuneration/grade-table';

const PAYROLL_COLUMNS: readonly BulkEditablePayrollColumn[] = [
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
  private readonly standardRemunerationDataService = inject(StandardRemunerationDataService);

  async applyBulkEdit(
    tid: string,
    yyyyMm: string,
    targets: BulkEditTarget[],
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): Promise<void> {
    if (targets.length === 0) return;

    if (isBulkEditableStandardRemunerationColumn(column)) {
      await this.applyStandardRemunerationBulkEdit(tid, yyyyMm, targets, column, value);
      return;
    }

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
      const payload = this.buildPayrollUpdatePayload(column, value);
      batch.update(employeeRef, payload);
    }

    await batch.commit();
  }

  private async applyStandardRemunerationBulkEdit(
    tid: string,
    yyyyMm: string,
    targets: BulkEditTarget[],
    column: BulkEditableStandardRemunerationColumnKey,
    value: BulkEditValue,
  ): Promise<void> {
    if (value == null) {
      throw new Error('標準報酬月額は数値で入力してください。');
    }

    await Promise.all(
      targets.map(async ({ eid }) => {
        const existing = await this.standardRemunerationDataService.get(tid, eid, yyyyMm);
        const payload = this.buildManualStandardRemuneration(existing, column, value, yyyyMm);
        await this.standardRemunerationDataService.save(tid, eid, yyyyMm, payload);
      }),
    );
  }

  private buildManualStandardRemuneration(
    existing: StandardRemunerationDocument | null,
    column: BulkEditableStandardRemunerationColumnKey,
    value: number,
    yyyyMm: string,
  ): StandardRemunerationSavePayload {
    const healthAmount =
      column === 'standardRemunerationHealth'
        ? value
        : existing
        ? existing.standardRemuneration.health
        : 58000;
    const pensionAmount =
      column === 'standardRemunerationPension'
        ? value
        : existing
        ? existing.standardRemuneration.pension
        : 88000;

    const healthGrade = resolveGradeFromStandardAmount(
      CURRENT_GRADE_TABLE.health,
      healthAmount,
    );
    const pensionGrade = resolveGradeFromStandardAmount(
      CURRENT_GRADE_TABLE.pension,
      pensionAmount,
    );
    if (healthGrade == null || pensionGrade == null) {
      throw new Error('等級表に該当しない標準報酬月額です。');
    }

    return {
      healthGrade,
      pensionGrade,
      standardRemuneration: { health: healthAmount, pension: pensionAmount },
      source: 'manual',
      effectiveFrom: `${yyyyMm}-01`,
      remuneration: value,
    };
  }

  private buildPayrollUpdatePayload(
    column: BulkEditablePayrollColumn,
    value: BulkEditValue,
  ): UpdateData<DocumentData> {
    if (PAYROLL_COLUMNS.includes(column)) {
      return {
        [`payrollData.${column}`]: value === null ? deleteField() : value,
        updatedAt: serverTimestamp(),
      } as UpdateData<DocumentData>;
    }

    return { updatedAt: serverTimestamp() };
  }
}

