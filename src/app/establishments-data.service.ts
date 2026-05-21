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
    data: EstablishmentSavePayload,
  ): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const establishmentRef = doc(this.firestore, 'establishments', eid);
      await updateDoc(establishmentRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    });
  }
}