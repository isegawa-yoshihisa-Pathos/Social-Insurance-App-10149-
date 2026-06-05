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

@Injectable({
  providedIn: 'root',
})
export class MonthlyListBulkEditService {
  private readonly firestore = inject(Firestore);
  private readonly standardRemunerationDataService = inject(StandardRemunerationDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);

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
    target: BulkEditTarget,
    column: BulkEditableColumn,
    value: BulkEditValue,
    definitions: ReturnType<PaymentManagementDataService['allowanceTypeDefinitions']>,
  ): UpdateData<DocumentData> {
    const allowanceType = allowanceTypeFromColumnKey(column);
    const patch: {
      basicSalary?: number;
      allowances?: Record<string, number>;
      retroactivePay?: number | null;
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
    } else if (column === 'retroactivePay') {
      patch.retroactivePay = value;
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
    if (patch.retroactivePay !== undefined) {
      update['payrollData.retroactivePay'] =
        patch.retroactivePay === null ? deleteField() : patch.retroactivePay;
    }
    if (patch.allowances !== undefined) {
      if (Object.keys(patch.allowances).length === 0) {
        update['payrollData.allowances'] = {};
      } else {
        for (const [type, amount] of Object.entries(patch.allowances)) {
          update[`payrollData.allowances.${type}`] = amount;
        }
      }
    }

    return update as UpdateData<DocumentData>;
  }
}
