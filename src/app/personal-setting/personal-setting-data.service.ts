import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { firstValueFrom, take } from 'rxjs';
import { CurrentTenantService } from '../current-tenant.service';
import { ProfileCompletionService } from '../profile-completion.service';
import {
  EmployeeFormData,
  PersonalFormData,
  accountPersonalInfoToForm,
  createEmptyEmployeeForm,
  createEmptyPersonalForm,
  employeeFormToSavePayload,
  employeePersonalInfoToForm,
  personalFormToSavePayload,
} from '../personal-form-data';

@Injectable({ providedIn: 'root' })
export class PersonalSettingDataService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly profileCompletionService = inject(ProfileCompletionService);

  personalForm: PersonalFormData = createEmptyPersonalForm();
  employeeForm: EmployeeFormData = createEmptyEmployeeForm();
  tid = '';
  loading = false;
  loaded = false;

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
    this.personalForm = createEmptyPersonalForm();
    this.employeeForm = createEmptyEmployeeForm();
    this.tid = '';
    this.loading = false;
    this.loaded = false;
  }
  
  get isPersonalRealNameMissing(): boolean {
    return !this.personalForm.realName.lastName?.trim() || !this.personalForm.realName.firstName?.trim();
  }
  get isPersonalRealNameKanaMissing(): boolean {
    return !this.personalForm.realName.lastNameKana?.trim() || !this.personalForm.realName.firstNameKana?.trim();
  }
  get isPersonalZipcodeMissing(): boolean { return !this.personalForm.zipcode?.trim(); }
  get isPersonalAddressMissing(): boolean {
    return !this.personalForm.address.address1?.trim() || !this.personalForm.address.address2?.trim();
  }
  get isPersonalPhoneNumberMissing(): boolean { return !this.personalForm.phoneNumberRaw?.trim(); }
  get isPersonalBirthDateMissing(): boolean { return !this.personalForm.birthDate?.trim(); }
  get isPersonalMyNumberMissing(): boolean { return !this.personalForm.myNumber?.trim(); }
  get isPersonalBasicPensionNumberMissing(): boolean { return !this.personalForm.basicPensionNumber?.trim(); }


  get isEmployeeDisplayNameMissing(): boolean { return !this.employeeForm.displayName?.trim(); }
  get isEmployeeRealNameMissing(): boolean {
    return !this.employeeForm.realName.lastName?.trim() || !this.employeeForm.realName.firstName?.trim();
  }
  get isEmployeeRealNameKanaMissing(): boolean {
    return !this.employeeForm.realName.lastNameKana?.trim() || !this.employeeForm.realName.firstNameKana?.trim();
  }
  get isEmployeeZipcodeMissing(): boolean { return !this.employeeForm.zipcode?.trim(); }
  get isEmployeeAddressMissing(): boolean {
    return !this.employeeForm.address.address1?.trim() || !this.employeeForm.address.address2?.trim();
  }
  get isEmployeePhoneNumberMissing(): boolean { return !this.employeeForm.phoneNumberRaw?.trim(); }
  get isEmployeeBirthDateMissing(): boolean { return !this.employeeForm.birthDate?.trim(); }
  get isEmployeeMyNumberMissing(): boolean { return !this.employeeForm.myNumber?.trim(); }
  get isEmployeeBasicPensionNumberMissing(): boolean { return !this.employeeForm.basicPensionNumber?.trim(); }


  async loadAll(): Promise<void> {
    if (this.loaded) return;
    this.loading = true;
    try {
      const user = await firstValueFrom(authState(this.auth).pipe(take(1)));
      if (!user) throw new Error('ユーザーが見つかりません。');

      this.tid = await this.resolveCurrentTid(user.uid);

      const accountSnap = await getDoc(doc(this.firestore, 'accounts', user.uid));
      if (!accountSnap.exists()) throw new Error('アカウント情報が見つかりません。');
      const account = accountSnap.data();
      this.personalForm = accountPersonalInfoToForm(account['personalInfo']);

      const eid = account['affiliations']?.[this.tid];
      if (eid) {
        const employeeSnap = await getDoc(
          doc(this.firestore, 'tenants', this.tid, 'employees', eid),
        );
        this.employeeForm = employeePersonalInfoToForm(employeeSnap.data());
      }

      this.profileCompletionService.updateFromPersonalForms(
        this.personalForm, this.employeeForm,
      );
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async savePersonal(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('ユーザーが見つかりません。');
    await updateDoc(doc(this.firestore, 'accounts', uid), {
      personalInfo: personalFormToSavePayload(this.personalForm),
      updatedAt: serverTimestamp(),
    });
    this.profileCompletionService.updateFromPersonalForms(
      this.personalForm, this.employeeForm,
    );
  }

  async saveEmployee(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('ユーザーが見つかりません。');
    const tid = this.tid || (await this.resolveCurrentTid(uid));
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    if (!accountSnap.exists()) throw new Error('アカウント情報が見つかりません。');
    const account = accountSnap.data();
    const eid = account?.['affiliations']?.[tid];
    if (!eid) throw new Error('従業員情報が見つかりません。');

    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, 'tenants', tid, 'employees', eid), {
      ...employeeFormToSavePayload(this.employeeForm),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(this.firestore, 'affiliations', `${uid}_${tid}`), {
      displayName: this.employeeForm.displayName,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    this.currentTenantService.updateAffiliationDisplayName(
      uid, tid, this.employeeForm.displayName,
    );
    this.profileCompletionService.updateFromPersonalForms(
      this.personalForm, this.employeeForm,
    );
  }

  applyPersonalToEmployee(): void {
    const displayName =
      `${this.personalForm.realName.lastName}${this.personalForm.realName.firstName}`.trim();
    this.employeeForm.realName = { ...this.personalForm.realName };
    this.employeeForm.displayName = displayName;
    this.employeeForm.phoneNumberRaw = this.personalForm.phoneNumberRaw;
    this.employeeForm.zipcode = this.personalForm.zipcode;
    this.employeeForm.address = { ...this.personalForm.address };
    this.employeeForm.myNumber = this.personalForm.myNumber;
    this.employeeForm.basicPensionNumber = this.personalForm.basicPensionNumber;
    this.employeeForm.birthDate = this.personalForm.birthDate;
  }

  get hasPersonalMissingFields(): boolean {
    return this.profileCompletionService.hasPersonalMissingFields(this.personalForm);
  }

  get hasEmployeeMissingFields(): boolean {
    return this.profileCompletionService.hasEmployeeMissingFields(this.employeeForm);
  }

  private async resolveCurrentTid(uid: string): Promise<string> {
    const currentTid = this.currentTenantService.getTenant();
    if (currentTid) return currentTid;
    await this.currentTenantService.initialize(uid);
    const tid = this.currentTenantService.getTenant();
    if (!tid) throw new Error('事業所が見つかりません。');
    return tid;
  }
}