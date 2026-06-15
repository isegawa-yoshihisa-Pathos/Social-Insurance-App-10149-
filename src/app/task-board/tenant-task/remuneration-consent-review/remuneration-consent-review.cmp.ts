import { DecimalPipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { FunctionsService } from '../../../functions.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import {
  RemunerationConsentDataService,
  RemunerationConsentReviewItem,
  remunerationConsentStatusLabel,
  remunerationConsentTypeLabel,
} from '../../remuneration-consent-data.service';

@Component({
  selector: 'app-remuneration-consent-review',
  imports: [MatButtonModule, DecimalPipe],
  templateUrl: './remuneration-consent-review.cmp.html',
  styleUrl: './remuneration-consent-review.cmp.css',
})
export class RemunerationConsentReviewCmp {
  private readonly consentDataService = inject(RemunerationConsentDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly functionsService = inject(FunctionsService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  reviews: RemunerationConsentReviewItem[] = [];
  readonly typeLabel = remunerationConsentTypeLabel;
  readonly statusLabel = remunerationConsentStatusLabel;

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

  canApprove(review: RemunerationConsentReviewItem): boolean {
    return review.status === 'pending_admin_review';
  }

  /** 本人同意前でも、管理者判断で却下できる */
  canReject(review: RemunerationConsentReviewItem): boolean {
    return (
      review.status === 'pending_admin_review' ||
      review.status === 'pending_employee_consent'
    );
  }

  async approve(review: RemunerationConsentReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.functionsService.approveRemunerationConsentReview({
        tid,
        reviewId: review.id,
      });
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            `${review.employeeDisplayName || '対象従業員'}様の` +
            `${this.typeLabel(review.type)}を承認・適用しました（${review.effectiveFrom}）。`,
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

  async reject(review: RemunerationConsentReviewItem): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.functionsService.rejectRemunerationConsentReview({
        tid,
        reviewId: review.id,
      });
      const message =
        review.status === 'pending_employee_consent'
          ? `${review.employeeDisplayName || '対象従業員'}様の同意確認を管理者判断により却下しました。` +
            '従業員への同意依頼は取り消されます。'
          : `${review.employeeDisplayName || '対象従業員'}様の申請を却下しました。`;
      this.dialog.open(SuccessDialogCmp, {
        data: { message },
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
      this.reviews = await this.consentDataService.listActiveAdminConsentStatuses(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}
