import { Injectable, inject } from '@angular/core';
import { EMPLOYEE_INPUT_REQUEST_FIELD_LABELS, EmployeeInputRequestField } from '../../../../shared/employee-input-request';
import { FunctionsService } from '../../functions.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { EmployeeListColumnKey } from './employee-list-columns';
import { columnToInputRequestField } from './employee-input-request.util';

@Injectable({ providedIn: 'root' })
export class EmployeeInputRequestService {
  private readonly functionsService = inject(FunctionsService);
  private readonly auditLog = inject(AuditLogService);

  resolveField(column: EmployeeListColumnKey): EmployeeInputRequestField | null {
    return columnToInputRequestField(column);
  }

  fieldLabel(column: EmployeeListColumnKey): string {
    const field = this.resolveField(column);
    if (!field) return column;
    return EMPLOYEE_INPUT_REQUEST_FIELD_LABELS[field];
  }

  async requestInput(params: {
    tid: string;
    eids: string[];
    column: EmployeeListColumnKey;
    employeeLabels: { eid: string; displayName: string; employeeId: string }[];
  }): Promise<{ notified: number; skippedNoAccount: number; skippedNotFound: number }> {
    const field = this.resolveField(params.column);
    if (!field) {
      throw new Error('依頼対象の項目が不正です。');
    }

    const result = await this.functionsService.requestEmployeeInput({
      tid: params.tid,
      eids: params.eids,
      field,
    });

    if (result.notified === 0) {
      return result;
    }

    const fieldLabel = this.fieldLabel(params.column);
    await this.auditLog.recordCreate({
      tid: params.tid,
      category: 'employee.input_request',
      summary: `${fieldLabel}の入力依頼を送信（${result.notified}件）`,
      target: params.employeeLabels.length === 1
        ? this.auditLog.employeeTarget(
            params.employeeLabels[0].eid,
            params.employeeLabels[0].displayName,
            params.employeeLabels[0].employeeId,
          )
        : {
            kind: 'employee',
            label: `${params.employeeLabels.length}名`,
          },
      metadata: {
        field,
        notified: result.notified,
        skippedNoAccount: result.skippedNoAccount,
        skippedNotFound: result.skippedNotFound,
      },
    });

    return result;
  }
}
