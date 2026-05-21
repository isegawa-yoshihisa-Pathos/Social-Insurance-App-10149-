import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { RoutesService } from '../routes.service';
import { SharedDataService } from '../shared-data.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [MatButtonModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatIconModule, FormsModule],
  templateUrl: './signup.cmp.html',
  styleUrl: './signup.cmp.css',
})
export class SignupCmp {
  private readonly routesService = inject(RoutesService);
  private readonly sharedDataService = inject(SharedDataService);

  private readonly signupData = this.sharedDataService.getSignupData();
  email = this.signupData?.email || '';
  password = this.signupData?.password || '';
  passwordVisible = false;

  navigateToSignin(): void {
    this.routesService.redirectToSignin();
  }

  async navigateToCreateEstablishment(): Promise<void> {
    this.sharedDataService.setSignupData({
      email: this.email,
      password: this.password,
    });
    this.routesService.redirectToCreateEstablishment();
  }

  showPassword(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.passwordVisible = true;

    const finish = () => {
      this.passwordVisible = false;
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }
}
