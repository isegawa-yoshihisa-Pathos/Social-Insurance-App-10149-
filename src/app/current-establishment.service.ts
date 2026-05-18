import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, where, getDocs, query } from '@angular/fire/firestore';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UserAffiliation {
  id: string;
  uid: string;
  eid: string;
  establishmentName: string;
  role: string;
  joinedAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class CurrentEstablishmentService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);
  
  private affiliations = new BehaviorSubject<UserAffiliation[]>([]);
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

  async fetchAffiliations(uid: string): Promise<UserAffiliation[]> {
    return runInInjectionContext(this.injector, async () => {
      const affiliationsRef = collection(this.firestore, 'affiliations');
      const q = query(affiliationsRef, where('uid', '==', uid));
      const snapshot = await getDocs(q);
      const affiliations = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as UserAffiliation),
      );
      this.affiliations.next(affiliations);
      return affiliations;
    });
  }

  resolveDefaultEid(affiliations: UserAffiliation[]): string | null {
    const savedEid = localStorage.getItem('stored_eid');
    const hasSavedEid = affiliations.some(aff => aff.eid === savedEid);
    if (savedEid && hasSavedEid) {
      return savedEid;
    }
    return affiliations.length > 0 ? affiliations[0].eid : null;
  }

  setEstablishment(eid: string): void {
    this.currentEid.next(eid);
    localStorage.setItem('stored_eid', eid);
  }

  getAffiliations(): UserAffiliation[] {
    return this.affiliations.value;
  }

  getEstablishment(): string | null {
    return this.currentEid.value;
  }

  getCurrentAffiliation(): UserAffiliation | null {
    const eid = this.getEstablishment();
    if (!eid) return null;
    return this.affiliations.value.find(aff => aff.eid === eid) || null;
  }
}
