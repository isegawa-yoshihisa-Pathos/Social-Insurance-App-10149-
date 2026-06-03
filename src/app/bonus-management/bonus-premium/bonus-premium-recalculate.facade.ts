import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BonusPremiumBatchService } from '../../social-insurance/bonus/bonus-premium-batch.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';

@Injectable({ providedIn: 'root' })
export class BonusPremiumRecalculateFacade {
  private readonly batchService = inject(BonusPremiumBatchService);
  private readonly dialog = inject(MatDialog);

  async recalculateMonth(tid: string, yyyyMm: string, reload: () => Promise<void>): Promise<void> {
    try {
      const { processed, errors } = await this.batchService.recalculateBonus(tid, yyyyMm);
      await reload();

      const errorLines =
        errors.length > 0 ? `\n失敗: ${errors.length}件\n${errors.slice(0, 5).join('\n')}` : '';

      this.dialog.open(SuccessDialogCmp, {
        data: { title: '保険料計算', message: `計算: ${processed}件${errorLines}` },
      });
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }
}