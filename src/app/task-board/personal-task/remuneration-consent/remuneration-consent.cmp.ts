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
  selector: 'app-remuneration-consent',
  imports: [MatButtonModule],
  templateUrl: './remuneration-consent.cmp.html',
  styleUrl: './remuneration-consent.cmp.css',
})
export class RemunerationConsentCmp implements OnInit {
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
    const eid = this.tenant.currentEmployeeId();
    if (!tid || !eid) return;

    this.loading = true;
    try {
      this.reviews = await this.consentDataService.listPendingEmployeeConsents(tid, eid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}
