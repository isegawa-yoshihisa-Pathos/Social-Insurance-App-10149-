import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { SharedDataService } from '../shared-data.service';
import { RoutesService } from '../routes.service';
import { FunctionsService } from '../functions.service';
import { AuthService } from '../auth.service';
import { CurrentTenantService } from '../current-tenant.service';
import { Auth } from '@angular/fire/auth';
import { ZipcodeToAddressService } from '../zipcode-to-address.service';
import {
  createEmptyTenantForm,
  tenantFormToSavePayload,
  parsePhoneNumberRaw,
  TenantFormData,
} from '../tenant-form-data';

@Component({
  selector: 'app-create-tenants',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatSelectModule, MatCheckboxModule, MatProgressSpinnerModule],
  templateUrl: './create-tenant.cmp.html',
  styleUrl: './create-tenant.cmp.css',
})
export class CreateTenantCmp implements OnInit {
  private readonly sharedDataService = inject(SharedDataService);
  private readonly routesService = inject(RoutesService);
  private readonly functionsService = inject(FunctionsService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly currentTenantService = inject(CurrentTenantService);
  readonly auth = inject(Auth);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);

  submitBusy = false;

  laterInput = false;

  form: TenantFormData = createEmptyTenantForm();

  ngOnInit(): void {
    const tenantData = this.sharedDataService.getTenantData();
    if (tenantData) {
      this.form = {
        ...createEmptyTenantForm(),
        ...tenantData,
        address: {
          ...createEmptyTenantForm().address,
          ...tenantData.address,
        },
        ownerName: {
          ...createEmptyTenantForm().ownerName,
          ...tenantData.ownerName,
        },
        phoneNumber: {
          ...createEmptyTenantForm().phoneNumber,
          ...tenantData.phoneNumber,
        },
        phoneNumberRaw: tenantData.phoneNumberRaw ?? (
          tenantData.phoneNumber?.tel1 &&
          tenantData.phoneNumber?.tel2 &&
          tenantData.phoneNumber?.tel3
            ? `${tenantData.phoneNumber.tel1}-${tenantData.phoneNumber.tel2}-${tenantData.phoneNumber.tel3}`
            : ''
        ),
      };
    }
  }

  get displayZipcode(): string {
    if (this.form.zipcode.length > 3) {
      return `${this.form.zipcode.slice(0, 3)}-${this.form.zipcode.slice(3)}`;
    }
    return this.form.zipcode;
  }

  set displayZipcode(value: string) {
    this.form.zipcode = value.replace(/[^\d]/g, '');
  }

  getAddress(zipcode: string): void {
    this.zipcodeToAddressService.getAddress(zipcode).then((address) => {
      this.form = {
        ...this.form,
        address: {
          ...this.form.address,
          address1: address,
        },
      };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    });
  }

  navigateToSignup(): void {
    this.form.phoneNumber = parsePhoneNumberRaw(this.form.phoneNumberRaw);
    this.sharedDataService.setTenantData(this.form);
    this.routesService.redirectToSignup();
  }

  async createTenant(): Promise<void> {
    const signupData = this.sharedDataService.getSignupData();
    if (!signupData) {
      this.routesService.redirectToSignup();
      return;
    }try {
      this.submitBusy = true;
      this.form.phoneNumber = parsePhoneNumberRaw(this.form.phoneNumberRaw);
      const tenantPayload = tenantFormToSavePayload(this.form);
      const payload = {
        ...signupData,
        tenantName: tenantPayload.tenantName,
        tenantNameKana: tenantPayload.tenantNameKana,
        zipcode: tenantPayload.zipcode,
        address: tenantPayload.address,
        ownerName: tenantPayload.ownerName,
        phoneNumber: tenantPayload.phoneNumber,
      };
      const result = await this.functionsService.registerAdminAndTenant(payload);
      const { uid, email, password } = result.data as {
        uid: string;
        email: string;
        password: string;
      };
      await this.authService.signIn(email, password);
      await this.auth.currentUser?.getIdToken(true);
      await this.currentTenantService.initialize(uid);
      
      this.sharedDataService.clearSignupData();
      this.routesService.redirectToMainPage();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.submitBusy = false;
    }
  }
}