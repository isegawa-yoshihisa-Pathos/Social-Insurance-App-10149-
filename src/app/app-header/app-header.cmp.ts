import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, authState } from '@angular/fire/auth';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RoutesService } from '../routes.service';
import { AuthService } from '../auth.service';
import { CurrentEstablishmentService } from '../current-establishment.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './app-header.cmp.html',
  styleUrl: './app-header.cmp.css',
})
export class AppHeaderCmp implements OnInit {
  private readonly routesService = inject(RoutesService);
  private readonly authService = inject(AuthService);
  readonly auth = inject(Auth);
  readonly currentEstService = inject(CurrentEstablishmentService);

  currentAffiliation = toSignal(this.currentEstService.currentAffiliation$, { initialValue: null });

  async ngOnInit(): Promise<void> {
    authState(this.auth).pipe(filter(Boolean), take(1)).subscribe(async (user) => {
      await user.getIdToken(true);
      if (this.currentEstService.getAffiliations().length === 0) {
        await this.currentEstService.initialize(user.uid);
      }
      if (this.currentAffiliation() === null) {
        this.routesService.redirectToHome();
      }
    });
  }

  async switchEstablishment(eid: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      this.routesService.redirectToHome();
      return;
    }
    await this.currentEstService.setEstablishment(user.uid, eid);
    this.routesService.redirectToMainPage();
  }

  signOut(): void {
    this.authService.signOut();
    this.routesService.redirectToHome();
  }

  navigateToHome(): void {
    if (this.auth.currentUser) {
      this.routesService.redirectToMainPage();
    } else {
      this.routesService.redirectToHome();
    }
  }

  navigateToSignin(): void {
    this.routesService.redirectToSignin();
  }

  navigateToSignup(): void {
    this.routesService.redirectToSignup();
  }
}
