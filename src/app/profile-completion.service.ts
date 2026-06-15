import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AccountPersonalInfo, EmployeePersonalInfo } from './personal-document';
import { PersonalFormData, EmployeeFormData, accountPersonalInfoToForm, employeePersonalInfoToForm } from './personal-form-data';
import { toFormDate } from './date-utils';
import { TenantDocument, SocialInsuranceSettings } from './tenant-document';
import { TenantFormData } from './tenant-form-data';
import { EmployeeDocument } from './employee-document';

export interface ProfileCompletionState {
  personal: boolean;
  employee: boolean;
  tenant: boolean;
  socialInsuranceSettings: boolean;
  any: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileCompletionService {
  private readonly firestore = inject(Firestore);

  readonly state = signal<ProfileCompletionState>({
    personal: false,
    employee: false,
    tenant: false,
    socialInsuranceSettings: false,
    any: false,
  });

  updateFromPersonalForms(
    personalForm: PersonalFormData,
    employeeForm: EmployeeFormData,
  ): void {
    const personalMissing = this.hasPersonalMissingFields(personalForm);
    const employeeMissing = this.hasEmployeeMissingFields(employeeForm);
    const tenantMissing = this.state().tenant;
    const socialInsuranceSettingsMissing = this.state().socialInsuranceSettings;

    this.state.set({
      personal: personalMissing,
      employee: employeeMissing,
      tenant: tenantMissing,
      socialInsuranceSettings: socialInsuranceSettingsMissing,
      any: personalMissing || employeeMissing || tenantMissing || socialInsuranceSettingsMissing,
    });
  }

  updateFromTenantForm(form: TenantFormData): void {
    const personalMissing = this.state().personal;
    const employeeMissing = this.state().employee;
    const tenantMissing = this.hasTenantMissingFields(form);
    const socialInsuranceSettingsMissing = this.hasSocialInsuranceSettingsMissingFields(form.socialInsuranceSettings);

    this.state.set({
      personal: personalMissing,
      employee: employeeMissing,
      tenant: tenantMissing,
      socialInsuranceSettings: socialInsuranceSettingsMissing,
      any: personalMissing || employeeMissing || tenantMissing || socialInsuranceSettingsMissing,
    });
  }

  async refresh(uid: string, tid: string): Promise<void> {
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    const account = accountSnap.data();

    const personal = account?.['personalInfo'] as Partial<AccountPersonalInfo> | undefined;
    const eid = account?.['affiliations']?.[tid] as string | undefined;

    const employeeSnap = eid
      ? await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid))
      : null;
    const employeeDoc = employeeSnap?.data() as Partial<EmployeeDocument> | undefined;
    const employee = employeeDoc?.employeePersonalInfo;

    const tenant = (await getDoc(
      doc(this.firestore, 'tenants', tid),
    )).data() as Partial<TenantDocument> | undefined;

    const socialInsuranceSettings = tenant?.socialInsuranceSettings as SocialInsuranceSettings | undefined;

    const personalForm = accountPersonalInfoToForm(personal);
    const employeeForm = employeePersonalInfoToForm(employee);

    const personalMissing = this.hasPersonalMissingFields(personalForm);
    const employeeMissing = this.hasEmployeeMissingFields(employeeForm);
    const tenantMissing = this.hasTenantDocumentMissingFields(tenant);
    const socialMissing = this.hasSocialInsuranceSettingsDocumentMissingFields(socialInsuranceSettings);

    this.state.set({
      personal: personalMissing,
      employee: employeeMissing,
      tenant: tenantMissing,
      socialInsuranceSettings: socialMissing,
      any: personalMissing || employeeMissing || tenantMissing || socialMissing,
    });
  }

  signOut(): void {
    this.state.set({
      personal: false,
      employee: false,
      tenant: false,
      socialInsuranceSettings: false,
      any: false,
    });
  }

  hasPersonalMissingFields(form: PersonalFormData): boolean {
    return (
      this.hasBlank([
        form.realName.lastName,
        form.realName.firstName,
        form.realName.lastNameKana,
        form.realName.firstNameKana,
        form.zipcode,
        form.address.address1,
        form.address.address2,
        form.phoneNumberRaw,
        form.myNumber,
      ]) || !form.birthDate
    );
  }

  hasEmployeeMissingFields(form: EmployeeFormData): boolean {
    return this.hasBlank([
      form.displayName,
      form.zipcode,
      form.address.address1,
      form.address.address2,
      form.phoneNumberRaw,
    ]);
  }

  hasTenantMissingFields(form: TenantFormData): boolean {
    return this.hasBlank([
      form.tenantName,
      form.tenantNameKana,
      form.zipcode,
      form.address.address1,
      form.address.address2,
      form.ownerName.ownerLastName,
      form.ownerName.ownerFirstName,
      form.ownerName.ownerLastNameKana,
      form.ownerName.ownerFirstNameKana,
      form.phoneNumberRaw,
    ]);
  }

  hasSocialInsuranceSettingsMissingFields(form: SocialInsuranceSettings): boolean {
    return this.hasBlank([
      form.corporateNumber,
      form.healthInsuranceTenantRecordNumber,
      form.pensionInsuranceTenantNumber,
      form.pensionInsuranceTenantRecordNumber,
    ]);
  }

  private hasAccountPersonalInfoMissingFields(
    info?: Partial<AccountPersonalInfo>,
  ): boolean {
    if (!info) return true;

    return this.hasBlank([
      info.realName?.lastName,
      info.realName?.firstName,
      info.realName?.lastNameKana,
      info.realName?.firstNameKana,
      info.zipcode,
      info.address?.address1,
      info.address?.address2,
      info.phoneNumber?.tel1,
      info.phoneNumber?.tel2,
      info.phoneNumber?.tel3,
      info.myNumber,
    ]) || !toFormDate(info.birthDate);
  }

  private hasEmployeeInfoMissingFields(
    info?: Partial<EmployeePersonalInfo>,
  ): boolean {
    if (!info) return true;

    return this.hasBlank([
      info.displayName,
      info.zipcode,
      info.address?.address1,
      info.address?.address2,
      info.phoneNumber?.tel1,
      info.phoneNumber?.tel2,
      info.phoneNumber?.tel3,
    ]);
  }

  private hasTenantDocumentMissingFields(
    docData?: Partial<TenantDocument>,
  ): boolean {
    if (!docData) return true;

    return this.hasBlank([
      docData.tenantName,
      docData.tenantNameKana,
      docData.zipcode,
      docData.address?.address1,
      docData.address?.address2,
      docData.ownerName?.ownerLastName,
      docData.ownerName?.ownerFirstName,
      docData.ownerName?.ownerLastNameKana,
      docData.ownerName?.ownerFirstNameKana,
      docData.phoneNumber?.tel1,
      docData.phoneNumber?.tel2,
      docData.phoneNumber?.tel3,
    ]);
  }

  private hasSocialInsuranceSettingsDocumentMissingFields(
    docData?: SocialInsuranceSettings,
  ): boolean {
    if (!docData) return true;

    return this.hasBlank([
      docData?.corporateNumber,
      docData?.healthInsuranceTenantRecordNumber,
      docData?.pensionInsuranceTenantNumber,
      docData?.pensionInsuranceTenantRecordNumber,
    ]);
  }

  private hasBlank(values: Array<string | null | undefined>): boolean {
    return values.some((value) => !value?.trim());
  }
}