import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '@angular/fire/auth';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { HelpContentCmp } from '../help-content/help-content.cmp';
import { TenantsDataService } from '../tenants-data.service';
import { ZipcodeToAddressService } from '../zipcode-to-address.service';
import { CurrentTenantService } from '../current-tenant.service';
import { RoutesService } from '../routes.service';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import {
  createEmptyTenantForm,
  tenantDocToForm,
  tenantFormToSavePayload,
  parsePhoneNumberRaw,
  TenantFormData,
} from '../tenant-form-data';

@Component({
  selector: 'app-setting-tenant',
  imports: [
    MatTabsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    HelpContentCmp,
  ],
  templateUrl: './setting-tenant.cmp.html',
  styleUrl: './setting-tenant.cmp.css',
})
export class SettingTenantCmp implements OnInit {
  private readonly tenantsDataService = inject(TenantsDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(Auth);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);
  eid = '';
  loading = true;
  submitBusy = false;

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

  async ngOnInit(): Promise<void> {
    const eid = this.currentTenantService.getTenant();

    if (!eid) {
      this.routesService.redirectToHome();
      return;
    }
    this.eid = eid;

    try {
      this.loading = true;
      const doc = await this.tenantsDataService.loadTenant(eid);
      if (!doc) {
        this.dialog.open(ErrorDialogCmp, {
          data: { message: '事業所データが見つかりませんでした' },
        });
        return;
      }
      this.form = tenantDocToForm(doc);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  getAddress(zipcode: string): void {
    this.zipcodeToAddressService.getAddress(zipcode).then((address) => {
      this.form = {
        ...this.form,
        address: { ...this.form.address, address1: address },
      };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    });
  }

  async save(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      this.routesService.redirectToSignin();
      return;
    }

    this.form.phoneNumber = parsePhoneNumberRaw(this.form.phoneNumberRaw);
    const payload = tenantFormToSavePayload(this.form);

    try {
      this.submitBusy = true;
      await this.tenantsDataService.saveTenant(this.eid, payload);
      await this.currentTenantService.initialize(uid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.submitBusy = false;
    }
  }
}