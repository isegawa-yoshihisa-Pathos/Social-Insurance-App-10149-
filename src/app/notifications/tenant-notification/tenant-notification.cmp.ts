import { Component, inject } from '@angular/core';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-tenant-notification',
  imports: [],
  templateUrl: './tenant-notification.cmp.html',
  styleUrl: './tenant-notification.cmp.css',
})
export class TenantNotificationCmp {
  readonly notificationService = inject(NotificationService);

  deleteNotification(notificationId: string): void {
    this.notificationService.deleteNotification(notificationId);
  }
}
