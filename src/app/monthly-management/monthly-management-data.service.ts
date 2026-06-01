import { inject, Injectable, signal } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import {
  BonusTypeDefinition,
  DEFAULT_BONUS_TYPE_DEFINITIONS,
} from '../monthly-document';
import { normalizeBonusTypeDefinitions as normalizeBonusTypes } from './monthly-list/bonus-type.util';

@Injectable({
  providedIn: 'root',
})
export class MonthlyManagementDataService {
  private readonly firestore = inject(Firestore);

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