import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export function mapFirebaseAuthError(errorcode: string): string {
  switch (errorcode) {
    case 'auth/network-request-failed':
      return '通信に失敗しました。ネットワーク接続を確認してください';
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に登録されています';
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません';
    case 'auth/weak-password':
      return 'パスワードが弱すぎます（6文字以上にしてください）';
    case 'auth/requires-recent-login':
      return 'セキュリティのため、一度サインアウトしてから再度ログインし、もう一度お試しください';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'パスワードが正しくありません';
    default:
      return '予期せぬエラーが発生しました。';
  }
}

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './error-dialog.cmp.html',
  styleUrl: './error-dialog.cmp.css',
})
export class ErrorDialogCmp {
  readonly data = inject<{ message: string }>(MAT_DIALOG_DATA);
}
