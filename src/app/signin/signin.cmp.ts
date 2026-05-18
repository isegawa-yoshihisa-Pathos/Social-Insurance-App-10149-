import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { RoutesService } from '../routes.service';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseAuthError } from '../error-dialog/error-dialog.cmp';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [MatButtonModule, MatInputModule, MatFormFieldModule, MatSelectModule, FormsModule, MatProgressSpinnerModule],
  templateUrl: './signin.cmp.html',
  styleUrl: './signin.cmp.css',
})
export class SigninCmp {
  private readonly authService = inject(AuthService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);
  email = '';
  password = '';

  submitBusy = false;

  async signIn(): Promise<void> {
    try {
      this.submitBusy = true;
      await this.authService.signIn(this.email, this.password);
      this.routesService.redirectToMainPage();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseAuthError(error as string) },
      });
    } finally {
      this.submitBusy = false;
    }
  }
}
