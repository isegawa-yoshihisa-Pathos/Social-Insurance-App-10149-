import {
  TenantDocument,
  TenantSavePayload,
  PayrollSettings,
  SocialInsuranceSettings,
} from './tenant-document';

export interface OwnerNameForm {
  ownerLastName: string;
  ownerFirstName: string;
  ownerLastNameKana: string;
  ownerFirstNameKana: string;
}

export interface TenantFormData {
  tenantName: string;
  tenantNameKana: string;
  zipcode: string;
  address: {
    address1: string;
    address2: string;
    address3: string;
  };
  ownerName: OwnerNameForm;
  phoneNumber: {
    tel1: string;
    tel2: string;
    tel3: string;
  };
  phoneNumberRaw: string;
  corporateNumber: string;
  payrollSettings: PayrollSettings;
  socialInsuranceSettings: SocialInsuranceSettings;
}

export function createDefaultOwnerName(): OwnerNameForm {
  return {
    ownerLastName: '',
    ownerFirstName: '',
    ownerLastNameKana: '',
    ownerFirstNameKana: '',
  };
}

export function createDefaultPayrollSettings(): PayrollSettings {
  return { closingDay: '', payday: '' };
}

export function createDefaultSocialInsuranceSettings(): SocialInsuranceSettings {
  return {
    healthInsuranceType: 'association',
    combinationName: '',
    healthInsuranceTenantRecordNumber: '',
    pensionInsuranceTenantNumber: '',
    pensionInsuranceTenantRecordNumber: '',
    socialInsuranceCollectionMonth: 'nextMonth',
    specificInsuranceCollectionType: 'false',
  };
}

export function createEmptyTenantForm(): TenantFormData {
  return {
    tenantName: '',
    tenantNameKana: '',
    zipcode: '',
    address: { address1: '', address2: '', address3: '' },
    ownerName: createDefaultOwnerName(),
    phoneNumber: { tel1: '', tel2: '', tel3: '' },
    phoneNumberRaw: '',
    corporateNumber: '',
    payrollSettings: createDefaultPayrollSettings(),
    socialInsuranceSettings: createDefaultSocialInsuranceSettings(),
  };
}

export function tenantDocToForm(doc: TenantDocument): TenantFormData {
  const phone = doc.phoneNumber ?? { tel1: '', tel2: '', tel3: '' };
  const phoneNumberRaw =
    phone.tel1 && phone.tel2 && phone.tel3
      ? `${phone.tel1}-${phone.tel2}-${phone.tel3}`
      : '';

  return {
    tenantName: doc.tenantName ?? '',
    tenantNameKana: doc.tenantNameKana ?? '',
    zipcode: doc.zipcode ?? '',
    address: {
      address1: doc.address?.address1 ?? '',
      address2: doc.address?.address2 ?? '',
      address3: doc.address?.address3 ?? '',
    },
    ownerName: {
      ...createDefaultOwnerName(),
      ...doc.ownerName,
    },
    phoneNumber: phone,
    phoneNumberRaw,
    corporateNumber: doc.corporateNumber ?? '',
    payrollSettings: doc.payrollSettings ?? createDefaultPayrollSettings(),
    socialInsuranceSettings: {
      ...createDefaultSocialInsuranceSettings(),
      ...doc.socialInsuranceSettings,
    },
  };
}

export function tenantFormToSavePayload(
  form: TenantFormData,
): TenantSavePayload {
  const { phoneNumberRaw: _, ...rest } = form;

  return {
    tenantName: rest.tenantName,
    tenantNameKana: rest.tenantNameKana,
    zipcode: rest.zipcode,
    address: rest.address,
    ownerName: rest.ownerName,
    phoneNumber: rest.phoneNumber,
    corporateNumber: rest.corporateNumber,
    payrollSettings: rest.payrollSettings,
    socialInsuranceSettings: {
      ...rest.socialInsuranceSettings,
      combinationName:
        rest.socialInsuranceSettings.healthInsuranceType === 'combination'
          ? rest.socialInsuranceSettings.combinationName
          : '',
    },
  };
}

export function parsePhoneNumberRaw(raw: string): {
  tel1: string;
  tel2: string;
  tel3: string;
} {
  const parts = raw.split('-');
  if (parts.length === 3) {
    return { tel1: parts[0], tel2: parts[1], tel3: parts[2] };
  }
  return { tel1: '', tel2: '', tel3: '' };
}