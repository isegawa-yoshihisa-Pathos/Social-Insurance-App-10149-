import { Component, inject } from '@angular/core';
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
import { RoutesService } from '../routes.service';
import { FunctionsService } from '../functions.service';
import { AuthService } from '../auth.service';
import { CurrentTenantService } from '../current-tenant.service';
import { ZipcodeToAddressService } from '../zipcode-to-address.service';
import {
  createEmptyTenantForm,
  tenantFormToSavePayload,
  parsePhoneNumberRaw,
  TenantFormData,
} from '../tenant-form-data';

@Component({
  selector: 'app-create-new-tenant',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './create-new-tenant.cmp.html',
  styleUrl: './create-new-tenant.cmp.css',
})
export class CreateNewTenantCmp {
  private readonly routesService = inject(RoutesService);
  private readonly functionsService = inject(FunctionsService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);

  submitBusy = false;
  laterInput = false;
  form: TenantFormData = createEmptyTenantForm();

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
    this.zipcodeToAddressService
      .getAddress(zipcode)
      .then((address) => {
        this.form = {
          ...this.form,
          address: {
            ...this.form.address,
            address1: address,
          },
        };
      })
      .catch((error) => {
        this.dialog.open(ErrorDialogCmp, {
          data: { message: mapFirebaseError(error) },
        });
      });
  }

  navigateToMainPage(): void {
    this.routesService.redirectToMainPage();
  }

  async createTenant(): Promise<void> {
    const uid = this.authService.uid();
    if (!uid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'ログインが必要です' },
      });
      return;
    }

    try {
      this.submitBusy = true;
      this.form.phoneNumber = parsePhoneNumberRaw(this.form.phoneNumberRaw);

      const payload = tenantFormToSavePayload(this.form);
      const result = await this.functionsService.registerTenantForExistingUser(payload);
      const { tid } = result.data as { tid: string };

      await this.currentTenantService.reloadAffiliations(uid);

      await this.currentTenantService.bootstrap(uid);
      await this.currentTenantService.setTenant(uid, tid);

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