import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  WriteBatch,
} from '@angular/fire/firestore';
import { CurrentTenantService } from '../current-tenant.service';
import { ProfileCompletionService } from '../profile-completion.service';
import {
  EmployeeFormData,
  PersonalFormData,
  accountPersonalInfoToForm,
  buildEmployeePersonalInfoSavePayload,
  buildSingleAffiliationPersonalInfoSavePayload,
  copySharedPersonalFieldsToEmployee,
  createEmptyEmployeeForm,
  createEmptyPersonalForm,
  employeePersonalInfoToForm,
  personalFormToSavePayload,
  reconcileSharedPersonalFields,
  sharedPersonalFieldsToFirestore,
} from '../personal-form-data';
import { AuthService } from '../auth.service';
import { EmployeeDocument } from '../employee-document';
import { AuditLogService } from '../audit-log/audit-log.service';
import { serializeAuditValue } from '../../../shared/audit-log.util';

@Injectable({ providedIn: 'root' })
export class PersonalSettingDataService {
  private readonly firestore = inject(Firestore);
  private readonly tenantService = inject(CurrentTenantService);
  private readonly profileCompletionService = inject(ProfileCompletionService);
  private readonly authService = inject(AuthService);
  private readonly auditLog = inject(AuditLogService);

  personalForm: PersonalFormData = createEmptyPersonalForm();
  employeeForm: EmployeeFormData = createEmptyEmployeeForm();
  tid = '';
  loading = false;
  loaded = false;

