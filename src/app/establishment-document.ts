import { Timestamp } from '@angular/fire/firestore';

export interface PayrollSettings {
    closingDay: string,
    payday: string,
}

export interface SocialInsuranceSettings {
  healthInsuranceType: 'association' | 'combination',
  combinationName?: string,
  healthInsuranceEstablishmentRecordNumber: string,
  pensionInsuranceEstablishmentNumber: string,
  pensionInsuranceEstablishmentRecordNumber: string,

  socialInsuranceCollectionMonth: string,
  specificInsuranceCollectionType: string,

  healthInsuranceRate: string,
  healthInsuranceIndividualRate: string,

  careInsuranceRate: string,
  careInsuranceIndividualRate: string,

  pensionInsuranceRate: string,
  pensionInsuranceIndividualRate: string,
}


export interface EstablishmentDocument {
    establishmentName: string,
    zipcode: string,
    address: {
      address1: string,
      address2: string,
      address3: string,
    },
    ownerName: string,
    phoneNumber: {
      tel1: string,
      tel2: string,
      tel3: string,
    },
    corporateNumber: string,

    createdAt?: Timestamp,
    updatedAt?: Timestamp,

    payrollSettings?: PayrollSettings,
    socialInsuranceSettings?: SocialInsuranceSettings,
  }

export type EstablishmentSavePayload = Omit<
  EstablishmentDocument,
  'createdAt' | 'updatedAt'
>;