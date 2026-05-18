import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  EstablishmentDocument,
  EstablishmentSavePayload,
} from './establishment-document';

@Injectable({
  providedIn: 'root',
})
export class EstablishmentsDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);

  async getAddress(zipcode: string): Promise<string> {
    const response = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`,
    );
    const data = await response.json();

    if (data.results) {
      const res = data.results[0];
      return `${res.address1}${res.address2}${res.address3}`;
    }
    throw new Error('住所が見つかりませんでした');
  }

  async loadEstablishment(eid: string): Promise<EstablishmentDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'establishments', eid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as EstablishmentDocument;
    });
  }

  async saveEstablishment(
    eid: string,
    uid: string,
    data: EstablishmentSavePayload,
  ): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const establishmentRef = doc(this.firestore, 'establishments', eid);
      await updateDoc(establishmentRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });

      const affiliationRef = doc(this.firestore, 'affiliations', `${uid}_${eid}`);
      await updateDoc(affiliationRef, {
        establishmentName: data.establishmentName,
      });
    });
  }
}