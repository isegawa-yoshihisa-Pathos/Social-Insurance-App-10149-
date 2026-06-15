import { Timestamp } from '@angular/fire/firestore';

export interface SocialInsuranceSettings {
  corporateNumber: string,
  healthInsuranceType: 'association' | 'combination',
  combinationCode?: string,
  combinationName?: string,
  healthInsuranceTenantRecordNumber: string,
  pensionInsuranceTenantNumber: string,
  pensionInsuranceTenantRecordNumber: string,
  closingDay: string,
  payrollBaseDaysStandard: 'closingDay' | 'calendarDay',
  socialInsuranceCollectionMonth: 'currentMonth' | 'nextMonth' | 'nextNextMonth',
  payrollPaymentMonth?: 'currentMonth' | 'nextMonth',
  resignPremiumCollection?: 'bulk' | 'monthly',
  specificInsuranceCollectionType: string,
}

export interface OwnerName {
  ownerLastName: string;
  ownerFirstName: string;
  ownerLastNameKana: string;
  ownerFirstNameKana: string;
}
export interface TenantDocument {
  tenantName: string;
  tenantNameKana: string;
  zipcode: string;
  address: {
    address1: string;
    address2: string;
    address3: string;
  };
  ownerName: OwnerName;
  phoneNumber: {
    tel1: string;
    tel2: string;
    tel3: string;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  socialInsuranceSettings?: SocialInsuranceSettings;
}

export type TenantSavePayload = Omit<
  TenantDocument,
  'createdAt' | 'updatedAt'
>;