import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { SocialInsuranceCalculationService } from './social-insurance-calculation.service';

@Injectable({ providedIn: 'root' })
export class BonusPremiumBatchService {
  private readonly firestore = inject(Firestore);
  private readonly calculationService = inject(SocialInsuranceCalculationService);

  async calculateBonus(tid: string, yyyyMm: string): Promise<{ processed: number; errors: string[] }> {
    const bonusRef = collection(
      this.firestore, 'tenants', tid, 'bonus-records', yyyyMm, 'employees',
    );
    const snap = await getDocs(bonusRef);
    let processed = 0;
    const errors: string[] = [];

    for (const docSnap of snap.docs) {
      try {
        await this.calculationService.calculateAndPersist(tid, docSnap.id, yyyyMm);
        processed++;
      } catch (e) {
        errors.push(`${docSnap.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { processed, errors };
  }
}