import {
    AccountPersonalInfo,
    AccountPersonalInfoSavePayload,
    Address,
    EmployeePersonalInfo,
    EmployeePersonalInfoSavePayload,
    PhoneNumber,
    RealName,
  } from './personal-document';
  
  export interface PersonalFormData {
    realName: RealName;
    myNumber: string;
    basicPensionNumber: string;
    birthDate: string;
    phoneNumber: PhoneNumber;
    phoneNumberRaw: string;
    zipcode: string;
    address: Address;
  }
  
  export interface EmployeeFormData {
    displayName: string;
    realName: RealName;
    myNumber: string;
    basicPensionNumber: string;
    birthDate: string;
    phoneNumber: PhoneNumber;
    phoneNumberRaw: string;
    zipcode: string;
    address: Address;
    department: string;
    position: string;
  }
  
  export function createDefaultRealName(): RealName {
    return {
      lastName: '',
      firstName: '',
      lastNameKana: '',
      firstNameKana: '',
    };
  }
  
  export function createDefaultPhoneNumber(): PhoneNumber {
    return { tel1: '', tel2: '', tel3: '' };
  }
  
  export function createDefaultAddress(): Address {
    return { address1: '', address2: '', address3: '' };
  }
  
  export function createEmptyPersonalForm(): PersonalFormData {
    return {
      realName: createDefaultRealName(),
      myNumber: '',
      basicPensionNumber: '',
      birthDate: '',
      phoneNumber: createDefaultPhoneNumber(),
      phoneNumberRaw: '',
      zipcode: '',
      address: createDefaultAddress(),
    };
  }
  
  export function createEmptyEmployeeForm(): EmployeeFormData {
    return {
      displayName: '',
      realName: createDefaultRealName(),
      myNumber: '',
      basicPensionNumber: '',
      birthDate: '',
      phoneNumber: createDefaultPhoneNumber(),
      phoneNumberRaw: '',
      zipcode: '',
      address: createDefaultAddress(),
      department: '',
      position: '',
    };
  }
  
  export function accountPersonalInfoToForm(
    doc?: Partial<AccountPersonalInfo>,
  ): PersonalFormData {
    const phone = doc?.phoneNumber ?? createDefaultPhoneNumber();
  
    return {
      realName: {
        ...createDefaultRealName(),
        ...doc?.realName,
      },
      myNumber: doc?.myNumber ?? '',
      basicPensionNumber: doc?.basicPensionNumber ?? '',
      birthDate: doc?.birthDate ?? '',
      phoneNumber: phone,
      phoneNumberRaw: phone.tel1 && phone.tel2 && phone.tel3
        ? `${phone.tel1}-${phone.tel2}-${phone.tel3}`
        : '',
      zipcode: doc?.zipcode ?? '',
      address: {
        ...createDefaultAddress(),
        ...doc?.address,
      },
    };
  }
  
  export function employeePersonalInfoToForm(
    doc?: Partial<EmployeePersonalInfo>,
  ): EmployeeFormData {
    const phone = doc?.phoneNumber ?? createDefaultPhoneNumber();
  
    return {
      displayName: doc?.displayName ?? '',
      realName: {
        ...createDefaultRealName(),
        ...doc?.realName,
      },
      myNumber: doc?.myNumber ?? '',
      basicPensionNumber: doc?.basicPensionNumber ?? '',
      birthDate: doc?.birthDate ?? '',
      phoneNumber: phone,
      phoneNumberRaw: phone.tel1 && phone.tel2 && phone.tel3
        ? `${phone.tel1}-${phone.tel2}-${phone.tel3}`
        : '',
      zipcode: doc?.zipcode ?? '',
      address: {
        ...createDefaultAddress(),
        ...doc?.address,
      },
      department: doc?.department ?? '',
      position: doc?.position ?? '',
    };
  }
  
  export function personalFormToSavePayload(
    form: PersonalFormData,
  ): AccountPersonalInfoSavePayload {
    return {
      realName: form.realName,
      myNumber: form.myNumber,
      basicPensionNumber: form.basicPensionNumber,
      birthDate: form.birthDate,
      phoneNumber: parsePhoneNumberRaw(form.phoneNumberRaw),
      zipcode: form.zipcode,
      address: form.address,
    };
  }
  
  export function employeeFormToSavePayload(
    form: EmployeeFormData,
  ): EmployeePersonalInfoSavePayload {
    return {
      displayName: form.displayName,
      realName: form.realName,
      myNumber: form.myNumber,
      basicPensionNumber: form.basicPensionNumber,
      birthDate: form.birthDate,
      phoneNumber: parsePhoneNumberRaw(form.phoneNumberRaw),
      zipcode: form.zipcode,
      address: form.address,
      department: form.department,
      position: form.position,
    };
  }
  
  export function parsePhoneNumberRaw(raw: string): PhoneNumber {
    const parts = raw.split('-');
    if (parts.length === 3) {
      return { tel1: parts[0], tel2: parts[1], tel3: parts[2] };
    }
    return createDefaultPhoneNumber();
  }