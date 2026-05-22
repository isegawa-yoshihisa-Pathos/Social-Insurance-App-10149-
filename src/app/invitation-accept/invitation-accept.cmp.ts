import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../auth.service';
import { CurrentTenantService } from '../current-tenant.service';
import { FunctionsService } from '../functions.service';
import { RoutesService } from '../routes.service';

interface InvitationPreview {
  tenantName: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  accountExists: boolean;
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
export class InvitationAcceptCmp {
  private readonly route = inject(ActivatedRoute);
  private readonly functionsService = inject(FunctionsService);
  private readonly authService = inject(AuthService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);

  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  email = '';
  password = '';
  passwordVisible = false;

  invitation: InvitationPreview | null = null;
  accountExists = false;

  verifying = false;
  accepting = false;

  errorMessage = '';
  successMessage = '';

  get canVerify(): boolean {
    return Boolean(this.token && this.email.trim() && !this.verifying);
  }

  get canAccept(): boolean {
    if (!this.invitation || this.accepting) {
      return false;
    }

    if (this.accountExists) {
      return true;
    }

    return this.password.length >= 6;
  }

  async verifyEmail(): Promise<void> {
    if (!this.canVerify) {
      return;
    }

    try {
      this.verifying = true;
      this.errorMessage = '';
      this.successMessage = '';

      const result = await this.functionsService.validateInvitationToken({
        token: this.token,
        email: this.email,
      });

      const data = result.data as InvitationPreview;
      this.invitation = data;
      this.accountExists = data.accountExists;
      this.email = data.email;
    } catch (error) {
      this.invitation = null;
      this.errorMessage = this.toMessage(error);
    } finally {
      this.verifying = false;
    }
  }

  async acceptInvitation(): Promise<void> {
    if (!this.canAccept) {
      return;
    }

    try {
      this.accepting = true;
      this.errorMessage = '';
      this.successMessage = '';

      const result = await this.functionsService.acceptInvitation({
        token: this.token,
        email: this.email,
        password: this.accountExists ? undefined : this.password,
      });

      const data = result.data as {
        mode: 'created' | 'linked';
        email: string;
        eid: string;
      };

      if (data.mode === 'created') {
        await this.authService.signIn(data.email, this.password);
        await this.currentTenantService.initialize(this.authService.userId() ?? '');
        this.routesService.redirectToMainPage();
        return;
      }

      this.successMessage = '既存アカウントへの連携が完了しました。ログインしてください。';
      this.routesService.redirectToSignin();
    } catch (error) {
      this.errorMessage = this.toMessage(error);
    } finally {
      this.accepting = false;
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

  private toMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message?: unknown }).message ?? 'エラーが発生しました。');
    }

    return 'エラーが発生しました。';
  }
}