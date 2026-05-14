import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { RoutesService } from '../routes.service';
import { AuthService } from '../auth.service';
import { ErrorDialogCmp, mapFirebaseAuthError } from '../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [MatButtonModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatIconModule, FormsModule],
  templateUrl: './signup.cmp.html',
  styleUrl: './signup.cmp.css',
})
export class SignupCmp {
  private readonly routesService = inject(RoutesService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  name = '';
  email = '';
  password = '';
  passwordVisible = false;

  navigateToSignin(): void {
    this.routesService.redirectToSignin();
  }

  async navigateToCreateEstablishment(): Promise<void> {
    try {
      await this.authService.signUp(this.email, this.name, this.password);
      this.routesService.redirectToCreateEstablishment();
    } catch (error: any) {
      const errorMessage = mapFirebaseAuthError(error.code);
      this.dialog.open(ErrorDialogCmp, {
        data: { message: errorMessage },
      });
    }
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
