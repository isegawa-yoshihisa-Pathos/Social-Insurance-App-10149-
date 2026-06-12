import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { FunctionsService } from '../../../functions.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import {
  RemunerationConsentDataService,
  RemunerationConsentReviewItem,
  remunerationConsentTypeLabel,
} from '../../remuneration-consent-data.service';

@Component({
  selector: 'app-remuneration-consent-review',
  imports: [MatButtonModule, DecimalPipe],
  templateUrl: './remuneration-consent-review.cmp.html',
  styleUrl: './remuneration-consent-review.cmp.css',
})
export class RemunerationConsentReviewCmp implements OnInit {
  private readonly consentDataService = inject(RemunerationConsentDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly functionsService = inject(FunctionsService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  reviews: RemunerationConsentReviewItem[] = [];
  readonly typeLabel = remunerationConsentTypeLabel;

  async ngOnInit(): Promise<void> {
    await this.reload();
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
      await this.reload();
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
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message: `${review.employeeDisplayName || '対象従業員'}様の申請を却下しました。`,
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
      this.reviews = await this.consentDataService.listPendingAdminReviews(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}
