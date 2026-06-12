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

  formatDate (date: Date | null | undefined): string {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}年${month}月${day}日 ${hour}:${minute}`;
  }
}
