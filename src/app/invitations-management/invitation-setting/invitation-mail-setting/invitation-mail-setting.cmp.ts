import { Component, Input, TemplateRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp } from '../../../error-dialog/error-dialog.cmp';
import { FunctionsService } from '../../../functions.service';

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
  readonly defaultTemplateText = `{name} 様
  
  {tenantName} より、社会保険管理システム「縄文」への招待が届いています。
  
  以下のボタンからアカウントの初期設定を行い、必要な情報の登録をお願いします。
  
  ご不明な点がある場合は、管理者（{replyToEmail}）へお問い合わせください。`;

  private readonly dialog = inject(MatDialog);
  private readonly functionsService = inject(FunctionsService);

  @Input({ required: true }) tid = '';

  @Input()
  set templateText(value: string | null | undefined) {
    this.mailTemplateText = value?.trim() ? value : this.defaultTemplateText;
  }

  @Input()
  set replyToEmail(value: string | null | undefined) {
    this.mailReplyToEmail = value ?? '';
  }

  mailReplyToEmail = '';

  mailTemplateText = this.defaultTemplateText
  saveBusy = false;

  readonly previewValues = {
    name: '山田太郎',
    email: 'yamada.taro@example.com',
    tenantName: '縄文事業所',
    replyToEmail: 'admin@jomon.com',
    invitationUrl: 'https://jomon.com/invitation?token=sample',
  };

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

    try {
      this.saveBusy = true;
      await this.functionsService.saveInvitationTemplate({
        tid: this.tid,
        templateText: this.mailTemplateText,
        replyToEmail: this.mailReplyToEmail.trim(),
      });
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
