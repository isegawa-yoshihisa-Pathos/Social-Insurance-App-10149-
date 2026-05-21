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
import { CurrentEstablishmentService } from '../current-establishment.service';
import { Auth } from '@angular/fire/auth';
import { ZipcodeToAddressService } from '../zipcode-to-address.service';
import {
  createEmptyEstablishmentForm,
  establishmentFormToSavePayload,
  parsePhoneNumberRaw,
  EstablishmentFormData,
} from '../establishment-form-data';

@Component({
  selector: 'app-create-establishments',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatSelectModule, MatCheckboxModule, MatProgressSpinnerModule],
  templateUrl: './create-establishment.cmp.html',
  styleUrl: './create-establishment.cmp.css',
})
export class CreateEstablishmentCmp implements OnInit {
  private readonly sharedDataService = inject(SharedDataService);
  private readonly routesService = inject(RoutesService);
  private readonly functionsService = inject(FunctionsService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly currentEstablishmentService = inject(CurrentEstablishmentService);
  readonly auth = inject(Auth);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);

  submitBusy = false;

  laterInput = false;

  form: EstablishmentFormData = createEmptyEstablishmentForm();

  ngOnInit(): void {
    const establishmentData = this.sharedDataService.getEstablishmentData();
    if (establishmentData) {
      this.form = {
        ...createEmptyEstablishmentForm(),
        ...establishmentData,
        address: {
          ...createEmptyEstablishmentForm().address,
          ...establishmentData.address,
        },
        ownerName: {
          ...createEmptyEstablishmentForm().ownerName,
          ...establishmentData.ownerName,
        },
        phoneNumber: {
          ...createEmptyEstablishmentForm().phoneNumber,
          ...establishmentData.phoneNumber,
        },
        phoneNumberRaw: establishmentData.phoneNumberRaw ?? (
          establishmentData.phoneNumber?.tel1 &&
          establishmentData.phoneNumber?.tel2 &&
          establishmentData.phoneNumber?.tel3
            ? `${establishmentData.phoneNumber.tel1}-${establishmentData.phoneNumber.tel2}-${establishmentData.phoneNumber.tel3}`
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
    this.sharedDataService.setEstablishmentData(this.form);
    this.routesService.redirectToSignup();
  }

  async createEstablishment(): Promise<void> {
    const signupData = this.sharedDataService.getSignupData();
    if (!signupData) {
      this.routesService.redirectToSignup();
      return;
    }try {
      this.submitBusy = true;
      this.form.phoneNumber = parsePhoneNumberRaw(this.form.phoneNumberRaw);
      const establishmentPayload = establishmentFormToSavePayload(this.form);
      const payload = {
        ...signupData,
        establishmentName: establishmentPayload.establishmentName,
        establishmentNameKana: establishmentPayload.establishmentNameKana,
        zipcode: establishmentPayload.zipcode,
        address: establishmentPayload.address,
        ownerName: establishmentPayload.ownerName,
        phoneNumber: establishmentPayload.phoneNumber,
      };
      const result = await this.functionsService.registerAdminAndEstablishment(payload);
      const { uid, email, password } = result.data as {
        uid: string;
        email: string;
        password: string;
      };
      await this.authService.signIn(email, password);
      await this.auth.currentUser?.getIdToken(true);
      await this.currentEstablishmentService.initialize(uid);
      
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