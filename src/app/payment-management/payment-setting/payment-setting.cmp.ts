import { Component } from '@angular/core';
import { PaymentListHeaderSettingCmp } from './payment-list-header-setting/payment-list-header-setting.cmp';

@Component({
  selector: 'app-payment-setting',
  imports: [PaymentListHeaderSettingCmp],
  templateUrl: './payment-setting.cmp.html',
  styleUrl: './payment-setting.cmp.css',
})
export class PaymentSettingCmp {}
