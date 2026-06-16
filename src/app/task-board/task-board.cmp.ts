import { Component, inject, OnInit } from '@angular/core';
import { MatTabLink, MatTabNav, MatTabNavPanel } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CurrentTenantService } from '../current-tenant.service';

@Component({
  selector: 'app-task-board',
  imports: [MatTabNav, MatTabLink, MatTabNavPanel, RouterLink, RouterOutlet],
  templateUrl: './task-board.cmp.html',
  styleUrl: './task-board.cmp.css',
})
export class TaskBoardCmp implements OnInit {
  private readonly router = inject(Router);
  readonly tenant = inject(CurrentTenantService);

  isPersonalActive = false;
  isTenantActive = true;

  ngOnInit(): void {
    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));
  }

  private updateTabActive(url: string): void {
    this.isTenantActive = url.startsWith('/task-board/tenant');
    this.isPersonalActive = !this.isTenantActive;
  }
}
