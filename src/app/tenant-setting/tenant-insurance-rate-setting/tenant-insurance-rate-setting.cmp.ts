import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { TenantSettingDataService } from '../tenant-setting-data.service';
import { TenantInsuranceRateSettingDisplayCmp } from './tenant-insurance-rate-setting-display/tenant-insurance-rate-setting-display.cmp';
import { TenantInsuranceRateSettingEditCmp } from './tenant-insurance-rate-setting-edit/tenant-insurance-rate-setting-edit.cmp';

@Component({
  selector: 'app-tenant-insurance-rate-setting',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    FormsModule,
    TenantInsuranceRateSettingDisplayCmp,
    TenantInsuranceRateSettingEditCmp,
  ],
  templateUrl: './tenant-insurance-rate-setting.cmp.html',
  styleUrls: ['./tenant-insurance-rate-setting.cmp.css', '../tenant-setting.cmp.css'],
})
export class TenantInsuranceRateSettingCmp {
  readonly dataService = inject(TenantSettingDataService);

  mode: 'display' | 'edit' = 'display';

  openEdit(): void { this.mode = 'edit'; }
  
  closeEdit(): void { this.mode = 'display'; }

  get form() {
    return this.dataService.form;
  }
}
