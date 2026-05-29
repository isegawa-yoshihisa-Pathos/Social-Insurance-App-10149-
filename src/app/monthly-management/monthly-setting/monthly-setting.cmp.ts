import { Component } from '@angular/core';
import { MonthlyBonusSettingCmp } from './monthly-bonus-setting/monthly-bonus-setting.cmp';
import { MonthlyListHeaderSettingCmp } from './monthly-list-header-setting/monthly-list-header-setting.cmp';
import { MonthlySeedPanelCmp } from './monthly-seed-panel/monthly-seed-panel.cmp';
import { MonthlyImportSettingCmp } from './monthly-import-setting/monthly-import-setting.cmp';

@Component({
  selector: 'app-monthly-setting',
  imports: [MonthlyListHeaderSettingCmp, MonthlyBonusSettingCmp, MonthlySeedPanelCmp, MonthlyImportSettingCmp],
  templateUrl: './monthly-setting.cmp.html',
  styleUrl: './monthly-setting.cmp.css',
})
export class MonthlySettingCmp {}
