import { EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';
import { buildDefaultEmployeesImportHeaders, EmployeesImportFieldKey } from './employees-import-columns';

export interface EmployeesSettingDocument {
  importHeaders?: Partial<Record<string, string>>;
}

@Injectable({ providedIn: 'root' })
export class EmployeesSettingDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);

  readonly importHeaders = signal<Record<string, string>>({});
  readonly settingsLoading = signal(false);

  async loadSettings(tid: string): Promise<void> {
    this.settingsLoading.set(true);
    try {
      const doc = await this.loadDocument(tid);
      const defaults = buildDefaultEmployeesImportHeaders();
      const saved = doc?.importHeaders ?? {};
      this.importHeaders.set({
        ...defaults,
        ...Object.fromEntries(
          Object.entries(saved).map(([k, v]) => [k, (v ?? '').trim()]).filter(([, v]) => !!v),
        ),
      });
    } finally {
      this.settingsLoading.set(false);
    }
  }

  setHeader(key: EmployeesImportFieldKey, header: string): void {
    this.importHeaders.update((prev) => ({ ...prev, [key]: header }));
  }

  private async loadDocument(tid: string): Promise<EmployeesSettingDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'tenants', tid, 'settings', 'employeesSetting');
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as EmployeesSettingDocument) : null;
    });
  }
}