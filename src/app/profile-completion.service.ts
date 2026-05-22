import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { AccountPersonalInfo, EmployeePersonalInfo } from './personal-document';
import { PersonalFormData, EmployeeFormData } from './personal-form-data';
import { TenantDocument } from './tenant-document';
import { TenantFormData } from './tenant-form-data';

export interface ProfileCompletionState {
  personal: boolean;
  employee: boolean;
  tenant: boolean;
  any: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileCompletionService {
  private readonly firestore = inject(Firestore);

  private readonly completionSubject = new BehaviorSubject<ProfileCompletionState>({
    personal: false,
    employee: false,
    tenant: false,
    any: false,
  });

  readonly completion$ = this.completionSubject.asObservable();

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
    });
  }

  updateFromTenantForm(form: TenantFormData): void {
    this.setState({
      personal: this.snapshot.personal,
      employee: this.snapshot.employee,
      tenant: this.hasTenantMissingFields(form),
    });
  }

  async refresh(uid: string, eid: string): Promise<void> {
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    const account = accountSnap.data();

    const personalInfo = account?.['personalInfo'] as Partial<AccountPersonalInfo> | undefined;
    const employeeId = account?.['affiliations']?.[eid] as string | undefined;

    const employeeInfo = employeeId
      ? (await getDoc(doc(this.firestore, 'tenants', eid, 'employees', employeeId))).data() as Partial<EmployeePersonalInfo> | undefined
      : undefined;

    const tenant = (await getDoc(
      doc(this.firestore, 'tenants', eid),
    )).data() as Partial<TenantDocument> | undefined;

    this.setState({
      personal: this.hasAccountPersonalInfoMissingFields(personalInfo),
      employee: this.hasEmployeeInfoMissingFields(employeeInfo),
      tenant: this.hasTenantDocumentMissingFields(tenant),
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
      form.corporateNumber,
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
      docData.corporateNumber,
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