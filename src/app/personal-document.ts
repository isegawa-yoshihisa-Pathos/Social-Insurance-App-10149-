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

export interface AccountPersonalInfo {
  realName: RealName;
  myNumber: string;
  basicPensionNumber: string;
  birthDate: string;
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
  birthDate: string;
  phoneNumber: PhoneNumber;
  zipcode: string;
  address: Address;
  department?: string;
  position?: string;
  updatedAt?: Timestamp;
}

export type AccountPersonalInfoSavePayload = Omit<AccountPersonalInfo, 'updatedAt'>;
export type EmployeePersonalInfoSavePayload = Omit<EmployeePersonalInfo, 'updatedAt'>;