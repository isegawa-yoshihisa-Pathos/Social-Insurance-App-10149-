import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { EstablishmentsDataService } from '../establishments-data.service';

@Component({
  selector: 'app-create-establishments',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatSelectModule],
  templateUrl: './create-establishment.cmp.html',
  styleUrl: './create-establishment.cmp.css',
})
export class CreateEstablishmentCmp {
  private readonly establishmentsDataService = inject(EstablishmentsDataService);

  establishmentName = '';
  zipcode = '';
  address = {
    address1: '',
    address2: '',
    address3: '',
  };
  ownerName = '';
  phoneNumberRaw = '';
  phoneNumber = {
    tel1: '',
    tel2: '',
    tel3: '',
  };
  corporateNumber = '';
  healthInsuranceType = 'association';
  combinationName = '';

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
}
