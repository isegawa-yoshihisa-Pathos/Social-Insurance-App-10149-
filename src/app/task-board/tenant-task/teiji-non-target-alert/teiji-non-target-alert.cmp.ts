import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import {
  TeijiNonTargetAlertDataService,
  TeijiNonTargetAlertItem,
  teijiNonTargetReasonLabel,
} from './teiji-non-target-alert-data.service';

@Component({
  selector: 'app-teiji-non-target-alert',
  imports: [MatButtonModule],
  templateUrl: './teiji-non-target-alert.cmp.html',
  styleUrl: './teiji-non-target-alert.cmp.css',
})
export class TeijiNonTargetAlertCmp implements OnInit {
  private readonly alertDataService = inject(TeijiNonTargetAlertDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  alerts: TeijiNonTargetAlertItem[] = [];
  readonly reasonLabel = teijiNonTargetReasonLabel;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async deleteAlert(alert: TeijiNonTargetAlertItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = alert.id;
    try {
      await this.alertDataService.deleteAlert(tid, alert.id);
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            '定時決定対象外アラートを削除しました。6月の再計算時に条件を満たせば再生成されます。',
        },
      });
      await this.reload();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busyId = null;
    }
  }

  private async reload(): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.loading = true;
    try {
      this.alerts = await this.alertDataService.listAlerts(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}
