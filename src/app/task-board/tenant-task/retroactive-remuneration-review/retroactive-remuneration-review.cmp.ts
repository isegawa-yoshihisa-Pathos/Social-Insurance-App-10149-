import { DecimalPipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { FunctionsService } from '../../../functions.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import {
  RetroactiveRemunerationDataService,
  RetroactiveRemunerationReviewItem,
  retroactiveReviewStatusLabel,
  retroactiveReviewTypeLabel,
} from '../../retroactive-remuneration-data.service';
import {
  RetroactiveRemunerationAllocateDialogCmp,
  RetroactiveAllocateDialogResult,
} from './retroactive-remuneration-allocate-dialog.cmp';

@Component({
  selector: 'app-retroactive-remuneration-review',
  imports: [MatButtonModule, DecimalPipe],
  templateUrl: './retroactive-remuneration-review.cmp.html',
  styleUrl: './retroactive-remuneration-review.cmp.css',
})
export class RetroactiveRemunerationReviewCmp {
  private readonly dataService = inject(RetroactiveRemunerationDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly functionsService = inject(FunctionsService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  reviews: RetroactiveRemunerationReviewItem[] = [];
  readonly typeLabel = retroactiveReviewTypeLabel;
  readonly statusLabel = retroactiveReviewStatusLabel;

  constructor() {
    effect(() => {
      const tid = this.tenant.currentTid();
      if (!tid) {
        this.reviews = [];
        return;
      }
      void this.reload(tid);
    });
  }

  canAllocate(review: RetroactiveRemunerationReviewItem): boolean {
    return review.status === 'pending_admin';
  }

  isCompleted(review: RetroactiveRemunerationReviewItem): boolean {
    return review.status === 'recalculated' || review.status === 'skipped';
  }

  retroactiveTotal(review: RetroactiveRemunerationReviewItem): number {
    return review.items.reduce((s, item) => s + item.amount, 0);
  }

  async openAllocate(review: RetroactiveRemunerationReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    const ref = this.dialog.open(RetroactiveRemunerationAllocateDialogCmp, {
      data: { tid, review },
      width: '720px',
      maxWidth: '95vw',
    });

    const result = (await ref.afterClosed().toPromise()) as RetroactiveAllocateDialogResult | undefined;
    if (!result?.applied) return;

    this.dialog.open(SuccessDialogCmp, {
      data: {
        message:
          `${review.employeeDisplayName || '対象従業員'}様の遡及支払配分を反映し、標準報酬を再計算しました。` +
          (review.type === 'teiji'
            ? '保険料の再計算を実行してください。'
            : '年間平均候補の等級が更新されました。'),
      },
    });
    await this.reload(tid);
  }

  async skip(review: RetroactiveRemunerationReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.functionsService.skipRetroactiveRemunerationReview({
        tid,
        reviewId: review.id,
      });
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            `${review.employeeDisplayName || '対象従業員'}様の遡及支払レビューをスキップしました。` +
            '当初の計算結果のままとなります。',
        },
      });
      await this.reload(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busyId = null;
    }
  }

  async deleteReview(review: RetroactiveRemunerationReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.dataService.deleteReview(tid, review.id);
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            '遡及支払タスクを削除しました。再計算時に条件を満たせばタスクが再生成されます。',
        },
      });
      await this.reload(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busyId = null;
    }
  }

  private async reload(tid: string): Promise<void> {
    this.loading = true;
    try {
      this.reviews = await this.dataService.listAdminReviews(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}
