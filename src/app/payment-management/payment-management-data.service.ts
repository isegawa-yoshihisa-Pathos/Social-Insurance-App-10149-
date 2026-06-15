import { inject, Injectable, signal } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import {
  AllowanceTypeDefinition,
  DEFAULT_ALLOWANCE_TYPE_DEFINITIONS,
} from '../payment-document';
import { normalizeAllowanceTypeDefinitions } from './payment-list/allowance-type.util';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable({
  providedIn: 'root',
})
export class PaymentManagementDataService {
  private readonly firestore = inject(Firestore);
  private readonly auditLog = inject(AuditLogService);

  readonly allowanceTypeDefinitions = signal<AllowanceTypeDefinition[]>([
    ...DEFAULT_ALLOWANCE_TYPE_DEFINITIONS,
  ]);

  async loadPaymentSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'allowanceKindSetting');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      this.allowanceTypeDefinitions.set([...DEFAULT_ALLOWANCE_TYPE_DEFINITIONS]);
      return;
    }
    const data = settingsSnap.data() as { types?: AllowanceTypeDefinition[] };
    this.allowanceTypeDefinitions.set(
      this.normalizeAllowanceTypeDefinitions(data.types ?? []),
    );
  }

  async savePaymentSettings(tid: string): Promise<void> {
    const settingsRef = doc(this.firestore, 'tenants', tid, 'settings', 'allowanceKindSetting');
    await setDoc(
      settingsRef,
      {
        types: this.normalizeAllowanceTypeDefinitions(this.allowanceTypeDefinitions()),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await this.auditLog.recordUpdate({
      tid,
      category: 'settings.allowance_kind',
      summary: '手当種類設定を更新',
      target: this.auditLog.settingsTarget('allowanceKindSetting', '手当種類設定'),
      after: { types: this.allowanceTypeDefinitions() },
    });
  }

  setAllowanceTypeDefinitions(types: AllowanceTypeDefinition[]): void {
    this.allowanceTypeDefinitions.set(this.normalizeAllowanceTypeDefinitions(types));
  }

  normalizeAllowanceTypeDefinitions(types: AllowanceTypeDefinition[]): AllowanceTypeDefinition[] {
    const normalized = normalizeAllowanceTypeDefinitions(types);
    return normalized.length > 0 ? normalized : [...DEFAULT_ALLOWANCE_TYPE_DEFINITIONS];
  }

  reset(): void {
    this.allowanceTypeDefinitions.set([...DEFAULT_ALLOWANCE_TYPE_DEFINITIONS]);
  }
}
