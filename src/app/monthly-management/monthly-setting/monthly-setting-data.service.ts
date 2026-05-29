import { EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';
import { BonusTypeDefinition } from '../../monthly-document';
import {
  buildDefaultImportHeaders,
  MonthlyImportFieldKey,
  StaticMonthlyImportFieldKey,
} from './monthly-import-columns';

export interface MonthlySettingDocument {
  importHeaders?: Partial<Record<string, string>>;
  /** @deprecated importHeaders へ移行 */
  basicSalaryHeader?: string;
  overtimePayHeader?: string;
  commuterAllowanceHeader?: string;
  otherAllowanceHeader?: string;
  retroactivePayHeader?: string;
}

const LEGACY_HEADER_KEYS: {
  docKey: keyof Pick<
    MonthlySettingDocument,
    | 'basicSalaryHeader'
    | 'overtimePayHeader'
    | 'commuterAllowanceHeader'
    | 'otherAllowanceHeader'
    | 'retroactivePayHeader'
  >;
  fieldKey: StaticMonthlyImportFieldKey;
}[] = [
  { docKey: 'basicSalaryHeader', fieldKey: 'basicSalary' },
  { docKey: 'overtimePayHeader', fieldKey: 'overtimePay' },
  { docKey: 'commuterAllowanceHeader', fieldKey: 'commuterAllowance' },
  { docKey: 'otherAllowanceHeader', fieldKey: 'otherAllowance' },
  { docKey: 'retroactivePayHeader', fieldKey: 'retroactivePay' },
];

@Injectable({
  providedIn: 'root',
})
export class MonthlySettingDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);

  readonly importHeaders = signal<Record<string, string>>({});
  readonly settingsLoading = signal(false);

  async loadSettings(
    tid: string,
    bonusDefinitions: BonusTypeDefinition[],
  ): Promise<void> {
    this.settingsLoading.set(true);
    try {
      const doc = await this.loadMonthlyDocument(tid);
      const saved = doc ? extractImportHeadersFromDocument(doc) : {};
      this.importHeaders.set(mergeImportHeaders(saved, bonusDefinitions));
    } finally {
      this.settingsLoading.set(false);
    }
  }

  syncHeadersForBonusTypes(bonusDefinitions: BonusTypeDefinition[]): void {
    this.importHeaders.set(mergeImportHeaders(this.importHeaders(), bonusDefinitions));
  }

  getHeader(
    key: MonthlyImportFieldKey,
    bonusDefinitions: BonusTypeDefinition[] = [],
  ): string {
    const defaults = buildDefaultImportHeaders(bonusDefinitions);
    return this.importHeaders()[key] ?? defaults[key] ?? key;
  }

  setHeader(key: MonthlyImportFieldKey, header: string): void {
    this.importHeaders.update((prev) => ({ ...prev, [key]: header }));
  }

  reset(): void {
    this.importHeaders.set({});
  }

  async loadMonthlyDocument(tid: string): Promise<MonthlySettingDocument | null> {
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

function extractImportHeadersFromDocument(
  doc: MonthlySettingDocument,
): Partial<Record<string, string>> {
  const headers: Partial<Record<string, string>> = { ...(doc.importHeaders ?? {}) };

  for (const { docKey, fieldKey } of LEGACY_HEADER_KEYS) {
    const legacy = doc[docKey];
    if (legacy?.trim() && headers[fieldKey] == null) {
      headers[fieldKey] = legacy.trim();
    }
  }

  return headers;
}
