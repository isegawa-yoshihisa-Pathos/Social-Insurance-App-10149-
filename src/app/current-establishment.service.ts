import { Injectable, inject } from '@angular/core';
import { Firestore, getDoc, updateDoc, doc, serverTimestamp, getDocs, query, collection, where } from '@angular/fire/firestore';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AffiliationDocument, AccountDocument } from './document-interfaces';

@Injectable({
  providedIn: 'root',
})
export class CurrentEstablishmentService {
  private readonly firestore = inject(Firestore);
  
  private affiliations = new BehaviorSubject<AffiliationDocument[]>([]);
  private currentEid = new BehaviorSubject<string | null>(null);
  private loading = new BehaviorSubject<boolean>(false);

  affiliations$ = this.affiliations.asObservable();
  currentEid$ = this.currentEid.asObservable();
  loading$ = this.loading.asObservable();

  currentAffiliation$ = combineLatest([
    this.affiliations$,
    this.currentEid$,
  ]).pipe(
    map(([affiliations, eid]) => 
      eid ? affiliations.find((aff) => aff.eid === eid) ?? null : null
    )
  );

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

      const savedEid = accountData.currentEstablishmentId;
      const validEid = affiliations.some((aff) => aff.eid === savedEid)
        ? savedEid
        : affiliations.length > 0
          ? affiliations[0].eid
          : null;

      this.currentEid.next(validEid);

      if(validEid && validEid !== savedEid) {
        await updateDoc(doc(this.firestore, 'accounts', uid), {
          currentEstablishmentId: validEid,
          lastView: serverTimestamp(),
        });
      }
    } catch (error) {
      throw error;
    } finally {
      this.loading.next(false);
    }
  }

  async setEstablishment(uid: string, eid: string): Promise<void> {
    const affiliation = this.affiliations.value.find(
      (aff) => aff.uid === uid && aff.eid === eid && aff.status === 'active',
    );
    if (!affiliation) {
      throw new Error('この事業所への所属が見つかりません。');
    }

    await updateDoc(doc(this.firestore, 'accounts', uid), {
      currentEstablishmentId: eid,
      lastView: serverTimestamp(),
    });

    this.currentEid.next(eid);
  }

  getAffiliations(): AffiliationDocument[] {
    return this.affiliations.value;
  }

  updateAffiliationDisplayName(uid: string, eid: string, displayName: string): void {
    const affiliations = this.affiliations.value.map((affiliation) => {
      if (affiliation.uid !== uid || affiliation.eid !== eid) {
        return affiliation;
      }

      return {
        ...affiliation,
        displayName,
      };
    });

    this.affiliations.next(affiliations);
  }

  getEstablishment(): string | null {
    return this.currentEid.value;
  }

  getCurrentAffiliation(): AffiliationDocument | null {
    const eid = this.getEstablishment();
    if (!eid) return null;
    return this.affiliations.value.find(aff => aff.eid === eid) || null;
  }
}
