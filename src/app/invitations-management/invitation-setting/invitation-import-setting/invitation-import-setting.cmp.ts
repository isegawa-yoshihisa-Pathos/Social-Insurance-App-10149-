import { Component, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp } from '../../../error-dialog/error-dialog.cmp';
import { FunctionsService } from '../../../functions.service';
import { CurrentTenantService } from '../../../current-tenant.service';
import { InvitationDataService } from '../../invitation-data.service';

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
  readonly invitationDataService = inject(InvitationDataService);

  private readonly dialog = inject(MatDialog);
  private readonly functionsService = inject(FunctionsService);
  private readonly currentTenantService = inject(CurrentTenantService);

  tid = '';

  newNameHeader = '';
  newEmailHeader = '';
  saveBusy = false;

  constructor() {
    effect(() => {
      this.tid = this.currentTenantService.currentTid() ?? '';
    });
  }

  async saveInvitationImportSettings(): Promise<void> {
    if (!this.tid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません' },
      });
      return;
    }

    const nameHeaders = this.invitationDataService.nameHeaders();
    const emailHeaders = this.invitationDataService.emailHeaders();

    try {
      this.saveBusy = true;
      await this.functionsService.saveInvitationImportSettings({
        tid: this.tid,
        nameHeaders,
        emailHeaders,
      });
      this.invitationDataService.setImportHeaders(nameHeaders, emailHeaders);
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
    if (this.invitationDataService.nameHeaders().includes(header)) {
      this.openDuplicateHeaderError();
      return;
    }
    this.invitationDataService.addNameHeader(header);
    this.newNameHeader = '';
  }

  addEmailHeader(): void {
    const header = this.newEmailHeader.trim();
    if (!header) {
      return;
    }
    if (this.invitationDataService.emailHeaders().includes(header)) {
      this.openDuplicateHeaderError();
      return;
    }
    this.invitationDataService.addEmailHeader(header);
    this.newEmailHeader = '';
  }

  deleteNameHeader(header: string): void {
    this.invitationDataService.deleteNameHeader(header);
  }

  deleteEmailHeader(header: string): void {
    this.invitationDataService.deleteEmailHeader(header);
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
