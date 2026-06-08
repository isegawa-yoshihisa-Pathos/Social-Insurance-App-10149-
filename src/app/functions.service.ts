import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

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
}
