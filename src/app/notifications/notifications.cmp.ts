import { Component, effect, inject } from '@angular/core';
import { TenantNotificationCmp } from './tenant-notification/tenant-notification.cmp';
import { PersonalNotificationCmp } from './personal-notification/personal-notification.cmp';
import { CurrentTenantService } from '../current-tenant.service';
import { Auth } from '@angular/fire/auth';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-notifications',
  imports: [TenantNotificationCmp, PersonalNotificationCmp],
  templateUrl: './notifications.cmp.html',
  styleUrl: './notifications.cmp.css',
})
export class NotificationsCmp {
  readonly tenant = inject(CurrentTenantService);
  readonly isAdmin = this.tenant.isAdmin();
  readonly auth = inject(Auth);
  readonly notificationService = inject(NotificationService);

  constructor() {
    effect((onCleanup) => {
      const uid = this.auth.currentUser?.uid;
      const tid = this.tenant.currentTid();
      const isAdmin = this.tenant.isAdmin();
      if (!uid || !tid) {
        this.notificationService.unsubscribe();
        return;
      }
      this.notificationService.subscribe({ uid, tid, isAdmin });
      onCleanup(() => this.notificationService.unsubscribe());
    });
  }
}
