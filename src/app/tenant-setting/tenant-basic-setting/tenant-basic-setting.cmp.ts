import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { ZipcodeToAddressService } from '../../zipcode-to-address.service';
import { TenantSettingDataService } from '../tenant-setting-data.service';

@Component({
  selector: 'app-tenant-basic-setting',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './tenant-basic-setting.cmp.html',
  styleUrls: ['./tenant-basic-setting.cmp.css', '../tenant-setting.cmp.css'],
})
export class TenantBasicSettingCmp {
  readonly dataService = inject(TenantSettingDataService);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);
  private readonly dialog = inject(MatDialog);

  get form() {
    return this.dataService.form;
  }

  get displayZipcode(): string {
    const z = this.form.zipcode;
    return z.length > 3 ? `${z.slice(0, 3)}-${z.slice(3)}` : z;
  }

  set displayZipcode(value: string) {
    this.form.zipcode = value.replace(/[^\d]/g, '');
  }

  getAddress(zipcode: string): void {
    this.zipcodeToAddressService.getAddress(zipcode).then((address) => {
      this.form.address = { ...this.form.address, address1: address };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    });
  }
}
