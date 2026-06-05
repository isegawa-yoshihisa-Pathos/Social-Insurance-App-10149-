import { EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { doc, Firestore, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { AllowanceTypeDefinition } from '../../payment-document';
import {
  buildDefaultImportHeaders,
  PaymentImportFieldKey,
} from './payment-import-columns';
import {
  DEFAULT_PAYMENT_LIST_COLUMNS,
  getAllPaymentListColumnKeys,
  PaymentListColumnKey,
} from '../payment-list/payment-list-columns';
import { allowanceColumnKey, allowanceTypeFromColumnKey } from '../payment-list/allowance-display.util';
import { PaymentManagementDataService } from '../payment-management-data.service';
import { BonusManagementDataService } from '../../bonus-management/bonus-management-data.service';
import { bonusColumnKey, bonusTypeFromColumnKey } from '../../bonus-management/bonus-list/bonus-display.util';
import { BonusTypeDefinition } from '../../bonus-document';

export interface PaymentSettingDocument {
  types?: AllowanceTypeDefinition[];
  importHeaders?: Partial<Record<string, string>>;
  visibleColumns?: PaymentListColumnKey[];
}

@Injectable({
  providedIn: 'root',
})
export class PaymentSettingDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);

  readonly importHeaders = signal<Record<string, string>>({});
  readonly visibleColumns = signal<PaymentListColumnKey[]>([
    ...DEFAULT_PAYMENT_LIST_COLUMNS,
  ]);
  readonly settingsLoading = signal(false);

  private listSettingsLoadedTid: string | null = null;

  async loadSettings(tid: string): Promise<void> {
    this.settingsLoading.set(true);
    try {
      await this.paymentManagementDataService.loadPaymentSettings(tid);
      const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();
      const doc = await this.loadPaymentDocument(tid);
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

    await Promise.all([
      this.paymentManagementDataService.loadPaymentSettings(tid),
      this.bonusManagementDataService.loadBonusSettings(tid),
    ]);
    const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();

    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'paymentListSetting');
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      this.setVisibleColumns([...DEFAULT_PAYMENT_LIST_COLUMNS], allowanceDefinitions, bonusDefinitions);
      this.listSettingsLoadedTid = tid;
      return;
    }

    const data = settingsSnap.data() as { visibleColumns?: PaymentListColumnKey[] };
    this.setVisibleColumns(
      data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_PAYMENT_LIST_COLUMNS],
      allowanceDefinitions,
      bonusDefinitions,
    );
    this.listSettingsLoadedTid = tid;
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'paymentListSetting');
    const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();

    await setDoc(settingsRef, {
      visibleColumns: this.normalizeColumns(this.visibleColumns(), allowanceDefinitions, bonusDefinitions),
      updatedAt: serverTimestamp(),
    });
    this.listSettingsLoadedTid = tid;
  }

  syncVisibleColumnsForAllowanceTypes(): void {
    const allowanceDefinitions = this.paymentManagementDataService.allowanceTypeDefinitions();
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
    this.setVisibleColumns(this.visibleColumns(), allowanceDefinitions, bonusDefinitions);
    const tid = this.listSettingsLoadedTid;
    if (tid) {
      const defaults = buildDefaultImportHeaders(allowanceDefinitions);
      const current = this.importHeaders();
      const merged: Record<string, string> = { ...defaults };
      for (const [key, value] of Object.entries(current)) {
        if (value?.trim()) {
          merged[key] = value.trim();
        }
      }
      this.importHeaders.set(merged);
    }
  }

  toggleOptionalColumn(key: PaymentListColumnKey, checked: boolean): void {
    const current = this.visibleColumns();
    const exists = current.includes(key);

    if (checked && !exists) {
      this.setVisibleColumns([...current, key]);
    } else if (!checked && exists) {
      this.setVisibleColumns(current.filter((col) => col !== key));
    }
  }

  isColumnVisible(key: PaymentListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  setHeader(key: PaymentImportFieldKey, header: string): void {
    this.importHeaders.update((prev) => ({ ...prev, [key]: header }));
  }

  reset(): void {
    this.importHeaders.set({});
    this.visibleColumns.set([...DEFAULT_PAYMENT_LIST_COLUMNS]);
    this.listSettingsLoadedTid = null;
  }

  private setVisibleColumns(
    cols: PaymentListColumnKey[],
    allowanceDefinitions: AllowanceTypeDefinition[] = this.paymentManagementDataService.allowanceTypeDefinitions(),
    bonusDefinitions: BonusTypeDefinition[] = this.bonusManagementDataService.bonusTypeDefinitions(),
  ): void {
    const normalized = this.normalizeColumns(cols, allowanceDefinitions, bonusDefinitions);
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
    cols: PaymentListColumnKey[],
    allowanceDefinitions: AllowanceTypeDefinition[],
    bonusDefinitions: BonusTypeDefinition[],
  ): PaymentListColumnKey[] {
    const canonicalOrder = getAllPaymentListColumnKeys(allowanceDefinitions, bonusDefinitions);
    const valid = new Set<string>(canonicalOrder);
    const selected = new Set<PaymentListColumnKey>();

    for (const col of cols) {
      const resolved = this.resolveColumnKey(col, valid, allowanceDefinitions, bonusDefinitions);
      if (resolved) {
        selected.add(resolved);
      }
    }

    return canonicalOrder.filter((col) => selected.has(col));
  }

  private resolveColumnKey(
    col: PaymentListColumnKey,
    valid: Set<string>,
    allowanceDefinitions: AllowanceTypeDefinition[],
    bonusDefinitions: BonusTypeDefinition[],
  ): PaymentListColumnKey | null {
    if (valid.has(col)) return col;

    const allowanceType = allowanceTypeFromColumnKey(col);
    if (allowanceType && valid.has(allowanceColumnKey(allowanceType))) {
      return allowanceColumnKey(allowanceType) as PaymentListColumnKey;
    }

    const bonusType = bonusTypeFromColumnKey(col);
    if (bonusType && valid.has(bonusColumnKey(bonusType))) {
      return bonusColumnKey(bonusType) as PaymentListColumnKey;
    }

    return null;
  }

  private async loadPaymentDocument(tid: string): Promise<PaymentSettingDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'tenants', tid, 'settings', 'paymentSetting');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as PaymentSettingDocument;
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
