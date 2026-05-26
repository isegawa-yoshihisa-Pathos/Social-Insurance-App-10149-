import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { RoutesService } from '../routes.service';
import { CurrentTenantService } from '../current-tenant.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';

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
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);
  readonly auth = inject(Auth);
  email = '';
  password = '';

  submitBusy = false;

  async signIn(): Promise<void> {
    try {
      this.submitBusy = true;
      const uid = await this.authService.signIn(this.email, this.password);
      if (!uid) return;
      await this.auth.currentUser?.getIdToken(true);
      await this.currentTenantService.initialize(uid);
      const affiliations = this.currentTenantService.getAffiliations();
      if (affiliations.length === 0) {
        this.dialog.open(ErrorDialogCmp, {
          data: { message: '所属事業所が見つかりません' },
        });
        return;
      }
      if (affiliations.length > 0) {
        const tid = affiliations[0].tid;
        await this.currentTenantService.setTenant(uid, tid);
        this.routesService.redirectToMainPage();
        return;
      }
    } catch (error) {
      console.error(error);
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.submitBusy = false;
    }
  }
}