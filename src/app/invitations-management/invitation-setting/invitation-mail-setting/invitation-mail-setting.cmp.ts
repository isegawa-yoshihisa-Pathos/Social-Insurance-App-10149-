import { Component, TemplateRef, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp } from '../../../error-dialog/error-dialog.cmp';
import { FunctionsService } from '../../../functions.service';
import { CurrentTenantService } from '../../../current-tenant.service';
import { InvitationDataService } from '../../invitation-data.service';

@Component({
  selector: 'app-invitation-mail-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './invitation-mail-setting.cmp.html',
  styleUrl: './invitation-mail-setting.cmp.css',
})
export class InvitationMailSettingCmp {
  readonly invitationDataService = inject(InvitationDataService);

  private readonly dialog = inject(MatDialog);
  private readonly functionsService = inject(FunctionsService);
  private readonly currentTenantService = inject(CurrentTenantService);

  tid = '';
  saveBusy = false;

  readonly previewValues = {
    name: '山田太郎',
    email: 'yamada.taro@example.com',
    tenantName: '縄文事業所',
    replyToEmail: 'admin@jomon.com',
    invitationUrl: 'https://jomon.com/invitation?token=sample',
  };

  constructor() {
    effect(() => {
      this.tid = this.currentTenantService.currentTid() ?? '';
    });
  }

  get mailTemplateText(): string {
    return this.invitationDataService.templateText();
  }

  set mailTemplateText(value: string) {
    this.invitationDataService.templateText.set(value);
  }

  get mailReplyToEmail(): string {
    return this.invitationDataService.replyToEmail();
  }

  set mailReplyToEmail(value: string) {
    this.invitationDataService.replyToEmail.set(value);
  }

  get previewText(): string {
    return this.renderTemplate(this.mailTemplateText);
  }

  get previewSubject(): string {
    return `【重要】${this.previewValues.tenantName} から社会保険管理システムへの招待`;
  }

  openPreview(template: TemplateRef<unknown>): void {
    this.dialog.open(template, {
      width: '720px',
      maxWidth: '90vw',
    });
  }

  async saveInvitationTemplate(): Promise<void> {
    if (!this.tid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません' },
      });
      return;
    }

    const templateText = this.mailTemplateText;
    const replyToEmail = this.mailReplyToEmail.trim();

    try {
      this.saveBusy = true;
      await this.functionsService.saveInvitationTemplate({
        tid: this.tid,
        templateText,
        replyToEmail,
      });
      this.invitationDataService.setMailSettings(templateText, replyToEmail);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'メールテンプレートの保存に失敗しました' },
      });
    } finally {
      this.saveBusy = false;
    }
  }

  private renderTemplate(template: string): string {
    return template.replace(
      /\{\s*(\w+)\s*\}/g,
      (_, key: keyof typeof this.previewValues) => this.previewValues[key] ?? '',
    );
  }
}
