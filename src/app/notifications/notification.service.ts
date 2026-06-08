import { computed, inject, Injectable, signal } from '@angular/core';
import { collection, doc, Firestore, limit, onSnapshot, orderBy, query, Unsubscribe, updateDoc, where } from '@angular/fire/firestore';

export type NotificationScope = 'tenant' | 'personal';

export interface AppNotification {
  id: string;
  scope: NotificationScope;
  type: string;
  jobId?: string;
  title?: string;
  body?: string;
  message?: string;
  tid?: string;
  read: boolean;
  createdAt: Date | null;
  totals?: { total: number; succeeded: number; failed: number };
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly firestore = inject(Firestore);
  private tenantUnsub: Unsubscribe | null = null;
  private personalUnsub: Unsubscribe | null = null;
  private currentTid: string | null = null;
  private currentUid: string | null = null;

  readonly tenantNotifications = signal<AppNotification[]>([]);
  readonly personalNotifications = signal<AppNotification[]>([]);

  readonly notifications = computed(() => {
    const merged = [...this.tenantNotifications(), ...this.personalNotifications()];
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

    this.subscribePersonalNotifications(params.uid);
    if (params.isAdmin) {
      this.subscribeTenantNotifications(params.uid, params.tid);
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
    this.personalUnsub?.();
    this.tenantUnsub = null;
    this.personalUnsub = null;
    this.currentTid = null;
    this.currentUid = null;
    this.tenantNotifications.set([]);
    this.personalNotifications.set([]);
  }

  private subscribeTenantNotifications(uid: string, tid: string): void {
    const ref = collection(this.firestore, 'accounts', uid, 'notifications');
    const q = query(ref, where('scope', '==', 'tenant'), where('tid', '==', tid), orderBy('createdAt', 'desc'), limit(30));
    this.tenantUnsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) =>
        this.mapNotificationDoc(d.id, d.data()),
      );
      this.tenantNotifications.set(items);
    });
  }

  private subscribePersonalNotifications(uid: string): void {
    const ref = collection(this.firestore, 'accounts', uid, 'notifications');
    const q = query(ref, where('scope', '==', 'personal'), orderBy('createdAt', 'desc'), limit(30));
    this.personalUnsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) =>
        this.mapNotificationDoc(d.id, d.data()),
      );
      this.personalNotifications.set(items);
    });
  }

  private mapNotificationDoc(
    id: string,
    raw: any,
  ): AppNotification {
    return {
      id,
      scope: raw?.scope as NotificationScope,
      type: String(raw?.type ?? ''),
      jobId: raw?.jobId,
      title: raw?.title,
      body: raw?.body,
      message: raw?.message,
      tid: raw?.tid,
      read: !!raw?.read,
      totals: raw?.totals,
      createdAt: raw?.createdAt?.toDate?.() ?? null,
    };
  }
}