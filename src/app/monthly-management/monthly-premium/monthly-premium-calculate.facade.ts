import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { FunctionsService } from '../../functions.service';

@Injectable({ providedIn: 'root' })
export class MonthlyPremiumCalculateFacade {
  private readonly dialog = inject(MatDialog);
  private readonly functionsService = inject(FunctionsService);
  private readonly snackBar = inject(MatSnackBar);

  async calculateMonth(tid: string, yyyyMm: string, _reload: () => Promise<void>): Promise<void> {
    try {
      const { total } = await this.functionsService.startPremiumCalculationBatch({
        tid,
        kind: 'monthly',
        yyyyMm,
      });

      this.snackBar.open(
        `${total}件の保険料計算を開始しました。完了は通知で確認できます。`,
        '閉じる',
        { duration: 6000 },
      );
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }
}