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
  selector: 'app-remuneration-consent',
  imports: [MatButtonModule],
  templateUrl: './remuneration-consent.cmp.html',
  styleUrl: './remuneration-consent.cmp.css',
})
export class RemunerationConsentCmp {
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
      const eid = this.tenant.currentEid();
      if (!tid || !eid) {
        this.reviews = [];
        return;
      }
      void this.reload(tid, eid);
    });
  }

  canRespond(review: RemunerationConsentReviewItem): boolean {
    return review.status === 'pending_employee_consent';
  }

  async agree(review: RemunerationConsentReviewItem): Promise<void> {
    await this.submitConsent(review, 'agreed', '同意を送信しました。管理者の承認後に反映されます。');
  }

  async decline(review: RemunerationConsentReviewItem): Promise<void> {
    await this.submitConsent(review, 'declined', '不同意を送信しました。');
  }

  private async submitConsent(
    review: RemunerationConsentReviewItem,
    consent: 'agreed' | 'declined',
    successMessage: string,
  ): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = review.id;
    try {
      await this.functionsService.submitRemunerationConsentReview({
        tid,
        reviewId: review.id,
        consent,
      });
      this.dialog.open(SuccessDialogCmp, { data: { message: successMessage } });
      const eid = this.tenant.currentEid();
      if (eid) {
        await this.reload(tid, eid);
      }
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busyId = null;
    }
  }

  private async reload(tid: string, eid: string): Promise<void> {
    this.loading = true;
    try {
      this.reviews = await this.consentDataService.listEmployeeConsents(tid, eid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}
