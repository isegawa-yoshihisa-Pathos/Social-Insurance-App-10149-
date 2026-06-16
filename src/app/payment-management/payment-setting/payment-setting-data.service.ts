import { EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { doc, Firestore, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { AllowanceTypeDefinition } from '../../payment-document';
import {
  DEFAULT_PAYMENT_LIST_COLUMNS,
  getAllPaymentListColumnKeys,
  PaymentListColumnKey,
  allowanceTypeForPaymentColumn,
  bonusTypeForPaymentColumn,
} from '../payment-list/payment-list-columns';
import { allowanceColumnKey } from '../payment-list/allowance-display.util';
import { PaymentManagementDataService } from '../payment-management-data.service';
import { BonusManagementDataService } from '../../bonus-management/bonus-management-data.service';
import { bonusColumnKey } from '../../bonus-management/bonus-list/bonus-display.util';
import { BonusTypeDefinition } from '../../bonus-document';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { normalizeVisibleColumnOrder } from '../../list-column-order.util';

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
  private readonly auditLog = inject(AuditLogService);

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
      this.setVisibleColumnsInternal(
        [...DEFAULT_PAYMENT_LIST_COLUMNS],
        allowanceDefinitions,
        bonusDefinitions,
      );
      this.listSettingsLoadedTid = tid;
      return;
    }

    const data = settingsSnap.data() as { visibleColumns?: PaymentListColumnKey[] };
    this.setVisibleColumnsInternal(
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

    await this.auditLog.recordUpdate({
      tid,
      category: 'settings.payment_list',
      summary: '給与一覧表示設定を更新',
      target: this.auditLog.settingsTarget('paymentListSetting', '給与一覧設定'),
      after: { visibleColumns: this.visibleColumns() },
    });
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

  setVisibleColumns(cols: PaymentListColumnKey[]): void {
    this.setVisibleColumnsInternal(
      cols,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  isColumnVisible(key: PaymentListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  reset(): void {
    this.importHeaders.set({});
    this.visibleColumns.set([...DEFAULT_PAYMENT_LIST_COLUMNS]);
    this.listSettingsLoadedTid = null;
  }

  private setVisibleColumnsInternal(
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
    return normalizeVisibleColumnOrder(cols, canonicalOrder, (col) =>
      this.resolveColumnKey(col, valid, allowanceDefinitions, bonusDefinitions),
    );
  }

  private resolveColumnKey(
    col: PaymentListColumnKey,
    valid: Set<string>,
    allowanceDefinitions: AllowanceTypeDefinition[],
    bonusDefinitions: BonusTypeDefinition[],
  ): PaymentListColumnKey | null {
    if (valid.has(col)) return col;

    const bonusType = bonusTypeForPaymentColumn(col, bonusDefinitions);
    if (bonusType && valid.has(bonusColumnKey(bonusType))) {
      return bonusColumnKey(bonusType) as PaymentListColumnKey;
    }

    const allowanceType = allowanceTypeForPaymentColumn(col, allowanceDefinitions);
    if (allowanceType && valid.has(allowanceColumnKey(allowanceType))) {
      return allowanceColumnKey(allowanceType) as PaymentListColumnKey;
    }

    return null;
  }

  private async loadPaymentDocument(tid: string): Promise<PaymentSettingDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'tenants', tid, 'settings', 'allowanceKindSetting');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as PaymentSettingDocument;
    });
  }
}
