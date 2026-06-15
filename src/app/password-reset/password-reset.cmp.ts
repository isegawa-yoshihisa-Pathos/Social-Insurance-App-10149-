import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './password-reset.cmp.html',
  styleUrl: './password-reset.cmp.css'
})
export class PasswordResetCmp {
  private auth = inject(Auth);
  private router = inject(Router);

  email: string = '';
  submitBusy: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';

  async sendResetEmail() {
    this.submitBusy = true;
    this.successMessage = '';
    this.errorMessage = '';

    try {
      await sendPasswordResetEmail(this.auth, this.email);
      this.successMessage = 'パスワード再設定用のメールを送信しました。メールボックスをご確認ください。';
    } catch (error: any) {
      switch (error.code) {
        case 'auth/user-not-found':
          this.errorMessage = 'このメールアドレスは登録されていません。';
          break;
        case 'auth/invalid-email':
          this.errorMessage = 'メールアドレスの形式が正しくありません。';
          break;
        default:
          this.errorMessage = 'エラーが発生しました。時間をおいて再度お試しください。';
          console.error(error);
      }
    } finally {
      this.submitBusy = false;
    }
  }

  navigateToSignin() {
    void this.router.navigate(['/signin']);
  }
}