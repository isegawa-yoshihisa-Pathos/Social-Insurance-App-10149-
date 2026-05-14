import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RoutesService } from '../routes.service';

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
  constructor(private routesService: RoutesService) {}

  navigateToHome(): void {
    this.routesService.redirectToHome();
  }

  navigateToSignin(): void {
    this.routesService.redirectToSignin();
  }

  navigateToSignup(): void {
    this.routesService.redirectToSignup();
  }
}
