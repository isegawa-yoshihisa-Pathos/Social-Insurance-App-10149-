import { Timestamp } from '@angular/fire/firestore';

export interface RealName {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
}

export interface PhoneNumber {
  tel1: string;
  tel2: string;
  tel3: string;
}

export interface Address {
  address1: string;
  address2: string;
  address3: string;
}

export type DependentRelationship = 'spouse' | 'other' | '';

export interface DependentInfo {
  realName: RealName;
  birthDate: Timestamp | null;
  relationship: DependentRelationship;
}

export interface AccountPersonalInfo {
  realName: RealName;
  myNumber: string;
  basicPensionNumber: string;
  birthDate: Timestamp | null;
  phoneNumber: PhoneNumber;
  zipcode: string;
  address: Address;
  updatedAt?: Timestamp;
}

export interface EmployeePersonalInfo {
  displayName: string;
  realName: RealName;
  myNumber: string;
  basicPensionNumber: string;
  birthDate: Timestamp | null;
  phoneNumber: PhoneNumber;
  zipcode: string;
  address: Address;
  updatedAt?: Timestamp;

  allowances?: Record<string, number>;
  hasDependents: boolean;
  dependentsInfo: DependentInfo[];
}

export type AccountPersonalInfoSavePayload = Omit<AccountPersonalInfo, 'updatedAt'>;
export type EmployeePersonalInfoSavePayload = Omit<EmployeePersonalInfo, 'updatedAt'>;

export const DEPENDENT_RELATIONSHIP_LABELS: Record<DependentRelationship, string> = {
  '': '未設定',
  spouse: '配偶者',
  other: 'その他',
};
