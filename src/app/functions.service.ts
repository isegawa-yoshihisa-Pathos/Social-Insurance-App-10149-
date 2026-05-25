import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root',
})
export class FunctionsService {
  private readonly functions = inject(Functions);

  private registerFn = httpsCallable(this.functions, 'registerAdminAndTenant');

  private saveInvitationImportSettingsFn = httpsCallable(this.functions, 'saveInvitationImportSettings');

  private saveInvitationTemplateFn = httpsCallable(this.functions, 'saveInvitationTemplate');

  private sendInvitationMailFn = httpsCallable(this.functions, 'sendInvitationMail');

  private validateInvitationTokenFn = httpsCallable(this.functions, 'validateInvitationToken');

  private acceptInvitationFn = httpsCallable(this.functions, 'acceptInvitation');

  async registerAdminAndTenant(payload: any) {
    return await this.registerFn(payload);
  }

  async saveInvitationImportSettings(payload: {
    eid: string;
    nameHeaders: string[];
    emailHeaders: string[];
  }) {
    return await this.saveInvitationImportSettingsFn(payload);
  }

  async saveInvitationTemplate(payload: {
    eid: string;
    templateText: string;
    replyToEmail: string;
  }) {
    return await this.saveInvitationTemplateFn(payload);
  }

  async sendInvitationMail(payload: {
    eid: string;
    email: string;
    name: string;
    role: 'admin' | 'member';
  }) {
    return await this.sendInvitationMailFn(payload);
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
}
