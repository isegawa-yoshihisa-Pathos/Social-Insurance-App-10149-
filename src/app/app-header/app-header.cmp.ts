import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RoutesService } from '../routes.service';
import { AuthService } from '../auth.service';
import { CurrentTenantService } from '../current-tenant.service';
import { ProfileCompletionService } from '../profile-completion.service';
import { PersonalSettingDataService } from '../personal-setting/personal-setting-data.service';
import { TenantSettingDataService } from '../tenant-setting/tenant-setting-data.service';
import { EmployeeDetailDataService } from '../employees-management/employees-list/employee-detail/employee-detail-data.service';
import { InvitationDataService } from '../invitations-management/invitation-data.service';
import { EmployeesManagementDataService } from '../employees-management/employees-management-data.service';
import { AppNotification, NotificationService } from '../notifications/notification.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './app-header.cmp.html',
  styleUrl: './app-header.cmp.css',
})
export class AppHeaderCmp {
  private readonly routesService = inject(RoutesService);
  private readonly authService = inject(AuthService);
  readonly auth = inject(Auth);
  readonly currentTenantService = inject(CurrentTenantService);
  readonly profileCompletionService = inject(ProfileCompletionService);
  readonly personalSettingDataService = inject(PersonalSettingDataService);
  readonly tenantSettingDataService = inject(TenantSettingDataService);
  readonly employeeDetailDataService = inject(EmployeeDetailDataService);
  readonly invitationDataService = inject(InvitationDataService);
  readonly currentAffiliation = this.currentTenantService.currentAffiliation;
  readonly employeesManagementDataService = inject(EmployeesManagementDataService);
  readonly notificationService = inject(NotificationService);

  constructor() {
    effect((onCleanup) => {
      const uid = this.authService.uid();
      const tid = this.currentTenantService.currentTid();
      const isAdmin = this.currentTenantService.isAdmin();
      if (!uid || !tid) {
        this.notificationService.unsubscribe();
        return;
      }
      this.notificationService.subscribe({ uid, tid, isAdmin });
      onCleanup(() => this.notificationService.unsubscribe());
    });
  }

  async switchTenant(tid: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      this.routesService.redirectToHome();
      return;
    }
    await this.currentTenantService.setTenant(user.uid, tid);
    await this.personalSettingDataService.reloadForTenantChange();
    await this.tenantSettingDataService.reloadForTenantChange();
    this.invitationDataService.reset();
    this.routesService.redirectToMainPage();
  }

  multipleAffiliations(): boolean {
    return this.currentTenantService.affiliations().length > 1;
  }

  signOut(): void {
    this.authService.signOut();
    this.currentTenantService.signOut();
    this.profileCompletionService.signOut();
    this.personalSettingDataService.signOut();
    this.tenantSettingDataService.signOut();
    this.employeeDetailDataService.signOut();
    this.invitationDataService.reset();
    this.notificationService.unsubscribe();
    this.employeesManagementDataService.reset();
    this.routesService.redirectToHome();
  }

  navigateToHome(): void {
    if (this.auth.currentUser) {
      this.routesService.redirectToMainPage();
    } else {
      this.routesService.redirectToHome();
    }
  }

  navigateToSignin(): void {
    this.routesService.redirectToSignin();
  }

  navigateToSignup(): void {
    this.routesService.redirectToSignup();
  }

  navigateToPersonalSetting(): void {
    if (this.currentTenantService.affiliations().length === 1) {
      this.routesService.redirectToEmployeeSetting();
    } else {
      this.routesService.redirectToPersonalSetting();
    }
  }

  async readNotification(notification: AppNotification): Promise<void> {
    await this.notificationService.markAsRead(notification);
    this.routesService.redirectToNotifications();
  }

  notificationMessage(notification: AppNotification): string {
    return notification.body || notification.message || '';
  }
}
