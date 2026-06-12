import { Component, inject } from '@angular/core';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-personal-notification',
  imports: [],
  templateUrl: './personal-notification.cmp.html',
  styleUrl: './personal-notification.cmp.css',
})
export class PersonalNotificationCmp {
  readonly notificationService = inject(NotificationService);
  
  deleteNotification(notificationId: string): void {
    this.notificationService.deleteNotification(notificationId);
  }
}
