import { Component, inject, effect } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp } from '../../../error-dialog/error-dialog.cmp';
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
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly firestore = inject(Firestore);

  tid = '';

  newNameHeader = '';
  newEmailHeader = '';
  saveBusy = false;

  constructor() {
    effect(() => {
      this.tid = this.currentTenantService.currentTid() ?? '';
    });
  }

  async saveNameHeader(): Promise<void> {
    if (!this.tid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません' },
      });
      return;
    }

    const nameHeader = this.invitationDataService.nameHeader();

    try {
      this.saveBusy = true;
      const docRef = doc(this.firestore, 'tenants', this.tid, 'settings', 'invitationSetting');
      await setDoc(docRef, {
        nameHeader,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      this.invitationDataService.setNameHeader(nameHeader);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'ヘッダーの保存に失敗しました' },
      });
    } finally {
      this.saveBusy = false;
    }
  }

  async saveEmailHeader(): Promise<void> {
    if (!this.tid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません' },
      });
      return;
    }

    const emailHeader = this.invitationDataService.emailHeader();

    try {
      this.saveBusy = true;
      const docRef = doc(this.firestore, 'tenants', this.tid, 'settings', 'invitationSetting');
      await setDoc(docRef, {
        emailHeader,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      this.invitationDataService.setEmailHeader(emailHeader);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'ヘッダーの保存に失敗しました' },
      });
    } finally {
      this.saveBusy = false;
    }
  }

  changeNameHeader(): void {
    const header = this.newNameHeader.trim();
    if (!header) {
      return;
    }
    this.invitationDataService.setNameHeader(header);
    this.saveNameHeader();
    this.newNameHeader = '';
  }

  changeEmailHeader(): void {
    const header = this.newEmailHeader.trim();
    if (!header) {
      return;
    }
    this.invitationDataService.setEmailHeader(header);
    this.saveEmailHeader();
    this.newEmailHeader = '';
  }
}
