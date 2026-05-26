import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  TenantDocument,
  TenantSavePayload,
} from './tenant-document';

@Injectable({
  providedIn: 'root',
})
export class TenantsDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);

  async loadTenant(tid: string): Promise<TenantDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'tenants', tid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as TenantDocument;
    });
  }

  async saveTenant(
    tid: string,
    data: TenantSavePayload,
  ): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const tenantRef = doc(this.firestore, 'tenants', tid);
      await updateDoc(tenantRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    });
  }
}