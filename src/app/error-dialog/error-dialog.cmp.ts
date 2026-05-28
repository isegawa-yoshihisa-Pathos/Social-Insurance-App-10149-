import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export function mapFirebaseAuthError(errorcode: string): string {
  switch (errorcode) {
    case 'auth/network-request-failed':
      return '通信に失敗しました。ネットワーク接続を確認してください';
    case 'auth/user-not-found':
      return 'ユーザーが見つかりません';
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
      console.error(errorcode);
      return '予期せぬエラーが発生しました。';
  }
}

export function mapCallableError(error: { code?: string, message?: string }): string {
  if (error.message && error.code !== 'functions/internal') {
    return error.message;
  }
  switch (error.code) {
    case 'functions/already-exists':
      return 'このメールアドレスは既に登録されています';
    case 'functions/invalid-argument':
      return error.message ?? '入力内容を確認してください';
    case 'functions/permission-denied':
      return error.message ?? 'この操作を行う権限がありません';
    case 'functions/unauthenticated':
      return error.message ?? 'ログインが必要です';
    case 'functions/not-found':
      return error.message ?? '対象データが見つかりません';
    case 'functions/failed-precondition':
      return error.message ?? '前提条件を満たしていません';
    case 'functions/internal':
      return error.message ?? '事業所登録に失敗しました';
    default:
      return error.message ?? '処理に失敗しました';
  }
}

export function mapFirebaseError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return '予期せぬエラーが発生しました。';
  }
  const e = error as { code?: string; message?: string };
  if (e.code?.startsWith('functions/')) {
    return mapCallableError(e);
  }
  if (e.code?.startsWith('auth/')) {
    return mapFirebaseAuthError(e.code);
  }
  if (e.code === 'permission-denied') {
    return 'データの読み取り権限がありません';
  }
  if (e.message) {
    return e.message;
  }
  return '予期せぬエラーが発生しました。';
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
