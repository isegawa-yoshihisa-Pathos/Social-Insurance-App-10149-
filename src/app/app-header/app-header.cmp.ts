import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RoutesService } from '../routes.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './app-header.cmp.html',
  styleUrl: './app-header.cmp.css',
})
export class AppHeaderCmp {
  private readonly routesService = inject(RoutesService);
  private readonly authService = inject(AuthService);
  readonly auth = inject(Auth);

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
