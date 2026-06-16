import { Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EmployeeEmployDetailCmp } from '../employees-management/employees-list/employee-detail/employee-employ-detail/employee-employ-detail.cmp';
import { EmployeeStatusCmp } from '../employees-management/employees-list/employee-detail/employee-status/employee-status.cmp';
import { EmployeeDetailDataService } from '../employees-management/employees-list/employee-detail/employee-detail-data.service';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { MonthlyPaymentCmp } from './monthly-payment/monthly-payment.cmp';
import { MainPagePaymentSummaryCmp } from './main-page-payment-summary/main-page-payment-summary.cmp';

@Component({
  selector: 'app-main-page',
  imports: [EmployeeEmployDetailCmp, EmployeeStatusCmp, MatProgressSpinnerModule, MonthlyPaymentCmp, MainPagePaymentSummaryCmp],
  templateUrl: './main-page.cmp.html',
  styleUrl: './main-page.cmp.css',
})
export class MainPageCmp implements OnInit {
  readonly dataService = inject(EmployeeDetailDataService);
  private readonly dialog = inject(MatDialog);

  async ngOnInit(): Promise<void> {
    try {
      await this.dataService.loadForCurrentUser(true);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }
}
