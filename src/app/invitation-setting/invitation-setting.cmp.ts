import { Component, inject, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FunctionsService } from '../functions.service';
import { CurrentEstablishmentService } from '../current-establishment.service';
import { InvitationDataService } from '../invitation-data.service';
import { RoutesService } from '../routes.service';

@Component({
  selector: 'app-invitation-setting',
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './invitation-setting.cmp.html',
  styleUrl: './invitation-setting.cmp.css',
})
export class InvitationSettingCmp implements OnInit {
  readonly defaultNameHeaders = ['名前', '氏名', 'name'];
  readonly defaultEmailHeaders = ['メールアドレス', 'メール', 'email', 'mail'];

  private dialog = inject(MatDialog);
  private functionsService = inject(FunctionsService);
  private currentEstService = inject(CurrentEstablishmentService);
  private invitationDataService = inject(InvitationDataService);
  private routesService = inject(RoutesService);

  eid = '';

  nameHeaders: string[] = [...this.defaultNameHeaders];
  emailHeaders: string[] = [...this.defaultEmailHeaders];

  newNameHeader = '';
  newEmailHeader = '';
  mailTemplateText = '';

  saveBusy = false;
  loading = true;

  async ngOnInit(): Promise<void> {
    const eid = this.currentEstService.getEstablishment();

    if (!eid) {
      this.routesService.redirectToHome();
      return;
    }
    this.eid = eid;

    try {
      this.loading = true;
      const doc = await this.invitationDataService.loadInvitationDocument(eid);
      if (!doc) {
        this.dialog.open(ErrorDialogCmp, {
          data: { message: '事業所データが見つかりませんでした' },
        });
        return;
      }
      this.mailTemplateText = doc.templateText;
      this.nameHeaders = doc.nameHeaders;
      this.emailHeaders = doc.emailHeaders;
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  async saveInvitationTemplate(): Promise<void> {
    const eid = this.currentEstService.getEstablishment()
    if (!eid) {
      this.dialog.open(ErrorDialogCmp, {
        data: {message: '事業所が選択されていません'},
      });
      return;
    }
    try {
      this.saveBusy = true;
      await this.functionsService.saveInvitationTemplate({
        eid,
        templateText: this.mailTemplateText,
      });
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'メールテンプレートの保存に失敗しました' },
      });
    } finally {
      this.saveBusy = false;
    }
  }

  async saveInvitationImportSettings(): Promise<void> {
    const eid = this.currentEstService.getEstablishment()
    if (!eid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません' },
      });
      return;
    }
    try {
      this.saveBusy = true;
      await this.functionsService.saveInvitationImportSettings({
        eid,
        nameHeaders: this.nameHeaders,
        emailHeaders: this.emailHeaders,
      });
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'ヘッダーの保存に失敗しました' },
      });
    }
    finally {
      this.saveBusy = false;
    }
  }

  addNameHeader(): void {
    const header = this.newNameHeader.trim();
    if (!header) {
      return;
    }
    if (this.nameHeaders.includes(header)) {
      this.dialog.open(ErrorDialogCmp, {
        data: {
          title: 'エラー',
          message: 'そのヘッダーはすでに存在します',
        },
      });
      return;
    }
    this.nameHeaders.push(header);
    this.newNameHeader = '';
  }

  addEmailHeader(): void {
    const header = this.newEmailHeader.trim();
    if (!header) {
      return;
    }
    if (this.emailHeaders.includes(header)) {
      this.dialog.open(ErrorDialogCmp, {
        data: {
          title: 'エラー',
          message: 'そのヘッダーはすでに存在します',
        },
      });
      return;
    }
    this.emailHeaders.push(header);
    this.newEmailHeader = '';
  }

  deleteNameHeader(header: string): void {
    this.nameHeaders = this.nameHeaders.filter((item) => item !== header);
  }

  deleteEmailHeader(header: string): void {
    this.emailHeaders = this.emailHeaders.filter((item) => item !== header);
  }
}
