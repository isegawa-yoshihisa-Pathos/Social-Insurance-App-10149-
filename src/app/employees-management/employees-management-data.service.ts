import { inject, Injectable, signal } from '@angular/core';
import { DEFAULT_EMPLOYEE_LIST_COLUMNS, EmployeeListColumnKey } from './employees-list/employee-list-columns';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class EmployeesManagementDataService {
  private readonly firestore = inject(Firestore);

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
      this.nomalizaColumns(data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_EMPLOYEE_LIST_COLUMNS])
    );
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'employeesListSetting');
    await setDoc(settingsRef, {
      visibleColumns: this.nomalizaColumns(this.visibleColumns()),
      updatedAt: serverTimestamp(),
    });
  }

  nomalizaColumns(cols: EmployeeListColumnKey[]): EmployeeListColumnKey[] {
    const rest = cols.filter(col => col !== 'displayName');
    return ['displayName', ...rest];
  }

  toggleOptionalColumn(key: EmployeeListColumnKey, checked: boolean): void {
    if (key === 'displayName') return;
    const current = this.visibleColumns();
    const keys = current.includes(key);
    if (checked && !keys) {
      this.visibleColumns.set(this.nomalizaColumns([...current, key]));
    } else if (!checked && keys) {
      this.visibleColumns.set(this.nomalizaColumns(current.filter(col => col !== key)));
    }
  }

  isColumnVisible(key: EmployeeListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  reset(): void {
    this.visibleColumns.set([...DEFAULT_EMPLOYEE_LIST_COLUMNS]);
  }
}
