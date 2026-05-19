import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrentEstablishmentService } from '../current-establishment.service';
import { RoutesService } from '../routes.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-main-layout',
  imports: [MatSidenavModule, MatIconModule, MatButtonModule, RouterOutlet],
  templateUrl: './main-layout.cmp.html',
  styleUrl: './main-layout.cmp.css',
})
export class MainLayoutCmp {
  readonly currentEstService = inject(CurrentEstablishmentService);
  readonly routesService = inject(RoutesService);

  currentAffiliation = toSignal(this.currentEstService.currentAffiliation$, { initialValue: null });

  isAdmin(): boolean {
    return this.currentEstService.getCurrentAffiliation()?.role === 'admin';
  }

  navigateToMainPage(): void {
    this.routesService.redirectToMainPage();
  }

  navigateToSettingEstablishment(): void {
    this.routesService.redirectToSettingEstablishment();
  }

  navigateToEmployeesManagement(): void {
    this.routesService.redirectToEmployeesManagement();
  }

  navigateToInvitationsManagement(): void {
    this.routesService.redirectToInvitationsManagement();
  }

  navigateToTaskBoard(): void {
    this.routesService.redirectToTaskBoard();
  }
}