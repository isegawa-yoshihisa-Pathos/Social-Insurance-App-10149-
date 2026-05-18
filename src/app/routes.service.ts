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

  redirectToMainPage(eid: string): void {
    void this.router.navigate(['/main-page'], {
      queryParams: {
        eid: eid,
      },
    });
  }

  redirectToSettingEstablishment(): void {
    void this.router.navigate(['/setting-establishment'], {
      queryParams: {
        eid: this.currentEstService.getEstablishment() || '',
      },
    });
  }

  redirectToSettingEmployees(): void {
    void this.router.navigate(['setting-employees'], {
      queryParams: {
        eid: this.currentEstService.getEstablishment() || '',
      },
    });
  }
}
