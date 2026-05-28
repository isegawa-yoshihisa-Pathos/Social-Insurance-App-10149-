import { inject, Injectable, signal } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import {
  ALL_MONTHLY_LIST_COLUMN_KEYS,
  DEFAULT_MONTHLY_LIST_COLUMNS,
  MonthlyListColumnKey,
} from './monthly-list/monthly-list-columns';

@Injectable({
  providedIn: 'root',
})
export class MonthlyManagementDataService {
  private readonly firestore = inject(Firestore);

  readonly visibleColumns = signal<MonthlyListColumnKey[]>([
    ...DEFAULT_MONTHLY_LIST_COLUMNS,
  ]);

  async loadListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'monthlyListSetting');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      this.visibleColumns.set([...DEFAULT_MONTHLY_LIST_COLUMNS]);
      return;
    }
    const data = settingsSnap.data() as { visibleColumns: MonthlyListColumnKey[] };
    this.visibleColumns.set(
      this.nomalizaColumns(
        data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_MONTHLY_LIST_COLUMNS],
      ),
    );
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'monthlyListSetting');
    await setDoc(settingsRef, {
      visibleColumns: this.nomalizaColumns(this.visibleColumns()),
      updatedAt: serverTimestamp(),
    });
  }

  nomalizaColumns(cols: MonthlyListColumnKey[]): MonthlyListColumnKey[] {
    const valid = new Set<string>(ALL_MONTHLY_LIST_COLUMN_KEYS);
    const rest = cols.filter((col) => col !== 'displayName' && valid.has(col));
    return ['displayName', ...rest];
  }

  toggleOptionalColumn(key: MonthlyListColumnKey, checked: boolean): void {
    if (key === 'displayName') return;
    const current = this.visibleColumns();
    const keys = current.includes(key);
    if (checked && !keys) {
      this.visibleColumns.set(this.nomalizaColumns([...current, key]));
    } else if (!checked && keys) {
      this.visibleColumns.set(this.nomalizaColumns(current.filter((col) => col !== key)));
    }
  }

  isColumnVisible(key: MonthlyListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  reset(): void {
    this.visibleColumns.set([...DEFAULT_MONTHLY_LIST_COLUMNS]);
  }
}
