import type { FirestoreTimestamp } from './firestore-types';

export type RegistrationFormType =
  | 'new_application'
  | 'qualification_acquisition_office'
  | 'qualification_acquisition'
  | 'qualification_loss'
  | 'dependent_change'
  | 'national_pension_type3'
  | 'teiji_santei'
  | 'monthly_change'
  | 'bonus_payment'
  | 'maternity_leave'
  | 'childcare_leave';

export interface RegistrationFilingEmployeeSnapshot {
  eid: string;
  employeeId: string;
  displayName: string;
  realName: {
    lastName: string;
    firstName: string;
    lastNameKana: string;
    firstNameKana: string;
  };
  birthDate: string | null;
  basicPensionNumber: string;
  joinedAt: string | null;
  resignAt: string | null;
  licenseStartAt: string | null;
  licenseEndAt: string | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
  employmentType: string;
  payType: string;
  status: string;
  hasDependents: boolean;
  dependentsInfo: unknown[];
}

export interface RegistrationFilingTenantSnapshot {
  tenantName: string;
  tenantNameKana: string;
  zipcode: string;
  address: {
    address1: string;
    address2: string;
    address3: string;
  };
  ownerName: {
    ownerLastName: string;
    ownerFirstName: string;
    ownerLastNameKana: string;
    ownerFirstNameKana: string;
  };
  phoneNumber: {
    tel1: string;
    tel2: string;
    tel3: string;
  };
  socialInsuranceSettings: Record<string, unknown>;
}

export interface RegistrationFilingDocument {
  formType: RegistrationFormType;
  formLabel: string;
  categoryId: number;
  status: 'created';
  eids: string[];
  employees: RegistrationFilingEmployeeSnapshot[];
  tenantSnapshot: RegistrationFilingTenantSnapshot;
  formPayload: Record<string, unknown>;
  createdAt: FirestoreTimestamp;
  createdBy: string;
}

export type RegistrationFilingSavePayload = Omit<
  RegistrationFilingDocument,
  'createdAt'
>;
