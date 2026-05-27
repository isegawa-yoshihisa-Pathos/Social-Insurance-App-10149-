import { Component, inject, OnInit } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../current-tenant.service';
import { InvitationDataService } from '../invitation-data.service';
import { RoutesService } from '../../routes.service';
import { InvitationMailSettingCmp } from './invitation-mail-setting/invitation-mail-setting.cmp';
import { InvitationImportSettingCmp } from './invitation-import-setting/invitation-import-setting.cmp';

@Component({
  selector: 'app-invitation-setting',
  imports: [InvitationMailSettingCmp, InvitationImportSettingCmp, MatProgressSpinnerModule],
  templateUrl: './invitation-setting.cmp.html',
  styleUrl: './invitation-setting.cmp.css',
})
export class InvitationSettingCmp implements OnInit {
  readonly invitationDataService = inject(InvitationDataService);

  private readonly dialog = inject(MatDialog);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();

    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }

    try {
      await this.invitationDataService.loadSettings(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }
}
