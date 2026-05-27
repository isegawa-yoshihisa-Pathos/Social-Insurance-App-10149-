import { Injectable, computed, inject, signal } from '@angular/core';
import { Firestore, getDoc, updateDoc, doc, serverTimestamp, getDocs, query, collection, where } from '@angular/fire/firestore';
import { AffiliationDocument, AccountDocument } from './document-interfaces';

@Injectable({
  providedIn: 'root',
})
export class CurrentTenantService {
  private readonly firestore = inject(Firestore);
  
  readonly affiliations = signal<AffiliationDocument[]>([]);
  readonly currentTid = signal<string | null>(null);
  readonly loading = signal<boolean>(false);

  readonly currentAffiliation = computed(() => {
    const tid = this.currentTid();
    return tid ? this.affiliations().find((aff) => aff.tid === tid) ?? null : null;
  })

  readonly isAdmin = computed(
    () => this.currentAffiliation()?.role === 'admin',
  );

  async bootstrap(uid: string): Promise<void> {
    if (this.currentTid() !== null) return;
    await this.loadAffiliations(uid);
  }

  signOut(): void {
    this.affiliations.set([]);
    this.currentTid.set(null);
  }
  
  getCurrentAffiliation(): AffiliationDocument | null {
    return this.currentAffiliation();
  }

  async setTenant(uid: string, tid: string): Promise<void> {
    const affiliation = this.affiliations().find(
      (aff) => aff.uid === uid && aff.tid === tid,
    );
    if (!affiliation) {
      throw new Error('この事業所への所属が見つかりません。');
    }

    await updateDoc(doc(this.firestore, 'accounts', uid), {
      currentTenantId: tid,
      lastView: serverTimestamp(),
    });

    this.currentTid.set(tid);
  }

  private async loadAffiliations(uid: string): Promise<void> {
    this.loading.set(true);

    try {
      const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
      if (!accountSnap.exists()) {
        throw new Error('アカウントが見つかりません。');
      }
      const accountData = accountSnap.data() as AccountDocument;

      const affilationsSnap = await getDocs(
        query(
          collection(this.firestore, 'affiliations'),
          where('uid', '==', uid),
        ),
      );

      const affiliations = affilationsSnap.docs.map(
        (doc) => ({ ...doc.data() }) as AffiliationDocument,
      );

      this.affiliations.set(affiliations);

      const savedTid = accountData.currentTenantId;
      const validTid = affiliations.some((aff) => aff.tid === savedTid)
        ? savedTid
        : affiliations.length > 0
          ? affiliations[0].tid
          : null;

      this.currentTid.set(validTid);

      if(validTid && validTid !== savedTid) {
        await updateDoc(doc(this.firestore, 'accounts', uid), {
          currentTenantId: validTid,
          lastView: serverTimestamp(),
        });
      }
    } catch (error) {
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  updateAffiliationDisplayName(uid: string, tid: string, displayName: string): void {
    const affiliations = this.affiliations().map((aff) => {
      if (aff.uid !== uid || aff.tid !== tid) {
        return aff;
      }

      return {
        ...aff,
        displayName,
      };
    });

    this.affiliations.set(affiliations);
  }
}
