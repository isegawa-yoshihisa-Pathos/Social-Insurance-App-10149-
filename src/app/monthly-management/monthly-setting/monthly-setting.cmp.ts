import { Component } from '@angular/core';
import { MonthlyListHeaderSettingCmp } from './monthly-list-header-setting/monthly-list-header-setting.cmp';
import { MonthlySeedPanelCmp } from './monthly-seed-panel/monthly-seed-panel.cmp';

@Component({
  selector: 'app-monthly-setting',
  imports: [MonthlyListHeaderSettingCmp, MonthlySeedPanelCmp],
  templateUrl: './monthly-setting.cmp.html',
  styleUrl: './monthly-setting.cmp.css',
})
export class MonthlySettingCmp {}
