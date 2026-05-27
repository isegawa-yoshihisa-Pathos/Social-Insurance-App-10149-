import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { ZipcodeToAddressService } from '../../zipcode-to-address.service';
import { PersonalSettingDataService } from '../personal-setting-data.service';
import { RoutesService } from '../../routes.service';
import { MatDatepickerModule, MatDatepickerToggle } from '@angular/material/datepicker';

@Component({
  selector: 'app-personal-info-edit',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatDatepickerToggle,
  ],
  templateUrl: './personal-info-edit.cmp.html',
  styleUrls: ['./personal-info-edit.cmp.css', '../personal-setting.cmp.css'],
})
export class PersonalInfoEditCmp {
  readonly dataService = inject(PersonalSettingDataService);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  submitBusy = false;

  get personalDisplayZipcode(): string {
    const z = this.dataService.personalForm.zipcode;
    return z.length > 3 ? `${z.slice(0, 3)}-${z.slice(3)}` : z;
  }

  set personalDisplayZipcode(value: string) {
    this.dataService.personalForm.zipcode = value.replace(/[^0-9]/g, '');
  }

  get form() { return this.dataService.personalForm; }

  getPersonalAddress(zipcode: string): void {
    this.zipcodeToAddressService.getAddress(zipcode).then((address) => {
      this.form.address = { ...this.form.address, address1: address };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, { data: { message: mapFirebaseError(error) } });
    });
  }

  async save(): Promise<void> {
    this.submitBusy = true;
    try {
      await this.dataService.savePersonal();
      this.routesService.redirectToPersonalSetting();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, { data: { message: mapFirebaseError(error) } });
    } finally {
      this.submitBusy = false;
    }
  }

  cancel(): void {
    this.routesService.redirectToPersonalSetting();
  }
}