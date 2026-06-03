import { Component } from '@angular/core';
import { BonusListHeaderSettingCmp } from './bonus-list-header-setting/bonus-list-header-setting.cmp';
import { BonusKindSettingCmp } from './bonus-kind-setting/bonus-kind-setting.cmp';
import { BonusImportSettingCmp } from './bonus-import-setting/bonus-import-setting.cmp';

@Component({
  selector: 'app-bonus-setting',
  imports: [BonusListHeaderSettingCmp, BonusKindSettingCmp, BonusImportSettingCmp],
  templateUrl: './bonus-setting.cmp.html',
  styleUrl: './bonus-setting.cmp.css',
})
export class BonusSettingCmp {

}
