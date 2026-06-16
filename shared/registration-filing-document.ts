import type { FirestoreTimestamp } from './firestore-types';
import type { DependentInfo } from './personal-document';

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
  myNumber: string;
  zipcode: string;
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

export interface RegistrationMonthlyBreakdown {
  yyyyMm: string;
  paymentBaseDays: number;
  currencyAmount: number;
  inKindAmount: number;
  totalAmount: number;
}

export interface RegistrationStandardRemunerationPayload {
  yyyyMm: string;
  healthGrade: number;
  pensionGrade: number;
  standardRemuneration: { health: number; pension: number };
  source: string;
  effectiveFrom: string;
  remuneration?: number;
  previousHealthGrade?: number;
  previousPensionGrade?: number;
  previousEffectiveFrom?: string;
  raiseMonthYyyyMm?: string;
  raiseDirection?: 'increase' | 'decrease';
  retroactivePayMonth?: string;
  retroactivePayAmount?: number;
  months: RegistrationMonthlyBreakdown[];
  totalRemuneration?: number;
  averageRemuneration?: number;
}

export interface RegistrationStandardBonusPayload {
  yyyyMm: string;
  standardBonus: { health: number; pension: number };
  bonusAmount: number;
  rawStandardBonus?: number;
  effectiveFrom: string;
  source: string;
  currencyAmount: number;
  inKindAmount: number;
  paymentDate: string;
}

export interface RegistrationQualificationAcquisitionPayload {
  kind: 'qualification_acquisition';
  acquisitionDate: string | null;
  currencyAmount?: number;
  inKindAmount?: number;
  totalAmount?: number;
  hasDependents?: boolean;
}

export interface RegistrationQualificationLossPayload {
  kind: 'qualification_loss';
  lossDate: string | null;
  resignDate?: string | null;
  lossReason?: string;
}

export interface RegistrationDependentChangePayload {
  kind: 'dependent_change';
  changeType?: '1' | '2' | '3';
  dependentsInfo?: unknown[];
}

export interface RegistrationNationalPensionType3Payload {
  kind: 'national_pension_type3';
  changeType?: '1' | '2' | '3';
  dependentsInfo?: unknown[];
}

export interface RegistrationLeaveRecordSnapshot {
  type: 'maternity' | 'childcare';
  startAt: string | null;
  endAt: string | null;
  reason?: string;
}

export interface RegistrationLeavePayload {
  kind: 'maternity_leave' | 'childcare_leave';
  leaveRecords: RegistrationLeaveRecordSnapshot[];
  dependentsInfo?: DependentInfo[];
  expectedDueDate?: string | null;
  multipleBirth?: boolean;
}

export type RegistrationCsvFormType =
  | 'qualification_acquisition'
  | 'qualification_loss'
  | 'dependent_change'
  | 'national_pension_type3'
  | 'teiji_santei'
  | 'monthly_change'
  | 'bonus_payment'
  | 'maternity_leave'
  | 'childcare_leave';

export const REGISTRATION_CSV_FORM_TYPES: readonly RegistrationCsvFormType[] = [
  'qualification_acquisition',
  'qualification_loss',
  'dependent_change',
  'national_pension_type3',
  'teiji_santei',
  'monthly_change',
  'bonus_payment',
  'maternity_leave',
  'childcare_leave',
];

export function isRegistrationCsvFormType(
  formType: RegistrationFormType,
): formType is RegistrationCsvFormType {
  return (REGISTRATION_CSV_FORM_TYPES as readonly string[]).includes(formType);
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
