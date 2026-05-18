import { Component, inject, OnInit, OnDestroy, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Auth } from '@angular/fire/auth';
import { CurrentEstablishmentService } from '../current-establishment.service';
import { RoutesService } from '../routes.service';

@Component({
  selector: 'app-main-layout',
  imports: [MatSidenavModule, MatIconModule, MatButtonModule, RouterOutlet],
  templateUrl: './main-layout.cmp.html',
  styleUrl: './main-layout.cmp.css',
})
export class MainLayoutCmp implements OnInit, OnDestroy {
  readonly currentEstService = inject(CurrentEstablishmentService);
  readonly routesService = inject(RoutesService);
  readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private querySub?: Subscription;

  sidenav = viewChild.required<MatSidenav>('sidenav');

  ngOnInit(): void {
    this.querySub = this.route.queryParams.subscribe((params) => {
      const eid = params['eid'];
      if (eid) {
        this.currentEstService.setEstablishment(eid);
      } else if (!this.currentEstService.getEstablishment()) {
        this.routesService.redirectToHome();
      }
    });
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
  }

  isAdmin(): boolean {
    return this.currentEstService.getCurrentAffiliation()?.role === 'admin';
  }

  closeSidenavAndNavigate(commands: string[]): void {
    void this.router.navigate(commands, {
      queryParams: { eid: this.currentEstService.getEstablishment() || '' },
    });
    this.sidenav().close();
  }

  navigateToMainPage(): void {
    this.closeSidenavAndNavigate(['/main-page']);
  }

  navigateToSettingEstablishment(): void {
    this.closeSidenavAndNavigate(['/setting-establishment']);
  }

  navigateToSettingEmployees(): void {
    this.closeSidenavAndNavigate(['/setting-employees']);
  }
}