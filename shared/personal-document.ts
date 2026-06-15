import type { FirestoreTimestamp } from './firestore-types';

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
  birthDate: FirestoreTimestamp | null;
  relationship: DependentRelationship;
}

export interface EmployeePersonalInfo {
  displayName: string;
  realName: RealName;
  myNumber: string;
  basicPensionNumber: string;
  birthDate: FirestoreTimestamp | null;
  phoneNumber: PhoneNumber;
  zipcode: string;
  address: Address;
  updatedAt?: FirestoreTimestamp;
  allowances?: Record<string, number>;
  hasDependents: boolean;
  dependentsInfo: DependentInfo[];
}

export interface AccountPersonalInfo {
  realName: RealName;
  myNumber: string;
  basicPensionNumber: string;
  birthDate: FirestoreTimestamp | null;
  phoneNumber: PhoneNumber;
  zipcode: string;
  address: Address;
  updatedAt?: FirestoreTimestamp;
}

export type AccountPersonalInfoSavePayload = Omit<AccountPersonalInfo, 'updatedAt'>;
export type EmployeePersonalInfoSavePayload = Omit<EmployeePersonalInfo, 'updatedAt'>;
