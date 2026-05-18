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
import { ErrorDialogCmp } from '../error-dialog/error-dialog.cmp';
import { EstablishmentsDataService } from '../establishments-data.service';
import { SharedDataService } from '../shared-data.service';
import { RoutesService } from '../routes.service';
import { FunctionsService } from '../functions.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-create-establishments',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatSelectModule, MatCheckboxModule, MatProgressSpinnerModule],
  templateUrl: './create-establishment.cmp.html',
  styleUrl: './create-establishment.cmp.css',
})
export class CreateEstablishmentCmp implements OnInit {
  private readonly establishmentsDataService = inject(EstablishmentsDataService);
  private readonly sharedDataService = inject(SharedDataService);
  private readonly routesService = inject(RoutesService);
  private readonly functionsService = inject(FunctionsService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  submitBusy = false;

  laterInput = false;

  establishmentName: string = '';
  zipcode: string = '';
  address = {
    address1: '',
    address2: '',
    address3: '',
  };
  ownerName: string = '';
  phoneNumber = {
    tel1: '',
    tel2: '',
    tel3: '',
  };
  phoneNumberRaw: string = '';
  corporateNumber: string = '';

  ngOnInit(): void {
    const establishmentData = this.sharedDataService.getEstablishmentData();
    if (establishmentData) {
      this.establishmentName = establishmentData.establishmentName;
      this.zipcode = establishmentData.zipcode;
      this.address = establishmentData.address;
      this.ownerName = establishmentData.ownerName;
      this.phoneNumber = establishmentData.phoneNumber;
      this.phoneNumberRaw = establishmentData.phoneNumber.tel1 + '-' + establishmentData.phoneNumber.tel2 + '-' + establishmentData.phoneNumber.tel3;
      this.corporateNumber = establishmentData.corporateNumber;
    }
  }

  get displayZipcode(): string {
    if (this.zipcode.length > 3) {
      return `${this.zipcode.slice(0, 3)}-${this.zipcode.slice(3)}`;
    }
    return this.zipcode;
  }

  set displayZipcode(value: string) {
    this.zipcode = value.replace(/[^\d]/g, '');
  }

  phoneNumberFormat(value: string):void {
    const parts = value.split('-');
    if (parts.length === 3) {
      this.phoneNumber.tel1 = parts[0];
      this.phoneNumber.tel2 = parts[1];
      this.phoneNumber.tel3 = parts[2];
    } else{
      throw new Error('電話番号を正しく入力してください');
    }
  }

  getAddress(zipcode: string): void {
    this.establishmentsDataService.getAddress(zipcode).then(address => {
      this.address.address1 = address;
    });
  }

  navigateToSignup(): void {
    this.phoneNumberFormat(this.phoneNumberRaw);
    this.sharedDataService.setEstablishmentData({
      establishmentName: this.establishmentName,
      zipcode: this.zipcode,
      address: this.address,
      ownerName: this.ownerName,
      phoneNumber: this.phoneNumber,
      corporateNumber: this.corporateNumber,
    });
    this.routesService.redirectToSignup();
  }

  async createEstablishment(): Promise<void> {
    const signupData = this.sharedDataService.getSignupData();
    if (!signupData) {
      this.routesService.redirectToSignup();
      return;
    }
    this.phoneNumberFormat(this.phoneNumberRaw);
    const payload = {
      ...signupData,
      establishmentName: this.establishmentName,
      zipcode: this.zipcode,
      address: this.address,
      ownerName: this.ownerName,
      phoneNumber: this.phoneNumber,
      corporateNumber: this.corporateNumber,
    };

    try {
      this.submitBusy = true;
      const result = await this.functionsService.registerAdminAndEstablishment(payload);
      const { email, password } = result.data as { email: string, password: string };
      await this.authService.signIn(email, password);
      this.sharedDataService.clearSignupData();
      this.routesService.redirectToMainPage();
    } catch (error) {
      console.error(error);
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所登録に失敗しました' },
      });
    } finally {
      this.submitBusy = false;
    }
  }
}
