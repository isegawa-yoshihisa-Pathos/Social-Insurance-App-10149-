import { Component, inject, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-employees-management',
  imports: [MatTabsModule, RouterLink, RouterOutlet],
  templateUrl: './employees-management.cmp.html',
  styleUrl: './employees-management.cmp.css',
})
export class EmployeesManagementCmp implements OnInit {
  private readonly router = inject(Router);

  isSettingActive = false;

  ngOnInit(): void {

    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));
  }

  private updateTabActive(url: string): void {
    this.isSettingActive = url.startsWith('/employees-management/setting');
  }
}
