import { inject, Injectable, signal } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import {
  BonusTypeDefinition,
  DEFAULT_BONUS_TYPE_DEFINITIONS,
} from '../monthly-document';
import {
  DEFAULT_MONTHLY_LIST_COLUMNS,
  getAllMonthlyListColumnKeys,
  MonthlyListColumnKey,
} from './monthly-list/monthly-list-columns';
import { normalizeBonusTypeDefinitions as normalizeBonusTypes } from './monthly-list/bonus-type.util';
import { bonusColumnKey, bonusTypeFromColumnKey } from './monthly-list/bonus-display.util';

@Injectable({
  providedIn: 'root',
})
export class MonthlyManagementDataService {
  private readonly firestore = inject(Firestore);

  readonly visibleColumns = signal<MonthlyListColumnKey[]>([
    ...DEFAULT_MONTHLY_LIST_COLUMNS,
  ]);

  readonly bonusTypeDefinitions = signal<BonusTypeDefinition[]>([
    ...DEFAULT_BONUS_TYPE_DEFINITIONS,
  ]);

  private listSettingsLoadedTid: string | null = null;

  async loadListSettings(tid: string): Promise<void> {
    if (this.listSettingsLoadedTid === tid) {
      return;
    }

    await this.loadBonusSettings(tid);

    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'monthlyListSetting');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      this.setVisibleColumns([...DEFAULT_MONTHLY_LIST_COLUMNS]);
      this.listSettingsLoadedTid = tid;
      return;
    }
    const data = settingsSnap.data() as { visibleColumns: MonthlyListColumnKey[] };
    this.setVisibleColumns(
      data.visibleColumns?.length ? data.visibleColumns : [...DEFAULT_MONTHLY_LIST_COLUMNS],
    );
    this.listSettingsLoadedTid = tid;
  }

  async saveListSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'monthlyListSetting');
    await setDoc(settingsRef, {
      visibleColumns: this.nomalizaColumns(this.visibleColumns()),
      updatedAt: serverTimestamp(),
    });
    this.listSettingsLoadedTid = tid;
  }

  async loadBonusSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'bonusSetting');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      this.bonusTypeDefinitions.set([...DEFAULT_BONUS_TYPE_DEFINITIONS]);
      return;
    }
    const data = settingsSnap.data() as { types?: BonusTypeDefinition[] };
    this.bonusTypeDefinitions.set(
      this.normalizeBonusTypeDefinitions(data.types ?? []),
    );
  }

  async saveBonusSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'bonusSetting');
    await setDoc(settingsRef, {
      types: this.normalizeBonusTypeDefinitions(this.bonusTypeDefinitions()),
      updatedAt: serverTimestamp(),
    });
  }

  setBonusTypeDefinitions(types: BonusTypeDefinition[]): void {
    this.bonusTypeDefinitions.set(this.normalizeBonusTypeDefinitions(types));
    this.setVisibleColumns(this.visibleColumns());
  }

  private setVisibleColumns(cols: MonthlyListColumnKey[]): void {
    const normalized = this.nomalizaColumns(cols);
    const current = this.visibleColumns();
    if (
      current.length === normalized.length &&
      current.every((col, index) => col === normalized[index])
    ) {
      return;
    }
    this.visibleColumns.set(normalized);
  }

  normalizeBonusTypeDefinitions(types: BonusTypeDefinition[]): BonusTypeDefinition[] {
    const normalized = normalizeBonusTypes(types);
    return normalized.length > 0 ? normalized : [...DEFAULT_BONUS_TYPE_DEFINITIONS];
  }

  nomalizaColumns(cols: MonthlyListColumnKey[]): MonthlyListColumnKey[] {
    const canonicalOrder = getAllMonthlyListColumnKeys(this.bonusTypeDefinitions());
    const valid = new Set<string>(canonicalOrder);
    const selected = new Set<MonthlyListColumnKey>();

    for (const col of cols) {
      const resolved = this.resolveColumnKey(col, valid);
      if (resolved && resolved !== 'displayName') {
        selected.add(resolved);
      }
    }

    return canonicalOrder.filter((col) => col === 'displayName' || selected.has(col));
  }

  private resolveColumnKey(
    col: MonthlyListColumnKey,
    valid: Set<string>,
  ): MonthlyListColumnKey | null {
    if (valid.has(col)) return col;

    const bonusType = bonusTypeFromColumnKey(col);
    if (bonusType && valid.has(bonusColumnKey(bonusType))) {
      return bonusColumnKey(bonusType);
    }

    return null;
  }

  toggleOptionalColumn(key: MonthlyListColumnKey, checked: boolean): void {
    if (key === 'displayName') return;
    const current = this.visibleColumns();
    const keys = current.includes(key);
    if (checked && !keys) {
      this.setVisibleColumns([...current, key]);
    } else if (!checked && keys) {
      this.setVisibleColumns(current.filter((col) => col !== key));
    }
  }

  isColumnVisible(key: MonthlyListColumnKey): boolean {
    return this.visibleColumns().includes(key);
  }

  reset(): void {
    this.visibleColumns.set([...DEFAULT_MONTHLY_LIST_COLUMNS]);
    this.bonusTypeDefinitions.set([...DEFAULT_BONUS_TYPE_DEFINITIONS]);
    this.listSettingsLoadedTid = null;
  }
}
