import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentEstablishmentService } from './current-establishment.service';

@Injectable({
  providedIn: 'root',
})
export class RoutesService {
  readonly currentEstService = inject(CurrentEstablishmentService);
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

  redirectToCreateEstablishment(): void {
    void this.router.navigate(['/create-establishment']);
  }

  redirectToMainPage(): void {
    void this.router.navigate(['/main-page']);
  }

  redirectToTaskBoard(): void {
    void this.router.navigate(['/task-board']);
  }

  redirectToSettingEstablishment(): void {
    void this.router.navigate(['/setting-establishment']);
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
