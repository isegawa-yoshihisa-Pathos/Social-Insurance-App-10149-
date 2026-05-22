import { Timestamp } from '@angular/fire/firestore';

export interface PayrollSettings {
    closingDay: string,
    payday: string,
}

export interface SocialInsuranceSettings {
  healthInsuranceType: 'association' | 'combination',
  combinationName?: string,
  healthInsuranceTenantRecordNumber: string,
  pensionInsuranceTenantNumber: string,
  pensionInsuranceTenantRecordNumber: string,

  socialInsuranceCollectionMonth: string,
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
  corporateNumber: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  payrollSettings?: PayrollSettings;
  socialInsuranceSettings?: SocialInsuranceSettings;
}

export type TenantSavePayload = Omit<
  TenantDocument,
  'createdAt' | 'updatedAt'
>;