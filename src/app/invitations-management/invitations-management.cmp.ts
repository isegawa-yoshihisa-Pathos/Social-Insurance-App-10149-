import { Component, inject, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-invitation-management',
  imports: [MatTabsModule, RouterLink, RouterOutlet],
  templateUrl: './invitations-management.cmp.html',
  styleUrl: './invitations-management.cmp.css',
})

export class InvitationsManagementCmp implements OnInit {
  private readonly router = inject(Router);
  isSettingActive = false;

  ngOnInit(): void {
    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));
  }
  
  private updateTabActive(url: string): void {
    this.isSettingActive = url.startsWith('/invitations-management/setting');
  }
}