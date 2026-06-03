import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { InsuranceRateDocument, InsuranceRateSavePayload, ResolvedInsuranceRate, toResolvedInsuranceRate } from './social-insurance-document';
import { lastDayOfYyyyMm } from './social-insurance-data.util';

export interface InsuranceRateListItem {
  rateId: string;
  doc: InsuranceRateDocument;
}

@Injectable({ providedIn: 'root' })
export class InsuranceRateDataService {
  private readonly firestore = inject(Firestore);

  private ratesCollection(tid: string) {
    return collection(this.firestore, 'tenants', tid, 'insuranceRates');
  }

  async listRates(tid: string): Promise<InsuranceRateListItem[]> {
    const snap = await getDocs(this.ratesCollection(tid));
    const items = snap.docs.map((d) => ({
      rateId: d.id,
      doc: d.data() as InsuranceRateDocument,
    }));
    return items.sort((a, b) =>
      b.doc.effectiveFrom.localeCompare(a.doc.effectiveFrom),
    );
  }

  async addRate(tid: string, payload: InsuranceRateSavePayload): Promise<string> {
    const ref = doc(this.ratesCollection(tid));
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async resolveRate(
    tid: string,
    targetDate: string,
  ): Promise<ResolvedInsuranceRate | null> {
    const rows = await this.listRates(tid);
    const eligible = rows.filter((r) => r.doc.effectiveFrom <= targetDate);
    if (eligible.length === 0) return null;
    const best = eligible[0];
    return toResolvedInsuranceRate(best.rateId, best.doc);
  }

  async resolveRateForBonus(
    tid: string,
    yyyyMm: string,
  ): Promise<ResolvedInsuranceRate | null> {
    return this.resolveRate(tid, lastDayOfYyyyMm(yyyyMm));
  }
}