import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { FunctionsService } from '../../../functions.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import {
  BonusRemunerationMismatchReviewDataService,
  BonusRemunerationMismatchReviewItem,
  bonusRemunerationMismatchStatusLabel,
} from './bonus-remuneration-mismatch-review-data.service';

@Component({
  selector: 'app-bonus-remuneration-mismatch-review',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './bonus-remuneration-mismatch-review.cmp.html',
  styleUrl: './bonus-remuneration-mismatch-review.cmp.css',
})
export class BonusRemunerationMismatchReviewCmp implements OnInit {
  private readonly reviewDataService = inject(BonusRemunerationMismatchReviewDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly functionsService = inject(FunctionsService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  reviews: BonusRemunerationMismatchReviewItem[] = [];
  readonly statusLabel = bonusRemunerationMismatchStatusLabel;
  customAmountByReviewId: Record<string, string | number> = {};

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  isPending(review: BonusRemunerationMismatchReviewItem): boolean {
    return review.status === 'pending_review';
  }

  formatAmount(value: number): string {
    return value.toLocaleString('ja-JP');
  }

  customAmountFor(reviewId: string): string {
    const value = this.customAmountByReviewId[reviewId];
    if (value == null || value === '') return '';
    return String(value);
  }

  setCustomAmount(reviewId: string, value: string | number): void {
    this.customAmountByReviewId[reviewId] = value;
  }

  async resolve(
    review: BonusRemunerationMismatchReviewItem,
    applyChoice: 'computed' | 'stored' | 'custom',
    recalculatePremium: boolean,
    customBonusRelatedRemuneration?: number,
  ): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.functionsService.resolveBonusRemunerationMismatchReview({
        tid,
        eid: review.eid,
        teijiYear: review.teijiYear,
        applyChoice,
        customBonusRelatedRemuneration,
        recalculatePremium,
      });

      const actionLabel =
        applyChoice === 'computed'
          ? '実績算定値で判定を行います。'
          : applyChoice === 'stored'
            ? '6月時点の入力値で判定を行います。'
            : `任意の値（${this.formatAmount(customBonusRelatedRemuneration ?? 0)} 円）で判定を行います。`;
      const recalcLabel = recalculatePremium
        ? `${review.screeningYyyyMm} の標準報酬・保険料を再計算しました。`
        : '';

      this.dialog.open(SuccessDialogCmp, {
        data: {
          message: `${review.employeeDisplayName || '対象従業員'}様: ${actionLabel}${recalcLabel}`,
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

  async resolveCustom(review: BonusRemunerationMismatchReviewItem): Promise<void> {
    const raw = this.customAmountFor(review.id).replace(/,/g, '').trim();
    if (raw === '') {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '任意の値を0以上の数値で入力してください。' },
      });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '任意の値を0以上の数値で入力してください。' },
      });
      return;
    }
    await this.resolve(review, 'custom', true, Math.floor(parsed));
  }

  async deleteReview(review: BonusRemunerationMismatchReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.reviewDataService.deleteReview(tid, review.id);
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message: '確認タスクを削除しました。再計算時に条件を満たせばタスクが再生成されます。',
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
      this.reviews = await this.reviewDataService.listReviews(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}
