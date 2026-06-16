import { EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { doc, Firestore, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { AllowanceTypeDefinition } from '../../payment-document';
import {
  buildDefaultImportHeaders,
  MonthlyImportFieldKey,
} from './monthly-import-columns';
import {
  DEFAULT_MONTHLY_LIST_COLUMNS,
  getAllMonthlyListColumnKeys,
  MonthlyListColumnKey,
} from '../monthly-list/monthly-list-columns';
import { allowanceColumnKey, allowanceTypeFromColumnKey } from '../../payment-management/payment-list/allowance-display.util';
import { PaymentManagementDataService } from '../../payment-management/payment-management-data.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { normalizeVisibleColumnOrder } from '../../list-column-order.util';

export interface MonthlySettingDocument {
  importHeaders?: Partial<Record<string, string>>;
  visibleColumns?: MonthlyListColumnKey[];
}

@Injectable({
  providedIn: 'root',
})
export class MonthlySettingDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly auditLog = inject(AuditLogService);

  readonly importHeaders = signal<Record<string, string>>({});
  readonly visibleColumns = signal<MonthlyListColumnKey[]>([
    ...DEFAULT_MONTHLY_LIST_COLUMNS,
  ]);
  readonly settingsLoading = signal(false);

  private listSettingsLoadedTid: string | null = null;

  async loadSettings(tid: string): Promise<void> {
    this.settingsLoading.set(true);
    try {
      await this.paymentManagementDataService.loadPaymentSettings(tid);
      const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();
      const doc = await this.loadMonthlyDocument(tid);
      const saved = doc?.importHeaders ?? {};
      this.importHeaders.set(mergeImportHeaders(saved, allowanceDefinitions));
    } finally {
      this.settingsLoading.set(false);
    }
  }

  async loadListSettings(tid: string): Promise<void> {
    if (this.listSettingsLoadedTid === tid) {
      return;
    }

    await this.paymentManagementDataService.loadPaymentSettings(tid);
    const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();

    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'monthlyListSetting');
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      this.setVisibleColumnsInternal([...DEFAULT_MONTHLY_LIST_COLUMNS], allowanceDefinitions);
      this.listSettingsLoadedTid = tid;
      return;
    }

    const data = settingsSnap.data() as { visibleColumns?: MonthlyListColumnKey[] };
    this.setVisibleColumnsInternal(
      data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_MONTHLY_LIST_COLUMNS],
      allowanceDefinitions,
    );
    this.listSettingsLoadedTid = tid;
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'monthlyListSetting');
    const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();

    await setDoc(settingsRef, {
      visibleColumns: this.normalizeColumns(this.visibleColumns(), allowanceDefinitions),
      updatedAt: serverTimestamp(),
    });
    this.listSettingsLoadedTid = tid;

    await this.auditLog.recordUpdate({
      tid,
      category: 'settings.monthly_list',
      summary: '月次一覧表示設定を更新',
      target: this.auditLog.settingsTarget('monthlyListSetting', '月次一覧設定'),
      after: { visibleColumns: this.visibleColumns() },
    });
  }

  toggleOptionalColumn(key: MonthlyListColumnKey, checked: boolean): void {
    const current = this.visibleColumns();
    const exists = current.includes(key);

    if (checked && !exists) {
      this.setVisibleColumns([...current, key]);
    } else if (!checked && exists) {
      this.setVisibleColumns(current.filter((col) => col !== key));
    }
  }

  setVisibleColumns(cols: MonthlyListColumnKey[]): void {
    const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();
    this.setVisibleColumnsInternal(cols, allowanceDefinitions);
  }

  isColumnVisible(key: MonthlyListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  setHeader(key: MonthlyImportFieldKey, header: string): void {
    this.importHeaders.update((prev) => ({ ...prev, [key]: header }));
  }

  reset(): void {
    this.importHeaders.set({});
    this.visibleColumns.set([...DEFAULT_MONTHLY_LIST_COLUMNS]);
    this.listSettingsLoadedTid = null;
  }

  private setVisibleColumnsInternal(
    cols: MonthlyListColumnKey[],
    allowanceDefinitions: AllowanceTypeDefinition[] = this.paymentManagementDataService.allowanceTypeDefinitions(),
  ): void {
    const normalized = this.normalizeColumns(cols, allowanceDefinitions);
    const current = this.visibleColumns();

    if (
      current.length === normalized.length &&
      current.every((col, index) => col === normalized[index])
    ) {
      return;
    }

    this.visibleColumns.set(normalized);
  }

  private normalizeColumns(
    cols: MonthlyListColumnKey[],
    allowanceDefinitions: AllowanceTypeDefinition[],
  ): MonthlyListColumnKey[] {
    const canonicalOrder = getAllMonthlyListColumnKeys(allowanceDefinitions);
    return normalizeVisibleColumnOrder(
      cols,
      canonicalOrder,
      (col) => this.resolveColumnKey(col, new Set(canonicalOrder), allowanceDefinitions),
    );
  }

  private resolveColumnKey(
    col: MonthlyListColumnKey,
    valid: Set<string>,
    allowanceDefinitions: AllowanceTypeDefinition[],
  ): MonthlyListColumnKey | null {
    if (valid.has(col)) return col;

    const allowanceType = allowanceTypeFromColumnKey(col);
    if (allowanceType && valid.has(allowanceColumnKey(allowanceType))) {
      return allowanceColumnKey(allowanceType) as MonthlyListColumnKey;
    }

    return null;
  }

  private async loadMonthlyDocument(tid: string): Promise<MonthlySettingDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'tenants', tid, 'settings', 'monthlySetting');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as MonthlySettingDocument;
    });
  }
}

export function mergeImportHeaders(
  saved: Partial<Record<string, string>>,
  allowanceDefinitions: AllowanceTypeDefinition[],
): Record<string, string> {
  const defaults = buildDefaultImportHeaders(allowanceDefinitions);
  const merged: Record<string, string> = { ...defaults };

  for (const [key, value] of Object.entries(saved)) {
    if (value?.trim()) {
      merged[key] = value.trim();
    }
  }

  return merged;
}
