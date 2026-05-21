import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrentEstablishmentService } from '../current-establishment.service';
import { ProfileCompletionService } from '../profile-completion.service';
import { RoutesService } from '../routes.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-main-layout',
  imports: [MatSidenavModule, MatIconModule, MatButtonModule, RouterOutlet],
  templateUrl: './main-layout.cmp.html',
  styleUrl: './main-layout.cmp.css',
})
export class MainLayoutCmp implements OnInit {
  readonly currentEstService = inject(CurrentEstablishmentService);
  readonly routesService = inject(RoutesService);
  readonly profileCompletionService = inject(ProfileCompletionService);
  readonly auth = inject(Auth);
  
  currentAffiliation = toSignal(this.currentEstService.currentAffiliation$, { initialValue: null });
  completion = toSignal(this.profileCompletionService.completion$, {
    initialValue: {
      personal: false,
      employee: false,
      establishment: false,
      any: false,
    },
  });

  async ngOnInit(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('ユーザーが見つかりません。');
    }
    const eid = await this.currentEstService.getEstablishment();
    if (!eid) {
      throw new Error('事業所が見つかりません。');
    }
    await this.profileCompletionService.refresh(uid, eid);
  }

  isAdmin(): boolean {
    return this.currentEstService.getCurrentAffiliation()?.role === 'admin';
  }

  navigateToMainPage(): void {
    this.routesService.redirectToMainPage();
  }

  navigateToPersonalSetting(): void {
    this.routesService.redirectToPersonalSetting();
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