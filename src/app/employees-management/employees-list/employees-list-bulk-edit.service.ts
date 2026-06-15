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
import { toFirestoreTimestamp, toFormDate, toYyyyMmDd } from '../../date-utils';
import { EmployeeDocument } from '../../employee-document';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { serializeAuditValue } from '../../../../shared/audit-log.util';
import {
  BulkEditableColumn,
  BulkEditValue,
  isDateBulkColumn,
} from './employees-bulk-edit.types';
import { EMPLOYEE_LIST_COLUMN_LABELS } from './employee-list-columns';

@Injectable({
  providedIn: 'root',
})
export class EmployeesListBulkEditService {
  private readonly firestore = inject(Firestore);
  private readonly auditLog = inject(AuditLogService);

  async applyBulkEdit(
    tid: string,
    targetEids: string[],
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): Promise<void> {
    if (targetEids.length === 0) return;

    const columnLabel = EMPLOYEE_LIST_COLUMN_LABELS[column];
    const snapshots = await Promise.all(
      targetEids.map(async (eid) => ({
        eid,
        snap: await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid)),
      })),
    );

    const batch = writeBatch(this.firestore);
    const employeePayload = this.buildEmployeeUpdatePayload(column, value);

    for (const { eid, snap } of snapshots) {
      if (!snap.exists()) continue;

      const employeeRef = doc(this.firestore, 'tenants', tid, 'employees', eid);
      batch.update(employeeRef, employeePayload);

      if (column === 'role' || column === 'status') {
        const uid = String(snap.data()?.['uid'] ?? '');
        if (!uid) continue;

        const affiliationRef = doc(this.firestore, 'affiliations', `${uid}_${tid}`);
        batch.set(affiliationRef, this.buildAffiliationUpdatePayload(column, value), {
          merge: true,
        });
      }
    }

    await batch.commit();

    const afterValue = this.formatAuditValue(column, value);
    for (const { eid, snap } of snapshots) {
      if (!snap.exists()) continue;

      const data = snap.data() as EmployeeDocument;
      const beforeValue = this.readColumnValue(data, column);

      await this.auditLog.recordUpdate({
        tid,
        category: 'employee.list',
        summary: `従業員一覧の一括更新（${columnLabel}）`,
        target: this.auditLog.employeeTarget(
          eid,
          data.employeePersonalInfo?.displayName ?? '',
          data.employeeEmployInfo?.employeeId,
        ),
        before: { [column]: beforeValue },
        after: { [column]: afterValue },
        metadata: { column, bulkEdit: true },
      });
    }
  }

  private readColumnValue(
    data: EmployeeDocument,
    column: BulkEditableColumn,
  ): unknown {
    if (column === 'role') {
      return data.role ?? '';
    }
    const raw =
      column in (data.employeeEmployInfo ?? {})
        ? data.employeeEmployInfo?.[column as keyof typeof data.employeeEmployInfo]
        : undefined;
    return this.formatAuditValue(column, raw as BulkEditValue);
  }

  private formatAuditValue(column: BulkEditableColumn, value: BulkEditValue | unknown): unknown {
    if (isDateBulkColumn(column)) {
      const date = toFormDate(value);
      return date ? toYyyyMmDd(date) : null;
    }
    return serializeAuditValue(value);
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
      status: value ?? 'active',
      updatedAt: serverTimestamp(),
    };
  }
}
