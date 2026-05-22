import { Component, inject, OnInit } from '@angular/core';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../current-tenant.service';
import { InvitationDataService } from '../invitation-data.service';
import { RoutesService } from '../routes.service';
import { InvitationMailSettingCmp } from './invitation-mail-setting/invitation-mail-setting.cmp';
import { InvitationImportSettingCmp } from './invitation-import-setting/invitation-import-setting.cmp';

@Component({
  selector: 'app-invitation-setting',
  imports: [InvitationMailSettingCmp, InvitationImportSettingCmp],
  templateUrl: './invitation-setting.cmp.html',
  styleUrl: './invitation-setting.cmp.css',
})
export class InvitationSettingCmp implements OnInit {
  readonly defaultNameHeaders = ['名前', '氏名', 'name'];
  readonly defaultEmailHeaders = ['メールアドレス', 'メール', 'email', 'mail'];
  readonly defaultTemplateText = `{name} 様
  
  {tenantName} より、社会保険管理システム「縄文」への招待が届いています。
  
  以下のボタンからアカウントの初期設定を行い、必要な情報の登録をお願いします。`;

  private dialog = inject(MatDialog);
  private currentTenantService = inject(CurrentTenantService);
  private invitationDataService = inject(InvitationDataService);
  private routesService = inject(RoutesService);

  eid = '';

  nameHeaders: string[] = [...this.defaultNameHeaders];
  emailHeaders: string[] = [...this.defaultEmailHeaders];
  mailTemplateText = this.defaultTemplateText;
  loading = true;

  async ngOnInit(): Promise<void> {
    const eid = this.currentTenantService.getTenant();

    if (!eid) {
      this.routesService.redirectToHome();
      return;
    }
    this.eid = eid;

    try {
      this.loading = true;
      const doc = await this.invitationDataService.loadInvitationDocument(eid);
      if (!doc) {
        this.mailTemplateText = this.defaultTemplateText;
        this.nameHeaders = [...this.defaultNameHeaders];
        this.emailHeaders = [...this.defaultEmailHeaders];
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
}
