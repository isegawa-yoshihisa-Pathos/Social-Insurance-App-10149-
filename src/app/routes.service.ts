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

  redirectToPaymentManagement(): void {
    void this.router.navigate(['/payment-management']);
  }

  redirectToBonusManagement(): void {
    void this.router.navigate(['/bonus-management']);
  }

  redirectToVirtualMailChecker(): void {
    void this.router.navigate(['/virtual-mail-checker']);
  }
}
