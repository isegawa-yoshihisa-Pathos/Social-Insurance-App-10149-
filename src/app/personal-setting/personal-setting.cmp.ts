import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Firestore } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { updateDoc, doc, serverTimestamp, getDoc, writeBatch } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ZipcodeToAddressService } from '../zipcode-to-address.service';
import { PersonalFormData } from '../personal-form-data';
import { 
  createEmptyPersonalForm,
  createEmptyEmployeeForm,
  EmployeeFormData,
  personalFormToSavePayload,
  employeeFormToSavePayload,
  accountPersonalInfoToForm,
  employeePersonalInfoToForm,
} from '../personal-form-data';
import { CurrentTenantService } from '../current-tenant.service';
import { ProfileCompletionService } from '../profile-completion.service';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-personal-setting',
  imports: [FormsModule, MatTabsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatProgressSpinnerModule],
  templateUrl: './personal-setting.cmp.html',
  styleUrl: './personal-setting.cmp.css',
})
export class PersonalSettingCmp implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);
  private readonly profileCompletionService = inject(ProfileCompletionService);

  eid = '';
  loading = true;
  submitBusy = false;
  state: 'personal' | 'employee' = 'personal';

  personalForm: PersonalFormData = createEmptyPersonalForm();
  employeeForm: EmployeeFormData = createEmptyEmployeeForm();

  async ngOnInit(): Promise<void> {
    try {
      this.loading = true;

      const user = await firstValueFrom(authState(this.auth).pipe(take(1)));
      if (!user) {
        throw new Error('ユーザーが見つかりません。');
      }

      const eid = await this.resolveCurrentEid(user.uid);
      this.eid = eid;

      const accountSnap = await getDoc(doc(this.firestore, 'accounts', user.uid));
      if (!accountSnap.exists()) {
        throw new Error('アカウント情報が見つかりません。');
      }

      const account = accountSnap.data();
      this.personalForm = accountPersonalInfoToForm(account['personalInfo']);

      const employeeId = account['affiliations']?.[eid];
      if (employeeId) {
        const employeeSnap = await getDoc(
          doc(this.firestore, 'tenants', eid, 'employees', employeeId),
        );
        this.employeeForm = employeePersonalInfoToForm(employeeSnap.data());
      }
      this.profileCompletionService.updateFromPersonalForms(this.personalForm, this.employeeForm);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  get personalDisplayZipcode(): string {
    if (this.personalForm.zipcode.length > 3) {
      return `${this.personalForm.zipcode.slice(0, 3)}-${this.personalForm.zipcode.slice(3)}`;
    }
    return this.personalForm.zipcode;
  }

  set personalDisplayZipcode(value: string) {
    this.personalForm.zipcode = value.replace(/[^0-9]/g, '');
  }

  get employeeDisplayZipcode(): string {
    if (this.employeeForm.zipcode.length > 3) {
      return `${this.employeeForm.zipcode.slice(0, 3)}-${this.employeeForm.zipcode.slice(3)}`;
    }
    return this.employeeForm.zipcode;
  }

  set employeeDisplayZipcode(value: string) {
    this.employeeForm.zipcode = value.replace(/[^0-9]/g, '');
  }

  get isPersonalRealNameMissing(): boolean {
    return !this.personalForm.realName.lastName?.trim()
      || !this.personalForm.realName.firstName?.trim();
  }

  get isPersonalRealNameKanaMissing(): boolean {
    return !this.personalForm.realName.lastNameKana?.trim()
      || !this.personalForm.realName.firstNameKana?.trim();
  }

  get isPersonalZipcodeMissing(): boolean {
    return !this.personalForm.zipcode?.trim();
  }

  get isPersonalAddressMissing(): boolean {
    return !this.personalForm.address.address1?.trim()
      || !this.personalForm.address.address2?.trim();
  }

  get isPersonalPhoneNumberMissing(): boolean {
    return !this.personalForm.phoneNumberRaw?.trim();
  }

  get isPersonalBirthDateMissing(): boolean {
    return !this.personalForm.birthDate?.trim();
  }

  get isPersonalMyNumberMissing(): boolean {
    return !this.personalForm.myNumber?.trim();
  }

  get isPersonalBasicPensionNumberMissing(): boolean {
    return !this.personalForm.basicPensionNumber?.trim();
  }

  get isEmployeeDisplayNameMissing(): boolean {
    return !this.employeeForm.displayName?.trim();
  }

  get isEmployeeRealNameMissing(): boolean {
    return !this.employeeForm.realName.lastName?.trim()
      || !this.employeeForm.realName.firstName?.trim();
  }

  get isEmployeeRealNameKanaMissing(): boolean {
    return !this.employeeForm.realName.lastNameKana?.trim()
      || !this.employeeForm.realName.firstNameKana?.trim();
  }

  get isEmployeeZipcodeMissing(): boolean {
    return !this.employeeForm.zipcode?.trim();
  }

  get isEmployeeAddressMissing(): boolean {
    return !this.employeeForm.address.address1?.trim()
      || !this.employeeForm.address.address2?.trim();
  }

  get isEmployeePhoneNumberMissing(): boolean {
    return !this.employeeForm.phoneNumberRaw?.trim();
  }

  get isEmployeeBirthDateMissing(): boolean {
    return !this.employeeForm.birthDate?.trim();
  }

  get isEmployeeMyNumberMissing(): boolean {
    return !this.employeeForm.myNumber?.trim();
  }

  get isEmployeeBasicPensionNumberMissing(): boolean {
    return !this.employeeForm.basicPensionNumber?.trim();
  }

  get hasPersonalMissingFields(): boolean {
    return this.profileCompletionService.hasPersonalMissingFields(this.personalForm);
  }

  get hasEmployeeMissingFields(): boolean {
    return this.profileCompletionService.hasEmployeeMissingFields(this.employeeForm);
  }

  getPersonalAddress(zipcode: string): void {
    this.zipcodeToAddressService.getAddress(zipcode).then((address) => {
      this.personalForm.address = {
        ...this.personalForm.address,
        address1: address,
      };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    });
  }

  getEmployeeAddress(zipcode: string): void {
    this.zipcodeToAddressService.getAddress(zipcode).then((address) => {
      this.employeeForm.address = {
        ...this.employeeForm.address,
        address1: address,
      };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    });
  }

  applyBasicToEmployeeSettings(): void {
    const displayName = `${this.personalForm.realName.lastName}${this.personalForm.realName.firstName}`.trim();
    this.employeeForm.realName = { ...this.personalForm.realName };
    this.employeeForm.displayName = displayName;
    this.employeeForm.phoneNumberRaw = this.personalForm.phoneNumberRaw;
    this.employeeForm.zipcode = this.personalForm.zipcode;
    this.employeeForm.address = { ...this.personalForm.address };
    this.employeeForm.myNumber = this.personalForm.myNumber;
    this.employeeForm.basicPensionNumber = this.personalForm.basicPensionNumber;
    this.employeeForm.birthDate = this.personalForm.birthDate;
  }

  private async resolveCurrentEid(uid: string): Promise<string> {
    const currentEid = this.currentTenantService.getTenant();
    if (currentEid) {
      return currentEid;
    }

    await this.currentTenantService.initialize(uid);

    const initializedEid = this.currentTenantService.getTenant();
    if (!initializedEid) {
      throw new Error('事業所が見つかりません。');
    }

    return initializedEid;
  }

  async save(state: 'personal' | 'employee'): Promise<void> {
    try {
      this.submitBusy = true;

      if (state === 'personal') {
        await this.savePersonal();
      } else {
        await this.saveEmployee();
      }
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.profileCompletionService.updateFromPersonalForms(this.personalForm, this.employeeForm);
      this.submitBusy = false;
    }
  }

  async savePersonal(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('ユーザーが見つかりません。');
    }
    await updateDoc(doc(this.firestore, 'accounts', uid), {
      personalInfo: personalFormToSavePayload(this.personalForm),
      updatedAt: serverTimestamp(),
    });
  }

  async saveEmployee(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('ユーザーが見つかりません。');
    }
    const eid = this.eid || await this.resolveCurrentEid(uid);
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    if (!accountSnap.exists()) {
      throw new Error('アカウント情報が見つかりません。');
    }
    const account = accountSnap.data();
    const employeeId = account?.['affiliations']?.[eid];
    if (!employeeId) {
      throw new Error('従業員情報が見つかりません。');
    }
    const batch = writeBatch(this.firestore);
    
    const employeeRef = doc(this.firestore, 'tenants', eid, 'employees', employeeId);
    batch.update(employeeRef, {
        ...employeeFormToSavePayload(this.employeeForm),
        updatedAt: serverTimestamp(),
      },
    );

    const affiliationsRef = doc(this.firestore, 'affiliations', `${uid}_${eid}`);
    batch.update(affiliationsRef, {
      displayName: this.employeeForm.displayName,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    this.currentTenantService.updateAffiliationDisplayName(uid, eid, this.employeeForm.displayName);
  }
}
