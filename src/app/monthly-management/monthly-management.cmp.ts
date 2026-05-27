import { Component, inject } from '@angular/core';
import { MatTabNavPanel } from '@angular/material/tabs';
import { RouterModule, RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { MatTabNav } from '@angular/material/tabs';
import { MatTabLink } from '@angular/material/tabs';
import { filter } from 'rxjs';

@Component({
  selector: 'app-monthly-management',
  imports: [MatTabNavPanel, RouterModule, RouterOutlet, RouterLink, MatTabNav, MatTabLink],
  templateUrl: './monthly-management.cmp.html',
  styleUrl: './monthly-management.cmp.css',
})
export class MonthlyManagementCmp {
  private readonly router = inject(Router);

  isSettingActive = false;

  ngOnInit(): void {

    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));
  }

  private updateTabActive(url: string): void {
    this.isSettingActive = url.startsWith('/monthly-management/setting');
  }
}
