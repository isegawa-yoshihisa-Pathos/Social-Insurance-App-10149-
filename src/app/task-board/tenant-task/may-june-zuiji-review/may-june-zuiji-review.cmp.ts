import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { FunctionsService } from '../../../functions.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import {
  MayJuneZuijiReviewDataService,
  MayJuneZuijiReviewItem,
  mayJuneZuijiStatusLabel,
} from './may-june-zuiji-review-data.service';

@Component({
  selector: 'app-may-june-zuiji-review',
  imports: [MatButtonModule],
  templateUrl: './may-june-zuiji-review.cmp.html',
  styleUrl: './may-june-zuiji-review.cmp.css',
})
export class MayJuneZuijiReviewCmp implements OnInit {
  private readonly reviewDataService = inject(MayJuneZuijiReviewDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly functionsService = inject(FunctionsService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  reviews: MayJuneZuijiReviewItem[] = [];
  readonly statusLabel = mayJuneZuijiStatusLabel;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  isPending(review: MayJuneZuijiReviewItem): boolean {
    return review.status === 'pending_review';
  }

  raiseMonthLabel(review: MayJuneZuijiReviewItem): string {
    const month = Number(review.raiseMonthYyyyMm.slice(5, 7));
    return `${month}月`;
  }

  effectiveMonthLabel(review: MayJuneZuijiReviewItem): string {
    const month = Number(review.effectiveYyyyMm.slice(5, 7));
    return `${month}月（${review.effectiveYyyyMm}）`;
  }

  isJuneRaise(review: MayJuneZuijiReviewItem): boolean {
    return Number(review.raiseMonthYyyyMm.slice(5, 7)) === 6;
  }

  reviewNote(review: MayJuneZuijiReviewItem): string {
    if (this.isJuneRaise(review)) {
      return (
        '承認すると6月の定時決定（9月適用）は取り消され、仮随時が生成されます。' +
        '随時改定は3ヶ月分のデータが揃った計算時に自動確定されます。'
      );
    }
    return (
      '承認すると6月の定時決定は省略されます。' +
      '随時改定は3ヶ月分のデータが揃った計算時に自動確定されます。'
    );
  }

  async approve(review: MayJuneZuijiReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.functionsService.approveMayJuneZuijiReview({
        tid,
        eid: review.eid,
        raiseMonthYyyyMm: review.raiseMonthYyyyMm,
      });
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            `${review.employeeDisplayName || '対象従業員'}様の随時改定を承認しました。` +
            (this.isJuneRaise(review)
              ? '6月の定時決定（9月適用）は取り消されました。'
              : '6月の定時決定は省略されます。') +
            `随時改定は${this.effectiveMonthLabel(review)}の適用に向け、データが揃った計算時に確定されます。`,
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

  async reject(review: MayJuneZuijiReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.functionsService.rejectMayJuneZuijiReview({
        tid,
        eid: review.eid,
        raiseMonthYyyyMm: review.raiseMonthYyyyMm,
      });
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            `${review.employeeDisplayName || '対象従業員'}様の随時改定を却下しました。` +
            (this.isJuneRaise(review)
              ? '6月の定時決定が採用されます。'
              : '6月の定時決定が行われます。'),
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

  async deleteReview(review: MayJuneZuijiReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.reviewDataService.deleteReview(tid, review.id);
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            '確認タスクを削除しました。再計算時に条件を満たせばタスクが再生成されます。',
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
