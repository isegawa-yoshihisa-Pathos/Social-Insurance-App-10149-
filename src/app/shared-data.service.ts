import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SharedDataService {
  private signupData: any = null;
  private establishmentData: any = null;

  setSignupData(data: any): void {
    this.signupData = data;
  }

  getSignupData(): any {
    return this.signupData;
  }

  clearSignupData(): void {
    this.signupData = null;
  }

  setEstablishmentData(data: any): void {
    this.establishmentData = data;
  }

  getEstablishmentData(): any {
    return this.establishmentData;
  }

  clearEstablishmentData(): void {
    this.establishmentData = null;
  }
}
