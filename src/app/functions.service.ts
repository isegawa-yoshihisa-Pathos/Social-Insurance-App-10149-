import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import type { RetroactivePayReviewItem } from '../../shared/social-insurance/remuneration/retroactive-remuneration';
import type { RetroactiveRemunerationProposedGrades } from '../../shared/retroactive-remuneration-review-document';

@Injectable({
  providedIn: 'root',
})
export class FunctionsService {
  private readonly functions = inject(Functions);

  private registerFn = httpsCallable(this.functions, 'registerAdminAndTenant');

  private registerTenantForExistingUserFn = httpsCallable(this.functions, 'registerTenantForExistingUser');

  private saveInvitationTemplateFn = httpsCallable(this.functions, 'saveInvitationTemplate');

  private startInvitationMailBatchFn = httpsCallable(this.functions, 'startInvitationMailBatch');

  private validateInvitationTokenFn = httpsCallable(this.functions, 'validateInvitationToken');

  private acceptInvitationFn = httpsCallable(this.functions, 'acceptInvitation');

  private startPremiumCalculationBatchFn = httpsCallable(this.functions, 'startPremiumCalculationBatch');

  private approveMayJuneZuijiReviewFn = httpsCallable(this.functions, 'approveMayJuneZuijiReview');

  private rejectMayJuneZuijiReviewFn = httpsCallable(this.functions, 'rejectMayJuneZuijiReview');

  private submitRemunerationConsentReviewFn = httpsCallable(this.functions, 'submitRemunerationConsentReview');

  private approveRemunerationConsentReviewFn = httpsCallable(this.functions, 'approveRemunerationConsentReview');

  private rejectRemunerationConsentReviewFn = httpsCallable(this.functions, 'rejectRemunerationConsentReview');

  private previewRetroactiveRemunerationRecalcFn = httpsCallable(
    this.functions,
    'previewRetroactiveRemunerationRecalc',
  );

  private applyRetroactiveRemunerationRecalcFn = httpsCallable(
    this.functions,
    'applyRetroactiveRemunerationRecalc',
  );

  private skipRetroactiveRemunerationReviewFn = httpsCallable(
    this.functions,
    'skipRetroactiveRemunerationReview',
  );
  
  private recalculatePremiumsAfterResignFn = httpsCallable(this.functions, 'recalculatePremiumsAfterResign');

  private requestEmployeeInputFn = httpsCallable(this.functions, 'requestEmployeeInput');

  private deliverPaymentStatementsFn = httpsCallable(this.functions, 'deliverPaymentStatements');

  async registerAdminAndTenant(payload: any) {
    return await this.registerFn(payload);
  }

  async registerTenantForExistingUser(payload: any) {
    return await this.registerTenantForExistingUserFn(payload);
  }

  async saveInvitationTemplate(payload: {
    tid: string;
    templateText: string;
    replyToEmail: string;
  }) {
    return await this.saveInvitationTemplateFn(payload);
  }

  async startInvitationMailBatch(payload: {
    tid: string;
    items: { email: string; name: string; role: 'admin' | 'member' }[];
  }) {
    const result = await this.startInvitationMailBatchFn(payload);
    return result.data as { jobId: string; total: number };
  }

  async validateInvitationToken(payload: {
    token: string;
    email: string;
  }) {
    return await this.validateInvitationTokenFn(payload);
  }

  async acceptInvitation(payload: {
    token: string;
    email: string;
    loginEmail: string;
    password?: string;
    mode: 'create' | 'link';
  }) {
    return await this.acceptInvitationFn(payload);
  }

  async startPremiumCalculationBatch(payload: {
    tid: string;
    kind: 'monthly' | 'bonus';
    yyyyMm: string;
    eids?: string[];
  }) {
    const result = await this.startPremiumCalculationBatchFn(payload);
    return result.data as { jobId: string; total: number };
  }

  async recalculatePremiumsAfterResign(payload: { tid: string; eid: string }) {
    const result = await this.recalculatePremiumsAfterResignFn(payload);
    return result.data as { status: 'ok'; recalculatedMonths: number };
  }

  async approveMayJuneZuijiReview(payload: {
    tid: string;
    eid: string;
    raiseMonthYyyyMm: string;
  }) {
    const result = await this.approveMayJuneZuijiReviewFn(payload);
    return result.data as { status: 'approved' };
  }

  async rejectMayJuneZuijiReview(payload: {
    tid: string;
    eid: string;
    raiseMonthYyyyMm: string;
  }) {
    const result = await this.rejectMayJuneZuijiReviewFn(payload);
    return result.data as { status: 'rejected' };
  }

  async submitRemunerationConsentReview(payload: {
    tid: string;
    reviewId: string;
    consent: 'agreed' | 'declined';
  }) {
    const result = await this.submitRemunerationConsentReviewFn(payload);
    return result.data as { status: string };
  }

  async approveRemunerationConsentReview(payload: { tid: string; reviewId: string }) {
    const result = await this.approveRemunerationConsentReviewFn(payload);
    return result.data as { status: 'approved' };
  }

  async rejectRemunerationConsentReview(payload: { tid: string; reviewId: string }) {
    const result = await this.rejectRemunerationConsentReviewFn(payload);
    return result.data as { status: 'rejected' };
  }

  async previewRetroactiveRemunerationRecalc(payload: {
    tid: string;
    reviewId: string;
    items: RetroactivePayReviewItem[];
  }) {
    const result = await this.previewRetroactiveRemunerationRecalcFn(payload);
    return result.data as {
      proposedGrades: RetroactiveRemunerationProposedGrades;
      originalGrades: RetroactiveRemunerationProposedGrades | null;
    };
  }

  async applyRetroactiveRemunerationRecalc(payload: {
    tid: string;
    reviewId: string;
    items: RetroactivePayReviewItem[];
  }) {
    const result = await this.applyRetroactiveRemunerationRecalcFn(payload);
    return result.data as {
      status: 'recalculated';
      proposedGrades: RetroactiveRemunerationProposedGrades;
    };
  }

  async skipRetroactiveRemunerationReview(payload: { tid: string; reviewId: string }) {
    const result = await this.skipRetroactiveRemunerationReviewFn(payload);
    return result.data as { status: 'skipped' };
  }

  async requestEmployeeInput(payload: {
    tid: string;
    eids: string[];
    field: 'myNumber' | 'basicPensionNumber' | 'birthDate' | 'hasDependents';
  }) {
    const result = await this.requestEmployeeInputFn(payload);
    return result.data as {
      notified: number;
      skippedNoAccount: number;
      skippedNotFound: number;
    };
  }

  async deliverPaymentStatements(payload: { tid: string; displayYyyyMm: string; eids?: string[] }) {
    const result = await this.deliverPaymentStatementsFn(payload);
    return result.data as {
      delivered: number;
      skippedNoAccount: number;
      skippedNoData: number;
    };
  }
}
