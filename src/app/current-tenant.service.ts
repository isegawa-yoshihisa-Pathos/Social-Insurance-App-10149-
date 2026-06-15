import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Firestore,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  collection,
  where,
} from '@angular/fire/firestore';
import { AffiliationDocument, AccountDocument } from './document-interfaces';
import { EmployeeDocument } from './employee-document';

@Injectable({
  providedIn: 'root',
})
export class CurrentTenantService {
  private readonly firestore = inject(Firestore);

  readonly affiliations = signal<AffiliationDocument[]>([]);
  readonly currentTid = signal<string | null>(null);
  /** Firestore employees ドキュメント ID */
  readonly currentEid = signal('');
  /** 社員番号（employeeEmployInfo.employeeId） */
  readonly currentEmployeeId = signal('');
  readonly loading = signal<boolean>(false);

  readonly currentAffiliation = computed(() => {
    const tid = this.currentTid();
    return tid ? this.affiliations().find((aff) => aff.tid === tid) ?? null : null;
  });

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
    this.currentEid.set('');
    this.currentEmployeeId.set('');
  }

  getCurrentAffiliation(): AffiliationDocument | null {
    return this.currentAffiliation();
  }

  async reloadAffiliations(uid: string): Promise<void> {
    await this.loadAffiliations(uid);
  }

  async reloadCurrentEmployeeId(uid: string): Promise<void> {
    await this.loadCurrentEmployeeId(uid, this.currentTid());
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
    await this.loadCurrentEmployeeId(uid, tid);
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
        (snap) => ({ ...snap.data() }) as AffiliationDocument,
      );

      this.affiliations.set(affiliations);

      const savedTid = accountData.currentTenantId;
      const validTid = affiliations.some((aff) => aff.tid === savedTid)
        ? savedTid
        : affiliations.length > 0
          ? affiliations[0].tid
          : null;

      this.currentTid.set(validTid);

      if (validTid && validTid !== savedTid) {
        await updateDoc(doc(this.firestore, 'accounts', uid), {
          currentTenantId: validTid,
          lastView: serverTimestamp(),
        });
      }

      await this.loadCurrentEmployeeId(uid, validTid, accountData);
    } catch (error) {
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCurrentEmployeeId(
    uid: string,
    tid: string | null,
    accountData?: AccountDocument,
  ): Promise<void> {
    if (!tid) {
      this.currentEid.set('');
      this.currentEmployeeId.set('');
      return;
    }

    let account = accountData;
    if (!account) {
      const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
      if (!accountSnap.exists()) {
        this.currentEid.set('');
        this.currentEmployeeId.set('');
        return;
      }
      account = accountSnap.data() as AccountDocument;
    }

    const affiliation = this.affiliations().find((aff) => aff.tid === tid);
    const eid = account.affiliations?.[tid] ?? affiliation?.eid;
    if (!eid) {
      this.currentEid.set('');
      this.currentEmployeeId.set('');
      return;
    }

    const employeeSnap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'employees', eid),
    );
    if (!employeeSnap.exists()) {
      this.currentEid.set('');
      this.currentEmployeeId.set('');
      return;
    }

    const data = employeeSnap.data() as Partial<EmployeeDocument>;
    this.currentEid.set(eid);
    this.currentEmployeeId.set(data.employeeEmployInfo?.employeeId ?? '');
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
