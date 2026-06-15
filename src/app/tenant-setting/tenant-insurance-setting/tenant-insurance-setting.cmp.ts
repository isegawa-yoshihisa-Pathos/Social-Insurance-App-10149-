import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { HelpContentCmp } from '../../help-content/help-content.cmp';
import { TenantSettingDataService } from '../tenant-setting-data.service';
import { shouldShowResignPremiumCollectionSetting } from '../../../../shared/social-insurance/premium/resign-premium-collection';

@Component({
  selector: 'app-tenant-insurance-setting',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    FormsModule,
    HelpContentCmp,
  ],
  templateUrl: './tenant-insurance-setting.cmp.html',
  styleUrls: ['./tenant-insurance-setting.cmp.css', '../tenant-setting.cmp.css'],
})
export class TenantInsuranceSettingCmp {
  readonly dataService = inject(TenantSettingDataService);

  get form() {
    return this.dataService.form;
  }

  get isCorporateNumberMissing(): boolean {
    return !this.form.socialInsuranceSettings.corporateNumber?.trim();
  }

  get isHealthInsuranceTenantRecordNumberMissing(): boolean {
    return !this.form.socialInsuranceSettings.healthInsuranceTenantRecordNumber?.trim();
  }

  get isPensionInsuranceTenantNumberMissing(): boolean {
    return !this.form.socialInsuranceSettings.pensionInsuranceTenantNumber?.trim();
  }

  get isPensionInsuranceTenantRecordNumberMissing(): boolean {
    return !this.form.socialInsuranceSettings.pensionInsuranceTenantRecordNumber?.trim();
  }

  get showResignPremiumCollectionSetting(): boolean {
    return shouldShowResignPremiumCollectionSetting(
      this.form.socialInsuranceSettings.socialInsuranceCollectionMonth,
    );
  }
}
