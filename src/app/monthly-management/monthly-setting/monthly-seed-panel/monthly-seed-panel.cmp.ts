import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { MonthlyRecordsSeedService } from '../../monthly-records-seed/monthly-records-seed.service';

@Component({
  selector: 'app-monthly-seed-panel',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './monthly-seed-panel.cmp.html',
  styleUrl: './monthly-seed-panel.cmp.css',
})
export class MonthlySeedPanelCmp {
  private readonly seedService = inject(MonthlyRecordsSeedService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);

  busy = false;
  message = '';

  async runSeed(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.message = 'テナントが選択されていません。';
      return;
    }

    this.busy = true;
    this.message = '';
    try {
      const count = await this.seedService.seedSampleMonthlyRecords(tid);
      this.message = `投入完了: ${count} 件（${tid} / 2026-01〜2026-06 / 8名）`;
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.busy = false;
    }
  }
}
