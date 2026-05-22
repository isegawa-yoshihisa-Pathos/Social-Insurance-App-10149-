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

  redirectToMainPage(): void {
    void this.router.navigate(['/main-page']);
  }

  redirectToTaskBoard(): void {
    void this.router.navigate(['/task-board']);
  }

  redirectToSettingTenant(): void {
    void this.router.navigate(['/setting-tenant']);
  }

  redirectToEmployeesManagement(): void {
    void this.router.navigate(['/employees-management']);
  }

  redirectToInvitationsManagement(): void {
    void this.router.navigate(['/invitations-management']);
  }

  redirectToPersonalSetting(): void {
    void this.router.navigate(['/personal-setting']);
  }
}
