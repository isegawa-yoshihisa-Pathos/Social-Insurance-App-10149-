import { EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { doc, Firestore, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { BonusTypeDefinition } from '../../bonus-document';
import {
  buildDefaultImportHeaders,
  BonusImportFieldKey,
  StaticBonusImportFieldKey,
} from './bonus-import-columns';
import {
  DEFAULT_BONUS_LIST_COLUMNS,
  getAllBonusListColumnKeys,
  BonusListColumnKey,
} from '../bonus-list/bonus-list-columns';
import { bonusColumnKey, bonusTypeFromColumnKey } from '../bonus-list/bonus-display.util';
import { BonusManagementDataService } from '../bonus-management-data.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { normalizeVisibleColumnOrder } from '../../list-column-order.util';

export interface BonusSettingDocument {
  importHeaders?: Partial<Record<string, string>>;
  visibleColumns?: BonusListColumnKey[];

  /** @deprecated importHeaders へ移行 */
  basicSalaryHeader?: string;
  fringeBenefitsHeader?: string;
  overtimePayHeader?: string;
  commuterAllowanceHeader?: string;
  otherAllowanceHeader?: string;
  retroactivePayHeader?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BonusSettingDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly auditLog = inject(AuditLogService);

  readonly importHeaders = signal<Record<string, string>>({});
  readonly visibleColumns = signal<BonusListColumnKey[]>([
    ...DEFAULT_BONUS_LIST_COLUMNS,
  ]);
  readonly settingsLoading = signal(false);

  private listSettingsLoadedTid: string | null = null;

  async loadSettings(
    tid: string,
    bonusDefinitions: BonusTypeDefinition[],
  ): Promise<void> {
    this.settingsLoading.set(true);
    try {
      const doc = await this.loadBonusDocument(tid);
      const saved = doc?.importHeaders ?? {};
      this.importHeaders.set(mergeImportHeaders(saved, bonusDefinitions));
    } finally {
      this.settingsLoading.set(false);
    }
  }

  async loadListSettings(tid: string): Promise<void> {
    if (this.listSettingsLoadedTid === tid) {
      return;
    }

    await this.bonusManagementDataService.loadBonusSettings(tid);
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();

    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'bonusListSetting');
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      this.setVisibleColumnsInternal([...DEFAULT_BONUS_LIST_COLUMNS], bonusDefinitions);
      this.listSettingsLoadedTid = tid;
      return;
    }

    const data = settingsSnap.data() as { visibleColumns?: BonusListColumnKey[] };
    this.setVisibleColumnsInternal(
      data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_BONUS_LIST_COLUMNS],
      bonusDefinitions,
    );
    this.listSettingsLoadedTid = tid;
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'bonusListSetting');
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();

    await setDoc(settingsRef, {
      visibleColumns: this.normalizeColumns(this.visibleColumns(), bonusDefinitions),
      updatedAt: serverTimestamp(),
    });
    this.listSettingsLoadedTid = tid;

    await this.auditLog.recordUpdate({
      tid,
      category: 'settings.bonus_list',
      summary: '賞与一覧表示設定を更新',
      target: this.auditLog.settingsTarget('bonusListSetting', '賞与一覧設定'),
      after: { visibleColumns: this.visibleColumns() },
    });
  }

  syncVisibleColumnsForBonusTypes(): void {
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
    this.setVisibleColumnsInternal(this.visibleColumns(), bonusDefinitions);
  }

  toggleOptionalColumn(key: BonusListColumnKey, checked: boolean): void {
    const current = this.visibleColumns();
    const exists = current.includes(key);

    if (checked && !exists) {
      this.setVisibleColumns([...current, key]);
    } else if (!checked && exists) {
      this.setVisibleColumns(current.filter((col) => col !== key));
    }
  }

  setVisibleColumns(cols: BonusListColumnKey[]): void {
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
    this.setVisibleColumnsInternal(cols, bonusDefinitions);
  }

  isColumnVisible(key: BonusListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  setHeader(key: BonusImportFieldKey, header: string): void {
    this.importHeaders.update((prev) => ({ ...prev, [key]: header }));
  }

  reset(): void {
    this.importHeaders.set({});
    this.visibleColumns.set([...DEFAULT_BONUS_LIST_COLUMNS]);
    this.listSettingsLoadedTid = null;
  }

  private setVisibleColumnsInternal(
    cols: BonusListColumnKey[],
    bonusDefinitions: BonusTypeDefinition[] = this.bonusManagementDataService.bonusTypeDefinitions(),
  ): void {
    const normalized = this.normalizeColumns(cols, bonusDefinitions);
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
    cols: BonusListColumnKey[],
    bonusDefinitions: BonusTypeDefinition[],
  ): BonusListColumnKey[] {
    const canonicalOrder = getAllBonusListColumnKeys(bonusDefinitions);
    const valid = new Set<string>(canonicalOrder);
    return normalizeVisibleColumnOrder(cols, canonicalOrder, (col) => this.resolveColumnKey(col, valid));
  }

  private resolveColumnKey(
    col: BonusListColumnKey,
    valid: Set<string>,
  ): BonusListColumnKey | null {
    if (valid.has(col)) return col;

    const bonusType = bonusTypeFromColumnKey(col);
    if (bonusType && valid.has(bonusColumnKey(bonusType))) {
      return bonusColumnKey(bonusType) as BonusListColumnKey;
    }

    return null;
  }

  private async loadBonusDocument(tid: string): Promise<BonusSettingDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'tenants', tid, 'settings', 'bonusSetting');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as BonusSettingDocument;
    });
  }
}

export function mergeImportHeaders(
  saved: Partial<Record<string, string>>,
  bonusDefinitions: BonusTypeDefinition[],
): Record<string, string> {
  const defaults = buildDefaultImportHeaders(bonusDefinitions);
  const merged: Record<string, string> = { ...defaults };

  for (const [key, value] of Object.entries(saved)) {
    if (value?.trim()) {
      merged[key] = value.trim();
    }
  }

  return merged;
}