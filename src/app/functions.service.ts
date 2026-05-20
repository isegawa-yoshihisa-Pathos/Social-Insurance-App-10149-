import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root',
})
export class FunctionsService {
  private readonly functions = inject(Functions);

  private registerFn = httpsCallable(this.functions, 'registerAdminAndEstablishment');

  private saveInvitationImportSettingsFn = httpsCallable(this.functions, 'saveInvitationImportSettings');

  private saveInvitationTemplateFn = httpsCallable(this.functions, 'saveInvitationTemplate');

  private sendInvitationMailFn = httpsCallable(this.functions, 'sendInvitationMail');

  async registerAdminAndEstablishment(payload: any) {
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
  }) {
    return await this.saveInvitationTemplateFn(payload);
  }

  async sendInvitationMail(payload: {
    eid: string;
    email: string;
    name: string;
    role: 'admin' | 'member';
    templateText: string;
  }) {
    return await this.sendInvitationMailFn(payload);
  }
}
