import {
  AccountPersonalInfo,
  AccountPersonalInfoSavePayload,
  Address,
  DependentInfo,
  DependentRelationship,
  EmployeePersonalInfo,
  EmployeePersonalInfoSavePayload,
  PhoneNumber,
  RealName,
} from './personal-document';
import { toFirestoreTimestamp, toFormDate } from './date-utils';

export interface PersonalFormData {
  realName: RealName;
  myNumber: string;
  basicPensionNumber: string;
  birthDate: Date | null;
  phoneNumber: PhoneNumber;
  phoneNumberRaw: string;
  zipcode: string;
  address: Address;
}

export interface DependentFormData {
  realName: RealName;
  birthDate: Date | null;
  relationship: DependentRelationship;
}

export interface EmployeeFormData {
  displayName: string;
  realName: RealName;
  myNumber: string;
  basicPensionNumber: string;
  birthDate: Date | null;
  phoneNumber: PhoneNumber;
  phoneNumberRaw: string;
  zipcode: string;
  address: Address;
  allowances?: Record<string, number>;
  hasDependents: boolean;
  dependentsInfo: DependentFormData[];
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

export function createEmptyDependentForm(): DependentFormData {
  return {
    realName: createDefaultRealName(),
    birthDate: null,
    relationship: '',
  };
}

export function createEmptyPersonalForm(): PersonalFormData {
  return {
    realName: createDefaultRealName(),
    myNumber: '',
    basicPensionNumber: '',
    birthDate: null,
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
    birthDate: null,
    phoneNumber: createDefaultPhoneNumber(),
    phoneNumberRaw: '',
    zipcode: '',
    address: createDefaultAddress(),
    hasDependents: false,
    dependentsInfo: [],
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
    birthDate: toFormDate(doc?.birthDate),
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

function dependentInfoToForm(item: unknown): DependentFormData {
  if (typeof item === 'string' || item instanceof Date) {
    return {
      ...createEmptyDependentForm(),
      birthDate: toFormDate(item),
    };
  }

  const raw = item as Partial<DependentInfo> & { birthDate?: unknown };
  return {
    realName: {
      ...createDefaultRealName(),
      ...raw.realName,
    },
    birthDate: toFormDate(raw.birthDate),
    relationship: raw.relationship ?? '',
  };
}

export function dependentsInfoToForm(values: unknown): DependentFormData[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(dependentInfoToForm);
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
    birthDate: toFormDate(doc?.birthDate),
    phoneNumber: phone,
    phoneNumberRaw: phone.tel1 && phone.tel2 && phone.tel3
      ? `${phone.tel1}-${phone.tel2}-${phone.tel3}`
      : '',
    zipcode: doc?.zipcode ?? '',
    address: {
      ...createDefaultAddress(),
      ...doc?.address,
    },
    hasDependents: doc?.hasDependents ?? false,
    dependentsInfo: dependentsInfoToForm(doc?.dependentsInfo),
  };
}

function dependentFormToSave(form: DependentFormData): DependentInfo {
  return {
    realName: form.realName,
    birthDate: toFirestoreTimestamp(form.birthDate),
    relationship: form.relationship,
  };
}

function dependentsFormToSave(
  forms: DependentFormData[],
  hasDependents: boolean,
): DependentInfo[] {
  if (!hasDependents) {
    return [];
  }
  return forms
    .filter((item) => item.birthDate != null)
    .map(dependentFormToSave);
}

export function personalFormToSavePayload(
  form: PersonalFormData,
): AccountPersonalInfoSavePayload {
  return {
    realName: form.realName,
    myNumber: form.myNumber,
    basicPensionNumber: form.basicPensionNumber,
    birthDate: toFirestoreTimestamp(form.birthDate),
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
    birthDate: toFirestoreTimestamp(form.birthDate),
    phoneNumber: parsePhoneNumberRaw(form.phoneNumberRaw),
    zipcode: form.zipcode,
    address: form.address,
    hasDependents: form.hasDependents,
    dependentsInfo: dependentsFormToSave(form.dependentsInfo, form.hasDependents),
  };
}

export function parsePhoneNumberRaw(raw: string): PhoneNumber {
  const parts = raw.split('-');
  if (parts.length === 3) {
    return { tel1: parts[0], tel2: parts[1], tel3: parts[2] };
  }
  return createDefaultPhoneNumber();
}

export function formatDependentDisplayName(dependent: DependentFormData): string {
  const name = `${dependent.realName.lastName} ${dependent.realName.firstName}`.trim();
  return name || '—';
}
