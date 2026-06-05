import { Component } from '@angular/core';
import { PaymentListHeaderSettingCmp } from './payment-list-header-setting/payment-list-header-setting.cmp';
import { PaymentImportSettingCmp } from './payment-import-setting/payment-import-setting.cmp';
import { AllowanceKindSettingCmp } from './allowance-kind-setting/allowance-kind-setting.cmp';

@Component({
  selector: 'app-payment-setting',
  imports: [AllowanceKindSettingCmp, PaymentListHeaderSettingCmp, PaymentImportSettingCmp],
  templateUrl: './payment-setting.cmp.html',
  styleUrl: './payment-setting.cmp.css',
})
export class PaymentSettingCmp {}
