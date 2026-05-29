import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../auth.service';
import { Auth } from '@angular/fire/auth';
import { CurrentTenantService } from '../current-tenant.service';
import { FunctionsService } from '../functions.service';
import { RoutesService } from '../routes.service';
import { mapFirebaseError, ErrorDialogCmp } from '../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';

interface InvitationPreview {
  tenantName: string;
  name: string;
  email: string;
  defaultLoginEmail: string;
  role: 'admin' | 'member';
  expiresAt: number | null;
}

@Component({
  selector: 'app-invitation-accept',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './invitation-accept.cmp.html',
  styleUrl: './invitation-accept.cmp.css',
})
export class InvitationAcceptCmp implements OnInit{
  private readonly route = inject(ActivatedRoute);
  private readonly functionsService = inject(FunctionsService);
  private readonly authService = inject(AuthService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(Auth);
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  email = '';
  loginEmail = '';
  password = '';
  passwordVisible = false;

  invitation: InvitationPreview | null = null;

  verifying = false;
  accepting: 'create' | 'link' | null = null;

  async ngOnInit(): Promise<void> {
    if (this.auth.currentUser) {
      await this.auth.signOut();
    }
  }

  get canVerify(): boolean {
    return Boolean(this.token && this.email.trim() && !this.verifying);
  }

  get canAccept(): boolean {
    if (!this.invitation || this.accepting || !this.loginEmail.trim()) {
      return false;
    }

    return this.password.length >= 6;
  }

  async verifyEmail(): Promise<void> {
    if (!this.canVerify) {
      return;
    }

    try {
      this.verifying = true;

      const result = await this.functionsService.validateInvitationToken({
        token: this.token,
        email: this.email,
      });

      const data = result.data as InvitationPreview;
      this.invitation = data;
      this.email = data.email;
      this.loginEmail = data.defaultLoginEmail;
    } catch (error) {
      this.invitation = null;
      this.dialog.open(ErrorDialogCmp, {
        data: {
          message: mapFirebaseError(error),
        },
      });
    } finally {
      this.verifying = false;
    }
  }

  async Submit(mode: 'create' | 'link'): Promise<void> {
    if (!this.canAccept) {
      return;
    }
    try {
      this.accepting = mode;
      if (mode === 'link') {
        await this.authService.signIn(this.loginEmail, this.password);
      }

      await this.functionsService.acceptInvitation({
        token: this.token,
        email: this.email,
        loginEmail: this.loginEmail,
        password: this.password,
        mode: mode,
      });
      if (mode === 'create') {
        await this.authService.signIn(this.loginEmail, this.password);
      }
      await this.currentTenantService.bootstrap(this.authService.uid() ?? '');
      this.routesService.redirectToMainPage();
    } catch (error) {
      if (mode === 'link') {
        await this.auth.signOut();
      }
      this.dialog.open(ErrorDialogCmp, {
        data: {
          message: mapFirebaseError(error),
        },
      });
    } finally {
      this.accepting = null;
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