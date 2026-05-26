import { Component, inject, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CurrentTenantService } from '../current-tenant.service';
import { RoutesService } from '../routes.service';

@Component({
  selector: 'app-employees-management',
  imports: [MatTabsModule, RouterLink, RouterOutlet],
  templateUrl: './employees-management.cmp.html',
  styleUrl: './employees-management.cmp.css',
})
export class EmployeesManagementCmp implements OnInit {
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly router = inject(Router);

  tid = '';
  isSettingActive = false;

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.getTenant();
    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }
    this.tid = tid;

    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));
  }

  private updateTabActive(url: string): void {
    this.isSettingActive = url.startsWith('/employees-management/setting');
  }
}