  multipleAffiliations(): boolean {
    return this.tenantService.affiliations().length > 1;
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
  get isPersonalBirthDateMissing(): boolean { return !this.personalForm.birthDate; }
  get isPersonalMyNumberMissing(): boolean { return !this.personalForm.myNumber?.trim(); }
  get isPersonalBasicPensionNumberMissing(): boolean { return !this.personalForm.basicPensionNumber?.trim(); }


  get isEmployeeDisplayNameMissing(): boolean { return !this.employeeForm.displayName?.trim(); }
  get isEmployeeZipcodeMissing(): boolean { return !this.employeeForm.zipcode?.trim(); }
  get isEmployeeAddressMissing(): boolean {
    return !this.employeeForm.address.address1?.trim() || !this.employeeForm.address.address2?.trim();
  }
  get isEmployeePhoneNumberMissing(): boolean { return !this.employeeForm.phoneNumberRaw?.trim(); }


  async loadAll(): Promise<void> {
    if (this.loaded) return;
    const uid = this.authService.uid();
    if (!uid) throw new Error('ユーザーが見つかりません。');
    const tid = this.tenantService.currentTid();
    if (!tid) throw new Error('事業所が見つかりません。');
    this.tid = tid;
    this.loading = true;
    try {
      const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
      if (!accountSnap.exists()) throw new Error('アカウント情報が見つかりません。');
      const account = accountSnap.data();
      this.personalForm = accountPersonalInfoToForm(account['personalInfo']);

      const eid = account['affiliations']?.[this.tid];
      if (eid) {
        const employeeSnap = await getDoc(
          doc(this.firestore, 'tenants', this.tid, 'employees', eid),
        );
        const employee = employeeSnap.data() as Partial<EmployeeDocument> | undefined;
        this.employeeForm = employeePersonalInfoToForm(employee?.employeePersonalInfo);
      }

      reconcileSharedPersonalFields(this.personalForm, this.employeeForm);

      this.profileCompletionService.updateFromPersonalForms(
        this.personalForm, this.employeeForm,
      );
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async reloadForTenantChange(): Promise<void> {
    this.loaded = false;
    await this.loadAll();
  }

  async savePersonal(): Promise<void> {
    const uid = this.authService.uid();
    if (!uid) throw new Error('ユーザーが見つかりません。');
    copySharedPersonalFieldsToEmployee(this.personalForm, this.employeeForm);

    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, 'accounts', uid), {
      personalInfo: personalFormToSavePayload(this.personalForm),
      updatedAt: serverTimestamp(),
    });
    await this.appendSharedFieldsToAllEmployees(uid, batch);
    await batch.commit();

    this.profileCompletionService.updateFromPersonalForms(
      this.personalForm, this.employeeForm,
    );
  }

  async saveEmployee(): Promise<void> {
    const uid = this.authService.uid();
    if (!uid) throw new Error('ユーザーが見つかりません。');
    const tid = this.tid || (await this.resolveCurrentTid(uid));
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    if (!accountSnap.exists()) throw new Error('アカウント情報が見つかりません。');
    const account = accountSnap.data();
    const eid = account?.['affiliations']?.[tid];
    if (!eid) throw new Error('従業員情報が見つかりません。');

    const employeeRef = doc(this.firestore, 'tenants', tid, 'employees', eid);
    const beforeSnap = await getDoc(employeeRef);
    const beforePersonal = beforeSnap.data()?.['employeePersonalInfo'] as
      | Record<string, unknown>
      | undefined;

    copySharedPersonalFieldsToEmployee(this.personalForm, this.employeeForm);

    const currentPersonalInfo = account['personalInfo'] ?? {};

    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, 'accounts', uid), {
      personalInfo: {
        ...currentPersonalInfo,
        ...sharedPersonalFieldsToFirestore(this.personalForm),
      },
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(this.firestore, 'tenants', tid, 'employees', eid), {
      employeePersonalInfo: buildEmployeePersonalInfoSavePayload(
        this.personalForm,
        this.employeeForm,
      ),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(this.firestore, 'affiliations', `${uid}_${tid}`), {
      displayName: this.employeeForm.displayName,
      updatedAt: serverTimestamp(),
    });
    await this.appendSharedFieldsToOtherEmployees(uid, tid, batch);
    await batch.commit();

    await this.logEmployeePersonalUpdate(tid, eid, beforePersonal);

    this.tenantService.updateAffiliationDisplayName(
      uid, tid, this.employeeForm.displayName,
    );
    this.profileCompletionService.updateFromPersonalForms(
      this.personalForm, this.employeeForm,
    );
  }

  async saveEmployeeAndPersonal(): Promise<void> {
    const uid = this.authService.uid();
    if (!uid) throw new Error('ユーザーが見つかりません。');
    const tid = this.tid || (await this.resolveCurrentTid(uid));
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    if (!accountSnap.exists()) throw new Error('アカウント情報が見つかりません。');
    const account = accountSnap.data();
    const eid = account?.['affiliations']?.[tid];
    if (!eid) throw new Error('従業員情報が見つかりません。');

    const employeeRef = doc(this.firestore, 'tenants', tid, 'employees', eid);
    const beforeSnap = await getDoc(employeeRef);
    const beforePersonal = beforeSnap.data()?.['employeePersonalInfo'] as
      | Record<string, unknown>
      | undefined;

    copySharedPersonalFieldsToEmployee(this.personalForm, this.employeeForm);

    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, 'accounts', uid), {
      personalInfo: buildSingleAffiliationPersonalInfoSavePayload(
        this.personalForm,
        this.employeeForm,
      ),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(this.firestore, 'tenants', tid, 'employees', eid), {
      employeePersonalInfo: buildEmployeePersonalInfoSavePayload(
        this.personalForm,
        this.employeeForm,
      ),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(this.firestore, 'affiliations', `${uid}_${tid}`), {
      displayName: this.employeeForm.displayName,
      updatedAt: serverTimestamp(),
    });
    await this.appendSharedFieldsToOtherEmployees(uid, tid, batch);
    await batch.commit();

    await this.logEmployeePersonalUpdate(tid, eid, beforePersonal);

    this.tenantService.updateAffiliationDisplayName(
      uid, tid, this.employeeForm.displayName,
    );
    this.profileCompletionService.updateFromPersonalForms(
      this.personalForm, this.employeeForm,
    );
  }

  applyPersonalToEmployee(): void {
    copySharedPersonalFieldsToEmployee(this.personalForm, this.employeeForm);
    const displayName =
      `${this.personalForm.realName.lastName}${this.personalForm.realName.firstName}`.trim();
    this.employeeForm.displayName = displayName;
    this.employeeForm.phoneNumberRaw = this.personalForm.phoneNumberRaw;
    this.employeeForm.zipcode = this.personalForm.zipcode;
    this.employeeForm.address = { ...this.personalForm.address };
  }

  private async logEmployeePersonalUpdate(
    tid: string,
    eid: string,
    beforePersonal?: Record<string, unknown>,
  ): Promise<void> {
    const afterPersonal = buildEmployeePersonalInfoSavePayload(
      this.personalForm,
      this.employeeForm,
    );
    await this.auditLog.recordUpdate({
      tid,
      category: 'employee.personal',
      summary: '従業員個人情報を更新',
      target: this.auditLog.employeeTarget(
        eid,
        this.employeeForm.displayName,
        undefined,
      ),
      before: serializeAuditValue(beforePersonal) as Record<string, unknown>,
      after: serializeAuditValue(afterPersonal) as Record<string, unknown>,
    });
  }

  private sharedFieldsEmployeeUpdate(): Record<string, unknown> {
    const shared = sharedPersonalFieldsToFirestore(this.personalForm);
    return {
      'employeePersonalInfo.realName': shared.realName,
      'employeePersonalInfo.myNumber': shared.myNumber,
      'employeePersonalInfo.basicPensionNumber': shared.basicPensionNumber,
      'employeePersonalInfo.birthDate': shared.birthDate,
    };
  }

  private async appendSharedFieldsToAllEmployees(
    uid: string,
    batch: WriteBatch,
  ): Promise<void> {
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    if (!accountSnap.exists()) return;

    const affiliations = accountSnap.data()?.['affiliations'] as
      | Record<string, string>
      | undefined;
    if (!affiliations) return;

    const sharedUpdate = this.sharedFieldsEmployeeUpdate();
    for (const [tid, eid] of Object.entries(affiliations)) {
      batch.update(doc(this.firestore, 'tenants', tid, 'employees', eid), {
        ...sharedUpdate,
        updatedAt: serverTimestamp(),
      });
    }
  }

  private async appendSharedFieldsToOtherEmployees(
    uid: string,
    currentTid: string,
    batch: WriteBatch,
  ): Promise<void> {
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    if (!accountSnap.exists()) return;

    const affiliations = accountSnap.data()?.['affiliations'] as
      | Record<string, string>
      | undefined;
    if (!affiliations) return;

    const sharedUpdate = this.sharedFieldsEmployeeUpdate();
    for (const [tid, eid] of Object.entries(affiliations)) {
      if (tid === currentTid) continue;
      batch.update(doc(this.firestore, 'tenants', tid, 'employees', eid), {
        ...sharedUpdate,
        updatedAt: serverTimestamp(),
      });
    }
  }

  get hasPersonalMissingFields(): boolean {
    return this.profileCompletionService.hasPersonalMissingFields(this.personalForm);
  }

  get hasEmployeeMissingFields(): boolean {
    return this.profileCompletionService.hasEmployeeMissingFields(this.employeeForm);
  }

  private async resolveCurrentTid(uid: string): Promise<string> {
    const currentTid = this.tenantService.currentTid();
    if (currentTid) return currentTid;
    const tid = this.tenantService.currentTid();
    if (!tid) throw new Error('事業所が見つかりません。');
    return tid;
  }

  signOut(): void {
    this.reset();
  }
}