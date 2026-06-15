import { inject, Injectable, signal } from '@angular/core';
import { DEFAULT_EMPLOYEE_LIST_COLUMNS, EmployeeListColumnKey, OPTIONAL_EMPLOYEE_LIST_COLUMNS } from './employees-list/employee-list-columns';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable({
  providedIn: 'root',
})
export class EmployeesManagementDataService {
  private readonly firestore = inject(Firestore);
  private readonly auditLog = inject(AuditLogService);

  COLUMN_ORDER = OPTIONAL_EMPLOYEE_LIST_COLUMNS.map(col => col.key);

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
    this.visibleColumns.set(
      this.normalizaColumns(data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_EMPLOYEE_LIST_COLUMNS])
    );
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'employeesListSetting');
    await setDoc(settingsRef, {
      visibleColumns: this.normalizaColumns(this.visibleColumns()),
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordUpdate({
      tid,
      category: 'settings.employees_list',
      summary: '従業員一覧表示設定を更新',
      target: this.auditLog.settingsTarget('employeesListSetting', '従業員一覧設定'),
      after: { visibleColumns: this.visibleColumns() },
    });
  }

  private normalizaColumns(cols: EmployeeListColumnKey[]): EmployeeListColumnKey[] {
    const deduped = [...new Set(cols)];
    const ordered = this.COLUMN_ORDER.filter(col => deduped.includes(col));
    const unknown = deduped.filter(col => !this.COLUMN_ORDER.includes(col));
    return [...ordered, ...unknown];
  }

  toggleOptionalColumn(key: EmployeeListColumnKey, checked: boolean): void {
    const current = this.visibleColumns();
    const keys = current.includes(key);
    if (checked && !keys) {
      this.visibleColumns.set(this.normalizaColumns([...current, key]));
    } else if (!checked && keys) {
      this.visibleColumns.set(this.normalizaColumns(current.filter(col => col !== key)));
    }
  }

  isColumnVisible(key: EmployeeListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  reset(): void {
    this.visibleColumns.set([...DEFAULT_EMPLOYEE_LIST_COLUMNS]);
  }
}
