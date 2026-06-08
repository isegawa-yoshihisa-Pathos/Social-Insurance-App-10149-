import { Component } from '@angular/core';
import { MonthlyListHeaderSettingCmp } from './monthly-list-header-setting/monthly-list-header-setting.cmp';
import { MonthlyImportSettingCmp } from './monthly-import-setting/monthly-import-setting.cmp';
import { AllowanceKindSettingCmp } from '../../payment-management/payment-setting/allowance-kind-setting/allowance-kind-setting.cmp';

@Component({
  selector: 'app-monthly-setting',
  imports: [MonthlyListHeaderSettingCmp, MonthlyImportSettingCmp, AllowanceKindSettingCmp],
  templateUrl: './monthly-setting.cmp.html',
  styleUrl: './monthly-setting.cmp.css',
})
export class MonthlySettingCmp {}
