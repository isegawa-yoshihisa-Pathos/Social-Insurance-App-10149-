import { computed, inject, Injectable, signal } from '@angular/core';
import { collection, doc, Firestore, limit, onSnapshot, orderBy, query, Unsubscribe, updateDoc } from '@angular/fire/firestore';

export type NotificationScope = 'tenant' | 'individual';

export interface AppNotification {
  id: string;
  scope: NotificationScope;
  type: string;
  jobId?: string;
  title?: string;
  body?: string;
  message?: string;
  read: boolean;
  createdAt: Date | null;
  totals?: { total: number; succeeded: number; failed: number };
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly firestore = inject(Firestore);
  private tenantUnsub: Unsubscribe | null = null;
  private individualUnsub: Unsubscribe | null = null;
  private currentTid: string | null = null;
  private currentUid: string | null = null;

  readonly tenantNotifications = signal<AppNotification[]>([]);
  readonly individualNotifications = signal<AppNotification[]>([]);

  readonly notifications = computed(() => {
    const merged = [...this.tenantNotifications(), ...this.individualNotifications()];
    return merged.sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  });

  readonly unreadCount = computed(
    () => this.notifications().filter((item) => !item.read).length,
  );

  subscribe(params: { uid: string; tid: string; isAdmin: boolean }): void {
    this.unsubscribe();
    this.currentUid = params.uid;
    this.currentTid = params.tid;

    this.subscribeIndividualNotifications(params.uid);
    if (params.isAdmin) {
      this.subscribeTenantNotifications(params.tid);
    }
  }

  async markAsRead(notification: AppNotification): Promise<void> {
    if (notification.read) {
      return;
    }
    if (notification.scope === 'tenant') {
      return;
    }
    if (!this.currentUid) {
      return;
    }

    const ref = doc(
      this.firestore,
      'accounts',
      this.currentUid,
      'notifications',
      notification.id,
    );
    await updateDoc(ref, { read: true });
  }

  unsubscribe(): void {
    this.tenantUnsub?.();
    this.individualUnsub?.();
    this.tenantUnsub = null;
    this.individualUnsub = null;
    this.currentTid = null;
    this.currentUid = null;
    this.tenantNotifications.set([]);
    this.individualNotifications.set([]);
  }

  private subscribeTenantNotifications(tid: string): void {
    const ref = collection(this.firestore, 'tenants', tid, 'notifications');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(30));
    this.tenantUnsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) =>
        this.mapNotificationDoc(d.id, d.data(), 'tenant'),
      );
      this.tenantNotifications.set(items);
    });
  }

  private subscribeIndividualNotifications(uid: string): void {
    const ref = collection(this.firestore, 'accounts', uid, 'notifications');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(30));
    this.individualUnsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) =>
        this.mapNotificationDoc(d.id, d.data(), 'individual'),
      );
      this.individualNotifications.set(items);
    });
  }

  private mapNotificationDoc(
    id: string,
    raw: any,
    scope: NotificationScope,
  ): AppNotification {
    return {
      id,
      scope,
      type: String(raw?.type ?? ''),
      jobId: raw?.jobId,
      title: raw?.title,
      body: raw?.body,
      message: raw?.message,
      read: !!raw?.read,
      totals: raw?.totals,
      createdAt: raw?.createdAt?.toDate?.() ?? null,
    };
  }
}