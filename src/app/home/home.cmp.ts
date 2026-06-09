import { Component, inject } from '@angular/core';
import { RoutesService } from '../routes.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './home.cmp.html',
  styleUrl: './home.cmp.css',
})
export class HomeCmp {

  constructor(private routesService: RoutesService) {}

  navigateToSignup(): void {
    this.routesService.redirectToSignup();
  }

  navigateToSignin(): void {
    this.routesService.redirectToSignin();
  }
}
