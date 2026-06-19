import { inject, Injectable, signal } from '@angular/core';
import {
  DEFAULT_EMPLOYEE_LIST_COLUMNS,
  EmployeeListColumnKey,
  OPTIONAL_EMPLOYEE_LIST_COLUMNS,
} from './employees-list/employee-list-columns';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { AuditLogService } from '../audit-log/audit-log.service';
import { normalizeVisibleColumnOrder } from '../list-column-order.util';

@Injectable({
  providedIn: 'root',
})
export class EmployeesManagementDataService {
  private readonly firestore = inject(Firestore);
  private readonly auditLog = inject(AuditLogService);

  readonly visibleColumns = signal<EmployeeListColumnKey[]>([
    ...DEFAULT_EMPLOYEE_LIST_COLUMNS,
  ]);

  async loadListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'employeesListSetting');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      this.visibleColumns.set([...DEFAULT_EMPLOYEE_LIST_COLUMNS]);
      return;
    }
    const data = settingsSnap.data() as { visibleColumns: EmployeeListColumnKey[] };
    this.setVisibleColumns(
      data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_EMPLOYEE_LIST_COLUMNS],
    );
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'employeesListSetting');
    const normalized = this.normalizeColumns(this.visibleColumns());
    await setDoc(settingsRef, {
      visibleColumns: normalized,
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordUpdate({
      tid,
      category: 'settings.employees_list',
      summary: '従業員一覧表示設定を更新',
      target: this.auditLog.settingsTarget('employeesListSetting', '従業員一覧設定'),
      after: { visibleColumns: normalized },
    });
  }

  setVisibleColumns(cols: EmployeeListColumnKey[]): void {
    this.visibleColumns.set(this.normalizeColumns(cols));
  }

  toggleOptionalColumn(key: EmployeeListColumnKey, checked: boolean): void {
    const current = this.visibleColumns();
    const exists = current.includes(key);

    if (checked && !exists) {
      this.setVisibleColumns([...current, key]);
    } else if (!checked && exists) {
      this.setVisibleColumns(current.filter((col) => col !== key));
    }
  }

  isColumnVisible(key: EmployeeListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  reset(): void {
    this.visibleColumns.set([...DEFAULT_EMPLOYEE_LIST_COLUMNS]);
  }

  private normalizeColumns(cols: EmployeeListColumnKey[]): EmployeeListColumnKey[] {
    const canonicalOrder = OPTIONAL_EMPLOYEE_LIST_COLUMNS.map((col) => col.key);
    const valid = new Set<string>(canonicalOrder);
    return normalizeVisibleColumnOrder(cols, canonicalOrder, (col) =>
      valid.has(col) ? col : null,
    );
  }
}
