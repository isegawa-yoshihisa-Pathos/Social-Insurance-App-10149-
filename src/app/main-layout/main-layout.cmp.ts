import { Component, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrentTenantService } from '../current-tenant.service';
import { ProfileCompletionService } from '../profile-completion.service';
import { RoutesService } from '../routes.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-main-layout',
  imports: [MatSidenavModule, MatIconModule, MatButtonModule, RouterOutlet],
  templateUrl: './main-layout.cmp.html',
  styleUrl: './main-layout.cmp.css',
})
export class MainLayoutCmp {
  readonly tenant = inject(CurrentTenantService);
  readonly profile = inject(ProfileCompletionService);
  readonly auth = inject(Auth);
  readonly router = inject(Router);
  readonly routesService = inject(RoutesService);
  readonly authService = inject(AuthService);
  
  readonly currentAffiliation = this.tenant.currentAffiliation;
  readonly isAdmin = this.tenant.isAdmin;
  readonly completion = this.profile.state;

  readonly isSelected = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => this.urlToSection(e.urlAfterRedirects)),
      startWith(this.urlToSection(this.router.url)),
    ),
    { initialValue: this.urlToSection(this.router.url) },
  );

  private urlToSection(url: string): 'myPage' | 'personalSetting' | 'taskBoard' | 'tenantSetting' | 'employeesManagement' | 'invitationsManagement' | 'monthlyManagement' | 'virtualMailChecker' {
    if (url.startsWith('/personal-setting')) return 'personalSetting';
    if (url.startsWith('/task-board')) return 'taskBoard';
    if (url.startsWith('/setting-tenant')) return 'tenantSetting';
    if (url.startsWith('/employees-management')) return 'employeesManagement';
    if (url.startsWith('/invitations-management')) return 'invitationsManagement';
    if (url.startsWith('/monthly-management')) return 'monthlyManagement';
    if (url.startsWith('/virtual-mail-checker')) return 'virtualMailChecker';
    return 'myPage';
  }

  constructor() {
    let isInitialized = false;
    effect(() => {
      const uid = this.authService.uid();
      if (!uid) return;
      const tid = this.tenant.currentTid();
      if (!uid ||!tid) return;

      if (!isInitialized) {
        isInitialized = true;
        return;
      }
      this.profile.refresh(uid, tid);
    });
  }

  navigateToMainPage(): void {
    this.routesService.redirectToMainPage();
  }

  navigateToPersonalSetting(): void {
    this.routesService.redirectToPersonalSetting();
  }

  navigateToSettingTenant(): void {
    this.routesService.redirectToSettingTenant();
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

  navigateToMonthlyManagement(): void {
    this.routesService.redirectToMonthlyManagement();
  }

  navigateToVirtualMailChecker(): void {
    this.routesService.redirectToVirtualMailChecker();
  }
} 