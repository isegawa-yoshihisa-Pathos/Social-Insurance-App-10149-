import { computed, inject, Injectable, signal, WritableSignal } from '@angular/core';
import {
  collection,
  Firestore,
  onSnapshot,
  query,
  Unsubscribe,
  where,
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class TaskBoardBadgeService {
  private readonly firestore = inject(Firestore);
  private unsubs: Unsubscribe[] = [];

  private readonly pendingEmployeeConsentCount = signal(0);
  private readonly pendingApplicationCount = signal(0);
  private readonly pendingAdminConsentCount = signal(0);

  readonly pendingCount = computed(() => {
    return (
      this.pendingEmployeeConsentCount() +
      this.pendingApplicationCount() +
      this.pendingAdminConsentCount()
    );
  });

  subscribe(params: { tid: string; eid: string | null; isAdmin: boolean }): void {
    this.unsubscribe();

    if (params.eid) {
      this.watchCollectionCount(
        query(
          collection(this.firestore, 'tenants', params.tid, 'remunerationConsentReviews'),
          where('eid', '==', params.eid),
          where('status', '==', 'pending_employee_consent'),
        ),
        this.pendingEmployeeConsentCount,
      );
    }

    if (!params.isAdmin) {
      return;
    }

    this.watchCollectionCount(
      query(
        collection(this.firestore, 'tenants', params.tid, 'applications'),
        where('status', '==', 'pending'),
      ),
      this.pendingApplicationCount,
    );

    this.watchCollectionCount(
      query(
        collection(this.firestore, 'tenants', params.tid, 'remunerationConsentReviews'),
        where('status', '==', 'pending_admin_review'),
      ),
      this.pendingAdminConsentCount,
    );
  }

  unsubscribe(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
    this.pendingEmployeeConsentCount.set(0);
    this.pendingApplicationCount.set(0);
    this.pendingAdminConsentCount.set(0);
  }

  private watchCollectionCount(q: ReturnType<typeof query>, countSignal: WritableSignal<number>): void {
    this.unsubs.push(
      onSnapshot(q, (snap) => {
        countSignal.set(snap.size);
      }),
    );
  }
}
