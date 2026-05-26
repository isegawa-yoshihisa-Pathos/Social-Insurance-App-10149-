import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp } from '../../../error-dialog/error-dialog.cmp';
import { FunctionsService } from '../../../functions.service';

@Component({
  selector: 'app-invitation-import-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './invitation-import-setting.cmp.html',
  styleUrl: './invitation-import-setting.cmp.css',
})
export class InvitationImportSettingCmp {
  readonly defaultNameHeaders = ['名前', '氏名', 'name'];
  readonly defaultEmailHeaders = ['メールアドレス', 'メール', 'email', 'mail'];

  private readonly dialog = inject(MatDialog);
  private readonly functionsService = inject(FunctionsService);

  @Input({ required: true }) tid = '';

  @Input()
  set nameHeaders(value: string[] | null | undefined) {
    this._nameHeaders = [...(value?.length ? value : this.defaultNameHeaders)];
  }

  get nameHeaders(): string[] {
    return this._nameHeaders;
  }

  @Input()
  set emailHeaders(value: string[] | null | undefined) {
    this._emailHeaders = [...(value?.length ? value : this.defaultEmailHeaders)];
  }

  get emailHeaders(): string[] {
    return this._emailHeaders;
  }

  private _nameHeaders: string[] = [...this.defaultNameHeaders];
  private _emailHeaders: string[] = [...this.defaultEmailHeaders];

  newNameHeader = '';
  newEmailHeader = '';
  saveBusy = false;

  async saveInvitationImportSettings(): Promise<void> {
    if (!this.tid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません' },
      });
      return;
    }

    try {
      this.saveBusy = true;
      await this.functionsService.saveInvitationImportSettings({
        tid: this.tid,
        nameHeaders: this.nameHeaders,
        emailHeaders: this.emailHeaders,
      });
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'ヘッダーの保存に失敗しました' },
      });
    } finally {
      this.saveBusy = false;
    }
  }

  addNameHeader(): void {
    const header = this.newNameHeader.trim();
    if (!header) {
      return;
    }
    if (this.nameHeaders.includes(header)) {
      this.openDuplicateHeaderError();
      return;
    }
    this._nameHeaders = [...this._nameHeaders, header];
    this.newNameHeader = '';
  }

  addEmailHeader(): void {
    const header = this.newEmailHeader.trim();
    if (!header) {
      return;
    }
    if (this.emailHeaders.includes(header)) {
      this.openDuplicateHeaderError();
      return;
    }
    this._emailHeaders = [...this._emailHeaders, header];
    this.newEmailHeader = '';
  }

  deleteNameHeader(header: string): void {
    this._nameHeaders = this.nameHeaders.filter((item) => item !== header);
  }

  deleteEmailHeader(header: string): void {
    this._emailHeaders = this.emailHeaders.filter((item) => item !== header);
  }

  private openDuplicateHeaderError(): void {
    this.dialog.open(ErrorDialogCmp, {
      data: {
        title: 'エラー',
        message: 'そのヘッダーはすでに存在します',
      },
    });
  }
}
