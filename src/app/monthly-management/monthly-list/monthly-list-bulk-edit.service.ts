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
import { allowanceTypeFromColumnKey } from '../../payment-management/payment-list/allowance-display.util';
import { PaymentManagementDataService } from '../../payment-management/payment-management-data.service';
import { buildPayrollWageFields } from '../../payment-management/payment-list/payroll-wage-update.util';
import { MonthlyListDataService } from './monthly-list-data.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { getMonthlyListColumnLabel } from './monthly-list-columns';

@Injectable({
  providedIn: 'root',
})
export class MonthlyListBulkEditService {
  private readonly firestore = inject(Firestore);
  private readonly standardRemunerationDataService = inject(StandardRemunerationDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly listDataService = inject(MonthlyListDataService);
  private readonly auditLog = inject(AuditLogService);

  async applyBulkEdit(
    tid: string,
    yyyyMm: string,
    targets: BulkEditTarget[],
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): Promise<void> {
    if (targets.length === 0) return;

    if (await this.listDataService.isPeriodLocked(tid, yyyyMm)) {
      throw new Error('この月は締切済みのため、編集できません。');
    }

    if (isBulkEditableStandardRemunerationColumn(column)) {
      await this.applyStandardRemunerationBulkEdit(tid, yyyyMm, targets, column, value);
      return;
    }

    const definitions = this.paymentManagementDataService.allowanceTypeDefinitions();
    const batch = writeBatch(this.firestore);

    for (const target of targets) {
      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        yyyyMm,
        'employees',
        target.eid,
      );
      const payload = this.buildPayrollUpdatePayload(target, column, value, definitions);
      batch.update(employeeRef, payload);
    }

    await batch.commit();

    const columnLabel = getMonthlyListColumnLabel(column, definitions);
    for (const target of targets) {
      await this.auditLog.recordUpdate({
        tid,
        category: 'monthly.payroll',
        summary: `${yyyyMm} の月次給与を一括更新（${columnLabel}）`,
        target: {
          kind: 'monthly',
          eid: target.eid,
          resourceId: yyyyMm,
          label: columnLabel,
        },
        before: { [column]: this.readBulkEditBeforeValue(target, column) },
        after: { [column]: value },
        metadata: { column, yyyyMm },
      });
    }
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

        const columnLabel = getMonthlyListColumnLabel(column, []);
        await this.auditLog.recordUpdate({
          tid,
          category: 'monthly.standardRemuneration',
          summary: `${yyyyMm} の標準報酬月額を一括更新（${columnLabel}）`,
          target: {
            kind: 'monthly',
            eid,
            resourceId: yyyyMm,
            label: columnLabel,
          },
          before: {
            [column]: existing?.standardRemuneration?.[
              column === 'standardRemunerationHealth' ? 'health' : 'pension'
            ] ?? null,
          },
          after: { [column]: value },
          metadata: { column, yyyyMm },
        });
      }),
    );
  }

  private buildManualStandardRemuneration(
    existing: StandardRemunerationDocument | null,
    column: BulkEditableStandardRemunerationColumnKey,
    value: number,
    yyyyMm: string,
  ): StandardRemunerationSavePayload {
    const existingHealth = existing?.standardRemuneration.health ?? 0;
    const existingPension = existing?.standardRemuneration.pension ?? 0;
    const existingHealthGrade = existing?.healthGrade ?? 1;
    const existingPensionGrade = existing?.pensionGrade ?? 1;

    const healthAmount =
      column === 'standardRemunerationHealth' ? value : existingHealth;
    const pensionAmount =
      column === 'standardRemunerationPension' ? value : existingPension;

    const healthGrade = this.resolveManualGrade(
      CURRENT_GRADE_TABLE.health,
      healthAmount,
      column === 'standardRemunerationHealth' ? undefined : existingHealthGrade,
    );
    const pensionGrade = this.resolveManualGrade(
      CURRENT_GRADE_TABLE.pension,
      pensionAmount,
      column === 'standardRemunerationPension' ? undefined : existingPensionGrade,
    );

    return {
      healthGrade,
      pensionGrade,
      standardRemuneration: { health: healthAmount, pension: pensionAmount },
      source: 'manual',
      effectiveFrom: yyyyMm,
      remuneration: existing?.remuneration ?? value,
    };
  }

  private resolveManualGrade(
    rows: typeof CURRENT_GRADE_TABLE.health,
    standardAmount: number,
    fallbackGrade?: number,
  ): number {
    if (standardAmount === 0) {
      return 0;
    }
    const grade = resolveGradeFromStandardAmount(rows, standardAmount);
    if (grade != null) {
      return grade;
    }
    if (fallbackGrade != null) {
      return fallbackGrade;
    }
    throw new Error('等級表に該当しない標準報酬月額です。');
  }

  private buildPayrollUpdatePayload(
    target: BulkEditTarget,
    column: BulkEditableColumn,
    value: BulkEditValue,
    definitions: ReturnType<PaymentManagementDataService['allowanceTypeDefinitions']>,
  ): UpdateData<DocumentData> {
    const allowanceType = allowanceTypeFromColumnKey(column);
    const patch: {
      basicSalary?: number;
      fringeBenefits?: number;
      allowances?: Record<string, number>;
      retroactivePay?: number | null;
      bonusRelatedRemuneration?: number;
      paymentBaseDays?: number;
    } = {};

    if (allowanceType) {
      const allowances = { ...target.allowances };
      if (value == null || value === 0) {
        delete allowances[allowanceType];
      } else {
        allowances[allowanceType] = value;
      }
      patch.allowances = allowances;
    } else if (column === 'basicSalary') {
      patch.basicSalary = value === null ? 0 : value;
    } else if (column === 'fringeBenefits') {
      patch.fringeBenefits = value === null ? 0 : value;
    } else if (column === 'retroactivePay') {
      patch.retroactivePay = value;
    } else if (column === 'bonusRelatedRemuneration') {
      patch.bonusRelatedRemuneration = value === null ? 0 : value;
    } else if (column === 'paymentBaseDays') {
      patch.paymentBaseDays = value === null ? 0 : value;
    }

    const wages = buildPayrollWageFields(target, patch, definitions);
    const update: Record<string, unknown> = {
      'payrollData.fixedWage': wages.fixedWage,
      'payrollData.variableWage': wages.variableWage,
      updatedAt: serverTimestamp(),
    };

    if (patch.basicSalary !== undefined) {
      update['payrollData.basicSalary'] = patch.basicSalary;
    }
    if (patch.fringeBenefits !== undefined) {
      update['payrollData.fringeBenefits'] = patch.fringeBenefits;
    }
    if (patch.retroactivePay !== undefined) {
      update['payrollData.retroactivePay'] =
        patch.retroactivePay === null ? deleteField() : patch.retroactivePay;
    }
    if (patch.bonusRelatedRemuneration !== undefined) {
      update['bonusRelatedRemuneration'] = patch.bonusRelatedRemuneration === null ? 0 : patch.bonusRelatedRemuneration;
    }
    if (patch.paymentBaseDays !== undefined) {
      update['paymentBaseDays'] = patch.paymentBaseDays;
    }
    if (patch.allowances !== undefined) {
      update['payrollData.allowances'] = patch.allowances;
    }

    return update as UpdateData<DocumentData>;
  }

  private readBulkEditBeforeValue(
    target: BulkEditTarget,
    column: BulkEditableColumn,
  ): number | null {
    const allowanceType = allowanceTypeFromColumnKey(column);
    if (allowanceType) {
      return target.allowances[allowanceType] ?? null;
    }
    if (column === 'basicSalary') {
      return target.basicSalary;
    }
    if (column === 'fringeBenefits') {
      return target.fringeBenefits;
    }
    if (column === 'retroactivePay') {
      return target.retroactivePay;
    }
    if (column === 'bonusRelatedRemuneration') {
      return target.bonusRelatedRemuneration;
    }
    if (column === 'paymentBaseDays') {
      return target.paymentBaseDays;
    }
    return null;
  }
}
