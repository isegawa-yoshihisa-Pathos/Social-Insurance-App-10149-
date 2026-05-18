import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root',
})
export class FunctionsService {
  private readonly functions = inject(Functions);

  private registerFn = httpsCallable(this.functions, 'registerAdminAndEstablishment');

  async registerAdminAndEstablishment(payload: any) {
    return await this.registerFn(payload);
  }
}
