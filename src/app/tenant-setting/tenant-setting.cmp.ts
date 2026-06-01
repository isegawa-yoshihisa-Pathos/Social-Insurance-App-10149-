import { Component, inject, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { TenantSettingDataService } from './tenant-setting-data.service';
import { TenantBasicSettingCmp } from './tenant-basic-setting/tenant-basic-setting.cmp';
import { TenantInsuranceSettingCmp } from './tenant-insurance-setting/tenant-insurance-setting.cmp';
import { TenantInsuranceRateSettingCmp } from './tenant-insurance-rate-setting/tenant-insurance-rate-setting.cmp';
import { AuthService } from '../auth.service';
import { RoutesService } from '../routes.service';

@Component({
  selector: 'app-tenant-setting',
  imports: [
    MatTabsModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    TenantBasicSettingCmp,
    TenantInsuranceSettingCmp,
    TenantInsuranceRateSettingCmp,
  ],
  templateUrl: './tenant-setting.cmp.html',
  styleUrl: './tenant-setting.cmp.css',
})
export class TenantSettingCmp implements OnInit {
  readonly dataService = inject(TenantSettingDataService);
  private readonly authService = inject(AuthService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);

  submitBusy = false;

  async ngOnInit(): Promise<void> {
    try {
      await this.dataService.loadAll();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }

  async save(): Promise<void> {
    const uid = this.authService.uid();
    if (!uid) {
      this.routesService.redirectToSignin();
      return;
    }

    this.submitBusy = true;
    try {
      await this.dataService.save();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.submitBusy = false;
    }
  }
}
