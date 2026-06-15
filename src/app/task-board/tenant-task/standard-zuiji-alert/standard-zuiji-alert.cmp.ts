import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import {
  StandardZuijiAlertDataService,
  StandardZuijiAlertItem,
} from './standard-zuiji-alert-data.service';

@Component({
  selector: 'app-standard-zuiji-alert',
  imports: [MatButtonModule],
  templateUrl: './standard-zuiji-alert.cmp.html',
  styleUrl: './standard-zuiji-alert.cmp.css',
})
export class StandardZuijiAlertCmp implements OnInit {
  private readonly alertDataService = inject(StandardZuijiAlertDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  alerts: StandardZuijiAlertItem[] = [];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  changeMonthLabel(alert: StandardZuijiAlertItem): string {
    const month = Number(alert.changeMonthYyyyMm.slice(5, 7));
    return `${month}月（${alert.changeMonthYyyyMm}）`;
  }

  effectiveMonthLabel(alert: StandardZuijiAlertItem): string {
    const month = Number(alert.effectiveYyyyMm.slice(5, 7));
    return `${month}月（${alert.effectiveYyyyMm}）`;
  }

  async deleteAlert(alert: StandardZuijiAlertItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = alert.id;
    try {
      await this.alertDataService.deleteAlert(tid, alert.id);
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            '随時改定アラートを削除しました。再計算時に条件を満たせば再生成されます。',
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
