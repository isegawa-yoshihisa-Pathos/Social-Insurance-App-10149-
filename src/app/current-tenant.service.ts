import { Injectable, inject } from '@angular/core';
import { Firestore, getDoc, updateDoc, doc, serverTimestamp, getDocs, query, collection, where } from '@angular/fire/firestore';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AffiliationDocument, AccountDocument } from './document-interfaces';
import { Auth, authState } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class CurrentTenantService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  
  private affiliations = new BehaviorSubject<AffiliationDocument[]>([]);
  private currentTid = new BehaviorSubject<string | null>(null);
  private loading = new BehaviorSubject<boolean>(false);

  affiliations$ = this.affiliations.asObservable();
  currentTid$ = this.currentTid.asObservable();
  loading$ = this.loading.asObservable();

  currentAffiliation$ = combineLatest([
    this.affiliations$,
    this.currentTid$,
  ]).pipe(
    map(([affiliations, tid]) => 
      tid ? affiliations.find((aff) => aff.tid === tid) ?? null : null
    )
  );

  private lastUid: string | null = null;

  constructor() {
    authState(this.auth).subscribe((user) => {
      const uid = user?.uid ?? null;
      if (this.lastUid !== uid) {
        this.reset();
        this.lastUid = uid;
      }
    });
  }

  private reset(): void {
    this.affiliations.next([]);
    this.currentTid.next(null);
    this.loading.next(false);
  }

  async initialize(uid: string): Promise<void> {
    this.loading.next(true);

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
          where('status', '==', 'active'),
        ),
      );

      const affiliations = affilationsSnap.docs.map(
        (doc) => ({ ...doc.data() }) as AffiliationDocument,
      );

      this.affiliations.next(affiliations);

      const savedTid = accountData.currentTenantId;
      const validTid = affiliations.some((aff) => aff.tid === savedTid)
        ? savedTid
        : affiliations.length > 0
          ? affiliations[0].tid
          : null;

      this.currentTid.next(validTid);

      if(validTid && validTid !== savedTid) {
        await updateDoc(doc(this.firestore, 'accounts', uid), {
          currentTenantId: validTid,
          lastView: serverTimestamp(),
        });
      }
    } catch (error) {
      throw error;
    } finally {
      this.loading.next(false);
    }
  }

  async setTenant(uid: string, tid: string): Promise<void> {
    const affiliation = this.affiliations.value.find(
      (aff) => aff.uid === uid && aff.tid === tid && aff.status === 'active',
    );
    if (!affiliation) {
      throw new Error('この事業所への所属が見つかりません。');
    }

    await updateDoc(doc(this.firestore, 'accounts', uid), {
      currentTenantId: tid,
      lastView: serverTimestamp(),
    });

    this.currentTid.next(tid);
  }

  getAffiliations(): AffiliationDocument[] {
    return this.affiliations.value;
  }

  updateAffiliationDisplayName(uid: string, tid: string, displayName: string): void {
    const affiliations = this.affiliations.value.map((affiliation) => {
      if (affiliation.uid !== uid || affiliation.tid !== tid) {
        return affiliation;
      }

      return {
        ...affiliation,
        displayName,
      };
    });

    this.affiliations.next(affiliations);
  }

  getTenant(): string | null {
    return this.currentTid.value;
  }

  getCurrentAffiliation(): AffiliationDocument | null {
    const tid = this.getTenant();
    if (!tid) return null;
    return this.affiliations.value.find(aff => aff.tid === tid) || null;
  }
}
