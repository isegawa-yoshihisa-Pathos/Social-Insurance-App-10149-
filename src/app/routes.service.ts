import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentTenantService } from './current-tenant.service';

@Injectable({
  providedIn: 'root',
})
export class RoutesService {
  readonly currentTenantService = inject(CurrentTenantService);
  constructor(private router: Router) {}

  redirectToHome(): void {
    void this.router.navigate(['/home']);
  }

  redirectToSignup(): void {
    void this.router.navigate(['/signup']);
  }

  redirectToSignin(): void {
    void this.router.navigate(['/signin']);
  }

  redirectToCreateTenant(): void {
    void this.router.navigate(['/create-tenant']);
  }

  redirectToCreateNewTenant(): void {
    void this.router.navigate(['/create-new-tenant']);
  }

  redirectToMainPage(): void {
    void this.router.navigate(['/main-page']);
  }

  redirectToTaskBoard(): void {
    void this.router.navigate(['/task-board']);
  }

  redirectToNotifications(): void {
    void this.router.navigate(['/notifications']);
  }

  redirectToTenantSetting(): void {
    void this.router.navigate(['/tenant-setting']);
  }

  redirectToEmployeesManagement(): void {
    void this.router.navigate(['/employees-management']);
  }

  redirectToEmployeeDetail(eid: string): void {
    void this.router.navigate(['/employees-management', 'detail', eid, 'personal']);
  }
  
  redirectToEmployeeEmployDetail(eid: string): void {
    void this.router.navigate(['/employees-management', 'detail', eid, 'employ']);
  }

  redirectToEmployeeEmployDetailEdit(eid: string): void {
    void this.router.navigate(['/employees-management', 'detail', eid, 'employ', 'edit']);
  }

  redirectToInvitationsManagement(): void {
    void this.router.navigate(['/invitations-management']);
  }

  redirectToPersonalSetting(): void {
    void this.router.navigate(['/personal-setting']);
  }

  redirectToPersonalSettingEdit(): void {
    void this.router.navigate(['/personal-setting', 'edit']);
  }

  redirectToEmployeeSetting(): void {
    void this.router.navigate(['/personal-setting', 'employee']);
  }
  
  redirectToEmployeeSettingEdit(): void {
    void this.router.navigate(['/personal-setting', 'employee', 'edit']);
  }

  redirectToMonthlyManagement(): void {
    void this.router.navigate(['/monthly-management']);
  }

  redirectToMonthlyDetail(eid: string): void {
    void this.router.navigate(['/monthly-management', 'detail', eid]);
  }

  redirectToPaymentManagement(): void {
    void this.router.navigate(['/payment-management']);
  }

  redirectToBonusManagement(): void {
    void this.router.navigate(['/bonus-management']);
  }

  redirectToBonusDetail(eid: string): void {
    void this.router.navigate(['/bonus-management', 'detail', eid]);
  }

  redirectToVirtualMailChecker(): void {
    void this.router.navigate(['/virtual-mail-checker']);
  }

  redirectToAllowanceApplication(): void {
    void this.router.navigate(['/task-board', 'allowance-application']);
  }

  redirectToLeaveApplication(): void {
    void this.router.navigate(['/task-board', 'leave-application']);
  }

  redirectToResignApplication(): void {
    void this.router.navigate(['/task-board', 'resign-application']);
  }
}
