import { inject, Injectable, signal } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import {
  BonusTypeDefinition,
  DEFAULT_BONUS_TYPE_DEFINITIONS,
} from '../bonus-document';
import { normalizeBonusTypeDefinitions as normalizeBonusTypes } from './bonus-list/bonus-type.util';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable({
  providedIn: 'root',
})
export class BonusManagementDataService {
  private readonly firestore = inject(Firestore);
  private readonly auditLog = inject(AuditLogService);

  readonly bonusTypeDefinitions = signal<BonusTypeDefinition[]>([
    ...DEFAULT_BONUS_TYPE_DEFINITIONS,
  ]);

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

    await this.auditLog.recordUpdate({
      tid,
      category: 'settings.bonus_kind',
      summary: '賞与種類設定を更新',
      target: this.auditLog.settingsTarget('bonusSetting', '賞与種類設定'),
      after: { types: this.bonusTypeDefinitions() },
    });
  }

  setBonusTypeDefinitions(types: BonusTypeDefinition[]): void {
    this.bonusTypeDefinitions.set(this.normalizeBonusTypeDefinitions(types));
  }

  normalizeBonusTypeDefinitions(types: BonusTypeDefinition[]): BonusTypeDefinition[] {
    const normalized = normalizeBonusTypes(types);
    return normalized.length > 0 ? normalized : [...DEFAULT_BONUS_TYPE_DEFINITIONS];
  }

  reset(): void {
    this.bonusTypeDefinitions.set([...DEFAULT_BONUS_TYPE_DEFINITIONS]);
  }
}