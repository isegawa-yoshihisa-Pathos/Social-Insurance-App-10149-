import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { AccountPersonalInfo, EmployeePersonalInfo } from './personal-document';
import { PersonalFormData, EmployeeFormData } from './personal-form-data';
import { TenantDocument, SocialInsuranceSettings } from './tenant-document';
import { TenantFormData } from './tenant-form-data';
import { Auth, authState } from '@angular/fire/auth';

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
  private readonly auth = inject(Auth);

  private readonly completionSubject = new BehaviorSubject<ProfileCompletionState>({
    personal: false,
    employee: false,
    tenant: false,
    socialInsuranceSettings: false,
    any: false,
  });

  readonly completion$ = this.completionSubject.asObservable();

  private lastUid: string | null = null;

  constructor() {
    authState(this.auth).subscribe((user) => {
      const uid = user?.uid ?? null;
      if (this.lastUid !== uid) {
        this.reset();
        this.lastUid = uid;
      }
    });
  }
  private reset(): void {
    this.completionSubject.next({
      personal: false,
      employee: false,
      tenant: false,
      socialInsuranceSettings: false,
      any: false,
    });
  }

  get snapshot(): ProfileCompletionState {
    return this.completionSubject.value;
  }

  updateFromPersonalForms(
    personalForm: PersonalFormData,
    employeeForm: EmployeeFormData,
  ): void {
    this.setState({
      personal: this.hasPersonalMissingFields(personalForm),
      employee: this.hasEmployeeMissingFields(employeeForm),
      tenant: this.snapshot.tenant,
      socialInsuranceSettings: this.snapshot.socialInsuranceSettings,
    });
  }

  updateFromTenantForm(form: TenantFormData): void {
    this.setState({
      personal: this.snapshot.personal,
      employee: this.snapshot.employee,
      tenant: this.hasTenantMissingFields(form),
      socialInsuranceSettings: this.hasSocialInsuranceSettingsMissingFields(form.socialInsuranceSettings),
    });
  }

  async refresh(uid: string, tid: string): Promise<void> {
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    const account = accountSnap.data();

    const personalInfo = account?.['personalInfo'] as Partial<AccountPersonalInfo> | undefined;
    const eid = account?.['affiliations']?.[tid] as string | undefined;

    const employeeInfo = eid
      ? (await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid))).data() as Partial<EmployeePersonalInfo> | undefined
      : undefined;

    const tenant = (await getDoc(
      doc(this.firestore, 'tenants', tid),
    )).data() as Partial<TenantDocument> | undefined;

    const socialInsuranceSettings = tenant?.socialInsuranceSettings as SocialInsuranceSettings | undefined;

    this.setState({
      personal: this.hasAccountPersonalInfoMissingFields(personalInfo),
      employee: this.hasEmployeeInfoMissingFields(employeeInfo),
      tenant: this.hasTenantDocumentMissingFields(tenant),
      socialInsuranceSettings: this.hasSocialInsuranceSettingsDocumentMissingFields(socialInsuranceSettings),
    });
  }

  hasPersonalMissingFields(form: PersonalFormData): boolean {
    return this.hasBlank([
      form.realName.lastName,
      form.realName.firstName,
      form.realName.lastNameKana,
      form.realName.firstNameKana,
      form.zipcode,
      form.address.address1,
      form.address.address2,
      form.phoneNumberRaw,
      form.birthDate,
      form.myNumber,
    ]);
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
      form.closingDay,
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
      info.birthDate,
      info.myNumber,
    ]);
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
      docData?.closingDay,
    ]);
  }

  private setState(state: Omit<ProfileCompletionState, 'any'>): void {
    this.completionSubject.next({
      ...state,
      any: state.personal || state.employee || state.tenant,
    });
  }

  private hasBlank(values: Array<string | null | undefined>): boolean {
    return values.some((value) => !value?.trim());
  }
}