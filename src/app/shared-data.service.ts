import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SharedDataService {
  private signupData: any = null;
  private tenantData: any = null;

  setSignupData(data: any): void {
    this.signupData = data;
  }

  getSignupData(): any {
    return this.signupData;
  }

  clearSignupData(): void {
    this.signupData = null;
  }

  setTenantData(data: any): void {
    this.tenantData = data;
  }

  getTenantData(): any {
    return this.tenantData;
  }

  clearTenantData(): void {
    this.tenantData = null;
  }
}
