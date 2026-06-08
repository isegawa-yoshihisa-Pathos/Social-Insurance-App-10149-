import { Component, inject } from '@angular/core';
import { TenantNotificationCmp } from './tenant-notification/tenant-notification.cmp';
import { IndividualNotificationCmp } from './individual-notification/individual-notification.cmp';
import { CurrentTenantService } from '../current-tenant.service';

@Component({
  selector: 'app-notifications',
  imports: [TenantNotificationCmp, IndividualNotificationCmp],
  templateUrl: './notifications.cmp.html',
  styleUrl: './notifications.cmp.css',
})
export class NotificationsCmp {
  readonly tenant = inject(CurrentTenantService);

  readonly isAdmin = this.tenant.isAdmin();

}
